---
name: k8s-deploy
description: >
  Kubernetes deployment operations using kubectl and helm. Activates when the user
  asks to deploy applications to Kubernetes clusters; create or update Deployments,
  Services, ConfigMaps, Secrets, Ingress resources, or PersistentVolumeClaims;
  manage rollouts, rollbacks, and scaling; troubleshoot pod failures, CrashLoopBackOff,
  ImagePullBackOff, or pending pods; inspect cluster resources and events; work with
  Namespaces, Labels, and Selectors; configure resource limits, requests, and
  horizontal pod autoscalers (HPA); manage helm charts and releases; perform canary
  or blue-green deployments; debug service discovery, DNS resolution, or network
  policies; review or generate Kubernetes manifests; manage ServiceAccounts, RBAC,
  and PodSecurityPolicies; handle node maintenance, cordoning, and draining; run
  kubectl exec, logs, port-forward, or describe commands.
version: 1.0.0
tags:
  - kubernetes
  - k8s
  - kubectl
  - helm
  - deployment
  - pods
  - services
  - devops
  - orchestration
  - rollout
  - rollback
allowedTools:
  - execute_shell_command
  - read_file
  - write_file
---

# Kubernetes Deployment Skill

This skill covers deploying, managing, and troubleshooting applications on
Kubernetes clusters using kubectl and helm. It assumes kubectl is configured
with appropriate kubeconfig access and the agent has shell access.

## Constraints

- **Never use `:latest` tag in production Deployments** -- always pin a specific
  container image tag or digest.
- **Never run pods as root in production** -- set `securityContext.runAsNonRoot: true`
  and `runAsUser: 1000+`.
- **Always set resource requests and limits** -- unbounded pods can starve other
  workloads and trigger node-level OOM.
- **Never expose the Kubernetes API server to the public internet** without
  authentication.
- **Never delete Namespaces without user confirmation** -- cascading deletes are
  irreversible.
- **Always use `--dry-run=client -o yaml` before applying** to preview manifests.
- **Prefer `kubectl apply` over `kubectl create`** for idempotent operations.
- **Never modify resources in `kube-system` namespace** unless explicitly asked.

## Pre-Flight Checks

Before any deployment, verify cluster access and context:

```bash
# Verify connectivity
kubectl cluster-info

# Check current context (never deploy to the wrong cluster)
kubectl config current-context

# List available namespaces
kubectl get namespaces

# Check node health
kubectl get nodes -o wide
```

If the context points to a production cluster, **warn the user and confirm
before proceeding**.

## Deployment Manifests

### Standard Deployment Template

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: production
  labels:
    app: myapp
    version: "1.2.0"
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
        version: "1.2.0"
    spec:
      serviceAccountName: myapp
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
        - name: myapp
          image: registry.example.com/myapp:1.2.0
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: myapp-secrets
                  key: database-url
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
          volumeMounts:
            - name: config
              mountPath: /app/config
              readOnly: true
      volumes:
        - name: config
          configMap:
            name: myapp-config
```

### Service Template

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp
  namespace: production
spec:
  selector:
    app: myapp
  ports:
    - port: 80
      targetPort: 3000
      protocol: TCP
  type: ClusterIP
```

### Ingress Template

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp
  namespace: production
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - myapp.example.com
      secretName: myapp-tls
  rules:
    - host: myapp.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: myapp
                port:
                  number: 80
```

## Deployment Workflow

### 1. Deploy or Update an Application

```bash
# Apply manifests
kubectl apply -f deployment.yaml -f service.yaml -f ingress.yaml

# Check rollout status
kubectl rollout status deployment/myapp -n production

# Verify pods are running
kubectl get pods -n production -l app=myapp
```

### 2. Rolling Update (Image Change)

```bash
# Update the image
kubectl set image deployment/myapp myapp=registry.example.com/myapp:1.3.0 \
  -n production

# Monitor rollout
kubectl rollout status deployment/myapp -n production

# Check revision history
kubectl rollout history deployment/myapp -n production
```

### 3. Rollback

```bash
# Check rollout history
kubectl rollout history deployment/myapp -n production

# Rollback to previous revision
kubectl rollout undo deployment/myapp -n production

# Rollback to a specific revision
kubectl rollout undo deployment/myapp --to-revision=2 -n production
```

### 4. Scale

```bash
# Scale manually
kubectl scale deployment/myapp --replicas=5 -n production

# Check HPA status
kubectl get hpa -n production
```

## Helm Operations

### Install and Upgrade

```bash
# Install a chart
helm install myapp ./charts/myapp -n production -f values-production.yaml

# Upgrade with new values or image tag
helm upgrade myapp ./charts/myapp -n production \
  -f values-production.yaml \
  --set image.tag=1.3.0

# Dry-run to preview changes
helm upgrade myapp ./charts/myapp -n production \
  -f values-production.yaml \
  --dry-run --debug

# Rollback a helm release
helm rollback myapp 2 -n production

# List releases
helm list -n production

# Show rendered templates without applying
helm template myapp ./charts/myapp -f values-production.yaml
```

### Values File Best Practices

```yaml
# values-production.yaml
replicaCount: 3

image:
  repository: registry.example.com/myapp
  tag: "1.2.0"   # never "latest"
  pullPolicy: IfNotPresent

resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
```

## Troubleshooting Decision Tree

### Pod is Pending

1. `kubectl describe pod <pod> -n <ns>` -- check the Events section at the bottom.
2. Common causes:
   - Insufficient resources: check `kubectl describe node <node>` for allocatable
     capacity and existing requests.
   - PersistentVolumeClaim not bound: `kubectl get pvc -n <ns>`.
   - NodeSelector or affinity rules too restrictive: verify matching node labels.
   - Taints preventing scheduling: `kubectl describe node <node> | grep Taints`.

### Pod is CrashLoopBackOff

1. `kubectl logs <pod> -n <ns> --previous` -- logs from the last failed container.
2. `kubectl describe pod <pod> -n <ns>` -- check last state and exit code.
3. Common causes:
   - Exit code 1: Application error -- check config, env vars, missing secrets.
   - Exit code 137: OOMKilled -- increase memory limit or investigate memory usage.
   - Exit code 139: Segfault -- architecture mismatch (e.g., ARM image on AMD64 node).
   - Application crashes on startup: probe too aggressive, missing init dependencies.

### Pod is ImagePullBackOff

1. `kubectl describe pod <pod> -n <ns>` -- check the exact error message.
2. Common causes:
   - Image does not exist: verify tag name and registry path.
   - Registry requires authentication: create a `docker-registry` secret and
     reference it as `imagePullSecrets`.
   - Private registry unreachable from cluster: check network policies and firewall.

### Service Discovery Issues

1. Verify the Service selector matches pod labels:
   `kubectl get pods -n <ns> --show-labels`
2. Test DNS resolution from inside the cluster:
   `kubectl run tmp --rm -it --image=busybox --restart=Never -- nslookup myapp.production.svc.cluster.local`
3. Check endpoints: `kubectl get endpoints myapp -n <ns>`
4. If endpoints are empty, the selector is wrong or pods are not ready.

### High Restart Count

```bash
# Check restart counts
kubectl get pods -n <ns> -o wide

# Get detailed pod metrics
kubectl top pods -n <ns>

# Check events sorted by time
kubectl get events -n <ns> --sort-by='.lastTimestamp'
```

## Useful Diagnostic Commands

```bash
# Exec into a running pod
kubectl exec -it <pod> -n <ns> -- /bin/sh

# Port-forward for local debugging
kubectl port-forward svc/myapp 8080:80 -n <ns>

# Copy files from/to a pod
kubectl cp <pod>:/app/logs/app.log ./app.log -n <ns>

# Watch resources in real-time
kubectl get pods -n <ns> -w

# Get resource usage
kubectl top nodes
kubectl top pods -n <ns>

# Extract a secret (base64 decoded)
kubectl get secret myapp-secrets -n <ns> -o jsonpath='{.data.database-url}' | base64 -d

# Check cluster-level events
kubectl get events -A --sort-by='.lastTimestamp' --field-selector type=Warning
```

## Node Maintenance

```bash
# Cordon a node (prevent new pods)
kubectl cordon <node>

# Drain a node (evict pods gracefully)
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data

# Uncordon after maintenance
kubectl uncordon <node>
```

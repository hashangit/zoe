---
name: docker-ops
description: >
  Docker container operations for production and development environments.
  Activates when the user asks to build, run, stop, or remove Docker containers;
  manage Docker images; write or debug Dockerfiles or docker-compose.yml files;
  troubleshoot container failures, networking, or volumes; inspect container logs
  or resource usage; push or pull images from registries; prune unused Docker
  resources; set up multi-stage builds; configure container health checks;
  manage Docker networks and persistent storage; run docker-compose up, down,
  or ps; debug "container won't start", "image build fails", "port already in
  use", "volume mount not working", or "container keeps restarting" issues.
  Also triggers on mentions of Docker Swarm, Docker secret management, or
  container orchestration at the single-host level.
version: 1.0.0
tags:
  - docker
  - containers
  - devops
  - docker-compose
  - dockerfile
  - containerization
  - images
  - volumes
  - networking
allowedTools:
  - execute_shell_command
  - read_file
  - write_file
---

# Docker Operations Skill

This skill provides procedures for building, running, managing, and troubleshooting
Docker containers and Docker Compose stacks. It assumes Docker is available in the
execution environment and the agent has shell access.

## Constraints

- **Never use `:latest` tag in production** -- always pin a specific version or digest.
- **Never run containers as root in production** -- add `USER` directive to Dockerfiles.
- **Never store secrets in Dockerfiles or compose files** -- use Docker secrets, environment
  variables passed at runtime, or external secret managers.
- **Never use `docker system prune -f` without user confirmation** -- it deletes all unused
  data indiscriminately.
- **Always use `--rm` for ephemeral containers** to prevent accumulation.
- **Never expose the Docker daemon socket (`/var/run/docker.sock`) to containers** unless
  explicitly requested by the user.

## Building Images

### Standard Dockerfile Structure

Follow this order for cache efficiency:

```
# 1. Base image (pinned version)
FROM node:20.11-alpine AS base

# 2. System dependencies (rarely change)
RUN apk add --no-cache curl

# 3. Workdir
WORKDIR /app

# 4. Copy dependency manifests first (cache layer)
COPY package.json pnpm-lock.yaml ./

# 5. Install dependencies
RUN corepack enable && pnpm install --frozen-lockfile --prod

# 6. Copy application code
COPY . .

# 7. Non-root user
USER node

# 8. Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# 9. Expose port and entrypoint
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Multi-Stage Builds

Use multi-stage builds to keep final images small. A typical pattern:

1. **Build stage**: Full SDK, compile source, run tests.
2. **Runtime stage**: Minimal base image, copy only compiled output and production deps.

```dockerfile
FROM node:20.11-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:20.11-alpine AS runtime
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
USER node
CMD ["node", "dist/index.js"]
```

### Build Commands

```bash
# Build with explicit tag and no cache
docker build --no-cache -t myapp:1.2.0 .

# Build with build arguments
docker build --build-arg NODE_ENV=production -t myapp:1.2.0 .

# Build for multiple platforms
docker buildx build --platform linux/amd64,linux/arm64 -t myapp:1.2.0 .
```

## Running Containers

### Common Run Patterns

```bash
# Run detached with auto-restart and resource limits
docker run -d \
  --name myapp \
  --restart unless-stopped \
  --memory 512m --cpus 1.0 \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -v myapp-data:/app/data \
  myapp:1.2.0

# Run interactively for debugging
docker run -it --rm \
  -v $(pwd):/app \
  --entrypoint /bin/sh \
  myapp:1.2.0

# Run with health check override
docker run -d \
  --name myapp \
  --health-cmd "curl -f http://localhost:3000/health" \
  --health-interval 10s \
  --health-timeout 3s \
  myapp:1.2.0
```

### Inspecting Running Containers

```bash
# Check resource usage (all running containers)
docker stats --no-stream

# Detailed container info (IP, mounts, env vars)
docker inspect myapp --format '{{ .NetworkSettings.IPAddress }}'

# Follow logs with timestamps
docker logs -f --since 1h --timestamps myapp

# List containers with size
docker ps -s
```

## Docker Compose

### Compose File Best Practices

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NODE_ENV: production
    image: myapp:1.2.0
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
    volumes:
      - app-data:/app/data
    depends_on:
      db:
        condition: service_healthy
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  db:
    image: postgres:16.2-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  app-data:
  db-data:
```

### Compose Commands

```bash
# Start stack in detached mode
docker compose up -d

# Rebuild and restart a single service
docker compose up -d --build app

# View logs for a specific service
docker compose logs -f app

# Scale a service
docker compose up -d --scale worker=3

# Tear down with volumes
docker compose down -v
```

## Troubleshooting Decision Tree

### Container exits immediately

1. Check exit code: `docker inspect myapp --format '{{ .State.ExitCode }}'`
2. Exit code 0: Process completed -- likely a missing foreground process or CMD issue.
3. Exit code 1: Application error -- check logs with `docker logs myapp`.
4. Exit code 137: OOM killed -- increase memory limit or investigate memory leaks.
5. Exit code 139: Segfault -- check base image compatibility (glibc vs musl).

### Container won't start / keeps restarting

1. `docker logs --tail 50 myapp` -- look for error messages.
2. `docker inspect myapp --format '{{ json .State }}'` -- check restart count and status.
3. Verify port is not already in use: `ss -tlnp | grep <port>`.
4. Verify volume mounts exist and have correct permissions.
5. Check if health check is failing too aggressively -- widen intervals.

### Networking issues

1. List networks: `docker network ls`
2. Inspect a network: `docker network inspect bridge`
3. Test connectivity from inside a container: `docker exec myapp ping db`
4. DNS resolution in Docker: containers on the same custom network resolve by
   service name automatically.
5. Port mapping issues: use `docker port myapp` to verify published ports.

### Volume mount problems

1. Check mount points: `docker inspect myapp --format '{{ json .Mounts }}'`
2. File permissions: the host directory's UID/GID must match what the container
   process expects. This is common with Alpine images running as non-root users.
3. SELinux (on RHEL/CentOS): append `:z` or `:Z` to volume mounts.
4. Named volumes vs bind mounts: named volumes are managed by Docker, bind mounts
   map directly to host paths.

## Image Management

```bash
# List images with dangling filter
docker images -f dangling=true

# Remove dangling images
docker image prune

# Tag and push to registry
docker tag myapp:1.2.0 registry.example.com/myapp:1.2.0
docker push registry.example.com/myapp:1.2.0

# Inspect image layers
docker history myapp:1.2.0 --no-trunc

# Save/load image for air-gapped transfer
docker save myapp:1.2.0 | gzip > myapp-1.2.0.tar.gz
docker load < myapp-1.2.0.tar.gz
```

## Cleanup Procedures

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune -a --filter "until=168h"

# Remove unused volumes (CAUTION: data loss)
docker volume prune

# Full cleanup (ask user first)
docker system prune --volumes
```

## Registry Operations

```bash
# Login to a private registry
docker login registry.example.com

# List tags in a registry (via API)
curl -s -u "$USER:$PASS" https://registry.example.com/v2/myapp/tags/list | jq .

# Remove a manifest by digest (garbage collection required on registry)
curl -s -u "$USER:$PASS" -X DELETE \
  https://registry.example.com/v2/myapp/manifests/$DIGEST
```

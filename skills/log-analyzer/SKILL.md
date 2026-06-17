---
name: log-analyzer
description: >
  Analyzing application and system logs to identify patterns, diagnose errors,
  and suggest fixes. Activates when the user asks to check logs, analyze errors,
  find patterns in log files, diagnose crashes, investigate failures, search for
  specific events in logs, parse structured or unstructured log output, identify
  anomalies or spikes in error rates, trace request flows across services, extract
  stack traces, correlate timestamps across multiple log sources, review application
  logs from Docker containers or Kubernetes pods, analyze syslog or journalctl output,
  inspect web server access logs or error logs (nginx, apache), review database
  query logs, check CI/CD pipeline logs, or summarize log data for incident reports.
  Triggers on phrases like "check the logs", "what went wrong", "why is it failing",
  "find the error", "grep the logs", "log analysis", "trace the issue", or
  "investigate the crash".
version: 1.0.0
tags:
  - logs
  - debugging
  - analysis
  - monitoring
  - troubleshooting
  - errors
  - patterns
  - diagnosis
allowedTools:
  - execute_shell_command
  - read_file
---

# Log Analyzer Skill

This skill provides procedures for systematically analyzing application and system
logs. It covers log retrieval, pattern extraction, error diagnosis, and structured
reporting. The agent works with logs from Docker containers, Kubernetes pods, flat
files, journalctl, and piped command output.

## Constraints

- **Never expose secrets found in logs** -- mask tokens, passwords, API keys, and
  connection strings in any output. Replace with `***REDACTED***`.
- **Never assume a single error is the root cause** -- correlate across log sources
  and time windows before drawing conclusions.
- **Never modify production log files** -- read only.
- **Always report timestamps in the original timezone** -- do not convert or assume.
- **Always note the time range analyzed** -- this gives the user context for what
  was and was not covered.
- **Stop and ask if log volume exceeds 10,000 lines** -- propose a narrower filter
  rather than processing everything.

## Log Retrieval Patterns

### Docker Container Logs

```bash
# Recent logs (last 100 lines)
docker logs --tail 100 myapp

# Follow live logs with timestamps
docker logs -f --timestamps myapp

# Logs from a specific time window
docker logs --since "2024-01-15T10:00:00" --until "2024-01-15T11:00:00" myapp

# Logs from a crashed container (previous instance)
docker logs --previous myapp

# Logs for a docker-compose service
docker compose logs --tail 200 app
```

### Kubernetes Pod Logs

```bash
# Logs from a specific pod
kubectl logs myapp-7d4f8b6x9k -n production

# Logs from all pods matching a label
kubectl logs -l app=myapp -n production --all-containers

# Previous crashed container
kubectl logs myapp-7d4f8b6x9k -n production --previous

# Logs from a specific container in a multi-container pod
kubectl logs myapp-7d4f8b6x9k -c sidecar -n production

# Logs with timestamps and time filter
kubectl logs myapp-7d4f8b6x9k -n production --since=1h --timestamps

# Stream logs from multiple pods
kubectl logs -l app=myapp -n production -f --max-log-requests=10
```

### System Logs

```bash
# journalctl for systemd services
journalctl -u myapp.service --since "1 hour ago" --no-pager

# Syslog filtering
tail -n 5000 /var/log/syslog | grep -i "myapp"

# Nginx access logs -- count status codes
awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn

# Nginx error logs
tail -n 1000 /var/log/nginx/error.log

# Application-specific log files
tail -n 2000 /var/log/myapp/application.log
```

## Analysis Workflow

### Step 1: Scope the Investigation

Before diving into logs, determine:

1. **Time window** -- when did the issue start? When did it last occur?
2. **Affected component** -- which service, container, or node?
3. **Symptom** -- error message, slow response, crash, or data inconsistency?
4. **Log source(s)** -- application logs, access logs, system logs, or all of them?

### Step 2: Retrieve and Filter

```bash
# Count total lines to gauge volume
wc -l /var/log/myapp/application.log

# If too large, narrow the time window
grep "2024-01-15T10:" /var/log/myapp/application.log | wc -l

# Filter by log level
grep -E "\[ERROR\]|\[FATAL\]|\[CRITICAL\]" /var/log/myapp/application.log | tail -100

# Filter by request or trace ID
grep "req-abc-123" /var/log/myapp/application.log

# Filter by specific error pattern
grep -i "ECONNREFUSED\|ETIMEDOUT\|ENOTFOUND" /var/log/myapp/application.log
```

### Step 3: Identify Patterns

```bash
# Count errors by type
grep "\[ERROR\]" /var/log/myapp/application.log | \
  awk '{for(i=1;i<=NF;i++) if($i ~ /ERR_/) print $i}' | \
  sort | uniq -c | sort -rn | head -20

# Find error spikes (errors per minute)
grep "\[ERROR\]" /var/log/myapp/application.log | \
  awk '{print substr($1,1,16)}' | \
  uniq -c

# Extract and count HTTP status codes from access logs
awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn

# Find the most common error messages
grep "\[ERROR\]" /var/log/myapp/application.log | \
  sed 's/\[ERROR\].*-- //' | \
  sort | uniq -c | sort -rn | head -20

# Find slow requests (response time > 1s)
awk '$NF > 1000 {print $0}' /var/log/nginx/access.log
```

### Step 4: Extract Stack Traces

```bash
# Extract Java-style stack traces (multiline)
grep -A 20 "Exception\|Error" /var/log/myapp/application.log | head -200

# Extract Node.js stack traces
grep -A 10 "at " /var/log/myapp/application.log | head -200

# Extract Python tracebacks
grep -A 20 "Traceback" /var/log/myapp/application.log | head -200
```

### Step 5: Correlate Across Sources

When multiple services are involved:

1. Extract timestamps from each log source for the same time window.
2. Align by timestamp to see the causal chain.
3. Look for request IDs or correlation IDs that span services.

```bash
# Extract all events for a specific request ID across multiple files
for f in /var/log/myapp/*.log; do
  matches=$(grep "req-abc-123" "$f" | head -5)
  if [ -n "$matches" ]; then
    echo "=== $f ==="
    echo "$matches"
  fi
done
```

## Common Error Patterns and Diagnosis

### Connection Errors

| Pattern | Likely Cause | Action |
|---------|-------------|--------|
| `ECONNREFUSED` | Target service not listening | Check if service is running and port is correct |
| `ETIMEDOUT` | Network unreachable or firewall | Check network routes and security groups |
| `ECONNRESET` | Remote side closed connection | Check remote service health and load |
| `ENOTFOUND` | DNS resolution failure | Check DNS config and service discovery |
| `EPIPE` / `Broken pipe` | Client disconnected | Often benign, check if widespread |

### Out of Memory

```
# Java
java.lang.OutOfMemoryError: Java heap space

# Node.js
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory

# System
Out of memory: Kill process 1234 (node) score 900 or sacrifice child
```

Diagnosis: Check memory limits (Docker/K8s), look for memory leaks in heap dumps,
increase limits if workload legitimately needs more memory.

### Disk Issues

```
No space left on device
Cannot write to log file: No space left on device
```

```bash
# Check disk usage
df -h

# Find large files
du -sh /var/log/* | sort -rh | head -10

# Check inode usage
df -i
```

### Certificate / TLS Errors

```
SSL: CERTIFICATE_VERIFY_FAILED
unable to verify the first certificate
certificate has expired
self-signed certificate in certificate chain
```

Diagnosis: Check certificate expiry dates, verify CA chain, check system clock
for time drift.

## Log Format Handling

### JSON Logs

```bash
# Pretty-print JSON logs
tail -n 100 /var/log/myapp/application.log | jq .

# Filter by level
cat /var/log/myapp/application.log | jq 'select(.level == "error")'

# Extract specific fields
cat /var/log/myapp/application.log | jq '{timestamp, level, message, requestId}'

# Count by error type
cat /var/log/myapp/application.log | \
  jq -r 'select(.level == "error") | .message' | \
  sort | uniq -c | sort -rn | head -20
```

### Structured Text Logs (key=value)

```bash
# Filter by level
grep "level=error" /var/log/myapp/application.log

# Extract specific key
grep -oP 'request_id=\K[^ ]+' /var/log/myapp/application.log | sort -u
```

### Unstructured Logs

For logs without consistent formatting:

1. Identify the timestamp format by examining the first few lines.
2. Identify the log level indicator (varies widely).
3. Use `grep` with appropriate regex to filter.
4. Fall back to line-by-line analysis for small extracts.

## Reporting Format

When presenting log analysis results, use this structure:

```
## Log Analysis Report

**Time Range**: <start> to <end>
**Log Source(s)**: <files or containers>
**Total Lines Analyzed**: <number>

### Summary
<2-3 sentence overview of findings>

### Key Errors
1. [<timestamp>] <error message>
   - Occurrence count: <N>
   - Likely cause: <explanation>
   - Suggested fix: <action>

### Patterns Detected
- <pattern description with frequency>

### Recommendations
1. <actionable recommendation>
2. <actionable recommendation>
```

## Performance Considerations

- Use `tail` with line counts instead of `cat` for large files.
- Pipe through `grep` before `awk` or `jq` to reduce processing volume.
- Use `--since` flags on Docker and Kubernetes log commands to limit output.
- For very large log files, use `ripgrep` (`rg`) instead of `grep` for speed.
- Avoid sorting entire files -- use `head` and `tail` to sample first.

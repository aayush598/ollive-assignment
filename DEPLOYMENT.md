# Deployment Guide

> **Version:** 1.0.0  
> **Last Updated:** 2026-05-28

---

## Table of Contents

1. [Deployment Options](#deployment-options)
2. [Docker Deployment](#docker-deployment)
3. [Kubernetes Deployment](#kubernetes-deployment)
4. [Vercel Deployment](#vercel-deployment)
5. [PM2 Production](#pm2-production)
6. [Environment Configuration](#environment-configuration)
7. [Database Migrations](#database-migrations)
8. [Monitoring Setup](#monitoring-setup)
9. [Troubleshooting](#troubleshooting)

---

## Deployment Options

| Method | Complexity | Scalability | Best For |
|--------|-----------|-------------|----------|
| Docker Compose | Low | Single node | Development, staging, small production |
| Kubernetes | High | Multi-node | Production at scale |
| Vercel + Managed DB | Low | Auto-scaling | Serverless, low maintenance |
| PM2 + Bare Metal | Medium | Single node | VPS, dedicated servers |

---

## Docker Deployment

### Prerequisites

- Docker 24+ and Docker Compose v2+
- At least 2GB RAM (4GB+ for observability stack)
- LLM API keys

### Production Build

```bash
# Build the production image
docker build -f docker/Dockerfile -t llm-logger:latest --no-cache .

# Check image size
docker images llm-logger:latest

# Expected: ~300-400MB (multi-stage build with Alpine)
```

### Production Compose

```bash
# Start production stack (app + postgres)
docker compose -f docker/docker-compose.yml up -d

# Verify
curl http://localhost:3000/api/health

# View logs
docker compose -f docker/docker-compose.yml logs -f app

# Stop
docker compose -f docker/docker-compose.yml down
```

### Environment Variables

Create a `.env` file in the project root or pass variables directly:

```bash
docker compose -f docker/docker-compose.yml up -d \
  -e DATABASE_URL=postgres://postgres:postgres@postgres:5432/llmchat \
  -e BETTER_AUTH_SECRET=your-secret-key-min-32-chars \
  -e NVIDIA_API_KEY=nvapi-...
```

### Full Observability Stack

```bash
# Start all 18 services (requires 4GB+ RAM)
docker compose -f docker/docker-compose.observability.yml up -d

# Wait 60s for initialization, then verify
curl http://app.localhost/api/health
curl http://grafana.localhost/api/health
curl http://prometheus.localhost/api/v1/targets
curl http://loki.localhost/ready

# Access dashboards:
# - Grafana: http://grafana.localhost (admin/admin)
# - Prometheus: http://prometheus.localhost
# - Loki: http://loki.localhost/ready
# - Uptime Kuma: http://uptime.localhost
```

### Docker Compose Profiles

| Compose File | Services | Purpose |
|-------------|----------|---------|
| `docker/docker-compose.dev.yml` | Postgres + Redis | Local development |
| `docker/docker-compose.yml` | Postgres + App | Production |
| `docker/docker-compose.observability.yml` | 18 services | Full observability |
| `docker/docker-compose.openreplay.yml` | OpenReplay stack | Session replay (4GB+ RAM) |

---

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster 1.28+ (tested with kind v0.27.0)
- kubectl 1.28+
- Kustomize (included in kubectl v1.36+)

### Quick Start with kind

```bash
# Install kind
curl -Lo /tmp/kind https://kind.sigs.k8s.io/dl/v0.27.0/kind-linux-amd64
chmod +x /tmp/kind

# Create cluster
echo "your-password" | sudo -S /tmp/kind create cluster --name llm-logger

# Export kubeconfig
echo "your-password" | sudo -S /tmp/kind get kubeconfig --name llm-logger > ~/.kube/config

# Deploy
kubectl apply -k k8s/

# Verify
kubectl get pods -n llm-inference-logger
kubectl get svc -n llm-inference-logger

# Clean up
echo "your-password" | sudo -S /tmp/kind delete cluster --name llm-logger
```

### Production Cluster

```bash
# Deploy to production cluster
kubectl apply -k k8s/

# Verify deployment
kubectl get all -n llm-inference-logger

# Check pod status
kubectl get pods -n llm-inference-logger -w

# View logs
kubectl logs -n llm-inference-logger deployment/llm-logger-app

# Scale manually (HPA handles auto-scaling)
kubectl scale -n llm-inference-logger deployment/llm-logger-app --replicas=5

# Run database migration job
kubectl delete job -n llm-inference-logger db-migrate  # Re-run if needed
kubectl apply -k k8s/  # Re-applies migration job
```

### Kubernetes Resources

| Resource | Name | Purpose |
|----------|------|---------|
| Namespace | `llm-inference-logger` | Resource isolation |
| ConfigMap | `llm-logger-config` | Non-sensitive configuration |
| Secret | `llm-logger-secrets` | API keys, database credentials |
| Deployment | `llm-logger-app` | Application pods (2 replicas) |
| Service | `llm-logger-app` | Internal cluster access |
| StatefulSet | `postgres` | Database with persistent storage |
| Service | `postgres` | Headless DB service |
| HPA | `llm-logger-app` | Auto-scale 2-10 pods at 70% CPU |
| Job | `db-migrate` | Pre-install migration |
| Ingress | `llm-logger-ingress` | External access with nginx |

### Resource Limits

```
Application:
  Request:  256Mi RAM, 250m CPU
  Limit:    512Mi RAM, 500m CPU
  HPA:      2-10 replicas at 70% CPU

PostgreSQL:
  Request:  256Mi RAM, 250m CPU
  Limit:    1Gi RAM, 1 CPU
  Storage:  10Gi PVC
```

---

## Vercel Deployment

### Prerequisites

- Vercel account
- Managed PostgreSQL (Neon, Supabase, etc.)
- Vercel environment variables configured

### Setup

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Serverless Considerations

When deploying to Vercel (serverless), note these differences from Docker/K8s:

| Feature | Docker/K8s | Vercel (Serverless) |
|---------|-----------|---------------------|
| BullMQ | Redis + background worker | In-process execution |
| Cache | Redis | In-memory (ephemeral) |
| Rate Limiting | Redis | In-memory (per-instance) |
| File Storage | MinIO/S3 | In-memory (or configure S3) |
| Search | Typesense | SQL LIKE fallback |
| WebSocket | Supported | Not supported (use polling) |
| Streaming | SSE (works) | SSE (limited to 10s) |
| Background Jobs | PM2 worker | Inline execution |

### Required Environment Variables (Vercel)

```env
DATABASE_URL=postgres://...  # Managed PostgreSQL (Neon, Supabase)
BETTER_AUTH_SECRET=...       # 32+ character secret
BETTER_AUTH_URL=https://your-app.vercel.app
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NVIDIA_API_KEY=nvapi-...    # Or any LLM provider key
```

---

## PM2 Production

### Bare Metal / VPS

```bash
# Build the application
npm run build

# Start with PM2
pm2 start docker/ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup auto-start on reboot
pm2 startup

# Monitor
pm2 monit
pm2 logs llm-inference-logger

# Reload without downtime
pm2 reload llm-inference-logger
```

### PM2 Configuration

```javascript
// docker/ecosystem.config.js
module.exports = {
  apps: [{
    name: "llm-inference-logger",
    script: "node_modules/next/dist/bin/next",
    args: "start",
    instances: 1,
    exec_mode: "fork",
    env: {
      NODE_ENV: "production",
      PORT: 3000,
    },
    max_memory_restart: "1G",
    restart_delay: 5000,
    exp_backoff_restart_delay: 100,
  }]
};
```

---

## Environment Configuration

### All Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | **Yes** | — | Auth secret (32+ chars) |
| `BETTER_AUTH_URL` | **Yes** | — | Public app URL |
| `NEXT_PUBLIC_APP_URL` | Yes | `http://localhost:3000` | Public app URL |
| `OPENAI_API_KEY` | No | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | No | — | Anthropic API key |
| `GEMINI_API_KEY` | No | — | Google Gemini API key |
| `DEEPSEEK_API_KEY` | No | — | DeepSeek API key |
| `OPENROUTER_API_KEY` | No | — | OpenRouter API key |
| `NVIDIA_API_KEY` | No | — | NVIDIA NIM API key |
| `DEFAULT_LLM_PROVIDER` | No | `nvidia` | Default provider |
| `DEFAULT_LLM_MODEL` | No | `minimaxai/minimax-m2.7` | Default model |
| `MAX_CONTEXT_MESSAGES` | No | `20` | Max messages in context |
| `LLM_REQUEST_TIMEOUT` | No | `30000` | Request timeout (ms) |
| `LLM_STREAM_TIMEOUT` | No | `60000` | Stream timeout (ms) |
| `LOG_LEVEL` | No | `info` | Pino log level |
| `ENABLE_METRICS` | No | `true` | Prometheus metrics |
| `REDIS_URL` | No | — | Redis connection string |
| `QDRANT_URL` | No | — | Qdrant vector DB URL |
| `QDRANT_API_KEY` | No | — | Qdrant API key |
| `S3_ENDPOINT` | No | — | S3/MinIO endpoint |
| `S3_ACCESS_KEY` | No | — | S3 access key |
| `S3_SECRET_KEY` | No | — | S3 secret key |
| `S3_BUCKET` | No | `uploads` | S3 bucket name |
| `S3_REGION` | No | `us-east-1` | S3 region |
| `TYPESENSE_API_KEY` | No | `xyz` | Typesense API key |
| `TYPESENSE_HOST` | No | — | Typesense host |
| `TYPESENSE_PORT` | No | `8108` | Typesense port |
| `TYPESENSE_PROTOCOL` | No | `http` | Typesense protocol |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | — | OpenTelemetry endpoint |
| `OTEL_SERVICE_NAME` | No | `llm-inference-logger` | Service name for traces |
| `SENTRY_DSN` | No | — | Sentry/GlitchTip DSN |
| `ADMIN_EMAILS` | No | `admin@example.com` | Comma-separated admin emails |

---

## Database Migrations

### Development

```bash
# Push schema changes directly
npm run db:push

# Generate migration file
npm run db:generate

# Apply migrations
npm run db:migrate

# Open Drizzle Studio (GUI)
npm run db:studio
```

### Production

```bash
# Using Docker
docker compose -f docker/docker-compose.yml run --rm app npx drizzle-kit push

# Using K8s (automatic via migration-job.yaml)
kubectl apply -k k8s/  # Job runs on deploy

# Manual
kubectl delete job -n llm-inference-logger db-migrate
kubectl apply -k k8s/
```

---

## Monitoring Setup

### Health Checks

Configure your load balancer or monitoring system to check:

```
GET /api/health
Expected: 200 OK, {"status": "healthy", "database": "connected"}
```

### Prometheus Scraping

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'llm-logger'
    scrape_interval: 15s
    metrics_path: /api/metrics
    static_configs:
      - targets: ['localhost:3000']
```

### Grafana Dashboard

A pre-built Grafana dashboard is available at:
`docker/grafana/dashboards/llm-inference-overview.json`

Import this dashboard into Grafana to monitor:
- Request volume (rate, total)
- Token usage (prompt, completion, total)
- Latency (average, P95, P99)
- Error rates
- Provider breakdown
- Active conversations

---

## Troubleshooting

### Docker Issues

| Problem | Solution |
|---------|----------|
| Port conflict (3000 in use) | Change `ports` in compose file or stop conflicting process |
| Container exits immediately | Check logs: `docker compose logs app` |
| Database connection refused | Ensure postgres is healthy: `docker compose ps` |
| Image build fails | Check Dockerfile syntax, ensure Node 20+ |
| Volume permission denied | Check user permissions, may need `docker compose down -v` |

### K8s Issues

| Problem | Solution |
|---------|----------|
| Pod not starting | `kubectl describe pod -n llm-inference-logger <pod>` |
| CrashLoopBackOff | Check logs: `kubectl logs -n llm-inference-logger <pod>` |
| Migration job failed | `kubectl logs -n llm-inference-logger job/db-migrate` |
| HPA not scaling | Check metrics: `kubectl get hpa -n llm-inference-logger` |
| Ingress not working | Check ingress controller: `kubectl get ingress -n llm-inference-logger` |

### Application Issues

| Problem | Solution |
|---------|----------|
| Health returns 500 | Check database connection, env vars |
| Chat returns 401 | Re-login, check session cookie |
| Ingestion fails with FK error | Create conversation first |
| Rate limit errors | Wait 60s, reduce request frequency |
| Streaming not working | Check browser SSE support, network proxy |
| PII not redacting | Check input format, regex patterns |
| Search returns nothing | Data may not be indexed yet |
| File upload fails | Use multipart/form-data, not JSON |

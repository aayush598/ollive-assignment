# LLM Inference Logger — Complete Manual Test Plan

> **Goal:** Test every component of the project manually via CLI/API.
> **Prerequisite:** `.env` populated with valid credentials.

### sudo / Docker Notes

If `sudo` is configured with `requiretty`, piped passwords (e.g. `echo password | sudo -S cmd`) will **not** work.
You must run `sudo` commands interactively in a terminal.

If the Docker daemon requires `sudo`, prefix docker commands or add your user to the `docker` group:
```bash
sudo usermod -aG docker $USER && newgrp docker
```

### Shell Compatibility

This plan uses **bash** syntax. If your shell is **fish**, adapt variable assignments and loops:

| Action | Bash | Fish |
|--------|------|------|
| Assign variable | `VAR=$(cmd)` | `set VAR (cmd)` |
| Iterate | `for i in $(seq N); do ...; done` | `for i in (seq N); ...; end` |
| Export env | `export VAR=val` | `set -x VAR val` |

The curl commands themselves are identical. Where a bash-specific pattern appears, the fish equivalent is shown in a comment.

---

## Phase 0: Preflight

```bash
# Check Node version
node --version   # >=20

# Check Docker
docker --version && docker compose version

# If Docker requires sudo, add user to docker group:
#   sudo usermod -aG docker $USER && newgrp docker

# Check kubectl + kustomize (optional — skip if not installed)
which kubectl 2>/dev/null || echo "kubectl not installed (skip K8s tests)"
which kustomize 2>/dev/null || echo "kustomize not installed (skip K8s tests)"

# Install dependencies
npm ci

# Copy env if not done
cp .env.example .env   # then edit .env with real keys
```

---

## Phase 1: Static Analysis & Unit Tests (no infra)

Run these **before** starting any services.

### 1.1 Lint
```bash
npm run lint
```
- Expect **0 errors** (2 warnings for `console.warn` in `env.ts` are acceptable — intentional circular-dependency workaround).

### 1.2 TypeScript check
```bash
npm run typecheck
```
- Expect **0 errors**.

### 1.3 Unit tests
```bash
npm test
```
- Expect **14 files, 119 tests, all passed**.

### 1.4 Format check
```bash
npm run format:check
```
- Expect no formatting violations.

---

## Phase 2: Dev Environment (Postgres + Redis)

> **Note:** In this environment Docker requires `sudo`. All `docker exec` commands use `sudo docker exec "$(sudo docker ps -q -f name=...)"` — the `sudo` is needed on the subshell too, otherwise the container ID will be empty.

### 2.1 Start dev infrastructure
```bash
sudo npm run docker:dev
# or: sudo docker compose -f docker/docker-compose.dev.yml up -d
```

### 2.2 Verify Postgres is up
```bash
sudo docker ps --filter "name=postgres" --format "{{.Names}} {{.Status}}"
# → postgres  Up X seconds (healthy)

sudo docker exec "$(sudo docker ps -q -f name=postgres)" pg_isready -U postgres
# → /var/run/postgresql:5432 - accepting connections
```

### 2.3 Verify Redis is up
```bash
sudo docker ps --filter "name=redis" --format "{{.Names}} {{.Status}}"
# → redis  Up X seconds

sudo docker exec "$(sudo docker ps -q -f name=redis)" redis-cli PING
# → PONG
```

### 2.4 Run database migrations
```bash
npm run db:push
# or: npx drizzle-kit push
```
- Expect migrations to apply successfully, no errors.

### 2.5 Verify schema
```bash
# Connect and list tables
sudo docker exec "$(sudo docker ps -q -f name=postgres)" psql -U postgres -d llmchat -c "\dt"
# → Should show: user, session, account, verification, conversations, messages, inference_logs, error_events, analytics_events
```

---

## Phase 3: Full-Stack Application (Dev Server)

### 3.1 Start development server
```bash
npm run dev
```
- Server starts on `http://localhost:3000`.

### 3.2 Health endpoint
```bash
curl -s http://localhost:3000/api/health | jq .
```
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-..."
}
```

### 3.3 Security headers (middleware)
```bash
curl -sI http://localhost:3000/ | grep -iE "content-security-policy|strict-transport-security|x-frame-options|x-content-type-options"
```
**Expected headers:**
- `content-security-policy` (present)
- `strict-transport-security: max-age=31536000; includeSubDomains; preload`
- `x-frame-options: DENY`
- `x-content-type-options: nosniff`

### 3.4 Landing page
```bash
curl -s http://localhost:3000/ | head -c 200
# → Returns HTML, not a redirect
```

### 3.5 Auth — Registration
```bash
# Register a new user
curl -s -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"TestPass123!","name":"Test User"}' \
  -c /tmp/cookies.txt \
  -w "\nHTTP %{http_code}"
```
- Expected: HTTP **200**, JSON with `token` and `user` object, session cookie set in `/tmp/cookies.txt`.

### 3.6 Auth — Session verification
> **Note:** In better-auth v1.6.11, the session endpoint is `/get-session`.
```bash
curl -s -b /tmp/cookies.txt http://localhost:3000/api/auth/get-session | jq .
```
- Expected: JSON with `session` (expiresAt, token, userAgent, userId) and `user` (id, email, name).

### 3.7 Auth — Unauthorized access
```bash
# Call protected route without cookies
curl -s http://localhost:3000/api/conversations | jq .
# → HTTP 401 Unauthorized
```

### 3.8 Auth — Logout
> **Note:** better-auth requires `Content-Type: application/json`, `Origin` header, and an empty JSON body `-d '{}'` on POST requests.
```bash
curl -s -X POST http://localhost:3000/api/auth/sign-out \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -b /tmp/cookies.txt \
  -d '{}' | jq .
# → {"success":true}
curl -s -b /tmp/cookies.txt http://localhost:3000/api/auth/get-session | jq .
# → null or 401
```

### 3.9 Re-login (needed for subsequent tests)
> **Note:** In better-auth v1.6.11, the sign-in endpoint is `/sign-in/email`.
```bash
# Note: only one -c flag — the last one wins. Use -b /tmp/cookies.txt in subsequent requests.
curl -s -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"TestPass123!"}' \
  -c /tmp/cookies.txt \
  -w "\nHTTP %{http_code}"
```

### 3.10 Models endpoint
> **Note:** This endpoint returns **401 Unauthorized** if the session cookie is missing/invalid
> (it no longer silently returns `{ models: [] }` on auth failure).
```bash
curl -s -b /tmp/cookies.txt http://localhost:3000/api/models | jq .
```
- Expected: List of available LLM models with `provider`, `model`, and `label` fields.

### 3.11 Conversations — Create
```bash
# Get session user ID
USER_ID=$(curl -s -b /tmp/cookies.txt http://localhost:3000/api/auth/get-session | jq -r '.user.id')
# fish: set USER_ID (curl -s -b /tmp/cookies.txt http://localhost:3000/api/auth/get-session | jq -r '.user.id')
echo "User ID: $USER_ID"

# Create a conversation via chat endpoint (non-streaming)
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d '{"message":"Hello, what is 2+2?","conversationId":""}' \
  -w "\nHTTP %{http_code}" | tee /tmp/chat-response.json | jq .
```
- **On success:** Returns response with message, conversation ID, token counts.
- **On failure** (invalid API key): Returns 500 or timeout after 30s. If that happens, create a conversation manually:
```bash
# Manual conversation insert via DB (bypasses LLM)
sudo docker exec "$(sudo docker ps -q -f name=postgres)" psql -U postgres -d llmchat -c "
INSERT INTO conversations (id, user_id, title, status, model, provider, created_at, updated_at)
VALUES ('test-conv-1', '$USER_ID', 'Test Conversation', 'active', 'gpt-4', 'openai', NOW(), NOW());
"
```

### 3.12 Conversations — List
```bash
curl -s -b /tmp/cookies.txt "http://localhost:3000/api/conversations?limit=10" | jq .
```
- Expected: `conversations` array with `pagination` metadata.
- Verify `hasMore` boolean and `cursor` for next page.

### 3.13 Conversations — GET single
```bash
CONV_ID="test-conv-1"   # or the ID from step 3.11
curl -s -b /tmp/cookies.txt "http://localhost:3000/api/conversations/$CONV_ID" | jq .
```
- Expected: Conversation object with `id`, `title`, `status`, `messages` array.

### 3.14 Conversations — Update title
```bash
curl -s -X PATCH "http://localhost:3000/api/conversations/$CONV_ID" \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d '{"title":"Updated Manual Test Title"}' | jq .
```

### 3.15 Conversations — Cancel
```bash
curl -s -X POST "http://localhost:3000/api/conversations/$CONV_ID/cancel" \
  -b /tmp/cookies.txt | jq .
# → Status should change to "cancelled"
```

### 3.16 Conversations — Resume
```bash
curl -s -X POST "http://localhost:3000/api/conversations/$CONV_ID/resume" \
  -b /tmp/cookies.txt | jq .
# → Status should change to "active"
```

### 3.17 Conversations — Delete
```bash
curl -s -X DELETE "http://localhost:3000/api/conversations/$CONV_ID" \
  -b /tmp/cookies.txt | jq .
# → {"success": true}
```

### 3.18 Ingestion — Valid log
> **Important:** `conversationId` must reference an existing conversation (foreign key).
> If the conversation doesn't exist, you'll get a descriptive error like:
> `Referenced record not found (inference_logs_conversation_id_conversations_id_fk). Create the resource first.`
```bash
curl -s -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d '{
    "logs": [{
      "provider": "openai",
      "model": "gpt-4",
      "status": "success",
      "latencyMs": 150,
      "promptTokens": 50,
      "completionTokens": 100,
      "totalTokens": 150,
      "conversationId": "test-conv-1"
    }]
  }' | jq .
```
```json
{
  "accepted": 1,
  "rejected": 0,
  "errors": []
}
```

### 3.19 Ingestion — Invalid data (validation)
```bash
curl -s -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d '{"logs":[{"invalid":true}]}' | jq .
```
- Expected: `"accepted": 0, "rejected": 1` with clean individual error messages per field
  (not a single JSON-stringified blob):
  ```json
  {
    "accepted": 0,
    "rejected": 1,
    "errors": [
      "logs.0.provider: Invalid input: expected string, received undefined",
      "logs.0.model: Invalid input: expected string, received undefined",
      "logs.0.status: Invalid option: expected one of \"success\"|\"error\"|\"cancelled\"",
      "logs.0.conversationId: Invalid input: expected string, received undefined"
    ]
  }
  ```
- HTTP status: **207 Multi-Status**.

### 3.20 Ingestion — PII redaction
```bash
curl -s -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d '{
    "logs": [{
      "provider": "openai",
      "model": "gpt-4",
      "status": "success",
      "latencyMs": 50,
      "totalTokens": 10,
      "conversationId": "test-conv-1",
      "inputPreview": "email me at john@doe.com or call 555-123-4567, SSN: 123-45-6789"
    }]
  }' | jq .
```

### 3.21 Ingestion — Retrieve logs
```bash
curl -s -b /tmp/cookies.txt "http://localhost:3000/api/ingest?limit=10" | jq '.logs[] | {provider, model, inputPreview, piiRedacted}'
```
- Verify PII fields contain `[EMAIL_REDACTED]`, `[PHONE_REDACTED]`, `[SSN_REDACTED]`.

### 3.22 Ingestion — Stats
```bash
curl -s -b /tmp/cookies.txt "http://localhost:3000/api/ingest?stats=true" | jq .
```
- Expected: `totalRequests`, `totalTokens`, `averageLatencyMs`, `byProvider`.

### 3.23 Ingestion — Rate limiting
> **Note:** The first ~120 requests succeed (200). They will fail with a FK error if
> `test-conv-1` doesn't exist (see 3.18 note), but that is fine — the rate limit test
> only checks HTTP status codes. The requests beyond 120 return **429**.
```bash
# Fast-fire 150 requests (rate limit is 120/min)
for i in $(seq 1 150); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/ingest \
    -H "Content-Type: application/json" \
    -b /tmp/cookies.txt \
    -d '{"logs":[{"provider":"openai","model":"gpt-4","status":"success","latencyMs":1,"totalTokens":1,"conversationId":"test-conv-1"}]}'
done | sort | uniq -c
```
- Expected: Some 200s, then **429** after exceeding 120 requests.

### 3.24 Chat — Streaming endpoint (requires valid API key)
```bash
curl -s -N -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d '{"message":"Count from 1 to 5","conversationId":""}' \
  --max-time 30 2>&1 | head -20
```
- Expected: SSE data chunks `data: {"type":"chunk","content":"..."}` \n\n followed by `data: {"type":"done","...}`.

### 3.25 Chat — Cancellation (requires streaming)
```bash
# Start stream in background
curl -s -N -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d '{"message":"Tell me a very long story","conversationId":""}' \
  --max-time 120 > /tmp/stream-out.txt 2>&1 &
PID=$!
sleep 3

# Get conversation ID from partial output
CONV_ID=$(grep -o '"conversationId":"[^"]*"' /tmp/stream-out.txt | head -1 | cut -d'"' -f4)
echo "Cancelling conv $CONV_ID"

# Cancel it
curl -s -X POST "http://localhost:3000/api/conversations/$CONV_ID/cancel" \
  -b /tmp/cookies.txt | jq .

# Verify stream stopped
wait $PID 2>/dev/null
tail -5 /tmp/stream-out.txt
# → Should show "cancelled" not full story
```

### 3.26 Chat — Context management
```bash
# Send a few messages in the same conversation
CONV_ID=$(curl -s -b /tmp/cookies.txt "http://localhost:3000/api/conversations?limit=1" | jq -r '.conversations[0].id')
# fish: set CONV_ID (curl -s -b /tmp/cookies.txt "http://localhost:3000/api/conversations?limit=1" | jq -r '.conversations[0].id')
echo "Using conv: $CONV_ID"

# Send follow-up messages
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d "{\"message\":\"Remember my name is Alice\",\"conversationId\":\"$CONV_ID\"}" | jq .response

curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d "{\"message\":\"What is my name?\",\"conversationId\":\"$CONV_ID\"}" | jq .response
# → Should answer "Alice"
```

### 3.27 Search
```bash
curl -s -b /tmp/cookies.txt "http://localhost:3000/api/search?q=hello" | jq .
```
- Expected: Empty results or matching conversations/messages.

### 3.28 Analytics event
```bash
curl -s -X POST http://localhost:3000/api/analytics \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d '{"type":"page_view","path":"/test-page","data":{"browser":"curl"}}' \
  -w "\nHTTP %{http_code}"
```
- Expected: HTTP **201**, response includes `"success": true, "id": "..."`.

### 3.29 CSP report endpoint
```bash
curl -s -X POST http://localhost:3000/api/csp-report \
  -H "Content-Type: application/json" \
  -d '{"csp-report":{"document-uri":"http://localhost:3000/","violated-directive":"script-src"}}' \
  -w "\nHTTP %{http_code}"
```
- Expected: HTTP **204** (No Content).

### 3.30 Files endpoint
```bash
# List files (empty)
curl -s -b /tmp/cookies.txt http://localhost:3000/api/files | jq .
# → []

# Upload a file (must use multipart/form-data — JSON body returns 500)
curl -s -X POST http://localhost:3000/api/files \
  -F "file=@package.json" \
  -b /tmp/cookies.txt | jq .
# → {"key":".../....json", "url":"/api/files/..."}

# List again
curl -s -b /tmp/cookies.txt http://localhost:3000/api/files | jq .
# → [{"key":"...", "url":"/api/files/...", "size":..., "contentType":"..."}]

# Delete (uses query param ?key=, not path param)
FILE_KEY=$(curl -s -b /tmp/cookies.txt http://localhost:3000/api/files | jq -r '.[0].key')
# fish: set FILE_KEY (curl -s -b /tmp/cookies.txt http://localhost:3000/api/files | jq -r '.[0].key')
curl -s -X DELETE "http://localhost:3000/api/files?key=$FILE_KEY" -b /tmp/cookies.txt | jq .
```

### 3.31 Admin dashboard — Stats
```bash
curl -s -b /tmp/cookies.txt http://localhost:3000/api/admin/stats | jq .
```
- Expected: `totalRequests`, `totalTokens`, `averageLatencyMs`, `p95LatencyMs`, `successRate`, `byProvider`, `hourlyBreakdown`, `recentErrors`.

### 3.32 Admin dashboard — Hourly breakdown
```bash
curl -s -b /tmp/cookies.txt http://localhost:3000/api/admin/stats/hourly | jq .
```
- Expected: Array of hourly data points for last 24 hours.

### 3.33 Metrics (Prometheus)
```bash
curl -s http://localhost:3000/api/metrics | head -30
```
- Expected: Prometheus metrics in text format (`# HELP`, `# TYPE`, metric values).

### 3.34 Sitemap & Robots
```bash
curl -s http://localhost:3000/sitemap.xml | head -20
# → Valid XML with routes

curl -s http://localhost:3000/robots.txt
# → Valid robots.txt
```

---

## Phase 4: Observability Stack (Full docker-compose.observability.yml)

### 4.1 Start full observability stack
```bash
npm run docker:observability
# or: docker compose -f docker/docker-compose.observability.yml up -d
```

This boots **18 services**. Wait 60s for all to initialize.

### 4.2 Verify all services
```bash
docker compose -f docker/docker-compose.observability.yml ps --format "table {{.Name}}\t{{.Status}}"
```
- Expected: All 18 services show "Up" (some may be "healthy").

### 4.3 Caddy reverse proxy
> **Important:** Caddy must target the correct upstream. For dev mode (Next.js on host):
> 1. Copy the dev Caddyfile to the system config:
>    ```bash
>    sudo cp docker/caddy/Caddyfile.dev /etc/caddy/Caddyfile
>    ```
> 2. Reload Caddy (use whichever command works on your system):
>    ```bash
>    # If caddy is in PATH
>    sudo caddy reload --config /etc/caddy/Caddyfile
>    
>    # If installed as a systemd service
>    sudo systemctl reload caddy
>    
>    # If caddy was started manually, send SIGHUP (finds the PID automatically)
>    sudo kill -HUP "$(pgrep -x caddy)"
>    ```
> For Docker compose mode, use `docker/caddy/Caddyfile` (targets Docker service names).
```bash
# Test each Caddy route
curl -sI http://app.localhost/ | head -5
# → HTTP/2 200 (or 302), server: Caddy

curl -sI http://grafana.localhost/ | head -5
# → HTTP/2 302, server: Caddy

# Prometheus does not support HEAD — use GET
curl -s http://prometheus.localhost/ | head -3
# → <a href="/graph">Found</a>.

# Loki root returns 404; use /ready instead
curl -s http://loki.localhost/ready
# → Ready
```

### 4.4 Caddy — Static asset caching
```bash
curl -sI "http://app.localhost/_next/static/test.js" | grep -i "cache-control"
# → cache-control: public, max-age=31536000, immutable

curl -sI http://app.localhost/api/health | grep -i "cache-control"
# → cache-control: no-cache, no-store, must-revalidate
```

### 4.5 Prometheus — Targets
```bash
curl -s http://prometheus.localhost/api/v1/targets | jq '.data.activeTargets[].labels.job'
```
- Expected jobs: `nextjs-app`, `node-exporter`, `cadvisor`, `prometheus`.

### 4.6 Prometheus — Query app metrics
> **Note:** Use `prometheus.localhost` (port 80 via Caddy), NOT `prometheus.localhost:9090`.
```bash
curl -s "http://prometheus.localhost/api/v1/query?query=http_requests_total" | jq '.data.result[0].value'
# → Should return a numeric value

curl -s "http://prometheus.localhost/api/v1/query?query=llm_inference_duration_ms" | jq '.data.result'
```

### 4.7 Prometheus — Query node/cadvisor metrics
```bash
curl -s "http://prometheus.localhost/api/v1/query?query=node_memory_MemTotal_bytes" | jq '.data.result[0].value[1]'
# → Returns total memory in bytes

curl -s "http://prometheus.localhost/api/v1/query?query=container_cpu_usage_seconds_total" | jq '.data.result | length'
# → Should be > 0
```

### 4.8 Grafana — Login
> **Note:** Use `grafana.localhost` (port 80 via Caddy), NOT `grafana.localhost:3000` (which bypasses Caddy and hits the Next.js app).
> The login API is `POST /api/login`, not `POST /login`.
```bash
# Health check (via Caddy on port 80)
curl -s http://grafana.localhost/api/health | jq .
# → {"commit":"...","database":"ok","version":"11.3.1"}

# Login (via Caddy on port 80)
curl -s -X POST http://grafana.localhost/api/login \
  -H "Content-Type: application/json" \
  -d '{"user":"admin","password":"admin"}' \
  -c /tmp/grafana-cookies.txt | jq .
```

### 4.9 Grafana — Verify datasources
```bash
curl -s -b /tmp/grafana-cookies.txt http://grafana.localhost/api/datasources | jq '.[].name'
```
- Expected: `["Prometheus", "Loki", "Tempo"]` (or whatever is configured).

### 4.10 Grafana — Explore Prometheus
```bash
curl -s -b /tmp/grafana-cookies.txt \
  "http://grafana.localhost/api/tsdb/query?db=Prometheus&q=http_requests_total&time=$(date +%s)" | jq '.results[0].series[0].name'
```

### 4.11 Loki — Push a log line
> **Note:** Use `loki.localhost` (port 80 via Caddy), NOT `loki.localhost:3100`.
```bash
# Generate some app activity first (repeat steps 3.18-3.22 several times)

# Query Loki for recent logs
curl -s "http://loki.localhost/loki/api/v1/query_range" \
  --data-urlencode 'query={job="docker"}' \
  --data-urlencode "start=$(date -d '5 minutes ago' +%s)000000000" \
  --data-urlencode "end=$(date +%s)000000000" \
  --data-urlencode "limit=5" | jq '.data.result[0].values[0][1]'
# → Should return raw log lines from Docker containers
```

### 4.12 Promtail — Verify log shipping
```bash
# Promtail reads Docker logs and ships to Loki
curl -s http://loki.localhost/ready
# → "Ready"

# Check Loki labels (response is an object with a "data" key containing an array of values)
curl -s "http://loki.localhost/loki/api/v1/label" | jq '.data'
# → Should include "container_name", "compose_service", etc.
```

### 4.13 Tempo — Distributed tracing
> **Note:** Tempo, Node Exporter, and cAdvisor are Docker-internal services (no Caddy route).
> Their hostnames (`tempo`, `node-exporter`, `cadvisor`) only resolve inside the Docker network.
> Run these commands from within the Docker network, or add Caddy routes for them.
```bash
# Check Tempo health
curl -s http://tempo:3200/ready
# → "Ready"

# Generate a trace by hitting the app
curl -s http://app.localhost/api/health > /dev/null

# Search for traces in Tempo
curl -s "http://tempo:3200/api/search?start=$(date -d '5 minutes ago' +%s)&end=$(date +%s)&q=health" | jq '.traces | length'
# → Should be > 0 if instrumentation is active
```

### 4.14 Node Exporter — System metrics
```bash
curl -s http://node-exporter:9100/metrics | head -20
# → Prometheus node metrics
```

### 4.15 cAdvisor — Container metrics
```bash
curl -s http://cadvisor:8080/metrics | head -20
# → Container-level Prometheus metrics
```

---

## Phase 5: Supporting Services

> **Important:** All Phase 5 services run inside Docker and their hostnames (`minio`, `typesense`,
> `uptime-kuma`, `glitchtip`, `umami`, `crowdsec`) only resolve inside the Docker network.
> Start the full observability stack first:
> ```bash
> docker compose -f docker/docker-compose.observability.yml up -d
> ```
> Services with a Caddy route (uptime, glitchtip, umami) can be accessed via `<name>.localhost` (port 80).

### 5.1 MinIO (S3-compatible storage)
> **Note:** MinIO has a Caddy route — use `http://minio.localhost` (port 80).
```bash
# Health check
curl -s http://minio.localhost/minio/health/live
# → {"status":"alive"}

# Web console (Docker-internal, no Caddy route)
curl -sI http://minio-console:9001/ | head -5
# → 200 OK

# Test S3 API by uploading a file via the app (use multipart/form-data, not JSON)
curl -s -X POST http://app.localhost/api/files \
  -F "file=@package.json" \
  -b /tmp/cookies.txt | jq .
# If storage.ts uses MinIO, file will be in S3 bucket
```

### 5.2 Typesense (Full-text search)
> **Note:** Typesense has a Caddy route — use `http://typesense.localhost` (port 80).
```bash
# Health check
curl -s "http://typesense.localhost/health" | jq .
# → {"ok":true}

# List collections (may be empty)
curl -s "http://typesense.localhost/collections" \
  -H "X-TYPESENSE-API-KEY: xyz" | jq '.collections | length'
```

### 5.3 Uptime Kuma
> **Note:** Has a Caddy route — use `http://uptime.localhost`.
```bash
curl -sI http://uptime.localhost/ | head -3
# → 200 OK
```

### 5.4 GlitchTip (Error tracking)
> **Note:** Has a Caddy route — use `http://glitchtip.localhost`.
```bash
curl -s http://glitchtip.localhost/api/0/health/ | jq .
# → {"ok":true}

# List projects (via API, requires auth token)
```

### 5.5 Umami (Analytics)
> **Note:** Has a Caddy route — use `http://umami.localhost`.
```bash
curl -s http://umami.localhost/api/heartbeat | jq .
# → {"ok":true}
```

### 5.6 CrowdSec (Security)
> **Note:** CrowdSec is Docker-internal (no Caddy route).
```bash
# CrowdSec is deployed but WAF/bouncer is disabled per compose config.
# Verify it's running (Docker-internal)
curl -s http://crowdsec:8080/v1/health | jq .
# → {"status":"ok","message":"healthy"}
```

### 5.7 OpenReplay (Session replay) — if `docker:openreplay` is started
> **Note:** OpenReplay exposes port 9000 on the host via Docker port mapping.
> If something else is already on port 9000, stop it first or change the mapping.
```bash
# Frontend
curl -sI http://localhost:9000/ | head -3
# → 200 OK

# Backend API
curl -s http://localhost:9000/api/health | jq .
```

---

## Phase 6: Production Paths

### 6.1 Docker production build
```bash
docker build -f docker/Dockerfile -t llm-logger:test --no-cache .
```
- Expect successful multi-stage build.
- Image size can be checked: `docker images llm-logger:test`

### 6.2 Docker Compose production
```bash
# Start full production stack
docker compose -f docker/docker-compose.yml up -d

# Verify
curl -s http://localhost:3000/api/health | jq .
# → healthy

# Tear down
docker compose -f docker/docker-compose.yml down
```

### 6.3 PM2 ecosystem
```bash
# Verify the ecosystem config is valid
node -e "const c = require('./docker/ecosystem.config.js'); console.log('Apps:', c.apps.length); c.apps.forEach(a => console.log('  -', a.name, a.script, 'instances:', a.instances))"
```
- Expected: `llm-inference-logger`, `next start`, 1 instance.

### 6.4 K8s — Validate manifests
```bash
# YAML syntax & multi-document validation
python3 -c "
import yaml, glob
for f in sorted(glob.glob('k8s/*.yaml')):
    with open(f) as fh:
        docs = list(yaml.safe_load_all(fh))
        kinds = [d.get('kind','?') for d in docs if d]
        print(f'{f}: {kinds}')
"
```
- Expected all files parse correctly. `app.yaml` should yield `['Deployment', 'Service', 'HorizontalPodAutoscaler']`. `postgres.yaml` should yield `['StatefulSet', 'Service']`.

### 6.5 K8s — Kustomize build
> **Note:** `kustomize` may not be installed. Run these on a machine with kubectl/kustomize, or install via `brew install kustomize` / `snap install kustomize`.
> As a fallback, you can validate the YAML directly:
> ```bash
> python3 -c "
> import yaml, glob
> for f in sorted(glob.glob('k8s/*.yaml')):
>     kinds = [d.get('kind','?') for d in yaml.safe_load_all(open(f)) if d]
>     print(f'{f}: {kinds}')
> "
> ```
```bash
kustomize build k8s/ > /tmp/k8s-rendered.yaml
echo "Resources: $(grep -c '^kind:' /tmp/k8s-rendered.yaml)"
```
- Expected 8+ resources: Namespace, Secret, ConfigMap, StatefulSet, Service, Deployment, HPA, Ingress, Job.

### 6.6 K8s — Dry-run apply
```bash
kubectl apply --dry-run=client -k k8s/ 2>&1
# → No errors (won't actually create resources)
```

### 6.7 K8s — Check image references
```bash
grep -r 'image:' k8s/ | grep -v 'postgres'
# → Should reference your container registry + llm-logger image
```

### 6.8 K8s — Secret/Configmap inject test
```bash
python3 -c "
import yaml
with open('k8s/app.yaml') as f:
    for doc in yaml.safe_load_all(f):
        if doc and doc.get('kind') == 'Deployment':
            c = doc['spec']['template']['spec']['containers'][0]
            env_from = [e['configMapRef']['name'] for e in c.get('envFrom',[]) if 'configMapRef' in e]
            secret_from = [e['secretRef']['name'] for e in c.get('envFrom',[]) if 'secretRef' in e]
            print(f'ConfigMaps: {env_from}')
            print(f'Secrets: {secret_from}')
"
```
- Expected: ConfigMap `llm-logger-config` and Secret `llm-logger-secrets` injected.

### 6.9 GitHub Actions — CI workflow
```bash
# Validate workflow syntax
node -e "
const yaml = require('node:fs').readFileSync('.github/workflows/ci.yml','utf8');
console.log('CI workflow file is ', yaml.length, 'bytes');
console.log('Has 4 jobs:', yaml.includes('build:'), yaml.includes('test:'), yaml.includes('docker:'));
"
```
- Expected: Workflow file valid, contains lint, test, build, docker jobs.

### 6.10 Husky + commitlint
```bash
# Test commit message linting
echo "feat: this is a valid commit message" | npx commitlint
# → exit code 0, no output

echo "this is not a valid commit" | npx commitlint
# → exit code 1, error message
```

---

## Phase 7: Error & Edge Cases

### 7.1 Database disconnection
```bash
# Current health
curl -s http://localhost:3000/api/health | jq .

# Stop postgres
docker stop "$(docker ps -q -f name=postgres)"

# Wait for TCP timeout (~10s for new connections)
sleep 15

# Health check should now fail
curl -s --max-time 5 http://localhost:3000/api/health 2>&1 || echo "Connection failed (expected)"

# Restart postgres
docker start "$(docker ps -aq -f name=postgres)"

# Wait for recovery
sleep 10

# Verify health restored
curl -s http://localhost:3000/api/health | jq .
```

### 7.2 Redis disconnection (dev mode)
```bash
docker stop "$(docker ps -q -f name=redis)"

# App should fall back gracefully (BullMQ jobs run inline per docs/bullmq.md)
curl -s http://localhost:3000/api/health | jq .
# → Should still work (app doesn't depend on Redis for core functionality)

docker start "$(docker ps -aq -f name=redis)"
```

### 7.3 Invalid LLM provider
```bash
# Try an unknown provider
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d '{"message":"test","conversationId":"","provider":"unknown-provider"}' | jq .
# → 400 or error about unsupported provider
```

### 7.4 Rate limiter exhaustion
```bash
# Exhaust /api/search rate limit (30/min)
for i in $(seq 1 40); do
  curl -s -o /dev/null -w "%{http_code}\n" -b /tmp/cookies.txt \
    "http://localhost:3000/api/search?q=test"
done | sort | uniq -c
# → 30 x 200, 10 x 429
```

### 7.5 Conversation not found
```bash
curl -s -b /tmp/cookies.txt "http://localhost:3000/api/conversations/nonexistent-id" | jq .
# → 404 error
```

### 7.6 Unauthorized cross-user access
```bash
# Create a second user
curl -s -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"user2@test.com","password":"TestPass123!","name":"User Two"}' \
  -c /tmp/cookies2.txt > /dev/null

# Get user1's conversation IDs with user1's cookie
CONV_ID=$(curl -s -b /tmp/cookies.txt "http://localhost:3000/api/conversations?limit=1" | jq -r '.conversations[0].id')
# fish: set CONV_ID (curl -s -b /tmp/cookies.txt "http://localhost:3000/api/conversations?limit=1" | jq -r '.conversations[0].id')

# Try to access with user2's cookie
curl -s -b /tmp/cookies2.txt "http://localhost:3000/api/conversations/$CONV_ID" | jq .
# → 403 or 404 (should not return user1's conversation)
```

### 7.7 Ingestion — Empty batch
```bash
curl -s -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d '{"logs":[]}' | jq .
# → {"accepted":0, "rejected":0, "errors":[]}
```

### 7.8 Ingestion — Missing required fields
```bash
curl -s -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d '{"logs":[{"provider":"openai"}]}' | jq .
```
- Expected: Clean per-field validation messages:
  ```json
  {
    "accepted": 0,
    "rejected": 1,
    "errors": [
      "logs.0.model: Invalid input: expected string, received undefined",
      "logs.0.status: Invalid option: expected one of \"success\"|\"error\"|\"cancelled\"",
      "logs.0.conversationId: Invalid input: expected string, received undefined"
    ]
  }
  ```

### 7.9 Large payload rejection
```bash
# Generate a huge payload (1000 logs)
PAYLOAD='{"logs":['
for i in $(seq 1 1000); do
  PAYLOAD+='{"provider":"openai","model":"gpt-4","status":"success","latencyMs":1,"totalTokens":1,"conversationId":"test-conv-1"},'
done
PAYLOAD="${PAYLOAD%,}]}"

curl -s -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d "$PAYLOAD" | jq '.accepted, .rejected'
# → May hit body size limit and return 413
```

### 7.10 Concurrent conversation operations
```bash
# Send cancel and resume simultaneously (race condition test)
CONV_ID="test-conv-1"
curl -s -X POST "http://localhost:3000/api/conversations/$CONV_ID/cancel" -b /tmp/cookies.txt &
curl -s -X POST "http://localhost:3000/api/conversations/$CONV_ID/resume" -b /tmp/cookies.txt &
wait

# Check final state
curl -s -b /tmp/cookies.txt "http://localhost:3000/api/conversations/$CONV_ID" | jq '.conversation.status'
```

### 7.11 Invalid auth tokens
```bash
curl -s -H "Cookie: better-auth.session_token=invalid-token" \
  http://localhost:3000/api/conversations | jq .
# → 401
```

### 7.12 Malformed JSON in requests
```bash
curl -s -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d 'not-json' | jq .
```
- Expected: 400 with parse error:
  ```json
  {
    "error": "Unexpected token 'o', \"not-json\" is not valid JSON"
  }
  ```

### 7.13 Missing Content-Type
```bash
curl -s -X POST http://localhost:3000/api/ingest \
  -b /tmp/cookies.txt \
  -d '{"logs":[]}' | jq .
# → If body is valid JSON, it may be parsed anyway (200 with accepted:0).
# → If middleware rejects missing Content-Type, returns 400/415.
```

### 7.14 Downstream service degradation
```bash
# If Qdrant is configured but unreachable, vector operations should fail gracefully
# If Typesense is down, search should fall back to SQL LIKE
```

---

## Phase 8: Cleanup & Teardown

### 8.1 Stop dev server
```bash
# Kill the next dev process
pkill -f "next dev" || true
```

### 8.2 Stop Docker services
```bash
# Stop dev services
docker compose -f docker/docker-compose.dev.yml down

# Stop observability stack
docker compose -f docker/docker-compose.observability.yml down -v  # -v removes volumes

# Stop production stack
docker compose -f docker/docker-compose.yml down

# Remove temp files
rm -f /tmp/cookies.txt /tmp/cookies2.txt /tmp/chat-response.json /tmp/stream-out.txt /tmp/k8s-rendered.yaml
```

### 8.3 Prune Docker (optional)
```bash
docker system prune -f --volumes   # Caution: removes all unused data
```

---

## Appendix A: Quick Reference — Ports & URLs

| Service | Internal | External (Caddy) |
|---------|----------|-------------------|
| App | app:3000 | app.localhost |
| Grafana | grafana:3000 | grafana.localhost |
| Prometheus | prometheus:9090 | prometheus.localhost |
| Loki | loki:3100 | loki.localhost |
| Tempo | tempo:3200 | — |
| Uptime Kuma | uptime-kuma:3001 | uptime.localhost |
| GlitchTip | glitchtip:8000 | glitchtip.localhost |
| Umami | umami:3000 | umami.localhost |
| MinIO API | minio:9000 | — |
| MinIO Console | minio:9001 | — |
| Typesense | typesense:8108 | — |
| OpenReplay (if used) | localhost:9000-9003 | — |

## Appendix B: Key Credentials (dev defaults)

| Service | Username | Password |
|---------|----------|----------|
| Grafana | admin | admin |
| MinIO Console | admin | minio123 |
| GlitchTip | (self-register) | — |
| Umami | admin | umami |
| Typesense API | — | `xyz` |

## Appendix C: Expected Test Count Summary

| Phase | Tests | Manual Steps |
|-------|-------|-------------|
| 1. Static analysis | 4 | 4 commands |
| 2. Dev infra | 5 | 5 commands |
| 3. App functionality | 34 | 34 API calls |
| 4. Observability | 15 | 15 curl checks |
| 5. Supporting services | 7 | 7 checks |
| 6. Production paths | 10 | 10 commands |
| 7. Error scenarios | 14 | 14 commands |
| 8. Cleanup | 4 | 4 commands |
| **Total** | **93** | **93 steps** |

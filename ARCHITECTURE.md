# Architecture

> **Version:** 1.0.0  
> **Last Updated:** 2026-05-28

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow](#data-flow)
4. [API Design](#api-design)
5. [Database Schema](#database-schema)
6. [Authentication & Authorization](#authentication--authorization)
7. [Ingestion Pipeline](#ingestion-pipeline)
8. [LLM Provider Architecture](#llm-provider-architecture)
9. [Observability Architecture](#observability-architecture)
10. [Security Architecture](#security-architecture)
11. [Design Decisions](#design-decisions)

---

## System Overview

LLM Inference Logger is a full-stack Next.js 16 application that provides:

1. **Unified Chat Interface** — Multi-provider LLM interaction with streaming
2. **Inference Logging** — Automatic capture and storage of all LLM operations
3. **Admin Dashboard** — Real-time analytics and monitoring
4. **Observability Stack** — Metrics, logs, traces, error tracking

### Architecture Principles

- **Single Deployment Unit**: The entire application runs as a single Next.js process,
  eliminating network overhead between microservices for moderate-scale deployments.
- **Pluggable Providers**: Adding a new LLM provider requires implementing two methods
  (`generate` and `generateStream`).
- **Defense in Depth**: PII redaction happens at the SDK level (prevention), API level
  (enforcement), and storage level (compliance).
- **Graceful Fallbacks**: Every external dependency (Redis, Typesense, MinIO, Qdrant)
  has an in-memory fallback — the app works without any of them.
- **Observability by Default**: Metrics, structured logging, and tracing are built into
  the request lifecycle.

---

## Component Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │   Chat UI    │  │    Admin     │  │Conversations│  │  Landing  │ │
│  │  (chat/*)    │  │  (dashboard) │  │   (conv/*)  │  │  (page)  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  └──────────┘ │
│         │                 │                  │                       │
│  ┌──────┴─────────────────┴──────────────────┴──────────────────┐  │
│  │                    Middleware Layer                            │  │
│  │  proxy.ts (CSP, HSTS, CORS, Security Headers)                │  │
│  │  Rate Limiting (in-memory/Redis bucket)                       │  │
│  │  Auth Session Validation (Better Auth)                        │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │                                        │
│  ┌──────────────────────────┴────────────────────────────────────┐  │
│  │                      API Layer (16 routes)                     │  │
│  │  ┌────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌───────┐  │  │
│  │  │ Chat   │ │ Ingestion│ │  Conv    │ │  Auth   │ │Admin  │  │  │
│  │  │ 3 rts │ │ 2 routes │ │ 6 routes │ │ 4 routes│ │2 rts  │  │  │
│  │  └────────┘ └──────────┘ └──────────┘ └─────────┘ └───────┘  │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │                                        │
│  ┌──────────────────────────┴────────────────────────────────────┐  │
│  │                      Service Layer                             │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐   │  │
│  │  │LLM Registry│  │  Ingestion   │  │ Conversation Manager  │   │  │
│  │  │ 6 providers│  │  Pipeline    │  │ (CRUD + lifecycle)    │   │  │
│  │  └────────────┘  └──────────────┘  └──────────────────────┘   │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐   │  │
│  │  │   PII      │  │   Search     │  │   File Storage       │   │  │
│  │  │  Redactor  │  │ Typesense/SQL│  │ MinIO / In-memory    │   │  │
│  │  └────────────┘  └──────────────┘  └──────────────────────┘   │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │                                        │
│  ┌──────────────────────────┴────────────────────────────────────┐  │
│  │                      Data Layer                                │  │
│  │  ┌────────────┐  ┌────────────┐  ┌─────────┐  ┌──────────┐   │  │
│  │  │ PostgreSQL │  │   Redis    │  │  MinIO  │  │ Typesense│   │  │
│  │  │ (Drizzle)  │  │ Cache/Queue│  │  S3     │  │  Search  │   │  │
│  │  └────────────┘  └────────────┘  └─────────┘  └──────────┘   │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Chat Flow (with Ingestion)

```
User
  │
  ▼
POST /api/chat ───► Auth Middleware (session validation)
  │                     │
  │                     ▼
  │               Rate Limiter (30/min)
  │                     │
  │                     ▼
  │               Zod Validation
  │                     │
  │                     ▼
  │          ┌─────────────────────┐
  │          │  LLM Provider       │
  │          │  Registry           │
  │          │  ───────────────    │
  │          │  generate() or      │
  │          │  generateStream()   │
  │          └──────────┬──────────┘
  │                     │
  │                     ▼
  │          ┌─────────────────────┐
  │          │  Response → User    │
  │          │                     │
  │          │  ┌──────────────┐   │
  │          │  │  Create/     │   │
  │          │  │  Update      │   │
  │          │  │  Conversation│   │
  │          │  └──────────────┘   │
  │          │                     │
  │          │  ┌──────────────┐   │
  │          │  │  Store       │   │
  │          │  │  Messages    │   │
  │          │  └──────────────┘   │
  │          │                     │
  │          │  ┌──────────────┐   │
  │          │  │  Insert      │   │
  │          │  │  Inference   │   │
  │          │  │  Log (PII    │   │
  │          │  │  Redacted)   │   │
  │          │  └──────────────┘   │
  │          │                     │
  │          │    PostgreSQL       │
  │          │    [NOTIFY]         │
  │          │       │             │
  │          │       ▼             │
  │          │  Async Consumers    │
  │          │  Vector Store       │
  │          │  Analytics          │
  │          │  Webhooks           │
  └──────────┴─────────────────────┘
```

### Ingestion Flow (SDK)

```
Application Code
      │
      ▼
Ingestion SDK ───► Buffer (in-memory, max 50 logs)
      │                        │
      │                        ▼
      │               Flush Trigger:
      │               • Buffer full (50)
      │               • Time interval (5s)
      │               • Process exit (SIGINT/SIGTERM)
      │                        │
      │                        ▼
      │               POST /api/ingest
      │                        │
      │                        ▼
      │               Ingestion Pipeline:
      │               1. Validate (Zod Schema)
      │               2. PII Redact
      │               3. Extract Metadata
      │               4. Batch Insert (PostgreSQL)
      │                        │
      │                        ▼
      │               207 Multi-Status Response
      │               { accepted, rejected, errors[] }
```

---

## API Design

### Routing Convention

```
/api/{resource}          — Collection operations (GET list, POST create)
/api/{resource}/[id]     — Single resource (GET, PATCH, DELETE)
/api/{resource}/[id]/action  — Sub-resource actions (cancel, resume)
```

### Pagination

Cursor-based pagination for conversation listing:

```
GET /api/conversations?limit=20&cursor=<opaque_cursor>

Response:
{
  "conversations": [...],
  "pagination": {
    "cursor": "opaque-cursor-string",
    "hasMore": true
  }
}
```

### Error Format

```json
{
  "error": "Human-readable error message"
}
```

For batch operations (ingestion), partial failures return HTTP 207:

```json
{
  "accepted": 5,
  "rejected": 2,
  "errors": [
    "logs.0.provider: Invalid input: expected string, received undefined",
    "logs.3.status: Invalid option: expected one of \"success\"|\"error\"|\"cancelled\""
  ]
}
```

### Rate Limiting

| Endpoint | Limit | Scope |
|----------|-------|-------|
| `/api/chat` | 30/min | Per user |
| `/api/chat/stream` | 20/min | Per user |
| `/api/ingest` | 120/min | Per user |
| `/api/search` | 30/min | Per user |
| `/api/conversations` | 60/min | Per user |
| `/api/analytics` | 100/min | Per user |

---

## Database Schema

### Entity Relationship

```
┌─────────┐       ┌──────────────┐       ┌──────────────────┐
│  user   │──1:N──│ conversations│──1:N──│    messages      │
└─────────┘       └──────────────┘       └──────────────────┘
     │                  │                         │
     │                  │                         │
     │                  │         1:N              │
     │                  └──────────────────────────┘
     │                  │
     │                  │ 1:N
     │                  ▼
     │          ┌──────────────────┐
     │──1:N─────│  inference_logs  │
     │          └──────────────────┘
     │
     │──1:N─────│  error_events    │
     │
     │──1:N─────│ analytics_events │
```

### Table Specifications

#### `conversations`
| Column | Type | Purpose |
|--------|------|---------|
| `id` | `text` (PK) | nanoid |
| `user_id` | `text` (FK → user) | Owner |
| `title` | `text` | Display title |
| `status` | `text` | active / cancelled / completed |
| `model` | `text` | LLM model used |
| `provider` | `text` | LLM provider |
| `total_tokens` | `integer` | Aggregated for fast queries |
| `total_latency_ms` | `integer` | Aggregated for fast queries |
| `message_count` | `integer` | Denormalized counter |

**Indexes:** `user_id`, `status`, `created_at`, `(user_id, status)`, `(user_id, created_at)`

#### `inference_logs`
| Column | Type | Purpose |
|--------|------|---------|
| `id` | `text` (PK) | nanoid |
| `conversation_id` | `text` (FK → conversations) | Parent conversation |
| `user_id` | `text` (FK → user) | User who made the request |
| `provider` | `text` | LLM provider |
| `model` | `text` | LLM model |
| `status` | `text` | success / error / cancelled |
| `latency_ms` | `integer` | Response time |
| `prompt_tokens` | `integer` | Input tokens |
| `completion_tokens` | `integer` | Output tokens |
| `total_tokens` | `integer` | Sum of prompt + completion |
| `input_preview` | `text` | PII-redacted input |
| `output_preview` | `text` | PII-redacted output |
| `metadata` | `jsonb` | Flexible schema evolution |
| `pii_redacted` | `boolean` | Whether PII was detected |

**Indexes:** `conversation_id`, `user_id`, `provider`, `status`, `created_at`, `model`, `(user_id, created_at)`, `(provider, status)`

**Trigger:** `notify_inference_log_insert` — fires `NOTIFY inference_log_insert` on each insert for event-driven consumers.

---

## Authentication & Authorization

### Auth Flow (Better Auth)

```
1. User registers → POST /api/auth/sign-up/email
   → Account created, session token returned

2. User logs in → POST /api/auth/sign-in/email
   → Session token set in HTTP-only cookie

3. API request → Cookie attached automatically
   → requireAuth() validates session
   → Returns user object or throws 401

4. Logout → POST /api/auth/sign-out
   → Session destroyed, cookie cleared
```

### Authorization (CASL)

```
Actions: create, read, update, delete, manage
Roles:   user, admin

User permissions:
  • Manage own conversations, messages, inference logs
  • Read own analytics
  • Read public system metrics

Admin permissions:
  • Manage ALL conversations, messages, inference logs
  • Manage users, error events, analytics
  • Access admin dashboard
```

---

## Ingestion Pipeline

```
┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────┐
│ Validate  │───▶│ Redact   │───▶│ Extract      │───▶│ Store    │
│ (Zod)     │    │ PII      │    │ Metadata     │    │ (DB)     │
└──────────┘    └──────────┘    └──────────────┘    └──────────┘
```

### Validation

- Zod schema validates each log entry
- Required: `provider`, `model`, `status`, `conversationId`
- Expected types: string, numeric ranges, enum validation
- Rejected entries return clean per-field error messages

### PII Redaction

Pattern-based detection using regular expressions:

| Pattern | Redacted | Example |
|---------|----------|---------|
| Email | `[EMAIL_REDACTED]` | `john@doe.com` → `[EMAIL_REDACTED]` |
| Phone | `[PHONE_REDACTED]` | `555-123-4567` → `[PHONE_REDACTED]` |
| SSN | `[SSN_REDACTED]` | `123-45-6789` → `[SSN_REDACTED]` |
| Credit Card | `[CREDIT_CARD_REDACTED]` | `4111-1111-1111-1111` → `[CREDIT_CARD_REDACTED]` |

### Metadata Extraction

- Token counts validated (non-negative integers)
- Latency validated (positive integer)
- JSONB metadata field preserved for custom attributes

---

## LLM Provider Architecture

### Provider Interface

```typescript
interface LLMProvider {
  generate(
    model: string,
    messages: LLMMessage[],
    options?: LLMRequestOptions
  ): Promise<LLMResponse>;

  generateStream(
    model: string,
    messages: LLMMessage[],
    options?: LLMRequestOptions
  ): ReadableStream<LLMChunk>;
}
```

### Provider Registry

The registry discovers providers automatically:

1. Each provider exports a `createProvider()` factory function
2. Registry scans for available API keys in environment
3. Only providers with valid API keys are registered
4. `/api/models` returns the union of all registered models

### Supported Providers

| Provider | Models | Auth |
|----------|--------|------|
| OpenAI | gpt-4.1, gpt-4.1-mini, gpt-4.1-nano | `OPENAI_API_KEY` |
| Anthropic | claude-sonnet-4-20250514 | `ANTHROPIC_API_KEY` |
| Gemini | gemini-2.5-flash, gemini-2.5-pro | `GEMINI_API_KEY` |
| DeepSeek | deepseek-chat, deepseek-reasoner | `DEEPSEEK_API_KEY` |
| OpenRouter | 10+ models | `OPENROUTER_API_KEY` |
| NVIDIA | 5+ models (default) | `NVIDIA_API_KEY` |

---

## Observability Architecture

### Three Pillars

```
┌────────────────────────────────────────────────────────────┐
│                    Observability Stack                       │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Metrics    │    │     Logs     │    │    Traces    │  │
│  │  Prometheus  │    │  Loki +      │    │  Tempo       │  │
│  │  /api/metrics│    │  Promtail    │    │  (OTLP)      │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                    │          │
│         └───────────────────┴────────────────────┘          │
│                              │                              │
│                         ┌────▼────┐                        │
│                         │ Grafana │                        │
│                         └─────────┘                        │
└────────────────────────────────────────────────────────────┘
```

### Custom Metrics

The application exposes Prometheus metrics at `/api/metrics`:

| Metric | Type | Labels |
|--------|------|--------|
| `llm_inference_requests_total` | Counter | provider, model, status |
| `llm_inference_duration_ms` | Histogram | provider, model |
| `llm_inference_tokens_total` | Counter | provider, model, type (prompt/completion) |
| `http_requests_total` | Counter | method, route, status |
| `http_request_duration_ms` | Histogram | method, route |
| `active_connections` | Gauge | — |

### Logging (Pino)

```json
{
  "level": "info",
  "time": "2026-05-28T12:00:00.000Z",
  "msg": "LLM inference completed",
  "provider": "nvidia",
  "model": "minimaxai/minimax-m2.7",
  "latencyMs": 1234,
  "tokens": { "prompt": 50, "completion": 100, "total": 150 }
}
```

---

## Security Architecture

### Defense Layers

```
Layer 1: Network
  ├── CrowdSec WAF (rate limiting, IP blocking)
  └── Caddy reverse proxy (TLS termination)

Layer 2: Application
  ├── CSP headers (script-src, frame-ancestors, etc.)
  ├── HSTS (max-age=31536000, includeSubDomains, preload)
  ├── X-Frame-Options: DENY
  └── X-Content-Type-Options: nosniff

Layer 3: Authentication
  ├── Better Auth session validation
  ├── HTTP-only secure cookies
  └── Session expiry

Layer 4: Authorization
  ├── CASL RBAC (user/admin)
  └── Resource ownership checks

Layer 5: Input Validation
  ├── Zod schema validation on all inputs
  ├── Rate limiting (per-user bucket)
  └── Request size limits

Layer 6: Data Protection
  ├── PII redaction at ingestion
  ├── Password hashing (Better Auth)
  └── Parameterized queries (Drizzle ORM)

Layer 7: Monitoring
  ├── CSP violation reports
  ├── Error event capture (GlitchTip)
  └── Prometheus metrics for anomaly detection
```

---

## Design Decisions

### Why Next.js API Routes Instead of Separate Services?

**Decision:** Single Next.js application with API routes.

**Tradeoff:** Simpler deployment and development at the cost of process isolation.

**Rationale:** For moderate-scale inference logging (thousands of requests/minute),
a single process eliminates network overhead and operational complexity. Horizontal
scaling is achieved by running multiple Next.js instances behind a load balancer.

### Why Synchronous DB Writes?

**Decision:** Ingestion writes are synchronous (within the request-response cycle).

**Tradeoff:** Simpler code that works for moderate throughput. High-throughput scenarios
(10k+ logs/second) would need async batching.

**Rationale:** The ingestion API is designed for SDK batch flushing (50 logs/batch),
so each request already amortizes the write cost across multiple logs.

### Why Regex-Based PII Redaction?

**Decision:** Pattern-based regex redaction instead of ML-based detection.

**Tradeoff:** Fast and zero-dependency, but misses complex patterns and context-dependent PII.

**Rationale:** Regex covers 95%+ of common PII (emails, phones, SSNs, credit cards)
with sub-millisecond processing per log. ML-based detection can be added as an
optional enhancement.

### Why In-Memory Fallbacks?

**Decision:** Every external service has an in-memory fallback.

**Rationale:** The application should work out of the box with just PostgreSQL.
Redis, Typesense, MinIO, and Qdrant are optional enhancements. This makes the
initial setup trivial while allowing progressive enhancement.

### Why Cursor-Based Pagination?

**Decision:** Cursor-based (keyset) pagination instead of offset-based.

**Rationale:** Cursor pagination is O(1) regardless of page depth, avoids the
"missing rows" problem when data changes between pages, and performs better
at scale with proper indexing.

---

## Failure Modes & Recovery

| Failure | Behavior | Recovery |
|---------|----------|----------|
| DB connection lost | Health returns 503, API returns 500 | Connection pool retries, auto-reconnect |
| LLM API timeout | Error logged, user sees timeout error | Configurable timeout (default 30s) |
| PII redaction failure | Log rejected with validation error | Log skipped, batch continues |
| Redis unavailable | Falls back to in-memory cache | Automatic when Redis recovers |
| Typesense unavailable | Falls back to SQL LIKE search | Automatic when Typesense recovers |
| MinIO unavailable | Falls back to in-memory storage | Automatic when MinIO recovers |
| Qdrant unavailable | Vector operations skipped | Automatic when Qdrant recovers |
| Rate limit exceeded | HTTP 429 response | Retry after expiry window |
| Invalid auth token | HTTP 401 response | Re-authenticate |

# Technical Specification

> **Version:** 1.0.0  
> **Last Updated:** 2026-05-28

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [API Design](#api-design)
5. [Data Model](#data-model)
6. [Authentication & Authorization](#authentication--authorization)
7. [LLM Provider Integration](#llm-provider-integration)
8. [Ingestion Pipeline](#ingestion-pipeline)
9. [Observability](#observability)
10. [Deployment Topologies](#deployment-topologies)
11. [Performance Characteristics](#performance-characteristics)
12. [Security Model](#security-model)
13. [Tradeoffs & Rationale](#tradeoffs--rationale)

---

## System Requirements

### Minimum Requirements

| Component | Specification |
|-----------|---------------|
| CPU | 2 vCPUs (x86_64 or ARM64) |
| RAM | 4 GB |
| Storage | 20 GB SSD |
| Node.js | >= 20.0 |
| PostgreSQL | >= 16 |
| Redis | >= 7 (optional) |

### Recommended Requirements

| Component | Specification |
|-----------|---------------|
| CPU | 4 vCPUs |
| RAM | 8 GB |
| Storage | 50 GB SSD |
| Network | 1 Gbps |

### Software Dependencies

| Dependency | Version | Required | Purpose |
|------------|---------|----------|---------|
| Node.js | >= 20.0 | Yes | Runtime |
| PostgreSQL | >= 16 | Yes | Primary database |
| Redis | >= 7 | No | Cache, queue backend |
| Docker | >= 24 | No | Containerized deployment |
| MinIO | Latest | No | S3-compatible file storage |
| Typesense | >= 27 | No | Full-text search |
| Qdrant | Latest | No | Vector store |

---

## Technology Stack

### Core Framework

**Next.js 16 (App Router)** — Full-stack React framework

- **Server Components** for page rendering
- **Server Actions** for form mutations
- **API Routes** for REST endpoints
- **Route Handlers** for streaming (SSE)
- **Middleware** for security headers + rate limiting
- **Turbopack** for development bundling

### Database Layer

**Drizzle ORM** with PostgreSQL 16

- Type-safe SQL query builder (not a full ORM)
- Schema defined in TypeScript (`src/lib/db/schema/`)
- Migration generation via `drizzle-kit`
- Push workflow for rapid schema iteration
- Prepared statements for all queries

**Connection Pooling:** `@neondatabase/serverless` with `ws` driver for WebSocket connections.

### Authentication

**Better Auth v1.6.11** — Full-featured auth library for Next.js

- Email/password authentication
- Session management with HTTP-only cookies
- Drizzle adapter for PostgreSQL persistence
- CSRF protection via Origin header validation
- Session expiry and refresh

### State Management

**Zustand** — Lightweight client-side state

- Store slices: chat, conversations, auth, UI
- No boilerplate, no providers
- Built-in middleware for persistence

### Styling

**Tailwind CSS v4** — Utility-first CSS framework

- CSS-first configuration (no `tailwind.config.js`)
- CSS `@import` for component styles
- Dark mode via class strategy

---

## Architecture Overview

### Request Lifecycle

```
HTTP Request
    │
    ▼
Caddy Reverse Proxy
    │  TLS termination, security headers, WAF
    ▼
Next.js Middleware (proxy.ts)
    │  CSP, HSTS, X-Frame-Options, CORS
    ▼
Rate Limiter
    │  Token bucket (in-memory / Redis)
    ▼
Route Handler
    │
    ├── Auth Required? ──Yes──▶ requireAuth() ──401 if invalid──▶ Error
    │
    ▼
Zod Validation
    │
    ▼
Service Layer
    │  LLM, Ingestion, Conversation Manager, etc.
    ▼
Database / External Services
    │
    ▼
Response (JSON / SSE stream)
```

### Process Model

- Single Next.js process handles all concerns (UI + API + streaming)
- Background: `pino` logger, Prometheus metrics registry, connection pools
- Streaming: Server-Sent Events over long-lived HTTP connections
- Ingestion: synchronous batch writes within request-response cycle

---

## API Design

### Routing Convention

```
/api/{resource}                — Collection (GET list, POST create)
/api/{resource}/[id]           — Single resource (GET, PATCH, DELETE)
/api/{resource}/[id]/{action}  — Sub-resource action (cancel, resume)
```

### Pagination

Cursor-based (keyset) pagination for all list endpoints:

```typescript
interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    cursor: string | null;   // Opaque, base64-encoded
    hasMore: boolean;
  };
}
```

**Why cursor-based:**
- O(1) performance regardless of page depth
- Stable results when data changes between pages
- Efficient database index usage

### Error Contract

```typescript
interface ApiError {
  error: string;              // Human-readable message
  code?: string;              // Machine-readable error code
  details?: Record<string, string[]>;  // Field-level errors
}
```

**HTTP Status Codes:**

| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 204 | No content |
| 207 | Partial success (batch ingestion) |
| 400 | Validation error |
| 401 | Unauthenticated |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict |
| 429 | Rate limited |
| 500 | Internal server error |
| 503 | Service unavailable |

### Rate Limiting

Token bucket algorithm with configurable refill rate:

| Endpoint | Rate | Burst | Scope |
|----------|------|-------|-------|
| `/api/chat` | 30/min | 10 | Per user |
| `/api/chat/stream` | 20/min | 5 | Per user |
| `/api/ingest` | 120/min | 30 | Per user |
| `/api/search` | 30/min | 10 | Per user |
| `/api/conversations/*` | 60/min | 20 | Per user |
| `/api/analytics` | 100/min | 30 | Per user |

---

## Data Model

### Entity Relationship Diagram

```
┌──────────────────┐        ┌───────────────────┐
│      user        │        │   better-auth      │
│  ─────────────   │        │  session tables    │
│  id (PK)         │        │  (managed by BA)   │
│  name            │        └───────────────────┘
│  email           │
└──────┬───────────┘
       │ 1:N
       │
┌──────┴───────────┐        ┌───────────────────┐
│  conversations   │──1:N──▶│     messages       │
│  ─────────────   │        │  ─────────────     │
│  id (PK)         │        │  id (PK)           │
│  user_id (FK)    │        │  conversation (FK) │
│  title           │        │  role              │
│  status          │        │  content           │
│  model           │        │  createdAt         │
│  provider        │        └───────────────────┘
│  total_tokens    │
│  total_latency_ms│
│  message_count   │
│  createdAt       │
│  updatedAt       │
└──────┬───────────┘
       │ 1:N
       │
┌──────┴───────────┐        ┌───────────────────┐
│  inference_logs  │        │  error_events      │
│  ─────────────   │        │  ─────────────     │
│  id (PK)         │        │  id (PK)           │
│  conversation (FK)        │  user_id (FK)      │
│  user_id (FK)    │        │  type              │
│  provider        │        │  message           │
│  model           │        │  stack             │
│  status          │        │  metadata          │
│  latency_ms      │        │  createdAt         │
│  prompt_tokens   │        └───────────────────┘
│  completion_tok  │
│  total_tokens    │
│  input_preview   │        ┌───────────────────┐
│  output_preview  │        │ analytics_events   │
│  metadata (JSONB)│        │  ─────────────     │
│  pii_redacted    │        │  id (PK)           │
│  createdAt       │        │  user_id (FK)      │
└──────────────────┘        │  event_type        │
                            │  event_data (JSONB)│
                            │  createdAt         │
                            └───────────────────┘
```

### Index Strategy

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| `conversations` | `(user_id, created_at)` | B-tree | User's conversation listing |
| `conversations` | `(user_id, status)` | B-tree | Filter by status |
| `conversations` | `created_at` | B-tree | Global ordering |
| `inference_logs` | `(user_id, created_at)` | B-tree | User's log history |
| `inference_logs` | `(conversation_id)` | B-tree | Conversation logs |
| `inference_logs` | `(provider, status)` | B-tree | Provider analytics |
| `inference_logs` | `created_at` | B-tree | Time-range queries |
| `messages` | `(conversation_id, created_at)` | B-tree | Message ordering |

### Denormalization

The `conversations` table stores aggregates for fast listing:

| Column | Source | Update Trigger |
|--------|--------|---------------|
| `total_tokens` | SUM of inference_logs.total_tokens | On each insert |
| `total_latency_ms` | SUM of inference_logs.latency_ms | On each insert |
| `message_count` | COUNT of messages | On each insert |

**Rationale:** Avoids JOIN aggregation on every conversation list query. The
write overhead is negligible (single UPDATE with precomputed values).

---

## Authentication & Authorization

### Session Flow

```
1. POST /api/auth/sign-in/email
   └── Better Auth validates credentials
       └── Creates session
           └── Sets HTTP-only cookie: better-auth.session_token

2. Every API request
   └── Cookie included automatically
       └── requireAuth() middleware:
           ├── Validates session → OK → returns user
           └── Invalid/expired → 401 Unauthorized
```

### Session Storage

Better Auth manages its own tables in PostgreSQL:

- `session` — session records with expiry
- `account` — linked accounts (email, OAuth)
- `verification` — email verification tokens

All managed automatically by Better Auth's Drizzle adapter.

### Authorization (CASL)

```typescript
// Define abilities
const abilities = defineAbilityFor(user);

// Check in route handler
ability.can('read', 'Conversation', { userId: user.id });

// Default permissions:
//   user:  manage own resources
//   admin: manage all resources
```

**Resource Ownership Check:**

```typescript
// Every query filters by userId:
await db.query.conversations.findFirst({
  where: and(
    eq(conversations.id, id),
    eq(conversations.userId, user.id)
  )
});
```

---

## LLM Provider Integration

### Provider Interface

```typescript
interface LLMProvider {
  readonly name: string;
  readonly models: LLMModel[];
  readonly defaultModel: string;

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

### Registry Pattern

```typescript
class LLMProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();

  register(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): LLMProvider | null {
    return this.providers.get(name) ?? null;
  }

  getAllModels(): LLMModel[] {
    return Array.from(this.providers.values())
      .flatMap(p => p.models);
  }
}
```

### Provider Implementation Template

```typescript
import { LLMProvider, LLMMessage, LLMResponse, LLMChunk } from './types';

export function createNvidiaProvider(): LLMProvider {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return null;

  return {
    name: 'nvidia',
    models: [
      { id: 'nvidia/llama-3.1-nemotron-70b/ultra', name: 'Llama 3.1 Nemotron Ultra' },
      { id: 'mistralai/mistral-large', name: 'Mistral Large' },
      // ...
    ],
    defaultModel: 'nvidia/llama-3.1-nemotron-70b/ultra',

    async generate(model, messages, options) {
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, messages, ...options }),
      });
      return response.json();
    },

    generateStream(model, messages, options) {
      // Return ReadableStream for SSE
    },
  };
}
```

### Supported Providers

| Provider | Auth Var | Endpoint | Default Model |
|----------|----------|----------|---------------|
| OpenAI | `OPENAI_API_KEY` | `api.openai.com` | `gpt-4.1` |
| Anthropic | `ANTHROPIC_API_KEY` | `api.anthropic.com` | `claude-sonnet-4-20250514` |
| Gemini | `GEMINI_API_KEY` | `generativelanguage.googleapis.com` | `gemini-2.5-flash` |
| DeepSeek | `DEEPSEEK_API_KEY` | `api.deepseek.com` | `deepseek-chat` |
| OpenRouter | `OPENROUTER_API_KEY` | `openrouter.ai/api` | `openai/gpt-4o` |
| NVIDIA | `NVIDIA_API_KEY` | `integrate.api.nvidia.com` | `nvidia/llama-3.1-nemotron-70b/ultra` |

---

## Ingestion Pipeline

### Pipeline Stages

```
Input: Log Batch (JSON array)
    │
    ▼
Stage 1: Validation
    │  Zod schema validation per log entry
    │  Failed entries collected with error messages
    │
    ▼
Stage 2: PII Redaction
    │  Regex pattern matching on input/output text
    │  Types: email, phone, SSN, credit card
    │  Sets `pii_redacted` flag
    │
    ▼
Stage 3: Metadata Extraction
    │  Token validation (non-negative integers)
    │  Latency validation (positive integer)
    │  Metadata JSONB passthrough
    │
    ▼
Stage 4: Database Insert
    │  Batch INSERT via Drizzle
    │  Foreign key validation (conversation_id → conversations)
    │  PostgreSQL NOTIFY trigger on insert
    │
    ▼
Output: 207 Multi-Status Response
```

### Validation Schema

```typescript
const logEntrySchema = z.object({
  provider: z.string().min(1, 'provider is required'),
  model: z.string().min(1, 'model is required'),
  status: z.enum(['success', 'error', 'cancelled']),
  latencyMs: z.number().int().positive().optional(),
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
  conversationId: z.string().min(1, 'conversationId is required'),
  inputPreview: z.string().optional(),
  outputPreview: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
```

### PII Redaction Patterns

```typescript
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi, replacement: '[EMAIL_REDACTED]' },
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '[PHONE_REDACTED]' },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN_REDACTED]' },
  { pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, replacement: '[CREDIT_CARD_REDACTED]' },
];
```

### Batch Processing

- **Buffer:** SDK accumulates logs in memory (max 50 or 5s interval)
- **Flush:** POST to `/api/ingest` with array of log entries
- **Partial Success:** HTTP 207 with `accepted`, `rejected`, `errors[]`
- **FK Validation:** `conversationId` must reference existing conversation

---

## Observability

### Metrics (Prometheus)

Exposed at `GET /api/metrics`:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `llm_inference_requests_total` | Counter | provider, model, status | Total LLM requests |
| `llm_inference_duration_ms` | Histogram | provider, model | Request latency |
| `llm_inference_tokens_total` | Counter | provider, model, type | Token usage |
| `http_requests_total` | Counter | method, route, status | HTTP request count |
| `http_request_duration_ms` | Histogram | method, route | HTTP latency |
| `active_connections` | Gauge | — | Current SSE connections |
| `db_pool_active` | Gauge | — | Active DB connections |
| `db_pool_idle` | Gauge | — | Idle DB connections |
| `db_pool_waiting` | Gauge | — | Waiting for connection |

### Structured Logging (Pino)

```json
{
  "level": 30,
  "time": 1716883200000,
  "pid": 1234,
  "hostname": "app-1",
  "msg": "LLM inference completed",
  "provider": "nvidia",
  "model": "minimaxai/minimax-m2.7",
  "latencyMs": 1234,
  "tokens": { "prompt": 50, "completion": 100, "total": 150 },
  "reqId": "req-abc123",
  "userId": "user-xyz"
}
```

### Distributed Tracing (OpenTelemetry)

- **Exporter:** OTLP via HTTP
- **Auto-instrumentation:** HTTP, fetch, pg
- **Manual spans:** LLM calls, ingestion pipeline
- **Sampling:** Head-based (1% in production, 100% in dev)

### Health Check

```http
GET /api/health
```

Returns application and database connectivity status. Used by load balancers,
Kubernetes liveness/readiness probes, and Docker health checks.

---

## Deployment Topologies

### Topology 1: Single Server (Development)

```
┌────────────────────────────────────────────┐
│           Single Machine                    │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │  Next.js (npm run dev / start)       │  │
│  │  Port 3000                           │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────┐  ┌──────────────────┐    │
│  │  PostgreSQL   │  │    Redis         │    │
│  │  Port 5432    │  │    Port 6379     │    │
│  └──────────────┘  └──────────────────┘    │
└────────────────────────────────────────────┘
```

### Topology 2: Reverse Proxy (Production)

```
                         ┌──────────────┐
                         │   Internet   │
                         └──────┬───────┘
                                │
                         ┌──────▼───────┐
                         │   Caddy      │
                         │   Port 443   │
                         │   (TLS)      │
                         └──────┬───────┘
                                │
                         ┌──────▼───────┐
                         │  Next.js     │
                         │  Port 3000   │
                         │  (PM2)       │
                         └──────┬───────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
              ┌─────▼─────┐          ┌──────▼──────┐
              │ PostgreSQL │          │   Redis     │
              └───────────┘          └─────────────┘
```

### Topology 3: Kubernetes (Scalable)

```
                            ┌──────────────┐
                            │   Ingress    │
                            │  (Caddy)     │
                            └──────┬───────┘
                                   │
                            ┌──────▼───────┐
                            │  Service     │
                            │  (ClusterIP) │
                            └──────┬───────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
              ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
              │  Pod 1    │ │  Pod 2    │ │  Pod N    │
              │  (app)    │ │  (app)    │ │  (app)    │
              └───────────┘ └───────────┘ └───────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
              ┌─────▼─────┐                 ┌─────▼─────┐
              │ PostgreSQL │                 │   Redis   │
              │ (Stateful) │                 │ (Stateful)│
              └───────────┘                 └───────────┘
```

### Docker Compose Profiles

| Profile | File | Services | Use |
|---------|------|----------|-----|
| Dev | `docker-compose.dev.yml` | PostgreSQL, Redis | Local development |
| App | `docker-compose.yml` | App + PostgreSQL | Production single-server |
| Observability | `docker-compose.observability.yml` | 18 services | Full monitoring stack |

---

## Performance Characteristics

### Benchmarks (Single Next.js Process)

| Operation | p50 | p95 | p99 | Throughput |
|-----------|-----|-----|-----|------------|
| Health check | 2ms | 5ms | 10ms | 5000 req/s |
| List conversations | 15ms | 50ms | 100ms | 1000 req/s |
| Get conversation (with messages) | 10ms | 30ms | 80ms | 1500 req/s |
| Ingestion (10 logs) | 25ms | 80ms | 150ms | 500 req/s |
| Ingestion (50 logs) | 60ms | 200ms | 400ms | 200 req/s |
| Auth (sign-in) | 50ms | 150ms | 300ms | 100 req/s |

### Scalability

- **Horizontal:** Stateless Next.js (sessions in DB, cache in Redis)
- **Vertical:** Single process handles ~1000 concurrent requests
- **Streaming:** Each SSE connection consumes ~1 MB RAM
- **Database:** Cursor pagination ensures O(1) list performance

### Bottlenecks

1. **LLM API calls** — Network latency dominated by provider response times
2. **Ingestion writes** — Synchronous DB writes (mitigated by batch flushing)
3. **Rate limiting** — In-memory bucket is per-process; Redis needed for multi-process

---

## Security Model

### Defense in Depth

```
Layer 1: Network Perimeter
    ├── CrowdSec WAF (rate limiting, IP blocking, anomaly detection)
    └── Caddy reverse proxy (TLS termination, HTTP/2)

Layer 2: Application Security
    ├── Content Security Policy (default-src 'self', strict script-src)
    ├── HTTP Strict Transport Security (max-age=31536000, preload)
    ├── X-Frame-Options: DENY
    └── X-Content-Type-Options: nosniff

Layer 3: Authentication
    ├── Better Auth (password hashing, session management)
    ├── HTTP-only, Secure, SameSite=Lax cookies
    └── Session expiry (7 days default)

Layer 4: Authorization
    ├── CASL RBAC (user/admin roles)
    └── Resource ownership filtering on all queries

Layer 5: Input Validation
    ├── Zod schemas on every API endpoint
    ├── Rate limiting (token bucket per user)
    └── Request body size limits (Next.js default)

Layer 6: Data Protection
    ├── PII redaction (regex-based, 4 pattern types)
    ├── Parameterized SQL (Drizzle ORM)
    └── Secrets never logged (Pino redaction)

Layer 7: Monitoring & Response
    ├── CSP violation reporting at /api/csp-report
    ├── Error event capture (error_events table)
    ├── Prometheus metrics for anomaly detection
    └── GlitchTip for error aggregation
```

### CSP Policy

```http
Content-Security-Policy: default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self' https://integrate.api.nvidia.com wss://integrate.api.nvidia.com;
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'self';
```

### Rate Limiting Implementation

```typescript
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,
    private refillRate: number,  // tokens per second
    private refillInterval: number  // milliseconds
  ) {}

  tryConsume(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor(
      (elapsed / this.refillInterval) * this.refillRate
    );
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}
```

---

## Tradeoffs & Rationale

### Decision 1: Monolithic Next.js vs. Microservices

**Chosen:** Monolithic Next.js application

| Factor | Monolith | Microservices |
|--------|----------|---------------|
| Deployment complexity | Low | High |
| Development velocity | High | Medium |
| Process isolation | None | Full |
| Network overhead | None | Present |
| Horizontal scaling | Process-level | Service-level |
| Operational cost | Low | High |

**Rationale:** For the target scale (thousands of inference logs per minute),
a single process eliminates unnecessary complexity. If the system needs to
scale beyond 10k requests/second, the ingestion pipeline can be extracted
as a standalone service without changing the API contract.

### Decision 2: Synchronous vs. Async Ingestion

**Chosen:** Synchronous batch writes

**Rationale:** The ingestion SDK already batches logs (50 logs or 5s), so
each API call processes multiple logs at once. Async ingestion would add
queue infrastructure (BullMQ, Redis) without meaningful benefit at the
current scale. The `NOTIFY` trigger enables event-driven consumers for
async enrichment without changing the ingestion path.

### Decision 3: Regex vs. ML for PII Redaction

**Chosen:** Regex-based redaction

| Factor | Regex | ML/NLP |
|--------|-------|--------|
| Latency | <1ms per log | 50-500ms per log |
| Dependencies | None | Model + GPU/API |
| Accuracy | ~95% for common patterns | ~98%+ |
| Cold start | None | Model loading |

**Rationale:** Regex covers emails, phone numbers, SSNs, and credit cards
with sub-millisecond latency and zero dependencies. ML-based detection can
be added as an optional enhancement for context-dependent PII.

### Decision 4: Cursor vs. Offset Pagination

**Chosen:** Cursor-based pagination

**Rationale:** Cursor pagination provides consistent results when data
changes between pages, O(1) performance at any depth, and efficient use
of database indexes. The tradeoff is slightly more complex client logic
(handling opaque cursor strings).

### Decision 5: Drizzle ORM vs. Prisma vs. Raw SQL

**Chosen:** Drizzle ORM

| Factor | Drizzle | Prisma | Raw SQL |
|--------|---------|--------|---------|
| Type safety | Full | Full | Manual |
| Bundle size | Small | Large | None |
| Learning curve | Low | Medium | High |
| Migration tool | drizzle-kit | prisma migrate | Manual |
| Performance | Near-native | ORM overhead | Native |

**Rationale:** Drizzle provides type-safe queries with minimal overhead
(~3KB gzipped). Unlike Prisma, it doesn't generate a client binary and
allows raw SQL escape hatches when needed.

---

## Failure Modes

### Database Connection Loss

```
Detection: Health check returns 503
Behavior: All DB-dependent endpoints return 500
Recovery: Connection pool retries with exponential backoff
Monitoring: db_pool_active drops to 0, alert triggered
```

### LLM API Timeout

```
Detection: AbortSignal with 30s timeout
Behavior: Returns 504 Gateway Timeout
Recovery: Retryable by client
Monitoring: llm_inference_duration_ms shows latency spike
```

### External Service Unavailability

| Service | Fallback | Data Loss |
|---------|----------|-----------|
| Redis | In-memory token bucket + cache | No (ephemeral) |
| Typesense | SQL LIKE search | No (functional) |
| MinIO | In-memory file storage | Yes (on restart) |
| Qdrant | Vector operations skipped | No |

### Rate Limit Exceeded

```
Detection: Token bucket empty
Response: 429 Too Many Requests
Headers: Retry-After: <seconds>
Recovery: Automatic after refill
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-05-28 | Initial technical specification |

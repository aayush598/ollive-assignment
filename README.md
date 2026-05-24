# LLM Inference Logger

A production-ready, lightweight inference logging and ingestion system for LLM applications. Built with Next.js 16, TypeScript, Tailwind CSS v4, and modern best practices.

## Features

- **Multi-Provider Chat** — Interact with GPT-4.1, Claude Sonnet, Gemini, DeepSeek, and Grok through a unified interface
- **Real-time Streaming** — Server-Sent Events (SSE) for streaming responses
- **Inference Logging** — Automatic capture of latency, token usage, model, provider, errors, and metadata
- **PII Redaction** — Automatic detection and redaction of emails, phone numbers, SSNs, credit cards, etc.
- **Conversation Management** — List, cancel, resume, and delete conversations
- **Admin Dashboard** — Real-time latency, throughput, error rate, and provider breakdown metrics
- **Event-Based Ingestion** — In-process EventEmitter + PostgreSQL LISTEN/NOTIFY for async processing
- **Authentication** — Email/password auth with Better Auth
- **Docker Compose** — One-command setup with PostgreSQL
- **CI/CD** — GitHub Actions pipeline with linting, testing, type checking, and Docker build

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Application                    │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │  Chat UI  │  │  Admin   │  │  Ingestion SDK       │   │
│  │  (React)  │  │  UI      │  │  (wrapper/capture)   │   │
│  └─────┬─────┘  └────┬─────┘  └──────────┬───────────┘   │
│        │              │                   │               │
│  ┌─────┴──────────────┴───────────────────┴──────────┐   │
│  │              API Routes (Next.js)                  │   │
│  │  /api/chat  /api/ingest  /api/conversations        │   │
 │  │  /api/auth  /api/admin/stats  /api/health           │   │
│  └───────────────────────┬────────────────────────────┘   │
│                          │                                │
│  ┌───────────────────────┴────────────────────────────┐   │
│  │              LLM Provider Registry                  │   │
│  │  OpenAI │ Anthropic │ Gemini │ DeepSeek │ OpenRouter│   │
│  └───────────────────────┬────────────────────────────┘   │
│                          │                                │
│  ┌───────────────────────┴────────────────────────────┐   │
│  │              Ingestion Pipeline                     │   │
│  │  Validate → Redact PII → Extract Metadata → Store  │   │
│  └───────────────────────┬────────────────────────────┘   │
│                          │                                │
│  ┌───────────────────────┴────────────────────────────┐   │
│  │              PostgreSQL (Drizzle ORM)               │   │
│  │  users │ sessions │ conversations │ messages        │   │
│  │  inference_logs                                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Ingestion Flow

1. User sends a message → Chat API routes to the selected LLM provider
2. The **Ingestion SDK wrapper** captures request/response metadata (model, provider, latency, tokens, timestamps, session ID)
3. SDK buffers logs and periodically flushes to `/api/ingest` in batches
4. The **Ingestion Pipeline** validates payloads (Zod schemas), redacts PII, extracts metadata
5. Processed data is stored in PostgreSQL via Drizzle ORM

### Schema Design

**`users`** — Better Auth user accounts
**`sessions`** — User sessions with expiry
**`conversations`** — Chat conversations with status (active/cancelled/completed), model, provider, aggregated token/latency stats
**`messages`** — Individual chat messages linked to conversations
**`inference_logs`** — LLM inference metadata with provider, model, latency, tokens, input/output previews, PII flags, errors, and flexible JSONB metadata. Has a `NOTIFY` trigger (`notify_inference_log_insert`) for event-driven consumers.

**Key decisions:**
- `total_tokens` and `total_latency_ms` on conversations enable fast dashboard queries without aggregating messages
- JSONB `metadata` field on logs allows flexible schema evolution
- PII redaction happens at ingestion (defense in depth) and in the SDK (prevention)
- Indexes on `user_id`, `conversation_id`, `provider`, `status`, `created_at` for query performance

### Logging Strategy

- **Client-side**: SDK buffers logs in memory, flushes every 5s or at 50 log batch size (configurable)
- **Server-side**: All logs are validated, PII-redacted, and stored synchronously on write
- **Error capture**: SDK captures error logs with error messages and input previews
- **Graceful shutdown**: SDK flushes pending logs on `SIGINT`/`SIGTERM`/`beforeExit`

### Scaling Considerations

- Connection pooling with `postgres` (max 10 connections, idle timeout 20s)
- Batch ingestion reduces HTTP overhead
- Indexes on all queried columns for read performance
- Stateless Next.js application — scale horizontally behind a load balancer
- JSONB metadata allows flexible querying without schema changes
- Docker containerization for consistent deployment

### Failure Handling

- Database connection failures are logged and return 503 health status
- LLM API errors are captured as inference log entries with error details
- Ingestion batch processing continues on individual log failures (207 Multi-Status)
- SDK flush failures log errors but don't block the application
- Graceful shutdown ensures pending logs are flushed

## Setup

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for PostgreSQL)
- At least one LLM API key

### Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd fullstack_assignment
cp .env.example .env
# Edit .env with your API keys

# 2. Start PostgreSQL
docker compose -f docker/docker-compose.dev.yml up -d

# 3. Push database schema
npm run db:push

# 4. Start dev server
npm run dev
```

Visit `http://localhost:3000` — register an account and start chatting!

### Docker Compose (Full Stack)

```bash
# Set required env vars
export OPENAI_API_KEY=sk-...
export BETTER_AUTH_SECRET=your-secret-key-min-32-chars

# Start everything
docker compose -f docker/docker-compose.yml up -d
```

## Tradeoffs

| Decision | Tradeoff |
|----------|----------|
| **Next.js API routes** instead of separate services | Simpler deployment but less isolation |
| **Synchronous DB writes** in ingestion | Simpler code, OK for moderate throughput |
| **PII redaction via regex** | Fast & zero-dependency, but misses complex patterns |
| **Short context (20 messages)** | Balances quality with token cost |
| **Email/password auth only** | Simple but fewer sign-in options |
| **SDK flush interval (5s)** | Near real-time without excessive HTTP calls |
| **JSONB metadata** | Flexible but not individually indexable |
| **In-memory rate limiting** | Simple but resets on server restart |
| **In-process EventEmitter** | No cross-instance event distribution without Redis |

## What I Would Improve

- **WebSocket dashboards** — Replace polling with WebSocket push for truly real-time admin dashboard updates
- **Message queue** — Replace in-process events with Redis/Kafka for cross-instance event distribution
- **Rate limiting & usage quotas** — Persistent rate limiting with Redis (current in-memory resets on restart)
- **Advanced PII redaction** — ML-based detection, pattern learning
- **Multi-region deployment** — Edge-optimized ingestion endpoints
- **Caching** — Redis for conversation context, response caching
- **eBPF-based monitoring** — Deep performance observability
- **Blue/Green deployments** — Zero-downtime updates
- **Prometheus metrics** — Standardized observability
- **Webhook-based alerting** — Slack/email alerts on error thresholds
- **Admin dashboard** — User management, API key rotation
- **Data retention policies** — Automated log archival/cleanup
- **OpenTelemetry integration** — Distributed tracing across services
- **End-to-end tests** — Playwright or Cypress for UI testing
- **File upload support** — Multi-modal chat with images/documents

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL 16 + Drizzle ORM
- **Auth**: Better Auth (email/password)
- **State**: Zustand
- **Forms**: React Hook Form + Zod
- **Streaming**: Server-Sent Events
- **Security**: Helmet-style headers, PII redaction
- **Containerization**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **Testing**: Vitest

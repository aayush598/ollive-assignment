# LLM Inference Logger

<p align="center">
  <strong>Production-Ready Inference Logging & Ingestion System for LLM Applications</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.2.6-000000?style=flat-square&logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql" alt="PostgreSQL 16" />
  <img src="https://img.shields.io/badge/Drizzle_ORM-ORM-C5F74F?style=flat-square&logo=drizzle" alt="Drizzle ORM" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License" />
  <br/>
  <img src="https://img.shields.io/badge/tests-119_passed-22c55e?style=flat-square" alt="Tests" />
  <img src="https://img.shields.io/badge/lint-0_errors-22c55e?style=flat-square" alt="Lint" />
  <img src="https://img.shields.io/badge/TypeScript-0_errors-22c55e?style=flat-square" alt="TypeScript" />
  <img src="https://img.shields.io/badge/docker-ready-2496ED?style=flat-square&logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/k8s-manifests-326CE5?style=flat-square&logo=kubernetes" alt="Kubernetes" />
</p>

---

## Overview

LLM Inference Logger is a full-stack application for interacting with, logging, and analyzing LLM inference
operations. It provides a unified chat interface across 6 LLM providers, automatic capture of every inference
request/response with PII redaction, real-time streaming, conversation management, and comprehensive observability.

**Live Demo:** `http://localhost:3000` (after setup)

---

## Features

### LLM Integration
- **6 Providers**: OpenAI (GPT-4.1), Anthropic (Claude), Google (Gemini), DeepSeek, OpenRouter, NVIDIA
- **Real-time Streaming**: Server-Sent Events with cancellation support
- **Context Management**: Multi-turn conversations with configurable context window (default 20 messages)
- **Provider Registry**: Pluggable architecture — add new providers by implementing 2 methods

### Inference Logging
- **Automatic Capture**: Every LLM call logs provider, model, latency, token usage, timestamps
- **PII Redaction**: Automatic detection + redaction of emails, phone numbers, SSNs, credit cards
- **Batch Ingestion**: SDK buffers logs in memory, flushes every 5s or 50 logs (configurable)
- **Event-Driven**: PostgreSQL LISTEN/NOTIFY for async processing pipeline

### Conversation Management
- Full CRUD: create, list (cursor-paginated), read, update title, delete
- Status lifecycle: active → cancelled → active (resume) or completed
- Admin dashboard with aggregate stats, hourly breakdowns, recent errors

### Security & Auth
- Email/password authentication (Better Auth) with session management
- Google OAuth integration
- CASL role-based access control (user/admin)
- Content Security Policy, HSTS, X-Frame-Options, X-Content-Type-Options headers
- Rate limiting on all production endpoints
- CSP violation reporting at `/api/csp-report`

### Observability
- **Prometheus** metrics at `/api/metrics` with custom LLM inference counters/histograms
- **Grafana** dashboards pre-configured for LLM metrics
- **Loki** + Promtail for log aggregation
- **Tempo** for distributed tracing via OpenTelemetry
- **GlitchTip** for error tracking
- **Uptime Kuma** for service monitoring
- **CrowdSec** WAF integration

### Infrastructure
- **Docker**: Multi-stage production build (87% size reduction from dev), 3 Compose profiles
- **Kubernetes**: 10 resources via Kustomize (Deployment, StatefulSet, HPA, Ingress, Job, ConfigMap, Secret)
- **CI/CD**: GitHub Actions with lint, typecheck, test, build, docker jobs
- **PM2**: Process manager with ecosystem config for production deployments

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Next.js Application                        │
│                                                                   │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────────┐   │
│  │  Chat UI   │  │   Admin    │  │    Ingestion SDK         │   │
│  │  (React)   │  │  Dashboard │  │  (buffer + flush + PII)  │   │
│  └──────┬─────┘  └──────┬─────┘  └────────────┬─────────────┘   │
│         │               │                      │                  │
│  ┌──────┴───────────────┴──────────────────────┴──────────────┐ │
│  │                    API Routes (Next.js)                     │ │
│  │  /api/chat  /api/ingest  /api/conversations  /api/files    │ │
│  │  /api/auth  /api/admin/stats  /api/health  /api/search     │ │
│  │  /api/analytics  /api/metrics  /api/csp-report             │ │
│  └──────────────────────────┬─────────────────────────────────┘ │
│                             │                                    │
│  ┌──────────────────────────┴─────────────────────────────────┐ │
│  │                 LLM Provider Registry                      │ │
│  │  OpenAI  │  Anthropic  │  Gemini  │  DeepSeek  │  OpenRouter│ │
│  │  ───────────────────────────────────────────────────────── │ │
│  │  generate() + generateStream() — unified interface         │ │
│  └──────────────────────────┬─────────────────────────────────┘ │
│                             │                                    │
│  ┌──────────────────────────┴─────────────────────────────────┐ │
│  │                  Ingestion Pipeline                        │ │
│  │  Validate (Zod) → Redact PII → Extract Metadata → Store   │ │
│  │  ───────────────────────────────────────────────────────── │ │
│  │  Batch processing with 207 Multi-Status on partial failures│ │
│  └──────────────────────────┬─────────────────────────────────┘ │
│                             │                                    │
│  ┌──────────────────────────┴─────────────────────────────────┐ │
│  │          PostgreSQL 16 (Drizzle ORM)                      │ │
│  │  users  sessions  conversations  messages                 │ │
│  │  inference_logs  error_events  analytics_events           │ │
│  │  ───────────────────────────────────────────────────────── │ │
│  │  NOTIFY trigger on inference_logs for event-driven consumers│ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘

     ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
     │   Redis      │    │    MinIO     │    │   Typesense      │
     │  Cache/Queue │    │  S3 Storage  │    │  Full-Text Search│
     └──────────────┘    └──────────────┘    └──────────────────┘
            │                    │                    │
     ┌──────┴────────────────────┴────────────────────┴──────────┐
     │                     Observability Stack                   │
     │  Prometheus │ Grafana │ Loki │ Tempo │ GlitchTip         │
     │  Uptime Kuma │ CrowdSec │ cAdvisor │ Node Exporter       │
     │  Caddy Reverse Proxy (auto TLS)                           │
     └───────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Message → Chat API → LLM Provider → Response Stream → User
                 │                              │
                 ▼                              ▼
           Ingestion SDK ──batch──→ /api/ingest ──→ PostgreSQL
                                                │
                                           [NOTIFY] → Async Consumers
```

---

## Quick Start

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | >=20 | Runtime |
| Docker & Docker Compose | Latest | PostgreSQL, Redis, observability stack |
| LLM API Key | Any provider | Chat functionality |
| PostgreSQL | 16 (Docker) | Database |

### Setup (5 minutes)

```bash
# 1. Clone and install
git clone https://github.com/your-org/llm-inference-logger.git
cd fullstack_assignment
npm ci

# 2. Configure environment
cp .env.example .env
# Edit .env: add at least one LLM API key and set BETTER_AUTH_SECRET

# 3. Start infrastructure
docker compose -f docker/docker-compose.dev.yml up -d

# 4. Initialize database
npm run db:push

# 5. Start development server
npm run dev
```

Visit **http://localhost:3000** → Register an account → Start chatting!

### Docker Compose Profiles

| Profile | Command | Services |
|---------|---------|----------|
| Development | `npm run docker:dev` | Postgres + Redis |
| Full Stack | `npm run docker:up` | Postgres + App |
| Observability | `npm run docker:observability` | 18 services (see below) |

---

## API Overview

### Authentication
```
POST /api/auth/sign-up/email  — Register
POST /api/auth/sign-in/email  — Login
POST /api/auth/sign-out       — Logout
GET  /api/auth/get-session    — Current session
```

### Chat
```
POST /api/chat         — Non-streaming chat
POST /api/chat/stream  — SSE streaming chat
```

### Conversations
```
GET    /api/conversations          — List (cursor paginated)
GET    /api/conversations/:id      — Get with messages
PATCH  /api/conversations/:id      — Update title/status
DELETE /api/conversations/:id      — Delete
POST   /api/conversations/:id/cancel  — Cancel
POST   /api/conversations/:id/resume  — Resume
```

### Ingestion
```
POST /api/ingest    — Batch ingest logs (with PII redaction)
GET  /api/ingest    — List logs or get stats (?stats=true)
```

### Admin
```
GET /api/admin/stats         — Dashboard metrics
GET /api/admin/stats/hourly  — 24h hourly breakdown
```

### System
```
GET  /api/health     — Health check
GET  /api/models     — Available LLM models
GET  /api/metrics    — Prometheus metrics
GET  /api/search     — Search conversations/messages
POST /api/analytics  — Track analytics events
POST /api/csp-report — CSP violation reporting
GET  /api/files      — File storage
POST /api/files      — Upload file (multipart)
```

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# TypeScript check (0 errors)
npm run typecheck

# Lint (0 errors)
npm run lint
```

**Current Coverage:** 119 tests · 14 test files · 100% pass rate

---

## Tech Stack

### Core
| Technology | Purpose |
|------------|---------|
| Next.js 16 (App Router) | Full-stack framework |
| TypeScript 5 | Type safety |
| Tailwind CSS v4 | Styling |
| React 19 | UI components |

### Database & Storage
| Technology | Purpose |
|------------|---------|
| PostgreSQL 16 | Primary database |
| Drizzle ORM | Type-safe SQL |
| Redis 7 | Caching + queue backend |
| MinIO | S3-compatible file storage |
| Typesense | Full-text search |
| Qdrant | Vector store (RAG) |

### Auth & Security
| Technology | Purpose |
|------------|---------|
| Better Auth | Authentication |
| CASL (RBAC) | Authorization |
| Zod | Input validation |
| Helmet | Security headers |

### Observability
| Technology | Purpose |
|------------|---------|
| Prometheus | Metrics collection |
| Grafana | Dashboarding |
| Loki + Promtail | Log aggregation |
| Tempo (OTLP) | Distributed tracing |
| GlitchTip | Error tracking (Sentry-compatible) |
| Uptime Kuma | Uptime monitoring |
| CrowdSec | WAF / security |

### State & Data Flow
| Technology | Purpose |
|------------|---------|
| Zustand | Client-side state |
| Pino | Structured logging |
| BullMQ | Background jobs |
| nanoid | ID generation |
| date-fns | Date utilities |

### Dev Tooling
| Technology | Purpose |
|------------|---------|
| Vitest | Unit testing |
| ESLint | Code quality |
| Prettier | Formatting |
| Husky + lint-staged | Git hooks |
| Commitlint | Conventional commits |
| Turbopack | Dev server bundling |

---

## Documentation

| File | Description |
|------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture & design decisions |
| [API_REFERENCE.md](./API_REFERENCE.md) | Complete API documentation |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deployment guide (Docker, K8s, Vercel) |
| [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md) | Technical specification & tradeoffs |
| [PROJECT_REPORT.md](./PROJECT_REPORT.md) | Comprehensive project report |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Contribution guidelines |
| [SECURITY.md](./SECURITY.md) | Security policy & configuration |
| [CHANGELOG.md](./CHANGELOG.md) | Version history |
| [MANUAL_TEST_PLAN.md](./MANUAL_TEST_PLAN.md) | Complete manual testing guide |
| `docs/` | In-depth guides (CASL, BullMQ, Typesense, MinIO) |

---

## Project Structure

```
.
├── src/
│   ├── app/
│   │   ├── api/           # 17 API route handlers
│   │   ├── chat/          # Chat UI pages
│   │   ├── conversations/ # Conversation list UI
│   │   ├── login/         # Authentication pages
│   │   └── layout.tsx     # Root layout
│   ├── components/        # Reusable UI components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Core libraries
│   │   ├── auth/          # Auth config + CASL abilities
│   │   ├── db/            # Drizzle schema + DB client
│   │   ├── ingestion/     # Ingestion pipeline
│   │   ├── llm/           # Provider registry (6 providers)
│   │   ├── pii/           # PII redactor
│   │   └── vector/        # Qdrant + RAG context
│   └── store/             # Zustand stores
├── docker/                # Docker configs + Compose files
│   ├── caddy/             # Caddyfile (dev + prod)
│   ├── grafana/           # Pre-built dashboards
│   ├── prometheus/        # Prometheus config
│   └── tempo/             # Tempo tracing config
├── k8s/                   # Kubernetes manifests (Kustomize)
├── docs/                  # In-depth documentation
└── [Documentation files]  # See table above
```

---

## License

[MIT](./LICENSE) — See `LICENSE` for details.

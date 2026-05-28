# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-05-28

### Added
- Multi-provider LLM chat with streaming support (OpenAI, Anthropic, Gemini,
  DeepSeek, OpenRouter, NVIDIA)
- Real-time SSE streaming with cancellation support
- Inference logging system with PII redaction (emails, phones, SSNs, credit cards)
- Event-driven ingestion pipeline with PostgreSQL LISTEN/NOTIFY
- Conversation management (CRUD, cancel, resume, context management)
- Admin dashboard with aggregate stats, hourly breakdowns, recent errors
- Full-text search via Typesense with SQL LIKE fallback
- File upload/download via S3/MinIO with in-memory fallback
- Analytics event tracking with Umami integration
- CSP violation reporting endpoint
- Prometheus metrics endpoint with custom LLM metrics
- Sitemap and robots.txt generation

### Authentication & Authorization
- Email/password authentication with Better Auth
- Google OAuth integration
- Role-based access control (RBAC) with CASL (user/admin roles)
- Session management with secure HTTP-only cookies

### Observability
- Docker Compose observability stack (18 services):
  - Prometheus + Grafana dashboards for metrics
  - Loki + Promtail for log aggregation
  - Tempo for distributed tracing (OTLP)
  - GlitchTip for error tracking
  - Uptime Kuma for uptime monitoring
  - CrowdSec for WAF/security
- Caddy reverse proxy with automatic TLS
- Pre-built Grafana dashboard for LLM inference metrics

### Infrastructure
- Docker multi-stage production build (Node.js 20 Alpine)
- PM2 process manager with ecosystem config
- Kubernetes manifests with Kustomize (10 resources)
- GitHub Actions CI/CD pipeline (lint, test, build, docker)
- Development Docker Compose with Postgres + Redis
- Full observability Docker Compose with 18 services

### Storage & Search
- PostgreSQL 16 with Drizzle ORM
- Redis caching and BullMQ queue support
- MinIO S3-compatible file storage
- Typesense full-text search
- Qdrant vector store for RAG context

### Testing & Quality
- 119 unit tests across 14 test files (Vitest)
- ESLint with 0 errors
- TypeScript strict mode with 0 errors
- Prettier formatting
- Commitlint with conventional commits
- Husky git hooks

### Documentation
- Comprehensive API reference with request/response examples
- Architecture documentation with data flow diagrams
- Deployment guide (Docker, K8s, Vercel)
- Technical specification with design decisions
- Manual test plan with 93 steps across 8 phases
- Contribution guidelines
- Security policy

### Fixed
- Improved error handling for FK violations (descriptive messages, no raw SQL)
- Empty QDRANT_URL treated as undefined in env validation
- Caddy reverse proxy Host header forwarding for session cookies
- Docker Compose observability DATABASE_URL hardcoded to Docker hostname
- Models endpoint returns 401 on auth failure instead of silent empty array
- Clean per-field validation errors (not JSON-stringified blobs)
- FK violation detection with descriptive error messages
- Rate limiting integration tests with correct limits

### Security
- Content Security Policy headers with report-uri
- HSTS, X-Frame-Options, X-Content-Type-Options headers
- PII redaction on stored inference data
- Rate limiting on all API endpoints
- Input validation via Zod schemas
- SQL injection protection via Drizzle ORM
- CASL RBAC authorization

## [0.1.0] — 2026-05-01

### Added
- Initial project scaffold with Next.js 16
- Basic authentication with Better Auth
- Core database schema with Drizzle ORM
- Chat API with NVIDIA integration
- Ingestion API with validation
- Basic UI components

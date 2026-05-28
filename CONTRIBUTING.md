# Contributing

> **Last Updated:** 2026-05-28

Thank you for considering contributing to LLM Inference Logger. This document outlines the development workflow, coding standards, and processes for contributing.

---

## Table of Contents

1. [Development Setup](#development-setup)
2. [Development Workflow](#development-workflow)
3. [Coding Standards](#coding-standards)
4. [Testing](#testing)
5. [Commit Convention](#commit-convention)
6. [Pull Request Process](#pull-request-process)
7. [Project Structure](#project-structure)

---

## Development Setup

### Prerequisites

- **Node.js** >= 20 (match `.nvmrc`)
- **Docker & Docker Compose** (for PostgreSQL, Redis, observability stack)
- **npm** 11+

### One-Time Setup

```bash
# 1. Clone and install
git clone https://github.com/your-org/llm-inference-logger.git
cd llm-inference-logger
npm ci

# 2. Configure environment
cp .env.example .env
# Edit .env: add at least one LLM API key, set BETTER_AUTH_SECRET

# 3. Start infrastructure
npm run docker:dev

# 4. Initialize database
npm run db:push

# 5. Start development server
npm run dev
```

### Environment Variables

See `.env.example` for all required variables. At minimum, set:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Auth session encryption key |
| `BETTER_AUTH_URL` | Application base URL |
| At least one LLM API key | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc. |

Never commit `.env` to version control.

---

## Development Workflow

### Branch Strategy

- `main` — production-ready, protected
- `feat/<name>` — new features
- `fix/<name>` — bug fixes
- `docs/<name>` — documentation changes
- `chore/<name>` — maintenance, tooling

### Local Development

```bash
# Start the dev server (with turbopack)
npm run dev

# Run tests in watch mode
npm run test:watch

# TypeScript check
npm run typecheck

# Lint with auto-fix
npm run lint:fix

# Format code
npm run format
```

### Before Committing

Run these checks to ensure CI will pass:

```bash
npm run lint        # 0 errors expected
npm run typecheck   # 0 errors expected
npm test            # all tests pass
npm run format:check  # formatting is clean
```

---

## Coding Standards

### Language & Framework

- **TypeScript** — strict mode, all files must be `.ts` or `.tsx`
- **Next.js 16 App Router** — route handlers in `src/app/api/**/route.ts`
- **React 19** — functional components with hooks, no class components

### Style

- **ESLint** — configured in `eslint.config.mjs`, extends Next.js + TypeScript rules
- **Prettier** — automatic formatting on commit via `lint-staged`
- **Naming:**
  - Files: `kebab-case.ts`, `PascalCase.tsx` for components
  - Functions/variables: `camelCase`
  - Types/interfaces: `PascalCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Database columns: `snake_case` (Drizzle conventions)

### Code Conventions

- **No commented-out code** — delete instead of comment out
- **No console.log in committed code** — use `pino` logger (`src/lib/logger.ts`)
- **Async/await over raw promises** — prefer `async/await` to `.then()`
- **Zod for validation** — all API inputs must be validated with Zod schemas
- **Error handling** — use typed errors, return consistent error format `{ error: string }`
- **Imports** — prefer named exports; group: external → internal → relative

### Architecture Rules

- New LLM providers implement `LLMProvider` interface (see `src/lib/llm/`)
- New database tables defined in `src/lib/db/schema/` using Drizzle schema syntax
- API routes follow `/api/{resource}/[id]/action` convention
- External service clients have in-memory fallbacks

---

## Testing

### Test Framework

We use **Vitest** with the following configuration:

- Test files co-located with source at `src/**/*.test.ts`
- `vitest.config.ts` for shared configuration
- Coverage thresholds enforced in CI

### Running Tests

```bash
# Run all tests
npm test

# Watch mode (for development)
npm run test:watch

# With coverage
npx vitest run --coverage
```

### Test Categories

| Category | Description | Location |
|----------|-------------|----------|
| Unit | Pure function tests | `src/**/*.test.ts` |
| API | Route handler tests | `src/app/api/**/*.test.ts` |
| Integration | DB + external service tests | `src/lib/**/*.test.ts` |

### Writing Tests

- **Arrange-Act-Assert** pattern
- Mock external HTTP calls (LLM providers, external APIs)
- Use `describe`/`it`/`expect` from Vitest
- Prefer `toEqual`, `toMatchObject`, `toStrictEqual` for object assertions

---

## Commit Convention

We follow **Conventional Commits** (enforced by commitlint):

```
<type>(<scope>): <subject>

<body>
<footer>
```

### Types

| Type | Usage |
|------|-------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Formatting, linting |
| `refactor` | Code restructuring |
| `perf` | Performance improvement |
| `test` | Adding/updating tests |
| `chore` | Build, CI, tooling |
| `ci` | CI configuration |

### Scopes

Common scopes: `api`, `chat`, `auth`, `ingestion`, `db`, `ui`, `docker`, `k8s`, `docs`, `deps`, `config`

### Examples

```
feat(chat): add streaming cancellation support

fix(auth): validate session expiry before API call

docs(api): document rate limit headers

refactor(ingestion): extract PII redaction to standalone module
```

---

## Pull Request Process

1. **Create a feature branch** from `main`
2. **Make changes** following the coding standards above
3. **Run all checks** — lint, typecheck, tests must pass
4. **Write or update tests** — coverage should not decrease
5. **Update documentation** if changing API contracts or adding features
6. **Open a pull request** against `main`
7. **Address reviewer feedback** with additional commits
8. **Squash-merge** after approval — one commit per PR

### PR Requirements

- Title follows conventional commit format
- Description explains what and why
- Related issues linked
- All CI checks pass
- At least one reviewer approval
- No merge conflicts

---

## Project Structure

```
.
├── src/
│   ├── app/
│   │   ├── api/              # API route handlers
│   │   │   ├── admin/        # Admin dashboard endpoints
│   │   │   ├── auth/         # Better Auth endpoints
│   │   │   ├── chat/         # Chat + streaming endpoints
│   │   │   ├── conversations/ # CRUD + lifecycle
│   │   │   ├── ingest/       # Ingestion pipeline
│   │   │   ├── analytics/    # Analytics events
│   │   │   ├── search/       # Full-text search
│   │   │   ├── files/        # File upload/storage
│   │   │   ├── models/       # LLM model listing
│   │   │   ├── health/       # Health check
│   │   │   ├── metrics/      # Prometheus metrics
│   │   │   └── csp-report/   # CSP violation reports
│   │   ├── (auth)/           # Auth pages (login, register)
│   │   ├── chat/             # Chat UI
│   │   └── page.tsx          # Landing page
│   ├── components/           # Reusable React components
│   ├── hooks/                # Custom React hooks
│   ├── lib/
│   │   ├── auth/             # Better Auth config + CASL
│   │   ├── db/               # Drizzle schema + client
│   │   ├── ingestion/        # Log ingestion pipeline
│   │   ├── llm/              # LLM provider registry
│   │   ├── pii/              # PII redaction engine
│   │   └── vector/           # Qdrant vector store
│   └── store/                # Zustand state stores
├── docker/                   # Dockerfiles + Compose
├── k8s/                      # Kubernetes manifests (Kustomize)
├── docs/                     # In-depth guides
└── [Documentation files]
```

---

## CI/CD

### GitHub Actions Workflow

The CI workflow (`.github/workflows/ci.yml`):

| Job | Steps | Artifacts |
|-----|-------|-----------|
| `lint` | ESLint + Prettier + TypeScript | — |
| `test` | Vitest (unit + API) | Coverage report |
| `build` | Next.js production build | Build output |
| `docker` | Multi-stage Docker build | Docker image |

### Local CI Simulation

```bash
# Run the same checks as CI
npm run lint && npm run typecheck && npm test && npm run build
```

---

## Security

- Never commit secrets, API keys, or tokens
- Report vulnerabilities via `SECURITY.md` process
- Use parameterized queries (Drizzle ORM) — no raw SQL interpolation
- Validate all inputs with Zod schemas
- Follow OWASP Top 10 guidelines

---

## Questions?

Open a GitHub Discussion or ask in the project's communication channel.

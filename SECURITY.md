# Security Policy

## Supported Versions

| Version | Supported          |
|---------|---------------------|
| 1.x     | :white_check_mark:  |
| < 1.0   | :x:                 |

## Reporting a Vulnerability

We take the security of LLM Inference Logger seriously. If you believe you have
found a security vulnerability, please report it to us as described below.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to the project maintainers.

You should receive a response within 48 hours. If for some reason you do not,
please follow up via email to ensure we received your original message.

## What to Include

Please include the following information in your report:

- Type of issue (e.g., SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## Preferred Languages

We prefer all communications to be in English.

## Security-Related Configuration

### Environment Variables

Sensitive credentials (API keys, database URLs, auth secrets) must be stored in
environment variables — never hardcoded in source files.

```env
# .env — never commit this file
DATABASE_URL=postgres://user:password@host:5432/db
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
NVIDIA_API_KEY=nvapi-...
```

### API Key Rotation

All LLM provider API keys, database credentials, and auth secrets should be
rotated regularly. The `.env.example` file contains placeholder values —
replace them before deploying.

### Rate Limiting

The API implements rate limiting on all production endpoints:
- `/api/chat`: 30 requests/minute
- `/api/ingest`: 120 requests/minute
- `/api/search`: 30 requests/minute
- `/api/conversations`: 60 requests/minute

### Authentication

All API endpoints (except `/api/health`, `/api/auth/*`, `/api/csp-report`,
`/api/metrics`, and landing page) require authentication via Better Auth
session tokens.

### CSP Headers

Content Security Policy headers are enforced via middleware. CSP violation
reports are collected at `/api/csp-report` for monitoring.

## Security Features

- **PII Redaction**: Personally identifiable information (emails, phone numbers,
  SSNs, credit cards) is automatically redacted from stored inference logs.
- **Input Validation**: All API inputs are validated with Zod schemas.
- **Helmet-style Headers**: CSP, HSTS, X-Frame-Options, and X-Content-Type-Options
  are set on every response.
- **CASL Authorization**: Role-based access control (RBAC) with user/admin roles.
- **SQL Injection Protection**: Parameterized queries via Drizzle ORM.

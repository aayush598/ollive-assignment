# API Reference

> **Base URL:** `http://localhost:3000`  
> **Auth:** Session cookie (set via `/api/auth/sign-in/email`)  
> **Content-Type:** `application/json` (unless specified otherwise)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Health](#health)
3. [Models](#models)
4. [Chat](#chat)
5. [Conversations](#conversations)
6. [Ingestion](#ingestion)
7. [Admin](#admin)
8. [Search](#search)
9. [Analytics](#analytics)
10. [Files](#files)
11. [Metrics](#metrics)
12. [CSP Report](#csp-report)
13. [Sitemap & Robots](#sitemap--robots)
14. [Error Codes](#error-codes)

---

## Authentication

### Register

Creates a new user account and returns a session token.

```http
POST /api/auth/sign-up/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Response:** `200 OK`

```json
{
  "token": "session-token-string",
  "user": {
    "id": "user-id",
    "name": "John Doe",
    "email": "user@example.com",
    "emailVerified": false,
    "image": null,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

### Login

Authenticates an existing user and returns a session token.

```http
POST /api/auth/sign-in/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`

```json
{
  "token": "session-token-string",
  "user": { ... }
}
```

### Get Session

Returns the current authenticated session.

```http
GET /api/auth/get-session
Cookie: better-auth.session_token=<token>
```

**Response:** `200 OK`

```json
{
  "session": {
    "id": "session-id",
    "expiresAt": "2026-01-02T00:00:00.000Z",
    "token": "session-token",
    "userId": "user-id"
  },
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Response (unauthenticated):** `200 OK` with `null`

### Logout

Destroys the current session.

```http
POST /api/auth/sign-out
Content-Type: application/json
Origin: http://localhost:3000
Cookie: better-auth.session_token=<token>

{}
```

**Response:** `200 OK`

```json
{
  "success": true
}
```

---

## Health

### Health Check

Returns the application and database health status.

```http
GET /api/health
```

**Response:** `200 OK`

```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-05-28T12:00:00.000Z"
}
```

**Response (degraded):** `503 Service Unavailable`

```json
{
  "status": "unhealthy",
  "database": "disconnected",
  "timestamp": "2026-05-28T12:00:00.000Z"
}
```

---

## Models

### List Models

Returns all available LLM models from registered providers.

```http
GET /api/models
Cookie: better-auth.session_token=<token>
```

**Response:** `200 OK`

```json
{
  "models": [
    { "provider": "openai", "model": "gpt-4.1", "label": "GPT-4.1" },
    { "provider": "openai", "model": "gpt-4.1-mini", "label": "GPT-4.1 Mini" },
    { "provider": "nvidia", "model": "nvidia/llama-3.1-nemotron-70b/ultra", "label": "Llama 3.1 Nemotron Ultra" },
    { "provider": "nvidia", "model": "mistralai/mistral-large", "label": "Mistral Large" },
    { "provider": "gemini", "model": "gemini-2.5-flash", "label": "Gemini 2.5 Flash" },
    { "provider": "anthropic", "model": "claude-sonnet-4-20250514", "label": "Claude Sonnet 4" }
  ]
}
```

**Response (unauthenticated):** `401 Unauthorized`

---

## Chat

### Non-Streaming Chat

Sends a message and receives a complete response.

```http
POST /api/chat
Content-Type: application/json
Cookie: better-auth.session_token=<token>

{
  "message": "What is 2+2?",
  "conversationId": "",
  "provider": "nvidia",
  "model": "minimaxai/minimax-m2.7"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | The user's message |
| `conversationId` | string | Yes | Empty string for new conversation |
| `provider` | string | No | Defaults to `DEFAULT_LLM_PROVIDER` |
| `model` | string | No | Defaults to `DEFAULT_LLM_MODEL` |

**Response:** `200 OK`

```json
{
  "response": "4",
  "conversationId": "conv-id",
  "promptTokens": 10,
  "completionTokens": 1,
  "totalTokens": 11
}
```

**Rate Limit:** 30 requests/minute per user

### Streaming Chat

Sends a message and receives a Server-Sent Events (SSE) stream.

```http
POST /api/chat/stream
Content-Type: application/json
Cookie: better-auth.session_token=<token>

{
  "message": "Count from 1 to 5",
  "conversationId": ""
}
```

**Response:** `200 OK` (SSE stream)

```
data: {"type":"chunk","content":"1","conversationId":"conv-id"}

data: {"type":"chunk","content":"2","conversationId":"conv-id"}

data: {"type":"chunk","content":"3","conversationId":"conv-id"}

data: {"type":"chunk","content":"4","conversationId":"conv-id"}

data: {"type":"chunk","content":"5","conversationId":"conv-id"}

data: {"type":"done","conversationId":"conv-id","promptTokens":10,"completionTokens":5,"totalTokens":15}
```

**Cancellation:** Close the connection or call `POST /api/conversations/:id/cancel`

**Rate Limit:** 20 requests/minute per user

---

## Conversations

### List Conversations

Returns a paginated list of conversations.

```http
GET /api/conversations?limit=20&cursor=<cursor>
Cookie: better-auth.session_token=<token>
```

| Query Param | Type | Default | Description |
|-------------|------|---------|-------------|
| `limit` | integer | 20 | Results per page (max 100) |
| `cursor` | string | — | Pagination cursor from previous response |

**Response:** `200 OK`

```json
{
  "conversations": [
    {
      "id": "conv-id",
      "title": "My Conversation",
      "status": "active",
      "model": "gpt-4",
      "provider": "openai",
      "totalTokens": 150,
      "totalLatencyMs": 3000,
      "messageCount": 5,
      "createdAt": "2026-05-28T12:00:00.000Z",
      "updatedAt": "2026-05-28T12:05:00.000Z"
    }
  ],
  "pagination": {
    "cursor": "next-page-cursor",
    "hasMore": false
  }
}
```

**Rate Limit:** 60 requests/minute per user

### Get Conversation

Returns a single conversation with its messages.

```http
GET /api/conversations/:id
Cookie: better-auth.session_token=<token>
```

**Response:** `200 OK`

```json
{
  "conversation": {
    "id": "conv-id",
    "userId": "user-id",
    "title": "My Conversation",
    "status": "active",
    "model": "gpt-4",
    "provider": "openai",
    "totalTokens": 150,
    "totalLatencyMs": 3000,
    "messageCount": 5,
    "createdAt": "2026-05-28T12:00:00.000Z",
    "updatedAt": "2026-05-28T12:05:00.000Z"
  },
  "messages": [
    {
      "id": "msg-id",
      "role": "user",
      "content": "What is 2+2?",
      "createdAt": "2026-05-28T12:00:00.000Z"
    },
    {
      "id": "msg-id",
      "role": "assistant",
      "content": "4",
      "createdAt": "2026-05-28T12:00:01.000Z"
    }
  ]
}
```

### Update Conversation

Updates a conversation's title or status.

```http
PATCH /api/conversations/:id
Content-Type: application/json
Cookie: better-auth.session_token=<token>

{
  "title": "Updated Title"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | New conversation title |
| `status` | string | New status (active, cancelled, completed) |

**Response:** `200 OK` — Returns updated conversation object

### Delete Conversation

Deletes a conversation and its associated messages.

```http
DELETE /api/conversations/:id
Cookie: better-auth.session_token=<token>
```

**Response:** `200 OK`

```json
{
  "success": true
}
```

### Cancel Conversation

Sets conversation status to `cancelled`. If a streaming response is in progress,
the stream will be terminated.

```http
POST /api/conversations/:id/cancel
Cookie: better-auth.session_token=<token>
```

**Response:** `200 OK` — Returns updated conversation object

### Resume Conversation

Sets conversation status back to `active`.

```http
POST /api/conversations/:id/resume
Cookie: better-auth.session_token=<token>
```

**Response:** `200 OK` — Returns updated conversation object

---

## Ingestion

### Ingest Logs

Submits a batch of inference logs for processing. Each log is validated, PII-redacted,
and stored. Partial failures return HTTP 207.

```http
POST /api/ingest
Content-Type: application/json
Cookie: better-auth.session_token=<token>

{
  "logs": [
    {
      "provider": "openai",
      "model": "gpt-4",
      "status": "success",
      "latencyMs": 150,
      "promptTokens": 50,
      "completionTokens": 100,
      "totalTokens": 150,
      "conversationId": "conv-id",
      "inputPreview": "What is 2+2?",
      "outputPreview": "4",
      "metadata": { "customField": "value" }
    }
  ]
}
```

**Log Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | string | Yes | LLM provider name |
| `model` | string | Yes | LLM model name |
| `status` | string | Yes | `success`, `error`, or `cancelled` |
| `latencyMs` | integer | No | Response time in ms |
| `promptTokens` | integer | No | Input token count |
| `completionTokens` | integer | No | Output token count |
| `totalTokens` | integer | No | Total token count |
| `conversationId` | string | Yes | Parent conversation |
| `inputPreview` | string | No | PII-redacted input preview |
| `outputPreview` | string | No | PII-redacted output preview |
| `error` | string | No | Error message (if status=error) |
| `metadata` | object | No | Custom JSON metadata |

**Response (all accepted):** `200 OK`

```json
{
  "accepted": 1,
  "rejected": 0,
  "errors": []
}
```

**Response (partial failure):** `207 Multi-Status`

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

**Rate Limit:** 120 requests/minute per user

### List Logs

Retrieves stored inference logs.

```http
GET /api/ingest?limit=10&stats=true
Cookie: better-auth.session_token=<token>
```

| Query Param | Type | Default | Description |
|-------------|------|---------|-------------|
| `limit` | integer | 50 | Results per page |
| `stats` | boolean | false | Return aggregate stats instead of logs |

**Response (logs):** `200 OK`

```json
{
  "logs": [
    {
      "id": "log-id",
      "provider": "openai",
      "model": "gpt-4",
      "status": "success",
      "latencyMs": 150,
      "totalTokens": 150,
      "inputPreview": "What is 2+2?",
      "piiRedacted": false,
      "createdAt": "2026-05-28T12:00:00.000Z"
    }
  ]
}
```

**Response (stats):** `200 OK`

```json
{
  "totalRequests": 1500,
  "totalTokens": 75000,
  "averageLatencyMs": 234,
  "p95LatencyMs": 500,
  "byProvider": {
    "openai": { "totalRequests": 1000, "totalTokens": 50000, "averageLatencyMs": 200 },
    "nvidia": { "totalRequests": 500, "totalTokens": 25000, "averageLatencyMs": 300 }
  },
  "recentErrors": []
}
```

---

## Admin

### Dashboard Stats

Returns aggregate statistics for the admin dashboard.

```http
GET /api/admin/stats
Cookie: better-auth.session_token=<token>
```

**Response:** `200 OK`

```json
{
  "totalRequests": 1500,
  "totalTokens": 75000,
  "averageLatencyMs": 234,
  "p95LatencyMs": 500,
  "successRate": 0.98,
  "byProvider": { ... },
  "hourlyBreakdown": [
    { "hour": "12:00", "requests": 120, "tokens": 6000 }
  ],
  "recentErrors": [
    { "message": "LLM API timeout", "createdAt": "..." }
  ]
}
```

### Hourly Breakdown

Returns hourly data points for the last 24 hours.

```http
GET /api/admin/stats/hourly
Cookie: better-auth.session_token=<token>
```

**Response:** `200 OK`

```json
[
  { "hour": "2026-05-27 14:00", "requests": 100, "tokens": 5000 },
  { "hour": "2026-05-27 15:00", "requests": 150, "tokens": 7500 }
]
```

---

## Search

### Search Conversations

Searches conversations and messages across the user's data.

```http
GET /api/search?q=search+term
Cookie: better-auth.session_token=<token>
```

| Query Param | Type | Required | Description |
|-------------|------|----------|-------------|
| `q` | string | Yes | Search term |
| `limit` | integer | No | Max results (default: 20) |

**Response:** `200 OK`

```json
{
  "results": [
    {
      "type": "conversation",
      "id": "conv-id",
      "title": "My Conversation",
      "snippet": "...search term highlighted...",
      "updatedAt": "2026-05-28T12:00:00.000Z"
    }
  ]
}
```

**Rate Limit:** 30 requests/minute per user

---

## Analytics

### Track Event

Tracks an analytics event (page view, custom event, etc.).

```http
POST /api/analytics
Content-Type: application/json
Cookie: better-auth.session_token=<token>

{
  "type": "page_view",
  "path": "/chat",
  "data": {
    "browser": "Chrome",
    "referrer": "https://google.com"
  }
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "id": "event-id"
}
```

**Rate Limit:** 100 requests/minute per user

---

## Files

### List Files

```http
GET /api/files
Cookie: better-auth.session_token=<token>
```

**Response:** `200 OK`

```json
[
  {
    "key": "uploads/abc123/package.json",
    "size": 1024,
    "contentType": "application/json",
    "uploadedAt": "2026-05-28T12:00:00.000Z"
  }
]
```

### Upload File

Uploads a file via multipart/form-data.

```http
POST /api/files
Content-Type: multipart/form-data
Cookie: better-auth.session_token=<token>

file=<binary>
```

**Response:** `200 OK`

```json
{
  "key": "uploads/abc123/package.json",
  "url": "/api/files/uploads/abc123/package.json",
  "size": 1024,
  "contentType": "application/json"
}
```

### Delete File

```http
DELETE /api/files?key=uploads/abc123/package.json
Cookie: better-auth.session_token=<token>
```

**Response:** `200 OK`

```json
{
  "success": true
}
```

---

## Metrics

### Prometheus Metrics

Returns Prometheus-formatted metrics.

```http
GET /api/metrics
```

**Response:** `200 OK`

```
# HELP llm_inference_requests_total Total LLM inference requests
# TYPE llm_inference_requests_total counter
llm_inference_requests_total{provider="nvidia",model="minimaxai/minimax-m2.7",status="success"} 42
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="POST",route="/api/chat",status="200"} 42
```

---

## CSP Report

### Report CSP Violations

Endpoint for browsers to report Content Security Policy violations.

```http
POST /api/csp-report
Content-Type: application/json

{
  "csp-report": {
    "document-uri": "http://localhost:3000/",
    "violated-directive": "script-src",
    "blocked-uri": "http://evil.com/script.js"
  }
}
```

**Response:** `204 No Content`

---

## Sitemap & Robots

### Sitemap

```http
GET /sitemap.xml
```

**Response:** `200 OK` — XML sitemap listing all public pages.

### Robots

```http
GET /robots.txt
```

**Response:** `200 OK`

```
User-Agent: *
Allow: /
Disallow: /api/
Disallow: /_next/
Disallow: /admin/

Sitemap: http://localhost:3000/sitemap.xml
```

---

## Error Codes

| Status Code | Meaning |
|-------------|---------|
| `200` | Success |
| `201` | Created (analytics events) |
| `204` | No Content (CSP reports, updates) |
| `207` | Multi-Status (partial batch failure) |
| `400` | Bad Request (validation error) |
| `401` | Unauthorized (missing/invalid session) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Not Found (resource doesn't exist) |
| `413` | Payload Too Large (request exceeds limit) |
| `429` | Too Many Requests (rate limit exceeded) |
| `500` | Internal Server Error |
| `503` | Service Unavailable (database down) |

### Standard Error Response

```json
{
  "error": "Human-readable error message"
}
```

### Validation Error Response

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "email", "message": "Invalid email address" }
  ]
}
```

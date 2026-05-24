# Typesense Setup Guide

Typesense provides fast, typo-tolerant full-text search.

## Docker

Typesense is included in `docker-compose.observability.yml`:

- **API**: http://localhost:8108
- **API Key**: `xyz`

### Verifying

```bash
curl http://localhost:8108/health
# {"ok":true}
```

## Vercel

On Vercel, search falls back to SQL `LIKE` queries.
For production on Vercel, configure a hosted Typesense instance:

| Variable             | Value               |
| -------------------- | ------------------- |
| `TYPESENSE_API_KEY`  | Your API key        |
| `TYPESENSE_HOST`     | Your Typesense host |
| `TYPESENSE_PORT`     | `443`               |
| `TYPESENSE_PROTOCOL` | `https`             |

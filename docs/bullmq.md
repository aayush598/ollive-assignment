# BullMQ Background Jobs

BullMQ handles background jobs using Redis.

## Docker

On Docker, the BullMQ worker runs as part of the Next.js app (PM2 process).
Redis handles retries, delays, and job persistence.

### Available Jobs

| Job Type              | Description                                       | Schedule  |
| --------------------- | ------------------------------------------------- | --------- |
| `cleanup-old-data`    | Removes conversations and logs older than 30 days | Every 24h |
| `aggregate-analytics` | Aggregates daily analytics events                 | Every 1h  |

## Vercel

On Vercel, jobs execute inline (synchronously) within the request context
since Redis is not available. No worker or queue infrastructure needed.

## Configuration

- Redis connection is configured via `REDIS_URL` (optional — falls back to in-process)
- Worker auto-starts when `REDIS_URL` is set via `src/lib/queue.ts:startWorker()`
- Queue prefix: `llm-logger`

# MinIO Setup Guide

MinIO provides S3-compatible object storage for file uploads.

## Docker

MinIO is included in `docker-compose.observability.yml`:

- **Console**: http://localhost:9001 (user: `minio`, pass: `minio123`)
- **API**: http://localhost:9000

### Creating the bucket

```bash
docker compose -f docker/docker-compose.observability.yml exec minio \
  mc alias set local http://localhost:9000 minio minio123 && \
  mc mb local/uploads && \
  mc policy set public local/uploads
```

## Vercel

On Vercel, file uploads fall back to in-memory (ephemeral) storage.
For production on Vercel, configure external S3-compatible storage:

| Variable        | Value                           |
| --------------- | ------------------------------- |
| `S3_ENDPOINT`   | Your S3 endpoint                |
| `S3_ACCESS_KEY` | Your access key                 |
| `S3_SECRET_KEY` | Your secret key                 |
| `S3_BUCKET`     | `uploads` (or your bucket name) |
| `S3_REGION`     | `us-east-1` (or your region)    |

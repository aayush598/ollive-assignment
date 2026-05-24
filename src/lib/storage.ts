// File storage abstraction.
// Uses MinIO (S3-compatible) when available (Docker/K8s).
// Falls back to in-memory storage on Vercel (ephemeral).

export interface StoredFile {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

const memoryStore = new Map<string, { buffer: Buffer; contentType: string; size: number }>();

let s3Client: {
  send: (command: unknown) => Promise<unknown>;
} | null = null;

function getEndpoint(): string | undefined {
  return process.env.MINIO_ENDPOINT || process.env.S3_ENDPOINT || undefined;
}

async function getS3Client() {
  if (s3Client) return s3Client;
  const endpoint = getEndpoint();
  if (!endpoint) return null;

  try {
    const { S3Client } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      endpoint,
      region: process.env.S3_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || "minio",
        secretAccessKey: process.env.S3_SECRET_KEY || "minio123",
      },
      forcePathStyle: true,
    });
    s3Client = { send: (cmd) => client.send(cmd as never) };
    return s3Client;
  } catch {
    return null;
  }
}

function getBucket(): string {
  return process.env.S3_BUCKET || "uploads";
}

export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<StoredFile> {
  const client = await getS3Client();
  if (client) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await client.send(
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const endpoint = getEndpoint() || "";
    return {
      key,
      url: `${endpoint}/${getBucket()}/${key}`,
      size: buffer.length,
      contentType,
    };
  }

  memoryStore.set(key, { buffer, contentType, size: buffer.length });
  return {
    key,
    url: `/api/files/${key}`,
    size: buffer.length,
    contentType,
  };
}

async function s3GetObject(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const client = await getS3Client();
  if (!client) return null;

  try {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const result = (await client.send(new GetObjectCommand({ Bucket: getBucket(), Key: key }))) as {
      Body?: {
        transformToByteArray?: () => Promise<Uint8Array>;
        transformToString?: (encoding?: string) => Promise<string>;
        getReader?: () => ReadableStreamDefaultReader<Uint8Array>;
      };
      ContentType?: string;
    };

    if (!result.Body) return null;

    let bytes: Uint8Array;
    if (typeof result.Body.transformToByteArray === "function") {
      bytes = await result.Body.transformToByteArray();
    } else if (typeof result.Body.transformToString === "function") {
      const str = await result.Body.transformToString("base64");
      bytes = Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
    } else if (typeof result.Body.getReader === "function") {
      const reader = result.Body.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
      bytes = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
    } else {
      return null;
    }

    return {
      buffer: Buffer.from(bytes),
      contentType: result.ContentType || "application/octet-stream",
    };
  } catch {
    return null;
  }
}

export async function getFile(
  key: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const client = await getS3Client();
  if (client) {
    return s3GetObject(key);
  }

  const entry = memoryStore.get(key);
  if (!entry) return null;
  return { buffer: entry.buffer, contentType: entry.contentType };
}

export async function deleteFile(key: string): Promise<void> {
  const client = await getS3Client();
  if (client) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await client.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
    return;
  }

  memoryStore.delete(key);
}

export async function listFiles(prefix?: string): Promise<StoredFile[]> {
  const client = await getS3Client();
  if (client) {
    const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const result = (await client.send(
      new ListObjectsV2Command({ Bucket: getBucket(), Prefix: prefix }),
    )) as { Contents?: { Key?: string; Size?: number }[] };

    const endpoint = getEndpoint() || "";
    return (result.Contents || [])
      .filter((item): item is { Key: string; Size?: number } => !!item.Key)
      .map((item) => ({
        key: item.Key,
        url: `${endpoint}/${getBucket()}/${item.Key}`,
        size: item.Size || 0,
        contentType: "application/octet-stream",
      }));
  }

  return Array.from(memoryStore.entries())
    .filter(([key]) => !prefix || key.startsWith(prefix))
    .map(([key, entry]) => ({
      key,
      url: `/api/files/${key}`,
      size: entry.size,
      contentType: entry.contentType,
    }));
}

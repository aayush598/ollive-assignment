// Background job queue using BullMQ with Redis.
// Falls back to in-process execution when Redis is unavailable (e.g., Vercel).
import { logger } from "./logger";

export interface JobData {
  type: string;
  payload: Record<string, unknown>;
}

type JobHandler = (job: JobData) => Promise<void>;

const handlers = new Map<string, JobHandler>();
const inProcessQueue: JobData[] = [];
let processing = false;

async function processInProcessQueue() {
  if (processing) return;
  processing = true;
  while (inProcessQueue.length > 0) {
    const job = inProcessQueue.shift()!;
    const handler = handlers.get(job.type);
    if (handler) {
      try {
        await handler(job);
      } catch {
        // Queue job failed
      }
    }
  }
  processing = false;
}

let queue: {
  add: (name: string, data: JobData) => Promise<void>;
  close: () => Promise<void>;
} | null = null;

async function getQueue() {
  if (queue) return queue;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    const { Queue } = await import("bullmq");
    const q = new Queue("llm-logger", { connection: { url: redisUrl } });
    queue = {
      add: async (name: string, data: JobData) => {
        await q.add(name, data);
      },
      close: async () => {
        await q.close();
      },
    };
    return queue;
  } catch {
    return null;
  }
}

export async function enqueue(type: string, payload: Record<string, unknown>): Promise<void> {
  const job: JobData = { type, payload };

  const q = await getQueue();
  if (q) {
    await q.add(type, job);
    return;
  }

  inProcessQueue.push(job);
  processInProcessQueue();
}

export function registerHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
}

export async function startWorker() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return;

  try {
    const { Worker } = await import("bullmq");
    const worker = new Worker(
      "llm-logger",
      async (job) => {
        const handler = handlers.get(job.data.type);
        if (handler) {
          await handler(job.data);
        }
      },
      { connection: { url: redisUrl } },
    );
    worker.on("failed", (job, err) => {
      logger.error({ jobId: job?.id, error: err.message }, "Queue job failed");
    });
  } catch {
    // BullMQ not available
  }
}

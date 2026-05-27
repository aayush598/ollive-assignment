import { EventEmitter } from "events";

export interface LogIngestedEvent {
  id: string;
  provider: string;
  model: string;
  status: string;
  latencyMs?: number | null;
  totalTokens?: number | null;
}

const REDIS_CHANNEL = "llm:log-ingested";

class IngestionEventEmitter extends EventEmitter {
  private redisSub: {
    publish: (channel: string, message: string) => Promise<void>;
    subscribe: (channel: string, handler: (message: string) => void) => () => void;
  } | null = null;

  private async getRedisPubSub() {
    if (this.redisSub) return this.redisSub;

    const url = process.env.REDIS_URL;
    if (!url) return null;

    try {
      const { createClient } = await import("redis");
      const pub = createClient({ url });
      const sub = createClient({ url });
      await pub.connect();
      await sub.connect();

      this.redisSub = {
        publish: async (channel: string, message: string) => {
          await pub.publish(channel, message);
        },
        subscribe: (channel: string, handler: (message: string) => void) => {
          sub.subscribe(channel, (msg) => handler(msg));
          return () => {
            sub.unsubscribe(channel);
          };
        },
      };
      return this.redisSub;
    } catch {
      return null;
    }
  }

  async emitLogIngested(data: LogIngestedEvent) {
    this.emit("log:ingested", data);

    const pubsub = await this.getRedisPubSub();
    if (pubsub) {
      await pubsub.publish(REDIS_CHANNEL, JSON.stringify(data)).catch(() => {});
    }
  }

  onLogIngested(callback: (data: LogIngestedEvent) => void) {
    this.on("log:ingested", callback);
    const off = () => this.off("log:ingested", callback);

    this.getRedisPubSub().then((pubsub) => {
      if (pubsub) {
        pubsub.subscribe(REDIS_CHANNEL, (message) => {
          try {
            const data = JSON.parse(message) as LogIngestedEvent;
            callback(data);
          } catch {
            // ignore parse errors
          }
        });
      }
    });

    return off;
  }
}

export const ingestionEvents = new IngestionEventEmitter();

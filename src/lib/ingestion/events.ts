import { EventEmitter } from "events";

export interface LogIngestedEvent {
  id: string;
  provider: string;
  model: string;
  status: string;
  latencyMs?: number | null;
  totalTokens?: number | null;
}

class IngestionEventEmitter extends EventEmitter {
  emitLogIngested(data: LogIngestedEvent) {
    this.emit("log:ingested", data);
  }

  onLogIngested(callback: (data: LogIngestedEvent) => void) {
    this.on("log:ingested", callback);
    return () => this.off("log:ingested", callback);
  }
}

export const ingestionEvents = new IngestionEventEmitter();

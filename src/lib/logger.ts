import pino from "pino";
import { env } from "./env";

function getPid() {
  if (typeof process !== "undefined" && typeof process.pid === "number") {
    return process.pid;
  }
  return undefined;
}

function getHostname() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("os").hostname();
  } catch {
    return "unknown";
  }
}

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['set-cookie']",
      "body.password",
      "body.apiKey",
      "body.secret",
      "body.accessToken",
      "body.refreshToken",
    ],
    censor: "[REDACTED]",
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  base: {
    pid: getPid(),
    hostname: getHostname(),
    service: "llm-inference-logger",
  },
});

export type Logger = typeof logger;

export function createChildLogger(component: string, bindings?: Record<string, unknown>) {
  return logger.child({ component, ...bindings });
}

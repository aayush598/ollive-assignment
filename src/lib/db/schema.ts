import { pgTable, text, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const conversationStatus = ["active", "cancelled", "completed"] as const;
export type ConversationStatus = (typeof conversationStatus)[number];

export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New Conversation"),
    status: text("status").notNull().$type<ConversationStatus>().default("active"),
    model: text("model").default("gpt-4.1"),
    provider: text("provider").default("openai"),
    totalTokens: integer("total_tokens").default(0),
    totalLatencyMs: integer("total_latency_ms").default(0),
    messageCount: integer("message_count").default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("conv_user_id_idx").on(table.userId),
    index("conv_status_idx").on(table.status),
    index("conv_created_idx").on(table.createdAt),
    index("conv_user_status_idx").on(table.userId, table.status),
    index("conv_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const messageRole = ["user", "assistant", "system"] as const;
export type MessageRole = (typeof messageRole)[number];

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull().$type<MessageRole>(),
    content: text("content").notNull(),
    piiRedacted: boolean("pii_redacted").default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("msg_conv_id_idx").on(table.conversationId),
    index("msg_created_idx").on(table.createdAt),
    index("msg_conv_created_idx").on(table.conversationId, table.createdAt),
  ],
);

export const inferenceLogStatus = ["success", "error", "cancelled"] as const;
export type InferenceLogStatus = (typeof inferenceLogStatus)[number];

export const inferenceLogs = pgTable(
  "inference_logs",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id").references(() => messages.id, { onDelete: "set null" }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    sessionId: text("session_id"),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    status: text("status").notNull().$type<InferenceLogStatus>().default("success"),
    latencyMs: integer("latency_ms"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    totalTokens: integer("total_tokens"),
    inputPreview: text("input_preview"),
    outputPreview: text("output_preview"),
    error: text("error"),
    metadata: jsonb("metadata"),
    piiRedacted: boolean("pii_redacted").default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("log_conv_id_idx").on(table.conversationId),
    index("log_user_id_idx").on(table.userId),
    index("log_provider_idx").on(table.provider),
    index("log_status_idx").on(table.status),
    index("log_created_idx").on(table.createdAt),
    index("log_model_idx").on(table.model),
    index("log_session_id_idx").on(table.sessionId),
    index("log_user_created_idx").on(table.userId, table.createdAt),
    index("log_provider_status_idx").on(table.provider, table.status),
  ],
);

export const errorSeverity = ["critical", "error", "warning", "info"] as const;
export type ErrorSeverity = (typeof errorSeverity)[number];

export const errorEvents = pgTable(
  "error_events",
  {
    id: text("id").primaryKey(),
    message: text("message").notNull(),
    code: text("code").notNull().default("UNEXPECTED_ERROR"),
    severity: text("severity").notNull().$type<ErrorSeverity>().default("error"),
    stack: text("stack"),
    route: text("route"),
    method: text("method"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    metadata: jsonb("metadata"),
    digest: text("digest"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("err_severity_idx").on(table.severity),
    index("err_code_idx").on(table.code),
    index("err_route_idx").on(table.route),
    index("err_user_id_idx").on(table.userId),
    index("err_created_idx").on(table.createdAt),
    index("err_severity_created_idx").on(table.severity, table.createdAt),
  ],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    sessionId: text("session_id"),
    deviceId: text("device_id"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    url: text("url"),
    path: text("path"),
    referrer: text("referrer"),
    userAgent: text("user_agent"),
    data: jsonb("data"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ae_type_idx").on(table.type),
    index("ae_session_id_idx").on(table.sessionId),
    index("ae_user_id_idx").on(table.userId),
    index("ae_created_idx").on(table.createdAt),
    index("ae_path_idx").on(table.path),
    index("ae_type_created_idx").on(table.type, table.createdAt),
  ],
);

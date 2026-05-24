import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "../env";

let qdrantClient: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient | null {
  if (!qdrantClient) {
    if (!env.QDRANT_URL || !env.QDRANT_API_KEY) {
      // Qdrant not configured, return null to indicate unavailability
      return null;
    }
    qdrantClient = new QdrantClient({
      url: env.QDRANT_URL,
      apiKey: env.QDRANT_API_KEY,
    });
  }
  return qdrantClient;
}

export const COLLECTION_NAME = "conversation_context";
export const VECTOR_SIZE = 2048;

interface PayloadIndexDef {
  field_name: string;
  field_schema: string;
}

const REQUIRED_INDEXES: PayloadIndexDef[] = [
  { field_name: "userId", field_schema: "keyword" },
  { field_name: "conversationId", field_schema: "keyword" },
  { field_name: "timestamp", field_schema: "integer" },
];

async function ensureCollectionExists(client: QdrantClient): Promise<void> {
  const collections = await client.getCollections();
  const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);
  if (exists) return;

  await client.createCollection(COLLECTION_NAME, {
    vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    optimizers_config: {
      default_segment_number: 2,
      indexing_threshold: 0,
    },
    on_disk_payload: true,
  });

  // Give Qdrant a moment to recognize the new collection
  await new Promise((r) => setTimeout(r, 500));
}

async function ensureIndexesExist(client: QdrantClient): Promise<void> {
  // Get existing index field names from the collection's payload schema
  let existingIndexes: string[] = [];
  try {
    const info = await client.getCollection(COLLECTION_NAME);
    // payload_schema is a map: { [field_name]: PayloadIndexInfo }
    existingIndexes = Object.keys(info.payload_schema ?? {});
  } catch {
    // If we can't get payload schema, attempt all indexes anyway (idempotent)
    existingIndexes = [];
  }

  for (const idx of REQUIRED_INDEXES) {
    if (!existingIndexes.includes(idx.field_name)) {
      try {
        await client.createPayloadIndex(COLLECTION_NAME, idx as never);
        console.debug(`[qdrant] Created payload index "${idx.field_name}"`);
      } catch (err) {
        // createPayloadIndex is idempotent; ignore if already exists
        console.debug(`[qdrant] Could not create index "${idx.field_name}":`, err);
      }
    }
  }
}

export async function ensureCollection(): Promise<void> {
  try {
    const client = getQdrantClient();
    if (!client) {
      // Qdrant not configured, nothing to ensure
      return;
    }

    await ensureCollectionExists(client);
    await ensureIndexesExist(client);
  } catch (error) {
    console.debug("[qdrant] Failed to ensure collection:", error);
    // Don't throw - let operations fail later if needed
  }
}

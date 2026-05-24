import { env } from "../env";

const EMBEDDING_URL = "https://integrate.api.nvidia.com/v1/embeddings";
const EMBEDDING_MODEL = "nvidia/llama-nemotron-embed-1b-v2";

export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch(EMBEDDING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      input: [text],
      model: EMBEDDING_MODEL,
      input_type: "query",
      encoding_format: "float",
      truncate: "NONE",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

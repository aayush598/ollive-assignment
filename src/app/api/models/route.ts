import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api";
import { llmRegistry } from "@/lib/llm/registry";

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const models = llmRegistry.listAvailableModels();
  return NextResponse.json({ models });
}

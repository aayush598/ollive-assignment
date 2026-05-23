import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api";
import { llmRegistry } from "@/lib/llm/registry";

export async function GET() {
  try {
    await requireAuth();
    const models = llmRegistry.listAvailableModels();
    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ models: [] });
  }
}

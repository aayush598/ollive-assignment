import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api";
import { uploadFile, getFile, deleteFile, listFiles } from "@/lib/storage";
import { v4 as uuid } from "uuid";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return unauthorized();
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "bin";
    const key = `${session.user.id}/${uuid()}.${ext}`;

    const stored = await uploadFile(key, buffer, file.type);
    return NextResponse.json(stored);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return unauthorized();
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (key) {
    const file = await getFile(key);
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(file.buffer), {
      headers: { "Content-Type": file.contentType },
    });
  }

  const prefix = searchParams.get("prefix") || session.user.id;
  const files = await listFiles(prefix);
  return NextResponse.json(files);
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return unauthorized();
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "No key provided" }, { status: 400 });
  }

  await deleteFile(key);
  return NextResponse.json({ success: true });
}

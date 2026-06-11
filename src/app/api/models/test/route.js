import { NextResponse } from "next/server";
import { pingModelByKind } from "./ping";

// POST /api/models/test - Ping a single model via internal completions or embeddings
export async function POST(request) {
  try {
    const { model, kind } = await request.json();
    if (!model) return NextResponse.json({ error: "Model required" }, { status: 400 });
    const baseUrl = getSelfBaseUrl(request);
    const result = await pingModelByKind(model, kind || "llm", baseUrl);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[API ERROR] /api/models/test failed:", {
      message: err?.message,
      cause: err?.cause,
      stack: err?.stack,
    });

    const causeMessage = err?.cause?.message || err?.cause?.code || "";
    const error = causeMessage ? `${err.message}: ${causeMessage}` : err.message;
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}

function getSelfBaseUrl(request) {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  const url = new URL(request.url);
  const hostname = url.hostname === "0.0.0.0" ? "127.0.0.1" : url.hostname;
  return `${url.protocol}//${hostname}${url.port ? `:${url.port}` : ""}`;
}

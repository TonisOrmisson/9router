import { initTranslators } from "open-sse/translator/index.js";
import crypto from "crypto";
import { getInternalBaseUrl } from "@/lib/runtimeUrls";

export const runtime = "nodejs";

let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    await initTranslators();
    initialized = true;
    console.log("[SSE] Translators initialized for /v1/responses/compact");
  }
}

function base64UrlEncode(text) {
  return Buffer.from(text, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function build9RouterEncryptedContent(summaryText) {
  const payload = {
    v: 1,
    kind: "9router.compaction",
    created_at: Math.floor(Date.now() / 1000),
    summary: summaryText,
  };
  return `9r1:${base64UrlEncode(JSON.stringify(payload))}`;
}

function extractAssistantTextFromResponsesJson(json) {
  const output = Array.isArray(json?.output) ? json.output : [];
  const parts = [];

  for (const item of output) {
    if (item?.type !== "message") continue;
    if (item?.role !== "assistant") continue;
    if (!Array.isArray(item?.content)) continue;
    for (const c of item.content) {
      if (c?.type === "output_text" && typeof c?.text === "string") {
        parts.push(c.text);
      }
    }
  }

  const text = parts.join("\n").trim();
  return text === "" ? null : text;
}

function renderResponsesInputAsText(input) {
  if (typeof input === "string") return input;
  if (!Array.isArray(input)) return null;

  const lines = [];
  for (const item of input) {
    const type = item?.type || (item?.role ? "message" : null);

    if (type === "message") {
      const role = item?.role || "unknown";
      if (Array.isArray(item?.content)) {
        const text = item.content
          .map((c) => {
            if (!c) return "";
            if (c.type === "input_text" || c.type === "output_text") return c.text || "";
            if (c.type === "input_image") return `[image:${c.image_url || c.file_id || ""}]`;
            return c.text || c.content || "";
          })
          .filter(Boolean)
          .join("");
        lines.push(`${role}: ${text}`);
      } else if (typeof item?.content === "string") {
        lines.push(`${role}: ${item.content}`);
      }
      continue;
    }

    if (type === "function_call") {
      lines.push(`tool_call: ${item?.name || "unknown"} ${item?.arguments || ""}`.trim());
      continue;
    }

    if (type === "function_call_output") {
      const out = typeof item?.output === "string" ? item.output : JSON.stringify(item?.output);
      lines.push(`tool_result: ${item?.call_id || ""} ${out || ""}`.trim());
      continue;
    }

    if (type === "reasoning") continue;
    if (type === "compaction") continue;
  }

  const text = lines.join("\n").trim();
  return text === "" ? null : text;
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

/**
 * POST /v1/responses/compact - OpenAI Responses API compatible compaction endpoint (best-effort).
 *
 * This endpoint is not a pass-through to upstream providers. It produces a 9router-specific
 * `encrypted_content` payload that 9router can later expand into instructions when routing.
 */
export async function POST(request) {
  await ensureInitialized();

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { message: "Invalid JSON body", type: "invalid_request_error" } },
      { status: 400 },
    );
  }

  const model = body?.model;
  if (!model || typeof model !== "string" || model.trim() === "") {
    return Response.json(
      { error: { message: "Missing model", type: "invalid_request_error" } },
      { status: 400 },
    );
  }

  const inputText = renderResponsesInputAsText(body?.input);
  if (!inputText) {
    return Response.json(
      { error: { message: "Missing input", type: "invalid_request_error" } },
      { status: 400 },
    );
  }

  const origin = getInternalBaseUrl(request);
  const summarizeBody = {
    model,
    stream: false,
    instructions:
      "You are a context compactor. Summarize the conversation so far into a concise system prompt that preserves: goals, constraints, key decisions, file paths, commands, API keys placeholders (never reveal secrets), and current TODOs. Output only the compacted context text.",
    input: [{ type: "message", role: "user", content: [{ type: "input_text", text: inputText }] }],
  };

  const auth = request.headers.get("Authorization");
  const upstreamRes = await fetch(`${origin}/v1/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.stringify(summarizeBody),
  });

  if (!upstreamRes.ok) {
    let errText = "";
    try {
      errText = await upstreamRes.text();
    } catch { }
    return new Response(errText || "Compaction failed", {
      status: upstreamRes.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  let json;
  try {
    json = await upstreamRes.json();
  } catch {
    const text = await upstreamRes.text().catch(() => "");
    return new Response(text || "Compaction failed (non-JSON upstream)", {
      status: 502,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const summaryText = extractAssistantTextFromResponsesJson(json) || "...";
  const encryptedContent = build9RouterEncryptedContent(summaryText);

  const created = Math.floor(Date.now() / 1000);
  const compactionId = crypto.randomUUID();

  return Response.json(
    {
      id: `resp_compact_${compactionId}`,
      object: "response.compaction",
      created_at: created,
      model,
      output: [
        {
          type: "compaction",
          id: `cmp_${compactionId}`,
          summary: [{ type: "summary_text", text: summaryText }],
          encrypted_content: encryptedContent,
        },
      ],
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

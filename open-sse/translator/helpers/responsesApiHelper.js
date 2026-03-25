/**
 * Normalize Responses API input to array format.
 * Accepts string or array, returns array of message items.
 * @param {string|Array} input - raw input from Responses API body
 * @returns {Array|null} normalized array or null if invalid
 */
export function normalizeResponsesInput(input) {
  if (typeof input === "string") {
    const text = input.trim() === "" ? "..." : input;
    return [{ type: "message", role: "user", content: [{ type: "input_text", text }] }];
  }
  if (Array.isArray(input)) return input;
  return null;
}

const NINE_ROUTER_COMPACTION_PREFIX = "9r1:";

function base64UrlToBase64(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return b64 + pad;
}

export function decode9RouterCompactionEncryptedContent(encryptedContent) {
  if (typeof encryptedContent !== "string") return null;
  if (!encryptedContent.startsWith(NINE_ROUTER_COMPACTION_PREFIX)) return null;
  const payload = encryptedContent.slice(NINE_ROUTER_COMPACTION_PREFIX.length);
  if (!payload) return null;

  try {
    const json = Buffer.from(base64UrlToBase64(payload), "base64").toString("utf8");
    const parsed = JSON.parse(json);
    if (!parsed || parsed.v !== 1) return null;
    if (parsed.kind !== "9router.compaction") return null;
    if (typeof parsed.summary !== "string" || parsed.summary.trim() === "") return null;
    return parsed.summary.trim();
  } catch {
    return null;
  }
}

export function consume9RouterCompactionItems(body) {
  if (!body || !Array.isArray(body.input)) return body;

  const summaries = [];
  const nextInput = [];

  for (const item of body.input) {
    const itemType = item?.type || (item?.role ? "message" : null);
    if (itemType === "compaction") {
      const summary = decode9RouterCompactionEncryptedContent(item?.encrypted_content);
      if (summary) {
        summaries.push(summary);
        continue;
      }
    }
    nextInput.push(item);
  }

  if (summaries.length === 0) return body;

  const prefix = "Compacted context:\n";
  const existing = typeof body.instructions === "string" ? body.instructions.trim() : "";
  const merged = `${existing ? `${existing}\n\n` : ""}${prefix}${summaries.join("\n\n")}`;

  return {
    ...body,
    instructions: merged,
    input: nextInput,
  };
}

/**
 * Convert OpenAI Responses API format to standard chat completions format
 * Responses API uses: { input: [...], instructions: "..." }
 * Chat API uses: { messages: [...] }
 */
export function convertResponsesApiFormat(body) {
  if (!body.input) return body;

  const compactedBody = consume9RouterCompactionItems(body);
  const result = { ...compactedBody };
  result.messages = [];

  const instructions = typeof compactedBody.instructions === "string" ? compactedBody.instructions : "";

  // Group items by conversation turn
  let currentAssistantMsg = null;
  let pendingToolCalls = [];
  let pendingToolResults = [];

  const inputItems = normalizeResponsesInput(compactedBody.input);
  if (!inputItems) return body;

  for (const item of inputItems) {
    // Determine item type - Droid CLI sends role-based items without 'type' field
    // Fallback: if no type but has role property, treat as message
    const itemType = item.type || (item.role ? "message" : null);

    if (itemType === "message") {
      // Flush any pending assistant message with tool calls
      if (currentAssistantMsg) {
        result.messages.push(currentAssistantMsg);
        currentAssistantMsg = null;
      }
      // Flush pending tool results
      if (pendingToolResults.length > 0) {
        for (const tr of pendingToolResults) {
          result.messages.push(tr);
        }
        pendingToolResults = [];
      }

      // Convert content: input_text → text, output_text → text, input_image → image_url
      const content = Array.isArray(item.content)
        ? item.content.map(c => {
          if (c.type === "input_text") return { type: "text", text: c.text };
          if (c.type === "output_text") return { type: "text", text: c.text };
          if (c.type === "input_image") {
            const url = c.image_url || c.file_id || "";
            return { type: "image_url", image_url: { url, detail: c.detail || "auto" } };
          }
          return c;
        })
        : item.content;
      result.messages.push({ role: item.role, content });
    }
    else if (itemType === "function_call") {
      // Start or append to assistant message with tool_calls
      if (!currentAssistantMsg) {
        currentAssistantMsg = {
          role: "assistant",
          content: null,
          tool_calls: []
        };
      }
      currentAssistantMsg.tool_calls.push({
        id: item.call_id,
        type: "function",
        function: {
          name: item.name,
          arguments: item.arguments
        }
      });
    }
    else if (itemType === "function_call_output") {
      // Flush assistant message first if exists
      if (currentAssistantMsg) {
        result.messages.push(currentAssistantMsg);
        currentAssistantMsg = null;
      }
      // Add tool result
      pendingToolResults.push({
        role: "tool",
        tool_call_id: item.call_id,
        content: typeof item.output === "string" ? item.output : JSON.stringify(item.output)
      });
    }
    else if (itemType === "reasoning") {
      // Skip reasoning items - they are for display only
      continue;
    }
  }

  // Flush remaining
  if (currentAssistantMsg) {
    result.messages.push(currentAssistantMsg);
  }
  if (pendingToolResults.length > 0) {
    for (const tr of pendingToolResults) {
      result.messages.push(tr);
    }
  }

  // Convert instructions to system message (prepend)
  if (instructions && instructions.trim() !== "") {
    result.messages.unshift({ role: "system", content: instructions });
  }

  // Cleanup Responses API specific fields
  delete result.input;
  delete result.instructions;
  delete result.include;
  delete result.prompt_cache_key;
  delete result.store;
  delete result.reasoning;

  return result;
}

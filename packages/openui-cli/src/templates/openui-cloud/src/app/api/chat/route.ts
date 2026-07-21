import { resolveRequestedModel } from "@/config/models";
import { requiredEnv } from "@/lib/env";
import { artifactTool, createResponsesInstructions } from "@openuidev/thesys-server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";

/**
 * Generation plane: browser → THIS route → OpenUI Cloud.
 *
 * Calls the hosted Responses API (`POST /v1/embed/responses`) with the stock
 * OpenAI SDK — the endpoint speaks the Responses protocol — and proxies the SSE
 * stream straight to the browser, where `openAIResponsesAdapter` parses it
 * (including the custom `response.artifact_call.delta` events).
 *
 * The artifact tool runs **server-side** inside OpenUI Cloud, so this route is a
 * pure pipe: there is no client-side tool loop. Reads/edits go browser → /v1/*
 * with the fct_ token (see /api/frontend-token + the storage adapter).
 */
export async function POST(req: Request) {
  const {
    threadId,
    input,
    model: requestedModel,
  } = (await req.json()) as {
    threadId?: string;
    input?: ResponseInputItem[];
    model?: unknown;
  };

  if (!threadId) return badRequest("threadId is required — create the conversation first");
  if (!Array.isArray(input) || input.length === 0) {
    return badRequest("input must be a non-empty ResponseInputItem[]");
  }
  const model = resolveRequestedModel(requestedModel);
  if (!model) return badRequest("model is not available in this agent");

  const client = new OpenAI({
    baseURL: "https://api.thesys.dev/v1/embed",
    apiKey: requiredEnv("THESYS_API_KEY"), // sent as Authorization: Bearer …
  });

  try {
    return await client.responses
      .create(
        {
          model,
          conversation: threadId, // store:true persists to the conversation
          input,
          stream: true,
          store: true,
          tools: [
            artifactTool({ artifacts: ["slides", "report"] }),
            {
              type: "web_search",
            },
            {
              type: "image_search",
            },
          ],
          instructions: createResponsesInstructions(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        { signal: req.signal }, // propagate browser aborts (stop button / tab close)
      )
      .asResponse();
  } catch (err) {
    // The SDK surfaces upstream HTTP errors (e.g. 403) as APIError.
    const e = err as { status?: number; error?: unknown; message?: string };
    return NextResponse.json(
      { error: e.error ?? { message: e.message ?? "upstream error" } },
      { status: e.status ?? 502 },
    );
  }
}

function badRequest(message: string): Response {
  return NextResponse.json({ error: { message } }, { status: 400 });
}

import { resolveRequestedModel } from "@/config/models";
import { requiredEnv } from "@/lib/env";
import { artifactTool, createResponsesInstructions } from "@openuidev/thesys-server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";

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
    apiKey: requiredEnv("THESYS_API_KEY"),
  });

  try {
    return await client.responses
      .create(
        {
          model,
          conversation: threadId,
          input,
          stream: true,
          store: true,
          tools: [
            artifactTool({ artifacts: ["slides", "report"] }),
            { type: "web_search" },
            { type: "image_search" },
          ],
          instructions: createResponsesInstructions(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        { signal: req.signal },
      )
      .asResponse();
  } catch (err) {
    const error = err as { status?: number; error?: unknown; message?: string };
    return NextResponse.json(
      { error: error.error ?? { message: error.message ?? "upstream error" } },
      { status: error.status ?? 502 },
    );
  }
}

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: { message } }, { status: 400 });
}

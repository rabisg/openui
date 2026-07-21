import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const client = new OpenAI();

export async function POST(req: Request) {
  try {
    const { messages, systemPrompt } = (await req.json()) as {
      messages: ChatCompletionMessageParam[];
      systemPrompt: string;
    };

    return await client.chat.completions
      .create(
        {
          model: process.env.OPENAI_MODEL ?? "gpt-5.2",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
        },
        { signal: req.signal },
      )
      .asResponse();
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

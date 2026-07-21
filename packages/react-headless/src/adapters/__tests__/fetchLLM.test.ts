import { describe, expect, it, vi } from "vitest";
import type { Message } from "../../types/message";
import type { StreamProtocolAdapter } from "../../types/stream";
import { createFetchLLM, fetchLLM, type FetchLLMOptions } from "../fetchLLM";
import { getResponseErrorMessage } from "../httpError";

const streamAdapter: StreamProtocolAdapter = {
  async *parse() {
    // No events are needed for request-construction tests.
  },
};

const messages = [{ id: "message-1", role: "user", content: "Hello" }] as Message[];

describe("fetchLLM", () => {
  it("posts the default AG-UI-shaped body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    const llm = fetchLLM({
      url: "/api/chat",
      streamAdapter,
      fetch: fetchMock,
    });

    await llm.send({
      threadId: "thread-1",
      messages,
      signal: new AbortController().signal,
    });

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      threadId: string;
      messages: Message[];
      tools: unknown[];
      context: unknown[];
    };
    expect(body).toMatchObject({
      threadId: "thread-1",
      messages,
      tools: [],
      context: [],
    });
  });

  it("formats messages and builds a custom request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    const llm = fetchLLM({
      url: "/api/chat",
      streamAdapter,
      fetch: fetchMock,
      messageFormat: {
        toApi: (selected) => selected.map((message) => message.content),
        fromApi: () => [],
      },
      buildBody: ({ threadId, messages: sourceMessages, formatMessages }) => ({
        threadId,
        input: formatMessages(sourceMessages),
        sourceMessageCount: sourceMessages.length,
        model: "test-model",
      }),
    });

    await llm.send({
      threadId: "thread-1",
      messages: [...messages, { id: "message-2", role: "user", content: "Latest" } as Message],
      signal: new AbortController().signal,
    });

    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      threadId: "thread-1",
      input: ["Hello", "Latest"],
      sourceMessageCount: 2,
      model: "test-model",
    });
  });

  it("reads current options without replacing the ChatLLM", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    let model = "model-a";
    const options = (): FetchLLMOptions => ({
      url: "/api/chat",
      streamAdapter,
      fetch: fetchMock,
      buildBody: () => ({ model }),
    });
    const llm = createFetchLLM(options);

    model = "model-b";
    await llm.send({
      threadId: "thread-1",
      messages,
      signal: new AbortController().signal,
    });

    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      model: "model-b",
    });
  });

  it("notifies observers around failed requests", async () => {
    const onRequestStart = vi.fn();
    const onResponseError = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ error: { message: "No credits" } }, { status: 429 }));
    const llm = fetchLLM({
      url: "/api/chat",
      streamAdapter,
      fetch: fetchMock,
      onRequestStart,
      onResponseError,
    });

    const response = await llm.send({
      threadId: "thread-1",
      messages,
      signal: new AbortController().signal,
    });

    expect(response.status).toBe(429);
    expect(onRequestStart).toHaveBeenCalledOnce();
    expect(onResponseError).toHaveBeenCalledOnce();
    expect((onResponseError.mock.calls[0]?.[0] as Response).status).toBe(429);
  });
});

describe("getResponseErrorMessage", () => {
  it("reads structured API errors", async () => {
    const response = Response.json({ error: { message: "Upstream failed" } }, { status: 502 });
    await expect(getResponseErrorMessage(response)).resolves.toBe("Upstream failed");
  });

  it("falls back to response status", async () => {
    const response = new Response("not json", { status: 503, statusText: "Unavailable" });
    await expect(getResponseErrorMessage(response)).resolves.toBe(
      "Request failed: 503 Unavailable",
    );
  });
});

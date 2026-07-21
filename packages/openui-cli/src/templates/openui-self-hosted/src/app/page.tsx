"use client";
import "@openuidev/react-ui/components.css";
import "@openuidev/react-ui/styles/index.css";

import { library, promptOptions } from "@/library";
import { AgentInterface, fetchLLM, openAIAdapter, openAIMessageFormat } from "@openuidev/react-ui";

const systemPrompt = library.prompt(promptOptions);

const llm = fetchLLM({
  url: "/api/chat",
  messageFormat: openAIMessageFormat,
  streamAdapter: openAIAdapter(),
  buildBody: ({ messages, formatMessages }) => ({
    systemPrompt,
    messages: formatMessages(messages),
  }),
});

export default function Home() {
  return (
    <div className="openui-page">
      <AgentInterface llm={llm} componentLibrary={library} agentName="OpenUI Self Hosted" />
    </div>
  );
}

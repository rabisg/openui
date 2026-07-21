"use client";

import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@/config/models";
import {
  AgentInterface,
  defineArtifactCategories,
  ModelSwitcher,
  openAIConversationMessageFormat,
  openAIResponsesAdapter,
  useLLM,
  useSystemThemeMode,
} from "@openuidev/react-ui";
import {
  chatLibrary,
  presentationArtifactRenderer,
  reportArtifactRenderer,
  useOpenuiCloudStorage,
} from "@openuidev/thesys";
import dynamic from "next/dynamic";
import { useState } from "react";

const { artifactRenderers, artifactCategories } = defineArtifactCategories([
  { name: "Presentations", renderers: [presentationArtifactRenderer] },
  { name: "Reports", renderers: [reportArtifactRenderer] },
]);

const OpenUIDevTools =
  process.env.NODE_ENV === "development"
    ? dynamic(() => import("@openuidev/devtools").then((module) => module.OpenUIDevTools), {
        ssr: false,
      })
    : null;

export function CloudChat() {
  const mode = useSystemThemeMode();
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const llm = useLLM({
    url: "/api/chat",
    messageFormat: openAIConversationMessageFormat,
    streamAdapter: openAIResponsesAdapter(),
    buildBody: ({ threadId, messages, formatMessages }) => ({
      threadId,
      input: formatMessages(messages.slice(-1)),
      model: selectedModel,
    }),
  });
  const storage = useOpenuiCloudStorage({
    token: "/api/frontend-token",
    apiBaseUrl: "https://api.thesys.dev",
    features: { artifact: true },
  });

  return (
    <div className="openui-cloud-page">
      <AgentInterface
        storage={storage}
        llm={llm}
        componentLibrary={chatLibrary}
        artifactRenderers={artifactRenderers}
        artifactCategories={artifactCategories}
        agentName="OpenUI Cloud"
        scrollVariant="always"
        scrollOnLoad={false}
        theme={{ mode }}
        starters={[
          {
            displayText: "Pricing strategy tips",
            prompt: "List five quick tips for pricing a new electric vehicle competitively.",
          },
          {
            displayText: "Quarterly deck",
            prompt: "Create a short presentation about our Q2 results with three slides.",
          },
          {
            displayText: "Market report",
            prompt: "Write a brief market-analysis report on the EV sector.",
          },
        ]}
      >
        <AgentInterface.MobileHeader
          agentName=""
          actions={
            <ModelSwitcher
              models={AVAILABLE_MODELS}
              value={selectedModel}
              onValueChange={setSelectedModel}
            />
          }
        />
        <AgentInterface.ThreadHeader>
          <ModelSwitcher
            models={AVAILABLE_MODELS}
            value={selectedModel}
            onValueChange={setSelectedModel}
          />
        </AgentInterface.ThreadHeader>
      </AgentInterface>
      {OpenUIDevTools ? <OpenUIDevTools llm={llm} /> : null}
    </div>
  );
}

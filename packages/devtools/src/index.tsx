"use client";

import { Button, type ChatLLM } from "@openuidev/react-ui";
import { Modal } from "@openuidev/react-ui/Modal";
import { useEffect, useState } from "react";

export interface OpenUIDevToolsProps {
  billingUrl?: string;
  llm?: ChatLLM;
}

export interface LLMDevToolsObserver {
  onRequestStart?: () => void;
  onResponseError?: (response: Response) => void;
}

const BILLING_URL = "https://console.thesys.dev/billing";
const BILLING_CREDITS_ERROR_TITLE = "Add credits to keep going";
const BILLING_CREDITS_ERROR_MESSAGE =
  "Looks like this workspace is out of OpenUI Cloud credits. Purchase credits to keep testing, then try your request again.";
const BILLING_CREDITS_ACTION_LABEL = "Purchase credits";
const BILLING_BODY_CLASS = "openui-devtools--billing-credits-required";

type ActiveNotice = "billing-credits-required" | null;

export function OpenUIDevTools({ billingUrl = BILLING_URL, llm }: OpenUIDevToolsProps) {
  const [activeNotice, setActiveNotice] = useState<ActiveNotice>(null);
  const billingCreditsRequired = activeNotice === "billing-credits-required";

  useEffect(() => {
    if (!llm) return;

    return observeLLM(llm, {
      onRequestStart: () => setActiveNotice(null),
      onResponseError: (response) => {
        if (response.status === 429) setActiveNotice("billing-credits-required");
      },
    });
  }, [llm]);

  useEffect(() => {
    document.body.classList.toggle(BILLING_BODY_CLASS, billingCreditsRequired);
    return () => document.body.classList.remove(BILLING_BODY_CLASS);
  }, [billingCreditsRequired]);

  return (
    <>
      <style>{`.${BILLING_BODY_CLASS} .openui-agent-thread-error { display: none; }`}</style>
      <Modal
        open={billingCreditsRequired}
        onOpenChange={(open) => setActiveNotice(open ? "billing-credits-required" : null)}
        size="sm"
        title={BILLING_CREDITS_ERROR_TITLE}
      >
        <p
          style={{
            margin: 0,
            color: "var(--openui-text-neutral-secondary)",
            font: "var(--openui-text-body-default)",
            letterSpacing: "var(--openui-text-body-default-letter-spacing)",
          }}
        >
          {BILLING_CREDITS_ERROR_MESSAGE}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--openui-space-s)",
            marginTop: "var(--openui-space-xs)",
          }}
        >
          <Button
            onClick={() => window.open(billingUrl, "_blank", "noopener,noreferrer")}
            size="medium"
            type="button"
            variant="primary"
          >
            {BILLING_CREDITS_ACTION_LABEL}
          </Button>
        </div>
      </Modal>
    </>
  );
}

export function observeLLM(llm: ChatLLM, observer: LLMDevToolsObserver): () => void {
  const originalSend = llm.send;
  const observedSend: ChatLLM["send"] = async (params) => {
    observer.onRequestStart?.();
    const response = await originalSend(params);
    if (!response.ok) observer.onResponseError?.(response.clone());
    return response;
  };
  llm.send = observedSend;

  return () => {
    if (llm.send === observedSend) llm.send = originalSend;
  };
}

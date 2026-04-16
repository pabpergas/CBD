import { useEffect, useState, useRef, useCallback } from "react";
import type { Citation } from "../App";

export interface ArtifactData {
  id: string;
  filename: string;
  description: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface ThinkingData {
  text: string;
  done: boolean;
}

export interface ToolCallData {
  toolName: string;
  args: Record<string, unknown>;
}

export function useCitationsStream(notebookId: string | null) {
  const [citations, setCitations] = useState<Citation[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactData[]>([]);
  const [thinking, setThinking] = useState<ThinkingData | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCallData[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setCitations([]);
    setArtifacts([]);
    setThinking(null);
    setToolCalls([]);

    if (!notebookId) return;

    const es = new EventSource(`/api/chat/citations-stream/${notebookId}`);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "citations" && data.citations) {
          setCitations(data.citations);
        }
        if (data.type === "artifact" && data.artifact) {
          setArtifacts((prev) => [...prev, data.artifact]);
        }
        if (data.type === "thinking") {
          setThinking({ text: data.text, done: data.done });
        }
        if (data.type === "toolcall") {
          setToolCalls((prev) => [...prev, { toolName: data.toolName, args: data.args }]);
        }
      } catch {}
    };

    return () => {
      es.close();
    };
  }, [notebookId]);

  const reset = useCallback(() => {
    setCitations([]);
    setArtifacts([]);
    setThinking(null);
    setToolCalls([]);
  }, []);

  return { citations, artifacts, thinking, toolCalls, reset };
}

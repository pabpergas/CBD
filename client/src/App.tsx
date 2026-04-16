import { useState, useEffect, useCallback } from "react";
import { Box } from "@mui/material";
import NotebookSidebar from "./components/NotebookSidebar";
import ChatPanel from "./components/ChatPanel";

export interface NotebookSummary {
  id: string;
  title: string;
  sourcesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Source {
  id: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  size: number;
  chunksCount: number;
  uploadedAt: string;
  extractedText?: string;
}

export interface NotebookFull {
  id: string;
  title: string;
  sources: Source[];
  createdAt: string;
  updatedAt: string;
}

export interface Citation {
  score: number;
  fileName: string;
  fileType: string;
  text: string;
  chunkIndex?: number;
  totalChunks?: number;
  notebook?: string;
}

export default function App() {
  const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [activeNotebook, setActiveNotebook] = useState<NotebookFull | null>(null);

  const fetchNotebooks = useCallback(async () => {
    try {
      const res = await fetch("/api/notebooks");
      setNotebooks(await res.json());
    } catch {}
  }, []);

  const fetchActiveNotebook = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/notebooks/${id}`);
      setActiveNotebook(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotebooks();
  }, [fetchNotebooks]);

  const handleSelectNotebook = useCallback(
    (id: string) => {
      setActiveNotebookId(id);
      fetchActiveNotebook(id);
    },
    [fetchActiveNotebook]
  );

  const handleUploadComplete = useCallback(() => {
    if (activeNotebookId) {
      fetchActiveNotebook(activeNotebookId);
      fetchNotebooks();
    }
  }, [activeNotebookId, fetchActiveNotebook, fetchNotebooks]);

  return (
    <Box sx={{ display: "flex", height: "100vh", bgcolor: "#0e0e0e" }}>
      <NotebookSidebar
        notebooks={notebooks}
        activeNotebookId={activeNotebookId}
        activeNotebook={activeNotebook}
        onSelect={handleSelectNotebook}
        onRefresh={fetchNotebooks}
        onUploadComplete={handleUploadComplete}
      />
      <ChatPanel
        notebook={activeNotebook}
        notebooks={notebooks}
        notebookId={activeNotebookId}
        onUploadComplete={handleUploadComplete}
      />
    </Box>
  );
}

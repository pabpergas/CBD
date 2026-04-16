import { useRef, useEffect, useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { Box, Typography, Chip, Popover } from "@mui/material";
import {
  Bolt as BoltIcon,
  Send as SendIcon,
  AlternateEmail as AtIcon,
} from "@mui/icons-material";
import MessageBubble from "./MessageBubble";
import IntelligencePanel from "./IntelligencePanel";
import { useCitationsStream } from "../hooks/useCitationsStream";
import type { NotebookFull, NotebookSummary, Citation } from "../App";

interface Props {
  notebook: NotebookFull | null;
  notebooks: NotebookSummary[];
  notebookId: string | null;
  onUploadComplete?: () => void;
}

export default function ChatPanel({ notebook, notebooks, notebookId, onUploadComplete }: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [referencedIds, setReferencedIds] = useState<string[]>([]);
  const [atAnchor, setAtAnchor] = useState<HTMLElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Citas por mensaje: mapea ID de mensaje -> citas
  const [citationsMap, setCitationsMap] = useState<Record<string, Citation[]>>({});
  // Panel de inteligencia abierto para qué mensaje
  const [openPanelMsgId, setOpenPanelMsgId] = useState<string | null>(null);

  // Flujo SSE — recibe citas, artefactos, thinking y tool calls en tiempo real
  const { citations: liveCitations, artifacts: liveArtifacts, thinking: liveThinking, toolCalls: liveToolCalls, reset: resetLive } = useCitationsStream(notebookId);

  // Rastrear artefactos y citas por mensaje
  const [artifactsMap, setArtifactsMap] = useState<Record<string, any[]>>({});

  // Buffer de datos SSE pendientes — espera un mensaje del asistente al cual asociarse
  const pendingCitationsRef = useRef<Citation[]>([]);
  const pendingArtifactsRef = useRef<any[]>([]);
  const lastAssociatedMsgRef = useRef<string | null>(null);

  // Mantener refs para que el closure del body del transporte siempre lea los valores más recientes
  const referencedIdsRef = useRef(referencedIds);
  referencedIdsRef.current = referencedIds;
  const notebookIdRef = useRef(notebook?.id);
  notebookIdRef.current = notebook?.id;

  const otherNotebooks = useMemo(
    () => notebooks.filter((n) => n.id !== notebook?.id),
    [notebooks, notebook?.id]
  );

  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: "/api/chat",
        body: () => ({
          notebookId: notebookIdRef.current,
          referencedNotebookIds: referencedIdsRef.current,
        }),
      }),
    // Solo recrear al cambiar de notebook, no al cambiar referencedIds
    // El cuerpo de la función lee de refs así que siempre tiene los valores más recientes
    [notebook?.id]
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: notebook?.id || "empty",
    transport,
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Acumular datos SSE según llegan
  useEffect(() => {
    if (liveCitations.length > 0) {
      pendingCitationsRef.current = liveCitations;
    }
  }, [liveCitations]);

  useEffect(() => {
    if (liveArtifacts.length > 0) {
      pendingArtifactsRef.current = liveArtifacts;
    }
  }, [liveArtifacts]);

  // Vaciar los datos SSE acumulados al último mensaje del asistente
  useEffect(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;
    // Solo vaciar una vez por mensaje, y solo si hay datos pendientes
    if (lastAssistant.id === lastAssociatedMsgRef.current) return;

    const hasPendingCitations = pendingCitationsRef.current.length > 0;
    const hasPendingArtifacts = pendingArtifactsRef.current.length > 0;

    if (hasPendingCitations || hasPendingArtifacts) {
      lastAssociatedMsgRef.current = lastAssistant.id;

      if (hasPendingCitations) {
        setCitationsMap((prev) => ({ ...prev, [lastAssistant.id]: pendingCitationsRef.current }));
      }
      if (hasPendingArtifacts) {
        setArtifactsMap((prev) => ({ ...prev, [lastAssistant.id]: pendingArtifactsRef.current }));
      }
    }
  }, [messages]);

  // También vaciar al finalizar el flujo (captura eventos SSE que llegan tarde)
  useEffect(() => {
    if (isLoading) return;
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;

    const hasPendingCitations = pendingCitationsRef.current.length > 0;
    const hasPendingArtifacts = pendingArtifactsRef.current.length > 0;

    if (hasPendingCitations) {
      setCitationsMap((prev) => ({ ...prev, [lastAssistant.id]: pendingCitationsRef.current }));
    }
    if (hasPendingArtifacts) {
      setArtifactsMap((prev) => ({ ...prev, [lastAssistant.id]: pendingArtifactsRef.current }));
    }
  }, [isLoading, messages]);

  // Cargar mensajes guardados al cambiar de notebook
  useEffect(() => {
    if (!notebook?.id) {
      setMessages([]);
      setCitationsMap({});
      return;
    }
    setReferencedIds([]);
    setCitationsMap({});
    setArtifactsMap({});
    setOpenPanelMsgId(null);
    (async () => {
      try {
        const res = await fetch(`/api/notebooks/${notebook.id}/messages`);
        const saved = await res.json();
        if (saved.length > 0) {
          // Restaurar mapas de citas y artefactos desde los mensajes guardados
          const newCitationsMap: Record<string, any[]> = {};
          const newArtifactsMap: Record<string, any[]> = {};
          for (const m of saved) {
            if (m.citations && m.citations.length > 0) {
              newCitationsMap[m.id] = m.citations;
            }
            if (m.artifacts && m.artifacts.length > 0) {
              newArtifactsMap[m.id] = m.artifacts;
            }
          }
          setCitationsMap(newCitationsMap);
          setArtifactsMap(newArtifactsMap);

          setMessages(
            saved.map((m: any) => ({
              id: m.id,
              role: m.role,
              parts: [{ type: "text" as const, text: m.content }],
              createdAt: new Date(m.timestamp),
            }))
          );
        } else {
          setMessages([]);
        }
      } catch {
        setMessages([]);
      }
    })();
  }, [notebook?.id, setMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !notebook) return;
    const text = input;
    setInput("");
    // Reiniciar datos SSE en vivo para el nuevo mensaje
    resetLive();
    pendingCitationsRef.current = [];
    pendingArtifactsRef.current = [];
    lastAssociatedMsgRef.current = null;
    await sendMessage({ text });
  };

  const handleFileDrop = async (files: FileList) => {
    if (!notebook || files.length === 0) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("notebookId", notebook.id);
    for (const f of Array.from(files)) fd.append("files", f);
    try {
      const res = await fetch("/api/ingest", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).error);
      onUploadComplete?.();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setUploading(false);
      setDragOver(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    if (val.endsWith("@") && otherNotebooks.length > 0) {
      setAtAnchor(inputRef.current);
    }
  };

  const handleAddReference = (nbId: string) => {
    setAtAnchor(null);
    setInput((prev) => prev.replace(/@$/, ""));
    if (!referencedIds.includes(nbId)) {
      setReferencedIds((prev) => [...prev, nbId]);
    }
  };

  const handleRemoveReference = (nbId: string) => {
    setReferencedIds((prev) => prev.filter((id) => id !== nbId));
  };

  if (!notebook) {
    return (
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#0e0e0e" }}>
        <Typography
          sx={{ fontFamily: "'Manrope', sans-serif", fontSize: "2rem", fontWeight: 800, color: "rgba(255,255,255,0.04)" }}
        >
          CBD RAG
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileDrop(e.dataTransfer.files); }}
        sx={{ flex: 1, display: "flex", flexDirection: "column", bgcolor: "#0e0e0e", minWidth: 0, position: "relative" }}
      >
        {/* Overlay de arrastrar */}
        {dragOver && (
          <Box
            sx={{
              position: "absolute", inset: 0, zIndex: 50,
              bgcolor: "rgba(182,160,255,0.04)",
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <Box sx={{ textAlign: "center" }}>
              <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "#b6a0ff" }}>
                Suelta archivos para añadir fuentes
              </Typography>
              <Typography sx={{ fontSize: "0.78rem", color: "#565555", mt: 0.5 }}>
                PDF, imágenes, audio, video
              </Typography>
            </Box>
          </Box>
        )}
        {uploading && (
          <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 51 }}>
            <Box sx={{ height: 2, bgcolor: "#b6a0ff", animation: "loading 1.5s infinite", "@keyframes loading": { "0%": { width: "0%" }, "50%": { width: "70%" }, "100%": { width: "100%" } } }} />
          </Box>
        )}
        {/* Mensajes */}
        <Box sx={{ flex: 1, overflow: "auto", px: 6, pt: 6, pb: 2 }}>
          <Box sx={{ maxWidth: 720, mx: "auto" }}>
            {messages.length === 0 && (
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "50vh", gap: 2 }}>
                <Box
                  sx={{
                    width: 48, height: 48, borderRadius: "50%",
                    background: "linear-gradient(135deg, #b6a0ff, #ff97b8)",
                    display: "flex", alignItems: "center", justifyContent: "center", mb: 1,
                  }}
                >
                  <BoltIcon sx={{ fontSize: 24, color: "#340090" }} />
                </Box>
                <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontSize: "1.3rem", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
                  {notebook.title}
                </Typography>
                <Typography sx={{ fontSize: "0.85rem", color: "#565555" }}>
                  {notebook.sources.length > 0
                    ? `${notebook.sources.length} fuentes cargadas. Haz una pregunta.`
                    : "Sube fuentes para empezar a preguntar."}
                </Typography>
              </Box>
            )}

            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                citations={citationsMap[msg.id]}
                artifacts={artifactsMap[msg.id]}
                onOpenIntelligence={
                  citationsMap[msg.id]?.length
                    ? () => setOpenPanelMsgId(msg.id)
                    : undefined
                }
              />
            ))}

            {isLoading && (
              <Box sx={{ mb: 6 }}>
                {/* Cabecera asistente */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                  <Box sx={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg, #b6a0ff, #ff97b8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <BoltIcon sx={{ fontSize: 14, color: "#340090" }} />
                  </Box>
                  <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontSize: "0.82rem", fontWeight: 700 }}>
                    Asistente
                  </Typography>
                </Box>

                {/* Thinking con texto real */}
                {liveThinking ? (
                  <Box sx={{ mb: 1.5 }}>
                    <Box
                      sx={{
                        display: "inline-flex", alignItems: "center", gap: 0.75,
                        px: 1.5, py: 0.75, borderRadius: "8px",
                        bgcolor: "rgba(182,160,255,0.06)",
                        border: "1px solid rgba(182,160,255,0.12)",
                        mb: 1,
                      }}
                    >
                      <Box sx={{
                        width: 6, height: 6, borderRadius: "50%", bgcolor: "#b6a0ff",
                        animation: "pulse-think 1.5s ease-in-out infinite",
                        "@keyframes pulse-think": { "0%,100%": { opacity: 0.4 }, "50%": { opacity: 1 } },
                      }} />
                      <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#b6a0ff" }}>
                        Pensando...
                      </Typography>
                    </Box>
                    {liveThinking.text && (
                      <Box sx={{ pl: 2, borderLeft: "2px solid rgba(182,160,255,0.15)", maxHeight: 200, overflow: "auto" }}>
                        <Typography sx={{ fontSize: "0.78rem", lineHeight: 1.7, color: "rgba(182,160,255,0.45)", fontStyle: "italic", whiteSpace: "pre-wrap" }}>
                          {liveThinking.text}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    {[0, 1, 2].map((i) => (
                      <Box
                        key={i}
                        sx={{
                          width: 5, height: 5, borderRadius: "50%", bgcolor: "#b6a0ff",
                          animation: "pulse 1.4s infinite", animationDelay: `${i * 0.2}s`,
                          "@keyframes pulse": { "0%,80%,100%": { opacity: 0.2 }, "40%": { opacity: 1 } },
                        }}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>
        </Box>

        {/* Notebooks referenciados */}
        {referencedIds.length > 0 && (
          <Box sx={{ px: 6, pb: 0.5 }}>
            <Box sx={{ maxWidth: 720, mx: "auto", display: "flex", gap: 0.5, flexWrap: "wrap" }}>
              {referencedIds.map((id) => {
                const nb = notebooks.find((n) => n.id === id);
                return nb ? (
                  <Chip
                    key={id}
                    label={`@${nb.title}`}
                    size="small"
                    onDelete={() => handleRemoveReference(id)}
                    sx={{
                      height: 24, fontSize: "0.72rem",
                      bgcolor: "rgba(182,160,255,0.1)", color: "#b6a0ff",
                      border: "1px solid rgba(182,160,255,0.2)",
                      "& .MuiChip-deleteIcon": { color: "#b6a0ff", fontSize: 14 },
                    }}
                  />
                ) : null;
              })}
            </Box>
          </Box>
        )}

        {/* Entrada */}
        <Box sx={{ px: 4, pt: 2, pb: 4, background: "linear-gradient(to top, #0e0e0e 70%, transparent)" }}>
          <Box sx={{ maxWidth: 720, mx: "auto" }}>
            <Box
              component="form"
              onSubmit={handleSubmit}
              sx={{
                bgcolor: "#262626", borderRadius: 9999,
                display: "flex", alignItems: "center", px: 1.5, height: 52,
                border: "1px solid rgba(72,72,71,0.1)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                transition: "box-shadow 0.3s",
                "&:focus-within": { boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 24px rgba(182,160,255,0.12)" },
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                disabled={isLoading}
                placeholder="Haz una pregunta sobre tus documentos..."
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  color: "#fff", fontFamily: "'Inter', sans-serif", fontSize: "0.88rem",
                }}
              />

              {otherNotebooks.length > 0 && (
                <Box
                  component="button"
                  type="button"
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => setAtAnchor(atAnchor ? null : e.currentTarget)}
                  sx={{
                    width: 32, height: 32, borderRadius: "50%",
                    bgcolor: "transparent", border: "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", flexShrink: 0, color: "#565555",
                    "&:hover": { color: "#b6a0ff" },
                  }}
                >
                  <AtIcon sx={{ fontSize: 18 }} />
                </Box>
              )}

              {/* Botón de enviar a la derecha */}
              <Box
                component="button"
                type="submit"
                disabled={isLoading || !input.trim()}
                sx={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: input.trim() ? "linear-gradient(135deg, #7e51ff, #b6a0ff)" : "transparent",
                  border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: input.trim() ? "pointer" : "default",
                  transition: "all 0.15s", flexShrink: 0, ml: 0.5,
                  "&:hover": input.trim() ? { transform: "scale(1.05)" } : {},
                  "&:active": input.trim() ? { transform: "scale(0.95)" } : {},
                }}
              >
                <SendIcon sx={{ fontSize: 16, color: input.trim() ? "#fff" : "#565555" }} />
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Popover de @ */}
        <Popover
          open={Boolean(atAnchor)}
          anchorEl={atAnchor}
          onClose={() => setAtAnchor(null)}
          anchorOrigin={{ vertical: "top", horizontal: "left" }}
          transformOrigin={{ vertical: "bottom", horizontal: "left" }}
          slotProps={{
            paper: {
              sx: {
                bgcolor: "#262626", border: "1px solid rgba(72,72,71,0.2)",
                borderRadius: "12px", p: 0.5, minWidth: 200,
                boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
              },
            },
          }}
        >
          <Typography sx={{ px: 2, py: 1, fontSize: "10px", color: "#adaaaa", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Referenciar conversación
          </Typography>
          {otherNotebooks.map((nb) => (
            <Box
              key={nb.id}
              onClick={() => handleAddReference(nb.id)}
              sx={{
                px: 2, py: 1.5, cursor: "pointer", borderRadius: "8px",
                display: "flex", alignItems: "center", gap: 1,
                "&:hover": { bgcolor: "rgba(255,255,255,0.05)" },
              }}
            >
              <AtIcon sx={{ fontSize: 14, color: "#b6a0ff" }} />
              <Typography sx={{ fontSize: "0.82rem" }}>{nb.title}</Typography>
              <Typography sx={{ fontSize: "0.7rem", color: "#565555", ml: "auto" }}>
                {nb.sourcesCount} fuentes
              </Typography>
            </Box>
          ))}
        </Popover>
      </Box>

      {/* Panel de inteligencia — se abre por mensaje */}
      <IntelligencePanel
        open={openPanelMsgId !== null}
        citations={openPanelMsgId ? citationsMap[openPanelMsgId] || [] : []}
        onClose={() => setOpenPanelMsgId(null)}
      />
    </>
  );
}

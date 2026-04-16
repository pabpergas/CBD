import { useState } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
} from "@mui/material";
import {
  Add as AddIcon,
  ChatBubbleOutline as ChatIcon,
  Delete as DeleteIcon,
  PictureAsPdf as PdfIcon,
  AudioFile as AudioIcon,
  VideoFile as VideoIcon,
  Image as ImageIcon,
  Description as TextIcon,
} from "@mui/icons-material";
import type { NotebookSummary, NotebookFull } from "../App";

const W = 288;

interface Props {
  notebooks: NotebookSummary[];
  activeNotebookId: string | null;
  activeNotebook: NotebookFull | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  onUploadComplete: () => void;
}

function FileIcon({ type }: { type: string }) {
  const sx = { fontSize: 14 };
  switch (type) {
    case "pdf": return <PdfIcon sx={{ ...sx, color: "#b6a0ff" }} />;
    case "audio": return <AudioIcon sx={{ ...sx, color: "#cfe6f2" }} />;
    case "video": return <VideoIcon sx={{ ...sx, color: "#ff97b8" }} />;
    case "image": return <ImageIcon sx={{ ...sx, color: "#34a853" }} />;
    default: return <TextIcon sx={{ ...sx, color: "#adaaaa" }} />;
  }
}

export default function NotebookSidebar({
  notebooks,
  activeNotebookId,
  activeNotebook,
  onSelect,
  onRefresh,
  onUploadComplete,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const res = await fetch("/api/notebooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    const nb = await res.json();
    setNewTitle("");
    setDialogOpen(false);
    onRefresh();
    onSelect(nb.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este notebook y todas sus fuentes?")) return;
    await fetch(`/api/notebooks/${id}`, { method: "DELETE" });
    onRefresh();
  };

  const handleFileUpload = async () => {
    if (!activeNotebookId) return;
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.ogg,.mp4,.webm,.txt";
    input.onchange = async () => {
      if (!input.files || input.files.length === 0) return;
      setUploading(true);
      const fd = new FormData();
      fd.append("notebookId", activeNotebookId);
      for (const f of Array.from(input.files)) fd.append("files", f);
      try {
        const res = await fetch("/api/ingest", { method: "POST", body: fd });
        if (!res.ok) throw new Error((await res.json()).error);
        onUploadComplete();
      } catch (err: any) {
        alert(`Error: ${err.message}`);
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  return (
    <>
      <Box
        sx={{
          width: W,
          flexShrink: 0,
          bgcolor: "#1a1a1a",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <Box sx={{ p: 2, display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Logotipo */}
          <Typography
            sx={{
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 800,
              fontSize: "1.1rem",
              letterSpacing: "-0.02em",
              px: 1,
              mb: 2,
            }}
          >
            CBD RAG
          </Typography>

          {/* Botón de nuevo chat */}
          <Box
            component="button"
            onClick={() => setDialogOpen(true)}
            sx={{
              width: "100%",
              bgcolor: "#262626",
              color: "#fff",
              border: "1px solid rgba(72,72,71,0.2)",
              fontWeight: 700,
              py: 1.5,
              px: 2,
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              mb: 4,
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              fontSize: "0.85rem",
              transition: "all 0.15s",
              "&:hover": { bgcolor: "#2c2c2c" },
              "&:active": { transform: "scale(0.97)" },
            }}
          >
            <AddIcon sx={{ fontSize: 18 }} />
            Nuevo chat
          </Box>

          {/* Conversaciones */}
          <Typography
            sx={{
              px: 2,
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 900,
              color: "#5143A3",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              mb: 2,
            }}
          >
            Conversaciones recientes
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, px: 1, overflow: "auto", flexGrow: 1 }}>
            {notebooks.map((nb) => {
              const active = nb.id === activeNotebookId;
              return (
                <Box
                  key={nb.id}
                  onClick={() => onSelect(nb.id)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 2,
                    py: 1.5,
                    borderRadius: 9999,
                    cursor: "pointer",
                    color: active ? "#fff" : "#adaaaa",
                    bgcolor: active ? "rgba(255,255,255,0.1)" : "transparent",
                    transition: "all 0.15s",
                    "&:hover": {
                      bgcolor: active ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
                      color: "#fff",
                    },
                  }}
                >
                  <ChatIcon sx={{ fontSize: 16, color: active ? "#b6a0ff" : undefined }} />
                  <Typography noWrap sx={{ fontSize: "0.82rem", flexGrow: 1 }}>
                    {nb.title}
                  </Typography>
                  {active && (
                    <Box
                      component="span"
                      onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDelete(nb.id); }}
                      sx={{
                        opacity: 0.3,
                        cursor: "pointer",
                        "&:hover": { opacity: 1 },
                        display: "flex",
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>

          {/* Sección de fuentes */}
          {activeNotebook && (
            <Box sx={{ borderTop: "1px solid rgba(72,72,71,0.1)", pt: 3, mt: "auto" }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, mb: 2 }}>
                <Typography
                  sx={{
                    fontFamily: "'Manrope', sans-serif",
                    color: "#adaaaa",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                  }}
                >
                  Fuentes
                </Typography>
                <Box
                  component="button"
                  onClick={handleFileUpload}
                  disabled={uploading}
                  sx={{
                    fontSize: "10px",
                    color: "#b6a0ff",
                    fontWeight: 700,
                    cursor: "pointer",
                    background: "none",
                    border: "none",
                    fontFamily: "'Inter', sans-serif",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  GESTIONAR
                </Box>
              </Box>
              {uploading && <LinearProgress sx={{ mx: 2, mb: 1, borderRadius: 1 }} />}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, px: 1, maxHeight: 160, overflow: "auto" }}>
                {activeNotebook.sources.map((s) => (
                  <Box
                    key={s.id}
                    sx={{
                      px: 2,
                      py: 1,
                      bgcolor: "rgba(32,32,31,0.5)",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      "&:hover": { bgcolor: "#2c2c2c" },
                      "& .delete-btn": { opacity: 0 },
                      "&:hover .delete-btn": { opacity: 0.5 },
                    }}
                  >
                    <FileIcon type={s.fileType} />
                    <Typography noWrap sx={{ fontSize: "11px", color: "#adaaaa", flex: 1 }}>
                      {s.fileName}
                    </Typography>
                    <Box
                      className="delete-btn"
                      component="span"
                      onClick={async (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (!confirm(`¿Eliminar "${s.fileName}"?`)) return;
                        await fetch(`/api/notebooks/${activeNotebookId}/sources/${s.id}`, { method: "DELETE" });
                        onUploadComplete();
                      }}
                      sx={{
                        display: "flex",
                        cursor: "pointer",
                        flexShrink: 0,
                        transition: "opacity 0.15s",
                        "&:hover": { opacity: "1 !important" },
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 12, color: "#ff6e84" }} />
                    </Box>
                  </Box>
                ))}
                {activeNotebook.sources.length === 0 && (
                  <Typography sx={{ px: 2, py: 1, fontSize: "11px", color: "#565555" }}>
                    Sin fuentes. Haz click en GESTIONAR.
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle sx={{ fontFamily: "'Manrope', sans-serif" }}>Nuevo notebook</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Nombre"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            sx={{
              background: "linear-gradient(135deg, #7e51ff, #b6a0ff)",
              "&:hover": { background: "linear-gradient(135deg, #6834eb, #a98fff)" },
            }}
          >
            Crear
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

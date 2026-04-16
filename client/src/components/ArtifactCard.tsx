import { useState } from "react";
import { Box, Typography, Collapse } from "@mui/material";
import {
  NorthEast as OpenIcon,
  ExpandMore as ExpandIcon,
} from "@mui/icons-material";

interface ArtifactData {
  success: boolean;
  id?: string;
  filename?: string;
  description?: string;
  mimeType?: string;
  size?: number;
  url?: string;
  error?: string;
}

interface Props {
  artifact: ArtifactData;
}

function getExt(filename?: string) {
  return filename?.split(".").pop()?.toUpperCase() || "FILE";
}

function getExtColor(filename?: string) {
  const ext = filename?.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "#ea4335";
  if (["png", "jpg", "jpeg", "svg", "webp"].includes(ext || "")) return "#34a853";
  if (["xlsx", "csv"].includes(ext || "")) return "#0f9d58";
  if (["docx", "doc"].includes(ext || "")) return "#4285f4";
  return "#b6a0ff";
}

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPreviewable(mime?: string, filename?: string) {
  const ext = filename?.split(".").pop()?.toLowerCase();
  return (
    mime?.includes("image") ||
    mime?.includes("pdf") ||
    ["png", "jpg", "jpeg", "svg", "pdf"].includes(ext || "")
  );
}

export default function ArtifactCard({ artifact }: Props) {
  const [open, setOpen] = useState(false);

  if (!artifact.success) {
    return (
      <Box sx={{ mt: 3, px: 2, py: 1.5, bgcolor: "#1a1a1a", borderRadius: "8px" }}>
        <Typography sx={{ fontSize: "0.78rem", color: "#ff6e84" }}>
          {artifact.error}
        </Typography>
      </Box>
    );
  }

  const ext = getExt(artifact.filename);
  const color = getExtColor(artifact.filename);
  const canPreview = isPreviewable(artifact.mimeType, artifact.filename);
  const isImage = artifact.mimeType?.includes("image");

  return (
    <Box sx={{ mt: 3 }}>
      {/* Fila compacta de archivo */}
      <Box
        onClick={() => canPreview && setOpen(!open)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          px: 2.5,
          py: 2,
          bgcolor: "#1a1a1a",
          borderRadius: open ? "12px 12px 0 0" : "12px",
          cursor: canPreview ? "pointer" : "default",
          transition: "background 0.15s",
          "&:hover": { bgcolor: "#1e1e24" },
        }}
      >
        {/* Insignia de extensión */}
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "8px",
            bgcolor: `${color}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Typography
            sx={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: "10px",
              fontWeight: 800,
              color,
              letterSpacing: "0.04em",
            }}
          >
            {ext}
          </Typography>
        </Box>

        {/* Información del archivo */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            noWrap
            sx={{ fontSize: "0.84rem", fontWeight: 500, color: "#e3e3e8" }}
          >
            {artifact.filename}
          </Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "#565555" }}>
            {artifact.description}
            {artifact.size ? ` · ${formatSize(artifact.size)}` : ""}
          </Typography>
        </Box>

        {/* Acciones a la derecha */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0 }}>
          {canPreview && (
            <ExpandIcon
              sx={{
                fontSize: 16,
                color: "#565555",
                transition: "transform 0.2s",
                transform: open ? "rotate(180deg)" : "rotate(0)",
              }}
            />
          )}
          <Box
            component="a"
            href={artifact.url}
            download={artifact.filename}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: 1.5,
              py: 0.5,
              borderRadius: "6px",
              bgcolor: "#262626",
              textDecoration: "none",
              color: "#adaaaa",
              fontSize: "0.7rem",
              fontWeight: 500,
              transition: "all 0.15s",
              "&:hover": { bgcolor: "#2c2c2c", color: "#fff" },
            }}
          >
            <OpenIcon sx={{ fontSize: 12 }} />
            Abrir
          </Box>
        </Box>
      </Box>

      {/* Vista previa */}
      <Collapse in={open}>
        <Box
          sx={{
            bgcolor: "#131313",
            borderRadius: "0 0 12px 12px",
            p: 1.5,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {isImage ? (
            <Box sx={{ maxHeight: 600, overflow: "auto", width: "100%", display: "flex", justifyContent: "center" }}>
              <img
                src={artifact.url}
                alt={artifact.filename}
                style={{
                  maxWidth: "100%",
                  borderRadius: 6,
                }}
              />
            </Box>
          ) : (
            <iframe
              src={artifact.url}
              title={artifact.filename}
              style={{
                width: "100%",
                height: 600,
                border: "none",
                borderRadius: 6,
                background: "#fff",
              }}
            />
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

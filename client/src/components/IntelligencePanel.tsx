import { Box, Typography, Drawer, IconButton } from "@mui/material";
import {
  Close as CloseIcon,
  FormatQuote as QuoteIcon,
  PictureAsPdf as PdfIcon,
  AudioFile as AudioIcon,
  Description as TextIcon,
} from "@mui/icons-material";
import type { Citation } from "../App";

const W = 380;

interface Props {
  open: boolean;
  citations: Citation[];
  onClose: () => void;
}

function SourceIcon({ type }: { type: string }) {
  const sx = { fontSize: 12, color: "#adaaaa" };
  switch (type) {
    case "pdf": return <PdfIcon sx={sx} />;
    case "audio": return <AudioIcon sx={sx} />;
    default: return <TextIcon sx={sx} />;
  }
}

export default function IntelligencePanel({ open, citations, onClose }: Props) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        "& .MuiDrawer-paper": {
          width: W,
          bgcolor: "#1a1a1a",
          border: "none",
          borderLeft: "1px solid rgba(72,72,71,0.1)",
        },
      }}
    >
      <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3, height: "100%" }}>
        {/* Cabecera */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography
              sx={{
                fontFamily: "'Manrope', sans-serif",
                fontSize: "0.82rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                mb: 0.25,
              }}
            >
              Inteligencia
            </Typography>
            <Typography sx={{ color: "#adaaaa", fontSize: "0.72rem" }}>
              {citations.length} resultado{citations.length !== 1 ? "s" : ""} recuperado{citations.length !== 1 ? "s" : ""} de la búsqueda
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: "#adaaaa" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Citas */}
        <Box sx={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {citations.map((c, i) => (
            <Box
              key={i}
              sx={{
                bgcolor: "#262626",
                borderRadius: "16px",
                p: 2.5,
                border: "1px solid rgba(72,72,71,0.2)",
                transition: "all 0.2s",
                "&:hover": { borderColor: "rgba(182,160,255,0.4)" },
              }}
            >
              {/* Puntuación */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                <Typography
                  sx={{
                    fontSize: "9px",
                    fontWeight: 700,
                    color: "#b6a0ff",
                    bgcolor: "rgba(182,160,255,0.1)",
                    px: 1,
                    py: 0.5,
                    borderRadius: "4px",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {(c.score * 100).toFixed(1)}% Coincidencia
                </Typography>
                {c.chunkIndex !== undefined && (
                  <Typography sx={{ fontSize: "9px", color: "#565555", fontFamily: "monospace" }}>
                    Fragmento {c.chunkIndex}/{c.totalChunks}
                  </Typography>
                )}
              </Box>

              {/* Texto citado */}
              <Box sx={{ pl: 1.5, borderLeft: "2px solid rgba(182,160,255,0.3)", mb: 2 }}>
                <Typography
                  sx={{
                    fontSize: "11px",
                    lineHeight: 1.7,
                    color: "#fff",
                    fontStyle: "italic",
                    display: "-webkit-box",
                    WebkitLineClamp: 5,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  &ldquo;{c.text.slice(0, 300)}{c.text.length > 300 ? "..." : ""}&rdquo;
                </Typography>
              </Box>

              {/* Fuente */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, pt: 1.5, borderTop: "1px solid rgba(72,72,71,0.1)" }}>
                <SourceIcon type={c.fileType} />
                <Typography sx={{ fontSize: "10px", color: "#adaaaa", flexGrow: 1 }} noWrap>
                  {c.fileName}
                </Typography>
                {c.notebook && (
                  <Typography sx={{ fontSize: "9px", color: "#b6a0ff" }}>
                    @{c.notebook}
                  </Typography>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Drawer>
  );
}

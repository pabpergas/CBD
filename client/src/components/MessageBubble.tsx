import { useState, useEffect } from "react";
import { Box, Typography, Chip, Collapse } from "@mui/material";
import {
  Bolt as BoltIcon,
  Link as LinkIcon,
  Psychology as ThinkIcon,
  ExpandMore as ExpandIcon,
  AutoAwesome as SparkleIcon,
} from "@mui/icons-material";
import type { UIMessage } from "ai";
import type { Citation } from "../App";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ArtifactCard from "./ArtifactCard";

interface Props {
  message: UIMessage;
  citations?: Citation[];
  artifacts?: any[];
  onOpenIntelligence?: () => void;
}

export default function MessageBubble({ message, citations, artifacts: sseArtifacts, onOpenIntelligence }: Props) {
  const isUser = message.role === "user";

  const textContent = message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");

  const reasoningParts = message.parts.filter(
    (p: any) => p.type === "reasoning"
  ) as unknown as Array<{ type: "reasoning"; text: string; state?: string }>;

  const reasoningText = reasoningParts.map((p) => p.text).join("");
  const isThinking = reasoningParts.some((p) => p.state === "streaming");
  const hasThinking = reasoningText.length > 0;

  const toolParts = message.parts.filter(
    (p: any) => p.type === "tool-invocation"
  ) as unknown as Array<{
    type: "tool-invocation";
    toolInvocation: { toolName: string; state: string; result?: any };
  }>;

  // Extraer artefactos de los resultados de la herramienta createArtifact
  const artifacts = toolParts
    .filter(
      (tp) =>
        tp.toolInvocation.toolName === "createArtifact" &&
        tp.toolInvocation.state === "result" &&
        tp.toolInvocation.result
    )
    .map((tp) => tp.toolInvocation.result);

  const [thinkingOpen, setThinkingOpen] = useState(false);

  // Abrir automáticamente mientras se transmite el pensamiento, cerrar cuando comienza el texto
  useEffect(() => {
    if (isThinking) {
      setThinkingOpen(true);
    } else if (textContent && hasThinking) {
      setThinkingOpen(false);
    }
  }, [isThinking, textContent, hasThinking]);

  if (isUser) {
    return (
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 6 }}>
        <Box
          sx={{
            bgcolor: "#262626",
            px: 3,
            py: 2,
            borderRadius: "16px 16px 4px 16px",
            maxWidth: "85%",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <Typography sx={{ fontSize: "0.95rem", lineHeight: 1.6 }}>
            {textContent}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 6 }}>
      {/* Cabecera del modelo */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
        <Box
          sx={{
            width: 24, height: 24, borderRadius: "50%",
            background: "linear-gradient(135deg, #b6a0ff, #ff97b8)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <BoltIcon sx={{ fontSize: 14, color: "#340090" }} />
        </Box>
        <Typography
          sx={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: "0.82rem",
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          Asistente
        </Typography>
        {toolParts.length > 0 && (
          <Chip
            label="MODO RECUPERACIÓN"
            size="small"
            sx={{
              height: 20, fontSize: "9px", fontWeight: 700,
              bgcolor: "#262626", color: "#adaaaa", letterSpacing: "0.08em",
            }}
          />
        )}
      </Box>

      {/* Bloque de pensamiento */}
      {hasThinking && (
        <Box sx={{ mb: 2 }}>
          <Box
            onClick={() => setThinkingOpen(!thinkingOpen)}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.5,
              py: 0.75,
              borderRadius: "8px",
              cursor: "pointer",
              bgcolor: "rgba(182,160,255,0.06)",
              border: "1px solid rgba(182,160,255,0.12)",
              transition: "all 0.2s",
              "&:hover": {
                bgcolor: "rgba(182,160,255,0.1)",
                borderColor: "rgba(182,160,255,0.25)",
              },
            }}
          >
            <ThinkIcon
              sx={{
                fontSize: 15,
                color: "#b6a0ff",
                animation: isThinking ? "pulse-think 1.5s ease-in-out infinite" : "none",
                "@keyframes pulse-think": {
                  "0%, 100%": { opacity: 0.5 },
                  "50%": { opacity: 1 },
                },
              }}
            />
            <Typography
              sx={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#b6a0ff",
                letterSpacing: "0.02em",
              }}
            >
              {isThinking ? "Pensando..." : "Pensado"}
            </Typography>
            <ExpandIcon
              sx={{
                fontSize: 16,
                color: "#b6a0ff",
                transition: "transform 0.2s",
                transform: thinkingOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </Box>

          <Collapse in={thinkingOpen} timeout={300}>
            <Box
              sx={{
                mt: 1,
                ml: 0.5,
                pl: 2,
                borderLeft: "2px solid rgba(182,160,255,0.15)",
                maxHeight: 300,
                overflow: "auto",
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.78rem",
                  lineHeight: 1.7,
                  color: "rgba(182,160,255,0.5)",
                  fontStyle: "italic",
                  whiteSpace: "pre-wrap",
                }}
              >
                {reasoningText}
              </Typography>
            </Box>
          </Collapse>
        </Box>
      )}

      {/* Texto de respuesta */}
      {textContent && (
        <Typography
          component="div"
          sx={{
            color: "#adaaaa",
            lineHeight: 1.9,
            fontSize: "0.92rem",
            "& p": { m: 0 },
            "& p + p": { mt: 3 },
            "& ul, & ol": {
              listStyle: "none",
              ml: 1, pl: 3, my: 2,
              borderLeft: "2px solid #262626",
              "& li": { mb: 2 },
            },
            "& strong": { color: "#fff" },
            "& code": {
              bgcolor: "rgba(182,160,255,0.08)",
              color: "#b6a0ff",
              px: 0.75, py: 0.25,
              borderRadius: "4px",
              fontSize: "0.85em",
              fontFamily: "monospace",
            },
            "& pre": {
              bgcolor: "#131313",
              p: 2.5,
              borderRadius: "12px",
              overflow: "auto",
              my: 2,
              "& code": { bgcolor: "transparent", p: 0, color: "#adaaaa" },
            },
            "& blockquote": {
              borderLeft: "2px solid #b6a0ff",
              pl: 2.5, ml: 0, my: 2,
              color: "#adaaaa",
            },
            "& table": {
              width: "100%",
              borderCollapse: "collapse",
              my: 2,
              fontSize: "0.84rem",
            },
            "& thead": {
              borderBottom: "2px solid #262626",
            },
            "& th": {
              textAlign: "left",
              py: 1,
              px: 1.5,
              color: "#fff",
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 700,
              fontSize: "0.78rem",
              letterSpacing: "0.02em",
            },
            "& td": {
              py: 1,
              px: 1.5,
              borderBottom: "1px solid rgba(72,72,71,0.15)",
            },
            "& tr:last-child td": {
              borderBottom: "none",
            },
            "& tr:hover td": {
              bgcolor: "rgba(255,255,255,0.02)",
            },
            "& tbody tr:nth-of-type(even) td": {
              bgcolor: "rgba(255,255,255,0.01)",
            },
            "& hr": {
              border: "none",
              borderTop: "1px solid rgba(72,72,71,0.15)",
              my: 3,
            },
            "& del": {
              color: "#565555",
            },
            "& a": {
              color: "#e3e3e8",
              textDecoration: "underline",
              textDecorationColor: "rgba(255,255,255,0.2)",
              textUnderlineOffset: "2px",
              "&:hover": {
                color: "#fff",
                textDecorationColor: "rgba(255,255,255,0.5)",
              },
            },
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{textContent}</ReactMarkdown>
        </Typography>
      )}

      {/* Artefactos (desde SSE o resultados de herramientas) */}
      {(sseArtifacts && sseArtifacts.length > 0
        ? sseArtifacts.map((art, i) => (
            <ArtifactCard key={`sse-${i}`} artifact={{ success: true, ...art }} />
          ))
        : artifacts.map((art, i) => (
            <ArtifactCard key={`tool-${i}`} artifact={art} />
          ))
      )}

      {/* Botón de inteligencia */}
      {citations && citations.length > 0 && onOpenIntelligence && (
        <Box sx={{ mt: 3 }}>
          <Box
            onClick={onOpenIntelligence}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              px: 2,
              py: 1,
              borderRadius: "10px",
              cursor: "pointer",
              bgcolor: "rgba(182,160,255,0.06)",
              border: "1px solid rgba(182,160,255,0.12)",
              transition: "all 0.2s",
              "&:hover": {
                bgcolor: "rgba(182,160,255,0.12)",
                borderColor: "rgba(182,160,255,0.3)",
                transform: "translateX(2px)",
              },
            }}
          >
            <SparkleIcon sx={{ fontSize: 14, color: "#b6a0ff" }} />
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#b6a0ff" }}>
              {citations.length} fuente{citations.length !== 1 ? "s" : ""} consultada{citations.length !== 1 ? "s" : ""}
            </Typography>
            <ExpandIcon sx={{ fontSize: 14, color: "#b6a0ff", transform: "rotate(-90deg)" }} />
          </Box>
        </Box>
      )}
    </Box>
  );
}

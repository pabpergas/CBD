import { Router } from "express";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { EventEmitter } from "events";
import { embedQuery } from "../services/embedding.js";
import { searchSimilar, getCollectionInfo } from "../services/qdrant.js";
import { executeArtifact, convertArtifact, reviewArtifactVisually, getArtifactPath } from "../services/artifactService.js";
import {
  getNotebook,
  getCollectionName,
  addMessage,
} from "../services/notebookStore.js";
import { config } from "../config.js";

const router = Router();
const google = createGoogleGenerativeAI({ apiKey: config.googleApiKey });

// Emisor SSE: emite citations por notebook en tiempo real
const citationsBus = new EventEmitter();
citationsBus.setMaxListeners(50);

// Endpoint SSE — el cliente se suscribe para recibir citations a medida que se encuentran
router.get("/citations-stream/:notebookId", (req, res) => {
  const { notebookId } = req.params;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write("data: {\"type\":\"connected\"}\n\n");

  const onCitations = (data: any) => {
    res.write(`data: ${JSON.stringify({ type: "citations", citations: data })}\n\n`);
  };
  const onArtifact = (data: any) => {
    res.write(`data: ${JSON.stringify({ type: "artifact", artifact: data })}\n\n`);
  };
  const onThinking = (data: any) => {
    res.write(`data: ${JSON.stringify({ type: "thinking", ...data })}\n\n`);
  };
  const onToolCall = (data: any) => {
    res.write(`data: ${JSON.stringify({ type: "toolcall", ...data })}\n\n`);
  };

  citationsBus.on(`citations:${notebookId}`, onCitations);
  citationsBus.on(`artifact:${notebookId}`, onArtifact);
  citationsBus.on(`thinking:${notebookId}`, onThinking);
  citationsBus.on(`toolcall:${notebookId}`, onToolCall);

  req.on("close", () => {
    citationsBus.off(`citations:${notebookId}`, onCitations);
    citationsBus.off(`artifact:${notebookId}`, onArtifact);
    citationsBus.off(`thinking:${notebookId}`, onThinking);
    citationsBus.off(`toolcall:${notebookId}`, onToolCall);
  });
});

// Endpoint de chat
router.post("/", async (req, res) => {
  try {
    const { messages, notebookId, referencedNotebookIds } = req.body;

    console.log("[chat] notebookId:", notebookId, "referencedNotebookIds:", referencedNotebookIds);

    if (!messages || messages.length === 0) {
      res.status(400).json({ error: "No se han proporcionado mensajes" });
      return;
    }

    const notebook = getNotebook(notebookId);
    const collectionName = notebook
      ? getCollectionName(notebookId)
      : "default";

    // Construir colecciones buscables (propias + referenciadas)
    const searchCollections: { name: string; notebookTitle: string }[] = [];
    if (notebook) {
      searchCollections.push({ name: collectionName, notebookTitle: notebook.title });
    }
    if (referencedNotebookIds) {
      for (const refId of referencedNotebookIds as string[]) {
        const refNb = getNotebook(refId);
        if (refNb) {
          searchCollections.push({
            name: getCollectionName(refId),
            notebookTitle: refNb.title,
          });
        }
      }
    }

    const sourcesList = notebook
      ? notebook.sources.map((s) => `- ${s.fileName} (${s.fileType})`).join("\n")
      : "Sin fuentes cargadas";

    // Construir lista de IDs de notebooks referenciados para la herramienta
    const refIds: string[] = (referencedNotebookIds as string[] | undefined) || [];

    // Guardar mensaje del usuario
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    if (lastUserMsg && notebookId) {
      const textContent = lastUserMsg.parts
        ? lastUserMsg.parts.filter((p: any) => p.type === "text").map((p: any) => p.text).join("")
        : lastUserMsg.content || "";
      if (textContent) {
        addMessage(notebookId, {
          id: uuidv4(),
          role: "user",
          content: textContent,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Acumuladores para las citations y artefactos de esta respuesta
    const responseCitations: any[] = [];
    const responseArtifacts: any[] = [];

    const result = streamText({
      model: google(config.llmModel),
      system: `Eres un asistente inteligente de RAG (Retrieval-Augmented Generation) que ayuda a los usuarios a consultar sus documentos almacenados en una base de datos vectorial (Qdrant).

Notebook activo: "${notebook?.title || "Sin título"}"
Fuentes disponibles:
${sourcesList}
${refIds.length > 0 ? `\nNOTEBOOKS REFERENCIADOS (el usuario los añadió con @, DEBES consultar sus datos con las herramientas):\n${refIds.map((id) => { const nb = getNotebook(id); return nb ? `- "${nb.title}" (${nb.sources.length} fuentes, ${(nb.messages || []).length} mensajes)` : ""; }).filter(Boolean).join("\n")}` : ""}

INSTRUCCIONES:
- Cuando el usuario haga una pregunta sobre sus documentos, usa "searchDocuments" para buscar información relevante.
- Puedes hacer múltiples búsquedas con diferentes queries si necesitas más contexto.
- Usa "getNotebookInfo" para ver detalles del notebook y sus fuentes.
- IMPORTANTE: Si hay notebooks referenciados (listados arriba), SIEMPRE usa "getConversationHistory" para consultar su historial cuando el usuario pregunte sobre lo que se dijo, preguntó, o cualquier referencia a conversaciones previas. No digas que no tienes información sin antes llamar a esta herramienta.
- Cita siempre las fuentes (nombre de archivo) cuando respondas con información de los documentos.
- Si no encuentras información relevante tras usar las herramientas, díselo al usuario.
- Responde en el mismo idioma que el usuario.

CREACIÓN DE ARTEFACTOS:
Puedes crear archivos usando "createArtifact" con código Python. Librerías disponibles:
- reportlab → PDFs (from reportlab.lib.pagesizes import letter; from reportlab.pdfgen import canvas)
- python-docx → Word .docx (from docx import Document)
- openpyxl → Excel .xlsx (from openpyxl import Workbook)
- matplotlib + numpy → Gráficas (import matplotlib.pyplot as plt; plt.savefig('/tmp/output/grafica.png'))
- pandas → Tablas y análisis de datos
- Pillow → Imágenes

REGLAS ESTRICTAS para artefactos:
- NUNCA insertes imágenes en markdown (![](url) o <img>). NO tienes acceso a URLs de archivos locales.
- SIEMPRE usa la herramienta "createArtifact" para generar cualquier archivo (gráfica, PDF, documento, etc). El sistema se encarga de mostrarlo al usuario.
- El código Python SIEMPRE debe guardar el archivo en /tmp/output/{filename}
- Para documentos LARGOS (informes, redacciones, PDFs con contenido): OBLIGATORIO pasar todo el texto/datos en el campo "context" como JSON. En el código Python lee con: import json; data = json.load(open('/tmp/output/_context.json', 'r', encoding='utf-8'))
- NUNCA generes un PDF vacío o con placeholder. Si el usuario pide un documento, primero usa searchDocuments para obtener TODO el contenido, luego pasa ese contenido completo en "context" y genera un documento con texto real y sustancial.
- Puedes combinar herramientas: primero busca datos con searchDocuments, luego usa createArtifact para crear visualizaciones con esos datos.
- Si el usuario pide una gráfica, tabla, documento, etc: primero obtén los datos necesarios, luego genera el artefacto.
- Para matplotlib: plt.savefig('/tmp/output/nombre.png', dpi=150, bbox_inches='tight')
- Para PDFs con texto largo: USA python-docx y convierte a PDF. reportlab NO gestiona bien el flujo de texto en múltiples páginas. Ejemplo para un documento largo:
  from docx import Document; from docx.shared import Pt, Inches
  doc = Document()
  doc.add_heading('Título', 0)
  doc.add_paragraph('Contenido...') # el texto se distribuye automáticamente en páginas
  doc.save('/tmp/output/nombre.docx')
- Para reportlab: SOLO para gráficos, diagramas o layouts muy específicos. NO para texto largo.
- Para openpyxl: workbook.save('/tmp/output/nombre.xlsx')
- IMPORTANTE: cuando generes documentos con contenido de fuentes, incluye TODO el texto relevante, no resúmenes ni placeholders. El usuario espera un documento completo y profesional.
- FLUJO para IMÁGENES (gráficas matplotlib, diagramas, PNG/JPG):
  1. Llama "createArtifact" con el código que genera la imagen en /tmp/output/{nombre}.png
  2. El archivo se entrega al usuario AUTOMÁTICAMENTE al terminar createArtifact — NO llames reviewDocument para imágenes.
- FLUJO OBLIGATORIO para DOCUMENTOS Office (.docx, .xlsx):
  1. Crea el documento con "createArtifact" (genera .docx) — el usuario NO lo ve todavía
  2. Llama "reviewDocument" — renderiza a imagen, otro modelo lo revisa visualmente
  3. Si approved=false: lee la revisión, corrige el código, vuelve al paso 1
  4. Si approved=true: el PDF se genera y se envía AUTOMÁTICAMENTE al usuario
  5. Repite el ciclo crear→revisar hasta que esté aprobado (máximo 10 intentos)
- Tras crear el artefacto, describe brevemente lo que se generó en texto. El archivo aparecerá automáticamente en el chat.`,
      messages: await convertToModelMessages(messages),
      tools: {
        searchDocuments: {
          description:
            "Busca documentos similares a una consulta semántica en las fuentes del notebook y notebooks referenciados.",
          inputSchema: z.object({
            query: z.string().describe("La consulta de búsqueda semántica"),
            limit: z
              .number()
              .optional()
              .describe("Número máximo de resultados (por defecto 5)"),
          }),
          execute: async ({
            query,
            limit,
          }: {
            query: string;
            limit?: number;
          }) => {
            const queryVector = await embedQuery(query);
            const allResults: any[] = [];

            for (const col of searchCollections) {
              try {
                const results = await searchSimilar(
                  col.name,
                  queryVector,
                  limit || config.topK
                );
                for (const r of results) {
                  allResults.push({
                    score: r.score,
                    fileName: (r.payload as any)?.fileName || "desconocido",
                    fileType: (r.payload as any)?.fileType || "unknown",
                    text: (r.payload as any)?.text || "",
                    chunkIndex: (r.payload as any)?.chunkIndex,
                    totalChunks: (r.payload as any)?.totalChunks,
                    notebook: col.notebookTitle,
                  });
                }
              } catch {
                // La colección podría no existir aún
              }
            }

            allResults.sort((a, b) => b.score - a.score);
            const topResults = allResults.slice(0, limit || config.topK);

            // Acumular + enviar via SSE
            responseCitations.push(...topResults);
            if (notebookId) {
              citationsBus.emit(`citations:${notebookId}`, topResults);
            }

            return topResults;
          },
        },

        getNotebookInfo: {
          description:
            "Obtiene información sobre el notebook activo: fuentes cargadas, número de puntos vectoriales, estado.",
          inputSchema: z.object({}),
          execute: async () => {
            try {
              const info = await getCollectionInfo(collectionName);
              return {
                title: notebook?.title,
                sourcesCount: notebook?.sources.length || 0,
                sources: notebook?.sources.map((s) => ({
                  fileName: s.fileName,
                  fileType: s.fileType,
                  chunksCount: s.chunksCount,
                })),
                pointsCount: info.points_count,
                status: info.status,
              };
            } catch {
              return {
                title: notebook?.title,
                sourcesCount: notebook?.sources.length || 0,
                sources: notebook?.sources.map((s) => ({
                  fileName: s.fileName,
                  fileType: s.fileType,
                  chunksCount: s.chunksCount,
                })),
                pointsCount: 0,
                status: "empty",
              };
            }
          },
        },

        getConversationHistory: {
          description:
            "Recupera el historial de conversación de un notebook referenciado. Usa esta herramienta cuando el usuario pregunte sobre lo que se habló, preguntó o respondió en otro notebook.",
          inputSchema: z.object({
            notebookTitle: z
              .string()
              .optional()
              .describe(
                "Título del notebook del que recuperar la conversación. Si no se especifica, busca en todos los referenciados."
              ),
            lastN: z
              .number()
              .optional()
              .describe("Número de mensajes recientes a recuperar (por defecto 30)"),
          }),
          execute: async ({
            notebookTitle,
            lastN,
          }: {
            notebookTitle?: string;
            lastN?: number;
          }) => {
            const limit = lastN || 30;
            const results: { notebook: string; messages: { role: string; content: string; timestamp: string }[] }[] = [];

            // Buscar en notebooks referenciados + notebook actual
            const idsToSearch = [...refIds];
            if (notebookId && !idsToSearch.includes(notebookId)) {
              idsToSearch.push(notebookId);
            }

            for (const id of idsToSearch) {
              const nb = getNotebook(id);
              if (!nb) continue;
              if (notebookTitle && !nb.title.toLowerCase().includes(notebookTitle.toLowerCase())) continue;

              const msgs = (nb.messages || []).slice(-limit).map((m) => ({
                role: m.role === "user" ? "Usuario" : "Asistente",
                content: m.content,
                timestamp: m.timestamp,
              }));

              if (msgs.length > 0) {
                results.push({ notebook: nb.title, messages: msgs });
              }
            }

            if (results.length === 0) {
              return { found: false, message: "No se encontró historial de conversación en los notebooks referenciados." };
            }

            return { found: true, conversations: results };
          },
        },

        createArtifact: {
          description:
            "Genera un artefacto ejecutando código Python. NO se muestra al usuario hasta que reviewDocument lo apruebe. El código DEBE guardar el archivo en /tmp/output/{filename}.",
          inputSchema: z.object({
            code: z
              .string()
              .describe(
                "Código Python completo. Guardar en /tmp/output/{filename}. Leer datos largos de /tmp/output/_context.json. Librerías: reportlab, python-docx, openpyxl, matplotlib, pandas, numpy, Pillow."
              ),
            filename: z
              .string()
              .describe("Nombre del archivo con extensión, ej: 'informe.docx', 'grafica.png'"),
            description: z
              .string()
              .describe("Descripción corta del artefacto"),
            context: z
              .record(z.any())
              .optional()
              .describe(
                "Datos JSON accesibles en /tmp/output/_context.json. OBLIGATORIO para contenido largo."
              ),
          }),
          execute: async ({
            code,
            filename,
            description,
            context,
          }: {
            code: string;
            filename: string;
            description: string;
            context?: Record<string, unknown>;
          }) => {
            try {
              const result = await executeArtifact(code, filename, description, context);
              // Imágenes (gráficas matplotlib, etc.) se entregan directamente al cliente.
              // Documentos Office esperan aprobación de reviewDocument antes de convertirse a PDF y emitirse.
              const isImage = (result.mimeType || "").startsWith("image/");
              if (isImage) {
                responseArtifacts.push(result);
                if (notebookId) {
                  citationsBus.emit(`artifact:${notebookId}`, result);
                }
              }
              return { success: true, ...result };
            } catch (error: any) {
              return { success: false, error: error.message };
            }
          },
        },

        reviewDocument: {
          description:
            "Renderiza un documento a imagen y lo revisa visualmente con otro Gemini. Si approved=true, el documento se envía automáticamente al usuario. Si approved=false, debes corregir con createArtifact y volver a llamar reviewDocument. SIEMPRE usar después de createArtifact.",
          inputSchema: z.object({
            artifactId: z
              .string()
              .describe("ID del artefacto (devuelto por createArtifact)"),
            instructions: z
              .string()
              .optional()
              .describe("Instrucciones para la revisión"),
          }),
          execute: async ({
            artifactId,
            instructions,
          }: {
            artifactId: string;
            instructions?: string;
          }) => {
            try {
              const review = await reviewArtifactVisually(artifactId, instructions);

              if (review.approved) {
                // Aprobado → convertir a PDF y enviar al usuario
                try {
                  const pdf = await convertArtifact(artifactId, "pdf");
                  responseArtifacts.push(pdf);
                  if (notebookId) {
                    citationsBus.emit(`artifact:${notebookId}`, pdf);
                  }
                  return { ...review, deliveredAsPdf: true, artifact: pdf };
                } catch {
                  // Si falla la conversión a PDF, enviar el original
                  const origPath = getArtifactPath(artifactId);
                  if (origPath) {
                    const result = { id: artifactId, filename: "documento", description: "Documento aprobado", mimeType: "application/octet-stream", size: 0, url: `/api/artifacts/${artifactId}` };
                    responseArtifacts.push(result);
                    if (notebookId) citationsBus.emit(`artifact:${notebookId}`, result);
                    return { ...review, deliveredAsOriginal: true, artifact: result };
                  }
                  return { ...review, deliveryFailed: true };
                }
              }

              // No aprobado → devolver la revisión para que la IA corrija
              return review;
            } catch (error: any) {
              return { review: `Error: ${error.message}`, approved: false };
            }
          },
        },
      },
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingLevel: "low",
            includeThoughts: true,
          },
        },
      },
      stopWhen: stepCountIs(50),
      maxOutputTokens: 65536,
      abortSignal: AbortSignal.timeout(300_000), // 5 min máx
      onStepFinish: (step: any) => {
        // Emitir thinking y tool calls por SSE
        if (notebookId) {
          if (step.reasoningText) {
            citationsBus.emit(`thinking:${notebookId}`, {
              text: step.reasoningText,
              done: true,
            });
          }
          if (step.toolCalls && step.toolCalls.length > 0) {
            for (const tc of step.toolCalls) {
              citationsBus.emit(`toolcall:${notebookId}`, {
                toolName: tc.toolName,
                args: tc.args,
              });
            }
          }
        }
      },
      onFinish: ({ text }) => {
        if (notebookId && text) {
          addMessage(notebookId, {
            id: uuidv4(),
            role: "assistant",
            content: text,
            timestamp: new Date().toISOString(),
            citations: responseCitations.length > 0 ? responseCitations : undefined,
            artifacts: responseArtifacts.length > 0 ? responseArtifacts : undefined,
          });
        }
      },
      onError: ({ error }) => {
        console.error("Error en streamText(chat):", error);
      },
    });

    result.pipeTextStreamToResponse(res);
  } catch (error: any) {
    console.error("Error en chat:", error);
    res.status(500).json({ error: error?.message || "Error interno" });
  }
});

export default router;

import pdf from "pdf-parse";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { chunkText } from "./chunking.js";
import { embedText, embedFile, transcribeAudio } from "./embedding.js";
import { ensureCollection, upsertPoints } from "./qdrant.js";

export interface ProcessResult {
  collection: string;
  fileName: string;
  pointsInserted: number;
  extractedText: string;
}

const MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/mpeg",
  "video/mov",
];

const AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
];

// Extensiones tratadas como texto aunque el MIME detectado sea application/*.
// Cubre código fuente y formatos de configuración típicos en proyectos.
const TEXT_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "json", "jsonc", "yaml", "yml", "toml", "ini", "env",
  "md", "mdx", "txt", "log", "csv", "tsv",
  "html", "htm", "css", "scss", "sass", "less",
  "py", "rb", "go", "rs", "java", "kt", "swift",
  "c", "h", "cpp", "hpp", "cc", "cs",
  "php", "sh", "bash", "zsh", "fish", "ps1",
  "sql", "graphql", "gql", "proto",
  "dockerfile", "gitignore", "dockerignore", "editorconfig",
  "xml", "svg", "vue", "svelte", "astro",
]);

function isProbablyText(filePath: string): boolean {
  // Heurística: sin bytes nulos en los primeros 8 KB → probablemente texto
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(8192);
    const bytes = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    for (let i = 0; i < bytes; i++) if (buf[i] === 0) return false;
    return true;
  } catch {
    return false;
  }
}

export async function processFile(
  filePath: string,
  originalName: string,
  mimeType: string,
  collection: string
): Promise<ProcessResult> {
  await ensureCollection(collection);

  if (mimeType === "application/pdf") {
    return processPdf(filePath, originalName, collection);
  }

  if (AUDIO_TYPES.includes(mimeType)) {
    return processAudio(filePath, originalName, mimeType, collection);
  }

  if (MEDIA_TYPES.includes(mimeType)) {
    return processMedia(filePath, originalName, mimeType, collection);
  }

  if (mimeType.startsWith("text/")) {
    return processPlainText(filePath, originalName, collection);
  }

  // Fallback: extensiones de código/config o archivos sin extensión que parecen texto
  const base = originalName.split("/").pop() || originalName;
  const ext = base.includes(".") ? base.split(".").pop()!.toLowerCase() : base.toLowerCase();
  if (TEXT_EXTENSIONS.has(ext) || isProbablyText(filePath)) {
    return processPlainText(filePath, originalName, collection);
  }

  throw new Error(`Tipo de archivo no soportado: ${mimeType}`);
}

async function processPdf(
  filePath: string,
  originalName: string,
  collection: string
): Promise<ProcessResult> {
  const buffer = fs.readFileSync(filePath);
  const points: { id: string; vector: number[]; payload: Record<string, unknown> }[] = [];

  // 1. Embeder el PDF completo directamente como binario (multimodal, máx 6 páginas)
  try {
    const vector = await embedFile(filePath, "application/pdf");
    points.push({
      id: uuidv4(),
      vector,
      payload: {
        text: `[PDF completo] ${originalName}`,
        fileName: originalName,
        fileType: "pdf",
        chunkIndex: 0,
        isFullDocument: true,
      },
    });
  } catch {
    // Si el embedding directo falla (ej. demasiadas páginas), continuar con chunking de texto
  }

  // 2. También extraer texto y chunkear para recuperación granular
  const data = await pdf(buffer);
  if (data.text.trim().length > 0) {
    const chunks = chunkText(data.text);
    const embeddings = await embedText(chunks, originalName);

    for (let i = 0; i < chunks.length; i++) {
      points.push({
        id: uuidv4(),
        vector: embeddings[i],
        payload: {
          text: chunks[i],
          fileName: originalName,
          fileType: "pdf",
          chunkIndex: i + 1,
          totalChunks: chunks.length,
          isFullDocument: false,
        },
      });
    }
  }

  await upsertPoints(collection, points);
  const extractedText = data.text.trim().slice(0, 5000);
  return { collection, fileName: originalName, pointsInserted: points.length, extractedText };
}

/**
 * Procesamiento de audio:
 * 1. Intentar embedding directo por inlineData (funciona para audio ≤80s)
 * 2. Si falla, transcribir con LLM via Files API → chunkear → embeder como texto
 */
async function processAudio(
  filePath: string,
  originalName: string,
  mimeType: string,
  collection: string
): Promise<ProcessResult> {
  const normalizedMime = mimeType === "audio/mp3" ? "audio/mpeg" : mimeType;

  // Intentar embedding directo primero (audio corto ≤80s)
  try {
    console.log(`[ingest] Intentando embedding directo de audio: ${originalName}`);
    const vector = await embedFile(filePath, normalizedMime);

    const point = {
      id: uuidv4(),
      vector,
      payload: {
        text: `[audio] ${originalName}`,
        fileName: originalName,
        fileType: "audio",
        mimeType,
        embeddingSource: "binary",
      },
    };

    await upsertPoints(collection, [point]);
    return { collection, fileName: originalName, pointsInserted: 1, extractedText: `[audio embedding directo] ${originalName}` };
  } catch (directError: any) {
    console.log(
      `[ingest] Embedding directo falló para "${originalName}": ${directError?.message || directError}. Usando transcripción...`
    );
  }

  // Respaldo: transcribir con LLM → chunkear → embeder como texto
  const transcription = await transcribeAudio(filePath, normalizedMime);

  if (!transcription.trim()) {
    throw new Error(`No se pudo obtener transcripción de "${originalName}"`);
  }

  const chunks = chunkText(transcription);
  const embeddings = await embedText(chunks, originalName);

  const points = chunks.map((chunk, i) => ({
    id: uuidv4(),
    vector: embeddings[i],
    payload: {
      text: chunk,
      fileName: originalName,
      fileType: "audio",
      mimeType,
      chunkIndex: i,
      totalChunks: chunks.length,
      embeddingSource: "transcription",
    },
  }));

  await upsertPoints(collection, points);
  console.log(
    `[ingest] Audio "${originalName}" transcrito y embebido en ${points.length} chunks`
  );
  return { collection, fileName: originalName, pointsInserted: points.length, extractedText: transcription.slice(0, 5000) };
}

async function processMedia(
  filePath: string,
  originalName: string,
  mimeType: string,
  collection: string
): Promise<ProcessResult> {
  const fileType = mimeType.split("/")[0];

  const vector = await embedFile(filePath, mimeType);

  const point = {
    id: uuidv4(),
    vector,
    payload: {
      text: `[${fileType}] ${originalName}`,
      fileName: originalName,
      fileType,
      mimeType,
      embeddingSource: "binary",
    },
  };

  await upsertPoints(collection, [point]);
  return { collection, fileName: originalName, pointsInserted: 1, extractedText: `[${fileType}] ${originalName}` };
}

async function processPlainText(
  filePath: string,
  originalName: string,
  collection: string
): Promise<ProcessResult> {
  const text = fs.readFileSync(filePath, "utf-8");
  const chunks = chunkText(text);
  const embeddings = await embedText(chunks, originalName);

  const points = chunks.map((chunk, i) => ({
    id: uuidv4(),
    vector: embeddings[i],
    payload: {
      text: chunk,
      fileName: originalName,
      fileType: "text",
      chunkIndex: i,
      totalChunks: chunks.length,
    },
  }));

  await upsertPoints(collection, points);
  return { collection, fileName: originalName, pointsInserted: points.length, extractedText: text.slice(0, 5000) };
}

import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";
import fs from "fs";

const ai = new GoogleGenAI({ apiKey: config.googleApiKey });

/**
 * Embeder chunks de texto para almacenamiento en documentos.
 * Usa formato de prefijo de tarea para gemini-embedding-2-preview.
 */
const BATCH_SIZE = 100;

export async function embedText(
  texts: string[],
  title?: string
): Promise<number[][]> {
  const formatted = texts.map(
    (t) => `title: ${title || "none"} | text: ${t}`
  );

  // Dividir en lotes de 100 (límite de la API)
  const allEmbeddings: number[][] = [];
  for (let i = 0; i < formatted.length; i += BATCH_SIZE) {
    const batch = formatted.slice(i, i + BATCH_SIZE);
    console.log(`[embed] Lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(formatted.length / BATCH_SIZE)} (${batch.length} chunks)`);
    const response = await ai.models.embedContent({
      model: config.embeddingModel,
      contents: batch,
      config: {
        outputDimensionality: config.embeddingDimension,
      },
    });
    allEmbeddings.push(...response.embeddings!.map((e) => e.values!));
  }
  return allEmbeddings;
}

/**
 * Embeder una consulta de búsqueda.
 * Usa formato de prefijo de tarea para gemini-embedding-2-preview.
 */
export async function embedQuery(query: string): Promise<number[]> {
  const formatted = `task: search result | query: ${query}`;

  const response = await ai.models.embedContent({
    model: config.embeddingModel,
    contents: formatted,
    config: {
      outputDimensionality: config.embeddingDimension,
    },
  });
  return response.embeddings![0].values!;
}

/**
 * Embeder un archivo binario (imagen, video, PDF) directamente via inlineData.
 */
export async function embedFile(
  filePath: string,
  mimeType: string
): Promise<number[]> {
  const data = fs.readFileSync(filePath);
  const base64 = data.toString("base64");

  const response = await ai.models.embedContent({
    model: config.embeddingModel,
    contents: [
      {
        inlineData: {
          mimeType,
          data: base64,
        },
      },
    ],
    config: {
      outputDimensionality: config.embeddingDimension,
    },
  });
  return response.embeddings![0].values!;
}

/**
 * Para audio: intentar embedding por inlineData primero (≤80s).
 * Si falla, subir a Files API, transcribir con LLM, devolver texto de transcripción.
 * El llamador chunkeará y embederá la transcripción como texto.
 */
export async function transcribeAudio(
  filePath: string,
  mimeType: string
): Promise<string> {
  console.log(`[embed] Transcribiendo audio via Files API + LLM: ${filePath}`);

  const uploadedFile = await ai.files.upload({
    file: filePath,
    config: { mimeType },
  });

  console.log(`[embed] Audio subido: ${uploadedFile.name}, estado: ${uploadedFile.state}`);

  // Esperar estado ACTIVE
  let file = uploadedFile;
  let attempts = 0;
  while (file.state === "PROCESSING" && attempts < 30) {
    await new Promise((r) => setTimeout(r, 2000));
    file = await ai.files.get({ name: file.name! });
    attempts++;
  }

  if (file.state !== "ACTIVE") {
    if (file.name) await ai.files.delete({ name: file.name }).catch(() => {});
    throw new Error(`Archivo no procesado. Estado: ${file.state}`);
  }

  try {
    const response = await ai.models.generateContent({
      model: config.audioTranscriptionModel,
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: file.uri!,
                mimeType: file.mimeType || mimeType,
              },
            },
            {
              text: "Transcribe este audio de forma completa y detallada. Incluye todo el contenido hablado. Si hay múltiples hablantes, identifícalos. Responde SOLO con la transcripción, sin comentarios adicionales.",
            },
          ],
        },
      ],
    });

    const transcription = response.text || "";
    console.log(`[embed] Transcripción completada: ${transcription.length} caracteres`);
    return transcription;
  } finally {
    if (file.name) await ai.files.delete({ name: file.name }).catch(() => {});
  }
}

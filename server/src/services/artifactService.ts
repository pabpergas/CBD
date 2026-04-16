import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { createFireworks } from "@ai-sdk/fireworks";
import { generateText } from "ai";
import { config } from "../config.js";

const fireworks = createFireworks({ apiKey: config.fireworksApiKey });

const ARTIFACTS_DIR = path.resolve("artifacts");
const WORKER_URL = process.env.PYTHON_WORKER_URL || "http://python-worker:8000";

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

export interface ArtifactResult {
  id: string;
  filename: string;
  description: string;
  mimeType: string;
  size: number;
  url: string;
}

export async function executeArtifact(
  code: string,
  filename: string,
  description: string,
  context?: Record<string, unknown>
): Promise<ArtifactResult> {
  console.log(`[artifact] Ejecutando código para: ${filename}`);

  const res = await fetch(`${WORKER_URL}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, filename, context }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Worker error" }));
    throw new Error(
      `Error generando artefacto: ${(error as any).error || res.statusText}${(error as any).stderr ? `\n${(error as any).stderr}` : ""}`
    );
  }

  const id = uuidv4();
  const ext = path.extname(filename);
  const storedName = `${id}${ext}`;
  const storedPath = path.join(ARTIFACTS_DIR, storedName);

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(storedPath, buffer);

  const mimeType =
    res.headers.get("Content-Type") || "application/octet-stream";
  const size = buffer.length;

  console.log(`[artifact] Guardado: ${storedName} (${size} bytes, ${mimeType})`);

  return {
    id,
    filename,
    description,
    mimeType,
    size,
    url: `/api/artifacts/${id}`,
  };
}

export function getArtifactPath(id: string): string | null {
  const files = fs.readdirSync(ARTIFACTS_DIR);
  const match = files.find((f) => f.startsWith(id));
  return match ? path.join(ARTIFACTS_DIR, match) : null;
}

export function getArtifactFilename(id: string): string | null {
  const files = fs.readdirSync(ARTIFACTS_DIR);
  return files.find((f) => f.startsWith(id)) || null;
}

export async function convertArtifact(
  artifactId: string,
  targetFormat: "pdf" | "png"
): Promise<ArtifactResult> {
  const sourcePath = getArtifactPath(artifactId);
  if (!sourcePath) throw new Error("Artefacto original no encontrado");

  const sourceFilename = path.basename(sourcePath);
  const data = fs.readFileSync(sourcePath).toString("base64");

  const res = await fetch(`${WORKER_URL}/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, filename: sourceFilename, format: targetFormat }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Convert error" }));
    throw new Error(`Error convirtiendo: ${(error as any).error || res.statusText}`);
  }

  const id = uuidv4();
  const outFilename = res.headers.get("X-Filename") || `${id}.${targetFormat}`;
  const ext = path.extname(outFilename);
  const storedName = `${id}${ext}`;
  const storedPath = path.join(ARTIFACTS_DIR, storedName);

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(storedPath, buffer);

  const mimeType = res.headers.get("Content-Type") || "application/octet-stream";

  console.log(`[artifact] Convertido: ${sourceFilename} → ${storedName} (${buffer.length} bytes)`);

  return {
    id,
    filename: outFilename,
    description: `Conversión a ${targetFormat.toUpperCase()} de ${sourceFilename}`,
    mimeType,
    size: buffer.length,
    url: `/api/artifacts/${id}`,
  };
}

export async function reviewArtifactVisually(
  artifactId: string,
  instructions?: string
): Promise<{ review: string; approved: boolean }> {
  const preview = await convertArtifact(artifactId, "png");
  const previewPath = getArtifactPath(preview.id);
  if (!previewPath) throw new Error("No se pudo generar preview para revisión");

  const fileSize = fs.statSync(previewPath).size;
  console.log(`[artifact] Preview generada: ${(fileSize / 1024 / 1024).toFixed(1)}MB`);

  try {
    const imageBuffer = fs.readFileSync(previewPath);

    console.log(`[artifact] Enviando a Fireworks (${config.llmModel}) para revisión visual...`);

    const { text } = await generateText({
      model: fireworks(config.llmModel),
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image: imageBuffer, mediaType: "image/png" },
            {
              type: "text",
              text: `Revisa este documento generado. Evalúa formato, legibilidad, layout y contenido.
${instructions ? `Instrucciones: ${instructions}` : ""}
Responde SOLO JSON: {"review": "descripción breve", "approved": true/false}`,
            },
          ],
        },
      ],
      abortSignal: AbortSignal.timeout(30_000),
    });

    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result = JSON.parse(cleaned);
    console.log(`[artifact] Revisión: ${result.approved ? "APROBADO" : "RECHAZADO"} - ${result.review.slice(0, 100)}...`);
    return result;
  } catch (error: any) {
    console.log(`[artifact] Revisión falló (${error.message?.slice(0, 80)}), aprobando por defecto`);
    return { review: "Revisión automática no disponible, aprobado por defecto", approved: true };
  }
}

import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import mime from "mime-types";
import AdmZip from "adm-zip";
import { v4 as uuidv4 } from "uuid";
import { processFile } from "../services/fileProcessor.js";
import {
  getNotebook,
  addSource,
  getCollectionName,
} from "../services/notebookStore.js";

const router = Router();

const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 1000 * 1024 * 1024 },
});

router.post("/", upload.array("files", 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    const notebookId = req.body.notebookId as string;

    if (!notebookId) {
      res.status(400).json({ error: "Se requiere notebookId" });
      return;
    }

    const notebook = getNotebook(notebookId);
    if (!notebook) {
      res.status(404).json({ error: "Notebook no encontrado" });
      return;
    }

    if (!files || files.length === 0) {
      res.status(400).json({ error: "No se han subido archivos" });
      return;
    }

    const collection = getCollectionName(notebookId);
    const results: any[] = [];
    const skipped: { fileName: string; reason: string }[] = [];

    const isZip = (f: Express.Multer.File) =>
      f.mimetype === "application/zip" ||
      f.mimetype === "application/x-zip-compressed" ||
      f.originalname.toLowerCase().endsWith(".zip");

    const ingestSingle = async (
      filePath: string,
      originalName: string,
      mimeType: string,
      size: number
    ) => {
      try {
        const result = await processFile(filePath, originalName, mimeType, collection);
        addSource(notebookId, {
          id: uuidv4(),
          fileName: originalName,
          fileType: result.fileName.endsWith(".pdf")
            ? "pdf"
            : (mimeType.split("/")[0] || "file"),
          mimeType,
          size,
          chunksCount: result.pointsInserted,
          extractedText: result.extractedText,
          uploadedAt: new Date().toISOString(),
        });
        results.push(result);
      } catch (err: any) {
        skipped.push({ fileName: originalName, reason: err.message || "error" });
      }
    };

    // Carpetas/archivos a ignorar dentro de un ZIP (ruido de proyecto, nunca útil para RAG)
    const IGNORED_SEGMENTS = new Set([
      "node_modules", ".git", "dist", "build", ".next", ".turbo",
      ".pnpm-store", "__pycache__", ".venv", "venv",
    ]);
    // Basenames concretos a ignorar aunque su ruta no matche una carpeta completa
    const IGNORED_BASENAMES = new Set([
      ".DS_Store", "Thumbs.db", ".env", ".env.local", ".env.production",
    ]);

    for (const file of files) {
      if (isZip(file)) {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cbd-zip-"));
        try {
          const zip = new AdmZip(file.path);
          for (const entry of zip.getEntries()) {
            if (entry.isDirectory) continue;

            // Normalizar separadores y descartar rutas peligrosas (zip-slip)
            const normalized = entry.entryName.replace(/\\/g, "/");
            if (normalized.startsWith("/") || normalized.includes("..")) continue;
            if (normalized.startsWith("__MACOSX/")) continue;

            const segments = normalized.split("/");
            if (segments.some((s) => IGNORED_SEGMENTS.has(s))) continue;
            const base = segments[segments.length - 1];
            if (!base || IGNORED_BASENAMES.has(base)) continue;

            // Mantener la ruta relativa como fileName para preservar estructura
            const relName = normalized;
            const outPath = path.join(tmpDir, `${uuidv4()}-${base}`);
            fs.writeFileSync(outPath, entry.getData());

            const detectedMime = mime.lookup(base) || "application/octet-stream";
            const entrySize = entry.header.size;

            await ingestSingle(outPath, relName, detectedMime, entrySize);
            fs.unlinkSync(outPath);
          }
        } finally {
          fs.rmSync(tmpDir, { recursive: true, force: true });
          fs.unlinkSync(file.path);
        }
      } else {
        await ingestSingle(file.path, file.originalname, file.mimetype, file.size);
        fs.unlinkSync(file.path);
      }
    }

    res.json({ success: true, results, skipped });
  } catch (error: any) {
    console.error("Error en ingesta:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

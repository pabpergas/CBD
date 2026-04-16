import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
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
    const results = [];

    for (const file of files) {
      const result = await processFile(
        file.path,
        file.originalname,
        file.mimetype,
        collection
      );

      // Registrar fuente en el notebook
      addSource(notebookId, {
        id: uuidv4(),
        fileName: file.originalname,
        fileType: result.fileName.endsWith(".pdf")
          ? "pdf"
          : file.mimetype.split("/")[0],
        mimeType: file.mimetype,
        size: file.size,
        chunksCount: result.pointsInserted,
        extractedText: result.extractedText,
        uploadedAt: new Date().toISOString(),
      });

      results.push(result);
      fs.unlinkSync(file.path);
    }

    res.json({ success: true, results });
  } catch (error: any) {
    console.error("Error en ingesta:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

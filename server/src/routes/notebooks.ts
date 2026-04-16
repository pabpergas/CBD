import { Router } from "express";
import {
  listNotebooks,
  getNotebook,
  createNotebook,
  updateNotebook,
  deleteNotebook,
  removeSource,
  getSource,
  getCollectionName,
  getMessages,
} from "../services/notebookStore.js";
import { deletePointsByPayload } from "../services/qdrant.js";

const router = Router();

// Listar todos los notebooks
router.get("/", (_req, res) => {
  const notebooks = listNotebooks();
  res.json(
    notebooks.map((n) => ({
      id: n.id,
      title: n.title,
      sourcesCount: n.sources.length,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }))
  );
});

// Crear notebook
router.post("/", async (req, res) => {
  try {
    const { title } = req.body;
    const notebook = await createNotebook(title || "Nuevo notebook");
    res.json(notebook);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener notebook con fuentes
router.get("/:id", (req, res) => {
  const notebook = getNotebook(req.params.id);
  if (!notebook) {
    res.status(404).json({ error: "Notebook no encontrado" });
    return;
  }
  // Devolver sin extractedText ni messages (demasiado grandes)
  res.json({
    ...notebook,
    sources: notebook.sources.map(({ extractedText, ...s }) => s),
    messages: undefined,
  });
});

// Renombrar notebook
router.patch("/:id", (req, res) => {
  try {
    const notebook = updateNotebook(req.params.id, { title: req.body.title });
    res.json(notebook);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Eliminar notebook
router.delete("/:id", async (req, res) => {
  try {
    await deleteNotebook(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener detalle de fuente (incluye extractedText)
router.get("/:id/sources/:sourceId", (req, res) => {
  const source = getSource(req.params.id, req.params.sourceId);
  if (!source) {
    res.status(404).json({ error: "Source no encontrado" });
    return;
  }
  res.json(source);
});

// Eliminar fuente
router.delete("/:id/sources/:sourceId", async (req, res) => {
  try {
    const source = getSource(req.params.id, req.params.sourceId);
    if (!source) {
      res.status(404).json({ error: "Source no encontrado" });
      return;
    }
    // Eliminar puntos de Qdrant
    const collection = getCollectionName(req.params.id);
    await deletePointsByPayload(collection, "fileName", source.fileName);
    // Eliminar del notebook
    removeSource(req.params.id, req.params.sourceId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener mensajes de un notebook
router.get("/:id/messages", (req, res) => {
  const msgs = getMessages(req.params.id);
  res.json(msgs);
});

export default router;

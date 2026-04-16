import { Router } from "express";
import path from "path";
import mime from "mime-types";
import { getArtifactPath, getArtifactFilename } from "../services/artifactService.js";

const router = Router();

router.get("/:id", (req, res) => {
  const filePath = getArtifactPath(req.params.id);
  if (!filePath) {
    res.status(404).json({ error: "Artefacto no encontrado" });
    return;
  }

  const filename = getArtifactFilename(req.params.id) || "download";
  const mimeType = mime.lookup(filePath) || "application/octet-stream";

  res.setHeader("Content-Type", mimeType);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${path.basename(filename)}"`
  );
  res.sendFile(filePath);
});

export default router;

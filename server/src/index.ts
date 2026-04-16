import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { config } from "./config.js";
import chatRouter from "./routes/chat.js";
import ingestRouter from "./routes/ingest.js";
import notebooksRouter from "./routes/notebooks.js";
import artifactsRouter from "./routes/artifacts.js";

// Asegurar que el directorio de datos exista
const dataDir = path.resolve("data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/chat", chatRouter);
app.use("/api/ingest", ingestRouter);
app.use("/api/notebooks", notebooksRouter);
app.use("/api/artifacts", artifactsRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(config.port, () => {
  console.log(`Servidor corriendo en http://localhost:${config.port}`);
});

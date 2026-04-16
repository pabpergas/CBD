import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { ensureCollection, deleteCollection } from "./qdrant.js";

const DATA_PATH = path.resolve("data/notebooks.json");

export interface Source {
  id: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  size: number;
  chunksCount: number;
  extractedText: string;
  uploadedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  citations?: any[];
  artifacts?: any[];
}

export interface Notebook {
  id: string;
  title: string;
  sources: Source[];
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

function collectionName(notebookId: string): string {
  return `nb_${notebookId}`;
}

function load(): Notebook[] {
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, "[]", "utf-8");
    return [];
  }
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
}

function save(notebooks: Notebook[]): void {
  fs.writeFileSync(DATA_PATH, JSON.stringify(notebooks, null, 2), "utf-8");
}

export function getCollectionName(notebookId: string): string {
  return collectionName(notebookId);
}

export function listNotebooks(): Notebook[] {
  return load();
}

export function getNotebook(id: string): Notebook | undefined {
  return load().find((n) => n.id === id);
}

export async function createNotebook(title: string): Promise<Notebook> {
  const notebooks = load();
  const notebook: Notebook = {
    id: uuidv4(),
    title,
    sources: [],
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await ensureCollection(collectionName(notebook.id));
  notebooks.push(notebook);
  save(notebooks);
  return notebook;
}

export function updateNotebook(
  id: string,
  patch: { title?: string }
): Notebook {
  const notebooks = load();
  const idx = notebooks.findIndex((n) => n.id === id);
  if (idx === -1) throw new Error("Notebook no encontrado");
  if (patch.title) notebooks[idx].title = patch.title;
  notebooks[idx].updatedAt = new Date().toISOString();
  save(notebooks);
  return notebooks[idx];
}

export async function deleteNotebook(id: string): Promise<void> {
  const notebooks = load();
  const idx = notebooks.findIndex((n) => n.id === id);
  if (idx === -1) throw new Error("Notebook no encontrado");
  try {
    await deleteCollection(collectionName(id));
  } catch {
    // La colección podría no existir
  }
  notebooks.splice(idx, 1);
  save(notebooks);
}

export function addSource(notebookId: string, source: Source): Notebook {
  const notebooks = load();
  const nb = notebooks.find((n) => n.id === notebookId);
  if (!nb) throw new Error("Notebook no encontrado");
  nb.sources.push(source);
  nb.updatedAt = new Date().toISOString();
  save(notebooks);
  return nb;
}

export function removeSource(notebookId: string, sourceId: string): void {
  const notebooks = load();
  const nb = notebooks.find((n) => n.id === notebookId);
  if (!nb) throw new Error("Notebook no encontrado");
  nb.sources = nb.sources.filter((s) => s.id !== sourceId);
  nb.updatedAt = new Date().toISOString();
  save(notebooks);
}

export function getSource(
  notebookId: string,
  sourceId: string
): Source | undefined {
  const nb = getNotebook(notebookId);
  return nb?.sources.find((s) => s.id === sourceId);
}

export function addMessage(notebookId: string, msg: ChatMessage): void {
  const notebooks = load();
  const nb = notebooks.find((n) => n.id === notebookId);
  if (!nb) return;
  if (!nb.messages) nb.messages = [];
  nb.messages.push(msg);
  nb.updatedAt = new Date().toISOString();
  save(notebooks);
}

export function getMessages(notebookId: string): ChatMessage[] {
  const nb = getNotebook(notebookId);
  return nb?.messages || [];
}

// Almacén de citations en memoria (por notebook, últimos resultados de búsqueda)
const citationsStore = new Map<string, any[]>();

export function setCitations(notebookId: string, citations: any[]): void {
  citationsStore.set(notebookId, citations);
}

export function getCitations(notebookId: string): any[] {
  return citationsStore.get(notebookId) || [];
}

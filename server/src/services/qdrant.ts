import { QdrantClient } from "@qdrant/js-client-rest";
import { config } from "../config.js";

export const qdrant = new QdrantClient({ url: config.qdrantUrl });

export async function ensureCollection(name: string): Promise<void> {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((c) => c.name === name);
  if (!exists) {
    await qdrant.createCollection(name, {
      vectors: { size: config.embeddingDimension, distance: "Cosine" },
    });
  }
}

export async function searchSimilar(
  collection: string,
  vector: number[],
  limit: number = config.topK
) {
  return qdrant.search(collection, {
    vector,
    limit,
    with_payload: true,
  });
}

export async function upsertPoints(
  collection: string,
  points: { id: string; vector: number[]; payload: Record<string, unknown> }[]
) {
  await qdrant.upsert(collection, { points });
}

export async function deleteCollection(name: string): Promise<void> {
  await qdrant.deleteCollection(name);
}

export async function listCollections() {
  const result = await qdrant.getCollections();
  return result.collections;
}

export async function getCollectionInfo(name: string) {
  return qdrant.getCollection(name);
}

export async function deletePointsByPayload(
  collection: string,
  key: string,
  value: string
): Promise<void> {
  await qdrant.delete(collection, {
    filter: {
      must: [{ key, match: { value } }],
    },
  });
}

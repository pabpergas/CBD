import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3001"),
  googleApiKey:
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    "",
  fireworksApiKey: process.env.FIREWORKS_API_KEY || "",
  qdrantUrl: process.env.QDRANT_URL || "http://localhost:6333",
  embeddingModel: "gemini-embedding-2-preview",
  llmModel: "accounts/fireworks/models/qwen3p6-plus",
  audioTranscriptionModel: "gemini-3.1-flash-lite-preview",
  embeddingDimension: 3072,
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
};

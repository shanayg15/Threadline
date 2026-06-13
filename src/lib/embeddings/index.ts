import { env } from "@/lib/config/env";

import { LocalEmbedder } from "./local";
import { OpenAIEmbedder } from "./openai";
import type { Embedder } from "./types";
import { VoyageEmbedder } from "./voyage";

export type { Embedder } from "./types";

/** Build the configured embedder. Always emits EMBEDDING_DIM-length vectors. */
export function getEmbedder(): Embedder {
  switch (env.EMBEDDINGS_PROVIDER) {
    case "openai":
      if (!env.OPENAI_API_KEY) {
        throw new Error(
          "EMBEDDINGS_PROVIDER=openai requires OPENAI_API_KEY (use EMBEDDINGS_PROVIDER=local for keyless dev).",
        );
      }
      return new OpenAIEmbedder({
        apiKey: env.OPENAI_API_KEY,
        model: env.EMBEDDING_MODEL,
        dimensions: env.EMBEDDING_DIM,
      });
    case "voyage":
      return new VoyageEmbedder({ model: env.EMBEDDING_MODEL, dimensions: env.EMBEDDING_DIM });
    case "local":
      return new LocalEmbedder(env.EMBEDDING_DIM);
  }
}

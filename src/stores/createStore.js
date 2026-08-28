import { createMemoryStore } from "./memoryStore.js";
import { createSupabaseStore } from "./supabaseStore.js";

export function createStore(config) {
  const provider = config.storage?.provider ?? "memory";
  if (provider === "memory") return createMemoryStore();
  if (provider === "supabase") return createSupabaseStore(config);
  throw new Error(`Unknown storage provider: ${provider}`);
}

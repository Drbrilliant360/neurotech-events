import type { PlatformDatabase } from "../../domain/types";
import { createSeedDatabase } from "../../data/seed/database";
import { clearJson, readJson, writeJson } from "../../lib/localStore";

const EMPTY: PlatformDatabase = createSeedDatabase();

export function loadDatabase(): PlatformDatabase {
  const stored = readJson<PlatformDatabase | null>(null);
  if (!stored || stored.version !== EMPTY.version) {
    const seed = createSeedDatabase();
    writeJson(seed);
    return seed;
  }
  return stored;
}

export function saveDatabase(db: PlatformDatabase): void {
  writeJson(db);
}

export function resetDatabase(): PlatformDatabase {
  clearJson();
  const seed = createSeedDatabase();
  writeJson(seed);
  return seed;
}

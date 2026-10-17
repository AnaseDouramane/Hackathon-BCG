// Unico punto che sceglie la sorgente dati, in base a DATA_SOURCE (spec §3, §13).
import { memoryRepository, seed } from "./memory-repository";
import { prismaRepository } from "./prisma-repository";
import type { Repository } from "./repository";

export function getRepository(): Repository {
  return process.env.DATA_SOURCE === "db" ? prismaRepository : memoryRepository;
}

/** "Adesso" di riferimento del dataset demo. */
export const datasetDemoNow: Date = seed.demoNow;

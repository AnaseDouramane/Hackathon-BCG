import type { FieldAggregate } from "@/lib/domain/types";

/**
 * Cosa deve saper leggere ogni sorgente dati.
 * Fase 1: MemoryRepository (data/seed.json). Fase 2: PrismaRepository (Azure PostgreSQL).
 */
export interface Repository {
  listFieldAggregates(): Promise<FieldAggregate[]>;
  getFieldAggregate(id: string): Promise<FieldAggregate | null>;
}

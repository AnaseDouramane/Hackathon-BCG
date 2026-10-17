// Fase 2 (owner #4): legge da Azure PostgreSQL con Prisma.
// Deve restituire esattamente gli stessi FieldAggregate di memory-repository.ts
// (vedi docs/database.md §5 e §11). Fino ad allora usare DATA_SOURCE=memory.
//
// Nota per Next 16 (cacheComponents): le query al DB sono dati "non deterministici".
// Le funzioni di lib/services che le chiamano vanno avvolte in 'use cache' (con cacheLife)
// oppure i componenti che le usano vanno messi dentro <Suspense>.
import type { Repository } from "./repository";

const notImplemented = () => {
  throw new Error("DATA_SOURCE=db: PrismaRepository is Phase 2 and not implemented yet (owner #4). Use DATA_SOURCE=memory.");
};

export const prismaRepository: Repository = {
  async listFieldAggregates() {
    return notImplemented();
  },
  async getFieldAggregate() {
    return notImplemented();
  },
};

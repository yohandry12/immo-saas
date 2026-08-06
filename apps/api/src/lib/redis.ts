// Import NOMMÉ : sous NodeNext, c'est la classe elle-même,
// utilisable comme constructeur ET comme type. L'import par défaut,
// lui, tombe sur l'objet module (interop CJS/ESM) et casse.
import { Redis } from "ioredis";

// Singleton : un seul client Redis pour tout le processus,
// même réflexe que le singleton Prisma (sinon, fuite de connexions
// à chaque rechargement de tsx watch).
const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

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
  new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    // Fail-closed : Redis déconnecté → les commandes échouent TOUT DE SUITE
    // au lieu de s'empiler en attente de reconnexion. Le middleware
    // requireAuth transforme cet échec en 503, jamais en attente infinie.
    enableOfflineQueue: false,
    // Borne le temps d'attente d'une commande : 2 s puis erreur.
    commandTimeout: 2000,
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

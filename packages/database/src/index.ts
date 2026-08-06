import { PrismaClient } from "@prisma/client";

// Singleton via globalThis : en dev, tsx watch recharge les modules
// à chaque modification mais ne vide pas globalThis. Sans ce trick,
// chaque rechargement créerait un nouveau pool de connexions jusqu'à
// l'erreur "too many clients" de PostgreSQL. Piège classique.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Ré-exporte les types et enums générés (Role, PaymentStatus...)
// pour que l'API les importe depuis @immo/database
export * from "@prisma/client";

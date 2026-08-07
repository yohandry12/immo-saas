import { z } from "zod";

// Validation des variables d'environnement AU DÉMARRAGE.
// Principe : crasher tout de suite avec un message clair, plutôt que
// planter à la première requête avec un `undefined` cryptique.
const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL manquante"),
    JWT_SECRET: z
      .string()
      .min(32, "JWT_SECRET trop courte : 32 caractères minimum"),
    PORT: z.coerce.number().int().positive().default(4000),
    // Nombre de proxys de confiance DEVANT l'API (reverse proxy, load
    // balancer, CDN). Express remonte alors X-Forwarded-For de ce nombre
    // de sauts pour retrouver la vraie IP du client.
    // 0 = l'API est exposée directement (développement).
    // Mal réglé, req.ip devient l'IP du proxy : le rate-limit compte
    // alors TOUS les utilisateurs ensemble et les verrouille d'un bloc.
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
    MOMO_PROVIDER: z.enum(["mock", "notchpay"]).default("mock"),
    NOTCHPAY_PRIVATE_KEY: z.string().optional(),
    NOTCHPAY_HASH_KEY: z.string().optional(),
    NOTCHPAY_WEBHOOK_URL: z.string().optional(),
  })
  // Les clés NotchPay ne sont obligatoires QUE si le provider est notchpay.
  .refine(
    (e) =>
      e.MOMO_PROVIDER !== "notchpay" ||
      (e.NOTCHPAY_PRIVATE_KEY && e.NOTCHPAY_HASH_KEY),
    {
      message:
        "MOMO_PROVIDER=notchpay exige NOTCHPAY_PRIVATE_KEY et NOTCHPAY_HASH_KEY",
    },
  )
  // Fail-closed : le provider mock ne vérifie AUCUNE signature de webhook.
  // En production, un déploiement qui l'oublierait laisserait n'importe qui
  // confirmer son propre loyer en forgeant l'appel — donc on refuse de
  // démarrer plutôt que d'encaisser du vent.
  .refine((e) => e.NODE_ENV !== "production" || e.MOMO_PROVIDER !== "mock", {
    message:
      "MOMO_PROVIDER=mock est interdit en production : les webhooks ne seraient pas vérifiés. Configurez MOMO_PROVIDER=notchpay.",
  });

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Configuration invalide (.env) :");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".") || "(global)"}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

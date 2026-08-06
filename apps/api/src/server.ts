import "dotenv/config";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./docs/swagger.js";
import { authRouter } from "./modules/auth/routes.js";
import { buildingsRouter } from "./modules/buildings/routes.js";
import { leasesRouter } from "./modules/leases/routes.js";
import {
  paymentsRouter,
  momoWebhookRouter,
} from "./modules/payments/routes.js";
import { dashboardRouter } from "./modules/dashboard/routes.js";
import { chargesRouter } from "./modules/charges/routes.js";
import { tenantRouter } from "./modules/tenant/routes.js";
import { expensesRouter } from "./modules/expenses/routes.js";
import { orgRouter } from "./modules/org/routes.js";
import cors from "cors";
import helmet from "helmet";

const app = express();

// En-têtes de sécurité HTTP (X-Content-Type-Options, HSTS, etc.).
// contentSecurityPolicy assoupli pour laisser Swagger UI charger ses scripts.
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

// Le front tourne sur :3000, l'API sur :4000 : sans CORS,
// le navigateur refuse les appels croisés. Origine restreinte :
// seul NOTRE front est autorisé, pas n'importe quel site.
app.use(
  cors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  }),
);

// UN SEUL parseur JSON, monté AVANT les routes. Express garde le premier
// parseur rencontré : en monter plusieurs rend les `verify` suivants morts.
// verify capture le body BRUT pendant le parsing : indispensable pour
// vérifier une signature de webhook (re-sérialiser le JSON ne redonne
// jamais les mêmes octets que l'appel original).
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);

// La documentation interactive, lisible par un non-développeur.
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "immo-api" });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/buildings", buildingsRouter);
app.use("/api/v1/leases", leasesRouter);
app.use("/api/v1/payments", paymentsRouter);
app.use("/api/v1/webhooks/momo", momoWebhookRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/charges", chargesRouter);
app.use("/api/v1/tenant", tenantRouter);
app.use("/api/v1/expenses", expensesRouter);
app.use("/api/v1/org", orgRouter);
// Gestionnaire d'erreurs global : 4 paramètres obligatoires pour qu'Express
// le reconnaisse comme tel, et placé EN DERNIER. Les controllers y envoient
// les bugs imprévus via next(e) ; le client reçoit un 500 propre, jamais un crash.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Erreur serveur" });
});

const port = process.env.PORT ?? 4000;
app.listen(port, () => {
  console.log(`API prête sur http://localhost:${port}`);
});

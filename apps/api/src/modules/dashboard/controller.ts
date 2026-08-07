import type { NextFunction, Request, Response } from "express";
import { DashboardQuerySchema, PaginationSchema } from "@immo/shared";
import { eventBus } from "../../lib/eventBus.js";
import * as dashboardService from "./service.js";

/**
 * Rôle : valider ?period= (défaut : mois courant) et renvoyer la photo du mois.
 */
export async function summary(req: Request, res: Response, next: NextFunction) {
  const parsed = DashboardQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Filtres invalides", details: parsed.error.issues });
  }

  const period = parsed.data.period ?? new Date().toISOString().slice(0, 7);

  try {
    return res.json(await dashboardService.getSummary(req.orgId!, period));
  } catch (e) {
    return next(e);
  }
}

/**
 * Rôle : renvoyer les derniers événements du portefeuille.
 */
export async function activity(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // ?limit=1..100, défaut 20 — le feed n'est pas un export comptable.
  const parsed = PaginationSchema.pick({ limit: true }).safeParse(req.query);
  const limit = Math.min(parsed.success ? parsed.data.limit : 20, 100);

  try {
    return res.json(await dashboardService.getActivity(req.orgId!, limit));
  } catch (e) {
    return next(e);
  }
}

/**
 * Rôle : ouvrir le flux temps réel. Le navigateur reste connecté et
 * reçoit chaque événement dès qu'il arrive — c'est « voir ses loyers
 * tomber en direct ».
 */
export function stream(req: Request, res: Response) {
  // Les 3 en-têtes qui transforment une réponse HTTP en flux d'événements :
  // jamais de cache, jamais de fermeture, contenu = flux.
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // Nginx bufferise par défaut : sans ceci, les événements restent
  // coincés dans le proxy au lieu d'arriver en direct.
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Format SSE : une ligne « data: » JSON, puis une ligne vide.
  const unsubscribe = eventBus.subscribe(req.orgId!, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  // Battement de cœur : un commentaire SSE (ligne « : ») toutes les 25 s.
  // Sans trafic, proxys et pare-feux coupent une connexion inactive vers
  // 60 s — sur réseau mobile camerounais, souvent bien avant. Le
  // commentaire n'est pas un événement : le client l'ignore, mais la
  // connexion reste vivante.
  const heartbeat = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 25_000);

  // Quand l'onglet se ferme, libérer le listener ET le minuteur — sinon
  // une fuite par visite, et le serveur s'essouffle.
  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}

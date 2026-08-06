import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireOrg } from "../../middleware/requireOrg.js";
import * as dashboardController from "./controller.js";

export const dashboardRouter = Router();

/**
 * @openapi
 * /dashboard/summary:
 *   get:
 *     summary: "La photo du mois : attendu, encaissé, manquant, impayés"
 *     description: >
 *       Renvoie pour un mois donné (celui en cours par défaut) : combien
 *       devait rentrer, combien est réellement rentré, ce qui manque,
 *       quelles cautions sont gardées, le taux d'occupation, et la liste
 *       des appartements qui n'ont pas encore payé avec le nom du
 *       locataire et le reste dû. C'est l'écran que le propriétaire
 *       ouvre chaque matin.
 *     tags:
 *       - Tableau de bord
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Org-Id
 *         required: true
 *         schema: { type: string }
 *         description: L'identifiant de votre portefeuille.
 *       - in: query
 *         name: period
 *         schema: { type: string }
 *         description: Le mois à observer, au format « AAAA-MM ». Mois courant par défaut.
 *         example: "2026-08"
 *     responses:
 *       200:
 *         description: La photo du mois.
 *       400:
 *         description: Le format du mois est invalide.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 */
dashboardRouter.get(
  "/summary",
  requireAuth,
  requireOrg,
  dashboardController.summary,
);

/**
 * @openapi
 * /dashboard/activity:
 *   get:
 *     summary: Les derniers événements du portefeuille
 *     description: >
 *       Renvoie les vingt derniers événements (paiement reçu, bail signé,
 *       bail terminé...) du plus récent au plus ancien. Sert à afficher
 *       l'historique à l'ouverture de la page, avant de brancher le direct.
 *     tags:
 *       - Tableau de bord
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Org-Id
 *         required: true
 *         schema: { type: string }
 *         description: L'identifiant de votre portefeuille.
 *     responses:
 *       200:
 *         description: La liste des événements récents.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 */
dashboardRouter.get(
  "/activity",
  requireAuth,
  requireOrg,
  dashboardController.activity,
);

/**
 * @openapi
 * /dashboard/stream:
 *   get:
 *     summary: "Le direct : recevoir chaque événement à l'instant où il arrive"
 *     description: >
 *       Ouvre un canal permanent entre le serveur et vous. Tant que la
 *       page reste ouverte, chaque paiement encaissé, chaque bail signé
 *       apparaît immédiatement, sans recharger. C'est la transparence
 *       temps réel promise aux propriétaires éloignés de leurs immeubles.
 *     tags:
 *       - Tableau de bord
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Org-Id
 *         required: true
 *         schema: { type: string }
 *         description: L'identifiant de votre portefeuille.
 *     responses:
 *       200:
 *         description: Flux d'événements ouvert (text/event-stream).
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 */
dashboardRouter.get(
  "/stream",
  requireAuth,
  requireOrg,
  dashboardController.stream,
);

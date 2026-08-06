import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireRole } from "../../middleware/requireRole.js";
import * as tenantController from "./controller.js";

export const tenantRouter = Router();

/**
 * @openapi
 * /tenant/home:
 *   get:
 *     summary: "Mon chez-moi : ce que je dois ce mois-ci"
 *     description: >
 *       Renvoie, pour chaque bail en cours du locataire : l'appartement,
 *       l'immeuble, le loyer du contrat, si le loyer du mois est déjà payé,
 *       et les parts de charges communes qui restent à régler. C'est la
 *       première page qu'un locataire ouvre en fin de mois.
 *     tags:
 *       - Locataire
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: La situation du mois, appartement par appartement.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Ce compte n'est pas un compte locataire.
 */
tenantRouter.get(
  "/home",
  requireAuth,
  requireRole("TENANT"),
  tenantController.home,
);

/**
 * @openapi
 * /tenant/payments:
 *   get:
 *     summary: Mes paiements et mes reçus
 *     description: >
 *       Renvoie tous les paiements confirmés des appartements occupés par
 *       le locataire, du plus récent au plus ancien : loyers, parts de
 *       charges, cautions. C'est son carnet de reçus, toujours dans sa poche.
 *     tags:
 *       - Locataire
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: L'historique des paiements.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Ce compte n'est pas un compte locataire.
 */
tenantRouter.get(
  "/payments",
  requireAuth,
  requireRole("TENANT"),
  tenantController.payments,
);

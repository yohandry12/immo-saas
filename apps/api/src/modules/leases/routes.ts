import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireOrg } from "../../middleware/requireOrg.js";
import * as leasesController from "./controller.js";

export const leasesRouter = Router();

/**
 * @openapi
 * /leases:
 *   post:
 *     summary: Signer un bail avec un nouveau locataire
 *     description: >
 *       Lie un appartement à un locataire, même si celui-ci n'a pas de
 *       compte dans l'application : son nom et son téléphone suffisent.
 *       Vous fixez les conditions du contrat : loyer (par défaut celui de
 *       l'appartement), nombre de mois payés d'avance et caution. En
 *       réponse, le logiciel vous donne le total d'entrée attendu
 *       (avance × loyer + caution) : c'est la somme à encaisser le jour
 *       de la remise des clés. Un appartement ne peut avoir qu'un seul
 *       bail actif à la fois.
 *     tags:
 *       - Baux
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Org-Id
 *         required: true
 *         schema: { type: string }
 *         description: L'identifiant de votre portefeuille.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [unitId, tenantName, tenantPhone]
 *             properties:
 *               unitId:
 *                 type: string
 *                 description: L'appartement loué.
 *               tenantName:
 *                 type: string
 *                 description: Le nom complet du locataire.
 *                 example: Jean Kamga
 *               tenantPhone:
 *                 type: string
 *                 description: "Son téléphone : c'est par là que partiront relances et liens de paiement."
 *                 example: "+237699000001"
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Date d'effet du bail. Aujourd'hui par défaut.
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 description: Date de fin prévue, si elle est déjà connue.
 *               rentAmount:
 *                 type: integer
 *                 description: Loyer mensuel contractuel en FCFA. Par défaut, le loyer actuel de l'appartement.
 *                 example: 100000
 *               advanceMonths:
 *                 type: integer
 *                 description: Nombre de mois de loyer payés d'avance à l'entrée. 1 par défaut, 6 est courant.
 *                 example: 6
 *               depositAmount:
 *                 type: integer
 *                 description: La caution exigée, en FCFA.
 *                 example: 200000
 *     responses:
 *       201:
 *         description: Bail signé. La réponse inclut le total d'entrée attendu.
 *       400:
 *         description: Un champ manque ou est invalide.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 *       404:
 *         description: L'appartement désigné n'existe pas dans votre portefeuille.
 *       409:
 *         description: Un bail actif existe déjà sur cet appartement.
 */
leasesRouter.post("/", requireAuth, requireOrg, leasesController.create);

/**
 * @openapi
 * /leases:
 *   get:
 *     summary: Voir la liste des baux
 *     description: >
 *       Renvoie les baux de votre portefeuille, du plus récent au plus
 *       ancien, avec l'appartement et l'immeuble de chacun. Le filtre
 *       « active » permet de ne voir que les baux en cours (ceux qui
 *       doivent rapporter ce mois-ci) ou que les anciens.
 *     tags:
 *       - Baux
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Org-Id
 *         required: true
 *         schema: { type: string }
 *         description: L'identifiant de votre portefeuille.
 *       - in: query
 *         name: active
 *         schema: { type: string, enum: [true, false] }
 *         description: « true » pour les baux en cours seulement, « false » pour les terminés.
 *     responses:
 *       200:
 *         description: La liste des baux.
 *       400:
 *         description: Le filtre active est invalide.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 */
leasesRouter.get("/", requireAuth, requireOrg, leasesController.list);

/**
 * @openapi
 * /leases/{id}:
 *   get:
 *     summary: Voir un bail en détail
 *     description: >
 *       Renvoie toutes les informations d'un bail : locataire, téléphone,
 *       loyer contractuel, avance, caution, dates. C'est la fiche du
 *       locataire.
 *     tags:
 *       - Baux
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Org-Id
 *         required: true
 *         schema: { type: string }
 *         description: L'identifiant de votre portefeuille.
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: L'identifiant du bail.
 *     responses:
 *       200:
 *         description: La fiche du bail.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 *       404:
 *         description: Ce bail n'existe pas dans votre portefeuille.
 */
leasesRouter.get("/:id", requireAuth, requireOrg, leasesController.getById);

/**
 * @openapi
 * /leases/{id}/attach-tenant:
 *   post:
 *     summary: Rattacher le compte de votre locataire à son bail
 *     description: >
 *       Quand votre locataire crée son compte dans l'application (avec le
 *       même numéro de téléphone que sur le bail), rien ne se passe tant
 *       que VOUS n'avez pas confirmé : c'est cette confirmation. Elle
 *       protège ses données — sans elle, n'importe qui connaissant son
 *       numéro pourrait lire son loyer et ses reçus.
 *     tags:
 *       - Baux
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Org-Id
 *         required: true
 *         schema: { type: string }
 *         description: L'identifiant de votre portefeuille.
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: L'identifiant du bail.
 *     responses:
 *       200:
 *         description: Compte rattaché. Le locataire voit désormais son logement et ses reçus.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 *       404:
 *         description: Ce bail n'existe pas dans votre portefeuille.
 *       409:
 *         description: Déjà rattaché, bail sans téléphone, ou aucun compte locataire avec ce numéro.
 */
leasesRouter.post(
  "/:id/attach-tenant",
  requireAuth,
  requireOrg,
  leasesController.attachTenant,
);

/**
 * @openapi
 * /leases/{id}/terminate:
 *   post:
 *     summary: Mettre fin à un bail
 *     description: >
 *       Clôture le bail, à la date de votre choix ou aujourd'hui par
 *       défaut. L'appartement redevient immédiatement louable : vous
 *       pouvez signer un nouveau bail avec un autre locataire. L'ancien
 *       bail reste dans l'historique, pour la mémoire de l'immeuble.
 *     tags:
 *       - Baux
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Org-Id
 *         required: true
 *         schema: { type: string }
 *         description: L'identifiant de votre portefeuille.
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: L'identifiant du bail à clôturer.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 description: La date de fin à retenir. Aujourd'hui par défaut.
 *     responses:
 *       200:
 *         description: Bail clôturé.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 *       404:
 *         description: Ce bail n'existe pas dans votre portefeuille.
 *       409:
 *         description: Ce bail est déjà terminé.
 */
leasesRouter.post(
  "/:id/terminate",
  requireAuth,
  requireOrg,
  leasesController.terminate,
);

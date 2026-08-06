import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireOrg } from "../../middleware/requireOrg.js";
import * as paymentsController from "./controller.js";

export const paymentsRouter = Router();
export const momoWebhookRouter = Router();

/**
 * @openapi
 * /payments:
 *   post:
 *     summary: Enregistrer un paiement reçu
 *     description: >
 *       Quand un locataire règle son loyer ou sa part de facture en
 *       espèces ou par mobile money en dehors de l'application, vous
 *       l'inscrivez ici. C'est la version numérique du cahier : chaque
 *       inscription est datée, signée par celui qui saisit, et visible
 *       immédiatement par le propriétaire, où qu'il soit dans le monde.
 *     tags:
 *       - Paiements
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
 *             required: [unitId, kind, method, amount]
 *             properties:
 *               unitId:
 *                 type: string
 *                 description: L'identifiant de l'appartement qui paie.
 *               kind:
 *                 type: string
 *                 enum: [RENT, CHARGE, DEPOSIT]
 *                 description: "RENT pour un loyer, CHARGE pour une part de facture commune, DEPOSIT pour la caution : l'argent mis de côté comme garantie, qui n'est pas compté comme un loyer."
 *               periodFrom:
 *                 type: string
 *                 description: >-
 *                   Premier mois couvert par ce paiement, au format « AAAA-MM ».
 *                   Sert pour le loyer payé d'avance : un seul paiement peut couvrir plusieurs mois.
 *                 example: "2026-08"
 *               periodTo:
 *                 type: string
 *                 description: >-
 *                   Dernier mois couvert. Si absent alors que periodFrom est présent,
 *                   le paiement ne couvre que ce mois-là.
 *                 example: "2027-01"
 *               method:
 *                 type: string
 *                 enum: [CASH, MOMO, ORANGE_MONEY, BANK]
 *                 description: "Comment l'argent a été reçu : espèces, MTN MoMo, Orange Money, virement."
 *               amount:
 *                 type: integer
 *                 description: Le montant reçu, en FCFA.
 *                 example: 85000
 *               paidAt:
 *                 type: string
 *                 format: date-time
 *                 description: La date du paiement si ce n'est pas aujourd'hui. Facultatif.
 *     responses:
 *       201:
 *         description: Paiement inscrit au journal.
 *       400:
 *         description: Un champ manque ou est invalide (montant négatif, méthode inconnue...).
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 *       404:
 *         description: L'appartement désigné n'existe pas dans votre portefeuille.
 */
paymentsRouter.post("/", requireAuth, requireOrg, paymentsController.record);

/**
 * @openapi
 * /payments:
 *   get:
 *     summary: Voir le journal des paiements
 *     description: >
 *       Renvoie tous les paiements de votre portefeuille, du plus récent
 *       au plus ancien, avec l'étiquette de l'appartement concerné. Vous
 *       pouvez filtrer par appartement, par type (loyer ou charge) ou par
 *       statut. C'est votre cahier numérique : qui a payé, quoi, comment
 *       et quand.
 *     tags:
 *       - Paiements
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Org-Id
 *         required: true
 *         schema: { type: string }
 *         description: L'identifiant de votre portefeuille.
 *       - in: query
 *         name: unitId
 *         schema: { type: string }
 *         description: Ne voir que les paiements d'un appartement précis.
 *       - in: query
 *         name: kind
 *         schema: { type: string, enum: [RENT, CHARGE] }
 *         description: Ne voir que les loyers, ou que les charges.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, CONFIRMED, FAILED] }
 *         description: Ne voir que les paiements d'un statut précis.
 *     responses:
 *       200:
 *         description: Le journal des paiements (vide si rien n'a encore été saisi).
 *       400:
 *         description: Un filtre est invalide.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 */
paymentsRouter.get("/", requireAuth, requireOrg, paymentsController.list);

/**
 * @openapi
 * /payments/momo/initiate:
 *   post:
 *     summary: Ouvrir un paiement Mobile Money
 *     description: >
 *       Crée un paiement PENDING, demande un lien de paiement à l'agrégateur,
 *       et renvoie ce lien au front pour que le locataire valide le paiement.
 *     tags:
 *       - Paiements
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
 *             required: [unitId, method, payerPhone]
 *             properties:
 *               unitId:
 *                 type: string
 *                 description: L'appartement concerné par le paiement.
 *               method:
 *                 type: string
 *                 enum: [MOMO, ORANGE_MONEY]
 *                 description: Le canal Mobile Money utilisé.
 *               payerPhone:
 *                 type: string
 *                 description: Le numéro de téléphone du locataire.
 *               amount:
 *                 type: integer
 *                 description: Montant du paiement, sinon le loyer de l'appartement.
 *               periodFrom:
 *                 type: string
 *                 description: Premier mois couvert, format AAAA-MM.
 *               periodTo:
 *                 type: string
 *                 description: Dernier mois couvert, format AAAA-MM.
 *     responses:
 *       201:
 *         description: Paiement Mobile Money ouvert avec un lien de paiement.
 *       400:
 *         description: Données invalides.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 *       404:
 *         description: L'appartement demandé n'existe pas dans votre portefeuille.
 */
paymentsRouter.post(
  "/momo/initiate",
  requireAuth,
  requireOrg,
  paymentsController.initiateMomo,
);

/**
 * @openapi
 * /webhooks/momo:
 *   post:
 *     summary: Appel de l'agrégateur Mobile Money (route technique)
 *     description: >
 *       Route réservée à l'agrégateur de paiement. Après chaque tentative
 *       de paiement du locataire, l'agrégateur appelle cette adresse pour
 *       dire « succès » ou « échec ». La signature de l'appel est vérifiée
 *       avant toute action ; un appel rejoué ne compte pas deux fois.
 *     tags:
 *       - Webhooks
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reference, status]
 *             properties:
 *               reference:
 *                 type: string
 *                 description: La référence que nous avons fournie à l'initiation.
 *               status:
 *                 type: string
 *                 enum: [SUCCESS, FAILED]
 *                 description: Le verdict de l'opérateur.
 *     responses:
 *       200:
 *         description: Appel compris et traité (ou déjà traité).
 *       400:
 *         description: Corps d'appel invalide.
 *       401:
 *         description: Signature absente ou invalide.
 */
momoWebhookRouter.post("/", paymentsController.momoWebhook);

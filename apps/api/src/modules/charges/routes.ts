import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireOrg } from "../../middleware/requireOrg.js";
import * as chargesController from "./controller.js";

export const chargesRouter = Router();

/**
 * @openapi
 * /charges:
 *   post:
 *     summary: Entrer une facture commune, le logiciel la répartit
 *     description: >
 *       Vous saisissez la facture d'eau ou d'électricité de l'immeuble
 *       une seule fois. Le logiciel la divise automatiquement entre les
 *       appartements occupés, selon la règle choisie : parts égales, au
 *       prorata des surfaces, au prorata des occupants, ou répartition
 *       écrite à la main. Les appartements vides ne paient pas. La somme
 *       des parts tombe toujours exactement sur le montant de la facture,
 *       au franc près.
 *     tags:
 *       - Charges communes
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
 *             required: [buildingId, type, amount, period, rule]
 *             properties:
 *               buildingId:
 *                 type: string
 *                 description: L'immeuble concerné par la facture.
 *               type:
 *                 type: string
 *                 description: WATER pour l'eau, ELECTRICITY pour l'électricité, OTHER pour autre chose.
 *                 example: ELECTRICITY
 *               amount:
 *                 type: integer
 *                 description: Le montant total de la facture, en FCFA.
 *                 example: 100000
 *               period:
 *                 type: string
 *                 description: Le mois de la facture, au format « AAAA-MM ».
 *                 example: "2026-08"
 *               rule:
 *                 type: string
 *                 enum: [EQUAL, BY_AREA, BY_OCCUPANTS, CUSTOM]
 *                 description: EQUAL = parts égales ; BY_AREA = selon la surface ; BY_OCCUPANTS = selon le nombre d'occupants ; CUSTOM = répartition écrite à la main.
 *               customAllocations:
 *                 type: array
 *                 description: "Uniquement pour CUSTOM : la part de chaque appartement. La somme doit faire le montant total."
 *                 items:
 *                   type: object
 *                   properties:
 *                     unitId: { type: string }
 *                     amount: { type: integer }
 *     responses:
 *       201:
 *         description: Facture créée, avec la part de chaque appartement.
 *       400:
 *         description: Un champ manque ou est invalide.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 *       404:
 *         description: L'immeuble désigné n'existe pas dans votre portefeuille.
 *       409:
 *         description: Aucun appartement occupé, ou répartition CUSTOM qui ne somme pas juste.
 */
chargesRouter.post("/", requireAuth, requireOrg, chargesController.create);

/**
 * @openapi
 * /charges:
 *   get:
 *     summary: Voir les factures communes et qui doit quoi
 *     description: >
 *       Renvoie les factures communes du portefeuille, avec pour chacune
 *       la part de chaque appartement et si elle est déjà réglée. C'est
 *       l'écran « factures » du gérant.
 *     tags:
 *       - Charges communes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Org-Id
 *         required: true
 *         schema: { type: string }
 *         description: L'identifiant de votre portefeuille.
 *       - in: query
 *         name: buildingId
 *         schema: { type: string }
 *         description: Ne voir que les factures d'un immeuble précis.
 *     responses:
 *       200:
 *         description: La liste des factures et de leurs parts.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 */
chargesRouter.get("/", requireAuth, requireOrg, chargesController.list);

/**
 * @openapi
 * /charges/{id}/send:
 *   post:
 *     summary: Envoyer la facture répartie
 *     description: >
 *       Valide et envoie la répartition aux appartements. À partir de cet
 *       instant, les parts sont figées : on ne touche plus à une facture
 *       envoyée, c'est ce qui la rend crédible devant les locataires.
 *     tags:
 *       - Charges communes
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
 *         description: L'identifiant de la facture.
 *     responses:
 *       200:
 *         description: Facture envoyée, répartition figée.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 *       404:
 *         description: Cette facture n'existe pas dans votre portefeuille.
 *       409:
 *         description: Cette facture est déjà envoyée.
 */
chargesRouter.post(
  "/:id/send",
  requireAuth,
  requireOrg,
  chargesController.send,
);

/**
 * @openapi
 * /charges/{id}/allocations/{allocationId}/mark-paid:
 *   post:
 *     summary: Noter qu'un locataire a réglé sa part
 *     description: >
 *       Coche la part comme réglée et l'inscrit en même temps dans le
 *       journal des paiements, au mois de la facture. Le cahier financier
 *       reste unique : rien n'est noté deux fois, rien n'est oublié.
 *     tags:
 *       - Charges communes
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
 *         description: L'identifiant de la facture.
 *       - in: path
 *         name: allocationId
 *         required: true
 *         schema: { type: string }
 *         description: L'identifiant de la part réglée.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               method:
 *                 type: string
 *                 enum: [CASH, MOMO, ORANGE_MONEY, BANK]
 *                 description: Comment la part a été réglée. CASH par défaut.
 *     responses:
 *       200:
 *         description: Part cochée comme réglée, paiement inscrit au journal.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 *       404:
 *         description: Facture ou part introuvable dans votre portefeuille.
 *       409:
 *         description: Cette part est déjà réglée.
 */
chargesRouter.post(
  "/:id/allocations/:allocationId/mark-paid",
  requireAuth,
  requireOrg,
  chargesController.markPaid,
);

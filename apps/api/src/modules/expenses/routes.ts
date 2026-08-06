import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireOrg } from "../../middleware/requireOrg.js";
import * as expensesController from "./controller.js";

export const expensesRouter = Router();

/**
 * @openapi
 * /expenses:
 *   post:
 *     summary: Déclarer une dépense (panne ou travaux)
 *     description: >
 *       Enregistre une dépense d'immeuble avec sa catégorie, son montant,
 *       une description et des photos. Les photos sont fournies sous forme
 *       d'adresses web déjà téléchargées dans un stockage en ligne — c'est
 *       l'application mobile qui se charge du téléchargement. La dépense
 *       apparaît immédiatement dans le journal du propriétaire, où qu'il
 *       soit.
 *     tags:
 *       - Dépenses
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
 *             required: [buildingId, category, amount, description]
 *             properties:
 *               buildingId:
 *                 type: string
 *                 description: L'immeuble concerné.
 *               category:
 *                 type: string
 *                 description: La catégorie de dépense (par exemple PLUMBING, ELECTRIC, OTHER).
 *                 example: PLUMBING
 *               amount:
 *                 type: integer
 *                 description: Le montant dépensé, en FCFA.
 *                 example: 35000
 *               description:
 *                 type: string
 *                 description: Une description claire de l'intervention.
 *                 example: "Remplacement du robinet de la cuisine, appartement B2"
 *               photos:
 *                 type: array
 *                 description: Adresses web des photos de l'intervention.
 *                 items:
 *                   type: string
 *                   format: url
 *                 example: ["https://storage.immo.cm/photos/abc123.jpg"]
 *     responses:
 *       201:
 *         description: Dépense enregistrée.
 *       400:
 *         description: Un champ manque ou est invalide.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 *       404:
 *         description: L'immeuble désigné n'existe pas dans votre portefeuille.
 */
expensesRouter.post("/", requireAuth, requireOrg, expensesController.create);

/**
 * @openapi
 * /expenses:
 *   get:
 *     summary: Voir les dépenses du portefeuille
 *     description: >
 *       Renvoie toutes les dépenses enregistrées dans le portefeuille, du
 *       plus récent au plus ancien, avec le nom de l'immeuble concerné.
 *       Filtre optionnel par immeuble.
 *     tags:
 *       - Dépenses
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
 *         description: Ne voir que les dépenses d'un immeuble précis.
 *     responses:
 *       200:
 *         description: La liste des dépenses.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 */
expensesRouter.get("/", requireAuth, requireOrg, expensesController.list);

/**
 * @openapi
 * /expenses/{id}:
 *   get:
 *     summary: Voir une dépense en détail
 *     description: >
 *       Renvoie tous les détails d'une dépense : catégorie, montant,
 *       description, photos, nom de l'immeuble. C'est la fiche complète
 *       d'une intervention.
 *     tags:
 *       - Dépenses
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
 *         description: L'identifiant de la dépense.
 *     responses:
 *       200:
 *         description: La fiche de la dépense.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 *       404:
 *         description: Cette dépense n'existe pas dans votre portefeuille.
 */
expensesRouter.get("/:id", requireAuth, requireOrg, expensesController.getById);

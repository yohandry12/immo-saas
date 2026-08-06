import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireOrg } from "../../middleware/requireOrg.js";
import * as buildingsController from "./controller.js";
import { requireOrgRole } from "../../middleware/requireOrgRole.js";

export const buildingsRouter = Router();

/**
 * @openapi
 * /buildings:
 *   post:
 *     summary: Déclarer un nouvel immeuble
 *     description: >
 *       Ajoute un immeuble à votre portefeuille. C'est la première chose
 *       à faire après votre inscription : sans immeuble, le logiciel n'a
 *       rien à suivre. Une fois l'immeuble déclaré, vous pourrez y ajouter
 *       ses appartements un par un.
 *     tags:
 *       - Immeubles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Org-Id
 *         required: true
 *         schema: { type: string }
 *         description: L'identifiant de votre portefeuille (reçu à la connexion).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, city]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Le nom de l'immeuble, tel que vous l'appelez.
 *                 example: Résidence Akwa
 *               address:
 *                 type: string
 *                 description: L'adresse précise, facultative.
 *                 example: Rue Joss, Akwa
 *               city:
 *                 type: string
 *                 description: La ville où se trouve l'immeuble.
 *                 example: Douala
 *     responses:
 *       201:
 *         description: Immeuble enregistré dans votre portefeuille.
 *       400:
 *         description: Le nom ou la ville manque.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 */
buildingsRouter.post(
  "/",
  requireAuth,
  requireOrg,
  requireOrgRole("OWNER"),
  buildingsController.create,
);

/**
 * @openapi
 * /buildings:
 *   get:
 *     summary: Voir tous mes immeubles
 *     description: >
 *       Renvoie la liste de vos immeubles, du plus récent au plus ancien,
 *       avec pour chacun le nombre d'appartements déclarés. C'est votre
 *       vue d'ensemble : tout le patrimoine, d'un coup d'œil.
 *     tags:
 *       - Immeubles
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
 *         description: Votre liste d'immeubles (vide si vous débutez).
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 */
buildingsRouter.get("/", requireAuth, requireOrg, buildingsController.list);

/**
 * @openapi
 * /buildings/{id}:
 *   get:
 *     summary: Voir un immeuble en détail, avec ses appartements
 *     description: >
 *       Renvoie un immeuble précis avec la liste complète de ses
 *       appartements, triés par étiquette (A1, A2, B1...). C'est la page
 *       où vous vivrez au quotidien : qui habite où, et à quel loyer.
 *     tags:
 *       - Immeubles
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
 *         description: L'identifiant de l'immeuble, reçu lors de sa création.
 *     responses:
 *       200:
 *         description: L'immeuble et ses appartements.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 *       404:
 *         description: Cet immeuble n'existe pas dans votre portefeuille.
 */
buildingsRouter.get(
  "/:id",
  requireAuth,
  requireOrg,
  buildingsController.getById,
);

/**
 * @openapi
 * /buildings/{id}/units:
 *   post:
 *     summary: Ajouter un appartement à un immeuble
 *     description: >
 *       Déclare un appartement (ou une chambre, ou un local commercial)
 *       dans l'immeuble désigné. Le loyer mensuel en FCFA est obligatoire :
 *       c'est lui qui servira de référence pour suivre les paiements.
 *       Deux appartements du même immeuble ne peuvent pas porter la même
 *       étiquette.
 *     tags:
 *       - Appartements
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
 *         description: L'identifiant de l'immeuble qui reçoit l'appartement.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [label, rentAmount]
 *             properties:
 *               label:
 *                 type: string
 *                 description: L'étiquette de l'appartement, comme sur la porte.
 *                 example: A1
 *               floor:
 *                 type: integer
 *                 description: L'étage, facultatif.
 *                 example: 1
 *               surfaceM2:
 *                 type: number
 *                 description: La surface en mètres carrés, facultative.
 *                 example: 45
 *               occupants:
 *                 type: integer
 *                 description: Le nombre d'occupants, utile pour répartir les factures communes. 1 par défaut.
 *                 example: 2
 *               rentAmount:
 *                 type: integer
 *                 description: Le loyer mensuel en FCFA.
 *                 example: 85000
 *               lease:
 *                 type: object
 *                 description: >
 *                   Facultatif. À remplir si l'appartement est déjà occupé
 *                   quand vous le déclarez : le bail est créé dans le même
 *                   geste. C'est ainsi qu'on importe un immeuble existant
 *                   déjà loué, sans ressaisir chaque bail séparément.
 *                 properties:
 *                   tenantName:
 *                     type: string
 *                     description: Le nom complet du locataire en place.
 *                     example: Sandra Mballa
 *                   tenantPhone:
 *                     type: string
 *                     description: "Son téléphone : futur canal des relances et liens de paiement."
 *                     example: "+237699000077"
 *                   rentAmount:
 *                     type: integer
 *                     description: Loyer contractuel, si différent du loyer demandé. Facultatif.
 *                   advanceMonths:
 *                     type: integer
 *                     description: Mois de loyer payés d'avance à l'entrée. 1 par défaut.
 *                     example: 6
 *                   depositAmount:
 *                     type: integer
 *                     description: La caution versée, en FCFA.
 *                     example: 200000
 *                   startDate:
 *                     type: string
 *                     format: date-time
 *                     description: La date d'entrée réelle, si elle est dans le passé.
 *     responses:
 *       201:
 *         description: Appartement ajouté à l'immeuble.
 *       400:
 *         description: L'étiquette ou le loyer manque, ou un nombre est invalide.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Le portefeuille indiqué ne vous appartient pas.
 *       404:
 *         description: L'immeuble désigné n'existe pas dans votre portefeuille.
 *       409:
 *         description: Un appartement porte déjà cette étiquette dans cet immeuble.
 */
buildingsRouter.post(
  "/:id/units",
  requireAuth,
  requireOrg,
  buildingsController.createUnit,
);

/**
 * @openapi
 * /buildings/{id}:
 *   delete:
 *     summary: Supprimer un immeuble sans historique
 *     description: >
 *       Réservé au propriétaire. Un immeuble qui a un historique de
 *       paiements ne peut pas être supprimé : la comptabilité est la
 *       mémoire du bien, et cette mémoire est protégée.
 *     tags:
 *       - Immeubles
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
 *         description: L'identifiant de l'immeuble à supprimer.
 *     responses:
 *       204:
 *         description: Immeuble supprimé.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Vous n'êtes pas le propriétaire de ce portefeuille.
 *       404:
 *         description: Cet immeuble n'existe pas dans votre portefeuille.
 *       409:
 *         description: "Historique de paiements présent : suppression refusée."
 */
buildingsRouter.delete(
  "/:id",
  requireAuth,
  requireOrg,
  requireOrgRole("OWNER"),
  buildingsController.remove,
);

/**
 * @openapi
 * /buildings/{id}/units/{unitId}:
 *   delete:
 *     summary: Supprimer un appartement libre
 *     description: >
 *       Réservé au propriétaire. Un appartement avec un bail en cours ou
 *       un historique de paiements ne peut pas être supprimé.
 *     tags:
 *       - Appartements
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Org-Id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: L'identifiant de l'immeuble.
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema: { type: string }
 *         description: L'identifiant de l'appartement à supprimer.
 *     responses:
 *       204:
 *         description: Appartement supprimé.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Vous n'êtes pas le propriétaire de ce portefeuille.
 *       404:
 *         description: Cet appartement n'existe pas dans votre portefeuille.
 *       409:
 *         description: "Bail actif ou historique de paiements : suppression refusée."
 */
buildingsRouter.delete(
  "/:id/units/:unitId",
  requireAuth,
  requireOrg,
  requireOrgRole("OWNER"),
  buildingsController.removeUnit,
);

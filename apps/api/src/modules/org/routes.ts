import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireOrg } from "../../middleware/requireOrg.js";
import { requireOrgRole } from "../../middleware/requireOrgRole.js";
import * as orgController from "./controller.js";

export const orgRouter = Router();

/**
 * @openapi
 * /org/managers:
 *   post:
 *     summary: Créer le compte d'un agent de terrain
 *     description: >
 *       Réservé au propriétaire. Crée le compte de la personne qui gérera
 *       vos immeubles sur le terrain et l'attache à votre portefeuille avec
 *       le rôle « agent ». L'agent pourra tout faire en opérationnel
 *       (encaisser, signer des baux, déclarer des dépenses) mais ne pourra
 *       ni supprimer vos immeubles, ni inviter d'autres agents. Au départ,
 *       vous lui transmettez ses identifiants en main propre.
 *     tags:
 *       - Organisation
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
 *             required: [password, firstName, lastName]
 *             properties:
 *               email:
 *                 type: string
 *                 description: L'email de l'agent (ou son téléphone).
 *               phone:
 *                 type: string
 *                 description: Le téléphone de l'agent (ou son email).
 *               password:
 *                 type: string
 *                 description: Le mot de passe initial que vous lui transmettez.
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Compte agent créé et attaché au portefeuille.
 *       400:
 *         description: Un champ manque ou est invalide.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Vous n'êtes pas le propriétaire de ce portefeuille.
 *       409:
 *         description: Cette personne est déjà membre du portefeuille.
 */
orgRouter.post(
  "/managers",
  requireAuth,
  requireOrg,
  requireOrgRole("OWNER"),
  orgController.inviteManager,
);
/**
 * @openapi
 * /org/members:
 *   get:
 *     summary: Voir les personnes du portefeuille
 *     description: >
 *       Réservé au propriétaire. Renvoie toutes les personnes qui ont un
 *       accès au portefeuille, avec leur rôle.
 *     tags:
 *       - Organisation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Org-Id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: La liste des membres.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Vous n'êtes pas le propriétaire de ce portefeuille.
 */
orgRouter.get(
  "/members",
  requireAuth,
  requireOrg,
  requireOrgRole("OWNER"),
  orgController.listMembers,
);

/**
 * @openapi
 * /org/members/{userId}:
 *   delete:
 *     summary: Révoquer l'accès d'un agent
 *     description: >
 *       Réservé au propriétaire. Coupe immédiatement l'accès d'une personne
 *       au portefeuille, sans supprimer son compte personnel. Ses actes
 *       passés restent tracés par leur nom. On ne peut ni se révoquer
 *       soi-même, ni révoquer le propriétaire.
 *     tags:
 *       - Organisation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Org-Id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *         description: L'identifiant de la personne à révoquer.
 *     responses:
 *       204:
 *         description: Accès révoqué.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       403:
 *         description: Vous n'êtes pas le propriétaire de ce portefeuille.
 *       404:
 *         description: Cette personne n'est pas membre de ce portefeuille.
 *       409:
 *         description: "Révocation de soi-même ou du propriétaire : refusé."
 */
orgRouter.delete(
  "/members/:userId",
  requireAuth,
  requireOrg,
  requireOrgRole("OWNER"),
  orgController.revokeMember,
);

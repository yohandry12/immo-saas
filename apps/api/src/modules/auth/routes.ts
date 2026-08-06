import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import * as authController from "./controller.js";

export const authRouter = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Créer mon compte propriétaire
 *     description: >
 *       C'est la porte d'entrée du logiciel. Cette opération crée votre
 *       compte personnel et votre « portefeuille », c'est-à-dire l'espace
 *       qui regroupera tous vos immeubles. En réussissant, vous recevez
 *       une « clé d'accès » (le token) : c'est elle qui prouvera votre
 *       identité lors de vos prochaines visites, pendant 7 jours.
 *     tags:
 *       - Authentification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName, orgName]
 *             properties:
 *               email:
 *                 type: string
 *                 description: Votre adresse électronique. Elle servira à vous identifier.
 *                 example: marie.essomba@exemple.cm
 *               password:
 *                 type: string
 *                 description: Votre mot de passe secret, 8 caractères minimum. Il n'est jamais stocké en clair.
 *                 example: motdepasse123
 *               firstName:
 *                 type: string
 *                 description: Votre prénom.
 *                 example: Marie
 *               lastName:
 *                 type: string
 *                 description: Votre nom.
 *                 example: Essomba
 *               orgName:
 *                 type: string
 *                 description: Le nom de votre portefeuille d'immeubles.
 *                 example: Immeubles Essomba
 *     responses:
 *       201:
 *         description: Compte créé. Vous recevez votre clé d'accès et votre portefeuille.
 *       400:
 *         description: Le formulaire est incomplet ou mal rempli (par exemple un email sans @).
 *       409:
 *         description: Un compte existe déjà avec cette adresse email. Connectez-vous plutôt.
 */
authRouter.post("/register", authController.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Entrer dans mon espace
 *     description: >
 *       Si vous avez déjà un compte, cette opération vous fait entrer.
 *       En échange de votre email et de votre mot de passe, vous recevez
 *       une clé d'accès valable 7 jours et la liste de vos portefeuilles.
 *     tags:
 *       - Authentification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 description: L'adresse électronique utilisée à l'inscription.
 *                 example: marie.essomba@exemple.cm
 *               password:
 *                 type: string
 *                 description: Votre mot de passe secret.
 *                 example: motdepasse123
 *     responses:
 *       200:
 *         description: Connexion réussie. Voici votre clé d'accès et vos portefeuilles.
 *       400:
 *         description: Le formulaire est incomplet ou mal rempli.
 *       401:
 *         description: >
 *           Email ou mot de passe incorrect. Par sécurité, le message est
 *           le même que le compte existe ou non.
 */
authRouter.post("/login", authController.login);

/**
 * @openapi
 * /auth/tenant/register:
 *   post:
 *     summary: Créer mon compte locataire avec mon téléphone
 *     description: >
 *       Le locataire crée son compte avec son numéro de téléphone et un
 *       mot de passe. Si des baux portent déjà ce numéro (saisis par le
 *       propriétaire ou le gérant), ils sont rattachés automatiquement au
 *       compte : le téléphone est la clé qui relie le cahier au locataire.
 *     tags:
 *       - Authentification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, password, firstName, lastName]
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Le téléphone du locataire, sous n'importe quel format habituel.
 *                 example: "+237699000001"
 *               password:
 *                 type: string
 *                 description: Un mot de passe secret, 8 caractères minimum.
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Compte créé. Renvoie la clé d'accès et le nombre de baux rattachés.
 *       400:
 *         description: Un champ manque ou est invalide.
 *       409:
 *         description: Un compte existe déjà avec ce téléphone.
 */
authRouter.post("/tenant/register", authController.registerTenant);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Savoir qui je suis et ce que je peux voir
 *     description: >
 *       Renvoie votre identité et vos portefeuilles. Le site utilise cette
 *       opération à chaque ouverture de page pour se souvenir de vous sans
 *       redemander votre mot de passe.
 *     tags:
 *       - Authentification
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Voici votre identité et la liste de vos portefeuilles.
 *       401:
 *         description: Votre clé d'accès est absente ou expirée. Reconnectez-vous.
 *       404:
 *         description: Ce compte n'existe plus.
 */
authRouter.get("/me", requireAuth, authController.me);
/**
 * @openapi
 * /auth/me:
 *   delete:
 *     summary: Supprimer mon compte
 *     description: >
 *       Tout rôle confondu, chacun peut supprimer son propre compte.
 *       Un propriétaire qui possède encore des portefeuilles est refusé :
 *       il doit d'abord les transmettre ou les fermer. Pour un locataire,
 *       les téléphones de ses anciens baux sont masqués ; ceux des baux en
 *       cours restent jusqu'au terme du contrat. Les noms restent sur les
 *       écritures comptables, qui sont la mémoire légale du propriétaire.
 *     tags:
 *       - Authentification
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Compte supprimé.
 *       401:
 *         description: Clé d'accès absente ou expirée.
 *       409:
 *         description: Le compte possède encore des portefeuilles.
 */
authRouter.delete("/me", requireAuth, authController.deleteMe);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Me déconnecter
 *     description: >
 *       Tue la clé d'accès en cours, même si sa date d'expiration est
 *       lointaine : elle est inscrite sur une liste noire jusqu'à son
 *       expiration naturelle. Vos autres appareils restent connectés.
 *     tags:
 *       - Authentification
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Déconnecté.
 *       401:
 *         description: Clé d'accès absente ou déjà morte.
 */
authRouter.post("/logout", requireAuth, authController.logout);

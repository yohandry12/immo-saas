import { Router } from "express";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { requireAuth } from "../../middleware/requireAuth.js";
import * as authController from "./controller.js";

export const authRouter = Router();

// Le cookie de refresh n'est lu QUE par les routes d'authentification :
// on monte le parseur ici plutôt que globalement, pour que le reste de
// l'API n'ait aucune raison de connaître ce cookie.
authRouter.use(cookieParser());

// Anti force-brute : borne les tentatives PAR ADRESSE IP.
// La connexion est la cible n°1 (deviner des mots de passe) ;
// l'inscription, elle, sert surtout à polluer la base.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Trop de tentatives. Réessayez dans 15 minutes." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Trop d'inscriptions. Réessayez dans une heure." },
});

// Le refresh est appelé toutes les ~15 min par client légitime :
// large marge, mais bloque quand même une attaque par énumération.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Trop de requêtes. Réessayez plus tard." },
});

// Cette route n'exige plus d'access token valide (voir le commentaire de
// /logout) : sans plafond, n'importe qui pourrait marteler Redis, dont
// dépend requireAuth en fail-closed — saturer Redis mettrait toute l'API
// hors service. Limite large : un client légitime se déconnecte une fois.
const logoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Trop de requêtes. Réessayez plus tard." },
});

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
authRouter.post("/register", registerLimiter, authController.register);

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
authRouter.post("/login", loginLimiter, authController.login);

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
authRouter.post("/tenant/register", registerLimiter, authController.registerTenant);

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
/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Renouveler ma clé d'accès
 *     description: >
 *       Votre clé d'accès expire toutes les 15 minutes. Cette opération
 *       l'échange contre une nouvelle. Aucun corps à envoyer : le jeton de
 *       renouvellement voyage dans un cookie httpOnly (immo_refresh), posé
 *       à la connexion et envoyé automatiquement par le navigateur — il
 *       n'est jamais accessible en JavaScript ni manipulé par le client.
 *       La réponse ne contient que la nouvelle clé d'accès ; le cookie est
 *       renouvelé par rotation à chaque appel : l'ancien jeton de
 *       renouvellement ne sert plus qu'une seule fois.
 *     tags:
 *       - Authentification
 *     responses:
 *       200:
 *         description: Nouvelle clé d'accès.
 *       401:
 *         description: >
 *           Cookie de renouvellement absent, inconnu, déjà utilisé ou
 *           expiré — reconnectez-vous.
 */
authRouter.post("/refresh", refreshLimiter, authController.refresh);

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
 *       Révoque votre jeton de renouvellement (via le cookie httpOnly) :
 *       il ne pourra plus servir à obtenir de nouvelles clés d'accès.
 *       L'en-tête `Authorization: Bearer` est facultatif ; si vous en
 *       fournissez une valide, votre clé d'accès en cours est aussi mise
 *       sur liste noire jusqu'à son expiration naturelle. Vos autres
 *       appareils restent connectés. Répond toujours 204, que le cookie
 *       ou la clé d'accès aient été présents ou non.
 *     tags:
 *       - Authentification
 *     responses:
 *       204:
 *         description: Déconnecté.
 */
// PAS de requireAuth : l'access vit désormais en mémoire et disparaît
// au rechargement de page. Exiger un access valide rendrait le logout
// impossible juste après une expiration — le cookie resterait posé,
// donc la session réellement vivante. Le controller révoque ce qu'il
// peut : le refresh (par le cookie) toujours, l'access seulement si un
// jeton exploitable accompagne la requête.
authRouter.post("/logout", logoutLimiter, authController.logout);

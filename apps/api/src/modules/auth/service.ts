import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma, type Role } from "@immo/database";
import {
  normalizePhone,
  type LoginInput,
  type RegisterInput,
  type TenantRegisterInput,
} from "@immo/shared";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { redis } from "../../lib/redis.js";

/**
 * Erreur typée pour les échecs d'authentification.
 * Rôle : permettre au controller de distinguer « identifiants faux » (→ 401)
 * d'un vrai bug (→ 500), sans parsing fragile de messages texte.
 */
export class AuthError extends Error {
  constructor() {
    super("Email ou mot de passe incorrect");
  }
}
export class ConflictError extends Error {}

/**
 * Rôle : fabriquer la clé d'accès (JWT) remise à l'utilisateur.
 * Elle contient son identifiant (claim « sub », la convention JWT)
 * et expire après 15 minutes : volée, elle ne vaut presque rien.
 * La longévité de la session vient du refresh token, pas d'elle.
 */
function signToken(user: {
  id: string;
  email: string | null;
  role: Role;
}): string {
  return jwt.sign(
    // jti : identifiant unique du jeton — c'est LUI qu'on noircira au logout.
    {
      sub: user.id,
      email: user.email ?? undefined,
      role: user.role,
      jti: randomUUID(),
    },
    process.env.JWT_SECRET!,
    { expiresIn: "15m" },
  );
}

// ---------- Refresh tokens ----------
// Access court (15 min) + refresh long (7 jours) stocké côté serveur.
// Le refresh est OPAQUE (pas un JWT) : révocable instantanément puisque
// c'est Redis qui fait foi, pas une signature.

const REFRESH_TTL_S = 7 * 24 * 3600; // 7 jours

// On stocke le HASH du refresh token, jamais le token lui-même :
// un dump de Redis ne permet pas de se connecter.
function refreshKey(token: string): string {
  return `refresh:${createHash("sha256").update(token).digest("hex")}`;
}

async function issueRefreshToken(userId: string): Promise<string> {
  // base64url : sûr dans une URL ou un JSON sans échappement.
  const token = randomBytes(48).toString("base64url");
  await redis.set(refreshKey(token), userId, "EX", REFRESH_TTL_S);
  return token;
}

/**
 * Rôle : échanger un refresh token valide contre une NOUVELLE paire
 * access + refresh. Rotation stricte : GETDEL rend l'ancien refresh
 * inutilisable atomiquement — un token volé ne sert qu'une fois, et
 * si le voleur passe avant l'utilisateur, ce dernier est déconnecté
 * (signal visible) au lieu d'être espionné en silence.
 */
export async function refreshSession(refreshToken: string) {
  const userId = await redis.getdel(refreshKey(refreshToken));
  if (!userId) throw new AuthError();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AuthError();

  return {
    token: signToken(user),
    refreshToken: await issueRefreshToken(user.id),
  };
}

/**
 * Rôle : créer d'un seul coup le compte propriétaire, son portefeuille
 * (l'organisation) et son adhésion à ce portefeuille.
 * Le $transaction garantit « tout ou rien » : jamais un compte sans
 * portefeuille, car tout le reste du logiciel suppose qu'il en a un.
 *
 * @param input - les données saisies dans le formulaire d'inscription
 * @returns la clé d'accès + l'identité + le portefeuille créé
 */
export async function registerUser(input: RegisterInput) {
  // 10 = facteur de coût bcrypt : chaque +1 double le temps de calcul.
  const passwordHash = await bcrypt.hash(input.password, 10);

  const { user, org } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: "OWNER",
      },
    });

    const org = await tx.organization.create({
      data: {
        name: input.orgName,
        ownerId: user.id,
        // Convention Phase 0 : le propriétaire est AUSSI membre de sa
        // propre org — le middleware requireOrg s'appuie dessus.
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
    });

    return { user, org };
  });

  return {
    token: signToken(user),
    refreshToken: await issueRefreshToken(user.id),
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    org: { id: org.id, name: org.name },
  };
}

/**
 * Rôle : vérifier l'identité et remettre clé d'accès + portefeuilles.
 * Ne révèle JAMAIS si l'email existe (même message dans les deux cas) :
 * on ne donne pas d'indice à qui essaie de deviner des comptes.
 *
 * @throws AuthError si l'email est inconnu OU le mot de passe faux
 */
export async function loginUser(input: LoginInput) {
  const where = input.email
    ? { email: input.email }
    : { phone: normalizePhone(input.phone!) };

  const user = await prisma.user.findUnique({
    where,
    include: { memberships: { include: { org: true } } },
  });

  if (!user?.passwordHash) throw new AuthError();

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new AuthError();

  return {
    token: signToken(user),
    refreshToken: await issueRefreshToken(user.id),
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    orgs: user.memberships.map((m) => ({
      id: m.org.id,
      name: m.org.name,
      role: m.role,
    })),
  };
}

/**
 * Rôle : renvoyer la fiche d'identité de l'utilisateur connecté et ses
 * portefeuilles. Le front l'appelle à chaque ouverture de page pour
 * restaurer la session sans redemander le mot de passe.
 *
 * @returns null si l'utilisateur n'existe plus (compte supprimé)
 */
/**
 * Rôle : créer un compte locataire par téléphone, SANS organisation.
 * AUCUN bail n'est rattaché ici : connaître un numéro ne prouve pas
 * qu'on le possède. Le rattachement est un acte du PROPRIÉTAIRE
 * (POST /leases/:id/attach-tenant) — sans cette confirmation, un
 * inconnu qui devine le téléphone d'un locataire lirait son loyer
 * et tout son historique de paiements.
 */
export async function registerTenant(input: TenantRegisterInput) {
  const phone = normalizePhone(input.phone);
  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      phone,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: "TENANT",
    },
  });

  // Purement informatif : combien de baux attendent la confirmation du
  // propriétaire pour ce numéro (index Lease_tenantPhone_idx).
  const pendingLeases = await prisma.lease.count({
    where: { tenantId: null, tenantPhone: phone },
  });

  return {
    token: signToken(user),
    refreshToken: await issueRefreshToken(user.id),
    pendingLeases,
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: { include: { org: true } } },
  });

  if (!user) return null;

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    orgs: user.memberships.map((m) => ({
      id: m.org.id,
      name: m.org.name,
      role: m.role,
    })),
  };
}

/**
 * Rôle : supprimer son propre compte, quel que soit le rôle — mais pas
 * n'importe comment :
 * - OWNER avec portefeuilles : refusé (la comptabilité ne perd pas sa tête) ;
 * - téléphones des baux TERMINÉS masqués (droit à l'effacement) ;
 * - téléphones des baux ACTIFS conservés jusqu'au terme (contrat en cours) ;
 * - les noms restent sur les écritures (mémoire comptable).
 */
export async function deleteOwnAccount(userId: string) {
  const owned = await prisma.organization.count({ where: { ownerId: userId } });
  if (owned > 0) {
    throw new ConflictError(
      "Un propriétaire ne peut pas supprimer son compte tant qu'il possède des portefeuilles.",
    );
  }

  // Droit à l'effacement : masque les téléphones des baux terminés.
  // Les baux actifs gardent le téléphone : le contrat court encore.
  await prisma.lease.updateMany({
    where: { tenantId: userId, endDate: { not: null } },
    data: { tenantPhone: null },
  });

  // La suppression fait le reste : memberships en cascade,
  // lease.tenantId et payment.recordedById en SetNull.
  await prisma.user.delete({ where: { id: userId } });
}

/**
 * Rôle : inscrire le jeton déconnecté sur la liste noire jusqu'à son
 * expiration naturelle. Après, la clé meurt toute seule : la liste noire
 * ne garde jamais de cadavres au-delà du nécessaire.
 */
export async function terminateSession(
  jti?: string,
  exp?: number,
  refreshToken?: string,
) {
  // Le refresh token meurt aussi : sans ça, un logout serait annulable
  // en rejouant simplement le refresh.
  if (refreshToken) {
    await redis.del(refreshKey(refreshToken)).catch(() => {});
  }

  if (!jti || !exp) return;
  const remainingMs = exp * 1000 - Date.now();
  if (remainingMs <= 0) return; // déjà mort naturellement : rien à noircir

  // PX : TTL en millisecondes = durée de vie restante du jeton.
  await redis.set(`token:blacklist:${jti}`, "1", "PX", remainingMs);
}

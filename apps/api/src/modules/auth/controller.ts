import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@immo/database";
import jwt from "jsonwebtoken";
import {
  LoginSchema,
  RegisterSchema,
  TenantRegisterSchema,
} from "@immo/shared";
import {
  AuthError,
  getMe,
  loginUser,
  refreshSession,
  registerTenant as registerTenantService,
  registerUser,
  deleteOwnAccount,
  ConflictError,
} from "./service.js";
import { terminateSession } from "./service.js";
import { env } from "../../lib/env.js";
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from "../../lib/authCookie.js";

/**
 * Rôle : valider le formulaire d'inscription, appeler le service,
 * choisir le bon code HTTP. Aucune règle métier ici.
 */
export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.issues });
  }

  try {
    const { refreshToken, ...result } = await registerUser(parsed.data);
    // Le refresh part en cookie httpOnly, jamais dans le corps : le
    // JavaScript du navigateur ne doit pas pouvoir le lire.
    setRefreshCookie(res, refreshToken);
    return res.status(201).json(result); // 201 = « créé », pas 200
  } catch (e) {
    // P2002 = contrainte unique violée : l'email est déjà pris.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return res
        .status(409)
        .json({ error: "Un compte existe déjà avec cette adresse email." });
    }
    return next(e); // bug imprévu → gestionnaire global (500)
  }
}

/**
 * Rôle : valider le formulaire de connexion et remettre la clé d'accès.
 * Transforme AuthError en 401, tout le reste part au gestionnaire global.
 */
export async function login(req: Request, res: Response, next: NextFunction) {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.issues });
  }

  try {
    const { refreshToken, ...result } = await loginUser(parsed.data);
    setRefreshCookie(res, refreshToken);
    return res.json(result);
  } catch (e) {
    if (e instanceof AuthError) {
      return res.status(401).json({ error: e.message });
    }
    return next(e);
  }
}

export async function registerTenant(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const parsed = TenantRegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.issues });
  }

  try {
    const { refreshToken, ...result } = await registerTenantService(
      parsed.data,
    );
    setRefreshCookie(res, refreshToken);
    return res.status(201).json(result);
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return res
        .status(409)
        .json({ error: "Un compte existe déjà avec ce téléphone." });
    }
    return next(e);
  }
}

/**
 * Rôle : renvoyer l'identité de l'utilisateur connecté.
 * req.user vient du middleware requireAuth — le controller ne relit
 * jamais le token lui-même.
 */
export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getMe(req.user!.id);
    if (!result)
      return res.status(404).json({ error: "Utilisateur introuvable" });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

/**
 * Rôle : supprimer le compte connecté. 204 sans corps ; 409 si un
 * propriétaire possède encore des portefeuilles.
 */
export async function deleteMe(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    await deleteOwnAccount(req.user!.id);
    return res.status(204).send();
  } catch (e) {
    if (e instanceof ConflictError) {
      return res.status(409).json({ error: e.message });
    }
    return next(e);
  }
}

/**
 * Rôle : échanger le refresh token contre une nouvelle paire.
 * Le refresh vient du COOKIE, plus du corps JSON : le navigateur le
 * joint automatiquement, et le JavaScript de la page ne l'a jamais vu.
 * 401 si le refresh est absent, inconnu, déjà utilisé (rotation) ou
 * expiré.
 */
export async function refresh(req: Request, res: Response, next: NextFunction) {
  const current = readRefreshCookie(req);
  if (!current) {
    return res.status(401).json({ error: "Session expirée" });
  }

  try {
    const { refreshToken, ...result } = await refreshSession(current);
    // Rotation : le nouveau refresh remplace l'ancien dans le cookie.
    setRefreshCookie(res, refreshToken);
    return res.json(result);
  } catch (e) {
    if (e instanceof AuthError) {
      // Le refresh est mort : on retire le cookie, sinon le navigateur
      // le renverrait indéfiniment sur chaque tentative.
      clearRefreshCookie(res);
      return res.status(401).json({ error: "Session expirée" });
    }
    return next(e);
  }
}

/**
 * Rôle : tuer la session — refresh (Redis + cookie) ET jeton d'accès
 * (liste noire) quand il est exploitable.
 *
 * Cette route n'exige PAS d'access valide : après un rechargement de
 * page l'access en mémoire est perdu, et refuser le logout laisserait
 * le cookie en place, donc la session vivante. On révoque toujours ce
 * qu'on peut. 204 sans corps, dans tous les cas : ne rien révéler sur
 * la validité de ce qui a été présenté.
 */
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = readRefreshCookie(req);

    // req.token n'est renseigné que par requireAuth, absent ici : on
    // décode l'access à la main s'il accompagne la requête. `verify`
    // et non `decode` : un jeton non signé ne doit pas pouvoir
    // noircir le jti d'un autre utilisateur.
    let jti: string | undefined;
    let exp: number | undefined;
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      try {
        const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as {
          jti?: string;
          exp?: number;
        };
        jti = payload.jti;
        exp = payload.exp;
      } catch {
        // Access expiré ou invalide : il ne sert plus à rien de le
        // noircir, il est déjà refusé par requireAuth.
      }
    }

    await terminateSession(jti, exp, refreshToken);
    clearRefreshCookie(res);
    return res.status(204).send();
  } catch (e) {
    return next(e);
  }
}

import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@immo/database";
import {
  LoginSchema,
  RegisterSchema,
  TenantRegisterSchema,
} from "@immo/shared";
import {
  AuthError,
  getMe,
  loginUser,
  registerTenant as registerTenantService,
  registerUser,
  deleteOwnAccount,
  ConflictError,
} from "./service.js";
import { terminateSession } from "./service.js";

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
    const result = await registerUser(parsed.data);
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
    const result = await loginUser(parsed.data);
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
    const result = await registerTenantService(parsed.data);
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
 * Rôle : tuer le jeton en cours. 204 sans corps ; les autres
 * appareils connectés ne sont pas touchés (blacklist par jeton).
 */
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    await terminateSession(req.token?.jti, req.token?.exp);
    return res.status(204).send();
  } catch (e) {
    return next(e);
  }
}

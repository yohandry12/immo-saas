import type { NextFunction, Request, Response } from "express";
import {
  CreateLeaseSchema,
  ListLeasesQuerySchema,
  TerminateLeaseSchema,
} from "@immo/shared";
import * as leaseService from "./service.js";

/**
 * Rôle : valider le formulaire de signature, créer le bail, répondre 201
 * avec le total d'entrée attendu que le front affichera tel quel.
 */
export async function create(req: Request, res: Response, next: NextFunction) {
  const parsed = CreateLeaseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.issues });
  }

  try {
    const lease = await leaseService.createLease(req.orgId!, parsed.data);
    return res.status(201).json(lease);
  } catch (e) {
    if (e instanceof leaseService.NotFoundError) {
      return res.status(404).json({ error: e.message });
    }
    if (e instanceof leaseService.ConflictError) {
      return res.status(409).json({ error: e.message });
    }
    return next(e);
  }
}

/**
 * Rôle : valider le filtre ?active= et renvoyer la liste des baux.
 */
export async function list(req: Request, res: Response, next: NextFunction) {
  const parsed = ListLeasesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Filtres invalides", details: parsed.error.issues });
  }

  try {
    return res.json(await leaseService.listLeases(req.orgId!, parsed.data));
  } catch (e) {
    return next(e);
  }
}

/**
 * Rôle : renvoyer un bail en détail. Params typés, réflexe Express 5.
 */
export async function getById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    return res.json(await leaseService.getLease(req.orgId!, req.params.id));
  } catch (e) {
    if (e instanceof leaseService.NotFoundError) {
      return res.status(404).json({ error: e.message });
    }
    return next(e);
  }
}

/**
 * Rôle : mettre fin à un bail. Le body est facultatif (date de fin
 * optionnelle) : d'où le « req.body ?? {} » — sans body du tout,
 * Express laisse req.body UNDEFINED, pas {}.
 */
export async function terminate(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  const parsed = TerminateLeaseSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.issues });
  }

  try {
    return res.json(
      await leaseService.terminateLease(req.orgId!, req.params.id, parsed.data),
    );
  } catch (e) {
    if (e instanceof leaseService.NotFoundError) {
      return res.status(404).json({ error: e.message });
    }
    if (e instanceof leaseService.ConflictError) {
      return res.status(409).json({ error: e.message });
    }
    return next(e);
  }
}

// import type { NextFunction, Request, Response } from "express";
// import { Prisma } from "@immo/database";
// import { CreateBuildingSchema, CreateUnitSchema } from "@immo/shared";
// import {
//   createBuilding,
//   createUnit as createUnitRecord,
//   getBuilding,
//   listBuildings,
//   NotFoundError,
// } from "./service.js";

// /**
//  * Rôle : valider le formulaire d'immeuble, créer, répondre 201.
//  */
// export async function create(req: Request, res: Response, next: NextFunction) {
//   const parsed = CreateBuildingSchema.safeParse(req.body);
//   if (!parsed.success) {
//     return res
//       .status(400)
//       .json({ error: "Données invalides", details: parsed.error.issues });
//   }

//   try {
//     const building = await createBuilding(req.orgId!, parsed.data);
//     return res.status(201).json(building);
//   } catch (e) {
//     return next(e);
//   }
// }

// /**
//  * Rôle : renvoyer la liste des immeubles du portefeuille.
//  * Impossible de demander « ceux d'un autre » : req.orgId vient du middleware.
//  */
// export async function list(req: Request, res: Response, next: NextFunction) {
//   try {
//     return res.json(await listBuildings(req.orgId!));
//   } catch (e) {
//     return next(e);
//   }
// }

// /**
//  * Rôle : renvoyer le détail d'un immeuble avec ses appartements.
//  * NotFoundError → 404 ; le reste part au gestionnaire global.
//  */
// export async function getById(
//   req: Request<{ id: string }>,
//   res: Response,
//   next: NextFunction,
// ) {
//   try {
//     const buildingId = Array.isArray(req.params.id)
//       ? req.params.id[0]
//       : req.params.id;
//     return res.json(await getBuilding(req.orgId!, buildingId));
//   } catch (e) {
//     if (e instanceof NotFoundError) {
//       return res.status(404).json({ error: e.message });
//     }
//     return next(e);
//   }
// }

// /**
//  * Rôle : ajouter un appartement à l'immeuble désigné.
//  * Gère trois cas : immeuble inexistant (404), étiquette déjà prise
//  * dans cet immeuble (409, contrainte unique [buildingId, label]),
//  * et le succès (201).
//  */
// export async function createUnit(
//   req: Request<{ id: string }>,
//   res: Response,
//   next: NextFunction,
// ) {
//   const parsed = CreateUnitSchema.safeParse(req.body);
//   if (!parsed.success) {
//     return res
//       .status(400)
//       .json({ error: "Données invalides", details: parsed.error.issues });
//   }

//   try {
//     const buildingId = Array.isArray(req.params.id)
//       ? req.params.id[0]
//       : req.params.id;
//     const unit = await createUnitRecord(req.orgId!, buildingId, parsed.data);
//     return res.status(201).json(unit);
//   } catch (e) {
//     if (e instanceof NotFoundError) {
//       return res.status(404).json({ error: e.message });
//     }
//     if (
//       e instanceof Prisma.PrismaClientKnownRequestError &&
//       e.code === "P2002"
//     ) {
//       return res.status(409).json({
//         error: "Un appartement porte déjà cette étiquette dans cet immeuble.",
//       });
//     }
//     return next(e);
//   }
// }

import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@immo/database";
import { CreateBuildingSchema, CreateUnitSchema } from "@immo/shared";
// Import namespace : même pattern que routes.ts, et plus aucune
// collision possible entre noms du controller et noms du service
// (createUnit existait dans les deux → auto-appel et cascade d'any).
import * as buildingService from "./service.js";

/**
 * Rôle : valider le formulaire d'immeuble, créer, répondre 201.
 */
export async function create(req: Request, res: Response, next: NextFunction) {
  const parsed = CreateBuildingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.issues });
  }

  try {
    const building = await buildingService.createBuilding(
      req.orgId!,
      parsed.data,
    );
    return res.status(201).json(building);
  } catch (e) {
    return next(e);
  }
}

/**
 * Rôle : renvoyer la liste des immeubles du portefeuille.
 * Impossible de demander « ceux d'un autre » : req.orgId vient du middleware.
 */
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(await buildingService.listBuildings(req.orgId!));
  } catch (e) {
    return next(e);
  }
}

// Request<{ id: string }> : SANS ce générique, req.params.id vaut
// string | string[] (Express 5) et le service refuse de le recevoir.
/**
 * Rôle : renvoyer le détail d'un immeuble avec ses appartements.
 * NotFoundError → 404 ; le reste part au gestionnaire global.
 */
export async function getById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    return res.json(
      await buildingService.getBuilding(req.orgId!, req.params.id),
    );
  } catch (e) {
    if (e instanceof buildingService.NotFoundError) {
      return res.status(404).json({ error: e.message });
    }
    return next(e);
  }
}

/**
 * Rôle : ajouter un appartement à l'immeuble désigné.
 * Gère trois cas : immeuble inexistant (404), étiquette déjà prise
 * dans cet immeuble (409, contrainte unique [buildingId, label]),
 * et le succès (201).
 */
export async function createUnit(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  const parsed = CreateUnitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.issues });
  }

  try {
    const unit = await buildingService.createUnit(
      req.orgId!,
      req.params.id,
      parsed.data,
    );
    return res.status(201).json(unit);
  } catch (e) {
    if (e instanceof buildingService.NotFoundError) {
      return res.status(404).json({ error: e.message });
    }
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return res.status(409).json({
        error: "Un appartement porte déjà cette étiquette dans cet immeuble.",
      });
    }
    return next(e);
  }
}

export async function remove(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    await buildingService.deleteBuilding(req.orgId!, req.params.id);
    return res.status(204).send();
  } catch (e) {
    if (e instanceof buildingService.NotFoundError)
      return res.status(404).json({ error: e.message });
    if (e instanceof buildingService.ConflictError)
      return res.status(409).json({ error: e.message });
    return next(e);
  }
}

export async function removeUnit(
  req: Request<{ id: string; unitId: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    await buildingService.deleteUnit(req.orgId!, req.params.unitId);
    return res.status(204).send();
  } catch (e) {
    if (e instanceof buildingService.NotFoundError)
      return res.status(404).json({ error: e.message });
    if (e instanceof buildingService.ConflictError)
      return res.status(409).json({ error: e.message });
    return next(e);
  }
}

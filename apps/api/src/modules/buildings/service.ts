import { prisma } from "@immo/database";
import { normalizePhone } from "@immo/shared";
import { eventBus } from "../../lib/eventBus.js";
import type { CreateBuildingInput, CreateUnitInput } from "@immo/shared";

/**
 * Erreur levée quand la ressource n'existe pas OU appartient à une
 * autre organisation. Rôle : un seul message « introuvable » pour les
 * deux cas, afin de ne jamais révéler l'existence des données d'autrui.
 */
export class NotFoundError extends Error {
  constructor() {
    super("Ressource introuvable");
  }
}
export class ConflictError extends Error {}

/**
 * Rôle : ajouter un immeuble au portefeuille de l'organisation.
 * Renvoie l'immeuble créé avec le nombre d'appartements (0 au départ).
 */
export async function createBuilding(
  orgId: string,
  input: CreateBuildingInput,
) {
  return prisma.building.create({
    data: { orgId, ...input },
    include: { _count: { select: { units: true } } },
  });
}

/**
 * Rôle : lister les immeubles du portefeuille, du plus récent au plus
 * ancien, chacun avec son nombre d'appartements. C'est l'écran d'accueil
 * du propriétaire.
 */
export async function listBuildings(orgId: string) {
  return prisma.building.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { units: true } } },
  });
}

/**
 * Rôle : renvoyer un immeuble avec tous ses appartements.
 * Deuxième couche d'isolation : même si le middleware laissait passer
 * une requête, ce check bloque toute lecture hors de l'organisation.
 *
 * @throws NotFoundError si l'immeuble n'existe pas ou n'est pas dans cette org
 */
export async function getBuilding(orgId: string, buildingId: string) {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    include: {
      units: {
        orderBy: { label: "asc" },
        // Le bail ACTIF de chaque appartement : c'est lui qui dit
        // « occupé par X » ou « vacant » sur la fiche immeuble.
        include: {
          leases: {
            where: { endDate: null },
            select: { id: true, tenantName: true, rentAmount: true },
          },
        },
      },
    },
  });

  if (!building || building.orgId !== orgId) throw new NotFoundError();
  return building;
}

/**
 * Rôle : ajouter un appartement à un immeuble du portefeuille.
 * Vérifie d'abord que l'immeuble appartient bien à l'organisation
 * (encore la défense en profondeur), puis crée l'appartement.
 *
 * @throws NotFoundError si l'immeuble n'existe pas ou n'est pas dans cette org
 */
/**
 * Rôle : ajouter un appartement à l'immeuble désigné, et — si le
 * formulaire le déclare — créer son bail actif dans la même opération.
 * Une seule transaction : jamais un appartement « occupé » sans bail,
 * jamais un bail sans appartement.
 */
export async function createUnit(
  orgId: string,
  buildingId: string,
  input: CreateUnitInput,
) {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
  });
  if (!building || building.orgId !== orgId) throw new NotFoundError();

  // `lease` n'est pas une colonne de Unit : il faut l'extraire avant
  // de splitter le reste dans le create, sinon Prisma rejette le champ.
  const { lease: leaseInput, ...unitData } = input;

  const result = await prisma.$transaction(async (tx) => {
    const unit = await tx.unit.create({ data: { buildingId, ...unitData } });

    if (!leaseInput) {
      return { unit, lease: null, expectedMoveInTotal: null };
    }

    // L'unité vient d'être créée : aucun bail actif ne peut exister,
    // le check « un seul bail actif » est inutile dans ce chemin.
    const rentAmount = leaseInput.rentAmount ?? unit.rentAmount;
    const depositAmount = leaseInput.depositAmount ?? 0;
    const expectedMoveInTotal =
      leaseInput.advanceMonths * rentAmount + depositAmount;

    const lease = await tx.lease.create({
      data: {
        unitId: unit.id,
        tenantName: leaseInput.tenantName,
        tenantPhone: normalizePhone(leaseInput.tenantPhone),
        rentAmount,
        startDate: leaseInput.startDate
          ? new Date(leaseInput.startDate)
          : new Date(),
        advanceMonths: leaseInput.advanceMonths,
        depositAmount: leaseInput.depositAmount ?? null,
      },
    });

    // La trace de transparence est écrite DANS la transaction :
    // jamais un bail sans son événement dans le journal.
    await tx.activityEvent.create({
      data: {
        orgId,
        type: "LEASE_SIGNED",
        payload: {
          unitLabel: unit.label,
          tenantName: leaseInput.tenantName,
          advanceMonths: leaseInput.advanceMonths,
          depositAmount,
          expectedMoveInTotal,
        },
      },
    });

    return { unit, lease, expectedMoveInTotal };
  });

  // Publier APRÈS le commit : le flux temps réel n'annonce que du persisté.
  if (result.lease) {
    eventBus.publish(orgId, {
      type: "LEASE_SIGNED",
      payload: {
        unitLabel: result.unit.label,
        tenantName: result.lease.tenantName,
        expectedMoveInTotal: result.expectedMoveInTotal,
      },
      createdAt: new Date().toISOString(),
    });
  }

  // Réponse rétrocompatible : les champs de l'unité restent à la racine,
  // lease et expectedMoveInTotal s'ajoutent seulement s'ils existent.
  return {
    ...result.unit,
    lease: result.lease,
    expectedMoveInTotal: result.expectedMoveInTotal,
  };
}

/**
 * Rôle : supprimer un immeuble, seulement s'il n'a aucun historique
 * financier. La comptabilité ne se détruit pas : s'il existe des
 * paiements, on refuse avec un message clair (409) au lieu de laisser
 * la contrainte Restrict renvoyer une erreur Prisma brute.
 */
export async function deleteBuilding(orgId: string, buildingId: string) {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
  });
  if (!building || building.orgId !== orgId) throw new NotFoundError();

  const payments = await prisma.payment.count({
    where: { unit: { buildingId: building.id } },
  });
  if (payments > 0) {
    throw new ConflictError(
      "Suppression impossible : cet immeuble a un historique de paiements.",
    );
  }

  return prisma.building.delete({ where: { id: buildingId } });
}

/**
 * Rôle : supprimer un appartement, seulement sans bail actif et sans
 * historique de paiements. Même principe : la mémoire financière prime.
 */
export async function deleteUnit(orgId: string, unitId: string) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { building: true },
  });
  if (!unit || unit.building.orgId !== orgId) throw new NotFoundError();

  const activeLease = await prisma.lease.findFirst({
    where: { unitId: unit.id, endDate: null },
  });
  if (activeLease) {
    throw new ConflictError(
      "Suppression impossible : un bail actif est en cours sur cet appartement.",
    );
  }

  const payments = await prisma.payment.count({ where: { unitId: unit.id } });
  if (payments > 0) {
    throw new ConflictError(
      "Suppression impossible : cet appartement a un historique de paiements.",
    );
  }

  return prisma.unit.delete({ where: { id: unitId } });
}

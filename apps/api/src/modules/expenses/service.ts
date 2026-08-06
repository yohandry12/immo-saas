import { prisma } from "@immo/database";
import type { CreateExpenseInput, ListExpensesQuery } from "@immo/shared";
import { eventBus } from "../../lib/eventBus.js";

/** Convention : « introuvable » = n'existe pas OU appartient à une autre org. */
export class NotFoundError extends Error {
  constructor() {
    super("Ressource introuvable");
  }
}

/**
 * Rôle : tracer une dépense (panne ou travaux) dans le portefeuille.
 * L'immeuble doit appartenir à l'org (défense en profondeur) ; l'écriture
 * est atomique avec l'événement de transparence.
 *
 * @throws NotFoundError si l'immeuble n'existe pas ou n'est pas dans cette org
 */
export async function createExpense(orgId: string, input: CreateExpenseInput) {
  const building = await prisma.building.findUnique({
    where: { id: input.buildingId },
  });
  if (!building || building.orgId !== orgId) throw new NotFoundError();

  const [expense] = await prisma.$transaction([
    prisma.expense.create({
      data: {
        orgId,
        buildingId: building.id,
        category: input.category,
        amount: input.amount,
        description: input.description,
        photos: input.photos,
      },
      include: { building: { select: { name: true } } },
    }),
    prisma.activityEvent.create({
      data: {
        orgId,
        type: "EXPENSE_CREATED",
        payload: {
          buildingName: building.name,
          category: input.category,
          amount: input.amount,
        },
      },
    }),
  ]);

  // Publier après commit : le dashboard diaspora voit la dépense à l'instant.
  eventBus.publish(orgId, {
    type: "EXPENSE_CREATED",
    payload: {
      buildingName: building.name,
      category: input.category,
      amount: input.amount,
    },
    createdAt: new Date().toISOString(),
  });

  return expense;
}

/**
 * Rôle : lister les dépenses du portefeuille, du plus récent au plus
 * ancien, avec le nom de l'immeuble. Filtre optionnel par immeuble.
 */
export async function listExpenses(orgId: string, query: ListExpensesQuery) {
  return prisma.expense.findMany({
    where: {
      orgId,
      ...(query.buildingId && { buildingId: query.buildingId }),
    },
    orderBy: { createdAt: "desc" },
    include: { building: { select: { name: true } } },
  });
}

/**
 * Rôle : renvoyer une dépense en détail (photos incluses).
 * Deuxième couche d'isolation : orgId revérifié ici.
 */
export async function getExpense(orgId: string, expenseId: string) {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { building: { select: { name: true, orgId: true } } },
  });

  if (!expense || expense.building.orgId !== orgId) throw new NotFoundError();
  return expense;
}

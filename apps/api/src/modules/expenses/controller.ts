import type { NextFunction, Request, Response } from "express";
import { CreateExpenseSchema, ListExpensesQuerySchema } from "@immo/shared";
import * as expenseService from "./service.js";

/**
 * Rôle : valider le formulaire de dépense, créer, répondre 201.
 */
export async function create(req: Request, res: Response, next: NextFunction) {
  const parsed = CreateExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.issues });
  }

  try {
    const expense = await expenseService.createExpense(req.orgId!, parsed.data);
    return res.status(201).json(expense);
  } catch (e) {
    if (e instanceof expenseService.NotFoundError) {
      return res.status(404).json({ error: e.message });
    }
    return next(e);
  }
}

/**
 * Rôle : renvoyer la liste des dépenses du portefeuille.
 */
export async function list(req: Request, res: Response, next: NextFunction) {
  const parsed = ListExpensesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Filtres invalides", details: parsed.error.issues });
  }

  try {
    return res.json(await expenseService.listExpenses(req.orgId!, parsed.data));
  } catch (e) {
    return next(e);
  }
}

/**
 * Rôle : renvoyer une dépense en détail avec ses photos.
 */
export async function getById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    return res.json(await expenseService.getExpense(req.orgId!, req.params.id));
  } catch (e) {
    if (e instanceof expenseService.NotFoundError) {
      return res.status(404).json({ error: e.message });
    }
    return next(e);
  }
}

import type { NextFunction, Request, Response } from "express";
import {
  InitiateMomoPaymentSchema,
  ListPaymentsQuerySchema,
  MomoWebhookSchema,
  RecordPaymentSchema,
} from "@immo/shared";
import { getMomoClient } from "../../lib/momoClient.js";
import * as paymentService from "./service.js";

/**
 * Rôle : valider le formulaire de saisie, inscrire le paiement,
 * répondre 201. L'identité de celui qui saisit vient de req.user
 * (middleware), jamais du body.
 */
export async function record(req: Request, res: Response, next: NextFunction) {
  const parsed = RecordPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.issues });
  }

  try {
    const payment = await paymentService.recordPayment(
      req.orgId!,
      req.user!.id,
      parsed.data,
    );
    return res.status(201).json(payment);
  } catch (e) {
    if (e instanceof paymentService.NotFoundError) {
      return res.status(404).json({ error: e.message });
    }
    return next(e);
  }
}

/**
 * Rôle : valider les filtres de l'URL (query string, pas body cette
 * fois) et renvoyer le journal. req.query se valide comme req.body :
 * tout ce qui entre dans l'API passe par zod.
 */
export async function list(req: Request, res: Response, next: NextFunction) {
  const parsed = ListPaymentsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Filtres invalides", details: parsed.error.issues });
  }

  try {
    return res.json(await paymentService.listPayments(req.orgId!, parsed.data));
  } catch (e) {
    return next(e);
  }
}

/**
 * Rôle : valider la demande de paiement Mobile Money et renvoyer le lien.
 */
export async function initiateMomo(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const parsed = InitiateMomoPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.issues });
  }

  try {
    return res
      .status(201)
      .json(await paymentService.initiateMomoPayment(req.orgId!, parsed.data));
  } catch (e) {
    if (e instanceof paymentService.NotFoundError) {
      return res.status(404).json({ error: e.message });
    }
    return next(e);
  }
}

/**
 * Rôle : recevoir l'appel de l'agrégateur. Route PUBLIQUE (l'agrégateur
 * n'a pas notre JWT) : la sécurité repose sur la signature, pas sur l'auth.
 */
export async function momoWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const client = getMomoClient();

  // L'en-tête de signature NotchPay ; le mock l'ignore et renvoie true.
  const signature = req.headers["x-notch-signature"] as string | undefined;
  if (!client.verifySignature((req as any).rawBody, signature)) {
    return res.status(401).json({ error: "Signature invalide" });
  }

  const parsed = client.parseWebhook(req.body);
  if (!parsed) {
    return res.status(400).json({ error: "Webhook invalide" });
  }

  try {
    const result = await paymentService.confirmMomoPayment(
      parsed.reference,
      parsed.success,
    );
    return res.json({ ok: result.processed });
  } catch (e) {
    return next(e);
  }
}

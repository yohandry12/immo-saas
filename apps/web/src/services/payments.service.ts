import { api } from "@/lib/api";
import type { Payment } from "./types";

export const paymentsService = {
  list: (params?: { unitId?: string; kind?: string; status?: string }) =>
    api.get<Payment[]>("/payments", { params }).then((r) => r.data),
  record: (body: {
    unitId: string;
    kind: "RENT" | "CHARGE" | "DEPOSIT";
    method: "CASH" | "MOMO" | "ORANGE_MONEY" | "BANK";
    amount: number;
    periodFrom?: string;
    periodTo?: string;
  }) => api.post<Payment>("/payments", body).then((r) => r.data),
  // LE paiement direct : renvoie le lien à ouvrir sur le téléphone.
  initiateMomo: (body: {
    unitId: string;
    method: "MOMO" | "ORANGE_MONEY";
    payerPhone: string;
    amount?: number;
  }) =>
    api
      .post<{
        paymentId: string;
        reference: string;
        paymentUrl: string;
      }>("/payments/momo/initiate", body)
      .then((r) => r.data),
};

import { api } from "@/lib/api";
import type { Payment } from "./types";

export const tenantService = {
  home: () => api.get("/tenant/home").then((r) => r.data),
  payments: () => api.get<Payment[]>("/tenant/payments").then((r) => r.data),
};

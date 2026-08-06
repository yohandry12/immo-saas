import { api } from "@/lib/api";

export const chargesService = {
  list: (buildingId?: string) =>
    api
      .get("/charges", { params: buildingId ? { buildingId } : {} })
      .then((r) => r.data),
  create: (body: {
    buildingId: string;
    type: string;
    amount: number;
    period: string;
    rule: "EQUAL" | "BY_AREA" | "BY_OCCUPANTS" | "CUSTOM";
  }) => api.post("/charges", body).then((r) => r.data),
  send: (id: string) => api.post(`/charges/${id}/send`).then((r) => r.data),
  markPaid: (billId: string, allocationId: string, method?: string) =>
    api
      .post(
        `/charges/${billId}/allocations/${allocationId}/mark-paid`,
        method ? { method } : {},
      )
      .then((r) => r.data),
};

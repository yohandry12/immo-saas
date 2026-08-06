import { api } from "@/lib/api";

export const leasesService = {
  list: (active?: "true" | "false") =>
    api
      .get("/leases", { params: active ? { active } : {} })
      .then((r) => r.data),
  getById: (id: string) => api.get(`/leases/${id}`).then((r) => r.data),
  create: (body: {
    unitId: string;
    tenantName: string;
    tenantPhone: string;
    rentAmount?: number;
    advanceMonths?: number;
    depositAmount?: number;
  }) => api.post("/leases", body).then((r) => r.data),
  terminate: (id: string, endDate?: string) =>
    api
      .post(`/leases/${id}/terminate`, endDate ? { endDate } : {})
      .then((r) => r.data),
};

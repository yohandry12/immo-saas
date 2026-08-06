import { api } from "@/lib/api";

export const expensesService = {
  list: (buildingId?: string) =>
    api
      .get("/expenses", { params: buildingId ? { buildingId } : {} })
      .then((r) => r.data),
  create: (body: {
    buildingId: string;
    category: string;
    amount: number;
    description: string;
    photos?: string[];
  }) => api.post("/expenses", body).then((r) => r.data),
};

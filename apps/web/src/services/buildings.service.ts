import { api } from "@/lib/api";
import type { Building, Unit } from "./types";

export const buildingsService = {
  list: () => api.get<Building[]>("/buildings").then((r) => r.data),
  getById: (id: string) =>
    api.get<Building>(`/buildings/${id}`).then((r) => r.data),
  create: (body: { name: string; city: string; address?: string }) =>
    api.post<Building>("/buildings", body).then((r) => r.data),
  createUnit: (
    buildingId: string,
    body: {
      label: string;
      rentAmount: number;
      occupants?: number;
      surfaceM2?: number;
    },
  ) =>
    api.post<Unit>(`/buildings/${buildingId}/units`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/buildings/${id}`),
  removeUnit: (buildingId: string, unitId: string) =>
    api.delete(`/buildings/${buildingId}/units/${unitId}`),
};

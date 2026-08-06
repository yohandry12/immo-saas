import { api } from "@/lib/api";
import type { FeedEvent, Summary } from "./types";

export const dashboardService = {
  summary: (period?: string) =>
    api
      .get<Summary>("/dashboard/summary", { params: period ? { period } : {} })
      .then((r) => r.data),
  activity: () =>
    api.get<FeedEvent[]>("/dashboard/activity").then((r) => r.data),
};

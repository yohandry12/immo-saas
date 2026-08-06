import { api } from "@/lib/api";

export const orgService = {
  listMembers: () => api.get("/org/members").then((r) => r.data),
  inviteManager: (body: {
    email?: string;
    phone?: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => api.post("/org/managers", body).then((r) => r.data),
  revokeManager: (userId: string) => api.delete(`/org/members/${userId}`),
};

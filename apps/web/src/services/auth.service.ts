import { api } from '@/lib/api';
import type { AuthResponse, TenantRegisterResponse } from './types';

export const authService = {
  login: (body: { email?: string; phone?: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', body).then((r) => r.data),
  register: (body: { email: string; password: string; firstName: string; lastName: string; orgName: string }) =>
    api.post<AuthResponse>('/auth/register', body).then((r) => r.data),
  registerTenant: (body: { phone: string; password: string; firstName: string; lastName: string }) =>
    api.post<TenantRegisterResponse>('/auth/tenant/register', body).then((r) => r.data),
  me: () => api.get<AuthResponse>('/auth/me').then((r) => r.data),
  // Ni refresh ni logout ne prennent de paramètre : le cookie httpOnly
  // porte le refresh, le navigateur l'envoie tout seul.
  refresh: () =>
    api.post<{ token: string }>('/auth/refresh').then((r) => r.data),
  logout: () => api.post('/auth/logout').then(() => undefined),
  deleteMe: () => api.delete('/auth/me'),
};

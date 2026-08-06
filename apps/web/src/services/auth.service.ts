import { api } from '@/lib/api';
import type { AuthResponse } from './types';

export const authService = {
  login: (body: { email?: string; phone?: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', body).then((r) => r.data),
  register: (body: { email: string; password: string; firstName: string; lastName: string; orgName: string }) =>
    api.post<AuthResponse>('/auth/register', body).then((r) => r.data),
  registerTenant: (body: { phone: string; password: string; firstName: string; lastName: string }) =>
    api.post<AuthResponse>('/auth/tenant/register', body).then((r) => r.data),
  me: () => api.get<AuthResponse>('/auth/me').then((r) => r.data),
  refresh: (refreshToken: string) =>
    api
      .post<{ token: string; refreshToken: string }>('/auth/refresh', { refreshToken })
      .then((r) => r.data),
  logout: (refreshToken?: string) => api.post('/auth/logout', { refreshToken }),
  deleteMe: () => api.delete('/auth/me'),
};
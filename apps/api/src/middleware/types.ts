import type { Role } from "@immo/database";

// Le user de requête porte le rôle global (JWT) ; orgRole porte le
// rôle DANS l'org ciblée par X-Org-Id, posé par requireOrg.
// requireRole et requireOrgRole les lisent sans requête base de données.
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email?: string; role: Role };
      orgId?: string;
      orgRole?: Role; // ← la déclaration qui manquait
      token?: { jti?: string; exp?: number };
    }
  }
}

export {};
// Rien d'autre dans ce fichier : jamais de code exécutable ici.

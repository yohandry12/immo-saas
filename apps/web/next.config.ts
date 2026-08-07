import type { NextConfig } from "next";

// L'API en développement. En production, le reverse proxy sert le
// front et l'API sous le même domaine : ces rewrites ne s'appliquent
// qu'ici, mais le CHEMIN vu par le navigateur (/api/...) est identique
// dans les deux cas — donc le cookie se comporte pareil.
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // @immo/shared est publié en TypeScript brut (main pointe sur src/).
  // Sans cette ligne, Next refuse de compiler les fichiers d'un package
  // hors de apps/web.
  transpilePackages: ["@immo/shared"],

  // Origine unique : le navigateur ne parle qu'à localhost:3000, donc
  // le cookie SameSite=Strict est bien envoyé. Sans ce proxy, deux
  // origines (3000 et 4000) empêcheraient le cookie de circuler en
  // développement, alors qu'il circulerait en production.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;

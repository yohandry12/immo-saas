import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @immo/shared est publié en TypeScript brut (main pointe sur src/).
  // Sans cette ligne, Next refuse de compiler les fichiers d'un package
  // hors de apps/web.
  transpilePackages: ["@immo/shared"],
};

export default nextConfig;

import path from "node:path";
import { fileURLToPath } from "node:url";
import swaggerJsdoc from "swagger-jsdoc";

// Chemin calculé depuis CE fichier, pas depuis le dossier de lancement :
// ça marche peu importe d'où tu démarres le serveur (piège déjà vu avec .env).
const routesGlob = path
  .join(path.dirname(fileURLToPath(import.meta.url)), "../modules/*/routes.ts")
  .replace(/\\/g, "/"); // Windows : le glob exige des slashs, pas des antislashs

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Immo SaaS — API",
      version: "0.1.0",
      description:
        "Le contrat complet de l'API, écrit pour être compris par toute personne, même sans bagage technique.",
    },
    servers: [{ url: "http://localhost:4000/api/v1" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Collez ici la clé d'accès reçue à la connexion.",
        },
      },
    },
  },
  // swagger-jsdoc lit les blocs @openapi DANS les commentaires des routes :
  // c'est là, et seulement là, que la documentation est rédigée.
  apis: [routesGlob],
});

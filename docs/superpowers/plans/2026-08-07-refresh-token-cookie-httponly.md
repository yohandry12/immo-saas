# Refresh token en cookie httpOnly — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sortir le refresh token (7 jours) du `localStorage` pour le
placer dans un cookie `httpOnly`, inaccessible au JavaScript, et garder
l'access token (15 min) en mémoire seulement.

**Architecture:** Une origine unique (proxy Next en dev, reverse proxy
en prod) rend `SameSite=Strict` utilisable, ce qui supprime le besoin
d'un jeton anti-CSRF. L'API pose et efface le cookie elle-même sur
`Path=/api/v1/auth` ; le front garde l'access en variable de module et
le régénère par un refresh silencieux au rechargement de page.

**Tech Stack:** Express 5, `cookie-parser`, Next.js 16 (App Router),
axios, Redis (rotation des refresh, déjà en place), TypeScript.

**Spec de référence :**
`docs/superpowers/specs/2026-08-07-refresh-token-cookie-httponly-design.md`

## Global Constraints

- Nom du cookie : `immo_refresh` — valeur exacte, utilisée par l'API et
  les scripts de test.
- Attributs obligatoires : `httpOnly: true`, `sameSite: "strict"`,
  `secure: env.NODE_ENV === "production"`, `path: "/api/v1/auth"`,
  `maxAge: 7 * 24 * 3600 * 1000` (millisecondes — `res.cookie` attend
  des ms, alors que `REFRESH_TTL_S` de Redis est en secondes).
- `clearCookie` doit répéter `path: "/api/v1/auth"` : sans le même
  chemin, le navigateur ignore l'effacement.
- Aucune réponse d'authentification ne contient `refreshToken` dans son
  corps JSON après ce plan.
- Commentaires de code en français, comme le reste du dépôt.
- L'API tourne sur le port 4000, le front sur 3000.
- Ne jamais lancer `test:isolation` (destructif). Les scripts de
  vérification créent leurs propres comptes jetables.

---

## File Structure

**API**
- `apps/api/src/lib/authCookie.ts` — **créé** : un seul endroit qui
  connaît le nom et les attributs du cookie. Trois fonctions pures à
  usage du controller. Isolé pour que les attributs de sécurité ne
  soient jamais recopiés (donc jamais désynchronisés).
- `apps/api/src/modules/auth/controller.ts` — **modifié** : pose le
  cookie, le lit, l'efface ; retire `refreshToken` des corps.
- `apps/api/src/modules/auth/routes.ts` — **modifié** : monte
  `cookie-parser`, et `/logout` cesse d'exiger `requireAuth`.
- `apps/api/src/scripts/testRefreshCookie.ts` — **créé** : prouve le
  cycle complet contre le serveur réel.

**Web**
- `apps/web/next.config.ts` — **modifié** : `rewrites` vers l'API.
- `apps/web/src/lib/session.ts` — **modifié** : ne stocke plus que
  `orgId` ; ajoute l'access en mémoire et le signal de logout.
- `apps/web/src/lib/api.ts` — **modifié** : URL relative, access en
  mémoire, refresh sans corps.
- `apps/web/src/services/auth.service.ts` — **modifié** : signatures
  sans `refreshToken`.
- `apps/web/src/lib/useIdleLogout.ts` — **modifié** : logout sans
  `refreshToken`.
- Pages et shell — **modifiés** : ne passent plus `refreshToken`.

**Contrats**
- `packages/shared/src/index.ts` — **modifié** : `AuthResponse` et
  `TenantRegisterResponse` perdent `refreshToken`.

**Ordre des tâches :** l'API d'abord (elle peut être vérifiée seule),
puis le contrat partagé, puis le front. Chaque tâche laisse le dépôt
compilable.

---

### Task 1: Le module cookie de l'API

**Files:**
- Create: `apps/api/src/lib/authCookie.ts`
- Modify: `apps/api/package.json` (dépendance `cookie-parser`)

**Interfaces:**
- Consumes: `env` depuis `apps/api/src/lib/env.js` (déjà existant,
  expose `NODE_ENV`).
- Produces:
  - `REFRESH_COOKIE: "immo_refresh"`
  - `setRefreshCookie(res: Response, token: string): void`
  - `clearRefreshCookie(res: Response): void`
  - `readRefreshCookie(req: Request): string | undefined`

- [ ] **Step 1: Installer cookie-parser**

```bash
cd apps/api && pnpm add cookie-parser && pnpm add -D @types/cookie-parser
```

- [ ] **Step 2: Créer le module**

Créer `apps/api/src/lib/authCookie.ts` :

```ts
import type { Request, Response } from "express";
import { env } from "./env.js";

/**
 * Un SEUL endroit connaît le nom et les attributs du cookie de refresh.
 * Recopier ces attributs ailleurs, c'est prendre le risque qu'une copie
 * perde `httpOnly` un jour — et la protection avec.
 */
export const REFRESH_COOKIE = "immo_refresh";

// Le chemin restreint est une mesure de sécurité, pas un détail : le
// cookie ne part QUE vers les routes d'authentification, jamais sur les
// centaines d'appels métier qui n'en ont pas besoin.
const COOKIE_PATH = "/api/v1/auth";

// 7 jours, aligné sur REFRESH_TTL_S de auth/service.ts.
// res.cookie attend des MILLISECONDES là où Redis compte en secondes.
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

function options() {
  return {
    httpOnly: true, // hors de portée du JavaScript : tout l'objectif
    sameSite: "strict" as const, // jamais envoyé depuis un autre site
    // Secure exige HTTPS. En développement on est en HTTP : l'activer
    // empêcherait le cookie d'être posé, donc de se connecter.
    secure: env.NODE_ENV === "production",
    path: COOKIE_PATH,
  };
}

/** Rôle : poser le refresh token. Appelé à l'inscription, la connexion
 * et à chaque rotation. */
export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, { ...options(), maxAge: MAX_AGE_MS });
}

/** Rôle : effacer le cookie au logout. Le `path` DOIT être identique à
 * celui de la pose, sinon le navigateur ignore l'effacement et la
 * session paraîtrait ressuscitée au prochain refresh. */
export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, options());
}

/** Rôle : lire le refresh envoyé par le navigateur. Renvoie undefined
 * si absent — l'appelant décide du code HTTP. */
export function readRefreshCookie(req: Request): string | undefined {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[
    REFRESH_COOKIE
  ];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
```

- [ ] **Step 3: Vérifier la compilation**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/authCookie.ts apps/api/package.json pnpm-lock.yaml
git commit -m "Module cookie de refresh : un seul endroit pour les attributs de securite"
```

---

### Task 2: L'API pose, lit et efface le cookie

**Files:**
- Modify: `apps/api/src/modules/auth/controller.ts`
- Modify: `apps/api/src/modules/auth/routes.ts`

**Interfaces:**
- Consumes: `setRefreshCookie`, `clearRefreshCookie`,
  `readRefreshCookie` de la Task 1.
- Produces: les routes `/auth/login`, `/auth/register`,
  `/auth/tenant/register` répondent sans `refreshToken` dans le corps
  et avec un en-tête `Set-Cookie`. `/auth/refresh` et `/auth/logout`
  fonctionnent sans corps de requête.

- [ ] **Step 1: Monter cookie-parser sur le routeur d'auth**

Dans `apps/api/src/modules/auth/routes.ts`, après les imports
existants, ajouter l'import :

```ts
import cookieParser from "cookie-parser";
```

Puis, juste après `export const authRouter = Router();` :

```ts
// Le cookie de refresh n'est lu QUE par les routes d'authentification :
// on monte le parseur ici plutôt que globalement, pour que le reste de
// l'API n'ait aucune raison de connaître ce cookie.
authRouter.use(cookieParser());
```

- [ ] **Step 2: Rendre /logout accessible sans access token valide**

Toujours dans `routes.ts`, remplacer la ligne :

```ts
authRouter.post("/logout", requireAuth, authController.logout);
```

par :

```ts
// PAS de requireAuth : l'access vit désormais en mémoire et disparaît
// au rechargement de page. Exiger un access valide rendrait le logout
// impossible juste après une expiration — le cookie resterait posé,
// donc la session réellement vivante. Le controller révoque ce qu'il
// peut : le refresh (par le cookie) toujours, l'access seulement si un
// jeton exploitable accompagne la requête.
authRouter.post("/logout", authController.logout);
```

- [ ] **Step 3: Poser le cookie aux trois points d'entrée**

Dans `apps/api/src/modules/auth/controller.ts`, ajouter l'import :

```ts
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from "../../lib/authCookie.js";
```

Dans `register`, remplacer :

```ts
    const result = await registerUser(parsed.data);
    return res.status(201).json(result); // 201 = « créé », pas 200
```

par :

```ts
    const { refreshToken, ...result } = await registerUser(parsed.data);
    // Le refresh part en cookie httpOnly, jamais dans le corps : le
    // JavaScript du navigateur ne doit pas pouvoir le lire.
    setRefreshCookie(res, refreshToken);
    return res.status(201).json(result); // 201 = « créé », pas 200
```

Dans `login`, remplacer :

```ts
    const result = await loginUser(parsed.data);
    return res.json(result);
```

par :

```ts
    const { refreshToken, ...result } = await loginUser(parsed.data);
    setRefreshCookie(res, refreshToken);
    return res.json(result);
```

Dans `registerTenant`, remplacer :

```ts
    const result = await registerTenantService(parsed.data);
    return res.status(201).json(result);
```

par :

```ts
    const { refreshToken, ...result } = await registerTenantService(
      parsed.data,
    );
    setRefreshCookie(res, refreshToken);
    return res.status(201).json(result);
```

- [ ] **Step 4: Le refresh lit le cookie au lieu du corps**

Remplacer entièrement la fonction `refresh` par :

```ts
/**
 * Rôle : échanger le refresh token contre une nouvelle paire.
 * Le refresh vient du COOKIE, plus du corps JSON : le navigateur le
 * joint automatiquement, et le JavaScript de la page ne l'a jamais vu.
 * 401 si le refresh est absent, inconnu, déjà utilisé (rotation) ou
 * expiré.
 */
export async function refresh(req: Request, res: Response, next: NextFunction) {
  const current = readRefreshCookie(req);
  if (!current) {
    return res.status(401).json({ error: "Session expirée" });
  }

  try {
    const { refreshToken, ...result } = await refreshSession(current);
    // Rotation : le nouveau refresh remplace l'ancien dans le cookie.
    setRefreshCookie(res, refreshToken);
    return res.json(result);
  } catch (e) {
    if (e instanceof AuthError) {
      // Le refresh est mort : on retire le cookie, sinon le navigateur
      // le renverrait indéfiniment sur chaque tentative.
      clearRefreshCookie(res);
      return res.status(401).json({ error: "Session expirée" });
    }
    return next(e);
  }
}
```

- [ ] **Step 5: Le logout efface le cookie**

Remplacer entièrement la fonction `logout` par :

```ts
/**
 * Rôle : tuer la session — refresh (Redis + cookie) ET jeton d'accès
 * (liste noire) quand il est exploitable.
 *
 * Cette route n'exige PAS d'access valide : après un rechargement de
 * page l'access en mémoire est perdu, et refuser le logout laisserait
 * le cookie en place, donc la session vivante. On révoque toujours ce
 * qu'on peut. 204 sans corps, dans tous les cas : ne rien révéler sur
 * la validité de ce qui a été présenté.
 */
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = readRefreshCookie(req);

    // req.token n'est renseigné que par requireAuth, absent ici : on
    // décode l'access à la main s'il accompagne la requête. `verify`
    // et non `decode` : un jeton non signé ne doit pas pouvoir
    // noircir le jti d'un autre utilisateur.
    let jti: string | undefined;
    let exp: number | undefined;
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      try {
        const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as {
          jti?: string;
          exp?: number;
        };
        jti = payload.jti;
        exp = payload.exp;
      } catch {
        // Access expiré ou invalide : il ne sert plus à rien de le
        // noircir, il est déjà refusé par requireAuth.
      }
    }

    await terminateSession(jti, exp, refreshToken);
    clearRefreshCookie(res);
    return res.status(204).send();
  } catch (e) {
    return next(e);
  }
}
```

Ajouter les deux imports nécessaires en haut du fichier :

```ts
import jwt from "jsonwebtoken";
import { env } from "../../lib/env.js";
```

- [ ] **Step 6: Vérifier la compilation**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/auth/controller.ts apps/api/src/modules/auth/routes.ts
git commit -m "API : refresh token pose, lu et efface en cookie httpOnly"
```

---

### Task 3: Prouver le cycle contre le serveur réel

**Files:**
- Create: `apps/api/src/scripts/testRefreshCookie.ts`
- Modify: `apps/api/package.json` (script `test:refresh-cookie`)

**Interfaces:**
- Consumes: le serveur API lancé sur le port 4000, les routes de la
  Task 2.
- Produces: un script exécutable qui échoue bruyamment si un attribut
  de sécurité manque ou si le cycle est cassé.

**Pourquoi un script plutôt qu'une vérification manuelle :** les trois
propriétés à prouver (attributs du cookie, cycle complet, mort de la
session au logout) doivent rester vraies après chaque modification
future. Une vérification manuelle ne protège que le jour où on la fait.

- [ ] **Step 1: Écrire le script de vérification**

Créer `apps/api/src/scripts/testRefreshCookie.ts` :

```ts
// Prouve le cycle « refresh par cookie » contre le VRAI serveur.
// Terminal A : pnpm --filter @immo/api dev
// Terminal B : pnpm --filter @immo/api test:refresh-cookie
//
// Ce script CRÉE un compte jetable et ne supprime aucune donnée
// existante : il ne vide jamais de table (contrairement à
// test:isolation), donc il est sûr sur une base de développement.
import "dotenv/config";
import assert from "node:assert";

const BASE = `http://localhost:${process.env.PORT ?? 4000}/api/v1`;
const COOKIE = "immo_refresh";

/** Extrait la valeur du cookie de refresh d'un en-tête Set-Cookie. */
function readSetCookie(res: Response): string | undefined {
  const raw = res.headers.get("set-cookie");
  if (!raw) return undefined;
  const match = raw.match(new RegExp(`${COOKIE}=([^;]*)`));
  return match?.[1];
}

async function main() {
  // Email unique : le script est rejouable sans nettoyage préalable.
  const email = `cookie-test-${Date.now()}@immo.cm`;
  const password = "password123";

  // 1. Inscription : le cookie doit être posé, le corps ne doit PAS
  //    contenir le refresh.
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      firstName: "Cookie",
      lastName: "Test",
      orgName: "Test Cookie",
    }),
  });
  assert.equal(reg.status, 201, "inscription refusée");

  const regBody = (await reg.json()) as Record<string, unknown>;
  assert.ok(regBody.token, "pas d'access token dans la réponse");
  assert.equal(
    regBody.refreshToken,
    undefined,
    "FUITE : le refresh est encore dans le corps JSON",
  );

  const setCookie = reg.headers.get("set-cookie") ?? "";
  assert.ok(setCookie.includes(`${COOKIE}=`), "cookie de refresh absent");
  assert.ok(/HttpOnly/i.test(setCookie), "attribut HttpOnly manquant");
  assert.ok(
    /SameSite=Strict/i.test(setCookie),
    "attribut SameSite=Strict manquant",
  );
  assert.ok(
    /Path=\/api\/v1\/auth/i.test(setCookie),
    "attribut Path=/api/v1/auth manquant",
  );
  console.log("✅ 1. cookie posé avec HttpOnly + SameSite=Strict + Path");

  // 2. Connexion : récupère un cookie frais pour la suite.
  const login = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200, "connexion refusée");
  const loginBody = (await login.json()) as {
    token: string;
    refreshToken?: string;
    orgs: { id: string }[];
  };
  assert.equal(
    loginBody.refreshToken,
    undefined,
    "FUITE : refresh dans le corps de /auth/login",
  );

  let refreshValue = readSetCookie(login);
  assert.ok(refreshValue, "pas de cookie à la connexion");
  const orgId = loginBody.orgs[0].id;
  console.log("✅ 2. connexion : cookie posé, corps sans refresh");

  // 3. Appel métier avec l'access : le cycle normal fonctionne.
  const listed = await fetch(`${BASE}/buildings`, {
    headers: {
      Authorization: `Bearer ${loginBody.token}`,
      "X-Org-Id": orgId,
    },
  });
  assert.equal(listed.status, 200, "appel métier refusé avec l'access");
  console.log("✅ 3. appel métier authentifié");

  // 4. Refresh SANS corps : le cookie seul doit suffire.
  const refreshed = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { Cookie: `${COOKIE}=${refreshValue}` },
  });
  assert.equal(refreshed.status, 200, "refresh par cookie refusé");
  const refreshedBody = (await refreshed.json()) as {
    token: string;
    refreshToken?: string;
  };
  assert.ok(refreshedBody.token, "pas de nouvel access après refresh");
  assert.equal(
    refreshedBody.refreshToken,
    undefined,
    "FUITE : refresh dans le corps de /auth/refresh",
  );

  const rotated = readSetCookie(refreshed);
  assert.ok(rotated, "pas de nouveau cookie après refresh");
  assert.notEqual(rotated, refreshValue, "le refresh n'a PAS tourné");
  console.log("✅ 4. refresh par cookie seul, avec rotation");

  // 5. L'ancien refresh est mort (rotation stricte).
  const replay = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { Cookie: `${COOKIE}=${refreshValue}` },
  });
  assert.equal(replay.status, 401, "l'ancien refresh est encore accepté");
  console.log("✅ 5. l'ancien refresh est rejeté (rotation stricte)");

  refreshValue = rotated;

  // 6. Le nouvel access fonctionne sur un appel métier.
  const listed2 = await fetch(`${BASE}/buildings`, {
    headers: {
      Authorization: `Bearer ${refreshedBody.token}`,
      "X-Org-Id": orgId,
    },
  });
  assert.equal(listed2.status, 200, "le nouvel access ne marche pas");
  console.log("✅ 6. appel métier avec le nouvel access");

  // 7. Logout : le cookie est effacé ET le refresh révoqué côté serveur.
  const out = await fetch(`${BASE}/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${refreshedBody.token}`,
      Cookie: `${COOKIE}=${refreshValue}`,
    },
  });
  assert.equal(out.status, 204, "logout refusé");
  const cleared = out.headers.get("set-cookie") ?? "";
  assert.ok(
    cleared.includes(`${COOKIE}=`),
    "le logout n'efface pas le cookie",
  );
  console.log("✅ 7. logout : cookie effacé");

  // 8. LE POINT CRUCIAL : après logout, le refresh ne marche plus.
  //    Prouve que la session est morte côté SERVEUR, pas seulement
  //    dans le navigateur.
  const afterLogout = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { Cookie: `${COOKIE}=${refreshValue}` },
  });
  assert.equal(
    afterLogout.status,
    401,
    "GRAVE : le refresh marche encore après le logout",
  );
  console.log("✅ 8. refresh mort après logout — session réellement tuée");

  console.log("\n🎉 Cycle refresh-par-cookie vérifié de bout en bout.");
}

main().catch((e) => {
  console.error("\n❌ Échec :", e instanceof Error ? e.message : e);
  process.exit(1);
});
```

- [ ] **Step 2: Ajouter le script au package.json**

Dans `apps/api/package.json`, à la suite des autres entrées `test:*` :

```json
    "test:refresh-cookie": "tsx src/scripts/testRefreshCookie.ts",
```

- [ ] **Step 3: Vérifier la compilation**

Run: `cd apps/api && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Lancer le serveur puis le script**

Terminal A :
```bash
pnpm --filter @immo/api dev
```

Terminal B :
```bash
pnpm --filter @immo/api test:refresh-cookie
```

Expected: les huit lignes ✅ puis « Cycle refresh-par-cookie vérifié de
bout en bout. »

Si l'étape 8 échoue, ne pas continuer : cela signifie que la
déconnexion ne tue pas la session côté serveur.

- [ ] **Step 5: Arrêter le serveur de test**

Windows :
```bash
powershell -Command "$c = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue; if ($c) { Stop-Process -Id $c.OwningProcess -Force }"
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/scripts/testRefreshCookie.ts apps/api/package.json
git commit -m "Script de verification du cycle refresh par cookie"
```

---

### Task 4: Retirer refreshToken des contrats partagés

**Files:**
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `AuthResponse` et `TenantRegisterResponse` sans
  `refreshToken`. Toute lecture de ce champ côté web devient une erreur
  de compilation — c'est voulu : le compilateur liste les endroits à
  corriger dans la Task 5.

- [ ] **Step 1: Retirer le champ des deux types**

Dans `packages/shared/src/index.ts`, dans `AuthResponse`, supprimer la
ligne :

```ts
  refreshToken?: string;
```

Et remplacer le commentaire de `TenantRegisterResponse` ainsi que son
corps :

```ts
/** Réponse de POST /auth/tenant/register : aucun bail n'est rattaché
 * automatiquement — `pendingLeases` compte ceux qui attendent la
 * confirmation du propriétaire.
 * Le refresh token n'est PAS dans le corps : il part en cookie
 * httpOnly, hors de portée du JavaScript. */
export type TenantRegisterResponse = {
  token: string;
  pendingLeases: number;
};
```

Ajouter aussi, juste au-dessus d'`AuthResponse`, cette note dans le
commentaire existant :

```ts
 * Le refresh token n'apparaît dans AUCUNE de ces réponses : il est posé
 * en cookie httpOnly par l'API (voir apps/api/src/lib/authCookie.ts).
```

- [ ] **Step 2: Constater les erreurs côté web (attendu)**

Run: `cd apps/web && npx tsc --noEmit`
Expected: ÉCHEC, avec des erreurs sur `d.refreshToken` dans
`login/page.tsx`, `register/page.tsx`,
`register/locataire/page.tsx`. C'est le compilateur qui liste le
travail de la Task 5.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "Contrats partages : le refresh ne transite plus dans le corps JSON"
```

---

### Task 5: Le front garde l'access en mémoire

**Files:**
- Modify: `apps/web/next.config.ts`
- Modify: `apps/web/src/lib/session.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/services/auth.service.ts`
- Modify: `apps/web/src/lib/useIdleLogout.ts`
- Modify: `apps/web/src/app/login/page.tsx`
- Modify: `apps/web/src/app/register/page.tsx`
- Modify: `apps/web/src/app/register/locataire/page.tsx`
- Modify: `apps/web/src/components/shell/Topbar.tsx`
- Modify: `apps/web/src/app/(tenant)/layout.tsx`

**Interfaces:**
- Consumes: `AuthResponse` et `TenantRegisterResponse` de la Task 4 ;
  les routes de la Task 2.
- Produces:
  - `session.ts` : `getAccessToken(): string | null`,
    `setAccessToken(t: string | null): void`, `Session = { orgId?: string }`,
    `signalLogout(): void`
  - `auth.service.ts` : `refresh(): Promise<{ token: string }>`,
    `logout(): Promise<void>`

- [ ] **Step 1: Proxy Next vers l'API**

Remplacer `apps/web/next.config.ts` par :

```ts
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
```

- [ ] **Step 2: L'access en mémoire, le signal de logout**

Remplacer `apps/web/src/lib/session.ts` par :

```ts
import { useSyncExternalStore } from "react";

// La session persistée ne contient plus AUCUN secret : seulement
// l'organisation choisie, que l'API revérifie de toute façon à chaque
// requête (middleware requireOrg).
export type Session = { orgId?: string };

const SESSION_KEY = "immo-session";
const LOGOUT_KEY = "immo-logout";

// ---------- Access token : en mémoire, jamais sur disque ----------
// Une variable de module vit le temps de l'onglet. Au rechargement,
// l'access est perdu et regénéré par un refresh silencieux (le cookie,
// lui, survit). Une XSS ne trouve donc rien de durable à voler.
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// ---------- Présence de session ----------
// Hydration-safe : le serveur répond « pas encore su » (null), le
// client corrige après hydratation. L'événement storage synchronise
// aussi la déconnexion entre onglets.
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

export function useHasSession(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => !!localStorage.getItem(SESSION_KEY),
    () => null,
  );
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    // localStorage corrompu : on repart proprement plutôt que de
    // laisser une exception casser tous les écrans.
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function setSession(s: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  accessToken = null;
}

/**
 * Rôle : prévenir les AUTRES onglets qu'on vient de se déconnecter.
 * Le refresh étant en cookie httpOnly, l'événement storage ne le voit
 * plus : sans ce drapeau, un onglet resté ouvert continuerait jusqu'à
 * sa prochaine expiration d'access (15 min). Sur un poste partagé,
 * c'est trop long.
 * Ce n'est PAS un secret : juste un horodatage qui déclenche
 * l'événement storage.
 */
export function signalLogout() {
  localStorage.setItem(LOGOUT_KEY, String(Date.now()));
}

/**
 * Rôle : réagir au logout d'un autre onglet. Renvoie la fonction de
 * désabonnement.
 */
export function onLogoutSignal(cb: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === LOGOUT_KEY) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
```

- [ ] **Step 3: axios en URL relative, refresh sans corps**

Remplacer `apps/web/src/lib/api.ts` par :

```ts
import axios from "axios";
import { goToLogin } from "./navigation";
import {
  clearSession,
  getAccessToken,
  getSession,
  setAccessToken,
} from "./session";

// URL RELATIVE : le navigateur appelle la même origine que la page, et
// Next (dev) ou le reverse proxy (prod) route vers l'API. C'est ce qui
// rend le cookie SameSite=Strict utilisable.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

// withCredentials : sans lui, axios n'envoie pas le cookie de refresh
// sur /auth/refresh et /auth/logout.
export const api = axios.create({ baseURL: API_URL, withCredentials: true });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Un compte locataire n'a pas d'org : on n'envoie pas d'en-tête vide.
  const orgId = getSession()?.orgId;
  if (orgId) config.headers["X-Org-Id"] = orgId;

  return config;
});

// ---------- Auto-refresh ----------
// Une seule promesse partagée : si 5 requêtes reçoivent un 401 en même
// temps, UN SEUL appel /auth/refresh part (sinon la rotation invalide
// les refresh des autres → déconnexion en cascade).
let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  try {
    // Pas de corps : le cookie httpOnly EST la preuve. axios brut, pas
    // `api` : l'instance interceptée rejouerait ce code en boucle sur
    // un 401 du refresh. withCredentials explicite car on court-circuite
    // l'instance configurée.
    const r = await axios.post<{ token: string }>(
      `${API_URL}/auth/refresh`,
      undefined,
      { withCredentials: true },
    );
    setAccessToken(r.data.token);
    return r.data.token;
  } catch {
    return null; // cookie mort ou absent : la session est finie
  }
}

/**
 * Rôle : restaurer la session après un rechargement de page, où
 * l'access en mémoire est perdu mais le cookie survit.
 * Renvoie true si la session est repartie.
 */
export async function restoreSession(): Promise<boolean> {
  if (getAccessToken()) return true;
  refreshing ??= tryRefresh().finally(() => {
    refreshing = null;
  });
  return (await refreshing) !== null;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      typeof window !== "undefined"
    ) {
      const config = error.config as
        | (typeof error.config & { _retried?: boolean })
        | undefined;

      // Jamais de refresh pour les routes d'auth elles-mêmes (login raté
      // ≠ session expirée), ni pour une requête déjà rejouée une fois.
      const isAuthRoute = (config?.url ?? "").startsWith("/auth/");
      if (config && !config._retried && !isAuthRoute) {
        refreshing ??= tryRefresh().finally(() => {
          refreshing = null;
        });
        const token = await refreshing;
        if (token) {
          config._retried = true;
          config.headers = config.headers ?? {};
          config.headers.Authorization = `Bearer ${token}`;
          return api.request(config);
        }
      }

      clearSession();
      goToLogin();
    }
    return Promise.reject(error);
  },
);

// Le message d'erreur métier du backend vit dans response.data.error.
export function errorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    return (
      (e.response?.data as { error?: string } | undefined)?.error ?? e.message
    );
  }
  return e instanceof Error ? e.message : "Erreur inconnue";
}
```

- [ ] **Step 4: Le service auth sans refreshToken**

Remplacer `apps/web/src/services/auth.service.ts` par :

```ts
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
```

- [ ] **Step 5: useIdleLogout sans refreshToken**

Dans `apps/web/src/lib/useIdleLogout.ts`, remplacer l'import :

```ts
import { clearSession, getSession } from "./session";
```

par :

```ts
import { clearSession, signalLogout } from "./session";
```

Et remplacer le corps de `fire` :

```ts
    const fire = () => {
      // Même instance axios que le reste : intercepteurs inclus.
      // Aucun paramètre : le cookie httpOnly porte le refresh, que le
      // serveur révoque avec l'access.
      api
        .post("/auth/logout")
        .catch(() => {})
        .finally(() => {
          clearSession();
          signalLogout(); // prévient les autres onglets
          goToLogin();
        });
    };
```

- [ ] **Step 6: Les trois pages d'authentification**

Dans `apps/web/src/app/login/page.tsx`, remplacer :

```ts
      // Un locataire n'a aucune org : session sans orgId, espace dédié.
      const orgId = d.orgs?.[0]?.id ?? d.org?.id;
      setSession({ token: d.token, refreshToken: d.refreshToken, orgId });
      router.push(orgId ? "/dashboard" : "/locataire");
```

par :

```ts
      // Un locataire n'a aucune org : session sans orgId, espace dédié.
      const orgId = d.orgs?.[0]?.id ?? d.org?.id;
      setAccessToken(d.token); // en mémoire, jamais sur disque
      setSession({ orgId });
      router.push(orgId ? "/dashboard" : "/locataire");
```

et l'import :

```ts
import { setSession } from "@/lib/session";
```

par :

```ts
import { setAccessToken, setSession } from "@/lib/session";
```

Dans `apps/web/src/app/register/page.tsx`, remplacer :

```ts
      setSession({
        token: d.token,
        refreshToken: d.refreshToken,
        orgId: d.org!.id,
      });
```

par :

```ts
      setAccessToken(d.token);
      setSession({ orgId: d.org!.id });
```

et l'import `setSession` par `setAccessToken, setSession` comme
ci-dessus.

Dans `apps/web/src/app/register/locataire/page.tsx`, remplacer :

```ts
      const d = await authService.registerTenant(form);
      setSession({ token: d.token, refreshToken: d.refreshToken });
      router.push("/locataire");
```

par :

```ts
      const d = await authService.registerTenant(form);
      setAccessToken(d.token);
      // Un locataire n'a pas d'organisation : session sans orgId.
      setSession({});
      router.push("/locataire");
```

et l'import de même.

- [ ] **Step 7: Les deux points de déconnexion**

Dans `apps/web/src/components/shell/Topbar.tsx`, remplacer :

```ts
  async function logout() {
    try {
      await authService.logout(getSession()?.refreshToken);
    } catch {
      // Le serveur est injoignable : la session locale meurt quand même.
    }
    clearSession();
    goToLogin();
  }
```

par :

```ts
  async function logout() {
    try {
      await authService.logout();
    } catch {
      // Le serveur est injoignable : la session locale meurt quand même.
    }
    clearSession();
    signalLogout(); // prévient les autres onglets
    goToLogin();
  }
```

et l'import :

```ts
import { clearSession, getSession } from "@/lib/session";
```

par :

```ts
import { clearSession, getSession, signalLogout } from "@/lib/session";
```

(`getSession` reste utilisé plus bas pour lire `orgId`.)

Dans `apps/web/src/app/(tenant)/layout.tsx`, remplacer :

```ts
      await authService.logout(getSession()?.refreshToken);
```

par :

```ts
      await authService.logout();
```

et, dans la même fonction, après `clearSession();` ajouter :

```ts
    signalLogout();
```

Puis remplacer l'import :

```ts
import { clearSession, getSession, useHasSession } from "@/lib/session";
```

par :

```ts
import { clearSession, signalLogout, useHasSession } from "@/lib/session";
```

- [ ] **Step 8: Vérifier la compilation**

Run: `cd apps/web && npx tsc --noEmit`
Expected: aucune erreur. Si `getSession` est signalé comme inutilisé
dans `(tenant)/layout.tsx`, c'est normal — l'import a été retiré.

- [ ] **Step 9: Commit**

```bash
git add apps/web packages/shared
git commit -m "Front : access token en memoire, refresh porte par le cookie"
```

---

### Task 6: Restaurer la session au rechargement

**Files:**
- Modify: `apps/web/src/app/(app)/layout.tsx`
- Modify: `apps/web/src/app/(tenant)/layout.tsx`

**Interfaces:**
- Consumes: `restoreSession()` de `lib/api.ts` (Task 5),
  `onLogoutSignal()` de `lib/session.ts` (Task 5).
- Produces: les deux coquilles applicatives survivent à un F5 sans
  redemander le mot de passe, et se ferment quand un autre onglet se
  déconnecte.

**Pourquoi cette tâche est séparée :** sans elle, tout rechargement de
page renverrait au login — l'access en mémoire étant perdu. C'est le
changement le plus visible pour l'utilisateur, et il mérite d'être
vérifié seul.

- [ ] **Step 1: Le shell propriétaire**

Remplacer le corps de `apps/web/src/app/(app)/layout.tsx` par :

```tsx
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { restoreSession } from "@/lib/api";
import { clearSession, onLogoutSignal, useHasSession } from "@/lib/session";
import { useIdleLogout } from "@/lib/useIdleLogout";
import { goToLogin } from "@/lib/navigation";
import { MobileNav, Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";

// Coquille des écrans connectés : garde de session + sidebar + topbar.
// useHasSession est hydration-safe : le serveur rend « pas de session »
// (null), le client corrige après hydratation — jamais de mismatch.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hasSession = useHasSession();
  // L'access vit en mémoire : au rechargement il est perdu, et seul le
  // cookie httpOnly peut le régénérer. Tant que ce refresh silencieux
  // n'a pas répondu, on ne rend rien — sinon chaque écran tirerait des
  // requêtes sans jeton, qui échoueraient toutes en 401.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // false = certitude d'absence ; null = hydratation en cours, on attend.
    if (hasSession === false) {
      router.replace("/login");
      return;
    }
    if (hasSession !== true) return;

    let cancelled = false;
    restoreSession().then((ok) => {
      if (cancelled) return;
      if (!ok) {
        // Le cookie est mort : session finie, retour au login.
        clearSession();
        router.replace("/login");
        return;
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hasSession, router]);

  // Déconnexion déclenchée dans un AUTRE onglet : on suit immédiatement,
  // sans attendre l'expiration de l'access (15 min).
  useEffect(() => {
    return onLogoutSignal(() => {
      clearSession();
      goToLogin();
    });
  }, []);

  useIdleLogout(ready);

  if (!hasSession || !ready) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <MobileNav />
        <main className="flex-1 p-16 md:p-24">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Le shell locataire**

Dans `apps/web/src/app/(tenant)/layout.tsx`, appliquer exactement la
même logique. Remplacer les imports par :

```tsx
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { restoreSession } from "@/lib/api";
import { clearSession, onLogoutSignal, signalLogout, useHasSession } from "@/lib/session";
import { useIdleLogout } from "@/lib/useIdleLogout";
import { goToLogin } from "@/lib/navigation";
import { authService } from "@/services/auth.service";
import { Button } from "@/components/ui/Button";
```

Remplacer le début du composant (jusqu'à `useIdleLogout` inclus) par :

```tsx
export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const hasSession = useHasSession();
  // Même raison que le shell propriétaire : l'access est en mémoire et
  // doit être régénéré par le cookie avant de rendre quoi que ce soit.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (hasSession === false) {
      router.replace("/login");
      return;
    }
    if (hasSession !== true) return;

    let cancelled = false;
    restoreSession().then((ok) => {
      if (cancelled) return;
      if (!ok) {
        clearSession();
        router.replace("/login");
        return;
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hasSession, router]);

  useEffect(() => {
    return onLogoutSignal(() => {
      clearSession();
      goToLogin();
    });
  }, []);

  useIdleLogout(ready);
```

Puis remplacer la garde de rendu :

```tsx
  if (!hasSession) return null;
```

par :

```tsx
  if (!hasSession || !ready) return null;
```

- [ ] **Step 3: Vérifier la compilation et le build**

Run: `cd apps/web && npx tsc --noEmit`
Expected: aucune erreur.

Run: `cd apps/web && rm -rf .next && npx next build`
Expected: build vert, 16 routes listées.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app
git commit -m "Front : session restauree au rechargement, deconnexion multi-onglets"
```

---

### Task 7: Vérification de bout en bout

**Files:**
- Aucun fichier modifié : cette tâche vérifie.

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: la preuve que le système fonctionne réellement, pas
  seulement qu'il compile.

- [ ] **Step 1: Les scripts d'auth existants passent toujours**

Terminal A :
```bash
pnpm --filter @immo/api dev
```

Terminal B :
```bash
pnpm --filter @immo/api test:auth
pnpm --filter @immo/api test:session
```

Expected: les deux passent. Ils prouvent que le reste de
l'authentification n'a pas régressé.

Si `test:session` échoue sur le logout, vérifier que la route
`/auth/logout` a bien perdu `requireAuth` (Task 2, Step 2).

- [ ] **Step 2: Le cycle cookie complet**

```bash
pnpm --filter @immo/api test:refresh-cookie
```

Expected: les huit ✅.

- [ ] **Step 3: Vérification manuelle dans le navigateur**

Lancer le front :
```bash
pnpm --filter @immo/web dev
```

Puis, dans le navigateur sur `http://localhost:3000` :

1. Se connecter avec un compte existant.
2. Ouvrir les outils de développement, onglet Application → Cookies →
   `http://localhost:3000`. **Vérifier** que `immo_refresh` est présent,
   avec la case `HttpOnly` cochée et `SameSite` à `Strict`.
3. Onglet Console, taper `document.cookie`. **Vérifier** que
   `immo_refresh` n'apparaît PAS dans le résultat — c'est la propriété
   que toute cette étape achète.
4. Taper `localStorage.getItem("immo-session")`. **Vérifier** que le
   résultat ne contient ni `token` ni `refreshToken`, seulement `orgId`.
5. Recharger la page (F5). **Vérifier** que l'on reste connecté, sans
   passer par le formulaire de login.
6. Ouvrir un second onglet sur le dashboard, se déconnecter dans le
   premier. **Vérifier** que le second onglet retourne au login sans
   attendre.

Si l'étape 3 montre le cookie, `httpOnly` n'est pas appliqué : arrêter
et corriger la Task 1.

- [ ] **Step 4: Arrêter les serveurs**

```bash
powershell -Command "$c = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue; if ($c) { Stop-Process -Id $c.OwningProcess -Force }"
powershell -Command "$c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($c) { Stop-Process -Id $c.OwningProcess -Force }"
```

- [ ] **Step 5: Documenter la variable d'environnement**

Dans `apps/web/.env.example` (le créer s'il n'existe pas) :

```
# Origine de l'API en développement. Le proxy Next (next.config.ts)
# route /api vers cette adresse pour que le navigateur ne voie qu'une
# seule origine — condition du cookie SameSite=Strict.
API_ORIGIN=http://localhost:4000
```

- [ ] **Step 6: Commit final**

```bash
git add apps/web/.env.example
git commit -m "Documentation : API_ORIGIN pour le proxy de developpement"
```

---

## Note de déploiement

Ce plan suppose qu'en production le reverse proxy sert le front et
l'API sous le même domaine, `/api/*` allant vers l'API. Exemple Nginx :

```nginx
location /api/ {
    proxy_pass http://api:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
location / {
    proxy_pass http://web:3000;
}
```

Deux variables d'environnement doivent accompagner ce déploiement :
`NODE_ENV=production` (sans quoi le cookie perd `Secure`) et
`TRUST_PROXY=1` ou plus selon le nombre de sauts.

Ce comportement ne peut pas être vérifié depuis l'environnement de
développement : à confirmer sur l'infrastructure réelle après le
premier déploiement.

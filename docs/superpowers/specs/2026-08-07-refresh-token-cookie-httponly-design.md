# Refresh token en cookie httpOnly

Date : 2026-08-07
Statut : validé, prêt pour plan d'implémentation

## Problème

Les deux jetons d'authentification vivent dans `localStorage`
(`apps/web/src/lib/session.ts`) : l'access token (15 minutes) et le
refresh token (7 jours). Toute faille XSS dans le front donne donc à
l'attaquant une session d'une semaine, renouvelable indéfiniment.

Le refresh est le vrai butin. L'access expire seul en quinze minutes ;
le refresh, lui, permet d'en fabriquer de nouveaux pendant sept jours.

## Décisions

Quatre décisions structurantes, prises avant conception :

1. **Même domaine en production.** Front et API servis sous une origine
   unique derrière un proxy (`app.exemple.cm` et `app.exemple.cm/api`).
   C'est la seule configuration où `SameSite=Strict` protège vraiment :
   en cross-origin il faudrait `SameSite=None`, qui rouvre le CSRF et
   imposerait un jeton anti-CSRF en compensation.
2. **Refresh en cookie, access en mémoire.** Le refresh devient
   inaccessible au JavaScript ; l'access vit en variable de module,
   jamais écrit sur disque. Une XSS ne vole plus qu'une fenêtre de
   quinze minutes, non renouvelable.
3. **Proxy Next en développement.** `rewrites` renvoie `/api` vers
   l'API locale : le navigateur ne voit qu'une origine en dev comme en
   prod. Un cookie qui marche en local marche en production — pas de
   comportement propre au dev.
4. **Coupure nette des sessions existantes**, avec message. L'API
   n'acceptera plus le refresh dans le corps JSON.

## Architecture

### Origine unique

`apps/web/next.config.ts` reçoit une règle `rewrites` : `/api/:path*`
vers `${API_ORIGIN}/api/:path*`, où `API_ORIGIN` vaut
`http://localhost:4000` en développement.

`apps/web/src/lib/api.ts` : `API_URL` par défaut devient `/api/v1` au
lieu de `http://localhost:4000/api/v1`.

Le CORS de l'API n'est plus nécessaire au front (même origine), mais
reste en place pour les webhooks Mobile Money, appelés par un tiers.

### Le cookie

Posé par l'API à l'inscription (propriétaire et locataire), à la
connexion et à chaque refresh :

| Attribut | Valeur | Raison |
|---|---|---|
| `httpOnly` | `true` | Hors de portée du JavaScript — l'objectif |
| `sameSite` | `strict` | Jamais envoyé depuis un autre site : pas de CSRF |
| `secure` | `NODE_ENV === "production"` | HTTPS obligatoire en prod ; désactivé en dev où l'on est en HTTP |
| `path` | `/api/v1/auth` | Le cookie ne circule que sur les routes d'auth, pas sur les appels métier |
| `maxAge` | 7 jours | Aligné sur `REFRESH_TTL_S` existant |

Le corps des réponses d'authentification ne contient plus
`refreshToken`.

### L'access token

Variable de module dans le front, exposée par des fonctions
(`setAccessToken` / `getAccessToken`). Perdue au rechargement de page,
volontairement.

`localStorage` ne conserve plus que `orgId` — un identifiant, pas un
secret : l'API vérifie déjà à chaque requête que l'utilisateur est
membre de cette organisation (`requireOrg`).

## Flux

**Connexion.** Front envoie identifiants → API répond
`{ token, user, orgs }` + `Set-Cookie`. Front garde `token` en mémoire,
`orgId` en `localStorage`, ne voit jamais le refresh.

**Appel métier.** Inchangé : `Authorization: Bearer <access>` et
`X-Org-Id`. Le cookie n'est pas envoyé (son `path` l'en empêche).

**Expiration (401).** L'intercepteur axios appelle `/auth/refresh` sans
corps ; le navigateur joint le cookie. L'API fait tourner le refresh
(rotation stricte `GETDEL` déjà en place), pose le nouveau cookie,
renvoie un nouvel access. La requête d'origine est rejouée. Le
mécanisme *single-flight* existant est conservé : cinq 401 simultanés
ne déclenchent qu'un seul refresh.

**Rechargement de page.** L'access est perdu ; le front appelle
`/auth/refresh` une fois au montage. Cookie valide → session reprise
sans que l'utilisateur voie quoi que ce soit. Sinon → login.

**Déconnexion.** `/auth/logout` supprime le refresh dans Redis, met
l'access sur liste noire, et efface le cookie (`clearCookie` avec le
même `path` — sans quoi le navigateur ignore l'effacement). Le front
vide sa variable mémoire.

## Conséquences traitées

### Déconnexion multi-onglets

Le refresh n'étant plus lisible en JavaScript, l'événement `storage`
ne le voit plus : une déconnexion dans un onglet laisserait les autres
actifs jusqu'à leur prochain 401, soit quinze minutes. Sur un poste
partagé — courant chez un gestionnaire d'immeubles — c'est une
régression de sécurité.

**Solution :** le logout écrit un marqueur horodaté
(`localStorage["immo-logout"] = Date.now()`). L'événement `storage`,
déjà écouté par `useHasSession`, réveille les autres onglets qui
vident leur access en mémoire et repartent au login. Aucun secret
n'est écrit : c'est un drapeau, pas un jeton.

### Scripts de test

Vérification faite : aucun script n'envoie de refresh dans le corps
JSON — le contrat actuel n'est donc pas cassé par le changement.
`testSession.ts` appelle `/auth/logout` (sans `refreshToken`) et reste
valide tel quel.

En revanche, aucun script ne couvre le refresh aujourd'hui. Le cycle
« refresh par cookie » est précisément ce qui doit être prouvé : un
script dédié est à écrire (voir Vérification, point 2). En Node,
`fetch` ne conserve pas les cookies entre appels — il faut lire
l'en-tête `set-cookie` de la réponse et le renvoyer manuellement.

### Sessions existantes

Coupure nette : après déploiement, les refresh en `localStorage` ne
sont plus acceptés. Les utilisateurs se reconnectent une fois.

La double lecture temporaire (accepter cookie *ou* corps JSON pendant
une transition) a été écartée : tant que la route accepte le corps
JSON, un refresh volé en `localStorage` reste utilisable — la faille
qu'on ferme resterait ouverte pendant toute la transition.

Le front affiche « votre session a expiré, reconnectez-vous » plutôt
qu'une redirection sèche.

## Fichiers touchés

Liste établie par recherche sur `refreshToken` dans le code, pas de
mémoire.

**API**
- `modules/auth/controller.ts` — pose et efface le cookie ; ne renvoie
  plus `refreshToken` dans le corps ; lit le cookie au refresh et au
  logout
- `modules/auth/routes.ts` — `cookie-parser` monté sur le routeur d'auth
- `scripts/testRefreshCookie.ts` — **nouveau**, prouve le cycle complet

**Web**
- `next.config.ts` — `rewrites` vers l'API
- `lib/api.ts` — `API_URL` relative ; access en mémoire ; refresh sans
  corps ; message d'expiration
- `lib/session.ts` — ne stocke plus que `orgId` ; signal de logout
- `lib/useIdleLogout.ts` — logout sans `refreshToken`
- `services/auth.service.ts` — signatures `refresh()` et `logout()`
  sans paramètre ; types de réponse sans `refreshToken`
- `app/login/page.tsx`, `app/register/page.tsx`,
  `app/register/locataire/page.tsx` — ne passent plus `refreshToken`
- `components/shell/Topbar.tsx`, `app/(tenant)/layout.tsx` — logout
  sans `refreshToken`

**Contrats partagés**
- `packages/shared/src/index.ts` — `AuthResponse` et
  `TenantRegisterResponse` perdent `refreshToken` ; `RefreshSchema`
  n'est plus utilisé pour le corps (le cookie remplace)

**Dépendance :** `cookie-parser` (+ `@types/cookie-parser`) dans
`apps/api` — vérifié absent aujourd'hui.

## Vérification

1. **Attributs du cookie.** Connexion réelle contre le serveur,
   inspection de `Set-Cookie` : `HttpOnly`, `SameSite=Strict`,
   `Path=/api/v1/auth` présents ; absence de `refreshToken` dans le
   corps JSON.
2. **Cycle complet.** Connexion → appel métier → refresh par cookie
   seul → appel métier avec le nouvel access → logout → refresh après
   logout qui **doit échouer**. Ce dernier point prouve que la
   déconnexion tue la session côté serveur, pas seulement côté
   navigateur.
3. **Inaccessibilité JavaScript.** Le cookie n'apparaît pas dans
   `document.cookie`. C'est la propriété achetée par toute l'étape ;
   ne pas la vérifier reviendrait à supposer le résultat.
4. `testAuth` et `testSession`, inchangés, doivent continuer à passer :
   ils prouvent que le reste de l'authentification n'a pas régressé.
5. `tsc --noEmit` (API) et `next build` (web) verts.

**Hors de portée de la vérification :** le comportement derrière le
proxy de production, inaccessible depuis l'environnement de
développement. Le rewrite Next reproduit la configuration en local, ce
qui couvre le mécanisme mais pas le déploiement final. À confirmer sur
l'infrastructure réelle.

## Ce que cette étape ne fait pas

- L'access token reste vulnérable à une XSS pendant sa durée de vie
  (quinze minutes). Le supprimer entièrement du JavaScript imposerait
  de passer aussi l'access en cookie, ce qui obligerait à réécrire
  `requireAuth`, l'intercepteur, le flux SSE et les treize scripts de
  test — pour un gain marginal, l'access expirant déjà seul.
- Aucune protection CSRF explicite n'est ajoutée : `SameSite=Strict`
  sur une origine unique la rend inutile. Si le déploiement passait un
  jour à des domaines séparés, il faudrait revoir cette décision et
  ajouter un jeton anti-CSRF.

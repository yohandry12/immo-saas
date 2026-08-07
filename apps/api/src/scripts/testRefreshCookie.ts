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

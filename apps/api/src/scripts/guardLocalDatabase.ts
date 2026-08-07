/**
 * Garde-fou des scripts DESTRUCTIFS.
 *
 * Certains scripts de test vident des tables entières (deleteMany sans
 * where). Lancés par erreur avec la DATABASE_URL de production dans
 * l'environnement, ils effacent la comptabilité de tous les clients —
 * une perte irréversible que rien ne rattrape.
 *
 * Règle : on n'autorise la destruction que si la base est manifestement
 * une base locale ou de test. Le doute profite TOUJOURS aux données :
 * URL absente, illisible ou distante = on refuse de démarrer.
 */

/** Hôtes considérés comme « ma machine ». */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Un nom de base qui annonce clairement son statut jetable. */
const DISPOSABLE_NAME = /(^|[_-])(test|dev|local)([_-]|$)/i;

export type GuardVerdict =
  | { safe: true; reason: string }
  | { safe: false; reason: string };

/**
 * Rôle : juger une DATABASE_URL sans effet de bord — testable, et
 * réutilisable par n'importe quel script destructif.
 */
export function judgeDatabaseUrl(raw: string | undefined): GuardVerdict {
  if (!raw) {
    return { safe: false, reason: "DATABASE_URL absente de l'environnement." };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { safe: false, reason: "DATABASE_URL illisible (URL invalide)." };
  }

  const host = url.hostname.toLowerCase();
  // pathname = "/immo" → on retire le "/" de tête.
  const database = url.pathname.replace(/^\//, "");

  if (LOCAL_HOSTS.has(host)) {
    return { safe: true, reason: `base locale (${host}/${database})` };
  }

  if (DISPOSABLE_NAME.test(database)) {
    return { safe: true, reason: `base de test déclarée (${host}/${database})` };
  }

  return {
    safe: false,
    reason:
      `la base « ${database} » sur « ${host} » n'est ni locale ni nommée ` +
      `test/dev/local. Refus par précaution.`,
  };
}

/**
 * Rôle : à appeler EN PREMIER dans tout script qui détruit des données.
 * Arrête le processus (code 1) plutôt que de risquer la vraie base.
 *
 * @param scriptName - nom affiché dans le message de refus
 */
export function guardLocalDatabase(scriptName: string): void {
  // Un script destructif n'a rien à faire en production, quelle que
  // soit l'URL : deuxième verrou, indépendant du premier.
  if (process.env.NODE_ENV === "production") {
    console.error(
      `\n❌ ${scriptName} est un script DESTRUCTIF : interdit en production.\n`,
    );
    process.exit(1);
  }

  const verdict = judgeDatabaseUrl(process.env.DATABASE_URL);

  if (!verdict.safe) {
    console.error(
      `\n❌ ${scriptName} efface des tables entières et refuse de tourner :\n` +
        `   ${verdict.reason}\n\n` +
        `   Pointez DATABASE_URL vers une base locale (localhost) ou une\n` +
        `   base dont le nom contient test/dev/local, puis relancez.\n`,
    );
    process.exit(1);
  }

  console.log(`🛡️  ${scriptName} : ${verdict.reason} — destruction autorisée.`);
}

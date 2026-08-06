import { EventEmitter } from "node:events";

// Un émetteur global, un topic par organisation.
// MVP une seule instance d'API : la mémoire suffit.
// Le jour où l'API tourne sur 2+ serveurs, remplacer ce bus par
// Redis pub/sub sans toucher aux appelants — c'est ça, l'interface stable.
const emitter = new EventEmitter();

export const eventBus = {
  publish(orgId: string, event: unknown) {
    emitter.emit(orgId, event);
  },
  // Renvoie une fonction de désabonnement : le controller SSE
  // l'appellera à la fermeture de la connexion.
  subscribe(orgId: string, cb: (event: unknown) => void) {
    emitter.on(orgId, cb);
    return () => emitter.off(orgId, cb);
  },
};

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { errorMessage } from "@/lib/api";
import { getSession } from "@/lib/session";
import { useActivityFeed } from "@/lib/useActivityFeed";
import { buildingsService } from "@/services/buildings.service";
import { paymentsService } from "@/services/payments.service";
import type { Building, Payment, Unit } from "@/services/types";

const box = {
  border: "1px solid #ccc",
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
} as const;

const input = {
  display: "block",
  width: "100%",
  padding: 8,
  marginBottom: 8,
} as const;

export default function PaiementDirectPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  // Plus de state `units` : selectedBuildingUnits le dérive directement.
  const [buildingId, setBuildingId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"MOMO" | "ORANGE_MONEY">("MOMO");
  const [paymentUrl, setPaymentUrl] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState("");

  // isReady = dérivé direct de la session, pas un state.
  // Plus de setState synchrones dans un effect.
  const isReady = !!getSession();

  // Garde de session + idle logout : gérés par le layout (app).
  const events = useActivityFeed(isReady);

  const refreshPayments = useCallback(() => {
    paymentsService
      .list()
      .then(setPayments)
      .catch(() => {});
  }, []);

  // Chargement des immeubles — une seule fois, après le montage.
  useEffect(() => {
    if (!getSession()) return;
    buildingsService
      .list()
      .then(setBuildings)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, []);

  // Chargement initial des paiements.
  useEffect(() => {
    if (isReady) refreshPayments();
  }, [isReady, refreshPayments]);

  // Rafraîchir les paiements quand un événement arrive.
  useEffect(() => {
    if (isReady && events.length > 0) refreshPayments();
  }, [events.length, isReady, refreshPayments]);

  // Dérivation des unités selon l'immeuble sélectionné.
  // C'est lui qui remplace l'ancien useEffect + setUnits([]).
  const selectedBuildingUnits = useMemo<Unit[]>(() => {
    if (!buildingId) return [];
    const building = buildings.find((b) => b.id === buildingId);
    return building?.units ?? [];
  }, [buildingId, buildings]);

  async function initiate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPaymentUrl("");
    try {
      const res = await paymentsService.initiateMomo({
        unitId,
        method,
        payerPhone: phone,
      });
      setPaymentUrl(res.paymentUrl);
      refreshPayments();
    } catch (err: unknown) {
      setError(errorMessage(err));
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1>Paiement direct</h1>

      <div style={box}>
        <form onSubmit={initiate}>
          <select
            style={input}
            value={buildingId}
            onChange={(e) => {
              setBuildingId(e.target.value);
              setUnitId("");
            }}
          >
            <option value="">— immeuble —</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            style={input}
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
          >
            <option value="">— appartement —</option>
            {selectedBuildingUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label} — {u.rentAmount} FCFA
              </option>
            ))}
          </select>

          <input
            style={input}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+237699000001"
            required
          />

          <select
            style={input}
            value={method}
            onChange={(e) =>
              setMethod(e.target.value as "MOMO" | "ORANGE_MONEY")
            }
          >
            <option value="MOMO">MTN Mobile Money</option>
            <option value="ORANGE_MONEY">Orange Money</option>
          </select>

          {error && <p style={{ color: "crimson" }}>{error}</p>}

          <button type="submit" style={{ padding: 8 }}>
            Demander le paiement
          </button>
        </form>

        {paymentUrl && (
          <p style={{ marginTop: 12 }}>
            Lien de paiement :{" "}
            <a href={paymentUrl} target="_blank" rel="noreferrer">
              {paymentUrl}
            </a>
          </p>
        )}
      </div>

      <div style={box}>
        <h2>En direct</h2>
        <ul>
          {events.length === 0 && <li>En attente d&apos;événements…</li>}
          {events.slice(0, 8).map((e, i) => (
            <li key={i}>
              {e.type} — {JSON.stringify(e.payload)}
            </li>
          ))}
        </ul>
      </div>

      <div style={box}>
        <h2>Journal des paiements</h2>
        <ul>
          {payments.length === 0 && <li>Aucun paiement.</li>}
          {payments.slice(0, 10).map((p) => (
            <li key={p.id}>
              {p.unit?.label} — {p.amount} FCFA — {p.method} —{" "}
              <strong>{p.status}</strong>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

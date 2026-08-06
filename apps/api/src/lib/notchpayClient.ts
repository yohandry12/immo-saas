import { createHmac, timingSafeEqual } from "node:crypto";
import type { MomoClient, MomoInitiateInput } from "./momoClient.js";

const BASE = "https://api.notchpay.co";

// Codes réseaux NotchPay pour le Cameroun.
const CHANNELS: Record<MomoInitiateInput["method"], string> = {
  MOMO: "cm.mtn",
  ORANGE_MONEY: "cm.orange",
};

// Comparaison à temps constant, sans planter si les longueurs diffèrent.
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export const notchpayClient: MomoClient = {
  async initiate({ reference, amount, payerPhone, description, method }) {
    const res = await fetch(`${BASE}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // NotchPay : la clé privée telle quelle, sans préfixe Bearer.
        Authorization: process.env.NOTCHPAY_PRIVATE_KEY!,
      },
      body: JSON.stringify({
        amount,
        currency: "XAF",
        // Champ requis par NotchPay : adresse technique déterministe,
        // une par paiement, jamais celle d'un vrai utilisateur.
        email: `paiement+${reference}@immo-saas.cm`,
        phone: payerPhone.replace(/\D/g, ""),
        reference,
        description,
        callback: process.env.NOTCHPAY_WEBHOOK_URL,
        locked_currency: "XAF",
        locked_country: "CM",
        locked_channel: CHANNELS[method],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(
        `NotchPay initiate ${res.status} : ${JSON.stringify(err)}`,
      );
    }

    // authorization_url = la page de paiement à envoyer au locataire.
    const data = (await res.json()) as { authorization_url?: string };
    if (!data.authorization_url)
      throw new Error("NotchPay : authorization_url absente");
    return { paymentUrl: data.authorization_url };
  },

  verifySignature(rawBody, signature) {
    if (!signature) return false;
    const hash = process.env.NOTCHPAY_HASH_KEY!;

    // Cas nominal : signature du body brut reçu.
    const expected = createHmac("sha256", hash).update(rawBody).digest("hex");
    if (safeEqual(expected, signature)) return true;

    // Repli : l'exemple officiel NotchPay signe le JSON re-sérialisé.
    try {
      const reserialized = JSON.stringify(JSON.parse(rawBody.toString("utf8")));
      const expected2 = createHmac("sha256", hash)
        .update(reserialized)
        .digest("hex");
      return safeEqual(expected2, signature);
    } catch {
      return false;
    }
  },

  parseWebhook(body) {
    // Défensif : la référence et le statut peuvent être nichés.
    const b = body as Record<string, any>;
    const reference =
      b?.reference ?? b?.transaction?.reference ?? b?.data?.reference;
    const status = String(
      b?.status ?? b?.transaction?.status ?? "",
    ).toUpperCase();
    if (!reference) return null;
    return {
      reference,
      success: ["PAID", "SUCCESS", "COMPLETED"].includes(status),
    };
  },
};

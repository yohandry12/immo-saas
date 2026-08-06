import { MomoWebhookSchema } from '@immo/shared';
import { notchpayClient } from './notchpayClient.js';

export interface MomoInitiateInput {
  reference: string;
  amount: number;
  payerPhone: string;
  description: string;
  method: 'MOMO' | 'ORANGE_MONEY';
}

export interface MomoInitiateResult {
  paymentUrl: string;
}

export interface MomoClient {
  initiate(input: MomoInitiateInput): Promise<MomoInitiateResult>;
  verifySignature(rawBody: Buffer, signature: string | undefined): boolean;
  // Chaque agrégateur a son format de webhook : c'est LUI qui le parse.
  parseWebhook(body: unknown): { reference: string; success: boolean } | null;
}

const mockClient: MomoClient = {
  async initiate({ reference }) {
    return { paymentUrl: `http://localhost:4000/mock-checkout/${reference}` };
  },
  verifySignature() {
    return true;
  },
  parseWebhook(body) {
    const parsed = MomoWebhookSchema.safeParse(body);
    return parsed.success
      ? { reference: parsed.data.reference, success: parsed.data.status === 'SUCCESS' }
      : null;
  },
};

export function getMomoClient(): MomoClient {
  // Le choix vit dans l'env : mock pour les tests automatisés,
  // notchpay pour la validation sandbox en manuel.
  if (process.env.MOMO_PROVIDER === 'notchpay') return notchpayClient;
  return mockClient;
}
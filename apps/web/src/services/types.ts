// Miroir frontend des contrats backend (schémas zod).
// Si le backend change, ce fichier change avec lui.
export type Role = "OWNER" | "MANAGER" | "TENANT";

export type AuthResponse = {
  token: string;
  refreshToken?: string;
  user: {
    id: string;
    email?: string | null;
    firstName: string;
    lastName: string;
  };
  org?: { id: string; name: string };
  orgs?: { id: string; name: string; role: Role }[];
};

export type Unit = {
  id: string;
  label: string;
  rentAmount: number;
  occupants: number;
  surfaceM2?: number | null;
};

export type Building = {
  id: string;
  name: string;
  city: string;
  units?: Unit[];
  _count?: { units: number };
};

export type Payment = {
  id: string;
  kind: "RENT" | "CHARGE" | "DEPOSIT";
  method: "CASH" | "MOMO" | "ORANGE_MONEY" | "BANK";
  amount: number;
  status: "PENDING" | "CONFIRMED" | "FAILED";
  recordedByName?: string | null;
  paidAt?: string | null;
  unit?: { label: string };
};

export type Summary = {
  period: string;
  expectedRent: number;
  collectedRent: number;
  outstandingRent: number;
  depositsHeld: number;
  occupancy: { total: number; occupied: number; rate: number };
  unpaidUnits: { label: string; tenantName: string | null; due: number }[];
};

export type FeedEvent = {
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

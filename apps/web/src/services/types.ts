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
  floor?: number | null;
  surfaceM2?: number | null;
  // Bail actif renvoyé par GET /buildings/:id — occupé si non vide.
  leases?: { id: string; tenantName: string | null; rentAmount: number }[];
};

export type Building = {
  id: string;
  name: string;
  city: string;
  address?: string | null;
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
  createdAt?: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  unit?: { label: string };
};

export type Lease = {
  id: string;
  // null = le locataire n'a pas (encore) de compte rattaché à ce bail.
  tenantId?: string | null;
  tenantName: string | null;
  tenantPhone: string | null;
  rentAmount: number;
  advanceMonths: number;
  depositAmount: number | null;
  startDate: string;
  endDate: string | null;
  unit: { label: string; building: { name: string } };
};

export type ChargeBill = {
  id: string;
  buildingId: string;
  type: string;
  amount: number;
  period: string;
  rule: "EQUAL" | "BY_AREA" | "BY_OCCUPANTS" | "CUSTOM";
  status: "DRAFT" | "SENT";
  createdAt: string;
  building: { name: string };
  allocations: {
    id: string;
    amount: number;
    paid: boolean;
    unit: { label: string };
  }[];
};

export type Expense = {
  id: string;
  buildingId: string;
  category: string;
  amount: number;
  description: string;
  photos: string[];
  createdAt: string;
  building?: { name: string };
};

export type Member = {
  id: string;
  role: Role;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  };
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

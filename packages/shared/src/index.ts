import { z } from "zod";

// ---------- Contrats d'authentification ----------
// Ces schémas sont LE contrat entre front et back :
// le formulaire web valide avec, l'API revalide avec.
// ---------- Normalisation téléphone (Cameroun, MVP) ----------
// « 699 000 001 », « +237 699 000 001 », « 237699000001 » → « +237699000001 ».
// C'est LA clé de rattachement bail ↔ compte locataire :
// elle doit être appliquée à CHAQUE écriture de téléphone.
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, ""); // ne garde que les chiffres
  if (digits.startsWith("237")) return `+${digits}`;
  if (digits.length === 9) return `+237${digits}`; // numéro local camerounais
  return `+${digits}`;
}

// Échange refresh token → nouvelle paire access + refresh.
export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof RefreshSchema>;

// Le login accepte désormais email OU téléphone.
export const LoginSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(1).optional(),
    password: z.string().min(8),
  })
  .refine((d) => d.email || d.phone, {
    message: "Email ou téléphone requis",
  });

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  // Le propriétaire diaspora nomme son "portefeuille" à l'inscription
  orgName: z.string().min(1),
});
// ---------- Contrats immeubles & appartements ----------
export const CreateBuildingSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  city: z.string().min(1),
});
export type CreateBuildingInput = z.infer<typeof CreateBuildingSchema>;

export const CreateUnitSchema = z.object({
  label: z.string().min(1),
  floor: z.number().int().optional(),
  surfaceM2: z.number().positive().optional(),
  occupants: z.number().int().positive().default(1),
  rentAmount: z.number().int().positive(),
  // « Appartement occupé à la création » : déclare le bail en place
  // dans le même geste, sans second formulaire.
  lease: z
    .object({
      tenantName: z.string().min(1),
      tenantPhone: z.string().min(1),
      rentAmount: z.number().int().positive().optional(),
      advanceMonths: z.number().int().positive().default(1),
      depositAmount: z.number().int().nonnegative().optional(),
      startDate: z.string().datetime().optional(),
    })
    .optional(),
});

// ---------- Contrats paiements ----------
// Les valeurs de kind/method doivent rester ALIGNÉES avec les enums
// Prisma PaymentKind/PaymentMethod. Si tu ajoutes une méthode de
// paiement en base, ajoute-la ici aussi.
export const RecordPaymentSchema = z
  .object({
    unitId: z.string().min(1),
    kind: z.enum(["RENT", "CHARGE", "DEPOSIT"]),
    method: z.enum(["CASH", "MOMO", "ORANGE_MONEY", "BANK"]),
    amount: z.number().int().positive(),
    paidAt: z.string().datetime().optional(),
    // Format "AAAA-MM". periodTo sans periodFrom n'a pas de sens.
    periodFrom: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
    periodTo: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
  })
  .refine((d) => !d.periodTo || !!d.periodFrom, {
    message: "periodTo exige periodFrom",
  });
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;

// Pagination commune : les query params arrivent en strings, coerce les
// convertit. Bornée à 200 : personne ne télécharge la table entière.
export const PaginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const ListPaymentsQuerySchema = z.object({
  unitId: z.string().optional(),
  kind: z.enum(["RENT", "CHARGE", "DEPOSIT"]).optional(),
  status: z.enum(["PENDING", "CONFIRMED", "FAILED"]).optional(),
  ...PaginationSchema.shape,
});
export type ListPaymentsQuery = z.infer<typeof ListPaymentsQuerySchema>;
// ---------- Contrats baux ----------
export const CreateLeaseSchema = z.object({
  unitId: z.string().min(1),
  tenantName: z.string().min(1),
  tenantPhone: z.string().min(1),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  // Absent = loyer actuel de l'appartement.
  rentAmount: z.number().int().positive().optional(),
  advanceMonths: z.number().int().positive().default(1),
  depositAmount: z.number().int().nonnegative().optional(),
});
export type CreateLeaseInput = z.infer<typeof CreateLeaseSchema>;

// Les query params arrivent en STRINGS : on valide 'true'/'false'.
export const ListLeasesQuerySchema = z.object({
  active: z.enum(["true", "false"]).optional(),
  ...PaginationSchema.shape,
});
export type ListLeasesQuery = z.infer<typeof ListLeasesQuerySchema>;

export const TerminateLeaseSchema = z.object({
  endDate: z.string().datetime().optional(), // absent = aujourd'hui
});
export type TerminateLeaseInput = z.infer<typeof TerminateLeaseSchema>;
// ---------- Contrats dashboard ----------
export const DashboardQuerySchema = z.object({
  // « AAAA-MM » ; absent = mois courant.
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});
// ---------- Contrats Mobile Money ----------
export const InitiateMomoPaymentSchema = z.object({
  unitId: z.string().min(1),
  method: z.enum(["MOMO", "ORANGE_MONEY"]),
  payerPhone: z.string().min(1),
  amount: z.number().int().positive().optional(), // absent = loyer de l'appartement
  periodFrom: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  periodTo: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});
export type InitiateMomoPaymentInput = z.infer<
  typeof InitiateMomoPaymentSchema
>;

// Ce que l'agrégateur nous renvoie quand le locataire a tapé son code PIN.
export const MomoWebhookSchema = z.object({
  reference: z.string().min(1),
  status: z.enum(["SUCCESS", "FAILED"]),
});
export type MomoWebhookInput = z.infer<typeof MomoWebhookSchema>;
// ---------- Contrats charges communes ----------
export const CreateChargeBillSchema = z
  .object({
    buildingId: z.string().min(1),
    type: z.string().min(1), // "WATER" | "ELECTRICITY" | "OTHER"
    amount: z.number().int().positive(),
    period: z.string().regex(/^\d{4}-\d{2}$/),
    rule: z.enum(["EQUAL", "BY_AREA", "BY_OCCUPANTS", "CUSTOM"]),
    // Règle CUSTOM uniquement : la répartition écrite à la main.
    customAllocations: z
      .array(
        z.object({
          unitId: z.string().min(1),
          amount: z.number().int().positive(),
        }),
      )
      .optional(),
  })
  .refine(
    (d) => d.rule !== "CUSTOM" || (d.customAllocations?.length ?? 0) > 0,
    {
      message: "La règle CUSTOM exige une liste customAllocations",
    },
  );
export type CreateChargeBillInput = z.infer<typeof CreateChargeBillSchema>;

export const ListChargesQuerySchema = z.object({
  buildingId: z.string().optional(),
});
export type ListChargesQuery = z.infer<typeof ListChargesQuerySchema>;

export const MarkAllocationPaidSchema = z.object({
  method: z.enum(["CASH", "MOMO", "ORANGE_MONEY", "BANK"]).default("CASH"),
});
export type MarkAllocationPaidInput = z.infer<typeof MarkAllocationPaidSchema>;
export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;
export const TenantRegisterSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});
// ---------- Contrats dépenses ----------
export const CreateExpenseSchema = z.object({
  buildingId: z.string().min(1),
  category: z.string().min(1), // "PLUMBING" | "ELECTRIC" | "OTHER"...
  amount: z.number().int().positive(),
  description: z.string().min(1),
  // URLs pré-uploadées vers un stockage objet. Pas d'upload ici :
  // le front s'en charge et envoie les URLs finales.
  photos: z.array(z.string().url()).default([]),
});
export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;

export const ListExpensesQuerySchema = z.object({
  buildingId: z.string().optional(),
});

// ---------- Contrats organisation ----------
export const InviteManagerSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(1).optional(),
    password: z.string().min(8),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
  })
  .refine((d) => d.email || d.phone, { message: "Email ou téléphone requis" });
export type InviteManagerInput = z.infer<typeof InviteManagerSchema>;
export type ListExpensesQuery = z.infer<typeof ListExpensesQuerySchema>;
export type CreateUnitInput = z.infer<typeof CreateUnitSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type TenantRegisterInput = z.infer<typeof TenantRegisterSchema>;

// ---------- Contrats de RÉPONSE de l'API ----------
// Jusqu'ici ce package ne décrivait que les ENTRÉES (schémas zod des
// requêtes). Les formes renvoyées par l'API vivaient en double : une
// fois implicitement dans les services, une fois recopiées à la main
// dans apps/web. Ces types sont désormais la source unique.
//
// Convention : ce sont les formes vues par le CLIENT, APRÈS sérialisation
// JSON — d'où les dates en `string` et non en `Date`.

/** Rôle d'un membre dans un portefeuille. */
export type Role = "OWNER" | "MANAGER" | "TENANT";

export type PaymentKind = "RENT" | "CHARGE" | "DEPOSIT";
export type PaymentMethod = "CASH" | "MOMO" | "ORANGE_MONEY" | "BANK";
export type PaymentStatus = "PENDING" | "CONFIRMED" | "FAILED";
export type ChargeRule = "EQUAL" | "BY_AREA" | "BY_OCCUPANTS" | "CUSTOM";
export type ChargeBillStatus = "DRAFT" | "SENT";

/**
 * Réponse d'authentification. `org` est renvoyé par /auth/register
 * (une seule org créée), `orgs` par /auth/login et /auth/me.
 * Les DEUX sont absents pour un compte locataire : il n'a pas de
 * portefeuille — d'où l'optionnalité, que le front doit gérer.
 * Le refresh token n'apparaît dans AUCUNE de ces réponses : il est posé
 * en cookie httpOnly par l'API (voir apps/api/src/lib/authCookie.ts).
 */
export type AuthResponse = {
  token: string;
  user: {
    id: string;
    email?: string | null;
    firstName: string;
    lastName: string;
  };
  org?: { id: string; name: string };
  orgs?: { id: string; name: string; role: Role }[];
};

/** Réponse de POST /auth/tenant/register : aucun bail n'est rattaché
 * automatiquement — `pendingLeases` compte ceux qui attendent la
 * confirmation du propriétaire.
 * Le refresh token n'est PAS dans le corps : il part en cookie
 * httpOnly, hors de portée du JavaScript. */
export type TenantRegisterResponse = {
  token: string;
  pendingLeases: number;
};

export type UnitResponse = {
  id: string;
  label: string;
  rentAmount: number;
  occupants: number;
  floor?: number | null;
  surfaceM2?: number | null;
  // Bail actif renvoyé par GET /buildings/:id — occupé si non vide.
  leases?: { id: string; tenantName: string | null; rentAmount: number }[];
};

export type BuildingResponse = {
  id: string;
  name: string;
  city: string;
  address?: string | null;
  units?: UnitResponse[];
  _count?: { units: number };
};

export type PaymentResponse = {
  id: string;
  kind: PaymentKind;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  recordedByName?: string | null;
  paidAt?: string | null;
  createdAt?: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  unit?: { label: string };
};

export type LeaseResponse = {
  id: string;
  // null = aucun compte locataire rattaché à ce bail. Le rattachement
  // est un acte du propriétaire (POST /leases/:id/attach-tenant).
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

export type ChargeBillResponse = {
  id: string;
  buildingId: string;
  type: string;
  amount: number;
  period: string;
  rule: ChargeRule;
  status: ChargeBillStatus;
  createdAt: string;
  building: { name: string };
  allocations: {
    id: string;
    amount: number;
    paid: boolean;
    unit: { label: string };
  }[];
};

export type ExpenseResponse = {
  id: string;
  buildingId: string;
  category: string;
  amount: number;
  description: string;
  photos: string[];
  createdAt: string;
  building?: { name: string };
};

export type MemberResponse = {
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

/** Le « mois en 10 secondes » : ce que le dashboard affiche en haut. */
export type SummaryResponse = {
  period: string;
  expectedRent: number;
  collectedRent: number;
  outstandingRent: number;
  depositsHeld: number;
  occupancy: { total: number; occupied: number; rate: number };
  unpaidUnits: {
    leaseId: string; // pour ouvrir la fiche du bail depuis le dashboard
    label: string;
    tenantName: string | null;
    due: number;
    daysLate: number; // jours de retard (mois courant) ; 0 si à jour
  }[];
  // Le MÊME jour du mois précédent : « bon » n'a de sens que par
  // comparaison. Un 78 % le 8 du mois se juge contre le 8 d'avant, pas
  // contre 100 %. Le front en tire le verdict (en avance / en retard).
  previousAtSameDay: {
    collectedRent: number; // encaissé cumulé au même jour, mois -1
    expectedRent: number; // attendu du mois -1 (dénominateur du taux)
  };
  // Encaissements des 6 derniers mois (le mois demandé inclus, en
  // dernier). Un sparkline sous le héros : la tendance répond à « le mois
  // est-il bon ? » là où un chiffre isolé ne le peut pas.
  trend: { period: string; collectedRent: number }[];
  // Taille du portefeuille : ne dépend pas du mois, mais fourni ici pour
  // éviter un second appel réseau (important sur 3G).
  portfolio: {
    buildings: number;
    units: number;
    // Appartements occupés (bail en vigueur) le mois demandé — même
    // compteur que occupancy.occupied. Convention MVP : 1 occupé = 1 locataire.
    activeTenants: number;
  };
  // Dépenses déclarées ce mois : le « sortant » face au « rentrant ».
  monthlyExpenses: number;
};

/** Événement du flux d'activité (SSE et historique). */
export type FeedEvent = {
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

/** Écran d'accueil du locataire : son logement, son mois. */
export type TenantHomeResponse = {
  period: string;
  leases: {
    id: string;
    unitLabel: string;
    buildingName: string;
    city: string;
    rentAmount: number;
    rentPaidForCurrentMonth: boolean;
    unpaidCharges: {
      id: string;
      type: string;
      period: string;
      amount: number;
    }[];
  }[];
};

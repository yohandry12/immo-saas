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

export const ListPaymentsQuerySchema = z.object({
  unitId: z.string().optional(),
  kind: z.enum(["RENT", "CHARGE", "DEPOSIT"]).optional(),
  status: z.enum(["PENDING", "CONFIRMED", "FAILED"]).optional(),
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

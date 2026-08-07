// Les contrats de l'API vivent dans @immo/shared — source unique,
// partagée avec le backend. Ce fichier n'est plus qu'un alias local :
// il donne aux écrans les noms courts (Building, Lease…) sans que
// personne n'ait à re-décrire les formes à la main.
export type {
  AuthResponse,
  FeedEvent,
  Role,
  TenantRegisterResponse,
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
  ChargeRule,
  ChargeBillStatus,
} from "@immo/shared";

export type {
  BuildingResponse as Building,
  ChargeBillResponse as ChargeBill,
  ExpenseResponse as Expense,
  LeaseResponse as Lease,
  MemberResponse as Member,
  PaymentResponse as Payment,
  SummaryResponse as Summary,
  TenantHomeResponse as TenantHome,
  UnitResponse as Unit,
} from "@immo/shared";

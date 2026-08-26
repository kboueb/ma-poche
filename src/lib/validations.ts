import { z } from "zod";

export const transactionSchema = z.object({
  amount: z.coerce.number().positive("Le montant doit être supérieur à 0"),
  flow: z.enum(["income", "expense", "transfer"]),
  date: z.string().min(1, "La date est requise"),
  account_id: z.string().min(1, "Le compte est requis"),
  transfer_to_account_id: z.string().nullable().optional(),
  category_id: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  recurrence_rule: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
}).refine(
  (data) => data.flow !== "transfer" || (data.transfer_to_account_id && data.transfer_to_account_id.length > 0),
  { message: "Le compte de destination est requis pour un virement", path: ["transfer_to_account_id"] }
);

export const accountSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  type: z.string().min(1, "Le type est requis"),
  institution: z.string().optional(),
  initial_balance: z.coerce.number(),
  currency: z.string().default("XOF"),
  color: z.string().default("#10b981"),
});

export const budgetSchema = z.object({
  category_id: z.string().min(1, "La catégorie est requise"),
  amount: z.coerce.number().positive("Le montant doit être supérieur à 0"),
  period: z.enum(["monthly", "yearly"]).default("monthly"),
  active_from: z.string().min(1),
  active_to: z.string().nullable().optional(),
  rollover: z.boolean().default(false),
  alert_threshold: z.coerce.number().min(1).max(100).default(80),
});

export const assetSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  type: z.string().min(1, "Le type est requis"),
  current_value: z.coerce.number().positive("La valeur doit être supérieure à 0"),
  purchase_price: z.coerce.number().nullable().optional(),
});

export const liabilitySchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  type: z.string().min(1, "Le type est requis"),
  initial_amount: z.coerce.number().positive("Le montant doit être supérieur à 0"),
  remaining_amount: z.coerce.number().positive("Le montant doit être supérieur à 0"),
  interest_rate: z.coerce.number().nullable().optional(),
  monthly_payment: z.coerce.number().nullable().optional(),
  account_id: z.string().nullable().optional(),
});

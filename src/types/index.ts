// =============================================
// maPoche — Types globaux
// =============================================

export type AccountType = "checking" | "savings" | "credit" | "investment" | "cash" | "other";
export type FlowType = "income" | "expense" | "transfer";
export type CategoryFlow = "income" | "expense" | "both";
export type AssetType = "real_estate" | "stock" | "etf" | "crypto" | "savings_account" | "life_insurance" | "other";
export type LiabilityType = "mortgage" | "car_loan" | "consumer_credit" | "student_loan" | "other";
export type BudgetPeriod = "monthly" | "yearly";

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  currency: string;
  color: string;
  is_liquid: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  parent_id: string | null;
  flow: CategoryFlow;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  flow: FlowType;
  transfer_to_account_id: string | null;
  date: string;
  description: string | null;
  note: string | null;
  tags: string[];
  recurrence_rule: string | null;
  recurrence_parent_id: string | null;
  is_reviewed: boolean;
  created_at: string;
  // Joined
  account?: Account;
  category?: Category;
}

export interface Asset {
  id: string;
  user_id: string;
  name: string;
  type: AssetType;
  purchase_price: number | null;
  current_value: number;
  purchase_date: string | null;
  quantity: number | null;
  ticker: string | null;
  currency: string;
  notes: string | null;
  created_at: string;
}

export interface Liability {
  id: string;
  user_id: string;
  name: string;
  type: LiabilityType;
  initial_amount: number;
  remaining_amount: number;
  interest_rate: number | null;
  monthly_payment: number | null;
  end_date: string | null;
  linked_asset_id: string | null;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  period: BudgetPeriod;
  rollover: boolean;
  alert_threshold: number;
  active_from: string;
  active_to: string | null;
  // Joined
  category?: Category;
  spent?: number;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  linked_account_id: string | null;
  icon: string;
  color: string;
  created_at: string;
}

export interface AssetHistory {
  id: string;
  asset_id: string;
  value: number;
  recorded_at: string;
}

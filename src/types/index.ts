// =============================================
// maPoche — Types globaux
// =============================================

export type AccountType = "checking" | "savings" | "credit" | "investment" | "cash" | "mobile_money" | "other";
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
  initial_balance: number;
  current_balance: number;
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
  project_id?: string | null;
  is_reviewed: boolean;
  is_active?: boolean;
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
  account_id: string | null;
  name: string;
  type: LiabilityType;
  initial_amount: number;
  remaining_amount: number;
  interest_rate: number | null;
  monthly_payment: number | null;
  start_date: string | null;
  end_date: string | null;
  linked_asset_id: string | null;
  notes: string | null;
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

export interface PatrimoineSnapshot {
  id: string;
  user_id: string;
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  account_balances: number;
  recorded_at: string;
}

export interface Attachment {
  id: string;
  user_id: string;
  transaction_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export type ProjectStatus = "prospect" | "active" | "done" | "archived";
export type MilestoneKind = "deadline" | "validation" | "payment";

export interface Project {
  id: string;
  user_id: string;
  client_name: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  total_amount: number | null;
  hourly_rate: number | null;
  start_date: string | null;
  deadline: string | null;
  color: string;
  notes: string | null;
  created_at: string;
}

export interface Milestone {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  kind: MilestoneKind;
  due_date: string | null;
  amount: number | null;
  done: boolean;
  done_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  done: boolean;
  estimated_minutes: number | null;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  task_id: string | null;
  project_id: string;
  invoice_id: string | null;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  billable: boolean;
  created_at: string;
  // Jointures optionnelles
  task?: Task;
  project?: Project;
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled";
export type InvoiceItemKind = "time" | "fixed" | "other";

export interface Invoice {
  id: string;
  user_id: string;
  project_id: string | null;
  number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  vat_rate: number;
  notes: string | null;
  issuer_name: string | null;
  issuer_details: string | null;
  client_details: string | null;
  payment_terms: string | null; // ex: "50% démarrage / 30% MVP / 20% mise en ligne"
  transaction_id: string | null;
  paid_at: string | null;
  created_at: string;
  // Jointures optionnelles
  project?: Project;
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
}

export interface InvoiceItem {
  id: string;
  user_id: string;
  invoice_id: string;
  label: string;
  quantity: number;
  unit_price: number;
  kind: InvoiceItemKind;
  position: number;
  created_at: string;
}

export interface InvoicePayment {
  id: string;
  user_id: string;
  invoice_id: string;
  label: string;
  amount_due: number;
  amount_paid: number;
  due_date: string | null;
  paid_date: string | null;
  status: "pending" | "paid" | "overdue";
  transaction_id: string | null;
  created_at: string;
}

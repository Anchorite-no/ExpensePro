export interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string;
  note?: string;
  date: string;
}

export type PageType = "dashboard" | "trends" | "transactions";
export type SettingsTab = "general" | "categories";

export interface BudgetConfig {
  daily: number;
  weekly: number;
  monthly: number;
}

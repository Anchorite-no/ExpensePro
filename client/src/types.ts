export interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string;
  date: string;
}

export type Theme = "light" | "dark";

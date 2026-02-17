import { request } from "./client";

export interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string;
  note?: string;
  date: string;
}

export const fetchExpenses = (token: string) => 
  request<Expense[]>("/api/expenses", "GET", undefined, token);

export const createExpense = (token: string, data: Partial<Expense>) => 
  request<Expense>("/api/expenses", "POST", data, token);

export const updateExpense = (token: string, id: number, data: Partial<Expense>) => 
  request<Expense>(`/api/expenses/${id}`, "PUT", data, token);

export const deleteExpense = (token: string, id: number) => 
  request<{ success: boolean }>(`/api/expenses/${id}`, "DELETE", undefined, token);

export const importExpenses = (token: string, items: any[]) => 
  request<{ imported: number }>("/api/expenses/import", "POST", { items }, token);

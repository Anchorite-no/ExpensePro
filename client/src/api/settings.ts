import { request } from "./client";

export interface BudgetConfig {
  daily: number;
  weekly: number;
  monthly: number;
}

export interface SettingsData {
  currency?: string;
  categories?: string | Record<string, string>;
  budgetConfig?: string | BudgetConfig;
  tags?: string | string[];
}

export const fetchSettings = (token: string) => 
  request<SettingsData>("/api/settings", "GET", undefined, token);

export const updateSettings = (token: string, data: SettingsData) => 
  request<SettingsData>("/api/settings", "PUT", data, token);

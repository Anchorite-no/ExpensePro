import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { fetchExpenses, createExpense, updateExpense, deleteExpense, type Expense } from "../api/expenses";
import { fetchSettings, updateSettings } from "../api/settings";
import { useMemo } from "react";
import { getChinaToday } from "../components/DateInput";
import { decryptExpenses, encryptExpense } from "../utils/crypto";

export function useExpenses() {
  const { token, masterKey, encryption, logout } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      if (!token) return [];
      try {
        const data = await fetchExpenses(token);
        const formatted = data.map(item => ({
          ...item,
          amount: Number(item.amount),
          date: item.date.split("T")[0],
          note: item.note || "",
        }));

        if (masterKey && encryption) {
          return await decryptExpenses(formatted, masterKey);
        }
        return formatted;
      } catch (err: any) {
        if (err.message === "Unauthorized") logout();
        throw err;
      }
    },
    enabled: !!token,
  });

  const addMutation = useMutation({
    mutationFn: async (newExpense: Partial<Expense>) => {
      if (!token) throw new Error("No token");
      let payload = { ...newExpense };
      
      if (masterKey && encryption) {
        const enc = await encryptExpense({ 
          title: payload.title!, 
          category: payload.category!, 
          note: payload.note 
        }, masterKey);
        payload.title = enc.title;
        payload.category = enc.category;
        payload.note = enc.note;
      }
      
      return createExpense(token, payload);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => {
      if (!token) throw new Error("No token");
      return deleteExpense(token, id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  return { 
    expenses: query.data || [], 
    isLoading: query.isLoading, 
    addExpense: addMutation.mutateAsync,
    deleteExpense: deleteMutation.mutateAsync 
  };
}

export function useSettings() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      if (!token) return null;
      return fetchSettings(token);
    },
    enabled: !!token,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (!token) throw new Error("No token");
      return updateSettings(token, data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    updateSettings: mutation.mutateAsync
  };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { fetchExpenses, createExpense, updateExpense, deleteExpense, importExpenses, type Expense } from "../api/expenses";
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
        
        const preFormatted = data.map(item => ({
          ...item,
          amount: Number(item.amount),
          date: item.date.split("T")[0],
          note: item.note || "",
        }));

        if (masterKey && encryption) {
          return await decryptExpenses(preFormatted, masterKey);
        }
        return preFormatted;

      } catch (err: any) {
        if (err.message === "Unauthorized") logout();
        throw err;
      }
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000,   // Keep unused data for 10 minutes
  });

  const addMutation = useMutation({
    mutationFn: async (newExpense: Partial<Expense>) => {
      if (!token) throw new Error("No token");
      const payload = { ...newExpense };
      
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Expense> }) => {
      if (!token) throw new Error("No token");
      const payload = { ...data };

      if (masterKey && encryption) {
        // We need to encrypt fields if they are present
        // Since encryptExpense expects all 3, we might need to be careful if partial update.
        // However, usually updates from UI form provide full objects or we can handle it.
        // If partial, we might need to fetch existing or assume UI sends all.
        // For simplicity and matching current UI behavior (editing a form), we usually send title/category/note.
        
        if (payload.title || payload.category || payload.note) {
           // This assumes we have all 3 or handled partials. 
           // If the backend/crypto logic requires all 3 to generate a valid block if they are stored together?
           // The current crypto.ts encryptExpense returns {title, category, note}. 
           // If we only update title, we might break things if we don't encrypt others?
           // Let's assume the Edit Form sends all fields.
           const enc = await encryptExpense({
             title: payload.title || "",
             category: payload.category || "",
             note: payload.note || ""
           }, masterKey);
           if (payload.title) payload.title = enc.title;
           if (payload.category) payload.category = enc.category;
           if (payload.note) payload.note = enc.note;
        }
      }

      return updateExpense(token, id, payload);
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

  const importMutation = useMutation({
    mutationFn: async (items: any[]) => {
      if (!token) throw new Error("No token");
      let payloadItems = [...items];

      if (masterKey && encryption) {
        payloadItems = await Promise.all(payloadItems.map(async (item) => {
          const enc = await encryptExpense({
            title: item.title,
            category: item.category,
            note: item.note
          }, masterKey);
          return { ...item, ...enc };
        }));
      }

      return importExpenses(token, payloadItems);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  return { 
    expenses: query.data || [], 
    isLoading: query.isLoading, 
    addExpense: addMutation.mutateAsync,
    updateExpense: updateMutation.mutateAsync,
    deleteExpense: deleteMutation.mutateAsync,
    importExpenses: importMutation.mutateAsync
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
    staleTime: Infinity, // Settings rarely change
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

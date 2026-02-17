import { QueryClient, QueryClientProvider, useMutation, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthForm } from "./components/AuthForm";
import { MainLayout } from "./components/layout/MainLayout";
import DashboardPage from "./pages/DashboardPage";
import TrendsPage from "./components/TrendsPage";
import TransactionsPage from "./components/TransactionsPage";
import { SettingsModal } from "./components/SettingsModal";
import { useState } from "react";
import { useExpenses, useSettings } from "./hooks/useData";
import { updateExpense, importExpenses } from "./api/expenses";
import { encryptExpense } from "./utils/crypto";
import "./App.css";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  
  // We need to pass data to old components (TrendsPage, TransactionsPage)
  // until they are fully refactored to use hooks themselves.
  // For now, we can wrap them or modify them. 
  // Ideally, they should use the hooks directly.
  // To keep it simple for this step, I'll update them to use hooks later or pass data here.
  // Actually, TrendsPage and TransactionsPage take props. 
  // Let's create wrappers for them that use the hooks.

  if (!isAuthenticated) {
    return <AuthForm />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<MainLayout onOpenSettings={() => setShowSettings(true)} />}>
          <Route index element={<DashboardPage />} />
          <Route path="trends" element={<TrendsWrapper />} />
          <Route path="transactions" element={<TransactionsWrapper />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}

// Wrappers to adapt old components to new data layer
function TrendsWrapper() {
  const { expenses } = useExpenses();
  const { settings } = useSettings();
  
  const currency = settings?.currency || "¥";
  let categories = {};
  try {
    if (settings?.categories) {
      categories = typeof settings.categories === 'string' ? JSON.parse(settings.categories) : settings.categories;
    }
  } catch(e) {}

  // Current theme is managed in MainLayout/Sidebar but TrendsPage needs it for Charts
  // We can just pass 'light' as default or get it from localstorage if needed, 
  // or useOutletContext (which we set up in MainLayout)
  
  // Quick fix: read from localStorage or context
  const theme = (localStorage.getItem("theme") as "light" | "dark") || "light";

  return <TrendsPage expenses={expenses} theme={theme} categories={categories} currency={currency} />;
}

function TransactionsWrapper() {
  const { expenses, addExpense, deleteExpense } = useExpenses(); // We need updateExpense too but hook doesn't export it yet?
  // Wait, useExpenses exported deleteExpense and addExpense. 
  // TransactionsPage needs onEdit and onImport too.
  
  const { settings } = useSettings();
  const { updateExpense: _update, importExpenses: _import } = useExpensesExtra(); // We need to add these to the hook
  
  const currency = settings?.currency || "¥";
  let categories = {};
  try {
    if (settings?.categories) {
      categories = typeof settings.categories === 'string' ? JSON.parse(settings.categories) : settings.categories;
    }
  } catch(e) {}
  
  const theme = (localStorage.getItem("theme") as "light" | "dark") || "light";

  return (
    <TransactionsPage 
      expenses={expenses} 
      theme={theme} 
      categories={categories} 
      currency={currency}
      onAdd={async (t, a, c, d) => { await addExpense({title:t, amount:a, category:c, date:d}) }}
      onDelete={deleteExpense}
      onEdit={async (id, t, a, c, d, n) => { await _update(id, {title:t, amount:a, category:c, date:d, note:n}) }}
      onImport={_import}
    />
  );
}

// Helper hook for missing mutations
function useExpensesExtra() {
  const { token, masterKey, encryption } = useAuth();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async ({id, data}: {id: number, data: any}) => {
      if (!token) throw new Error("No token");
      let payload = { ...data };
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
      return updateExpense(token, id, payload);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] })
  });

  const importMutation = useMutation({
    mutationFn: (items: any[]) => {
      if (!token) throw new Error("No token");
      // Import usually doesn't need client-side encryption logic here 
      // because the server handles the bulk insert, 
      // BUT if E2E is on, we might need to encrypt them one by one? 
      // The current import implementation in App.tsx didn't seem to encrypt on import?
      // Checking App.tsx (line 322): It just sends items. 
      // So let's assume raw import for now or handled elsewhere.
      return importExpenses(token, items);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] })
  });

  return {
    updateExpense: (id: number, data: any) => updateMutation.mutateAsync({id, data}),
    importExpenses: importMutation.mutateAsync
  };
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

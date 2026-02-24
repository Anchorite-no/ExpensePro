import { useState, useEffect, useCallback, useMemo } from "react";
import { Settings2, Moon, Sun, LogOut } from "lucide-react";
import TrendsPage from "./components/TrendsPage";
import TransactionsPage from "./components/TransactionsPage";
import { useToast, ToastContainer } from "./components/ui/Toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthForm } from "./components/AuthForm";
import { encryptExpense, decryptExpenses } from "./utils/crypto";
import { getChinaToday } from "./utils/helpers";
import "./App.css";

// Refactored Components
import Sidebar from "./components/layout/Sidebar";
import SettingsModal from "./components/settings/SettingsModal";
import StatsGrid from "./components/dashboard/StatsGrid";
import BudgetOverview from "./components/dashboard/BudgetOverview";
import QuickAddCard from "./components/dashboard/QuickAddCard";
import RecentTransactions from "./components/dashboard/RecentTransactions";

// Types & Constants
import type { Expense, PageType, BudgetConfig } from "./types";
import { DEFAULT_CATEGORIES, COLOR_PALETTE, PAGE_TITLES, DEFAULT_TAGS } from "./constants/appConfig";

/* ========== Main Component ========== */
function AppContent() {
  const { user, token, masterKey, encryption, logout } = useAuth();
  const { toasts, addToast, removeToast } = useToast();

  // Use China timezone for default date
  const todayStr = getChinaToday();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    (localStorage.getItem("theme") as "light" | "dark") || "light"
  );

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activePage, setActivePage] = useState<PageType>("dashboard");

  // Settings (synced to backend)
  const [categories, setCategories] = useState<Record<string, string>>(DEFAULT_CATEGORIES);
  const [currency, setCurrency] = useState("¥");
  const [budget, setBudget] = useState<BudgetConfig>({ daily: 0, weekly: 0, monthly: 0 });
  const [tags, setTags] = useState<string[]>(DEFAULT_TAGS);

  // Settings modal
  const [showSettings, setShowSettings] = useState(false);

  /* ========== Settings Sync ========== */
  // Load settings from backend on mount
  useEffect(() => {
    if (!token) return;
    fetch("/api/settings", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.currency) setCurrency(data.currency);
        if (data.categories) {
          try {
            const parsed = typeof data.categories === 'string' ? JSON.parse(data.categories) : data.categories;
            if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
              setCategories(parsed);
            }
          } catch { /* use defaults */ }
        }
        if (data.budgetConfig) {
          try {
            const parsed = typeof data.budgetConfig === 'string' ? JSON.parse(data.budgetConfig) : data.budgetConfig;
            if (parsed) setBudget({ daily: parsed.daily || 0, weekly: parsed.weekly || 0, monthly: parsed.monthly || 0 });
          } catch { /* use defaults */ }
        }
        if (data.tags) {
          try {
            const parsed = typeof data.tags === 'string' ? JSON.parse(data.tags) : data.tags;
            if (Array.isArray(parsed)) setTags(parsed);
          } catch { /* use defaults */ }
        }
      })
      .catch(() => { /* ignore */ });
  }, [token]);

  const saveSettingsToBackend = useCallback((updates: Record<string, any>) => {
    if (!token) return;
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(updates),
    }).catch(() => { /* ignore */ });
  }, [token]);

  // Update categories
  const handleUpdateCategories = useCallback((newCats: Record<string, string>) => {
    setCategories(newCats);
    saveSettingsToBackend({ categories: JSON.stringify(newCats) });
  }, [saveSettingsToBackend]);

  // Update budget
  const handleUpdateBudget = useCallback((newBudget: BudgetConfig) => {
    setBudget(newBudget);
    saveSettingsToBackend({ budgetConfig: JSON.stringify(newBudget) });
  }, [saveSettingsToBackend]);

  // Update currency
  const handleUpdateCurrency = useCallback((val: string) => {
    setCurrency(val);
    saveSettingsToBackend({ currency: val });
  }, [saveSettingsToBackend]);

  // Update tags (add a new tag and persist)
  const handleAddTag = useCallback((tag: string) => {
    setTags(prev => {
      if (prev.includes(tag)) return prev;
      const updated = [...prev, tag];
      saveSettingsToBackend({ tags: JSON.stringify(updated) });
      return updated;
    });
  }, [saveSettingsToBackend]);

  // Remove a tag and persist
  const handleRemoveTag = useCallback((tag: string) => {
    setTags(prev => {
      const updated = prev.filter(t => t !== tag);
      saveSettingsToBackend({ tags: JSON.stringify(updated) });
      return updated;
    });
  }, [saveSettingsToBackend]);

  const toggleTheme = useCallback(() => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
  }, [theme]);

  // Apply theme to document element and update mobile browser theme-color
  useEffect(() => {
    const isDark = theme === "dark";
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Sync browser overscroll and status bar color for Edge/Chrome/Safari
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement("meta");
      metaThemeColor.setAttribute("name", "theme-color");
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute("content", isDark ? "#111827" : "#f3f4f6");
  }, [theme]);

  /* ========== Expense CRUD ========== */
  const fetchExpenses = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/expenses", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) { logout(); return; }
      const data = await res.json();
      let formatted = data.map((item: any) => ({
        ...item,
        amount: Number(item.amount),
        date: item.date.split("T")[0],
        note: item.note || "",
      }));
      // E2E 解密
      if (masterKey && encryption) {
        formatted = await decryptExpenses(formatted, masterKey);
      }
      setExpenses(formatted);
    } catch (err) {
      console.error("Fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [token, masterKey, encryption, logout]);

  useEffect(() => {
    if (token) fetchExpenses();
  }, [token, fetchExpenses]);

  const addExpense = useCallback(async (title: string, amount: number, category: string, date?: string, note?: string) => {
    if (!token) return;
    const t = title;
    const a = amount;
    const c = category;
    const d = date || "";
    const n = note;
    if (!t || !a) return;
    try {
      let body: any = { title: t, amount: a, category: c };
      if (d) body.date = d;
      if (n) body.note = n;
      // E2E 加密
      if (masterKey && encryption) {
        const enc = await encryptExpense({ title: body.title, category: body.category, note: body.note }, masterKey);
        body.title = enc.title;
        body.category = enc.category;
        if (enc.note) body.note = enc.note;
      }
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { logout(); return; }
      if (res.ok) {
        fetchExpenses();
        addToast(`已记录: ${t} ${currency}${a}`, "success");
      }
    } catch (err) {
      console.error("Add error", err);
      addToast("记账失败", "error");
    }
  }, [token, masterKey, encryption, currency, addToast, fetchExpenses, logout]);

  const editExpense = useCallback(async (id: number, title: string, amount: number, category: string, date: string, note?: string) => {
    if (!token) return;
    try {
      let body: any = { title, amount, category, date };
      if (note !== undefined) body.note = note;
      // E2E 加密
      if (masterKey && encryption) {
        const enc = await encryptExpense({ title: body.title, category: body.category, note: body.note }, masterKey);
        body.title = enc.title;
        body.category = enc.category;
        if (enc.note !== undefined) body.note = enc.note || "";
      }
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { logout(); return; }
      if (res.ok) {
        fetchExpenses();
        addToast("修改已保存", "success");
      }
    } catch (err) {
      console.error("Edit error", err);
      addToast("修改失败", "error");
    }
  }, [token, masterKey, encryption, addToast, fetchExpenses, logout]);

  const deleteExpense = useCallback(async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { logout(); return; }
      setExpenses(prev => prev.filter(e => e.id !== id));
      addToast("已删除", "info");
    } catch (err) {
      console.error("Delete error", err);
      addToast("删除失败", "error");
    }
  }, [token, addToast, logout]);

  const importExpenses = useCallback(async (items: any[]) => {
    if (!token || items.length === 0) return;
    try {
      const res = await fetch("/api/expenses/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items }),
      });
      if (res.ok) {
        const data = await res.json();
        fetchExpenses();
        addToast(`成功导入 ${data.imported} 条记录`, "success");
      } else {
        addToast("导入失败", "error");
      }
    } catch (err) {
      console.error("Import error", err);
      addToast("导入失败", "error");
    }
  }, [token, addToast, fetchExpenses]);

  /* ========== Computed ========== */
  const totalAmount = useMemo(() => expenses.reduce((sum, item) => sum + item.amount, 0), [expenses]);
  const maxExpense = useMemo(() => expenses.length > 0 ? Math.max(...expenses.map(e => e.amount)) : 0, [expenses]);

  const periodExpenses = useMemo(() => {
    const chinaToday = getChinaToday();
    const [cy, cm, cd] = chinaToday.split('-');
    const yearMonth = `${cy}-${cm}`;
    // Compute week start (Monday) in China timezone
    const chinaNow = new Date(Number(cy), Number(cm) - 1, Number(cd));
    const dayOfWeek = chinaNow.getDay() || 7;
    const weekStart = new Date(chinaNow);
    weekStart.setDate(chinaNow.getDate() - dayOfWeek + 1);
    const wy = weekStart.getFullYear();
    const wm = String(weekStart.getMonth() + 1).padStart(2, '0');
    const wd = String(weekStart.getDate()).padStart(2, '0');
    const weekStartStr = `${wy}-${wm}-${wd}`;

    let daily = 0, weekly = 0, monthly = 0;
    expenses.forEach(e => {
      if (e.date === chinaToday) daily += e.amount;
      if (e.date >= weekStartStr && e.date <= chinaToday) weekly += e.amount;
      if (e.date.startsWith(yearMonth)) monthly += e.amount;
    });
    return { daily, weekly, monthly };
  }, [expenses]);

  if (loading) return (
    <div className={`loading-screen ${theme}`}>
      <div className="loading-logo">
        <div className="loading-logo-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <span className="loading-app-name">ExpensePro</span>
      </div>
      <div className="loading-spinner-container">
        <div className="loading-spinner" />
        <span className="loading-text">Loading data...</span>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <>
      <StatsGrid
        totalAmount={totalAmount}
        expenseCount={expenses.length}
        maxExpense={maxExpense}
        currency={currency}
      />

      <BudgetOverview
        budget={budget}
        periodExpenses={periodExpenses}
        currency={currency}
      />

      <div className="dashboard-body">
        <QuickAddCard
          categories={categories}
          onAdd={addExpense}
          currency={currency}
          theme={theme}
          token={token}
          tags={tags}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
        />
        <RecentTransactions
          expenses={expenses}
          categories={categories}
          currency={currency}
          onDelete={deleteExpense}
        />
      </div>
    </>
  );

  const renderPage = () => {
    switch (activePage) {
      case "trends":
        return <TrendsPage expenses={expenses} theme={theme} categories={categories} currency={currency} />;
      case "transactions":
        return (
          <TransactionsPage
            expenses={expenses}
            theme={theme}
            categories={categories}
            onDelete={deleteExpense}
            onAdd={addExpense}
            onEdit={editExpense}
            onImport={importExpenses}
            currency={currency}
          />
        );
      default:
        return renderDashboard();
    }
  };

  return (
    <div className={`dashboard ${theme}`}>
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        user={user}
        logout={logout}
        openSettings={() => setShowSettings(true)}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main className="main-content">
        <div className="content-wrapper">
          <header className="top-bar">
            <h2>{PAGE_TITLES[activePage]}</h2>
          </header>
          {renderPage()}
        </div>
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        categories={categories}
        currency={currency}
        budget={budget}
        onUpdateCategories={handleUpdateCategories}
        onUpdateCurrency={handleUpdateCurrency}
        onUpdateBudget={handleUpdateBudget}
      />
    </div>
  );
}

import { ErrorBoundary } from "./components/ErrorBoundary";

/* ========== App Root ========== */
function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthWrapper />
      </AuthProvider>
    </ErrorBoundary>
  );
}

const AuthWrapper = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <AppContent /> : <AuthForm />;
};

export default App;

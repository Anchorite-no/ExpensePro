import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Wallet, TrendingUp, CreditCard, Activity,
  PlusCircle, Trash2, Tag, Sun, Moon, BarChart3,
  ChevronLeft, ChevronRight, Calendar, Plus, X, Settings2,
  ArrowUp, ArrowDown, LogOut, DollarSign, Target, FileText
} from "lucide-react";
import TrendsPage from "./components/TrendsPage";
import TransactionsPage from "./components/TransactionsPage";
import AiReceiptParser from "./components/AiReceiptParser";
import { Select } from "./components/ui/Select";
import { useToast, ToastContainer } from "./components/ui/Toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthForm } from "./components/AuthForm";
import "./App.css";

/* ========== Types ========== */
interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string;
  note?: string;
  date: string;
}

type PageType = "dashboard" | "trends" | "transactions";
type SettingsTab = "general" | "categories";

interface BudgetConfig {
  daily: number;
  weekly: number;
  monthly: number;
}

/* ========== Constants ========== */
const API_URL = "/api/expenses";

const DEFAULT_CATEGORIES: Record<string, string> = {
  "餐饮": "#10B981",
  "交通": "#3B82F6",
  "购物": "#8B5CF6",
  "娱乐": "#F59E0B",
  "服务订阅": "#EC4899",
  "投资": "#6366F1",
  "其他": "#6B7280",
};

const COLOR_PALETTE = [
  "#14B8A6", "#F97316", "#EF4444", "#06B6D4", "#D946EF",
  "#84CC16", "#E11D48", "#0EA5E9", "#A855F7", "#22D3EE",
];

const PRESET_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#84CC16", "#10B981",
  "#06B6D4", "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899",
  "#6B7280", "#111827"
];

const CURRENCIES = [
  { value: "¥", label: "¥ CNY (人民币)" },
  { value: "$", label: "$ USD (美元)" },
  { value: "€", label: "€ EUR (欧元)" },
  { value: "£", label: "£ GBP (英镑)" },
  { value: "₩", label: "₩ KRW (韩元)" },
  { value: "₹", label: "₹ INR (印度卢比)" },
  { value: "A$", label: "A$ AUD (澳元)" },
  { value: "C$", label: "C$ CAD (加元)" },
];

const PAGE_TITLES: Record<PageType, string> = {
  dashboard: "资产概览",
  trends: "趋势分析",
  transactions: "交易记录",
};

const getCategoryColor = (category: string, cats: Record<string, string>) =>
  cats[category] || "#6B7280";

/* ========== Main Component ========== */
function AppContent() {
  const { user, token, logout } = useAuth();
  const { toasts, addToast, removeToast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState({ title: "", amount: "", category: "餐饮", date: "", note: "" });
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

  // Settings modal
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(COLOR_PALETTE[0]);
  const [budgetInputs, setBudgetInputs] = useState({ daily: "", weekly: "", monthly: "" });
  const [editingBudget, setEditingBudget] = useState<string | null>(null);

  const categoryList = Object.keys(categories);

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

  // Save categories
  const saveCategories = useCallback((cats: Record<string, string>) => {
    setCategories(cats);
    saveSettingsToBackend({ categories: JSON.stringify(cats) });
  }, [saveSettingsToBackend]);

  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name || categories[name]) return;
    const updated = { ...categories, [name]: newCategoryColor };
    saveCategories(updated);
    setNewCategoryName("");
    const usedColors = Object.values(updated);
    const next = COLOR_PALETTE.find(c => !usedColors.includes(c)) || COLOR_PALETTE[0];
    setNewCategoryColor(next);
    addToast(`分类「${name}」已添加`, "success");
  };

  const removeCategory = (name: string) => {
    const updated = { ...categories };
    delete updated[name];
    saveCategories(updated);
    addToast(`分类「${name}」已删除`, "info");
  };

  const moveCategory = (index: number, direction: "up" | "down") => {
    const entries = Object.entries(categories);
    if (direction === "up" && index > 0) {
      [entries[index], entries[index - 1]] = [entries[index - 1], entries[index]];
    } else if (direction === "down" && index < entries.length - 1) {
      [entries[index], entries[index + 1]] = [entries[index + 1], entries[index]];
    } else return;
    const newCats: Record<string, string> = {};
    entries.forEach(([key, val]) => { newCats[key] = val; });
    saveCategories(newCats);
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
  };

  const saveCurrency = (val: string) => {
    setCurrency(val);
    saveSettingsToBackend({ currency: val });
  };

  const saveBudgetField = (field: keyof BudgetConfig) => {
    const val = Number(budgetInputs[field]);
    if (isNaN(val) || val < 0) return;
    const updated = { ...budget, [field]: val };
    setBudget(updated);
    saveSettingsToBackend({ budgetConfig: JSON.stringify(updated) });
    setEditingBudget(null);
    setBudgetInputs(prev => ({ ...prev, [field]: "" }));
    addToast("预算已更新", "success");
  };

  const startEditBudget = (field: keyof BudgetConfig) => {
    setEditingBudget(field);
    setBudgetInputs(prev => ({ ...prev, [field]: budget[field] > 0 ? String(budget[field]) : "" }));
  };

  /* ========== Expense CRUD ========== */
  const fetchExpenses = async () => {
    if (!token) return;
    try {
      const res = await fetch(API_URL, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) { logout(); return; }
      const data = await res.json();
      const formatted = data.map((item: any) => ({
        ...item,
        amount: Number(item.amount),
        date: item.date.split("T")[0],
        note: item.note || "",
      }));
      setExpenses(formatted);
    } catch (err) {
      console.error("Fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchExpenses();
  }, [token]);

  const addExpense = async (title?: string, amount?: number, category?: string, date?: string, note?: string) => {
    if (!token) return;
    const t = title || form.title;
    const a = amount ?? Number(form.amount);
    const c = category || form.category;
    const d = date || form.date || "";
    const n = note ?? form.note;
    if (!t || !a) return;
    try {
      const body: any = { title: t, amount: a, category: c };
      if (d) body.date = d;
      if (n) body.note = n;
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { logout(); return; }
      if (res.ok) {
        fetchExpenses();
        if (!title) setForm({ ...form, title: "", amount: "", date: "", note: "" });
        addToast(`已记录: ${t} ${currency}${a}`, "success");
      }
    } catch (err) {
      console.error("Add error", err);
      addToast("记账失败", "error");
    }
  };

  const editExpense = async (id: number, title: string, amount: number, category: string, date: string, note?: string) => {
    if (!token) return;
    try {
      const body: any = { title, amount, category, date };
      if (note !== undefined) body.note = note;
      const res = await fetch(`${API_URL}/${id}`, {
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
  };

  const deleteExpense = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { logout(); return; }
      setExpenses(expenses.filter(e => e.id !== id));
      addToast("已删除", "info");
    } catch (err) {
      console.error("Delete error", err);
      addToast("删除失败", "error");
    }
  };

  const importExpenses = async (items: any[]) => {
    if (!token || items.length === 0) return;
    try {
      const res = await fetch(`${API_URL}/import`, {
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
  };

  /* ========== Computed ========== */
  const totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0);
  const maxExpense = expenses.length > 0 ? Math.max(...expenses.map(e => e.amount)) : 0;

  const periodExpenses = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dayOfWeek = now.getDay() || 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek + 1);
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    let daily = 0, weekly = 0, monthly = 0;
    expenses.forEach(e => {
      if (e.date === todayStr) daily += e.amount;
      if (e.date >= weekStartStr && e.date <= todayStr) weekly += e.amount;
      if (e.date.startsWith(yearMonth)) monthly += e.amount;
    });
    return { daily, weekly, monthly };
  }, [expenses]);

  const activeBudgets = useMemo(() => {
    const result: { key: keyof BudgetConfig; label: string; limit: number; spent: number }[] = [];
    if (budget.daily > 0) result.push({ key: "daily", label: "日预算", limit: budget.daily, spent: periodExpenses.daily });
    if (budget.weekly > 0) result.push({ key: "weekly", label: "周预算", limit: budget.weekly, spent: periodExpenses.weekly });
    if (budget.monthly > 0) result.push({ key: "monthly", label: "月预算", limit: budget.monthly, spent: periodExpenses.monthly });
    return result;
  }, [budget, periodExpenses]);

  if (loading) return <div className={`loading ${theme}`}>Loading...</div>;

  /* ========== Render Helpers ========== */
  const navItems: { key: PageType; icon: React.ReactNode; label: string }[] = [
    { key: "dashboard", icon: <Wallet size={20} />, label: "资产概览" },
    { key: "trends", icon: <TrendingUp size={20} />, label: "趋势分析" },
    { key: "transactions", icon: <CreditCard size={20} />, label: "交易记录" },
  ];

  const renderBudgetRow = (field: keyof BudgetConfig, label: string) => (
    <div className="setting-budget-item" key={field}>
      <span className="setting-budget-label">{label}</span>
      {editingBudget === field ? (
        <div className="setting-budget-edit">
          <input
            className="setting-budget-input"
            type="number"
            placeholder="0"
            value={budgetInputs[field]}
            onChange={e => setBudgetInputs(prev => ({ ...prev, [field]: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && saveBudgetField(field)}
            autoFocus
          />
          <button className="setting-budget-ok" onClick={() => saveBudgetField(field)}>确定</button>
          <button className="setting-budget-cancel" onClick={() => setEditingBudget(null)}><X size={12} /></button>
        </div>
      ) : (
        <button className="setting-budget-value" onClick={() => startEditBudget(field)}>
          {budget[field] > 0 ? `${currency}${budget[field]}` : "未设置"}
        </button>
      )}
    </div>
  );

  const renderDashboard = () => (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Wallet size={24} /></div>
          <div className="stat-info">
            <span className="label">总支出</span>
            <span className="value">{currency}{totalAmount.toFixed(2)}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><Activity size={24} /></div>
          <div className="stat-info">
            <span className="label">交易笔数</span>
            <span className="value">{expenses.length}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><TrendingUp size={24} /></div>
          <div className="stat-info">
            <span className="label">单笔最高</span>
            <span className="value">{currency}{maxExpense.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {activeBudgets.length > 0 && (
        <div className="budget-card">
          <div className="budget-card-title">
            <Target size={16} />
            <span>预算概览</span>
          </div>
          <div className="budget-list">
            {activeBudgets.map(b => {
              const pct = Math.min(100, (b.spent / b.limit) * 100);
              const status = pct >= 100 ? "over" : pct >= 80 ? "warning" : "normal";
              return (
                <div key={b.key} className="budget-row">
                  <div className="budget-row-header">
                    <span className="budget-label">{b.label}</span>
                    <div className="budget-amounts">
                      <span className={`budget-spent ${status}`}>{currency}{b.spent.toFixed(2)}</span>
                      <span className="budget-separator">/</span>
                      <span className="budget-total">{currency}{b.limit.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="budget-bar-bg">
                    <div className={`budget-bar-fill ${status}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="budget-row-footer">
                    <span className={`budget-pct ${status}`}>{pct.toFixed(1)}%</span>
                    <span className="budget-remaining">
                      {status === "over"
                        ? `超支 ${currency}${(b.spent - b.limit).toFixed(2)}`
                        : `剩余 ${currency}${(b.limit - b.spent).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="dashboard-body">
        <div className="form-card">
          <h3>快速记账</h3>
          <AiReceiptParser theme={theme} categories={categories} onAddExpense={(t, a, c, d) => addExpense(t, a, c, d)} currency={currency} token={token} />
          <div className="input-group">
            <label><Tag size={14} /> 内容</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="例如：午饭" onKeyDown={e => e.key === "Enter" && addExpense()} />
          </div>
          <div className="input-group">
            <label><CreditCard size={14} /> 金额</label>
            <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" onKeyDown={e => e.key === "Enter" && addExpense()} />
          </div>
          <div className="input-group">
            <label><Calendar size={14} /> 日期</label>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="input-group">
            <label><Activity size={14} /> 分类</label>
            <Select
              value={form.category}
              onChange={val => setForm({ ...form, category: val })}
              options={categoryList.map(c => ({ value: c, label: c, color: categories[c] }))}
              placeholder="选择分类"
            />
          </div>
          <div className="input-group">
            <label><FileText size={14} /> 备注</label>
            <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="可选备注信息" onKeyDown={e => e.key === "Enter" && addExpense()} />
          </div>
          <button className="submit-btn" onClick={() => addExpense()}><PlusCircle size={18} /> 确认入账</button>
        </div>

        <div className="list-card">
          <h3>近期交易</h3>
          {expenses.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>项目</th><th>分类</th><th>日期</th><th>金额</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {expenses.slice(0, 9).map(item => (
                    <tr key={item.id}>
                      <td className="font-medium">
                        {item.title}
                        {item.note && <span className="note-badge" title={item.note}><FileText size={12} /></span>}
                      </td>
                      <td>
                        <span
                          className="tag"
                          style={{
                            backgroundColor: getCategoryColor(item.category, categories) + "20",
                            color: getCategoryColor(item.category, categories),
                            border: `1px solid ${getCategoryColor(item.category, categories)}40`
                          }}
                        >
                          {item.category}
                        </span>
                      </td>
                      <td className="text-muted">{item.date}</td>
                      <td className="text-danger font-bold">-{currency}{item.amount.toFixed(2)}</td>
                      <td>
                        <button className="icon-btn" onClick={() => deleteExpense(item.id)} title="删除">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="empty-hint">还没有任何消费记录</p>}
        </div>
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
            onAdd={(t, a, c, d) => addExpense(t, a, c, d)}
            onEdit={editExpense}
            onImport={importExpenses}
            currency={currency}
          />
        );
      default:
        return renderDashboard();
    }
  };

  /* ========== Main Layout ========== */
  return (
    <div className={`dashboard ${theme}`}>
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          {!sidebarCollapsed && (
            <div className="logo">
              <BarChart3 size={28} />
              <span className="logo-text">ExpensePro</span>
            </div>
          )}
          <button className="collapse-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}>
            {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav>
          {navItems.map(item => (
            <a key={item.key} href="#" className={activePage === item.key ? "active" : ""} onClick={e => { e.preventDefault(); setActivePage(item.key); }} title={item.label}>
              {item.icon} <span className="nav-text">{item.label}</span>
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info" style={{ padding: '10px 20px', fontSize: '14px', color: '#666', display: sidebarCollapsed ? 'none' : 'block' }}>
            Hi, {user?.username}
          </div>
          <button className="sidebar-manage-btn" onClick={() => setShowSettings(true)} title="系统设置">
            <Settings2 size={18} />
            <span className="nav-text">系统设置</span>
          </button>
          <button className="theme-toggle" onClick={toggleTheme} title={theme === "light" ? "切换到夜间模式" : "切换到日间模式"}>
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            <span className="nav-text">{theme === "light" ? "夜间模式" : "日间模式"}</span>
          </button>
          <button className="sidebar-logout-btn" onClick={logout} title="退出登录">
            <LogOut size={18} />
            <span className="nav-text">退出登录</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="content-wrapper">
          <header className="top-bar">
            <h2>{PAGE_TITLES[activePage]}</h2>
            <div className="mobile-actions">
              <button className="theme-toggle-mobile" onClick={toggleTheme}>
                {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              <button className="theme-toggle-mobile" onClick={logout} style={{ marginLeft: '8px' }}>
                <LogOut size={18} />
              </button>
            </div>
          </header>
          {renderPage()}
        </div>
      </main>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ========== Settings Modal ========== */}
      {showSettings && (
        <div className="category-manager-overlay" onClick={() => setShowSettings(false)}>
          <div className="category-manager settings-modal" onClick={e => e.stopPropagation()}>
            <div className="category-manager-header">
              <h3><Settings2 size={18} /> 系统设置</h3>
              <button className="icon-btn" onClick={() => setShowSettings(false)}><X size={18} /></button>
            </div>

            <div className="settings-tabs">
              <button className={`settings-tab ${settingsTab === "general" ? "active" : ""}`} onClick={() => setSettingsTab("general")}>通用设置</button>
              <button className={`settings-tab ${settingsTab === "categories" ? "active" : ""}`} onClick={() => setSettingsTab("categories")}>分类管理</button>
            </div>

            {settingsTab === "general" && (
              <div className="settings-general">
                <div className="setting-group">
                  <div className="setting-group-title"><DollarSign size={15} /><span>默认币种</span></div>
                  <div style={{ width: 200 }}>
                    <Select value={currency} onChange={val => saveCurrency(val)} options={CURRENCIES} />
                  </div>
                </div>
                <div className="setting-group">
                  <div className="setting-group-title"><Target size={15} /><span>预算限额</span></div>
                  <div className="setting-budget-list">
                    {renderBudgetRow("daily", "日预算")}
                    {renderBudgetRow("weekly", "周预算")}
                    {renderBudgetRow("monthly", "月预算")}
                  </div>
                </div>
              </div>
            )}

            {settingsTab === "categories" && (
              <>
                <div className="category-list">
                  {Object.entries(categories).map(([name, color], index, arr) => (
                    <div key={name} className="category-item">
                      <div className="category-info">
                        <span className="category-color-dot" style={{ backgroundColor: color }} />
                        <span className="category-name">{name}</span>
                      </div>
                      <div className="category-actions">
                        <button className="action-btn" onClick={() => moveCategory(index, "up")} disabled={index === 0} title="上移"><ArrowUp size={14} /></button>
                        <button className="action-btn" onClick={() => moveCategory(index, "down")} disabled={index === arr.length - 1} title="下移"><ArrowDown size={14} /></button>
                        <button className="action-btn delete" onClick={() => removeCategory(name)} title="删除" disabled={categoryList.length <= 1}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="category-add-section">
                  <h4>添加新分类</h4>
                  <div className="color-presets">
                    {PRESET_COLORS.map(c => (
                      <button key={c} className={`color-swatch ${newCategoryColor === c ? 'active' : ''}`} style={{ backgroundColor: c }} onClick={() => setNewCategoryColor(c)} />
                    ))}
                    <div className="custom-color-wrapper">
                      <input type="color" className="color-picker-input" value={newCategoryColor} onChange={e => setNewCategoryColor(e.target.value)} title="自定义颜色" />
                      <PlusCircle size={16} className="custom-color-icon" />
                    </div>
                  </div>
                  <div className="category-add-row">
                    <span className="selected-color-preview" style={{ backgroundColor: newCategoryColor }} />
                    <input className="category-name-input" placeholder="输入分类名称..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} onKeyDown={e => e.key === "Enter" && addCategory()} />
                    <button className="category-add-btn" onClick={addCategory} disabled={!newCategoryName.trim()}>
                      <Plus size={16} /> 添加
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== App Root ========== */
function App() {
  return (
    <AuthProvider>
      <AuthWrapper />
    </AuthProvider>
  );
}

const AuthWrapper = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <AppContent /> : <AuthForm />;
};

export default App;

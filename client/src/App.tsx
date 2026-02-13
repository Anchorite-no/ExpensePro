import { useState, useEffect, useCallback } from "react";
import {
  Wallet, TrendingUp, CreditCard, Activity,
  PlusCircle, Trash2, Tag, Sun, Moon, BarChart3,
  ChevronLeft, ChevronRight, Calendar, Plus, X, Settings2,
  ArrowUp, ArrowDown, Lock, LogOut
} from "lucide-react";
import TrendsPage from "./components/TrendsPage";
import TransactionsPage from "./components/TransactionsPage";
import AiReceiptParser from "./components/AiReceiptParser";
import { Select } from "./components/ui/Select";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthForm } from "./components/AuthForm";
import "./App.css";

interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string;
  date: string;
}

type PageType = "dashboard" | "trends" | "transactions";

const API_URL = "/api/expenses";

// 默认分类 + 颜色
const DEFAULT_CATEGORIES: Record<string, string> = {
  "餐饮": "#10B981",
  "交通": "#3B82F6",
  "购物": "#8B5CF6",
  "娱乐": "#F59E0B",
  "服务订阅": "#EC4899",
  "投资": "#6366F1",
  "其他": "#6B7280",
};

// 新分类自动分配颜色的候选色板
const COLOR_PALETTE = [
  "#14B8A6", "#F97316", "#EF4444", "#06B6D4", "#D946EF",
  "#84CC16", "#E11D48", "#0EA5E9", "#A855F7", "#22D3EE",
];

// 预设颜色选项
const PRESET_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#84CC16", "#10B981",
  "#06B6D4", "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899",
  "#6B7280", "#111827"
];

const loadCategories = (): Record<string, string> => {
  try {
    const saved = localStorage.getItem("custom_categories");
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return { ...DEFAULT_CATEGORIES };
};

const getCategoryColor = (category: string, cats: Record<string, string>) => {
  return cats[category] || "#6B7280";
};

const PAGE_TITLES: Record<PageType, string> = {
  dashboard: "资产概览",
  trends: "趋势分析",
  transactions: "交易记录",
};

function AppContent() {
  const { user, token, logout } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState({ title: "", amount: "", category: "餐饮", date: "" });
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("theme") as "light" | "dark") || "light";
  });

  // 侧边栏收缩状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // 当前页面
  const [activePage, setActivePage] = useState<PageType>("dashboard");

  // 分类管理
  const [categories, setCategories] = useState<Record<string, string>>(loadCategories);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(COLOR_PALETTE[0]);

  const categoryList = Object.keys(categories);

  const saveCategories = useCallback((cats: Record<string, string>) => {
    setCategories(cats);
    localStorage.setItem("custom_categories", JSON.stringify(cats));
  }, []);

  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name || categories[name]) return;
    const updated = { ...categories, [name]: newCategoryColor };
    saveCategories(updated);
    setNewCategoryName("");
    // 自动切换到下一个候选颜色
    const usedColors = Object.values(updated);
    const next = COLOR_PALETTE.find((c) => !usedColors.includes(c)) || COLOR_PALETTE[0];
    setNewCategoryColor(next);
  };

  const removeCategory = (name: string) => {
    if (DEFAULT_CATEGORIES[name]) return; // 默认分类不允许删除
    const updated = { ...categories };
    delete updated[name];
    saveCategories(updated);
  };

  const moveCategory = (index: number, direction: "up" | "down") => {
    const entries = Object.entries(categories);
    if (direction === "up" && index > 0) {
      const temp = entries[index];
      entries[index] = entries[index - 1];
      entries[index - 1] = temp;
    } else if (direction === "down" && index < entries.length - 1) {
      const temp = entries[index];
      entries[index] = entries[index + 1];
      entries[index + 1] = temp;
    } else {
      return;
    }
    // Reconstruct object in new order
    const newCategories: Record<string, string> = {};
    entries.forEach(([key, val]) => {
      newCategories[key] = val;
    });
    saveCategories(newCategories);
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
  };

  const fetchExpenses = async () => {
    if (!token) return;
    try {
      const res = await fetch(API_URL, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.status === 401 || res.status === 403) {
        logout();
        return;
      }
      const data = await res.json();
      const formatted = data.map((item: any) => ({
        ...item,
        amount: Number(item.amount),
        date: item.date.split("T")[0],
      }));
      setExpenses(formatted);
    } catch (err) {
      console.error("Fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchExpenses();
    }
  }, [token]);

  const addExpense = async (title?: string, amount?: number, category?: string, date?: string) => {
    if (!token) return;
    const t = title || form.title;
    const a = amount ?? Number(form.amount);
    const c = category || form.category;
    const d = date || form.date || ""; // 空字符串表示后端使用当天
    if (!t || !a) return;
    try {
      const body: any = { title: t, amount: a, category: c };
      if (d) body.date = d;
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        logout();
        return;
      }
      fetchExpenses();
      if (!title) setForm({ ...form, title: "", amount: "", date: "" });
    } catch (err) {
      console.error("Add error", err);
    }
  };

  const deleteExpense = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        logout();
        return;
      }
      setExpenses(expenses.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Delete error", err);
    }
  };

  // 统计逻辑
  const totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0);
  const maxExpense = expenses.length > 0 ? Math.max(...expenses.map((e) => e.amount)) : 0;

  if (loading) return <div className={`loading ${theme}`}>Loading...</div>;

  // 导航项配置
  const navItems: { key: PageType; icon: React.ReactNode; label: string }[] = [
    { key: "dashboard", icon: <Wallet size={20} />, label: "资产概览" },
    { key: "trends", icon: <TrendingUp size={20} />, label: "趋势分析" },
    { key: "transactions", icon: <CreditCard size={20} />, label: "交易记录" },
  ];

  // 渲染 Dashboard 内容（精简版：统计卡片 + 快速记账 + 近期交易）
  const renderDashboard = () => (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Wallet size={24} /></div>
          <div className="stat-info">
            <span className="label">总支出</span>
            <span className="value">¥{totalAmount.toFixed(2)}</span>
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
            <span className="value">¥{maxExpense.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-body">
        <div className="form-card">
          <h3>快速记账</h3>
          <AiReceiptParser theme={theme} categories={categories} onAddExpense={(t, a, c, d) => addExpense(t, a, c, d)} />
          <div className="input-group">
            <label><Tag size={14} /> 内容</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="例如：午饭" onKeyDown={(e) => e.key === "Enter" && addExpense()} />
          </div>
          <div className="input-group">
            <label><CreditCard size={14} /> 金额</label>
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" onKeyDown={(e) => e.key === "Enter" && addExpense()} />
          </div>
          <div className="input-group">
            <label><Calendar size={14} /> 日期</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="input-group">
            <label><Activity size={14} /> 分类</label>
            <Select
              value={form.category}
              onChange={(val) => setForm({ ...form, category: val })}
              options={categoryList.map(c => ({ value: c, label: c, color: categories[c] }))}
              placeholder="选择分类"
            />
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
                  {expenses.slice(0, 9).map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium">{item.title}</td>
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
                      <td className="text-danger font-bold">-¥{item.amount.toFixed(2)}</td>
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

  // 渲染当前页面内容
  const renderPage = () => {
    switch (activePage) {
      case "trends":
        return <TrendsPage expenses={expenses} theme={theme} categories={categories} />;
      case "transactions":
        return (
          <TransactionsPage
            expenses={expenses}
            theme={theme}
            categories={categories}
            onDelete={deleteExpense}
            onAdd={(t, a, c, d) => addExpense(t, a, c, d)}
          />
        );
      default:
        return renderDashboard();
    }
  };

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
          <button
            className="collapse-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav>
          {navItems.map((item) => (
            <a
              key={item.key}
              href="#"
              className={activePage === item.key ? "active" : ""}
              onClick={(e) => { e.preventDefault(); setActivePage(item.key); }}
              title={item.label}
            >
              {item.icon} <span className="nav-text">{item.label}</span>
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info" style={{ padding: '10px 20px', fontSize: '14px', color: '#666', display: sidebarCollapsed ? 'none' : 'block' }}>
            Hi, {user?.username}
          </div>
          <button className="sidebar-manage-btn" onClick={() => setShowCategoryManager(true)} title="管理分类">
            <Settings2 size={18} />
            <span className="nav-text">管理分类</span>
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

      {/* 分类管理弹窗 */}
      {showCategoryManager && (
        <div className="category-manager-overlay" onClick={() => setShowCategoryManager(false)}>
          <div className="category-manager" onClick={(e) => e.stopPropagation()}>
            <div className="category-manager-header">
              <h3><Settings2 size={18} /> 管理分类</h3>
              <button className="icon-btn" onClick={() => setShowCategoryManager(false)}><X size={18} /></button>
            </div>

            <div className="category-list">
              {Object.entries(categories).map(([name, color], index, arr) => (
                <div key={name} className="category-item">
                  <div className="category-info">
                    <span className="category-color-dot" style={{ backgroundColor: color }} />
                    <span className="category-name">{name}</span>
                    {DEFAULT_CATEGORIES[name] && <span className="category-badge"><Lock size={10} /> 默认</span>}
                  </div>

                  <div className="category-actions">
                    <button
                      className="action-btn"
                      onClick={() => moveCategory(index, "up")}
                      disabled={index === 0}
                      title="上移"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => moveCategory(index, "down")}
                      disabled={index === arr.length - 1}
                      title="下移"
                    >
                      <ArrowDown size={14} />
                    </button>

                    {!DEFAULT_CATEGORIES[name] && (
                      <button className="action-btn delete" onClick={() => removeCategory(name)} title="删除">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="category-add-section">
              <h4>添加新分类</h4>

              {/* 预设颜色选择 */}
              <div className="color-presets">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    className={`color-swatch ${newCategoryColor === c ? 'active' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewCategoryColor(c)}
                  />
                ))}
                <div className="custom-color-wrapper">
                  <input
                    type="color"
                    className="color-picker-input"
                    value={newCategoryColor}
                    onChange={(e) => setNewCategoryColor(e.target.value)}
                    title="自定义颜色"
                  />
                  <PlusCircle size={16} className="custom-color-icon" />
                </div>
              </div>

              <div className="category-add-row">
                <span className="selected-color-preview" style={{ backgroundColor: newCategoryColor }} />
                <input
                  className="category-name-input"
                  placeholder="输入分类名称..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCategory()}
                />
                <button className="category-add-btn" onClick={addCategory} disabled={!newCategoryName.trim()}>
                  <Plus size={16} /> 添加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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

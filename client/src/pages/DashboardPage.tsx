import React, { useMemo, useState } from "react";
import { Wallet, Activity, TrendingUp, Target, Tag, CreditCard, Calendar, FileText, PlusCircle, Trash2 } from "lucide-react";
import { useExpenses, useSettings } from "../hooks/useData";
import { useToast } from "../components/ui/Toast";
import AiReceiptParser from "../components/AiReceiptParser";
import { DateInput, getChinaToday } from "../components/DateInput";
import { Select } from "../components/ui/Select";
import { useAuth } from "../context/AuthContext";

const DEFAULT_CATEGORIES: Record<string, string> = {
  "餐饮": "#10B981", "交通": "#3B82F6", "购物": "#8B5CF6", 
  "娱乐": "#F59E0B", "服务订阅": "#EC4899", "投资": "#6366F1", "其他": "#6B7280"
};

export default function DashboardPage() {
  const { expenses, addExpense, deleteExpense } = useExpenses();
  const { settings } = useSettings();
  const { addToast } = useToast();
  const { token } = useAuth();
  
  // Local form state
  const todayStr = getChinaToday();
  const [form, setForm] = useState({ title: "", amount: "", category: "餐饮", date: todayStr, note: "" });

  // Parsed settings
  const currency = settings?.currency || "¥";
  let categories = DEFAULT_CATEGORIES;
  try {
    if (settings?.categories) {
      categories = typeof settings.categories === 'string' ? JSON.parse(settings.categories) : settings.categories;
    }
  } catch(e) {}
  
  let budget = { daily: 0, weekly: 0, monthly: 0 };
  try {
    if (settings?.budgetConfig) {
      const parsed = typeof settings.budgetConfig === 'string' ? JSON.parse(settings.budgetConfig) : settings.budgetConfig;
      budget = { daily: parsed.daily || 0, weekly: parsed.weekly || 0, monthly: parsed.monthly || 0 };
    }
  } catch(e) {}

  // Computed Stats
  const totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0);
  const maxExpense = expenses.length > 0 ? Math.max(...expenses.map(e => e.amount)) : 0;

  const periodExpenses = useMemo(() => {
    const chinaToday = getChinaToday();
    const [cy, cm, cd] = chinaToday.split('-');
    const yearMonth = `${cy}-${cm}`;
    
    // Week calculation
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

  const activeBudgets = useMemo(() => {
    const result = [];
    if (budget.daily > 0) result.push({ key: "daily", label: "日预算", limit: budget.daily, spent: periodExpenses.daily });
    if (budget.weekly > 0) result.push({ key: "weekly", label: "周预算", limit: budget.weekly, spent: periodExpenses.weekly });
    if (budget.monthly > 0) result.push({ key: "monthly", label: "月预算", limit: budget.monthly, spent: periodExpenses.monthly });
    return result;
  }, [budget, periodExpenses]);

  // Actions
  const handleAdd = async (title?: string, amount?: number, category?: string, date?: string) => {
    const t = title || form.title;
    const a = amount ?? Number(form.amount);
    const c = category || form.category;
    const d = date || form.date;
    const n = form.note;

    if (!t || !a) return;

    try {
      await addExpense({ title: t, amount: a, category: c, date: d, note: n });
      addToast(`已记录: ${t} ${currency}${a}`, "success");
      if (!title) setForm({ ...form, title: "", amount: "", date: todayStr, note: "" });
    } catch (e) {
      addToast("记账失败", "error");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteExpense(id);
      addToast("已删除", "info");
    } catch (e) {
      addToast("删除失败", "error");
    }
  };

  const getCategoryColor = (cat: string) => categories[cat] || "#6B7280";

  return (
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
              const remaining = b.limit - b.spent;
              const remainingPct = Math.max(0, (remaining / b.limit) * 100);

              // 进度条颜色逻辑：<20%红，<50%黄，其余绿
              let status = "normal";
              if (remainingPct < 20) status = "over";
              else if (remainingPct < 50) status = "warning";

              // 计算剩余天数日均可用
              let dailyAvgInfo = null;
              if (remaining > 0 && (b.key === "weekly" || b.key === "monthly")) {
                const [y, m, d] = todayStr.split('-').map(Number);
                const now = new Date(y, m - 1, d);
                let daysRemaining = 0;
                
                if (b.key === "weekly") {
                  const day = now.getDay();
                  const currentDay = day === 0 ? 7 : day;
                  daysRemaining = 8 - currentDay;
                } else if (b.key === "monthly") {
                  const daysInMonth = new Date(y, m, 0).getDate();
                  daysRemaining = daysInMonth - d + 1;
                }

                if (daysRemaining > 0) {
                  const avg = remaining / daysRemaining;
                  dailyAvgInfo = `日均可花 ${currency}${avg.toFixed(0)}`;
                }
              }

              return (
                <div key={b.key} className="budget-row">
                  <div className="budget-row-header">
                    <span className="budget-label">{b.label}</span>
                    <div className="budget-amounts">
                      <span className={`budget-spent ${status}`}>{currency}{remaining.toFixed(2)}</span>
                      <span className="budget-separator">/</span>
                      <span className="budget-total">{currency}{b.limit.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="budget-bar-bg">
                    <div className={`budget-bar-fill ${status}`} style={{ width: `${remainingPct}%` }} />
                  </div>
                  <div className="budget-row-footer">
                    <span className={`budget-pct ${status}`}>{remainingPct.toFixed(1)}%</span>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {dailyAvgInfo && (
                        <span style={{ fontSize: "10px", color: "#9CA3AF" }}>
                          {dailyAvgInfo}
                        </span>
                      )}
                      <span className="budget-remaining">
                        已支 {currency}{b.spent.toFixed(2)}
                      </span>
                    </div>
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
          <AiReceiptParser 
            theme="light" // Ideally passed from context, but simplify for now
            categories={categories} 
            onAddExpense={handleAdd} 
            currency={currency} 
            token={token} 
          />
          <div className="input-group">
            <label><Tag size={14} /> 内容</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="例如：午饭" onKeyDown={e => e.key === "Enter" && handleAdd()} />
          </div>
          <div className="input-group">
            <label><CreditCard size={14} /> 金额</label>
            <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" onKeyDown={e => e.key === "Enter" && handleAdd()} />
          </div>
          <div className="input-group">
            <label><Calendar size={14} /> 日期</label>
            <DateInput value={form.date} onChange={val => setForm({ ...form, date: val })} />
          </div>
          <div className="input-group">
            <label><Activity size={14} /> 分类</label>
            <Select
              value={form.category}
              onChange={val => setForm({ ...form, category: val })}
              options={Object.keys(categories).map(c => ({ value: c, label: c, color: categories[c] }))}
              placeholder="选择分类"
            />
          </div>
          <div className="input-group">
            <label><FileText size={14} /> 备注</label>
            <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="可选备注信息" onKeyDown={e => e.key === "Enter" && handleAdd()} />
          </div>
          <button className="submit-btn" onClick={() => handleAdd()}><PlusCircle size={18} /> 确认入账</button>
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
                        <div className="txn-title-cell">
                          <span>{item.title}</span>
                          {item.note && <span className="txn-note-inline">{item.note}</span>}
                        </div>
                      </td>
                      <td>
                        <span
                          className="tag"
                          style={{
                            backgroundColor: getCategoryColor(item.category) + "20",
                            color: getCategoryColor(item.category),
                            border: `1px solid ${getCategoryColor(item.category)}40`
                          }}
                        >
                          {item.category}
                        </span>
                      </td>
                      <td className="text-muted">{item.date}</td>
                      <td className="text-danger font-bold" style={{ whiteSpace: 'nowrap' }}>-{currency}{item.amount.toFixed(2)}</td>
                      <td>
                        <button className="icon-btn" onClick={() => handleDelete(item.id)} title="删除">
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
}

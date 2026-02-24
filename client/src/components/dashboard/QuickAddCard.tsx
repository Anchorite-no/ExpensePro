import { useState } from "react";
import { Tag, CreditCard, Calendar, Activity, FileText, PlusCircle } from "lucide-react";
import { Select } from "../ui/Select";
import { DateInput, getChinaToday } from "../DateInput";
import AiReceiptParser from "../AiReceiptParser";
import TagSuggestions from "../common/TagSuggestions";
import "./QuickAddCard.css";

interface QuickAddCardProps {
  categories: Record<string, string>;
  onAdd: (title: string, amount: number, category: string, date?: string, note?: string) => void;
  currency: string;
  theme: "light" | "dark";
  token: string | null;
  expenses: Array<{ note?: string | null }>;
}

export default function QuickAddCard({ categories, onAdd, currency, theme, token, expenses }: QuickAddCardProps) {
  const todayStr = getChinaToday();
  const categoryList = Object.keys(categories);
  const defaultCategory = categoryList[0] || "餐饮";
  
  const [form, setForm] = useState({ 
    title: "", 
    amount: "", 
    category: defaultCategory, 
    date: todayStr, 
    note: "" 
  });

  const handleSubmit = () => {
    if (!form.title || !form.amount) return;
    onAdd(form.title, Number(form.amount), form.category, form.date, form.note);
    setForm({ title: "", amount: "", category: form.category, date: todayStr, note: "" });
  };

  return (
    <div className="form-card">
      <h3>快速记账</h3>
      <AiReceiptParser 
        theme={theme} 
        categories={categories} 
        onAddExpense={(t, a, c, d) => onAdd(t, a, c, d)} 
        currency={currency} 
        token={token} 
      />
      <div className="input-group">
        <label><Tag size={14} /> 内容</label>
        <input 
          value={form.title} 
          onChange={e => setForm({ ...form, title: e.target.value })} 
          placeholder="例如：午饭" 
          onKeyDown={e => e.key === "Enter" && handleSubmit()} 
        />
      </div>
      <div className="input-group">
        <label><CreditCard size={14} /> 金额</label>
        <input 
          type="number" 
          value={form.amount} 
          onChange={e => setForm({ ...form, amount: e.target.value })} 
          placeholder="0.00" 
          onKeyDown={e => e.key === "Enter" && handleSubmit()} 
        />
      </div>
      <div className="input-group">
        <label><Calendar size={14} /> 日期</label>
        <DateInput 
          value={form.date} 
          onChange={val => setForm({ ...form, date: val })} 
        />
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
        <input 
          value={form.note} 
          onChange={e => setForm({ ...form, note: e.target.value })} 
          placeholder="可选备注信息 (使用 #标签)" 
          onKeyDown={e => e.key === "Enter" && handleSubmit()} 
        />
        <TagSuggestions 
          expenses={expenses} 
          currentNote={form.note} 
          onSelectTag={tag => setForm({ ...form, note: `${form.note} #${tag}`.trim() })} 
        />
      </div>
      <button className="submit-btn" onClick={handleSubmit}><PlusCircle size={18} /> 确认入账</button>
    </div>
  );
}

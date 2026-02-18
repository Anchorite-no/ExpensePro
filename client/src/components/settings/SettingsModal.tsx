import { useState } from "react";
import {
  Settings2, X, DollarSign, Target, ArrowUp, ArrowDown, Trash2, PlusCircle, Plus
} from "lucide-react";
import { Select } from "../ui/Select";
import { useToast } from "../ui/Toast";
import { COLOR_PALETTE, PRESET_COLORS, CURRENCIES } from "../../constants/appConfig";
import type { SettingsTab, BudgetConfig } from "../../types";
import "./SettingsModal.css";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Record<string, string>;
  currency: string;
  budget: BudgetConfig;
  onUpdateCategories: (cats: Record<string, string>) => void;
  onUpdateCurrency: (val: string) => void;
  onUpdateBudget: (budget: BudgetConfig) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  categories,
  currency,
  budget,
  onUpdateCategories,
  onUpdateCurrency,
  onUpdateBudget
}: SettingsModalProps) {
  const { addToast } = useToast();
  
  // Local state for UI logic
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(COLOR_PALETTE[0]);
  const [budgetInputs, setBudgetInputs] = useState({ daily: "", weekly: "", monthly: "" });
  const [editingBudget, setEditingBudget] = useState<string | null>(null);

  const categoryList = Object.keys(categories);

  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name || categories[name]) return;
    const updated = { ...categories, [name]: newCategoryColor };
    onUpdateCategories(updated);
    setNewCategoryName("");
    const usedColors = Object.values(updated);
    const next = COLOR_PALETTE.find(c => !usedColors.includes(c)) || COLOR_PALETTE[0];
    setNewCategoryColor(next);
    addToast(`分类「${name}」已添加`, "success");
  };

  const removeCategory = (name: string) => {
    const updated = { ...categories };
    delete updated[name];
    onUpdateCategories(updated);
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
    onUpdateCategories(newCats);
  };

  const startEditBudget = (field: keyof BudgetConfig) => {
    setEditingBudget(field);
    setBudgetInputs(prev => ({ ...prev, [field]: budget[field] > 0 ? String(budget[field]) : "" }));
  };

  const saveBudgetField = (field: keyof BudgetConfig) => {
    const val = Number(budgetInputs[field]);
    if (isNaN(val) || val < 0) return;
    const updated = { ...budget, [field]: val };
    onUpdateBudget(updated);
    setEditingBudget(null);
    setBudgetInputs(prev => ({ ...prev, [field]: "" }));
    addToast("预算已更新", "success");
  };

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

  if (!isOpen) return null;

  return (
    <div className="category-manager-overlay" onClick={onClose}>
      <div className="category-manager settings-modal" onClick={e => e.stopPropagation()}>
        <div className="category-manager-header">
          <h3><Settings2 size={18} /> 系统设置</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
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
                <Select value={currency} onChange={onUpdateCurrency} options={CURRENCIES} />
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
  );
}

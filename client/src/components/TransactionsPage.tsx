import { useMemo, useState, useRef } from "react";
import {
  Search, SlidersHorizontal, ChevronLeft, ChevronRight,
  Trash2, ArrowUpDown, ArrowUp, ArrowDown, Tag,
  CreditCard, Activity, PlusCircle, Calendar,
  Download, Upload, Pencil, X, Check, CheckCheck, FileText
} from "lucide-react";
import { Select } from "./ui/Select";

interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string;
  note?: string;
  date: string;
}

const getCategoryColor = (category: string, cats: Record<string, string>) =>
  cats[category] || "#6B7280";

type SortField = "date" | "amount" | "title" | "category";
type SortOrder = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

interface EditDraft {
  title: string;
  amount: string;
  category: string;
  date: string;
  note: string;
}

interface Props {
  expenses: Expense[];
  theme: "light" | "dark";
  categories: Record<string, string>;
  onDelete: (id: number) => void;
  onAdd: (title: string, amount: number, category: string, date?: string) => void;
  onEdit: (id: number, title: string, amount: number, category: string, date: string, note?: string) => void;
  onImport: (items: any[]) => void;
  currency: string;
}

export default function TransactionsPage({ expenses, categories, onDelete, onAdd, onEdit, onImport, currency }: Props) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("全部");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 新增表单
  const [showForm, setShowForm] = useState(false);
  const defaultCategory = Object.keys(categories)[0] || "餐饮";
  const [form, setForm] = useState({ title: "", amount: "", category: defaultCategory, date: "", note: "" });

  // 编辑模式：支持单个和批量
  const [batchEditMode, setBatchEditMode] = useState(false);
  const [editDrafts, setEditDrafts] = useState<Record<number, EditDraft>>({});
  // 单条编辑
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditDraft>({ title: "", amount: "", category: "", date: "", note: "" });

  // CSV 导入
  const importInputRef = useRef<HTMLInputElement>(null);

  // 筛选 + 排序
  const processedData = useMemo(() => {
    let data = [...expenses];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter(
        e => e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || (e.note && e.note.toLowerCase().includes(q))
      );
    }

    if (categoryFilter !== "全部") {
      data = data.filter(e => e.category === categoryFilter);
    }

    data.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date": cmp = a.date.localeCompare(b.date); break;
        case "amount": cmp = a.amount - b.amount; break;
        case "title": cmp = a.title.localeCompare(b.title); break;
        case "category": cmp = a.category.localeCompare(b.category); break;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return data;
  }, [expenses, search, categoryFilter, sortField, sortOrder]);

  // 分页
  const totalPages = Math.max(1, Math.ceil(processedData.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedData = processedData.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const filteredTotal = processedData.reduce((s, e) => s + e.amount, 0);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "amount" ? "desc" : "asc");
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="sort-icon muted" />;
    return sortOrder === "asc"
      ? <ArrowUp size={14} className="sort-icon active" />
      : <ArrowDown size={14} className="sort-icon active" />;
  };

  const handleAdd = () => {
    if (!form.title || !form.amount) return;
    onAdd(form.title, Number(form.amount), form.category, form.date || undefined);
    setForm({ title: "", amount: "", category: defaultCategory, date: "", note: "" });
    setShowForm(false);
  };

  // === 单条编辑 ===
  const startSingleEdit = (item: Expense) => {
    setEditingId(item.id);
    setEditForm({
      title: item.title,
      amount: String(item.amount),
      category: item.category,
      date: item.date,
      note: item.note || "",
    });
  };

  const cancelSingleEdit = () => {
    setEditingId(null);
    setEditForm({ title: "", amount: "", category: "", date: "", note: "" });
  };

  const saveSingleEdit = () => {
    if (!editingId || !editForm.title || !editForm.amount) return;
    onEdit(editingId, editForm.title, Number(editForm.amount), editForm.category, editForm.date, editForm.note);
    cancelSingleEdit();
  };

  // === 批量编辑 ===
  const enterBatchEdit = () => {
    setBatchEditMode(true);
    const drafts: Record<number, EditDraft> = {};
    pagedData.forEach(item => {
      drafts[item.id] = {
        title: item.title,
        amount: String(item.amount),
        category: item.category,
        date: item.date,
        note: item.note || "",
      };
    });
    setEditDrafts(drafts);
  };

  const cancelBatchEdit = () => {
    setBatchEditMode(false);
    setEditDrafts({});
  };

  const updateDraft = (id: number, field: keyof EditDraft, value: string) => {
    setEditDrafts(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const saveBatchEdit = () => {
    Object.entries(editDrafts).forEach(([idStr, draft]) => {
      const id = Number(idStr);
      const original = expenses.find(e => e.id === id);
      if (!original) return;
      if (!draft.title || !draft.amount) return;

      const changed =
        draft.title !== original.title ||
        Number(draft.amount) !== original.amount ||
        draft.category !== original.category ||
        draft.date !== original.date ||
        draft.note !== (original.note || "");

      if (changed) {
        onEdit(id, draft.title, Number(draft.amount), draft.category, draft.date, draft.note);
      }
    });
    cancelBatchEdit();
  };

  const isEditing = (id: number) => {
    if (batchEditMode) return id in editDrafts;
    return editingId === id;
  };

  const getEditValue = (id: number, field: keyof EditDraft) => {
    if (batchEditMode) return editDrafts[id]?.[field] || "";
    return editForm[field];
  };

  const setEditValue = (id: number, field: keyof EditDraft, value: string) => {
    if (batchEditMode) {
      updateDraft(id, field, value);
    } else {
      setEditForm(prev => ({ ...prev, [field]: value }));
    }
  };

  // CSV 导出
  const exportCSV = () => {
    if (processedData.length === 0) return;
    const BOM = "\uFEFF";
    const header = ["日期", "项目", "分类", "金额", "备注"];
    const rows = processedData.map(e => [
      e.date,
      `"${e.title.replace(/"/g, '""')}"`,
      e.category,
      e.amount.toFixed(2),
      `"${(e.note || "").replace(/"/g, '""')}"`,
    ]);

    const csv = BOM + [header.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ExpensePro_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV 导入
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;

      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return; // header + at least 1 row

      // Parse header to detect column positions
      const header = lines[0].replace(/^\uFEFF/, "").split(",").map(h => h.trim().replace(/^"|"$/g, ""));
      const dateIdx = header.findIndex(h => /日期|date/i.test(h));
      const titleIdx = header.findIndex(h => /项目|内容|title/i.test(h));
      const catIdx = header.findIndex(h => /分类|category/i.test(h));
      const amountIdx = header.findIndex(h => /金额|amount/i.test(h));
      const noteIdx = header.findIndex(h => /备注|note/i.test(h));

      if (titleIdx === -1 || amountIdx === -1) return;

      const items: any[] = [];
      const categoryKeys = Object.keys(categories);

      for (let i = 1; i < lines.length; i++) {
        // Simple CSV parsing (handles quoted fields)
        const cols = parseCSVLine(lines[i]);
        const title = cols[titleIdx]?.trim();
        const amount = parseFloat(cols[amountIdx]?.trim() || "0");
        if (!title || isNaN(amount) || amount <= 0) continue;

        const category = catIdx >= 0 && cols[catIdx]?.trim()
          ? cols[catIdx].trim()
          : categoryKeys[categoryKeys.length - 1] || "其他";
        const date = dateIdx >= 0 ? cols[dateIdx]?.trim() : "";
        const note = noteIdx >= 0 ? cols[noteIdx]?.trim() : "";

        items.push({ title, amount, category, date: date || undefined, note });
      }

      if (items.length > 0) {
        onImport(items);
      }
    };
    reader.readAsText(file);

    // Reset input value so the same file can be re-imported
    e.target.value = "";
  };

  return (
    <div className="transactions-page">
      {/* 工具栏 */}
      <div className="txn-toolbar">
        <div className="txn-toolbar-left">
          <div className="txn-search">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="搜索交易记录..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            />
          </div>

          <div className="txn-filter">
            <SlidersHorizontal size={16} />
            <div style={{ width: 140 }}>
              <Select
                value={categoryFilter}
                onChange={val => { setCategoryFilter(val); setCurrentPage(1); }}
                options={[
                  { value: "全部", label: "全部分类" },
                  ...Object.keys(categories).map(c => ({ value: c, label: c, color: categories[c] }))
                ]}
              />
            </div>
          </div>
        </div>

        <div className="txn-toolbar-right">
          <span className="txn-summary">
            共 {processedData.length} 条 · 合计 {currency}{filteredTotal.toFixed(2)}
          </span>
          {batchEditMode ? (
            <>
              <button className="txn-save-btn" onClick={saveBatchEdit}>
                <CheckCheck size={16} /> 保存全部
              </button>
              <button className="txn-cancel-btn" onClick={cancelBatchEdit}>
                <X size={16} /> 取消
              </button>
            </>
          ) : (
            <>
              <button className="txn-edit-mode-btn" onClick={enterBatchEdit} disabled={pagedData.length === 0} title="批量编辑当前页">
                <Pencil size={16} /> 编辑
              </button>
              <button className="txn-export-btn" onClick={exportCSV} title="导出 CSV" disabled={processedData.length === 0}>
                <Download size={16} /> 导出
              </button>
              <button className="txn-import-btn" onClick={() => importInputRef.current?.click()} title="导入 CSV">
                <Upload size={16} /> 导入
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={handleImportCSV}
              />
              <button className="txn-add-btn" onClick={() => setShowForm(!showForm)}>
                <PlusCircle size={16} />
                记账
              </button>
            </>
          )}
        </div>
      </div>

      {/* 快速记账表单 */}
      {showForm && !batchEditMode && (
        <div className="txn-form-inline">
          <div className="txn-form-fields">
            <div className="txn-form-field">
              <Tag size={14} />
              <input
                placeholder="内容"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="txn-form-field">
              <CreditCard size={14} />
              <input
                type="number"
                placeholder="金额"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="txn-form-field">
              <Calendar size={14} />
              <input
                type="date"
                placeholder="日期（留空=今天）"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="txn-form-field">
              <Activity size={14} />
              <Select
                value={form.category}
                onChange={val => setForm({ ...form, category: val })}
                options={Object.keys(categories).map(c => ({ value: c, label: c, color: categories[c] }))}
              />
            </div>
            <div className="txn-form-field">
              <FileText size={14} />
              <input
                placeholder="备注（可选）"
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
            </div>
            <button className="submit-btn compact" onClick={handleAdd}>
              <PlusCircle size={16} /> 确认
            </button>
          </div>
        </div>
      )}

      {/* 表格 */}
      <div className="txn-table-card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort("date")}>
                  日期 <SortIcon field="date" />
                </th>
                <th className="sortable" onClick={() => handleSort("title")}>
                  项目 <SortIcon field="title" />
                </th>
                <th className="sortable" onClick={() => handleSort("category")}>
                  分类 <SortIcon field="category" />
                </th>
                <th className="sortable" onClick={() => handleSort("amount")}>
                  金额 <SortIcon field="amount" />
                </th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pagedData.length > 0 ? (
                pagedData.map(item => (
                  <tr key={item.id} className={isEditing(item.id) ? "editing-row" : ""}>
                    {isEditing(item.id) ? (
                      <>
                        <td>
                          <input
                            className="txn-edit-input"
                            type="date"
                            value={getEditValue(item.id, "date")}
                            onChange={e => setEditValue(item.id, "date", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="txn-edit-input"
                            value={getEditValue(item.id, "title")}
                            onChange={e => setEditValue(item.id, "title", e.target.value)}
                            onKeyDown={e => e.key === "Enter" && (batchEditMode ? saveBatchEdit() : saveSingleEdit())}
                            placeholder="项目名称"
                          />
                          <input
                            className="txn-edit-input txn-edit-note"
                            value={getEditValue(item.id, "note")}
                            onChange={e => setEditValue(item.id, "note", e.target.value)}
                            placeholder="备注（可选）"
                          />
                        </td>
                        <td>
                          <div style={{ width: 100 }}>
                            <Select
                              value={getEditValue(item.id, "category")}
                              onChange={val => setEditValue(item.id, "category", val)}
                              options={Object.keys(categories).map(c => ({ value: c, label: c, color: categories[c] }))}
                            />
                          </div>
                        </td>
                        <td>
                          <input
                            className="txn-edit-input txn-edit-amount"
                            type="number"
                            value={getEditValue(item.id, "amount")}
                            onChange={e => setEditValue(item.id, "amount", e.target.value)}
                            onKeyDown={e => e.key === "Enter" && (batchEditMode ? saveBatchEdit() : saveSingleEdit())}
                          />
                        </td>
                        <td>
                          {!batchEditMode && (
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="icon-btn" onClick={saveSingleEdit} title="保存" style={{ color: "#10B981" }}>
                                <Check size={16} />
                              </button>
                              <button className="icon-btn" onClick={cancelSingleEdit} title="取消">
                                <X size={16} />
                              </button>
                            </div>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="text-muted">{item.date}</td>
                        <td className="font-medium">
                          <div>{item.title}</div>
                          {item.note && <div className="txn-note-text">{item.note}</div>}
                        </td>
                        <td>
                          <span
                            className="tag"
                            style={{
                              backgroundColor: getCategoryColor(item.category, categories) + "20",
                              color: getCategoryColor(item.category, categories),
                              border: `1px solid ${getCategoryColor(item.category, categories)}40`,
                            }}
                          >
                            {item.category}
                          </span>
                        </td>
                        <td className="text-danger font-bold">-{currency}{item.amount.toFixed(2)}</td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="icon-btn" onClick={() => startSingleEdit(item)} title="编辑" style={{ color: "var(--primary)" }}>
                              <Pencil size={14} />
                            </button>
                            <button className="icon-btn" onClick={() => onDelete(item.id)} title="删除">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="empty-hint">
                    {search || categoryFilter !== "全部" ? "没有匹配的记录" : "还没有任何消费记录"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分页器 */}
      {processedData.length > 0 && (
        <div className="txn-pagination">
          <div className="pagination-info">
            第 {(safeCurrentPage - 1) * pageSize + 1}-{Math.min(safeCurrentPage * pageSize, processedData.length)} 条，共 {processedData.length} 条
          </div>
          <div className="pagination-controls">
            <div style={{ width: 130 }}>
              <Select
                value={pageSize.toString()}
                onChange={val => { setPageSize(Number(val)); setCurrentPage(1); }}
                options={PAGE_SIZE_OPTIONS.map(s => ({ value: s.toString(), label: `每页 ${s} 条` }))}
              />
            </div>
            <button className="page-btn" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(safeCurrentPage - 1)}>
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 1)
              .reduce<(number | string)[]>((acc, p, i, arr) => {
                if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                typeof p === "string" ? (
                  <span key={`dots-${i}`} className="page-dots">...</span>
                ) : (
                  <button key={p} className={`page-btn ${p === safeCurrentPage ? "active" : ""}`} onClick={() => setCurrentPage(p)}>
                    {p}
                  </button>
                )
              )}
            <button className="page-btn" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage(safeCurrentPage + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Simple CSV line parser that handles quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

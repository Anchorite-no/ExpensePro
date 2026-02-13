import { useMemo, useState } from "react";
import {
  Search, SlidersHorizontal, ChevronLeft, ChevronRight,
  Trash2, ArrowUpDown, ArrowUp, ArrowDown, Tag,
  CreditCard, Activity, PlusCircle, Calendar
} from "lucide-react";
import { Select } from "./ui/Select";

interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string;
  date: string;
}

const getCategoryColor = (category: string, cats: Record<string, string>) =>
  cats[category] || "#6B7280";

type SortField = "date" | "amount" | "title" | "category";
type SortOrder = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

interface Props {
  expenses: Expense[];
  theme: "light" | "dark";
  categories: Record<string, string>;
  onDelete: (id: number) => void;
  onAdd: (title: string, amount: number, category: string, date?: string) => void;
}

export default function TransactionsPage({ expenses, theme, categories, onDelete, onAdd }: Props) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("全部");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 新增表单
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", amount: "", category: "餐饮", date: "" });

  // 筛选 + 排序
  const processedData = useMemo(() => {
    let data = [...expenses];

    // 搜索
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter(
        (e) => e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
      );
    }

    // 分类筛选
    if (categoryFilter !== "全部") {
      data = data.filter((e) => e.category === categoryFilter);
    }

    // 排序
    data.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date":
          cmp = a.date.localeCompare(b.date);
          break;
        case "amount":
          cmp = a.amount - b.amount;
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "category":
          cmp = a.category.localeCompare(b.category);
          break;
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

  // 统计
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
    setForm({ title: "", amount: "", category: "餐饮", date: "" });
    setShowForm(false);
  };

  return (
    <div className="transactions-page">
      {/* 工具栏 */}
      <div className="txn-toolbar">
        <div className="txn-toolbar-left">
          {/* 搜索 */}
          <div className="txn-search">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="搜索交易记录..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            />
          </div>

          {/* 分类筛选 */}
          <div className="txn-filter">
            <SlidersHorizontal size={16} />
            <div style={{ width: 140 }}>
              <Select
                value={categoryFilter}
                onChange={(val) => { setCategoryFilter(val); setCurrentPage(1); }}
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
            共 {processedData.length} 条 · 合计 ¥{filteredTotal.toFixed(2)}
          </span>
          <button className="txn-add-btn" onClick={() => setShowForm(!showForm)}>
            <PlusCircle size={16} />
            记账
          </button>
        </div>
      </div>

      {/* 快速记账表单（可收起） */}
      {showForm && (
        <div className="txn-form-inline">
          <div className="txn-form-fields">
            <div className="txn-form-field">
              <Tag size={14} />
              <input
                placeholder="内容"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="txn-form-field">
              <CreditCard size={14} />
              <input
                type="number"
                placeholder="金额"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="txn-form-field">
              <Calendar size={14} />
              <input
                type="date"
                placeholder="日期（留空=今天）"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="txn-form-field">
              <Activity size={14} />
              <Select
                value={form.category}
                onChange={(val) => setForm({ ...form, category: val })}
                options={Object.keys(categories).map(c => ({ value: c, label: c, color: categories[c] }))}
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
                pagedData.map((item) => (
                  <tr key={item.id}>
                    <td className="text-muted">{item.date}</td>
                    <td className="font-medium">{item.title}</td>
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
                    <td className="text-danger font-bold">-¥{item.amount.toFixed(2)}</td>
                    <td>
                      <button className="icon-btn" onClick={() => onDelete(item.id)} title="删除">
                        <Trash2 size={16} />
                      </button>
                    </td>
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
                onChange={(val) => { setPageSize(Number(val)); setCurrentPage(1); }}
                options={PAGE_SIZE_OPTIONS.map(s => ({ value: s.toString(), label: `每页 ${s} 条` }))}
              />
            </div>
            <button
              className="page-btn"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage(safeCurrentPage - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 1)
              .reduce<(number | string)[]>((acc, p, i, arr) => {
                if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                typeof p === "string" ? (
                  <span key={`dots-${i}`} className="page-dots">...</span>
                ) : (
                  <button
                    key={p}
                    className={`page-btn ${p === safeCurrentPage ? "active" : ""}`}
                    onClick={() => setCurrentPage(p)}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              className="page-btn"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(safeCurrentPage + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

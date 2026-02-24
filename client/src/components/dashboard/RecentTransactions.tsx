import React from "react";
import { Trash2 } from "lucide-react";
import "./RecentTransactions.css";
import type { Expense } from "../../types";
import { getCategoryColor } from "../../utils/helpers";
import NoteWithTags from "../common/NoteWithTags";

interface RecentTransactionsProps {
  expenses: Expense[];
  categories: Record<string, string>;
  currency: string;
  onDelete: (id: number) => void;
}

const RecentTransactions = React.memo(({ expenses, categories, currency, onDelete }: RecentTransactionsProps) => {
  return (
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
                      {item.note && <NoteWithTags note={item.note} className="txn-note-inline" />}
                    </div>
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
                  <td className="text-danger font-bold" style={{ whiteSpace: 'nowrap' }}>-{currency}{item.amount.toFixed(2)}</td>
                  <td>
                    <button className="icon-btn" onClick={() => onDelete(item.id)} title="删除">
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
  );
});

export default RecentTransactions;

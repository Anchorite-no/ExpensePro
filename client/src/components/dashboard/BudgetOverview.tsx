import React, { useMemo } from "react";
import { Target } from "lucide-react";
import type { BudgetConfig } from "../../types";
import { getChinaToday } from "../../utils/helpers";

interface BudgetOverviewProps {
  budget: BudgetConfig;
  periodExpenses: { daily: number; weekly: number; monthly: number };
  currency: string;
}

const BudgetOverview = React.memo(({ budget, periodExpenses, currency }: BudgetOverviewProps) => {
  const activeBudgets = useMemo(() => {
    const result: { key: keyof BudgetConfig; label: string; limit: number; spent: number }[] = [];
    if (budget.daily > 0) result.push({ key: "daily", label: "日预算", limit: budget.daily, spent: periodExpenses.daily });
    if (budget.weekly > 0) result.push({ key: "weekly", label: "周预算", limit: budget.weekly, spent: periodExpenses.weekly });
    if (budget.monthly > 0) result.push({ key: "monthly", label: "月预算", limit: budget.monthly, spent: periodExpenses.monthly });
    return result;
  }, [budget, periodExpenses]);

  if (activeBudgets.length === 0) return null;

  return (
    <div className="budget-card">
      <div className="budget-card-title">
        <Target size={16} />
        <span>预算概览</span>
      </div>
      <div className="budget-list">
        {activeBudgets.map(b => {
          const remaining = b.limit - b.spent;
          const remainingPct = Math.max(0, (remaining / b.limit) * 100);

          let status = "normal";
          if (remainingPct < 20) status = "over";
          else if (remainingPct < 50) status = "warning";

          let dailyAvgInfo = null;
          if (remaining > 0 && (b.key === "weekly" || b.key === "monthly")) {
            const todayStr = getChinaToday();
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
  );
});

export default BudgetOverview;

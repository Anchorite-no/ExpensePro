import React from "react";
import { Wallet, Activity, TrendingUp } from "lucide-react";
import "./StatsGrid.css";

interface StatsGridProps {
  totalAmount: number;
  expenseCount: number;
  maxExpense: number;
  currency: string;
}

const StatsGrid = React.memo(({ totalAmount, expenseCount, maxExpense, currency }: StatsGridProps) => {
  return (
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
          <span className="value">{expenseCount}</span>
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
  );
});

export default StatsGrid;

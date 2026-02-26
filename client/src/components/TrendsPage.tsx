import { useMemo, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, AreaChart, Area
} from "recharts";
import { Wallet, Activity, TrendingUp, Calendar, Tag as TagIcon, LayoutGrid } from "lucide-react";
import "./TrendsPage.css";
import TagTrendsDashboard from "./trends/TagTrendsDashboard";

interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string;
  date: string;
}

const getCategoryColor = (category: string, categories: Record<string, string>) =>
  categories[category] || "#6B7280";

// 通用 Tooltip
const ChartTooltip = ({ active, payload, label, theme, currency }: any) => {
  if (!active || !payload?.length) return null;

  const activePayload = payload.filter((entry: any) => Number(entry.value) > 0).reverse();
  if (activePayload.length === 0) return null;

  return (
    <div className={`custom-tooltip ${theme}`}>
      <p className="tooltip-label">{label}</p>
      {activePayload.map((entry: any, i: number) => (
        <p key={i} className="tooltip-value" style={{ color: entry.color }}>
          {entry.name}: {currency}{Number(entry.value).toFixed(2)}
        </p>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload, theme, currency }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload[0].payload.total;
  const pct = ((payload[0].value / total) * 100).toFixed(1);
  return (
    <div className={`custom-tooltip ${theme}`}>
      <p className="tooltip-label">{payload[0].name}</p>
      <p className="tooltip-value">{currency}{payload[0].value.toFixed(2)}</p>
      <p className="tooltip-pct">{pct}%</p>
    </div>
  );
};

type TimeRange = "current-week" | "current-month" | "last-3-months" | "all";

interface Props {
  expenses: Expense[];
  theme: "light" | "dark";
  categories: Record<string, string>;
  currency: string;
}

// 获取ISO周号
function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

// 根据时间范围决定聚合粒度
function getGranularity(range: TimeRange): "day" | "week" | "month" {
  if (range === "current-week") return "day";
  if (range === "current-month") return "day";
  if (range === "last-3-months") return "week";
  return "month";
}

// 获取聚合 key
function getGroupKey(dateStr: string, granularity: "day" | "week" | "month"): string {
  if (granularity === "day") return dateStr;
  if (granularity === "week") return getWeekKey(dateStr);
  return dateStr.substring(0, 7); // YYYY-MM
}

// 格式化聚合 key 为显示文本
function formatGroupKey(key: string, granularity: "day" | "week" | "month"): string {
  if (granularity === "day") {
    return new Date(key).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  }
  if (granularity === "week") {
    const w = parseInt(key.split("-W")[1], 10);
    return `第${w}周`;
  }
  return parseInt(key.split("-")[1], 10) + "月";
}

export default function TrendsPage({ expenses, theme, categories, currency }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>("current-week");
  const [analysisType, setAnalysisType] = useState<"category" | "tag">("category");

  const chartColors = {
    grid: theme === "dark" ? "#374151" : "#E5E7EB",
    axis: theme === "dark" ? "#9CA3AF" : "#6B7280",
  };

  const granularity = getGranularity(timeRange);

  // 根据时间范围过滤数据
  const filteredExpenses = useMemo(() => {
    if (timeRange === "all") return expenses;
    
    const now = new Date();
    // 重置时间为当天 00:00:00，避免时分秒干扰日期比较
    now.setHours(0, 0, 0, 0);

    let cutoff = new Date(now);

    if (timeRange === "current-week") {
      // 获取当前周的周一
      const day = now.getDay() || 7; // 0 is Sunday, make it 7
      if (day !== 1) {
        cutoff.setDate(now.getDate() - day + 1);
      }
    } else if (timeRange === "current-month") {
      // 获取当月1号
      cutoff.setDate(1);
    } else if (timeRange === "last-3-months") {
      // 近三个月 (90天)
      cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    // 比较时统一转为 YYYY-MM-DD 字符串或时间戳
    // 注意：expenses.date 是 YYYY-MM-DD 字符串
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

    return expenses.filter((e) => e.date >= cutoffStr);
  }, [expenses, timeRange]);

  // 统计卡片数据
  const stats = useMemo(() => {
    const total = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const count = filteredExpenses.length;
    // 计算天数用于日均
    // 对于 current-week / current-month，分母应该是"已经过的天数"还是"总天数"？
    // 通常趋势分析看的是"在此期间内的日均"。
    // 简单起见，用 filteredExpenses 中最早和最晚日期的跨度，或者 range 的固定天数。
    // 这里使用数据跨度，如果数据为空则为 1
    let days = 1;
    if (filteredExpenses.length > 0) {
        const dates = filteredExpenses.map(e => e.date).sort();
        const start = new Date(dates[0]);
        const end = new Date(dates[dates.length - 1]);
        days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    }
    const avgDaily = days > 0 ? total / days : 0;
    return { total, count, avgDaily };
  }, [filteredExpenses]);

  // 活跃分类

  const activeCategories = useMemo(() => {
    const cats = new Set<string>();
    filteredExpenses.forEach((e) => cats.add(e.category));
    return Array.from(cats);
  }, [filteredExpenses]);

  // 获取活跃标签数量
  const activeTagsCount = useMemo(() => {
    const tags = new Set<string>();
    filteredExpenses.forEach(e => {
      // 提取 #tag 格式的标签
      const matches = e.note?.match(/#([^\s#]+)/g) || [];
      matches.forEach(m => tags.add(m.substring(1)));
    });
    return tags.size;
  }, [filteredExpenses]);

  // 分类饼图数据
  const categoryData = useMemo(() => {
    const total = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const map: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value, total }));
  }, [filteredExpenses]);

  // 按粒度聚合总支出
  const aggregatedData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      const key = getGroupKey(e.date, granularity);
      map[key] = (map[key] || 0) + e.amount;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, amount]) => ({
        label: formatGroupKey(key, granularity),
        支出: amount,
      }));
  }, [filteredExpenses, granularity]);

  // 每日支出分类堆叠数据
  const dailyStackedData = useMemo(() => {
    const groupMap: Record<string, Record<string, number>> = {};
    const allCats = new Set<string>();

    filteredExpenses.forEach((e) => {
      const key = getGroupKey(e.date, granularity);
      allCats.add(e.category);
      if (!groupMap[key]) groupMap[key] = {};
      groupMap[key][e.category] = (groupMap[key][e.category] || 0) + e.amount;
    });

    return Object.entries(groupMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, cats]) => {
        const entry: any = { label: formatGroupKey(key, granularity) };
        allCats.forEach((cat) => {
          entry[cat] = cats[cat] || 0;
        });
        return entry;
      });
  }, [filteredExpenses, granularity]);

  // 分类堆积面积图
  const categoryAreaData = useMemo(() => {
    const groupMap: Record<string, Record<string, number>> = {};
    const allCats = new Set<string>();

    filteredExpenses.forEach((e) => {
      const key = getGroupKey(e.date, granularity);
      allCats.add(e.category);
      if (!groupMap[key]) groupMap[key] = {};
      groupMap[key][e.category] = (groupMap[key][e.category] || 0) + e.amount;
    });

    return Object.entries(groupMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, cats]) => {
        const entry: any = { label: formatGroupKey(key, granularity) };
        allCats.forEach((cat) => {
          entry[cat] = cats[cat] || 0;
        });
        return entry;
      });
  }, [filteredExpenses, granularity]);

  const timeRanges: { key: TimeRange; label: string }[] = [
    { key: "current-week", label: "本周" },
    { key: "current-month", label: "本月" },
    { key: "last-3-months", label: "近三个月" },
    { key: "all", label: "全部" },
  ];


  const cursorBar = { fill: theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" };
  const cursorLine = { stroke: theme === "dark" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)" };

  return (
    <div className="trends-page">
      {/* 时间筛选器 */}
      <div className="time-filter">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Calendar size={16} />
          <span className="filter-label">时间范围</span>
          <div className="filter-btns">
            {timeRanges.map((r) => (
              <button
                key={r.key}
                className={`filter-btn ${timeRange === r.key ? "active" : ""}`}
                onClick={() => setTimeRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        
        <div style={{ flex: 1 }} />
        
        <div className="analysis-type-toggle">
          <button 
            className={`toggle-btn ${analysisType === 'category' ? 'active' : ''}`}
            onClick={() => setAnalysisType('category')}
          >
            <LayoutGrid size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }}/> 分类分析
          </button>
          <button 
            className={`toggle-btn ${analysisType === 'tag' ? 'active' : ''}`}
            onClick={() => setAnalysisType('tag')}
          >
            <TagIcon size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }}/> 标签大屏
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Wallet size={24} /></div>
          <div className="stat-info">
            <span className="label">总支出</span>
            <span className="value">{currency}{stats.total.toFixed(2)}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">
            {analysisType === 'category' ? <Activity size={24} /> : <TagIcon size={24} />}
          </div>
          <div className="stat-info">
            <span className="label">{analysisType === 'category' ? '交易笔数' : '活跃标签'}</span>
            <span className="value">{analysisType === 'category' ? stats.count : activeTagsCount}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><TrendingUp size={24} /></div>
          <div className="stat-info">
            <span className="label">日均支出</span>
            <span className="value">{currency}{stats.avgDaily.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {analysisType === 'tag' ? (
        <TagTrendsDashboard 
          expenses={filteredExpenses} 
          theme={theme} 
          categories={categories} 
          currency={currency}
          timeRange={timeRange}
        />
      ) : (
        <>
          {/* 分类堆积面积图 */}
          <div className="chart-card chart-full">
            <h3>分类支出趋势</h3>
            {categoryAreaData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={categoryAreaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="label" stroke={chartColors.axis} fontSize={12} />
                  <YAxis stroke={chartColors.axis} fontSize={12} />
                  <Tooltip content={<ChartTooltip theme={theme} currency={currency} />} cursor={cursorLine} />
                  {activeCategories.map((cat) => (
                    <Area
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      stackId="1"
                      stroke={getCategoryColor(cat, categories)}
                      fill={getCategoryColor(cat, categories)}
                      fillOpacity={0.6}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="empty-hint">暂无数据</p>}
          </div>

          {/* 每日支出明细堆叠柱状图 + 支出对比柱状图 */}
          <div className="charts-grid">
            <div className="chart-card">
              <h3>每日支出明细</h3>
              {dailyStackedData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dailyStackedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                    <XAxis dataKey="label" stroke={chartColors.axis} fontSize={12} />
                    <YAxis stroke={chartColors.axis} fontSize={12} />
                    <Tooltip content={<ChartTooltip theme={theme} currency={currency} />} cursor={cursorBar} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {activeCategories.map((cat, i) => (
                      <Bar
                        key={cat}
                        dataKey={cat}
                        stackId="stack"
                        fill={getCategoryColor(cat, categories)}
                        radius={i === activeCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="empty-hint">暂无数据</p>}
            </div>
            <div className="chart-card">
              <h3>支出对比</h3>
              {aggregatedData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={aggregatedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                    <XAxis dataKey="label" stroke={chartColors.axis} fontSize={12} />
                    <YAxis stroke={chartColors.axis} fontSize={12} />
                    <Tooltip content={<ChartTooltip theme={theme} currency={currency} />} cursor={cursorBar} />
                    <Bar dataKey="支出" fill="#6366F1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="empty-hint">暂无数据</p>}
            </div>
          </div>

          {/* 支出趋势折线图 + 支出分类占比饼图 */}
          <div className="charts-grid">
            <div className="chart-card">
              <h3>支出趋势</h3>
              {aggregatedData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={aggregatedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                    <XAxis dataKey="label" stroke={chartColors.axis} fontSize={12} />
                    <YAxis stroke={chartColors.axis} fontSize={12} />
                    <Tooltip content={<ChartTooltip theme={theme} currency={currency} />} cursor={cursorLine} />
                    <Line type="monotone" dataKey="支出" stroke="#10B981" strokeWidth={2.5} dot={{ fill: "#10B981", r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="empty-hint">暂无数据</p>}
            </div>
            <div className="chart-card">
              <h3>支出分类占比</h3>
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                      {categoryData.map((entry, i) => (
                        <Cell key={i} fill={getCategoryColor(entry.name, categories)} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip theme={theme} currency={currency} />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="empty-hint">暂无数据</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import React, { useMemo, useState, useEffect, useRef } from "react";
import * as d3 from "d3-force";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, BarChart, Bar, Cell, LabelList
} from "recharts";
import { extractTags } from "../../utils/tags";
import "./TagTrendsDashboard.css";
import { PRESET_COLORS } from "../../constants/appConfig";

interface TagStat {
  tag: string;
  count: number;
  amount: number;
  mainCat: string;
}

interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string;
  date: string;
  note?: string | null;
}

interface Props {
  expenses: Expense[];
  theme: "light" | "dark";
  categories: Record<string, string>;
  currency: string;
}

// 辅助：获取主色系或随机色
const getTagColor = (tag: string, index: number) => {
  return PRESET_COLORS[index % PRESET_COLORS.length];
};

export default function TagTrendsDashboard({ expenses, theme, categories, currency }: Props) {
  // 1. 数据聚合核心逻辑
  const { tagsSummary, coOccurrence, totalAmount, activeTagsCount, dailyTagData } = useMemo(() => {
    let totalAmount = 0;
    const tagMap = new Map<string, { count: number; amount: number; cats: Record<string, number> }>();
    const coOccur = new Map<string, number>();
    const dailyMap = new Map<string, Record<string, number>>();

    expenses.forEach(e => {
      totalAmount += e.amount;
      const tags = extractTags(e.note);
      
      const day = e.date.substring(0, 10);
      if (!dailyMap.has(day)) dailyMap.set(day, {});
      const dayData = dailyMap.get(day)!;

      tags.forEach(t => {
        // Tag Stats
        if (!tagMap.has(t)) tagMap.set(t, { count: 0, amount: 0, cats: {} });
        const s = tagMap.get(t)!;
        s.count += 1;
        s.amount += e.amount;
        s.cats[e.category] = (s.cats[e.category] || 0) + 1;

        // Daily Data
        dayData[t] = (dayData[t] || 0) + e.amount;
      });

      // Co-occurrence
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          const t1 = tags[i] < tags[j] ? tags[i] : tags[j];
          const t2 = tags[i] < tags[j] ? tags[j] : tags[i];
          const key = `${t1}|${t2}`;
          coOccur.set(key, (coOccur.get(key) || 0) + 1);
        }
      }
    });

    const summary: TagStat[] = Array.from(tagMap.entries()).map(([tag, data]) => {
      let mainCat = "其他";
      let maxCatCount = 0;
      Object.entries(data.cats).forEach(([c, cnt]) => {
        if (cnt > maxCatCount) { maxCatCount = cnt; mainCat = c; }
      });
      return { tag, count: data.count, amount: data.amount, mainCat };
    });
    
    // Sort by amount desc
    summary.sort((a, b) => b.amount - a.amount);

    return { 
      tagsSummary: summary, 
      coOccurrence: coOccur, 
      totalAmount, 
      activeTagsCount: summary.length,
      dailyTagData: dailyMap
    };
  }, [expenses]);

  return (
    <div className="tag-trends-dashboard">
      <Row1Tree expenses={expenses} totalAmount={totalAmount} currency={currency} theme={theme} categories={categories} />
      <Row2ForceGraph tagsSummary={tagsSummary} coOccurrence={coOccurrence} theme={theme} />
      <div className="charts-grid-7-5">
        <Row3Quadrant tagsSummary={tagsSummary} currency={currency} theme={theme} />
        <Row3TopBar tagsSummary={tagsSummary} currency={currency} />
      </div>
      <div className="charts-grid-7-5">
        <Row4Heatmap dailyTagData={dailyTagData} tagsSummary={tagsSummary} theme={theme} currency={currency} />
        <Row4WordCloud tagsSummary={tagsSummary} />
      </div>
    </div>
  );
}

// ============== 第一排：资金解构逻辑树 ==============
function Row1Tree({ expenses, totalAmount, currency, theme, categories }: any) {
  const containerRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const catRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const treeData = useMemo(() => {
    const map: Record<string, { amount: number; tags: string[] }> = {};
    expenses.forEach((e: Expense) => {
      if (!map[e.category]) map[e.category] = { amount: 0, tags: [] };
      map[e.category].amount += e.amount;
      const tgs = extractTags(e.note);
      tgs.forEach(t => {
        if (!map[e.category].tags.includes(t)) map[e.category].tags.push(t);
      });
    });
    return Object.entries(map).sort((a, b) => b[1].amount - a[1].amount);
  }, [expenses]);

  useEffect(() => {
    if (!containerRef.current || !totalRef.current) return;
    const updatePaths = () => {
      const containerRect = containerRef.current!.getBoundingClientRect();
      const totalRect = totalRef.current!.getBoundingClientRect();
      const startX = totalRect.right - containerRect.left;
      const startY = totalRect.top - containerRect.top + totalRect.height / 2;

      const newPaths: string[] = [];
      treeData.forEach(([catName]) => {
        const catNode = catRefs.current[catName];
        if (catNode) {
          const catRect = catNode.getBoundingClientRect();
          const endX = catRect.left - containerRect.left;
          const endY = catRect.top - containerRect.top + catRect.height / 2;
          // 三次贝塞尔曲线
          const cpX1 = startX + (endX - startX) * 0.4;
          const cpX2 = endX - (endX - startX) * 0.4;
          newPaths.push(`M ${startX} ${startY} C ${cpX1} ${startY}, ${cpX2} ${endY}, ${endX} ${endY}`);
        }
      });
      setPaths(newPaths);
    };

    updatePaths();
    window.addEventListener('resize', updatePaths);
    return () => window.removeEventListener('resize', updatePaths);
  }, [treeData]);

  if (treeData.length === 0) return null;

  return (
    <div className="chart-card tree-card" ref={containerRef}>
      <h3 className="card-title">资金解构逻辑树</h3>
      <svg className="tree-svg-overlay">
        {paths.map((d, i) => (
          <path key={i} d={d} className="tree-link" fill="none" />
        ))}
      </svg>
      <div className="tree-layout">
        <div className="tree-col total-col">
          <div className="tree-node total-node" ref={totalRef}>
            <span className="node-label">总支出</span>
            <span className="node-value">{currency}{totalAmount.toFixed(2)}</span>
          </div>
        </div>
        <div className="tree-col cat-col">
          {treeData.map(([catName, data]) => (
            <div className="cat-row" key={catName}>
              <div 
                className="tree-node cat-node" 
                ref={el => catRefs.current[catName] = el}
                style={{ borderLeftColor: categories[catName] || '#999' }}
              >
                <span className="node-label">{catName}</span>
                <span className="node-value">{currency}{data.amount.toFixed(2)}</span>
              </div>
              <div className="tags-wrap">
                {data.tags.map(t => (
                  <span className="tag-pill" key={t}>#{t}</span>
                ))}
                {data.tags.length === 0 && <span className="empty-tag-hint">无标签记录</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============== 第二排：神经元共现星云 ==============
function Row2ForceGraph({ tagsSummary, coOccurrence, theme }: any) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  useEffect(() => {
    if (tagsSummary.length === 0) return;
    if (!containerRef.current) return;
    
    const width = containerRef.current.clientWidth;
    const height = 400;
    setDimensions({ width, height });

    // 取 Top 30 避免过于拥挤
    const topTags = tagsSummary.slice(0, 30).map((t: any, i: number) => ({
      id: t.tag,
      radius: Math.max(16, Math.min(40, t.amount / 50 + 10)), // 映射大小
      color: getTagColor(t.tag, i),
      ...t
    }));
    
    const tagIds = new Set(topTags.map((t: any) => t.id));
    
    const graphLinks: any[] = [];
    coOccurrence.forEach((count: number, key: string) => {
      const [source, target] = key.split("|");
      if (tagIds.has(source) && tagIds.has(target)) {
        graphLinks.push({ source, target, value: count });
      }
    });

    const simulation = d3.forceSimulation(topTags)
      .force("link", d3.forceLink(graphLinks).id((d: any) => d.id).distance(100).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-150))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((d: any) => d.radius + 5).iterations(2));

    simulation.on("tick", () => {
      setNodes([...simulation.nodes()]);
      setLinks([...graphLinks]);
    });

    return () => simulation.stop();
  }, [tagsSummary, coOccurrence]);

  if (tagsSummary.length === 0) return null;

  return (
    <div className="chart-card force-graph-card" ref={containerRef}>
      <h3 className="card-title">神经元共现星云 (标签关联)</h3>
      <div className="force-container" style={{ height: dimensions.height }}>
        <svg width={dimensions.width} height={dimensions.height} className="force-svg">
          {links.map((link, i) => (
            <line
              key={i}
              x1={link.source.x} y1={link.source.y}
              x2={link.target.x} y2={link.target.y}
              stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
              strokeWidth={Math.min(3, Math.max(1, link.value * 0.5))}
            />
          ))}
          {nodes.map(node => (
            <g key={node.id} className="force-node" transform={`translate(${node.x},${node.y})`}>
              <circle r={node.radius} fill={`${node.color}20`} stroke={node.color} strokeWidth="1.5" className="node-circle" />
              <text textAnchor="middle" dy=".3em" fontSize="12px" fill={theme === 'dark' ? '#E5E7EB' : '#374151'}>
                {node.id}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ============== 第三排左：习惯矩阵四象限图 ==============
function Row3Quadrant({ tagsSummary, currency, theme }: any) {
  if (tagsSummary.length === 0) return null;

  const data = tagsSummary.map((t: any) => ({
    name: t.tag,
    count: t.count,
    amount: t.amount,
  }));

  const avgCount = data.reduce((s: number, t: any) => s + t.count, 0) / data.length;
  const avgAmount = data.reduce((s: number, t: any) => s + t.amount, 0) / data.length;

  const chartColors = {
    grid: theme === "dark" ? "#374151" : "#E5E7EB",
    axis: theme === "dark" ? "#9CA3AF" : "#6B7280",
    refLine: theme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className={`custom-tooltip ${theme}`}>
          <p className="tooltip-label">#{data.name}</p>
          <p className="tooltip-value">频次: {data.count} 次</p>
          <p className="tooltip-value">金额: {currency}{data.amount.toFixed(2)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-card quadrant-card">
      <h3 className="card-title">习惯矩阵四象限图</h3>
      <p className="card-subtitle">右上角代表高频高额习惯</p>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <XAxis type="number" dataKey="count" name="频次" stroke={chartColors.axis} fontSize={12} label={{ value: '使用频次', position: 'insideBottom', offset: -10, fill: chartColors.axis }} />
          <YAxis type="number" dataKey="amount" name="金额" stroke={chartColors.axis} fontSize={12} label={{ value: '总金额', angle: -90, position: 'insideLeft', fill: chartColors.axis }} />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <ReferenceLine x={avgCount} stroke={chartColors.refLine} strokeDasharray="3 3" />
          <ReferenceLine y={avgAmount} stroke={chartColors.refLine} strokeDasharray="3 3" />
          <Scatter name="Tags" data={data} fill="#8B5CF6">
            {data.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={entry.count > avgCount && entry.amount > avgAmount ? '#EF4444' : '#8B5CF6'} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============== 第三排右：核心标签金额榜 ==============
function Row3TopBar({ tagsSummary, currency }: any) {
  if (tagsSummary.length === 0) return null;
  const top8 = tagsSummary.slice(0, 8);

  return (
    <div className="chart-card top-bar-card">
      <h3 className="card-title">核心标签金额榜 Top 8</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={top8} layout="vertical" margin={{ top: 0, right: 20, left: 40, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis dataKey="tag" type="category" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: 'var(--text-secondary)' }} />
          <Tooltip cursor={{ fill: 'var(--bg-hover)' }} content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <div className="custom-tooltip">
                  <p className="tooltip-label">#{payload[0].payload.tag}</p>
                  <p className="tooltip-value">{currency}{payload[0].value.toFixed(2)}</p>
                </div>
              );
            }
            return null;
          }} />
          <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={20}>
            {top8.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={getTagColor(entry.tag, index)} />
            ))}
            <LabelList dataKey="amount" position="right" formatter={(val: number) => val.toFixed(0)} fill="var(--text-secondary)" fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============== 第四排左：单一习惯热力追踪图 ==============
function Row4Heatmap({ dailyTagData, tagsSummary, currency }: any) {
  const [selectedTag, setSelectedTag] = useState<string>("");
  
  useEffect(() => {
    if (tagsSummary.length > 0 && !selectedTag) {
      setSelectedTag(tagsSummary[0].tag);
    }
  }, [tagsSummary, selectedTag]);

  // 生成近 90 天的日历网格
  const heatmapGrid = useMemo(() => {
    if (!selectedTag) return [];
    
    const days = [];
    const now = new Date();
    // 取消时分秒，保留整日
    now.setHours(0, 0, 0, 0);
    
    // 生成过去 12 周 * 7 天 = 84 天的网格，按周分组
    for (let w = 11; w >= 0; w--) {
      const weekCol = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(now);
        // 从今天往前推，先算出今天是星期几 (0=日, 1=一)
        const todayDay = now.getDay();
        // 算出整个网格最后一天所在周的周日
        const diff = (11 - w) * 7 + (todayDay - d);
        date.setDate(date.getDate() - diff);
        
        const dateStr = date.toISOString().substring(0, 10);
        // ISO string for local timezone
        const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().substring(0, 10);

        const amount = dailyTagData.get(localDate)?.[selectedTag] || 0;
        weekCol.push({ date: localDate, amount });
      }
      days.push(weekCol);
    }
    return days;
  }, [selectedTag, dailyTagData]);

  // 计算颜色的最大阈值
  const maxAmount = useMemo(() => {
    let max = 0;
    heatmapGrid.forEach(week => week.forEach(day => {
      if (day.amount > max) max = day.amount;
    }));
    return max || 1;
  }, [heatmapGrid]);

  return (
    <div className="chart-card heatmap-card">
      <div className="heatmap-header">
        <div>
          <h3 className="card-title">习惯热力追踪图</h3>
          <p className="card-subtitle">展示过去 12 周的消费分布</p>
        </div>
        <select 
          className="heatmap-select"
          value={selectedTag}
          onChange={e => setSelectedTag(e.target.value)}
        >
          {tagsSummary.slice(0, 15).map((t: any) => (
            <option key={t.tag} value={t.tag}>#{t.tag}</option>
          ))}
        </select>
      </div>

      <div className="heatmap-grid-container">
        <div className="heatmap-grid">
          {heatmapGrid.map((week, wIdx) => (
            <div className="heatmap-col" key={wIdx}>
              {week.map((day, dIdx) => {
                const intensity = day.amount / maxAmount;
                const bgColor = day.amount > 0 ? `rgba(16, 185, 129, ${Math.max(0.2, intensity)})` : 'var(--bg-hover)';
                
                return (
                  <div 
                    key={dIdx} 
                    className="heatmap-cell"
                    style={{ backgroundColor: bgColor }}
                    title={`${day.date}: ${currency}${day.amount.toFixed(2)}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="heatmap-labels">
          <span>少</span>
          <div className="heatmap-legend">
            <div style={{ background: 'var(--bg-hover)' }} />
            <div style={{ background: 'rgba(16, 185, 129, 0.3)' }} />
            <div style={{ background: 'rgba(16, 185, 129, 0.6)' }} />
            <div style={{ background: 'rgba(16, 185, 129, 1)' }} />
          </div>
          <span>多</span>
        </div>
      </div>
    </div>
  );
}

// ============== 第四排右：标签频次词云 ==============
function Row4WordCloud({ tagsSummary }: any) {
  if (tagsSummary.length === 0) return null;

  // 词云数据：按 count 决定大小，乱序排列增加随机感
  const cloudData = useMemo(() => {
    const maxCount = Math.max(...tagsSummary.map((t: any) => t.count));
    const minCount = Math.min(...tagsSummary.map((t: any) => t.count));
    
    // Fisher-Yates shuffle
    const shuffled = [...tagsSummary].sort(() => 0.5 - Math.random());
    
    return shuffled.slice(0, 40).map((t: any, i) => {
      // 字体大小 12px ~ 36px
      const size = minCount === maxCount ? 16 : 12 + ((t.count - minCount) / (maxCount - minCount)) * 24;
      return {
        ...t,
        size,
        color: getTagColor(t.tag, i)
      };
    });
  }, [tagsSummary]);

  return (
    <div className="chart-card word-cloud-card">
      <h3 className="card-title">标签频次词云</h3>
      <p className="card-subtitle">字体大小代表使用频次</p>
      <div className="word-cloud-container">
        {cloudData.map((t, i) => (
          <span 
            key={i} 
            className="cloud-word" 
            style={{ 
              fontSize: `${t.size}px`, 
              color: t.color,
              opacity: 0.7 + (t.size / 36) * 0.3,
              margin: `${Math.random() * 8 + 4}px`
            }}
            title={`频次: ${t.count}次`}
          >
            #{t.tag}
          </span>
        ))}
      </div>
    </div>
  );
}

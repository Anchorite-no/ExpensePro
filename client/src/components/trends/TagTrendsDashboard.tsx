import React, { useMemo, useState, useEffect, useRef } from "react";
import * as d3 from "d3-force";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ZAxis,
  ReferenceLine, ReferenceArea, BarChart, Bar, Cell, Tooltip as RechartsTooltip, ResponsiveContainer
} from "recharts";
import { Network, Target, GitGraph, BarChart3, Flame, Tags } from "lucide-react";
import { extractTags } from "../../utils/tags";
import "./TagTrendsDashboard.css";
import { COLOR_PALETTE } from "../../constants/appConfig";
import { Select } from "../ui/Select";

type TimeRange = "current-week" | "current-month" | "last-3-months" | "all";

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
  timeRange?: TimeRange;
}

const getCategoryColor = (category: string, categories: Record<string, string>) =>
  categories[category] || "#94a3b8";

// Custom Tooltip matching the category analysis page style
const TagBarTooltip = ({ active, payload, currency }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <p className="tooltip-label">{payload[0].payload.name}</p>
      <p className="tooltip-value" style={{ color: '#6366f1' }}>
        {currency}{Number(payload[0].value).toFixed(2)}
      </p>
    </div>
  );
};

// ==========================================
// 组件 1: 资金流向（纯 HTML/CSS 布局）
// ==========================================
const CustomTreeDiagram = ({ expenses, categories, currency, theme }: any) => {
  const treeData = useMemo(() => {
    const catMap: Record<string, { amount: number, tags: Record<string, number> }> = {};
    
    expenses.forEach((t: Expense) => {
      if (!catMap[t.category]) catMap[t.category] = { amount: 0, tags: {} };
      catMap[t.category].amount += t.amount;
      
      const tags = extractTags(t.note);
      tags.forEach(tag => { 
        catMap[t.category].tags[tag] = (catMap[t.category].tags[tag] || 0) + t.amount; 
      });
    });

    return Object.keys(catMap).map(cat => {
      const sortedTags = Object.keys(catMap[cat].tags)
        .map(tag => ({ name: tag, amount: catMap[cat].tags[tag] }))
        .sort((a, b) => b.amount - a.amount);
      
      const topTags = sortedTags.slice(0, 8); 
      const topAmount = topTags.reduce((sum, t) => sum + t.amount, 0);
      if (catMap[cat].amount > topAmount) topTags.push({ name: '其他', amount: catMap[cat].amount - topAmount });
      
      return { 
        name: cat, 
        amount: catMap[cat].amount, 
        color: getCategoryColor(cat, categories), 
        tags: topTags 
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [expenses, categories, currency]);

  return (
    <div className="flow-list">
      {treeData.map(cat => (
        <div key={cat.name} className="flow-row">
          <div className="flow-cat" style={{ borderColor: cat.color, color: cat.color }}>
            <span className="flow-cat-name">{cat.name}</span>
            <span className="flow-cat-amount">{currency}{cat.amount.toFixed(2)}</span>
          </div>
          <div className="flow-tags">
            {cat.tags.map(tag => (
              <span key={tag.name} className="flow-tag" style={{ '--dot-color': cat.color } as React.CSSProperties}>
                {tag.name}
                <span className="flow-tag-amount">{currency}{Math.round(tag.amount)}</span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ==========================================
// 组件 2: 神经元共现网络图 (完美版: 物理拖拽 + HTML 呼吸节点 + 手动缩放)
// ==========================================
const CustomOrganicNetwork = ({ expenses, theme }: any) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<any>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!containerRef.current || expenses.length === 0) return;
    
    // Allow React to render first, then get width
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({ width: containerRef.current.clientWidth || 800, height: 400 });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    const nodesMap: Record<string, { id: string, count: number }> = {}; 
    const linksMap: Record<string, number> = {};
    
    expenses.forEach((t: Expense) => {
      const tags = extractTags(t.note);
      tags.forEach(tag => { 
        if (!nodesMap[tag]) nodesMap[tag] = { id: tag, count: 0 }; 
        nodesMap[tag].count += 1; 
      });
      
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          const pair = [tags[i], tags[j]].sort().join('||');
          linksMap[pair] = (linksMap[pair] || 0) + 1;
        }
      }
    });

    const initNodes = Object.values(nodesMap).sort((a, b) => b.count - a.count).slice(0, 20); 
    const validNodeIds = new Set(initNodes.map(n => n.id));
    const initLinks = Object.entries(linksMap).map(([pair, weight]) => {
      const [source, target] = pair.split('||'); return { source, target, weight };
    }).filter(l => validNodeIds.has(l.source as string) && validNodeIds.has(l.target as string));

    const centerX = dimensions.width / 2, centerY = dimensions.height / 2;
    
    initNodes.forEach((node: any, i) => {
      // 初始随机分布在中心附近
      node.x = centerX + (Math.random() - 0.5) * 100; 
      node.y = centerY + (Math.random() - 0.5) * 100;
      node.color = COLOR_PALETTE[i % COLOR_PALETTE.length];
      node.r = Math.max(16, Math.min(36, 12 + node.count * 3));
      // 为每个节点生成随机的呼吸动画参数
      node.animDelay = Math.random() * 2;
      node.animDuration = 3 + Math.random() * 2;
    });

    // 计算最大连线权重，用于规范化连线粗细
    const maxWeight = Math.max(...initLinks.map(l => l.weight), 1);

    const simulation = d3.forceSimulation(initNodes as any)
      // 连线距离：经常共现的拉得更近
      .force("link", d3.forceLink(initLinks).id((d: any) => d.id).distance((d: any) => 150 - (d.weight / maxWeight) * 60).strength(0.6))
      // 斥力：加强斥力，让节点更充分利用 400px 的空间
      .force("charge", d3.forceManyBody().strength(-250))
      // 整体居中吸引力
      .force("center", d3.forceCenter(centerX, centerY))
      .force("x", d3.forceX(centerX).strength(0.02))
      .force("y", d3.forceY(centerY).strength(0.02))
      // 碰撞体积
      .force("collide", d3.forceCollide().radius((d: any) => d.r + 10).iterations(3));

    simulationRef.current = simulation;

    simulation.on("tick", () => {
      const currentNodes = simulation.nodes();
      
      // 刚性边界约束：确保节点永远不会飞出画框
      const padding = 10;
      currentNodes.forEach((d: any) => {
        d.x = Math.max(d.r + padding, Math.min(dimensions.width - d.r - padding, d.x));
        d.y = Math.max(d.r + padding, Math.min(dimensions.height - d.r - padding, d.y));
      });

      setNodes([...currentNodes]);
      setLinks([...initLinks]);
    });

    return () => {
      simulation.stop();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [expenses, dimensions.width]);

  const isDark = theme === 'dark';
  const linkStroke = isDark ? '#64748b' : '#94a3b8';

  // --- 拖拽事件处理 ---
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent, node: any) => {
    if (!simulationRef.current) return;
    setIsDragging(true);
    simulationRef.current.alphaTarget(0.3).restart();
    
    // 记录拖拽起始点（屏幕绝对坐标）
    const startX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    // 记录节点起始坐标
    const initialFx = node.x;
    const initialFy = node.y;
    
    node.fx = initialFx;
    node.fy = initialFy;
    
    // 使用 Delta (差值) 算法进行拖拽，完美兼容任何 Zoom 比例
    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const mx = 'touches' in moveEvent ? (moveEvent as TouchEvent).touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const my = 'touches' in moveEvent ? (moveEvent as TouchEvent).touches[0].clientY : (moveEvent as MouseEvent).clientY;
      
      // 鼠标移动的物理距离除以缩放比例 = 逻辑距离
      const dx = (mx - startX) / zoom;
      const dy = (my - startY) / zoom;
      
      // 直接应用差值并限制在容器内
      node.fx = Math.max(node.r, Math.min(dimensions.width - node.r, initialFx + dx));
      node.fy = Math.max(node.r, Math.min(dimensions.height - node.r, initialFy + dy));
    };

    const handleUp = () => {
      if (!simulationRef.current) return;
      simulationRef.current.alphaTarget(0);
      node.fx = null;
      node.fy = null;
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };

    window.addEventListener('mousemove', handleMove, { passive: false });
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false }); 
    window.addEventListener('touchend', handleUp);
  };

  return (
    <div className="w-full relative flex justify-center custom-scrollbar overflow-hidden rounded-xl border border-gray-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30" ref={containerRef} style={{ height: dimensions.height, touchAction: 'none' }}>
      
      {/* 动态注入 CSS 呼吸动画 */}
      <style>{`
        @keyframes floatNode {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
          100% { transform: translateY(0px); }
        }
      `}</style>

      {/* 缩放控件 (右上角) */}
      <div className="absolute top-3 right-3 flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden z-20">
        <button onClick={() => setZoom(z => Math.min(z + 0.25, 2))} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 font-bold transition-colors cursor-pointer">+</button>
        <button onClick={() => setZoom(1)} className="w-8 h-6 flex items-center justify-center text-[10px] hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 font-medium border-y border-gray-100 dark:border-gray-700 transition-colors cursor-pointer">1X</button>
        <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 font-bold transition-colors cursor-pointer">-</button>
      </div>

      {/* 缩放画幅容器 */}
      <div 
        className="absolute top-0 left-0 w-full h-full origin-center transition-transform duration-300 ease-out" 
        style={{ transform: `scale(${zoom})` }}
      >
        {/* 底层 SVG：绘制弹性连线 */}
        <svg width={dimensions.width} height={dimensions.height} className="absolute top-0 left-0 pointer-events-none z-0">
          {links.map((link, i) => {
            const source = link.source.x !== undefined ? link.source : nodes.find(n => n.id === link.source);
            const target = link.target.x !== undefined ? link.target : nodes.find(n => n.id === link.target);
            if (!source || !target) return null;
            
            const strokeWidth = 1 + link.weight * 0.8;
            const opacity = Math.min(0.8, 0.2 + link.weight * 0.15);

            return (
              <line 
                key={i} 
                x1={source.x} y1={source.y} 
                x2={target.x} y2={target.y} 
                stroke={linkStroke} 
                strokeWidth={strokeWidth} 
                strokeOpacity={opacity} 
              />
            )
          })}
        </svg>

        {/* 顶层 HTML：渲染可交互的呼吸节点 */}
        <div className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none">
          {nodes.map((node) => (
            <div
              key={node.id}
              className="absolute pointer-events-auto"
              style={{
                left: node.x - node.r,
                top: node.y - node.r,
                width: node.r * 2,
                height: node.r * 2,
                zIndex: node.fx !== null && node.fy !== null ? 20 : 10,
              }}
              onMouseDown={(e) => handleDragStart(e, node)}
              onTouchStart={(e) => handleDragStart(e, node)}
            >
              <div
                className="w-full h-full rounded-full flex items-center justify-center select-none shadow-md transition-shadow hover:shadow-lg overflow-hidden"
                style={{
                  backgroundColor: node.color,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  color: '#fff',
                  border: `2px solid ${isDark ? '#1e293b' : '#ffffff'}`,
                  textShadow: '0px 1px 2px rgba(0,0,0,0.5)',
                  boxShadow: node.fx !== null && node.fy !== null ? '0 0 15px rgba(0,0,0,0.3)' : '0 2px 5px rgba(0,0,0,0.1)',
                  // 应用专属的呼吸浮动动画，且不与外部容器坐标冲突
                  animation: `floatNode ${node.animDuration}s ease-in-out ${node.animDelay}s infinite`,
                }}
              >
                <span className="truncate w-full text-center px-1 font-semibold leading-tight" style={{ fontSize: node.r > 20 ? '12px' : '10px' }}>
                  {node.id}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


// Custom Tooltip for scatter chart (习惯矩阵)
const ScatterTooltip = ({ active, payload, currency }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="custom-tooltip">
      <p className="tooltip-label">{data.name}</p>
      <p className="tooltip-value" style={{ color: '#6366f1' }}>
        总金额: {currency}{Number(data.amount).toFixed(2)}
      </p>
      <p className="tooltip-value" style={{ color: '#6366f1' }}>
        消费次数: {data.count} 次
      </p>
      <p className="tooltip-value" style={{ color: '#6366f1' }}>
        平均单笔: {currency}{Number(data.avgAmount).toFixed(2)}
      </p>
    </div>
  );
};

// ==========================================
// 主大盘入口
// ==========================================
export default function TagTrendsDashboard({ expenses, theme, categories, currency, timeRange = 'all' }: Props) {
  const [heatmapTag, setHeatmapTag] = useState('');

  const { rankingData, scatterData, quadrantLines, wordCloudData, dailyData, allTags } = useMemo(() => {
    const stats: Record<string, { name: string, amount: number, count: number }> = {}; 
    const daily: Record<string, Record<string, number>> = {};
    
    expenses.forEach(t => { 
      const tags = extractTags(t.note);
      const day = t.date.substring(0, 10);
      if (!daily[day]) daily[day] = {};

      tags.forEach(tag => { 
        if (!stats[tag]) stats[tag] = { name: tag, amount: 0, count: 0 }; 
        stats[tag].amount += t.amount; 
        stats[tag].count += 1; 
        
        daily[day][tag] = (daily[day][tag] || 0) + 1; // Frequency per day
      }); 
    });
    
    const sortedTags = Object.values(stats).sort((a, b) => b.amount - a.amount);
    const allTagsList = sortedTags.map(t => t.name);

    let totalCount = 0, totalAmount = 0;
    const scatterData = sortedTags.map((t, i) => { 
      totalCount += t.count; 
      totalAmount += t.amount; 
      return { 
        ...t, 
        avgAmount: Math.round(t.amount / t.count),
        color: COLOR_PALETTE[i % COLOR_PALETTE.length]
      }; 
    });
    
    return { 
      rankingData: sortedTags.slice(0, 8).map((t, i) => ({...t, color: COLOR_PALETTE[i % COLOR_PALETTE.length]})),
      scatterData,
      quadrantLines: { 
        x: sortedTags.length > 0 ? totalCount / sortedTags.length : 0, 
        y: sortedTags.length > 0 ? totalAmount / sortedTags.length : 0 
      },
      wordCloudData: sortedTags.map((t, i) => ({ 
        ...t, 
        fontSize: Math.max(14, Math.min(32, 12 + (t.count / (totalCount / sortedTags.length || 1)) * 8)), 
        color: COLOR_PALETTE[i % COLOR_PALETTE.length] 
      })).sort(() => Math.random() - 0.5),
      dailyData: daily,
      allTags: allTagsList
    };
  }, [expenses]);

  useEffect(() => {
    if (allTags.length > 0 && !heatmapTag) {
      setHeatmapTag(allTags[0]);
    }
  }, [allTags, heatmapTag]);

  // 生成热力图网格 - 根据 timeRange 调整显示
  const heatmapGridData = useMemo(() => {
    const data: { id: string, count: number, date: string, dayOfWeek: number }[][] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    if (timeRange === 'current-month') {
      // 月视图：按日历排列，每行是一周（周一到周日），按月内周分组
      const year = now.getFullYear();
      const month = now.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      // 计算第一天是周几 (1=Mon, 7=Sun)
      const firstDayOfWeek = firstDay.getDay() || 7;
      
      let currentWeek: { id: string, count: number, date: string, dayOfWeek: number }[] = [];
      
      // 填充月初之前的空位
      for (let i = 1; i < firstDayOfWeek; i++) {
        currentWeek.push({ id: `empty-${i}`, count: -1, date: '', dayOfWeek: i });
      }
      
      for (let d = 1; d <= lastDay.getDate(); d++) {
        const date = new Date(year, month, d);
        const localDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dow = date.getDay() || 7;
        const count = heatmapTag ? (dailyData[localDate]?.[heatmapTag] || 0) : 0;
        currentWeek.push({ id: localDate, count, date: localDate, dayOfWeek: dow });
        
        if (dow === 7 || d === lastDay.getDate()) {
          // 填充月末之后的空位
          if (d === lastDay.getDate() && dow < 7) {
            for (let i = dow + 1; i <= 7; i++) {
              currentWeek.push({ id: `empty-end-${i}`, count: -1, date: '', dayOfWeek: i });
            }
          }
          data.push(currentWeek);
          currentWeek = [];
        }
      }
    } else {
      // 周视图（默认）：过去 12 周，每列是一周
      const numWeeks = timeRange === 'current-week' ? 1 : 12;
      for (let week = numWeeks - 1; week >= 0; week--) {
        const weekData = [];
        for (let day = 0; day < 7; day++) {
          const date = new Date(now);
          const todayDay = now.getDay() || 7;
          const targetDay = day + 1; 
          const diff = (week * 7) + (todayDay - targetDay);
          date.setDate(date.getDate() - diff);
          const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().substring(0, 10);
          const count = heatmapTag ? (dailyData[localDate]?.[heatmapTag] || 0) : 0;
          weekData.push({ id: localDate, count, date: localDate, dayOfWeek: day + 1 });
        }
        data.push(weekData);
      }
    }
    return data;
  }, [heatmapTag, dailyData, timeRange]);

  const isMonthView = timeRange === 'current-month';

  const getHeatmapColor = (count: number) => {
    if (count < 0) return 'transparent'; // empty placeholder
    if (count === 0) return isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(241, 245, 249, 1)';
    if (count === 1) return 'rgba(99, 102, 241, 0.3)';
    if (count === 2) return 'rgba(99, 102, 241, 0.6)'; 
    return 'rgba(99, 102, 241, 1)'; 
  };

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#374151' : '#f1f5f9';
  const axisColor = isDark ? '#9ca3b8' : '#94a3b8';

  if (expenses.length === 0) {
    return <div className="text-center py-10 text-gray-500">暂无标签数据</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in tag-analysis-root">
      
      {/* ROW 1: 宏观把控 */}
      <div className="chart-card">
        <h3>资金流向</h3>
        <CustomTreeDiagram expenses={expenses} categories={categories} currency={currency} theme={theme} />
      </div>

      {/* ROW 2: 潜意识挖掘 */}
      <div className="chart-card flex flex-col items-center">
        <h3 className="w-full text-left mb-2">共现网络</h3>
        <div className="w-full relative">
            <CustomOrganicNetwork expenses={expenses} theme={theme} />
        </div>
      </div>

      {/* ROW 3: 理性绝对值 */}
      <div className="charts-grid">
        
        <div className="chart-card flex flex-col relative">
          <h3>习惯矩阵</h3>
          <div className="flex-grow min-h-[300px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.5} />
                <XAxis type="number" dataKey="count" name="消费次数" tick={{fill: axisColor, fontSize: 12}} />
                <YAxis type="number" dataKey="amount" name="总金额" tick={{fill: axisColor, fontSize: 12}} />
                <ZAxis type="number" dataKey="avgAmount" range={[50, 400]} />
                <ReferenceLine x={quadrantLines.x} stroke={axisColor} strokeDasharray="5 5" label={{ position: 'top', value: '平均频次', fill: axisColor, fontSize: 10 }} />
                <ReferenceLine y={quadrantLines.y} stroke={axisColor} strokeDasharray="5 5" label={{ position: 'right', value: '平均金额', fill: axisColor, fontSize: 10 }} />
                <RechartsTooltip 
                  cursor={{strokeDasharray: '3 3'}} 
                  content={<ScatterTooltip currency={currency} />}
                />
                <Scatter data={scatterData} fillOpacity={0.85}>
                    {scatterData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card flex flex-col">
          <h3>消费榜单</h3>
          <div className="flex-grow min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rankingData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={gridColor} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 13}} width={70} />
                <RechartsTooltip 
                  cursor={{fill: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'}} 
                  content={<TagBarTooltip currency={currency} />}
                />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={20}>
                  {rankingData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ROW 4: 时间与视觉调剂 */}
      <div className="charts-grid">
        
        <div className="chart-card flex flex-col">
          <h3>习惯追踪</h3>
          <div className="heatmap-layout">
            <div className="heatmap-sidebar">
              <div className="heatmap-select-wrapper">
                <Select 
                  value={heatmapTag} 
                  onChange={setHeatmapTag} 
                  options={allTags.map(tag => ({ value: tag, label: `#${tag}` }))}
                  placeholder="选择标签..."
                />
              </div>
              <div className="heatmap-legend">
                <span className="heatmap-legend-label">少</span>
                <div className="heatmap-legend-cell" style={{ backgroundColor: isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(241, 245, 249, 1)' }} />
                <div className="heatmap-legend-cell" style={{ backgroundColor: 'rgba(99, 102, 241, 0.3)' }} />
                <div className="heatmap-legend-cell" style={{ backgroundColor: 'rgba(99, 102, 241, 0.6)' }} />
                <div className="heatmap-legend-cell" style={{ backgroundColor: 'rgba(99, 102, 241, 1)' }} />
                <span className="heatmap-legend-label">多</span>
              </div>
            </div>
            <div className="flex-1 overflow-x-auto w-full custom-scrollbar heatmap-container">
              {isMonthView ? (
                <div className="heatmap-calendar">
                  <div className="heatmap-calendar-header">
                    <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
                  </div>
                  {heatmapGridData.map((week, wIndex) => (
                    <div key={wIndex} className="heatmap-calendar-row">
                      {week.map((day) => (
                        <div 
                          key={day.id} 
                          className={`heatmap-cell ${day.count < 0 ? 'heatmap-cell-empty' : ''}`}
                          style={{ backgroundColor: getHeatmapColor(day.count) }} 
                          data-tooltip={day.date ? `${day.date}: ${day.count} 次` : undefined}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ) : timeRange === 'current-week' ? (
                <div className="heatmap-single-week">
                  <div className="heatmap-single-week-header">
                    <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
                  </div>
                  <div className="heatmap-single-week-row">
                    {heatmapGridData[0]?.map((day) => (
                      <div 
                        key={day.id} 
                        className="heatmap-cell" 
                        style={{ backgroundColor: getHeatmapColor(day.count) }} 
                        data-tooltip={`${day.date}: ${day.count} 次`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="heatmap-grid">
                  <div className="heatmap-day-labels"><span>一</span><span>三</span><span>五</span><span>日</span></div>
                  {heatmapGridData.map((week, wIndex) => (
                    <div key={wIndex} className="heatmap-week-col">
                      {week.map((day) => (
                        <div 
                          key={day.id} 
                          className="heatmap-cell" 
                          style={{ backgroundColor: getHeatmapColor(day.count) }} 
                          data-tooltip={`${day.date}: ${day.count} 次`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="chart-card flex flex-col">
          <h3>频率词云</h3>
          <div className="flex-grow flex flex-wrap content-center justify-center gap-4 px-4 py-6 chart-bg-wrapper rounded-xl min-h-[200px]" style={{borderStyle: 'dashed'}}>
            {wordCloudData.map((tag, i) => (
              <span 
                key={i} 
                className="hover:scale-110 cursor-pointer drop-shadow-sm select-none transition-transform" 
                style={{ 
                  fontSize: `${tag.fontSize}px`, 
                  color: tag.color, 
                  fontWeight: tag.fontSize > 22 ? 800 : (tag.fontSize > 16 ? 600 : 400),
                  opacity: 0.8 + (tag.fontSize / 32) * 0.2
                }} 
                title={`${tag.name} (出现 ${tag.count} 次)`}
              >
                {tag.name}
              </span>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}

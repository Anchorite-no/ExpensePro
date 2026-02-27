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
// 组件 2: 神经元共现网络图 (升级版: 物理拖拽 + HTML 节点 + 自动全景镜头)
// ==========================================
const CustomOrganicNetwork = ({ expenses, theme }: any) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<any>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [isDragging, setIsDragging] = useState(false);
  
  // 缩放与镜头状态
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const [camera, setCamera] = useState({ x: 0, y: 0, k: 1 });
  const cameraRef = useRef({ x: 0, y: 0, k: 1 });

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

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
      node.x = centerX + (Math.random() - 0.5) * dimensions.width * 0.3; 
      node.y = centerY + (Math.random() - 0.5) * dimensions.height * 0.3;
      node.color = COLOR_PALETTE[i % COLOR_PALETTE.length];
      node.r = Math.max(16, Math.min(36, 12 + node.count * 3)); // 稍微调大基础半径
    });

    // 计算最大连线权重，用于规范化连线粗细
    const maxWeight = Math.max(...initLinks.map(l => l.weight), 1);

    const simulation = d3.forceSimulation(initNodes as any)
      // 连线距离：经常共现的拉得更近
      .force("link", d3.forceLink(initLinks).id((d: any) => d.id).distance((d: any) => 120 - (d.weight / maxWeight) * 40).strength(0.6))
      // 斥力：不要靠得太紧
      .force("charge", d3.forceManyBody().strength(-180))
      // 整体居中吸引力
      .force("center", d3.forceCenter(centerX, centerY))
      .force("x", d3.forceX(centerX).strength(0.05)) // 弱 X 轴向心力
      .force("y", d3.forceY(centerY).strength(0.05)) // 弱 Y 轴向心力
      // 碰撞体积
      .force("collide", d3.forceCollide().radius((d: any) => d.r + 8).iterations(3));

    simulationRef.current = simulation;

    // 初始镜头重置
    cameraRef.current = { x: 0, y: 0, k: 1 };

    simulation.on("tick", () => {
      const currentNodes = simulation.nodes();
      
      // 自动全景镜头算法 (Auto-fit Camera)
      // 动态计算所有节点的边界，并自动缩放/平移以确保所有节点都在视野内
      if (currentNodes.length > 0) {
        const padding = 60; // 留白边距
        const minX = Math.min(...currentNodes.map((d: any) => d.x - d.r));
        const maxX = Math.max(...currentNodes.map((d: any) => d.x + d.r));
        const minY = Math.min(...currentNodes.map((d: any) => d.y - d.r));
        const maxY = Math.max(...currentNodes.map((d: any) => d.y + d.r));

        const w = maxX - minX + padding * 2;
        const h = maxY - minY + padding * 2;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;

        let autoScale = 1;
        if (w > 0 && h > 0) {
            autoScale = Math.min(dimensions.width / w, dimensions.height / h, 2); 
        }

        // 最终缩放 = 自动缩放比例 * 用户手动缩放比例
        const finalScale = autoScale * zoomRef.current;
        
        // 目标平移坐标：使集群中心对齐到容器中心
        const tx = dimensions.width / 2 - cx * finalScale;
        const ty = dimensions.height / 2 - cy * finalScale;

        // 镜头平滑过渡插值
        cameraRef.current = {
            x: cameraRef.current.x + (tx - cameraRef.current.x) * 0.15,
            y: cameraRef.current.y + (ty - cameraRef.current.y) * 0.15,
            k: cameraRef.current.k + (finalScale - cameraRef.current.k) * 0.15
        };
      }

      setNodes([...currentNodes]);
      setLinks([...initLinks]);
      setCamera({...cameraRef.current});
    });

    return () => {
      simulation.stop();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [expenses, dimensions.width]); // dependency on width to center properly

  const isDark = theme === 'dark';
  const linkStroke = isDark ? '#64748b' : '#94a3b8';

  // --- 拖拽事件处理 ---
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent, node: any) => {
    if (!simulationRef.current) return;
    setIsDragging(true);
    // 重新加热物理引擎
    simulationRef.current.alphaTarget(0.3).restart();
    
    node.fx = node.x;
    node.fy = node.y;
    
    // 绑定全局移动和抬起事件
    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const mx = 'touches' in moveEvent ? (moveEvent as TouchEvent).touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const my = 'touches' in moveEvent ? (moveEvent as TouchEvent).touches[0].clientY : (moveEvent as MouseEvent).clientY;
      
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        
        // 使用当前最新的镜头参数将屏幕物理坐标逆向转换为逻辑物理坐标
        const { x: tx, y: ty, k } = cameraRef.current;
        const logicalX = (mx - rect.left - tx) / k;
        const logicalY = (my - rect.top - ty) / k;
        
        // 移除硬性边界限制，允许拖拽到屏幕外，镜头会自动追随
        node.fx = logicalX;
        node.fy = logicalY;
      }
    };

    const handleUp = () => {
      if (!simulationRef.current) return;
      simulationRef.current.alphaTarget(0); // 冷却引擎
      node.fx = null; // 解除坐标锁定
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
    window.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false }); // Prevent scrolling while dragging
    window.addEventListener('touchend', handleUp);
  };

  return (
    <div className="w-full relative flex justify-center custom-scrollbar overflow-hidden rounded-xl border border-gray-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30" ref={containerRef} style={{ height: dimensions.height, touchAction: 'none' }}>
      
      {/* 缩放控件 (右上角) */}
      <div className="absolute top-3 right-3 flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden z-20">
        <button onClick={() => setZoom(z => Math.min(z + 0.25, 3))} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 font-bold transition-colors">+</button>
        <button onClick={() => setZoom(1)} className="w-8 h-6 flex items-center justify-center text-[10px] hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 font-medium border-y border-gray-100 dark:border-gray-700 transition-colors">1X</button>
        <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 font-bold transition-colors">-</button>
      </div>

      {/* 内容层：通过 CSS 硬件加速应用平移和缩放 */}
      <div 
        className="absolute top-0 left-0 w-full h-full transform-gpu origin-top-left will-change-transform" 
        style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.k})` }}
      >
        {/* 底层 SVG：只绘制弹性连线 */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: 0 }}>
          {links.map((link, i) => {
            const source = link.source.x !== undefined ? link.source : nodes.find(n => n.id === link.source);
            const target = link.target.x !== undefined ? link.target : nodes.find(n => n.id === link.target);
            if (!source || !target) return null;
            
            // 连线粗细和透明度根据权重计算，突出强关联
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

        {/* 顶层 HTML：渲染可交互的节点 */}
        <div className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none">
          {nodes.map((node) => (
            <div
              key={node.id}
              onMouseDown={(e) => handleDragStart(e, node)}
              onTouchStart={(e) => handleDragStart(e, node)}
              className="absolute flex items-center justify-center select-none shadow-md transition-shadow hover:shadow-lg overflow-hidden pointer-events-auto"
              style={{
                width: node.r * 2,
                height: node.r * 2,
                borderRadius: '50%', // 强制正圆形
                backgroundColor: node.color,
                // 使用 transform 而不是直接修改 left/top，性能更好
                transform: `translate(${node.x - node.r}px, ${node.y - node.r}px)`,
                // 拖拽时稍微放大并增加阴影层级，增加手感
                cursor: isDragging ? 'grabbing' : 'grab',
                color: '#fff',
                border: `2px solid ${isDark ? '#1e293b' : '#ffffff'}`,
                textShadow: '0px 1px 2px rgba(0,0,0,0.5)',
                boxShadow: node.fx !== null && node.fy !== null ? '0 0 15px rgba(0,0,0,0.3)' : '0 2px 5px rgba(0,0,0,0.1)',
                zIndex: node.fx !== null && node.fy !== null ? 20 : 10, // 拖拽的节点置顶
              }}
            >
              <span className="truncate w-full text-center px-1 font-semibold leading-tight" style={{ fontSize: node.r > 20 ? '12px' : '10px' }}>
                {node.id}
              </span>
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

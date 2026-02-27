import React, { useMemo, useState, useEffect, useRef } from "react";
import * as d3Force from "d3-force";
import * as d3Zoom from "d3-zoom";
import * as d3Selection from "d3-selection";
import * as d3Drag from "d3-drag";
import "d3-transition";
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
// 组件 2: 神经元共现网络图 (无限画布 + D3 原生 Zoom/Drag + 完美圆形呼吸)
// ==========================================
const CustomOrganicNetwork = ({ expenses, theme }: any) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<any>(null);
  const zoomRef = useRef<any>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [transform, setTransform] = useState(d3Zoom.zoomIdentity);

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
      // 1. 严格过滤：确保提取出来的都是有效的、非空的字符串标签
      const tags = (extractTags(t.note) || []).filter(tag => tag && typeof tag === 'string' && tag.trim() !== '');
      
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

    // 2. 深度清洗：剔除 undefined 节点，只保留包含合法 id 的对象
    const initNodes = Object.values(nodesMap)
      .filter(n => n && n.id) // 防止类似 __proto__ 等脏数据污染 Object.values
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); 

    const validNodeIds = new Set(initNodes.map(n => n.id));
    
    // 3. 连线清洗：确保连线两端的节点不仅存在于 validNodeIds 中，且格式正确
    const initLinks = Object.entries(linksMap).map(([pair, weight]) => {
      const [source, target] = pair.split('||'); 
      return { source, target, weight };
    }).filter(l => l.source && l.target && validNodeIds.has(l.source as string) && validNodeIds.has(l.target as string));

    // 防御性编程：如果没有合法节点则直接返回，避免 forceSimulation 报错
    if (initNodes.length === 0) return;

    // 使用容器中心作为初始发射点
    const centerX = dimensions.width / 2, centerY = dimensions.height / 2;
    
    initNodes.forEach((node: any, i) => {
      // 初始随机分布在中心附近，允许被物理引擎推向无限远
      node.x = centerX + (Math.random() - 0.5) * dimensions.width * 0.2; 
      node.y = centerY + (Math.random() - 0.5) * dimensions.height * 0.2;
      node.color = COLOR_PALETTE[i % COLOR_PALETTE.length];
      node.r = Math.max(16, Math.min(36, 12 + node.count * 3));
      node.animDelay = Math.random() * 2;
      node.animDuration = 3 + Math.random() * 2;
    });

    const maxWeight = Math.max(...initLinks.map(l => l.weight), 1);

    // 彻底解决 D3 引擎和 React 状态冲突导致的 'id of undefined' 错误：
    // 我们必须将传入 D3 的数据深拷贝，防止 React 渲染过程冻结或修改对象导致底层报错。
    const d3Nodes = initNodes.map(n => ({...n}));
    const d3Links = initLinks.map(l => ({...l}));

    const simulation = d3Force.forceSimulation(d3Nodes as any)
      // 使用最安全的闭包写法，如果因为特殊原因 d 丢失，返回一个空字符串兜底
      .force("link", d3Force.forceLink(d3Links).id((d: any) => d ? d.id : '').distance((d: any) => 150 - (d.weight / maxWeight) * 60).strength(0.6))
      .force("charge", d3Force.forceManyBody().strength(-300)) // 强大的斥力推开节点
      .force("center", d3Force.forceCenter(centerX, centerY)) // 整体依然有向心力，但不再有硬性边界
      .force("x", d3Force.forceX(centerX).strength(0.01))
      .force("y", d3Force.forceY(centerY).strength(0.01))
      .force("collide", d3Force.forceCollide().radius((d: any) => (d ? d.r : 20) + 15).iterations(3));

    simulationRef.current = simulation;

    // --- 引入 D3 原生 Zoom (拖拽画布 + 滚轮缩放) ---
    const zoom = d3Zoom.zoom()
      .scaleExtent([0.2, 4]) // 允许缩放的倍率范围
      .on("zoom", (e) => {
        setTransform(e.transform);
      });
    
    zoomRef.current = zoom;
    
    if (svgRef.current) {
        // 绑定 zoom 事件到顶层 SVG，拦截所有的鼠标/触控操作
        d3Selection.select(svgRef.current as any).call(zoom as any);
        // 双击不自动放大，以免冲突
        d3Selection.select(svgRef.current as any).on("dblclick.zoom", null);
    }

    // 自动追踪逻辑 (Auto-fit) - 当物理引擎冷静下来后，自动缩放到全景
    let isAutoFitted = false;

    simulation.on("tick", () => {
      const currentNodes = simulation.nodes();
      
      // 注意：这里彻底移除了 x, y 的硬性容器边界约束 d.x = Math.max(...)
      // 节点现在是在一个无限坐标系里运动

      setNodes([...currentNodes]);
      setLinks([...initLinks]);

      // 自动适应视口 (Auto-fit Camera)
      // 当物理引擎的热度 (alpha) 降到比较稳定时，执行一次优雅的全景缩放平移
      if (!isAutoFitted && simulation.alpha() < 0.1 && svgRef.current && currentNodes.length > 0) {
        isAutoFitted = true;
        
        // 计算整个星云的包围盒 (Bounding Box)
        const padding = 60;
        const minX = Math.min(...currentNodes.map((d: any) => d.x - d.r));
        const maxX = Math.max(...currentNodes.map((d: any) => d.x + d.r));
        const minY = Math.min(...currentNodes.map((d: any) => d.y - d.r));
        const maxY = Math.max(...currentNodes.map((d: any) => d.y + d.r));

        const w = maxX - minX + padding * 2;
        const h = maxY - minY + padding * 2;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;

        if (w > 0 && h > 0) {
            // 计算刚好能装下所有节点的缩放倍率
            const autoScale = Math.min(dimensions.width / w, dimensions.height / h, 1.5); 
            
            // 计算将中心点平移到视口中心的偏移量
            const tx = dimensions.width / 2 - cx * autoScale;
            const ty = dimensions.height / 2 - cy * autoScale;

            // D3 平滑过渡动画
            d3Selection.select(svgRef.current as any).transition().duration(750).call(
                zoom.transform as any, 
                d3Zoom.zoomIdentity.translate(tx, ty).scale(autoScale)
            );
        }
      }
    });

    return () => {
      simulation.stop();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [expenses, dimensions.width]);

  const isDark = theme === 'dark';
  const linkStroke = isDark ? '#64748b' : '#94a3b8';

  // --- D3 原生拖拽集成 (完美的降维打击) ---
  // 通过 D3 接管，它可以完美消化由于 zoom 和 pan 产生的坐标系偏移
  useEffect(() => {
    if (!simulationRef.current || !containerRef.current) return;

    // 选择所有带有 'node-drag-target' class 的 HTML 元素
    const drag = d3Drag.drag()
      .on("start", (event, d: any) => {
        if (!event.active) simulationRef.current.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        setIsDragging(true);
      })
      .on("drag", (event, d: any) => {
        // D3 drag 已经自动帮我们把屏幕移动转换成了画布坐标移动！
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d: any) => {
        if (!event.active) simulationRef.current.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        setIsDragging(false);
      });

    // 为每个生成的节点绑定原生拖拽
    d3Selection.select(containerRef.current).selectAll(".node-drag-target").data(nodes, (d: any) => d.id).call(drag as any);

  }, [nodes]); // 需要依赖 nodes 因为 HTML 是动态生成的

  // 手动缩放控制按钮的回调
  const handleZoomIn = () => {
      if (svgRef.current && zoomRef.current) {
          d3Selection.select(svgRef.current as any).transition().duration(300).call(zoomRef.current.scaleBy as any, 1.3);
      }
  };
  const handleZoomOut = () => {
      if (svgRef.current && zoomRef.current) {
          d3Selection.select(svgRef.current as any).transition().duration(300).call(zoomRef.current.scaleBy as any, 1 / 1.3);
      }
  };
  const handleZoomReset = () => {
      if (svgRef.current && zoomRef.current) {
          // 重置回容器中心和 1.0 倍率
          d3Selection.select(svgRef.current as any).transition().duration(500).call(
              zoomRef.current.transform as any, 
              d3Zoom.zoomIdentity
          );
      }
  };

  return (
    <div 
        className="w-full relative flex justify-center overflow-hidden rounded-xl border border-gray-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30" 
        ref={containerRef} 
        style={{ height: dimensions.height, touchAction: 'none' }}
    >
      
      {/* 动态注入 CSS 呼吸动画 */}
      <style>{`
        @keyframes organicFloat {
          0% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-5px) scale(1.02); }
          100% { transform: translateY(0px) scale(1); }
        }
      `}</style>

      {/* 缩放控件 (右上角) */}
      <div className="absolute top-3 right-3 flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden z-20">
        <button onClick={handleZoomIn} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 font-bold transition-colors cursor-pointer">+</button>
        <button onClick={handleZoomReset} className="w-8 h-6 flex items-center justify-center text-[10px] hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 font-medium border-y border-gray-100 dark:border-gray-700 transition-colors cursor-pointer">1X</button>
        <button onClick={handleZoomOut} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 font-bold transition-colors cursor-pointer">-</button>
      </div>

      {/* 
        拦截器层 SVG:
        覆盖整个 800x400 的容器，专门用来接收鼠标和触控的 zoom (滚轮缩放，拖拽空白处平移) 
      */}
      <svg 
        ref={svgRef}
        width={dimensions.width} 
        height={dimensions.height} 
        className="absolute top-0 left-0 w-full h-full z-0"
        style={{ cursor: 'grab' }}
      >
          {/* 无限大的内部群组 (受 Zoom 矩阵控制) */}
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
              {/* 绘制所有弹性连线 */}
              {links.map((link, i) => {
                // 安全获取节点引用，应对 D3 forceLink 修改了源数据引用的情况
                const source = typeof link.source === 'object' ? link.source : nodes.find(n => n.id === link.source);
                const target = typeof link.target === 'object' ? link.target : nodes.find(n => n.id === link.target);
                
                // 如果找不到对应的 source 或 target（已被过滤掉的无效连接），则跳过渲染
                if (!source || !target || source.x === undefined || target.x === undefined) return null;
                
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
          </g>
      </svg>

      {/* 
        HTML 渲染层: 同样必须接受 transform 矩阵，做到与 SVG 完全同步对齐 
      */}
      <div 
        className="absolute top-0 left-0 w-full h-full pointer-events-none transform-gpu origin-top-left"
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})` }}
      >
        {nodes.map((node) => (
          // Div A: 绝对定位容器，负责接收 D3 坐标，不可绑定 CSS 动画
          <div
            key={node.id}
            className="node-drag-target absolute pointer-events-auto"
            style={{
              left: node.x - node.r,
              top: node.y - node.r,
              width: node.r * 2,
              height: node.r * 2,
              zIndex: node.fx !== null && node.fy !== null ? 30 : 10,
            }}
          >
            {/* Div B: 内容容器，负责颜色、强制完美正圆、阴影与专属呼吸特效 (彻底解耦) */}
            <div
              className="w-full h-full flex items-center justify-center select-none shadow-md transition-shadow hover:shadow-lg"
              style={{
                backgroundColor: node.color,
                borderRadius: '50%', // 无论内容如何，强制正圆
                cursor: isDragging ? 'grabbing' : 'grab',
                color: '#fff',
                border: `2px solid ${isDark ? '#1e293b' : '#ffffff'}`,
                textShadow: '0px 1px 2px rgba(0,0,0,0.5)',
                boxShadow: node.fx !== null && node.fy !== null ? '0 0 15px rgba(0,0,0,0.3)' : '0 2px 5px rgba(0,0,0,0.1)',
                animation: `organicFloat ${node.animDuration}s ease-in-out ${node.animDelay}s infinite`,
              }}
            >
              {/* Span C: 文本内容，居中，超长省略号，禁止换行破坏圆形 */}
              <span 
                  className="w-full text-center px-1 font-semibold block overflow-hidden text-ellipsis whitespace-nowrap" 
                  style={{ fontSize: node.r > 20 ? '12px' : '9px' }}
                  title={node.id}
              >
                {node.id}
              </span>
            </div>
          </div>
        ))}
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

    // 使用中位数作为四象限分割线，避免长尾数据导致左下角过密
    const sortedByCount = [...scatterData].sort((a, b) => a.count - b.count);
    const sortedByAmount = [...scatterData].sort((a, b) => a.amount - b.amount);
    const mid = Math.floor(sortedByCount.length / 2);
    const medianCount = sortedByCount.length > 0 
      ? (sortedByCount.length % 2 === 0 
        ? (sortedByCount[mid - 1].count + sortedByCount[mid].count) / 2 
        : sortedByCount[mid].count)
      : 0;
    const medianAmount = sortedByAmount.length > 0 
      ? (sortedByAmount.length % 2 === 0 
        ? (sortedByAmount[mid - 1].amount + sortedByAmount[mid].amount) / 2 
        : sortedByAmount[mid].amount)
      : 0;
    
    return { 
      rankingData: sortedTags.slice(0, 8).map((t, i) => ({...t, color: COLOR_PALETTE[i % COLOR_PALETTE.length]})),
      scatterData,
      quadrantLines: { 
        x: medianCount, 
        y: medianAmount 
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

      {/* ROW 3: 习惯追踪 + 消费榜单 */}
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

      {/* ROW 4: 习惯矩阵 + 频率词云 */}
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
                <ReferenceLine x={quadrantLines.x} stroke={axisColor} strokeDasharray="5 5" label={{ position: 'top', value: '频次中位', fill: axisColor, fontSize: 10 }} />
                <ReferenceLine y={quadrantLines.y} stroke={axisColor} strokeDasharray="5 5" label={{ position: 'right', value: '金额中位', fill: axisColor, fontSize: 10 }} />
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

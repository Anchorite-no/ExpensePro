import React, { useMemo, useState, useEffect, useRef } from "react";
import * as d3 from "d3-force";
import * as d3Select from "d3-selection";
import * as d3Drag from "d3-drag";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ZAxis,
  ReferenceLine, ReferenceArea, BarChart, Bar, Cell, Tooltip as RechartsTooltip, ResponsiveContainer
} from "recharts";
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
// 组件 2: 共现网络（纯 SVG，D3 物理引擎）
// ==========================================
const CustomOrganicNetwork = ({ expenses, theme }: any) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const simulationRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 320 });
  const isDark = theme === 'dark';

  // 计算图数据（只算一次）
  const graphData = useMemo(() => {
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

    const nodes = Object.values(nodesMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .map((n, i) => ({
        ...n,
        color: COLOR_PALETTE[i % COLOR_PALETTE.length],
        r: Math.max(14, Math.min(34, 10 + n.count * 3)),
      }));

    const validIds = new Set(nodes.map(n => n.id));
    const links = Object.entries(linksMap)
      .map(([pair, weight]) => {
        const [source, target] = pair.split('||');
        return { source, target, weight };
      })
      .filter(l => validIds.has(l.source) && validIds.has(l.target));

    return { nodes, links };
  }, [expenses]);

  // D3 全权管理：simulation + drag + 渲染，全部在 useEffect 内用 D3 操作 DOM
  useEffect(() => {
    if (!svgRef.current || !gRef.current || graphData.nodes.length === 0) return;

    // 测量容器
    if (containerRef.current) {
      setDimensions({ width: containerRef.current.clientWidth || 800, height: 320 });
    }
    const width = containerRef.current?.clientWidth || 800;
    const height = 320;
    const centerX = width / 2;
    const centerY = height / 2;

    // 深拷贝数据给 D3（D3 会原地修改对象）
    const nodes: any[] = graphData.nodes.map(n => ({ ...n }));
    const links: any[] = graphData.links.map(l => ({ ...l }));

    const g = d3Select.select(gRef.current);
    g.selectAll('*').remove(); // 清空旧内容

    // 绘制连线
    const linkSelection = g.selectAll('.net-link')
      .data(links)
      .enter()
      .append('line')
      .attr('class', 'net-link')
      .attr('stroke', isDark ? '#64748b' : '#94a3b8')
      .attr('stroke-width', (d: any) => 1 + d.weight * 0.8)
      .attr('stroke-opacity', (d: any) => Math.min(0.7, 0.15 + d.weight * 0.15));

    // 绘制节点组
    const nodeGroup = g.selectAll('.net-node')
      .data(nodes, (d: any) => d.id)
      .enter()
      .append('g')
      .attr('class', 'net-node')
      .style('cursor', 'grab');

    // 圆形
    nodeGroup.append('circle')
      .attr('r', (d: any) => d.r)
      .attr('fill', (d: any) => d.color)
      .attr('fill-opacity', 0.9)
      .attr('stroke', isDark ? '#1e293b' : '#fff')
      .attr('stroke-width', 2.5);

    // 文字
    nodeGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#fff')
      .attr('font-size', (d: any) => d.r > 18 ? 11 : 9)
      .attr('font-weight', 'bold')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 1px 2px rgba(0,0,0,0.5)')
      .text((d: any) => d.id);

    // 创建 simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(centerX, centerY))
      .force('collide', d3.forceCollide().radius((d: any) => d.r + 5).iterations(2));

    simulationRef.current = simulation;

    // tick 更新位置
    simulation.on('tick', () => {
      linkSelection
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodeGroup.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // 拖拽
    const drag = d3Drag.drag<SVGGElement, any>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeGroup.call(drag as any);

    return () => {
      simulation.stop();
    };
  }, [graphData, dimensions.width, isDark]);

  // 监听容器大小
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setDimensions({ width: el.clientWidth || 800, height: 320 });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (graphData.nodes.length === 0) {
    return <div className="text-center py-10 text-gray-500">暂无共现数据</div>;
  }

  return (
    <div ref={containerRef} className="w-full overflow-hidden" style={{ minHeight: 320 }}>
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className="font-sans"
      >
        <g ref={gRef} />
      </svg>
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

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

const getCategoryColor = (category: string, categories: Record<string, string>) =>
  categories[category] || "#94a3b8";

// ==========================================
// 组件 1: 极简脑图树状图
// ==========================================
const CustomTreeDiagram = ({ expenses, categories, currency, theme }: any) => {
  const treeData = useMemo(() => {
    let total = 0;
    const catMap: Record<string, { amount: number, tags: Record<string, number> }> = {};
    
    expenses.forEach((t: Expense) => {
      total += t.amount;
      if (!catMap[t.category]) catMap[t.category] = { amount: 0, tags: {} };
      catMap[t.category].amount += t.amount;
      
      const tags = extractTags(t.note);
      tags.forEach(tag => { 
        catMap[t.category].tags[tag] = (catMap[t.category].tags[tag] || 0) + t.amount; 
      });
    });

    const categoryList = Object.keys(catMap).map(cat => {
      const sortedTags = Object.keys(catMap[cat].tags)
        .map(tag => ({ name: tag, amount: catMap[cat].tags[tag] }))
        .sort((a, b) => b.amount - a.amount);
      
      const topTags = sortedTags.slice(0, 5); 
      const topAmount = topTags.reduce((sum, t) => sum + t.amount, 0);
      if (catMap[cat].amount > topAmount) topTags.push({ name: '其他', amount: catMap[cat].amount - topAmount });
      
      return { 
        name: cat, 
        amount: catMap[cat].amount, 
        color: getCategoryColor(cat, categories), 
        tags: topTags 
      };
    }).sort((a, b) => b.amount - a.amount);

    const xRoot = 120, xCat = 340, startXTag = 410; 
    let currentY = 40;
    
    const catNodes: any[] = [], tagNodes: any[] = [], links: any[] = [];

    categoryList.forEach(cat => {
      catNodes.push({ id: cat.name, name: cat.name, amount: cat.amount, x: xCat, y: currentY, color: cat.color });
      links.push({ source: { x: xRoot, y: 0 }, target: { x: xCat, y: currentY }, color: cat.color });

      let currentXTag = startXTag;
      cat.tags.forEach(tag => {
        // Dynamic width calculation
        const nameWidth = tag.name.length * 13;
        const amtWidth = String(Math.round(tag.amount)).length * 8 + currency.length * 8;
        const boxWidth = 24 + nameWidth + 8 + amtWidth + 12; 
        
        tagNodes.push({ 
          id: `${cat.name}-${tag.name}`, 
          name: tag.name, 
          amount: tag.amount, 
          x: currentXTag, 
          y: currentY, 
          width: boxWidth, 
          color: cat.color 
        });
        currentXTag += boxWidth + 10;
      });

      currentY += 65; 
    });

    const rootY = catNodes.length > 0 ? (catNodes[0].y + catNodes[catNodes.length - 1].y) / 2 : 100;
    links.forEach(l => { l.source.y = rootY; });

    return { total, rootY, catNodes, tagNodes, links, height: Math.max(currentY + 10, 200) };
  }, [expenses, categories, currency]);

  const isDark = theme === 'dark';
  const textColor = isDark ? '#f1f5f9' : '#475569';
  const rootBg = isDark ? '#334155' : '#1e293b';
  const rootText = '#fff';
  const catBg = isDark ? '#1e293b' : '#fff';
  const tagBg = isDark ? '#1e293b' : '#fff';
  const tagBorder = isDark ? '#475569' : '#e2e8f0';
  const mutedText = isDark ? '#94a3b8' : '#64748b';

  return (
    <div className="w-full overflow-x-auto custom-scrollbar flex justify-start lg:justify-center">
      <svg width="1000" height={treeData.height} viewBox={`0 0 1000 ${treeData.height}`} className="font-sans min-w-[800px]">
        
        {treeData.links.map((link: any) => (
          <path 
            key={link.id || link.target.y}
            d={`M ${link.source.x} ${link.source.y} C ${link.source.x + 80} ${link.source.y}, ${link.target.x - 80} ${link.target.y}, ${link.target.x} ${link.target.y}`}
            fill="none" stroke={link.color} strokeWidth="3" strokeOpacity={0.4}
            className="transition-all duration-300 hover:stroke-opacity-100 cursor-pointer"
          />
        ))}

        {/* 根节点：总支出 */}
        <g transform={`translate(120, ${treeData.rootY})`}>
          <rect x="-60" y="-22" width="120" height="44" rx="8" fill={rootBg} />
          <text x="0" y="-4" textAnchor="middle" fill={rootText} fontSize="14" fontWeight="bold">总支出</text>
          <text x="0" y="14" textAnchor="middle" fill={mutedText} fontSize="11">{currency}{treeData.total.toFixed(2)}</text>
        </g>

        {/* 分类节点 */}
        {treeData.catNodes.map((node: any) => (
          <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
            <rect x="-50" y="-18" width="100" height="36" rx="6" fill={catBg} stroke={node.color} strokeWidth="2" />
            <text x="0" y="-2" textAnchor="middle" fill={node.color} fontSize="13" fontWeight="bold">{node.name}</text>
            <text x="0" y="12" textAnchor="middle" fill={mutedText} fontSize="10">{currency}{node.amount.toFixed(2)}</text>
          </g>
        ))}

        {/* 标签节点 */}
        {treeData.tagNodes.map((node: any) => (
          <g key={node.id} transform={`translate(${node.x}, ${node.y})`} className="cursor-pointer">
            <rect x="0" y="-15" width={node.width} height="30" rx="6" fill={tagBg} stroke={tagBorder} strokeWidth="1.5" className="hover:stroke-gray-400 transition-colors" />
            <circle cx="12" cy="0" r="4" fill={node.color} />
            <text x="24" y="1" textAnchor="start" fill={textColor} fontSize="12" fontWeight="600" dominantBaseline="central">{node.name}</text>
            <text x={node.width - 10} y="1" textAnchor="end" fill={mutedText} fontSize="10" dominantBaseline="central">{currency}{Math.round(node.amount)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
};

// ==========================================
// 组件 2: 神经元共现网络图
// ==========================================
const CustomOrganicNetwork = ({ expenses, theme }: any) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 320 });

  useEffect(() => {
    if (!containerRef.current || expenses.length === 0) return;
    
    // Allow React to render first, then get width
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({ width: containerRef.current.clientWidth || 800, height: 320 });
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
      node.x = centerX + (Math.random() - 0.5) * dimensions.width * 0.5; 
      node.y = centerY + (Math.random() - 0.5) * dimensions.height * 0.5;
      node.color = COLOR_PALETTE[i % COLOR_PALETTE.length];
      node.r = Math.max(14, Math.min(34, 10 + node.count * 3));
      node.animDelay = Math.random() * 2;
      node.animDuration = 3 + Math.random() * 2;
    });

    const simulation = d3.forceSimulation(initNodes as any)
      .force("link", d3.forceLink(initLinks).id((d: any) => d.id).distance(100).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(centerX, centerY))
      .force("collide", d3.forceCollide().radius((d: any) => d.r + 5).iterations(2));

    simulation.on("tick", () => {
      setNodes([...simulation.nodes()]);
      setLinks([...initLinks]);
    });

    return () => {
      simulation.stop();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [expenses, dimensions.width]); // dependency on width to center properly

  const isDark = theme === 'dark';
  const trackStroke = isDark ? '#475569' : '#e2e8f0';
  const linkStroke = isDark ? '#64748b' : '#94a3b8';

  return (
    <div className="w-full overflow-x-auto flex justify-center custom-scrollbar" ref={containerRef}>
      <svg width={dimensions.width} height={dimensions.height} viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} className="font-sans min-w-[800px]">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* 辅助轨道 */}
        <ellipse cx={dimensions.width/2} cy={dimensions.height/2} rx="140" ry="70" fill="none" stroke={trackStroke} strokeDasharray="4 4" strokeOpacity="0.8" />
        <ellipse cx={dimensions.width/2} cy={dimensions.height/2} rx="260" ry="120" fill="none" stroke={trackStroke} strokeDasharray="4 4" strokeOpacity="0.6" />
        <ellipse cx={dimensions.width/2} cy={dimensions.height/2} rx="380" ry="160" fill="none" stroke={trackStroke} strokeDasharray="4 4" strokeOpacity="0.3" />

        {links.map((link, i) => {
          // d3-force replaces string IDs with node object references
          const source = link.source.x !== undefined ? link.source : nodes.find(n => n.id === link.source);
          const target = link.target.x !== undefined ? link.target : nodes.find(n => n.id === link.target);
          if (!source || !target) return null;
          
          const dx = target.x - source.x, dy = target.y - source.y;
          const cx = source.x + dx / 2 - dy * 0.2; 
          const cy = source.y + dy / 2 + dx * 0.2;
          return (
            <path key={i} d={`M ${source.x} ${source.y} Q ${cx} ${cy} ${target.x} ${target.y}`} fill="none" stroke={linkStroke} strokeWidth={link.weight * 1.5} strokeOpacity={0.4} />
          )
        })}

        {nodes.map((node) => (
          <g key={node.id} className="cursor-pointer">
            <animateTransform attributeName="transform" type="translate" values={`${node.x},${node.y}; ${node.x},${node.y - 6}; ${node.x},${node.y}`} dur={`${node.animDuration}s`} begin={`${node.animDelay}s`} repeatCount="indefinite" />
            <circle r={node.r} fill={node.color} fillOpacity="0.95" stroke={isDark ? '#1e293b' : '#fff'} strokeWidth="2.5" filter="url(#glow)" />
            <text x="0" y="3" textAnchor="middle" fill="#fff" fontSize={node.r > 18 ? 12 : 10} fontWeight="bold" className="select-none" style={{textShadow: '0px 1px 2px rgba(0,0,0,0.5)'}}>{node.id}</text>
          </g>
        ))}
      </svg>
    </div>
  );
};


// ==========================================
// 主大盘入口
// ==========================================
export default function TagTrendsDashboard({ expenses, theme, categories, currency }: Props) {
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

  // 生成热力图网格
  const heatmapGridData = useMemo(() => {
    const data = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // 过去 12 周
    for (let week = 11; week >= 0; week--) {
      const weekData = [];
      for (let day = 0; day < 7; day++) {
        const date = new Date(now);
        const todayDay = now.getDay() || 7; // make Sunday 7
        // Monday is 1, Sunday is 7 in our grid (0-6 mapping to 1-7)
        const targetDay = day + 1; 
        
        const diff = (week * 7) + (todayDay - targetDay);
        date.setDate(date.getDate() - diff);
        
        // Use local timezone string
        const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().substring(0, 10);
        
        const count = heatmapTag ? (dailyData[localDate]?.[heatmapTag] || 0) : 0;
        weekData.push({ id: localDate, count, date: localDate });
      }
      data.push(weekData);
    }
    return data;
  }, [heatmapTag, dailyData]);

  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'var(--bg-hover)';
    if (count === 1) return 'rgba(249, 115, 22, 0.3)'; // orange
    if (count === 2) return 'rgba(249, 115, 22, 0.6)'; 
    return 'rgba(249, 115, 22, 1)'; 
  };

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#374151' : '#f1f5f9';
  const axisColor = isDark ? '#9ca3b8' : '#94a3b8';

  if (expenses.length === 0) {
    return <div className="text-center py-10 text-gray-500">暂无标签数据</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in tag-analysis-root">
      
      {/* 顶部标题栏 */}
      <div className="chart-card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="stat-icon purple">
            <Tags size={24} />
          </div>
          <div className="stat-info">
            <span className="value" style={{fontSize: '20px', marginBottom: '2px'}}>全景标签洞察中心</span>
            <span className="label">多维交叉数据分析，挖掘深层消费联系</span>
          </div>
        </div>
        <div className="stat-info hidden sm:block text-right">
          <span className="label">活跃标签总数</span>
          <span className="value">{scatterData.length} <span className="label">个</span></span>
        </div>
      </div>

      {/* ROW 1: 宏观把控 */}
      <div className="chart-card">
        <h3>资金流向逻辑树</h3>
        <p className="subtitle-text mb-6 text-gray-400">利用平滑有机的主干曲线相连，剥离错综复杂的末端分支。具体标签化为纯净的卡片，在对应的分类右侧横向舒展平铺。</p>
        <div className="chart-bg-wrapper">
          <CustomTreeDiagram expenses={expenses} categories={categories} currency={currency} theme={theme} />
        </div>
      </div>

      {/* ROW 2: 潜意识挖掘 */}
      <div className="chart-card flex flex-col items-center">
        <div className="w-full flex items-center justify-between">
          <h3 className="w-full text-left">神经元共现网络</h3>
        </div>
        <p className="w-full subtitle-text mb-4 text-left text-gray-400">节点带有随机悬浮动画与高斯模糊光晕，揭示潜意识中经常组合使用的隐秘习惯。</p>
        <div className="w-full chart-bg-wrapper flex justify-center py-6 relative">
            <CustomOrganicNetwork expenses={expenses} theme={theme} />
            <div className="absolute bottom-3 right-3 text-[10px] text-gray-400">基于 D3 物理引力</div>
        </div>
      </div>

      {/* ROW 3: 理性绝对值 */}
      <div className="charts-grid">
        
        <div className="chart-card flex flex-col relative">
          <h3>习惯矩阵四象限</h3>
          <p className="subtitle-text mb-4 text-gray-400">通过纵横均线自动划分标签阵营，有效捕捉右下角的拿铁因子区。</p>
          <div className="flex-grow min-h-[300px] relative">
            <div className="absolute top-[8%] right-[8%] text-right opacity-40 pointer-events-none z-10">
              <div className="text-xl font-bold text-red-500">高频高额</div>
              <div className="text-xs text-gray-400">需重点干预</div>
            </div>
            <div className="absolute bottom-[15%] right-[8%] text-right opacity-40 pointer-events-none z-10">
              <div className="text-xl font-bold text-blue-500">高频低额</div>
              <div className="text-xs text-gray-400">拿铁因子区</div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.5} />
                <XAxis type="number" dataKey="count" name="消费次数" tick={{fill: axisColor, fontSize: 12}} />
                <YAxis type="number" dataKey="amount" name="总金额" tick={{fill: axisColor, fontSize: 12}} />
                <ZAxis type="number" dataKey="avgAmount" range={[50, 400]} />
                <ReferenceLine x={quadrantLines.x} stroke={axisColor} strokeDasharray="5 5" label={{ position: 'top', value: '平均频次', fill: axisColor, fontSize: 10 }} />
                <ReferenceLine y={quadrantLines.y} stroke={axisColor} strokeDasharray="5 5" label={{ position: 'right', value: '平均金额', fill: axisColor, fontSize: 10 }} />
                <ReferenceArea x1={quadrantLines.x} y1={quadrantLines.y} fill="#fee2e2" fillOpacity={isDark ? 0.1 : 0.2} />
                <RechartsTooltip 
                  cursor={{strokeDasharray: '3 3'}} 
                  formatter={(value: any, name: any) => [name === '消费次数' ? `${value} 次` : `${currency}${value}`, name]} 
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', background: 'var(--bg-card)', color: 'var(--text-primary)' }} 
                />
                <Scatter data={scatterData} fillOpacity={0.85}>
                    {scatterData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card flex flex-col">
          <h3>核心消费榜 (Top 8)</h3>
          <p className="subtitle-text mb-4 text-gray-400">直观对比最烧钱的核心标签绝对值。</p>
          <div className="flex-grow min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rankingData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={gridColor} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 13}} width={70} />
                <RechartsTooltip 
                  cursor={{fill: 'var(--bg-hover)'}} 
                  formatter={(value: any) => [`${currency}${value}`, '总支出']} 
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', background: 'var(--bg-card)', color: 'var(--text-primary)' }} 
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
          <h3>单一习惯追踪 (Heatmap)</h3>
          <p className="subtitle-text mb-6 text-gray-400">类 GitHub 提交记录图表，关注最在意的隐性习惯发生频率。</p>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-full sm:w-48 z-20">
              <Select 
                value={heatmapTag} 
                onChange={setHeatmapTag} 
                options={allTags.map(tag => ({ value: tag, label: `#${tag}` }))}
                placeholder="选择标签..."
              />
            </div>
            <div className="flex-1 overflow-x-auto w-full custom-scrollbar">
              <div className="flex gap-1.5 min-w-max pb-2">
                <div className="flex flex-col gap-1.5 mr-2 text-[10px] text-[var(--text-secondary)] justify-around"><span>一</span><span>三</span><span>五</span><span>日</span></div>
                {heatmapGridData.map((week, wIndex) => (
                  <div key={wIndex} className="flex flex-col gap-1.5">
                    {week.map((day) => (
                      <div 
                        key={day.id} 
                        className="w-4 h-4 sm:w-5 sm:h-5 rounded-[4px] hover:scale-125 cursor-pointer ring-1 ring-black/5 transition-transform" 
                        style={{ backgroundColor: getHeatmapColor(day.count) }} 
                        title={`${day.date}: ${day.count} 次`} 
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="chart-card flex flex-col">
          <h3>标签频率云</h3>
          <p className="subtitle-text mb-4 text-gray-400">字体大小纯由【使用频率】决定，捕捉低额高频支出。</p>
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
                #{tag.name}
              </span>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}

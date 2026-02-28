import React, { useMemo, useState, useEffect, useRef } from "react";
import * as d3 from "d3-force";
import * as d3Select from "d3-selection";
import * as d3Drag from "d3-drag";
import * as d3Zoom from "d3-zoom";
import "d3-transition";
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
        .filter(t => t.amount > 0)
        .sort((a, b) => b.amount - a.amount);

      const topAmount = sortedTags.reduce((sum, t) => sum + t.amount, 0);
      if (catMap[cat].amount - topAmount > 0.01) sortedTags.push({ name: '其他', amount: catMap[cat].amount - topAmount });

      return {
        name: cat,
        amount: catMap[cat].amount,
        color: getCategoryColor(cat, categories),
        tags: sortedTags
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
// 组件 2: 共现网络（纯 SVG + D3 zoom/drag/simulation）
// ==========================================
const CustomOrganicNetwork = ({ expenses, theme }: any) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomTextRef = useRef<HTMLSpanElement>(null);
  const zoomInstanceRef = useRef<any>(null);
  const initialTransformRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 480 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [navbarHeight, setNavbarHeight] = useState(0);
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

    const maxCount = Math.max(1, ...Object.values(nodesMap).map(n => n.count));
    const nodes = Object.values(nodesMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .map((n, i) => ({
        ...n,
        color: COLOR_PALETTE[i % COLOR_PALETTE.length],
        r: Math.max(18, Math.min(38, 18 + (n.count / maxCount) * 20)),
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

  // D3 全权管理渲染
  useEffect(() => {
    if (!svgRef.current || !gRef.current || graphData.nodes.length === 0) return;

    const width = containerRef.current?.clientWidth || 800;
    const height = 480;
    const centerX = width / 2;
    const centerY = height / 2;

    // 深拷贝（D3 会原地修改）
    const nodes: any[] = graphData.nodes.map(n => ({ ...n }));
    const links: any[] = graphData.links.map(l => ({ ...l }));
    const nodeCount = nodes.length;
    const maxWeight = Math.max(1, ...links.map((l: any) => l.weight));

    // 构建邻接表（用于悬停高亮）
    const adjacency = new Map<string, Set<string>>();
    nodes.forEach(n => adjacency.set(n.id, new Set()));
    links.forEach(l => {
      adjacency.get(l.source as string)?.add(l.target as string);
      adjacency.get(l.target as string)?.add(l.source as string);
    });

    const svg = d3Select.select(svgRef.current);
    const g = d3Select.select(gRef.current);
    g.selectAll('*').remove();

    // ---- Zoom：绑定到 SVG，控制 <g> 的 transform ----
    const zoom = d3Zoom.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 5])
      // 停止不当的滚轮冒泡，防止在极值处发生外层窗口滚动
      .filter((event) => {
        // Only allow primary button (0), or wheels (regardless of modifier)
        return (!event.ctrlKey || event.type === 'wheel') && !event.button;
      })
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        if (zoomTextRef.current) {
          zoomTextRef.current.innerText = `${Math.round(event.transform.k * 100)}%`;
        }
      });

    // 为 SVG 显式绑定 wheel 事件以彻底阻止默认滚动行为
    svg.on("wheel.zoom", function(event) {
        event.preventDefault(); // 阻断系统滚动
        zoom.zoomWheel.call(this, event, d3Select.select(this).property("__zoom")); // 透传给 d3
    });

    zoomInstanceRef.current = zoom;
    svg.call(zoom as any).on('dblclick.zoom', null);

    // ---- 创建 <defs> 用于渐变 ----
    const defs = g.append('defs');

    // 为每条连线创建渐变
    links.forEach((l: any, i: number) => {
      const srcNode = nodes.find((n: any) => n.id === l.source);
      const tgtNode = nodes.find((n: any) => n.id === l.target);
      const grad = defs.append('linearGradient')
        .attr('id', `link-grad-${i}`)
        .attr('gradientUnits', 'userSpaceOnUse');
      grad.append('stop').attr('offset', '0%').attr('stop-color', srcNode?.color || '#94a3b8');
      grad.append('stop').attr('offset', '100%').attr('stop-color', tgtNode?.color || '#94a3b8');
    });

    // ---- 绘制连线（二次贝塞尔曲线） ----
    const CURVATURE = 0.15;
    const linkSel = g.selectAll('.net-link')
      .data(links).enter()
      .append('path')
      .attr('class', 'net-link')
      .attr('fill', 'none')
      .attr('stroke', (_d: any, i: number) => `url(#link-grad-${i})`)
      .attr('stroke-width', (d: any) => Math.max(2.5, 1.5 + d.weight * 1))
      .attr('stroke-opacity', (d: any) => Math.min(0.7, 0.15 + d.weight * 0.15))
      .attr('stroke-linecap', 'round');

    // 连线悬停用的权重标签（初始隐藏）
    const linkLabelSel = g.selectAll('.net-link-label')
      .data(links).enter()
      .append('text')
      .attr('class', 'net-link-label')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', isDark ? '#cbd5e1' : '#475569')
      .attr('font-size', 18)
      .attr('font-weight', 700)
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .text((d: any) => d.weight);

    // ---- 绘制节点组 ----
    const nodeSel = g.selectAll('.net-node')
      .data(nodes, (d: any) => d.id).enter()
      .append('g')
      .attr('class', 'net-node')
      .style('cursor', 'grab');

    // 主圆
    nodeSel.append('circle')
      .attr('class', 'net-circle')
      .attr('r', (d: any) => d.r)
      .attr('fill', (d: any) => d.color)
      .attr('fill-opacity', 0.92)
      .attr('stroke', isDark ? '#1e293b' : '#fff')
      .attr('stroke-width', 1.5)
      .style('filter', 'drop-shadow(0px 2px 4px rgba(0,0,0,0.12))');

    // 呼吸动画（CSS animation 方式，重建时自动重启）
    nodeSel.each(function (d: any, _i: number) {
      const dur = 3 + Math.random() * 2;
      const delay = Math.random() * 2;
      d3Select.select(this).select('.net-circle')
        .style('transform-origin', 'center')
        .style('transform-box', 'fill-box')
        .style('animation', `node-breathe ${dur.toFixed(1)}s ease-in-out ${delay.toFixed(1)}s infinite`);
    });

    // 文字（长标签截断）
    nodeSel.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#fff')
      .attr('font-size', (d: any) => d.r > 18 ? 18 : 14)
      .attr('font-weight', 'bold')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 1px 2px rgba(0,0,0,0.5)')
      .text((d: any) => {
        const maxChars = Math.max(2, Math.floor(d.r / 5.5));
        return d.id.length > maxChars ? d.id.slice(0, maxChars) + '…' : d.id;
      });

    // <title> 显示完整标签名和次数
    nodeSel.append('title')
      .text((d: any) => `${d.id}（${d.count} 次）`);

    // ---- Step 3: 悬停高亮交互 ----
    // 连线 tooltip（挂在 container div 上）
    let tooltip: HTMLDivElement | null = null;
    if (containerRef.current) {
      tooltip = document.createElement('div');
      tooltip.style.cssText = 'position:absolute;padding:6px 10px;border-radius:8px;font-size:12px;pointer-events:none;opacity:0;transition:opacity 0.15s;z-index:100;white-space:nowrap;backdrop-filter:blur(8px);box-shadow:0 4px 20px rgba(0,0,0,0.15);';
      tooltip.style.background = isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)';
      tooltip.style.color = isDark ? '#e2e8f0' : '#1e293b';
      tooltip.style.border = `1px solid ${isDark ? '#334155' : '#e2e8f0'}`;
      containerRef.current.appendChild(tooltip);
    }

    // 节点悬停
    nodeSel
      .on('mouseenter', function (_event: any, d: any) {
        const neighbors = adjacency.get(d.id) || new Set();
        // 降低非关联节点
        nodeSel.each(function (n: any) {
          const isRelated = n.id === d.id || neighbors.has(n.id);
          d3Select.select(this)
            .style('opacity', isRelated ? 1 : 0.15)
            .select('.net-circle')
            .attr('r', n.id === d.id ? n.r * 1.15 : n.r);
        });
        // 降低非关联连线，加亮关联连线
        linkSel.each(function (l: any) {
          const srcId = typeof l.source === 'object' ? l.source.id : l.source;
          const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
          const isRelated = srcId === d.id || tgtId === d.id;
          d3Select.select(this)
            .attr('stroke-opacity', isRelated ? 0.9 : 0.03)
            .attr('stroke-width', isRelated ? Math.max(3.5, 2 + l.weight * 1.2) : Math.max(2.5, 1.5 + l.weight * 1));
        });
        // 显示关联连线的权重标签
        linkLabelSel.each(function (l: any) {
          const srcId = typeof l.source === 'object' ? l.source.id : l.source;
          const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
          const isRelated = srcId === d.id || tgtId === d.id;
          d3Select.select(this).style('opacity', isRelated ? 1 : 0);
        });
      })
      .on('mouseleave', function () {
        // 恢复全部
        nodeSel.style('opacity', 1)
          .select('.net-circle')
          .attr('r', (n: any) => n.r);
        linkSel
          .attr('stroke-opacity', (l: any) => Math.min(0.7, 0.15 + l.weight * 0.15))
          .attr('stroke-width', (l: any) => Math.max(2.5, 1.5 + l.weight * 1));
        linkLabelSel.style('opacity', 0);
      });

    // 连线悬停 tooltip
    linkSel
      .style('pointer-events', 'stroke')
      .on('mouseenter', function (_event: any, d: any) {
        const srcId = typeof d.source === 'object' ? d.source.id : d.source;
        const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
        if (tooltip) {
          tooltip.textContent = `${srcId} & ${tgtId}: 共现 ${d.weight} 次`;
          tooltip.style.opacity = '1';
        }
      })
      .on('mousemove', function (event: any) {
        if (tooltip && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          tooltip.style.left = `${event.clientX - rect.left + 12}px`;
          tooltip.style.top = `${event.clientY - rect.top - 10}px`;
        }
      })
      .on('mouseleave', function () {
        if (tooltip) tooltip.style.opacity = '0';
      });

    // ---- Step 1: 自适应力学参数 Simulation ----
    const chargeStrength = -300 - nodeCount * 5;
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id)
        .distance((d: any) => {
          const norm = d.weight / maxWeight; // 0~1
          return 220 - norm * 120; // 强关联 100，弱关联 220
        })
        .strength((d: any) => {
          const norm = d.weight / maxWeight;
          return 0.3 + norm * 0.5; // 弱 0.3，强 0.8
        }))
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('x', d3.forceX(centerX).strength(0.03))
      .force('y', d3.forceY(centerY).strength(0.03))
      .force('collide', d3.forceCollide().radius((d: any) => d.r + 22).iterations(3));

    let fitted = false;

    simulation.on('tick', () => {
      // 更新曲线路径和渐变坐标
      linkSel.attr('d', (d: any) => {
        const sx = d.source.x, sy = d.source.y;
        const tx = d.target.x, ty = d.target.y;
        const mx = (sx + tx) / 2, my = (sy + ty) / 2;
        const dx = tx - sx, dy = ty - sy;
        const cx = mx - dy * CURVATURE, cy = my + dx * CURVATURE;
        return `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
      });

      // 同步渐变坐标
      links.forEach((l: any, i: number) => {
        defs.select(`#link-grad-${i}`)
          .attr('x1', l.source.x).attr('y1', l.source.y)
          .attr('x2', l.target.x).attr('y2', l.target.y);
      });

      // 更新连线权重标签位置（贝塞尔中点）
      linkLabelSel.attr('x', (d: any) => {
        const sx = d.source.x, tx = d.target.x;
        const mx = (sx + tx) / 2, dy = d.target.y - d.source.y;
        return mx - dy * CURVATURE * 0.5;
      }).attr('y', (d: any) => {
        const sy = d.source.y, ty = d.target.y;
        const my = (sy + ty) / 2, dx = d.target.x - d.source.x;
        return my + dx * CURVATURE * 0.5;
      });

      nodeSel.attr('transform', (d: any) => `translate(${d.x},${d.y})`);

      // 引擎稳定后，自动 fit 到视口
      if (!fitted && simulation.alpha() < 0.08 && nodes.length > 0) {
        fitted = true;
        const pad = 50;
        const x0 = Math.min(...nodes.map(n => n.x - n.r)) - pad;
        const y0 = Math.min(...nodes.map(n => n.y - n.r)) - pad;
        const x1 = Math.max(...nodes.map(n => n.x + n.r)) + pad;
        const y1 = Math.max(...nodes.map(n => n.y + n.r)) + pad;
        const bw = x1 - x0, bh = y1 - y0;
        if (bw > 0 && bh > 0) {
          let scale = Math.min(width / bw, height / bh, 1.5);
          scale = Math.max(scale, 0.8);

          const tx = width / 2 - ((x0 + x1) / 2) * scale;
          const ty = height / 2 - ((y0 + y1) / 2) * scale;

          const transform = d3Zoom.zoomIdentity.translate(tx, ty).scale(scale);
          initialTransformRef.current = transform;

          svg.transition().duration(600).call(
            zoom.transform as any,
            transform
          );
        }
      }
    });

    // ---- Drag：使用 d3-drag，自动感知 zoom transform ----
    const drag = d3Drag.drag<SVGGElement, any>()
      .on('start', function (event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
        d3Select.select(this).style('cursor', 'grabbing');
      })
      .on('drag', (event, d) => {
        d.fx = event.x; d.fy = event.y;
      })
      .on('end', function (event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
        d3Select.select(this).style('cursor', 'grab');
      });

    nodeSel.call(drag as any);

    return () => {
      simulation.stop();
      if (tooltip && tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
    };
  }, [graphData, dimensions.width, isDark]);

  // 阻止默认滚动行为，防止缩放到极限时滚动页面
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const preventScroll = (e: any) => e.preventDefault();
    el.addEventListener("wheel", preventScroll, { passive: false });
    return () => el.removeEventListener("wheel", preventScroll);
  }, []);

  // 监听容器大小
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      if (!isFullscreen) {
        setDimensions({ width: el.clientWidth || 800, height: 480 });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [isFullscreen]);

  // 全屏时锁定 body 滚动并设置尺寸（避开顶部导航栏）
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
      const sidebar = document.querySelector('.sidebar');
      const sidebarH = sidebar ? sidebar.getBoundingClientRect().height : 0;
      // 仅在移动端（sidebar 变为顶部导航栏）时偏移
      const isMobileNav = window.innerWidth <= 768;
      const offset = isMobileNav ? sidebarH : 0;
      setNavbarHeight(offset);
      setDimensions({ width: window.innerWidth, height: window.innerHeight - offset });
      const handleResize = () => {
        const newOffset = isMobileNav ? (sidebar?.getBoundingClientRect().height || 0) : 0;
        setNavbarHeight(newOffset);
        setDimensions({ width: window.innerWidth, height: window.innerHeight - newOffset });
      };
      window.addEventListener('resize', handleResize);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('resize', handleResize);
      };
    } else {
      setNavbarHeight(0);
    }
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  if (graphData.nodes.length === 0) {
    return <div className="text-center py-10 text-gray-500">暂无共现数据</div>;
  }

  const handleResetZoom = () => {
    if (svgRef.current && zoomInstanceRef.current && initialTransformRef.current) {
      d3Select.select(svgRef.current)
        .transition()
        .duration(600)
        .call(
          zoomInstanceRef.current.transform as any,
          initialTransformRef.current
        );
    }
  };

  return (
    <div
      ref={containerRef}
      className="network-container"
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? navbarHeight : undefined,
        left: isFullscreen ? 0 : undefined,
        right: isFullscreen ? 0 : undefined,
        bottom: isFullscreen ? 0 : undefined,
        zIndex: isFullscreen ? 9999 : undefined,
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? `calc(100vh - ${navbarHeight}px)` : dimensions.height,
        borderRadius: isFullscreen ? 0 : undefined,
        background: isFullscreen ? (isDark ? '#0f172a' : '#fff') : undefined,
      }}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'grab' }}
      >
        <g ref={gRef} />
      </svg>
      {/* 右上角全屏按钮 */}
      <button
        onClick={toggleFullscreen}
        style={{
          position: 'absolute', top: 8, right: 8, zIndex: 50,
          padding: 6, borderRadius: 6, cursor: 'pointer',
          background: 'none', border: 'none',
          color: isDark ? '#64748b' : '#94a3b8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'auto',
        }}
        title={isFullscreen ? '退出预览' : '全屏预览'}
      >
        {isFullscreen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v3h-3" /><path d="M21 8h-3v-3" />
            <path d="M3 16h3v3" /><path d="M16 21v-3h3" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        )}
      </button>
      {/* 右下角缩放指示 + 重置 */}
      <div
        style={{
          position: 'absolute', bottom: 8, right: 8, zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 6,
          color: isDark ? '#64748b' : '#94a3b8',
          fontSize: 12, pointerEvents: 'auto',
        }}
      >
        <span ref={zoomTextRef} style={{ fontWeight: 600, minWidth: 36, textAlign: 'right' }}>100%</span>
        <button
          onClick={handleResetZoom}
          style={{
            padding: 4, borderRadius: 6, cursor: 'pointer',
            background: 'none', border: 'none', color: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="重置缩放并居中"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
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
  const [matrixExpanded, setMatrixExpanded] = useState(false);

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

    // 使用去极值平均 (Trimmed Mean) 作为四象限分割线
    // 避免长尾数据导致左下角过密，同时也避免中位数导致散点在整数线上扎堆
    const sortedByCount = [...scatterData].sort((a, b) => a.count - b.count);
    const sortedByAmount = [...scatterData].sort((a, b) => a.amount - b.amount);

    const len = scatterData.length;
    let avgCount = 0;
    let avgAmount = 0;

    if (len > 0) {
      const trimRatio = 0.1; // 去除两头各 10%
      const lowerBound = Math.floor(len * trimRatio);
      const upperBound = Math.max(lowerBound + 1, Math.ceil(len * (1 - trimRatio)));

      const trimmedCountData = sortedByCount.slice(lowerBound, upperBound);
      const trimmedAmountData = sortedByAmount.slice(lowerBound, upperBound);

      avgCount = trimmedCountData.length > 0
        ? trimmedCountData.reduce((sum, item) => sum + item.count, 0) / trimmedCountData.length
        : sortedByCount[0].count;

      avgAmount = trimmedAmountData.length > 0
        ? trimmedAmountData.reduce((sum, item) => sum + item.amount, 0) / trimmedAmountData.length
        : sortedByAmount[0].amount;
    }

    return {
      rankingData: sortedTags.slice(0, 8).map((t, i) => ({...t, color: COLOR_PALETTE[i % COLOR_PALETTE.length]})),
      scatterData,
      quadrantLines: {
        x: avgCount,
        y: avgAmount
      },
      wordCloudData: sortedTags.map((t, i) => ({ 
        ...t, 
        fontSize: Math.max(14, Math.min(46, 12 + (t.count / (totalCount / sortedTags.length || 1)) * 18)), 
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

      {/* ROW 3: 习惯矩阵 + 习惯追踪 */}
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
                <ReferenceLine x={quadrantLines.x} stroke={axisColor} strokeDasharray="5 5" label={{ position: 'top', value: '频次平均', fill: axisColor, fontSize: 10 }} />
                <ReferenceLine y={quadrantLines.y} stroke={axisColor} strokeDasharray="5 5" label={{ position: 'insideTopRight', value: '金额平均', fill: axisColor, fontSize: 10, offset: 5, fillOpacity: 0.8 }} />
                <RechartsTooltip
                  cursor={{strokeDasharray: '3 3'}}
                  content={<ScatterTooltip currency={currency} />}
                />
                <Scatter data={scatterData}>
                    {scatterData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.65} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            {/* 放大预览按钮 */}
            <button
              onClick={() => setMatrixExpanded(true)}
              style={{
                position: 'absolute', top: 4, right: 4, zIndex: 10,
                padding: 5, borderRadius: 6, cursor: 'pointer',
                background: 'none', border: 'none',
                color: isDark ? '#64748b' : '#b0b8c8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="放大预览"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                <path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            </button>
          </div>
        </div>

        {/* 习惯矩阵放大预览遮罩 — 移动端全屏，桌面端仅覆盖内容区 */}
        {matrixExpanded && (() => {
          const isMobile = window.innerWidth <= 768;
          const sidebar = document.querySelector('.sidebar');
          const sidebarRight = (!isMobile && sidebar) ? sidebar.getBoundingClientRect().right : 0;
          const topOffset = (isMobile && sidebar) ? sidebar.getBoundingClientRect().height : 0;
          return (
          <div
            onClick={() => setMatrixExpanded(false)}
            style={{
              position: 'fixed', top: topOffset, right: 0, bottom: 0,
              left: sidebarRight,
              zIndex: 10001,
              background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'zoom-out',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: '88%', maxWidth: 920, height: '72%',
                background: isDark ? '#1e293b' : '#fff',
                borderRadius: 16, padding: '24px 20px 20px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                display: 'flex', flexDirection: 'column',
                cursor: 'default',
                position: 'relative',
              }}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: isDark ? '#f1f5f9' : '#1e293b' }}>习惯矩阵</h3>
              <button
                onClick={() => setMatrixExpanded(false)}
                style={{
                  position: 'absolute', top: 16, right: 16,
                  padding: 6, borderRadius: 6, cursor: 'pointer',
                  background: 'none', border: 'none',
                  color: isDark ? '#94a3b8' : '#64748b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                title="关闭"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                </svg>
              </button>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.5} />
                    <XAxis type="number" dataKey="count" name="消费次数" tick={{fill: axisColor, fontSize: 13}} label={{value: '消费次数', position: 'insideBottom', offset: -10, fill: axisColor, fontSize: 12}} />
                    <YAxis type="number" dataKey="amount" name="总金额" tick={{fill: axisColor, fontSize: 13}} label={{value: '总金额', angle: -90, position: 'insideLeft', offset: 10, fill: axisColor, fontSize: 12}} />
                    <ZAxis type="number" dataKey="avgAmount" range={[80, 600]} />
                    <ReferenceLine x={quadrantLines.x} stroke={axisColor} strokeDasharray="5 5" label={{ position: 'top', value: '频次平均', fill: axisColor, fontSize: 11 }} />
                    <ReferenceLine y={quadrantLines.y} stroke={axisColor} strokeDasharray="5 5" label={{ position: 'insideTopRight', value: '金额平均', fill: axisColor, fontSize: 11, offset: 5, fillOpacity: 0.8 }} />
                    <RechartsTooltip
                      cursor={{strokeDasharray: '3 3'}}
                      content={<ScatterTooltip currency={currency} />}
                    />
                    <Scatter data={scatterData}>
                        {scatterData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.65} />)}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          ); })()}

        <div className="chart-card flex flex-col">
          <h3>习惯追踪</h3>
          <div className="heatmap-top-controls">
            <div className="heatmap-select-wrapper">
              <Select 
                value={heatmapTag} 
                onChange={setHeatmapTag} 
                options={allTags.map((tag, i) => ({ value: tag, label: `#${tag}`, color: COLOR_PALETTE[i % COLOR_PALETTE.length] }))}
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
              <div className="flex flex-col gap-4">
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

                {/* 增加 Top 2/3 热力图补充单周模式下的空白 */}
                <div
                  className="text-sm mt-2 font-bold"
                  style={{ color: 'var(--primary)', display: 'inline-block' }}
                >
                  Top 3 活跃标签
                </div>
                <div className="flex flex-col gap-2 -mt-1">
                  {allTags.slice(0, 3).map(tag => {
                  const tagData = heatmapGridData[0]?.map(day => {
                    const count = dailyData[day.date]?.[tag] || 0;
                    return { ...day, count };
                  });
                  return (
                    <div className="heatmap-single-week" key={tag}>
                      <div className="heatmap-single-week-header" style={{opacity: 0.6}}>
                        <span style={{width: 'auto', minWidth: '40px', paddingRight: '8px', textAlign: 'left', fontWeight: 'bold'}}>#{tag}</span>
                      </div>
                      <div className="heatmap-single-week-row">
                        {tagData?.map((day) => (
                          <div 
                            key={day.id} 
                            className="heatmap-cell" 
                            style={{ backgroundColor: getHeatmapColor(day.count) }} 
                            data-tooltip={`${day.date}: ${day.count} 次 (#${tag})`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
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

      {/* ROW 4: 频率词云 + 消费榜单 */}
      <div className="charts-grid">

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

    </div>
  );
}

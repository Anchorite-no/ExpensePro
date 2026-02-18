import React from "react";
import {
  BarChart3, ChevronRight, ChevronLeft, Settings2, Moon, Sun, LogOut,
  Wallet, TrendingUp, CreditCard
} from "lucide-react";
import type { PageType } from "../../types";

interface SidebarProps {
  activePage: PageType;
  setActivePage: (page: PageType) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  user: any;
  logout: () => void;
  openSettings: () => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const navItems: { key: PageType; icon: React.ReactNode; label: string }[] = [
  { key: "dashboard", icon: <Wallet size={20} />, label: "资产概览" },
  { key: "trends", icon: <TrendingUp size={20} />, label: "趋势分析" },
  { key: "transactions", icon: <CreditCard size={20} />, label: "交易记录" },
];

const Sidebar = React.memo(({
  activePage,
  setActivePage,
  sidebarCollapsed,
  setSidebarCollapsed,
  user,
  logout,
  openSettings,
  theme,
  toggleTheme
}: SidebarProps) => {
  return (
    <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="logo">
          <BarChart3 size={28} />
          <span className="logo-text">ExpensePro</span>
        </div>
        <button className="collapse-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}>
          {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav>
        {navItems.map(item => (
          <a 
            key={item.key} 
            href="#" 
            className={activePage === item.key ? "active" : ""} 
            onClick={e => { e.preventDefault(); setActivePage(item.key); }} 
            title={item.label}
          >
            {item.icon} <span className="nav-text">{item.label}</span>
          </a>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info" style={{ padding: '10px 20px', fontSize: '14px', color: '#666', display: sidebarCollapsed ? 'none' : 'block' }}>
          Hi, {user?.username}
        </div>
        <button className="sidebar-manage-btn" onClick={openSettings} title="系统设置">
          <Settings2 size={18} />
          <span className="nav-text">系统设置</span>
        </button>
        <button className="theme-toggle" onClick={toggleTheme} title={theme === "light" ? "切换到夜间模式" : "切换到日间模式"}>
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          <span className="nav-text">{theme === "light" ? "夜间模式" : "日间模式"}</span>
        </button>
        <button className="sidebar-logout-btn" onClick={logout} title="退出登录">
          <LogOut size={18} />
          <span className="nav-text">退出登录</span>
        </button>
      </div>
    </aside>
  );
});

export default Sidebar;

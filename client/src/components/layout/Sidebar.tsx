import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Wallet, TrendingUp, CreditCard, Settings2, Sun, Moon, LogOut, 
  BarChart3, ChevronLeft, ChevronRight 
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface SidebarProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({ theme, toggleTheme, onOpenSettings }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { key: "/", icon: <Wallet size={20} />, label: "资产概览" },
    { key: "/trends", icon: <TrendingUp size={20} />, label: "趋势分析" },
    { key: "/transactions", icon: <CreditCard size={20} />, label: "交易记录" },
  ];

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        {!collapsed && (
          <div className="logo">
            <BarChart3 size={28} />
            <span className="logo-text">ExpensePro</span>
          </div>
        )}
        <button 
          className="collapse-btn" 
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav>
        {navItems.map(item => (
          <Link 
            key={item.key} 
            to={item.key} 
            className={location.pathname === item.key ? "active" : ""}
            title={item.label}
          >
            {item.icon} <span className="nav-text">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info" style={{ 
          padding: '10px 20px', 
          fontSize: '14px', 
          color: '#666', 
          display: collapsed ? 'none' : 'block' 
        }}>
          Hi, {user?.username}
        </div>
        <button className="sidebar-manage-btn" onClick={onOpenSettings} title="系统设置">
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
}

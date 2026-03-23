import React, { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Moon,
  MoreHorizontal,
  Settings2,
  ShieldCheck,
  Sun,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { PageType } from "../../types";
import "./Sidebar.css";

interface SidebarProps {
  activePage: PageType;
  setActivePage: (page: PageType) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  user: { username?: string } | null;
  logout: () => void;
  openSettings: () => void;
  openTrustedDeviceManager: () => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const navItems: { key: PageType; icon: React.ReactNode; label: string }[] = [
  { key: "dashboard", icon: <Wallet size={20} />, label: "资产总览" },
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
  openTrustedDeviceManager,
  theme,
  toggleTheme,
}: SidebarProps) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const username = user?.username ?? "Guest";
  const userInitial = username.slice(0, 1).toUpperCase();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (mobileMenuRef.current && !mobileMenuRef.current.contains(target)) {
        setShowMobileMenu(false);
      }

      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setShowUserMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleManageTrustedDevice = () => {
    openTrustedDeviceManager();
    setShowMobileMenu(false);
    setShowUserMenu(false);
  };

  const handleLogout = () => {
    setShowMobileMenu(false);
    setShowUserMenu(false);
    logout();
  };

  return (
    <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="logo">
          <BarChart3 size={28} />
          <span className="logo-text">ExpensePro</span>
        </div>
        <button
          className="collapse-btn"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav>
        {navItems.map((item) => (
          <a
            key={item.key}
            href="#"
            className={activePage === item.key ? "active" : ""}
            onClick={(event) => {
              event.preventDefault();
              setActivePage(item.key);
            }}
            title={item.label}
          >
            {item.icon}
            <span className="nav-text">{item.label}</span>
          </a>
        ))}

        <div className="mobile-more-action" ref={mobileMenuRef}>
          <button
            className="mobile-more-btn"
            onClick={(event) => {
              event.preventDefault();
              setShowMobileMenu((prev) => !prev);
            }}
            title="更多菜单"
          >
            <MoreHorizontal size={20} />
          </button>
          {showMobileMenu && (
            <div className="mobile-dropdown-menu">
              <button
                className="mobile-dropdown-item"
                onClick={() => {
                  openSettings();
                  setShowMobileMenu(false);
                }}
              >
                <Settings2 size={18} />
                <span>系统设置</span>
              </button>
              <button className="mobile-dropdown-item" onClick={handleManageTrustedDevice}>
                <ShieldCheck size={18} />
                <span>管理信任设备</span>
              </button>
              <button
                className="mobile-dropdown-item"
                onClick={() => {
                  toggleTheme();
                  setShowMobileMenu(false);
                }}
              >
                {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
                <span>{theme === "light" ? "夜间模式" : "日间模式"}</span>
              </button>
              <button className="mobile-dropdown-item logout" onClick={handleLogout}>
                <LogOut size={18} />
                <span>退出登录</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-manage-btn" onClick={openSettings} title="系统设置">
          <Settings2 size={18} />
          <span className="nav-text">系统设置</span>
        </button>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === "light" ? "切换到夜间模式" : "切换到日间模式"}
        >
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          <span className="nav-text">{theme === "light" ? "夜间模式" : "日间模式"}</span>
        </button>

        <div className={`sidebar-user-menu ${showUserMenu ? "open" : ""}`} ref={userMenuRef}>
          <button
            className="sidebar-user-trigger"
            onClick={() => setShowUserMenu((prev) => !prev)}
            title={username}
          >
            <span className="user-avatar">{userInitial}</span>
            <span className="sidebar-user-copy">
              <span className="sidebar-user-label">当前登录</span>
              <span className="user-name">{username}</span>
            </span>
            <ChevronsUpDown size={16} className="sidebar-user-caret" />
          </button>

          {showUserMenu && (
            <div className="sidebar-user-dropdown">
              <button className="sidebar-user-dropdown-item" onClick={handleManageTrustedDevice}>
                <ShieldCheck size={16} />
                <span>管理信任设备</span>
              </button>
              <button className="sidebar-user-dropdown-item logout" onClick={handleLogout}>
                <LogOut size={16} />
                <span>退出登录</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
});

export default Sidebar;

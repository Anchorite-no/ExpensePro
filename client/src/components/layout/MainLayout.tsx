import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Settings2, Sun, Moon, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ToastContainer, useToast } from "../ui/Toast";

interface LayoutProps {
  onOpenSettings: () => void;
}

export function MainLayout({ onOpenSettings }: LayoutProps) {
  const { toasts, removeToast } = useToast();
  const { logout } = useAuth();
  
  const [theme, setTheme] = useState<"light" | "dark">(() => 
    (localStorage.getItem("theme") as "light" | "dark") || "light"
  );

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
  };

  return (
    <div className={`dashboard ${theme}`}>
      <Sidebar 
        theme={theme} 
        toggleTheme={toggleTheme} 
        onOpenSettings={onOpenSettings} 
      />

      <main className="main-content">
        <div className="content-wrapper">
          <header className="top-bar">
            <h2>ExpensePro</h2>
            <div className="mobile-actions">
              <button className="theme-toggle-mobile" onClick={onOpenSettings}>
                <Settings2 size={18} />
              </button>
              <button className="theme-toggle-mobile" onClick={toggleTheme}>
                {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              <button className="theme-toggle-mobile" onClick={logout}>
                <LogOut size={18} />
              </button>
            </div>
          </header>
          
          <Outlet context={{ theme }} />
        </div>
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

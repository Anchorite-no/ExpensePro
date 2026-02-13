import { useState } from "react";
import { User, Lock, Mail, ArrowRight, Wallet, Check, AlertCircle } from "lucide-react";

interface Props {
  onLogin: (token: string, username: string) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "操作失败");
      }

      // Login success
      onLogin(data.token, data.username);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Left Brand Section */}
        <div className="login-brand-section">
          <div className="brand-content">
            <div className="login-logo">
              <div className="logo-icon">
                <Wallet size={32} color="white" />
              </div>
              <h1>ExpensePro</h1>
            </div>
            <p className="brand-slogan">
              掌控财务，从每一次记录开始。<br />
              智能 AI 记账，让理财从未如此简单。
            </p>
            <div className="brand-visual">
              <div className="visual-bar bar-1"></div>
              <div className="visual-bar bar-2"></div>
              <div className="visual-bar bar-3"></div>
            </div>
          </div>
        </div>

        {/* Right Form Section */}
        <div className="login-form-section">
          <div className="form-wrapper">
            <h2>{isLogin ? "欢迎回来" : "创建账号"}</h2>
            <p className="form-subtitle">
              {isLogin
                ? "请输入您的账号信息以登录"
                : "注册即刻开启您的智能记账之旅"}
            </p>

            {error && (
              <div className="login-error">
                <AlertCircle size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>用户名</label>
                <div className="input-wrapper">
                  <User size={18} className="input-icon" />
                  <input
                    type="text"
                    placeholder="请输入用户名"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>密码</label>
                <div className="input-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input
                    type="password"
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="login-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  "处理中..."
                ) : (
                  <>
                    {isLogin ? "登录" : "注册"}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="login-footer">
              {isLogin ? "还没有账号？" : "已有账号？"}
              <button
                className="toggle-auth-mode"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                  setUsername("");
                  setPassword("");
                }}
              >
                {isLogin ? "免费注册" : "立即登录"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { deriveKeyFromPassword, decryptMasterKey } from '../utils/crypto';

export const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 服务端配置
  const [requireInvite, setRequireInvite] = useState(false);
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);

  // 注册成功后暂存用户名密码，切回登录时自动填写
  const registeredCredentials = useRef<{ username: string; password: string } | null>(null);

  const { login } = useAuth();

  // 获取服务端配置
  useEffect(() => {
    fetch('/api/auth/config')
      .then(r => r.json())
      .then(data => {
        setRequireInvite(!!data.requireInvite);
        setEncryptionEnabled(!!data.encryption);
      })
      .catch(() => { /* ignore */ });
  }, []);

  // 切换模式时清空状态（但注册成功后保留凭据）
  useEffect(() => {
    setError('');
    setConfirmPassword('');
    setInviteCode('');
    setAgreeToTerms(false);
    setShowPassword(false);
    setShowConfirmPassword(false);

    if (isLogin && registeredCredentials.current) {
      // 注册成功回到登录，自动填写
      setUsername(registeredCredentials.current.username);
      setPassword(registeredCredentials.current.password);
      registeredCredentials.current = null;
      setTimeout(() => setError('注册成功！请使用新账号登录。'), 100);
    } else {
      setUsername('');
      setPassword('');
    }
  }, [isLogin]);

  // 密码实时校验规则
  const pwRules = [
    { label: '至少 8 个字符', pass: password.length >= 8 },
    { label: '包含字母', pass: /[a-zA-Z]/.test(password) },
    { label: '包含数字或符号', pass: /[\d\W_]/.test(password) },
  ];
  const pwMatch = confirmPassword.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isLogin && !agreeToTerms) {
      setError('请先勾选同意隐私条例');
      return;
    }

    if (!isLogin) {
      if (!pwRules.every(r => r.pass)) {
        setError('密码不符合安全要求');
        return;
      }
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
      if (requireInvite && !inviteCode.trim()) {
        setError('请输入邀请码');
        return;
      }
    }

    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const API_URL = '';

    try {
      const body: any = { username, password };
      if (!isLogin && requireInvite) body.inviteCode = inviteCode.trim();

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '操作失败');
      }

      if (isLogin) {
        // 如果服务端启用了加密，解密 Master Key
        if (data.encryption && data.encryptedMasterKey && data.masterKeySalt) {
          try {
            const passwordKey = await deriveKeyFromPassword(password, data.masterKeySalt);
            const masterKey = await decryptMasterKey(data.encryptedMasterKey, passwordKey);
            login(data.token, data.username, masterKey, true);
          } catch {
            throw new Error('密钥解密失败，请确认密码正确');
          }
        } else {
          login(data.token, data.username);
        }
      } else {
        // 暂存注册时填写的用户名密码
        registeredCredentials.current = { username, password };
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || '网络或服务器错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* 品牌区域 */}
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <Wallet size={28} />
          </div>
          <h1 className="auth-brand-name">ExpensePro</h1>
          <p className="auth-brand-tagline">智能记账 · 轻松理财</p>
        </div>

        {/* 标题 */}
        <div className="auth-header">
          <h2 className="auth-title">{isLogin ? '欢迎回来' : '创建新账号'}</h2>
          <p className="auth-subtitle">
            {isLogin ? '请登录以继续管理您的财务' : '注册以开始管理您的个人财务'}
          </p>
        </div>

        {/* 错误/成功提示 */}
        {error && (
          <div className={`auth-alert ${error.includes('成功') ? 'auth-alert-success' : 'auth-alert-error'}`}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off">
          {/* 邀请码 */}
          {!isLogin && requireInvite && (
            <div className="auth-field">
              <label className="auth-label">邀请码</label>
              <input
                type="text"
                className="auth-input"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                placeholder="请输入邀请码"
                autoComplete="off"
              />
            </div>
          )}

          {/* 用户名 */}
          <div className="auth-field">
            <label className="auth-label">用户名</label>
            <input
              type="text"
              className="auth-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="请输入用户名"
              autoComplete="off"
            />
          </div>

          {/* 密码 */}
          <div className="auth-field">
            <label className="auth-label">密码</label>
            <div className="auth-pw-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                className="auth-input auth-input-pw"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="请输入密码"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="auth-pw-eye"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {!isLogin && password.length > 0 && (
              <ul className="auth-pw-rules">
                {pwRules.map((r, i) => (
                  <li key={i} className={r.pass ? 'pass' : 'fail'}>
                    <span className="auth-pw-icon">{r.pass ? '✓' : '✗'}</span>
                    {r.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 确认密码 */}
          {!isLogin && (
            <div className="auth-field">
              <label className="auth-label">确认密码</label>
              <div className="auth-pw-wrapper">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="auth-input auth-input-pw"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="请再次输入密码"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="auth-pw-eye"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <p className={`auth-pw-match ${pwMatch ? 'pass' : 'fail'}`}>
                  <span className="auth-pw-icon">{pwMatch ? '✓' : '✗'}</span>
                  {pwMatch ? '密码一致' : '密码不一致'}
                </p>
              )}
            </div>
          )}

          {/* 隐私条例 */}
          {!isLogin && (
            <div className="auth-checkbox-group">
              <input
                type="checkbox"
                id="privacy"
                checked={agreeToTerms}
                onChange={(e) => setAgreeToTerms(e.target.checked)}
                className="auth-checkbox"
              />
              <label htmlFor="privacy" className="auth-checkbox-label">
                我已阅读并同意 <span className="auth-link">《用户隐私条例》</span>
              </label>
            </div>
          )}

          {/* 加密提示 */}
          {!isLogin && encryptionEnabled && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0', opacity: 0.8 }}>
              🔒 此服务已启用端到端加密，您的账单数据将使用您的密码加密存储
            </p>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={loading}
            className={`auth-submit ${isLogin ? '' : 'auth-submit-register'}`}
          >
            {loading ? '处理中...' : (isLogin ? '登 录' : '立即注册')}
          </button>
        </form>

        {/* 切换登录/注册 */}
        <div className="auth-switch">
          <span className="auth-switch-text">
            {isLogin ? '还没有账号？' : '已有账号？'}
          </span>
          <button onClick={() => setIsLogin(!isLogin)} className="auth-switch-btn">
            {isLogin ? '免费注册' : '直接登录'}
          </button>
        </div>
      </div>
    </div>
  );
};

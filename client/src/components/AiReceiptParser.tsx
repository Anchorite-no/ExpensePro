import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, Upload, Settings, X, Check, Loader2, Sparkles, Trash2, ImagePlus, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, isValid, parse, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Select } from "./ui/Select";
import "./AiReceiptParser.css";

// --- Compact Date Input (Local Component) ---
function getChinaToday(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}

function parseDisplayDate(year: string, month: string, day: string): string | null {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  if (y < 1900 || y > 2100) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  const dateStr = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const parsed = parse(dateStr, 'yyyy-MM-dd', new Date());
  if (!isValid(parsed)) return null;
  if (parsed.getFullYear() !== y || parsed.getMonth() + 1 !== m || parsed.getDate() !== d) return null;
  return dateStr;
}

const CompactDateInput: React.FC<{ value: string; onChange: (date: string) => void }> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);

  const splitValue = useCallback((val: string) => {
    if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split('-');
      return { year: y, month: m, day: d };
    }
    return { year: '', month: '', day: '' };
  }, []);

  const [parts, setParts] = useState(() => splitValue(value));

  useEffect(() => {
    setParts(splitValue(value));
    if (value && isValid(parse(value, 'yyyy-MM-dd', new Date()))) {
      setViewDate(parse(value, 'yyyy-MM-dd', new Date()));
    }
  }, [value, splitValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const commitOrReset = useCallback(() => {
    const result = parseDisplayDate(parts.year, parts.month, parts.day);
    if (result) {
      onChange(result);
      setViewDate(parse(result, 'yyyy-MM-dd', new Date()));
    } else {
      const today = getChinaToday();
      onChange(today);
      setParts(splitValue(today));
      setViewDate(parse(today, 'yyyy-MM-dd', new Date()));
    }
  }, [parts, onChange, splitValue]);

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    setParts(prev => ({ ...prev, year: raw }));
    if (raw.length === 4) { monthRef.current?.focus(); monthRef.current?.select(); }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setParts(prev => ({ ...prev, month: raw }));
    const num = parseInt(raw, 10);
    if (raw.length === 2 || (raw.length === 1 && num > 1)) {
      if (raw.length === 1 && num > 1) { raw = '0' + raw; setParts(prev => ({ ...prev, month: raw })); }
      dayRef.current?.focus(); dayRef.current?.select();
    }
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setParts(prev => ({ ...prev, day: raw }));
    const num = parseInt(raw, 10);
    if (raw.length === 2 || (raw.length === 1 && num > 3)) {
      if (raw.length === 1 && num > 3) { raw = '0' + raw; setParts(prev => ({ ...prev, day: raw })); }
      const result = parseDisplayDate(parts.year, parts.month, raw);
      if (result) { onChange(result); setViewDate(parse(result, 'yyyy-MM-dd', new Date())); }
      setTimeout(() => dayRef.current?.blur(), 0);
    }
  };

  const handleKeyDown = (field: 'year' | 'month' | 'day') => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (field === 'month' && parts.month === '') yearRef.current?.focus();
      else if (field === 'day' && parts.day === '') monthRef.current?.focus();
    }
    if (e.key === 'Enter') { commitOrReset(); setIsOpen(false); }
    if (e.key === '/' || e.key === '-') {
      e.preventDefault();
      if (field === 'year') { monthRef.current?.focus(); monthRef.current?.select(); }
      else if (field === 'month') { dayRef.current?.focus(); dayRef.current?.select(); }
    }
  };

  const handleGroupBlur = (e: React.FocusEvent) => {
    if (containerRef.current?.contains(e.relatedTarget as Node)) return;
    commitOrReset();
  };

  const days = eachDayOfInterval({ start: startOfMonth(viewDate), end: endOfMonth(viewDate) });
  const startDay = startOfMonth(viewDate).getDay();
  const prefixDays = Array(startDay).fill(null);

  return (
    <div className="compact-date-input" ref={containerRef} onBlur={handleGroupBlur}>
      <div className="compact-date-wrapper" onClick={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') dayRef.current?.focus(); }}>
        <input ref={yearRef} className="date-seg year" value={parts.year} onChange={handleYearChange} onKeyDown={handleKeyDown('year')} placeholder="" maxLength={4} inputMode="numeric" />
        <span className="sep">/</span>
        <input ref={monthRef} className="date-seg month" value={parts.month} onChange={handleMonthChange} onKeyDown={handleKeyDown('month')} placeholder="" maxLength={2} inputMode="numeric" />
        <span className="sep">/</span>
        <input ref={dayRef} className="date-seg day" value={parts.day} onChange={handleDayChange} onKeyDown={handleKeyDown('day')} placeholder="" maxLength={2} inputMode="numeric" />
        <button className="compact-toggle-btn" onClick={() => setIsOpen(!isOpen)}><CalendarIcon size={14} /></button>
      </div>
      {isOpen && (
        <div className="date-picker-dropdown">
           <div className="calendar-header">
              <button onClick={() => setViewDate(subMonths(viewDate, 1))}><ChevronLeft size={16} /></button>
              <span className="current-month">{format(viewDate, 'yyyy年 MM月', { locale: zhCN })}</span>
              <button onClick={() => setViewDate(addMonths(viewDate, 1))}><ChevronRight size={16} /></button>
          </div>
          <div className="calendar-weekdays">{['日', '一', '二', '三', '四', '五', '六'].map(d => <span key={d}>{d}</span>)}</div>
          <div className="calendar-grid">
            {prefixDays.map((_, i) => <div key={`empty-${i}`} className="calendar-day empty"></div>)}
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              return <button key={dateStr} className={`calendar-day ${value === dateStr ? 'selected' : ''} ${isToday(day) ? 'today' : ''}`} onClick={() => { onChange(dateStr); setParts(splitValue(dateStr)); setIsOpen(false); }}>{format(day, 'd')}</button>
            })}
          </div>
          <div className="calendar-footer">
            <button className="today-btn" onClick={() => { const today = getChinaToday(); onChange(today); setParts(splitValue(today)); setViewDate(parse(today, 'yyyy-MM-dd', new Date())); setIsOpen(false); }}>今天</button>
          </div>
        </div>
      )}
    </div>
  );
};
// --- End Compact Date Input ---

interface ParsedItem {
  title: string;
  amount: number;
  category: string;
  date?: string;
  note?: string;
}

interface ImageEntry {
  id: string;
  preview: string;
  base64: string;
}

interface AiReceiptParserProps {
  theme: "light" | "dark";
  categories: Record<string, string>;
  onAddExpense: (title: string, amount: number, category: string, date?: string) => void;
  currency: string;
  token: string | null;
}

const DEFAULT_MODEL = "gemini-2.0-flash";

const AVAILABLE_MODELS = [
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (标准版 - 速度快)" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (平衡版 - 综合强)" },
  { value: "gemini-3-flash-preview", label: "Gemini 3.0 Flash (预览版 - 更智能)" },
];

let imageIdCounter = 0;

export default function AiReceiptParser({ theme, categories, onAddExpense, currency, token }: AiReceiptParserProps) {
  const categoryList = Object.keys(categories);
  // API Key 设置
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [serverAiMode, setServerAiMode] = useState(false);

  // 多图片状态
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState<string | null>(null);
  const [parseProgress, setParseProgress] = useState({ current: 0, total: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 检查是否使用服务端 AI 密钥
  useEffect(() => {
    fetch("/api/ai/status")
      .then(r => r.json())
      .then(data => { if (data.serverAi) setServerAiMode(true); })
      .catch(() => { /* ignore */ });
  }, []);

  // 从后端加载设置
  useEffect(() => {
    if (!token) return;
    fetch("/api/settings", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.aiApiKey) setApiKey(data.aiApiKey);
        if (data.aiModel) setModel(data.aiModel);
        setSettingsLoaded(true);
      })
      .catch(() => setSettingsLoaded(true));
  }, [token]);

  // 保存设置到后端
  const saveSettings = async () => {
    if (token) {
      try {
        await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ aiApiKey: apiKey, aiModel: model }),
        });
      } catch { /* ignore */ }
    }
    setShowSettings(false);
  };

// 压缩图片 helper
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          
          // 限制最大边长为 1280px (平衡速度与清晰度)
          const MAX_SIZE = 1280;
          if (width > MAX_SIZE || height > MAX_SIZE) {
            if (width > height) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            } else {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          
          // 优化：使用 WebP 格式，质量 0.8 (同画质下体积更小)
          const dataUrl = canvas.toDataURL("image/webp", 0.8);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // 处理文件（支持多个）
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(f => {
      if (!f.type.startsWith("image/")) return false;
      // 这里的 15MB 限制其实可以放宽了，因为我们会压缩，但作为初筛保留也行
      if (f.size > 15 * 1024 * 1024) return false;
      return true;
    });

    if (validFiles.length === 0) {
      setError("请选择有效的图片文件（单个不超过 15MB）");
      return;
    }

    setError("");

    // 并行处理所有图片压缩
    const newImages = await Promise.all(validFiles.map(async (file) => {
      try {
        const compressedDataUrl = await compressImage(file);
        return {
          id: `img-${++imageIdCounter}`,
          preview: compressedDataUrl,
          base64: compressedDataUrl,
        };
      } catch (err) {
        console.error("图片压缩失败:", err);
        return null;
      }
    }));

    setImages(prev => [...prev, ...newImages.filter((img): img is ImageEntry => img !== null)]);
  }, []);

  // 拖拽事件
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  // 粘贴事件
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) handleFiles(imageFiles);
  }, [handleFiles]);

  // 删除单张图片
  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  // AI 解析（多图逐张）
  const parseReceipts = async () => {
    if (images.length === 0) return;
    if (!serverAiMode && !apiKey) {
      setError("请先配置 API Key（点击右上角齿轮图标）");
      return;
    }

    setParsing(true);
    setError("");
    setParsedItems([]);
    setParseProgress({ current: 0, total: images.length });

    const allItems: ParsedItem[] = [];
    const errors: string[] = [];

    for (let i = 0; i < images.length; i++) {
      setParseProgress({ current: i + 1, total: images.length });
      try {
        const res = await fetch("/api/ai/parse-receipt", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify({
            image: images[i].base64,
            ...(serverAiMode ? {} : { apiKey }),
            model: model || DEFAULT_MODEL,
            categories: categoryList,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          errors.push(`图片 ${i + 1}: ${data.error || "解析失败"}`);
          continue;
        }
        if (data.items && data.items.length > 0) {
          allItems.push(...data.items);
        } else {
          errors.push(`图片 ${i + 1}: 未识别到消费记录`);
        }
      } catch (err: any) {
        errors.push(`图片 ${i + 1}: ${err.message || "网络错误"}`);
      }
    }

    if (allItems.length > 0) {
      setParsedItems(allItems);
    }
    if (errors.length > 0) {
      setError(errors.join("\n"));
    }

    setParsing(false);
    setParseProgress({ current: 0, total: 0 });
  };

  // 添加单条记录
  const addItem = (item: ParsedItem, index: number) => {
    onAddExpense(item.title, item.amount, item.category, item.date, item.note);
    setParsedItems((prev) => prev.filter((_, i) => i !== index));
  };

  // 添加全部
  const addAll = () => {
    parsedItems.forEach((item) => {
      onAddExpense(item.title, item.amount, item.category, item.date, item.note);
    });
    setParsedItems([]);
    setImages([]);
  };

  // 清除全部
  const clearAll = () => {
    setImages([]);
    setParsedItems([]);
    setError("");
  };

  // 修改解析结果
  const updateItem = (index: number, field: keyof ParsedItem, value: string | number) => {
    setParsedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const removeItem = (index: number) => {
    setParsedItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="ai-parser" onPaste={handlePaste} tabIndex={0}>
      {/* 标题栏 */}
      <div className="ai-parser-header">
        <h3><Sparkles size={16} /> AI 智能记账</h3>
        <button className="icon-btn" onClick={() => setShowSettings(!showSettings)} title="API 设置">
          <Settings size={16} />
        </button>
      </div>

      {/* API 设置面板 */}
      {showSettings && (
        <div className="ai-settings">
          {!serverAiMode && (
            <div className="ai-setting-row">
              <label>API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza..."
              />
            </div>
          )}
          <div className="ai-setting-row">
            <label>模型</label>
            <Select
              value={model}
              onChange={(val) => setModel(val)}
              options={AVAILABLE_MODELS.map(m => ({ value: m.value, label: m.label }))}
            />
          </div>
          <button className="ai-settings-save" onClick={saveSettings}>
            <Check size={14} /> 保存配置
          </button>
        </div>
      )}

      {/* 图片上传区域 */}
      <div
        className={`ai-dropzone ${isDragging ? "dragging" : ""} ${images.length > 0 ? "has-images" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => images.length === 0 && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
            }
            e.target.value = "";
          }}
        />

        {images.length === 0 ? (
          <div className="ai-dropzone-content">
            <Camera size={32} />
            <p>拖拽图片到此处、点击选择或 Ctrl+V 粘贴</p>
            <span>支持多张图片同时上传，一次性识别所有小票</span>
          </div>
        ) : (
          <div className="ai-image-grid">
            {images.map((img) => (
              <div key={img.id} className="ai-thumb" onClick={(e) => e.stopPropagation()}>
                <img
                  src={img.preview}
                  alt="receipt"
                  onClick={() => setShowFullScreen(img.preview)}
                  title="点击查看大图"
                />
                <button
                  className="ai-thumb-remove"
                  onClick={() => removeImage(img.id)}
                  title="移除"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              className="ai-thumb-add"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              title="添加更多图片"
            >
              <ImagePlus size={20} />
            </button>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      {images.length > 0 && (
        <div className="ai-actions">
          <button
            className="ai-parse-btn"
            onClick={parseReceipts}
            disabled={parsing}
          >
            {parsing ? (
              <>
                <Loader2 size={16} className="spinning" />
                识别中 ({parseProgress.current}/{parseProgress.total})...
              </>
            ) : (
              <>
                <Upload size={16} /> 开始识别 ({images.length} 张)
              </>
            )}
          </button>
          <button className="ai-clear-btn" onClick={clearAll} disabled={parsing}>
            <Trash2 size={14} /> 清除
          </button>
        </div>
      )}

      {/* 错误提示 */}
      {error && <div className="ai-error" style={{ whiteSpace: "pre-line" }}>{error}</div>}

      {/* 解析结果 */}
      {parsedItems.length > 0 && (
        <div className="ai-results">
          <div className="ai-results-header">
            <span>识别到 {parsedItems.length} 条记录</span>
            <button className="ai-add-all-btn" onClick={addAll}>
              <Check size={14} /> 全部添加
            </button>
          </div>
          <div className="ai-results-list">
            {parsedItems.map((item, i) => (
              <div key={i} className="ai-result-item">
                <div className="ai-result-info">
                  <input
                    className="ai-result-title"
                    value={item.title}
                    onChange={(e) => updateItem(i, "title", e.target.value)}
                    placeholder="消费内容"
                  />
                  <input
                    className="ai-result-note"
                    value={item.note || ""}
                    onChange={(e) => updateItem(i, "note", e.target.value)}
                    placeholder="备注（可选）"
                  />
                </div>
                
                <div className="ai-result-meta">
                  <div className="ai-result-amount-wrapper">
                    <span className="currency-symbol">{currency}</span>
                    <input
                      className="ai-result-amount"
                      type="number"
                      value={item.amount}
                      onChange={(e) => updateItem(i, "amount", Number(e.target.value))}
                    />
                  </div>

                  <div className="ai-category-wrapper">
                    <Select
                      value={item.category}
                      onChange={(val) => updateItem(i, "category", val)}
                      options={categoryList.map(c => ({ value: c, label: c, color: categories[c] }))}
                    />
                  </div>
                  
                  <div className="ai-date-wrapper">
                    <CompactDateInput 
                      value={item.date || ""} 
                      onChange={(val) => updateItem(i, "date", val)} 
                    />
                  </div>

                  <div className="ai-result-actions">
                    <button className="icon-btn" onClick={() => addItem(item, i)} title="确认添加">
                      <Check size={16} className="text-success" />
                    </button>
                    <button className="icon-btn" onClick={() => removeItem(i)} title="删除">
                      <Trash2 size={16} className="text-danger" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Screen Preview */}
      {showFullScreen && (
        <div className="ai-fullscreen-overlay" onClick={() => setShowFullScreen(null)}>
          <div className="ai-fullscreen-content" onClick={(e) => e.stopPropagation()}>
            <img src={showFullScreen} alt="Full screen receipt" />
            <button className="ai-fullscreen-close" onClick={() => setShowFullScreen(null)}>
              <X size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

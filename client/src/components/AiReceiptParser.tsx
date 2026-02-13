import { useState, useRef, useCallback } from "react";
import { Camera, Upload, Settings, X, Check, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Select } from "./ui/Select";

interface ParsedItem {
  title: string;
  amount: number;
  category: string;
  date?: string;
}

interface AiReceiptParserProps {
  theme: "light" | "dark";
  categories: Record<string, string>;
  onAddExpense: (title: string, amount: number, category: string, date?: string) => void;
}

const DEFAULT_MODEL = "gemini-2.0-flash";

const AVAILABLE_MODELS = [
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (推荐 - 速度快)" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (推理强 - 更准确)" },
];

export default function AiReceiptParser({ theme, categories, onAddExpense }: AiReceiptParserProps) {
  const categoryList = Object.keys(categories);
  // API Key 设置
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("ai_api_key") || "");
  const [model, setModel] = useState(() => localStorage.getItem("ai_model") || DEFAULT_MODEL);

  // 图片和解析状态
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 保存设置
  const saveSettings = () => {
    localStorage.setItem("ai_api_key", apiKey);
    localStorage.setItem("ai_model", model);
    setShowSettings(false);
  };

  // 处理文件
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("图片大小不能超过 15MB");
      return;
    }
    setError("");
    setParsedItems([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl);
    };
    reader.readAsDataURL(file);
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
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // 粘贴事件
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) handleFile(file);
        break;
      }
    }
  }, [handleFile]);

  // AI 解析
  const parseReceipt = async () => {
    if (!imageBase64) return;
    if (!apiKey) {
      setError("请先配置 API Key（点击右上角齿轮图标）");
      return;
    }

    setParsing(true);
    setError("");
    setParsedItems([]);

    try {
      const res = await fetch("/api/ai/parse-receipt", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          image: imageBase64,
          apiKey,
          model: model || DEFAULT_MODEL,
          categories: categoryList,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const detail = data.detail ? `\n${typeof data.detail === 'string' ? data.detail.substring(0, 200) : JSON.stringify(data.detail).substring(0, 200)}` : '';
        throw new Error((data.error || "解析失败") + detail);
      }
      if (!data.items || data.items.length === 0) {
        setError("未能从图片中识别出消费记录");
        return;
      }
      setParsedItems(data.items);
    } catch (err: any) {
      setError(err.message || "解析失败，请检查 API 配置");
    } finally {
      setParsing(false);
    }
  };

  // 添加单条记录
  const addItem = (item: ParsedItem, index: number) => {
    onAddExpense(item.title, item.amount, item.category, item.date);
    setParsedItems((prev) => prev.filter((_, i) => i !== index));
  };

  // 添加全部
  const addAll = () => {
    parsedItems.forEach((item) => {
      onAddExpense(item.title, item.amount, item.category, item.date);
    });
    setParsedItems([]);
    setImagePreview(null);
    setImageBase64(null);
  };

  // 清除图片
  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
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
          <div className="ai-setting-row">
            <label>API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
            />
          </div>
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
      {!imagePreview ? (
        <div
          className={`ai-dropzone ${isDragging ? "dragging" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <div className="ai-dropzone-content">
            <Camera size={32} />
            <p>拖拽图片到此处、点击选择或 Ctrl+V 粘贴</p>
            <span>支持账单、收据、外卖截图等</span>
          </div>
        </div>
      ) : (
          <div className="ai-preview">
            <div className="ai-preview-img" onClick={() => setShowFullScreen(true)} title="点击查看大图">
              <img src={imagePreview} alt="receipt" />
              <button 
                className="ai-preview-close" 
                onClick={(e) => { e.stopPropagation(); clearImage(); }} 
                title="清除"
              >
                <X size={14} />
              </button>
            </div>
            <button
            className="ai-parse-btn"
            onClick={parseReceipt}
            disabled={parsing}
          >
            {parsing ? (
              <><Loader2 size={16} className="spinning" /> 识别中...</>
            ) : (
              <><Upload size={16} /> 开始识别</>
            )}
          </button>
        </div>
      )}

      {/* 错误提示 */}
      {error && <div className="ai-error">{error}</div>}

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
                <input
                  className="ai-result-title"
                  value={item.title}
                  onChange={(e) => updateItem(i, "title", e.target.value)}
                />
                <input
                  className="ai-result-amount"
                  type="number"
                  value={item.amount}
                  onChange={(e) => updateItem(i, "amount", Number(e.target.value))}
                />
                <div style={{ width: 100, flexShrink: 0 }}>
                  <Select
                    value={item.category}
                    onChange={(val) => updateItem(i, "category", val)}
                    options={categoryList.map(c => ({ value: c, label: c }))}
                  />
                </div>
                <input
                  className="ai-result-date"
                  type="date"
                  value={item.date || ""}
                  onChange={(e) => updateItem(i, "date", e.target.value)}
                />
                <div className="ai-result-actions">
                  <button className="icon-btn" onClick={() => addItem(item, i)} title="添加">
                    <Check size={14} />
                  </button>
                  <button className="icon-btn" onClick={() => removeItem(i)} title="删除">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Full Screen Preview */}
      {showFullScreen && imagePreview && (
        <div className="ai-fullscreen-overlay" onClick={() => setShowFullScreen(false)}>
          <div className="ai-fullscreen-content" onClick={(e) => e.stopPropagation()}>
            <img src={imagePreview} alt="Full screen receipt" />
            <button className="ai-fullscreen-close" onClick={() => setShowFullScreen(false)}>
              <X size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

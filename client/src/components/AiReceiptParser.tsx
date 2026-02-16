import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, Upload, Settings, X, Check, Loader2, Sparkles, Trash2, ImagePlus } from "lucide-react";
import { Select } from "./ui/Select";

interface ParsedItem {
  title: string;
  amount: number;
  category: string;
  date?: string;
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
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (推荐 - 速度快)" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (推理强 - 更准确)" },
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

  // 处理文件（支持多个）
  const handleFiles = useCallback((files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(f => {
      if (!f.type.startsWith("image/")) return false;
      if (f.size > 15 * 1024 * 1024) return false;
      return true;
    });

    if (validFiles.length === 0) {
      setError("请选择有效的图片文件（单个不超过 15MB）");
      return;
    }

    setError("");

    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const entry: ImageEntry = {
          id: `img-${++imageIdCounter}`,
          preview: dataUrl,
          base64: dataUrl,
        };
        setImages(prev => [...prev, entry]);
      };
      reader.readAsDataURL(file);
    });
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
    onAddExpense(item.title, item.amount, item.category, item.date);
    setParsedItems((prev) => prev.filter((_, i) => i !== index));
  };

  // 添加全部
  const addAll = () => {
    parsedItems.forEach((item) => {
      onAddExpense(item.title, item.amount, item.category, item.date);
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

export const API_URL = "/api/expenses";

export const DEFAULT_CATEGORIES: Record<string, string> = {
  "餐饮": "#10B981",
  "交通": "#3B82F6",
  "购物": "#8B5CF6",
  "娱乐": "#F59E0B",
  "服务订阅": "#EC4899",
  "投资": "#6366F1",
  "其他": "#6B7280",
};

export const COLOR_PALETTE = [
  "#14B8A6", "#F97316", "#EF4444", "#06B6D4", "#D946EF",
  "#84CC16", "#E11D48", "#0EA5E9", "#A855F7", "#22D3EE",
];

export const PRESET_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#84CC16", "#10B981",
  "#06B6D4", "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899",
  "#6B7280", "#111827"
];

export const CURRENCIES = [
  { value: "¥", label: "¥ CNY (人民币)" },
  { value: "$", label: "$ USD (美元)" },
  { value: "€", label: "€ EUR (欧元)" },
  { value: "£", label: "£ GBP (英镑)" },
  { value: "₩", label: "₩ KRW (韩元)" },
  { value: "₹", label: "₹ INR (印度卢比)" },
  { value: "A$", label: "A$ AUD (澳元)" },
  { value: "C$", label: "C$ CAD (加元)" },
];

export const PAGE_TITLES: Record<string, string> = {
  dashboard: "资产概览",
  trends: "趋势分析",
  transactions: "交易记录",
};

export const DEFAULT_TAGS: string[] = [
  "早餐", "午餐", "晚餐", "夜宵",
  "打车", "地铁", "公交",
  "日用品", "水果", "零食", "饮料",
  "话费", "水电", "房租",
  "聚餐", "电影", "游戏",
  "工资", "奖金", "红包",
];

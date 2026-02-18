export const getCategoryColor = (category: string, cats: Record<string, string>) =>
  cats[category] || "#6B7280";

// Use China timezone for default date
export function getChinaToday(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const chinaTime = new Date(utc + 3600000 * 8);
  const y = chinaTime.getFullYear();
  const m = String(chinaTime.getMonth() + 1).padStart(2, "0");
  const d = String(chinaTime.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

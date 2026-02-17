export function buildPrompt(categories?: string[]): string {
  const cats = Array.isArray(categories) && categories.length > 0
    ? categories.join("、")
    : "餐饮、交通、购物、娱乐、服务订阅、投资、其他";

  const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });

  return `你是一个专业的记账助手。今天是 ${today}。用户会发送消费小票、账单截图、转账记录等图片，你需要从中识别出所有的消费记录。

请严格按以下 JSON 格式返回结果，不要输出任何其他文字：
{
  "items": [
    {
      "title": "消费项目名称（简短描述）",
      "amount": 金额数字（不带货币符号），
      "category": "分类",
      "date": "YYYY-MM-DD 格式的日期，如果图片中只有月日没有年份，请默认为当年（${new Date().getFullYear()}年）"
    }
  ]
}

分类必须是以下之一：${cats}

识别规则：
1. 如果图片中有多个消费项目，全部列出
2. 金额必须是正数
3. 标题尽量简洁，不超过20个字
4. 如果无法识别图片内容，返回 {"items": [], "error": "无法识别图片内容"}
5. 合理推断分类，例如：外卖/餐厅→餐饮，打车/地铁→交通，超市/商场→购物

请识别这张图片中的消费记录：`;
}

export function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], base64: match[2] };
  }
  return { mimeType: "image/jpeg", base64: dataUrl };
}

export function extractJson(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text); } catch { }
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch { }
  }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch { }
  }
  return null;
}

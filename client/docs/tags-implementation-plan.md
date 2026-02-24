# 🏷️ 标签 (Hashtag) 功能实现计划 (阶段一：记入与解析)

## 🎯 核心目标
在不修改后端数据库结构、不破坏现有端到端加密 (E2E) 的前提下，通过纯前端解析的方式，在备注 (`note`) 字段中引入“哈希标签 (Hashtag)”系统。

本阶段**不包含**复杂的统计图表（如饼图、柱状图），仅专注于**数据的输入、提取和 UI 呈现**。

---

## 🛠️ 具体实施步骤

### 1. 核心解析逻辑 (Utils)
*   **文件**: 新建 `client/src/utils/tags.ts`
*   **功能**:
    *   `extractTags(text: string): string[]`: 利用正则表达式 `/#([^\s#]+)/g`，从一段备注文本中提取出所有唯一的标签数组。
    *   `stripTags(text: string): string`: 移除文本中的标签，仅返回纯文本（用于某些可能需要纯净文本的场景，虽然不一定会用到，但作为配套工具函数提供）。
    *   `getTopTags(expenses: any[], limit?: number): string[]`: 从现有的所有账单数据中，统计并提取出使用频次最高的 N 个标签，用于快捷输入提示。

### 2. UI 渲染强化 (Transactions & Dashboard)
*   **组件**: 修改 `client/src/components/TransactionsPage.tsx` 和 `client/src/components/dashboard/RecentTransactions.tsx`
*   **功能**:
    *   编写/引入一个 `renderNoteWithTags(note: string)` 函数或组件。
    *   不再直接输出原生的 `item.note` 纯文本。
    *   利用正则匹配，将普通的文本渲染为标准文本，将匹配到的 `#标签名` 渲染为带有特定 CSS 样式的 `<span className="tag-pill">`。
*   **样式**:
    *   在相关的 CSS 文件中添加 `.tag-pill` 样式（例如：淡蓝色背景、蓝色文字、小圆角、适当的内边距），使其与普通备注文本明显区分开。

### 3. 智能输入辅助 (QuickAdd & Forms)
*   **组件**: 修改 `client/src/components/dashboard/QuickAddCard.tsx` 和 `client/src/components/TransactionsPage.tsx` (单条/批量添加表单)
*   **功能**:
    *   在备注输入框（`input`）的下方或侧边，新增一个小的“快捷标签区”。
    *   调用 `getTopTags` 函数获取最常用的 3-5 个标签。
    *   将这些常用标签渲染为可点击的微型药丸按钮。
    *   **交互**: 点击这些快捷按钮，会自动将对应的 `#标签` (例如 `#聚餐`) 追加到当前备注输入框内容的末尾（带空格分隔）。

### 4. 安全与兼容性保证 (E2E)
*   **确认项**: 目前的 `client/src/utils/crypto.ts` 已经对 `note` 字段进行了整体 AES 加密。
*   **策略**: **无需修改任何加解密逻辑**。
*   **原理**: 用户输入的 `#标签` 是作为 `note` 字符串的一部分，被安全地加密并发送到服务器。前端拉取数据并解密后，依然是包含 `#标签` 的完整字符串。这保证了逻辑的 100% 向后兼容性和最高级别的安全性。

---

## 🎨 待确认的体验细节 (后续迭代)
1.  **标签颜色**: 第一版先使用统一的主题色（如 primary 蓝色）来高亮标签。后续如果需要，可以考虑像“分类”一样为标签分配随机或固定的颜色。
2.  **快捷输入方式**: 第一版采用最直观的“输入框下方小按钮”的形式。如果未来需要更高级的体验，可以考虑实现输入 `#` 后的下拉悬浮菜单自动补全功能。

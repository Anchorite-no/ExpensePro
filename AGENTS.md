# OpenCode Agent Rules

## ✅ 质量控制（最高优先级）

**代码交付标准**：
- 在结束任务前，**必须**自我尝试编译/运行代码。
- **严禁**提交或交付包含编译错误的代码。
- 只有在确认 `npm run build` (或相应构建命令) 成功且无报错后，方可结束任务。

## ⚠️ 安全规则（最高优先级）

**严禁删除以下目录**：
- ❌ `C:\Users\anchorite\.config\opencode\` - OpenCode 配置目录
- ❌ `D:/code/.git/` - Git 仓库
- ❌ 用户明确指定的任何配置文件夹

**删除操作前必须**：

1. 明确询问用户确认路径
2. 展示将要删除的文件列表
3. 等待用户确认后才执行

---

## Git 操作规则

### 自动提交规则

文件修改后自动执行：
1. `git add .`
2. `git commit -m "描述"`
3. `git push`

无需询问，除非冲突。

### Git Clone 规则

执行 `git clone` 时：
1. 克隆到 `D:\Code\gitclone\` 目录
2. 若目录不存在则自动创建
3. 完整命令格式：`git clone <repo-url> D:\Code\gitclone\<项目名>`

---

## Web Search 工作流（必须执行）

### 决策树

```
需求识别
├─ 搜索信息
│  ├─ 通用搜索/代码示例/GitHub → Exa
│  └─ 官方文档/框架 API → Context7
│
├─ 阅读网页
│  ├─ 国外网站 → Jina Reader
│  │  └─ 失败/404 → Browser
│  └─ 中文网站 → Browser
│
├─ 网站测试 → Browser
├─ 交互操作 → Browser
└─ Token 管理 → DCP（自动）
```

### 工具选择规则

1. **搜索**
   - 通用搜索/代码示例 → Exa
   - 官方文档/框架 API → Context7

2. **阅读网页**
   - **用户提供明确网址** → **必须优先使用 Jina Reader**
     - 若失败 → **切换 Browser**
   - **国外网站** → 优先 Jina Reader，失败则 Browser
   - **中文网站** → 直接使用 Browser
   - **需要登录/交互的页面** → 直接使用 Browser

3. **网站测试** → **优先使用 Browser**

4. **交互操作** → Browser（登录/截图/点击）

---

## 技术标准

### 基础规范（始终生效）
- 遵循项目代码风格
- 优先异步非阻塞
- CLI 输入提示另起一行

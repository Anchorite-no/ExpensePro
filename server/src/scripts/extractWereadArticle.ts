import { spawnSync } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string }
  | { type: "code"; text: string }
  | { type: "list"; items: string[] }
  | { type: "image"; src: string; alt?: string };

type ArticlePayload = {
  title: string;
  author?: string;
  authorLine?: string;
  publishedAt?: string;
  sourceUrl?: string;
  currentUrl: string;
  sourceDocument: string;
  blocks: Block[];
};

const POWERSHELL = process.platform === "win32" ? "powershell.exe" : "powershell";
const START_CFT_SCRIPT = "C:\\Users\\anchorite\\.agent-browser\\start-cft-cdp.ps1";
const DEFAULT_OUTPUT_DIR = path.resolve(__dirname, "../../output/weread");
const EXTRACTION_RETRIES = 6;
const EXTRACTION_WAIT_MS = 1500;

function parseArgs(argv: string[]) {
  let url = "";
  let outputPath = "";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--output" || arg === "-o") {
      outputPath = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (!url) {
      url = arg;
    }
  }

  if (!url) {
    throw new Error(
      "Usage: npm run extract:weread -- <article-url> [--output <markdown-path>]",
    );
  }

  return { url, outputPath };
}

function runCommand(
  command: string,
  args: string[],
  options?: { input?: string; cwd?: string },
) {
  const result = spawnSync(command, args, {
    cwd: options?.cwd,
    input: options?.input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        result.stdout?.trim(),
        result.stderr?.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function ensureBrowserReady() {
  runCommand(POWERSHELL, [
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    START_CFT_SCRIPT,
  ]);
}

function runNpx(args: string[], input?: string) {
  if (process.platform === "win32") {
    return runCommand("cmd.exe", ["/d", "/s", "/c", "npx", ...args], {
      cwd: path.resolve(__dirname, "../.."),
      input,
    });
  }

  return runCommand("npx", args, {
    cwd: path.resolve(__dirname, "../.."),
    input,
  });
}

function runAgentBrowser(args: string[], input?: string) {
  return runNpx(["-y", "agent-browser", "--cdp", "9333", ...args], input);
}

function waitForPageReady() {
  runAgentBrowser(["wait", "--load", "networkidle"]);
  runAgentBrowser(["wait", String(EXTRACTION_WAIT_MS)]);
}

function evaluateInBrowser<T>(script: string): T {
  const { stdout } = runAgentBrowser(["eval", "--stdin"], script);
  return JSON.parse(stdout) as T;
}

function normalizeWhitespace(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function slugify(value: string) {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .trim();
  return cleaned || `weread-article-${Date.now()}`;
}

function isNoiseText(text: string, article: ArticlePayload) {
  if (!text) {
    return true;
  }

  const compact = text.replace(/\s+/g, "");
  const exactMatches = new Set(
    [
      article.title,
      article.author,
      article.authorLine,
      article.publishedAt,
      article.sourceUrl,
    ]
      .filter(Boolean)
      .map((item) => normalizeWhitespace(String(item)).replace(/\s+/g, "")),
  );

  if (exactMatches.has(compact)) {
    return true;
  }

  const patterns = [
    /^微信扫一扫/,
    /^手机扫码/,
    /^在手机上继续阅读/,
    /^暂无留言$/,
    /^写留言$/,
    /^阅读原文$/,
    /^继续滑动看下一个$/,
    /^原标题[:：]/,
    /^原文始发于微信公众号/,
    /^喜欢此内容的人还喜欢$/,
    /^预览时标签不可点$/,
    /^Datawhale干货$/,
    /^原创\s+/,
    /^作者[:：]\s*/,
    /^\d{4}年\d{1,2}月\d{1,2}日/,
    /^一起.?点赞/,
    /^因网络连接问题，剩余内容暂无法加载。?$/,
    /^分享$/,
    /^收藏$/,
    /^点赞$/,
    /^划线$/,
    /^转发$/,
    /^留言$/,
    /^投诉$/,
  ];

  return patterns.some((pattern) => pattern.test(text));
}

function enrichArticleMetadata(article: ArticlePayload): ArticlePayload {
  let author = article.author;
  let authorLine = article.authorLine;
  let publishedAt = article.publishedAt;

  for (const block of article.blocks.slice(0, 8)) {
    if (block.type !== "paragraph") {
      continue;
    }

    const text = normalizeWhitespace(block.text);
    const lines = text
      .split("\n")
      .map((line) => normalizeWhitespace(line))
      .filter(Boolean);

    if (!authorLine) {
      const originalLine = lines.find((line) => /^原创\s+/.test(line));
      if (originalLine) {
        authorLine = originalLine;
      }
    }

    if (!author) {
      const authorCandidate = lines.find((line) => /^作者[:：]\s*(.+)$/.test(line)) ?? text;
      const authorMatch = authorCandidate.match(/^作者[:：]\s*(.+)$/);
      if (authorMatch?.[1]) {
        author = normalizeWhitespace(authorMatch[1]);
      }
    }

    if (!publishedAt) {
      const timeSource =
        lines.find((line) =>
          /\d{4}年\d{1,2}月\d{1,2}日(?:\s+\d{1,2}:\d{2})?(?:\s+[^\s]+)?/.test(line),
        ) ?? text;
      const timeMatch = timeSource.match(
        /\d{4}年\d{1,2}月\d{1,2}日(?:\s+\d{1,2}:\d{2})?(?:\s+[^\s]+)?/,
      );
      if (timeMatch?.[0]) {
        publishedAt = normalizeWhitespace(timeMatch[0]);
      }
    }
  }

  return {
    ...article,
    author,
    authorLine,
    publishedAt,
  };
}

function cleanBlocks(article: ArticlePayload) {
  const seenText = new Set<string>();
  const seenImages = new Set<string>();
  const cleaned: Block[] = [];

  for (const [index, block] of article.blocks.entries()) {
    if (block.type === "image") {
      const src = normalizeWhitespace(block.src);
      if (!src || seenImages.has(src)) {
        continue;
      }
      seenImages.add(src);
      cleaned.push({
        type: "image",
        src,
        alt: block.alt ? normalizeWhitespace(block.alt) : undefined,
      });
      continue;
    }

    if (block.type === "list") {
      const items = block.items
        .map((item) => normalizeWhitespace(item))
        .filter((item) => !isNoiseText(item, article));

      if (items.length === 0) {
        continue;
      }

      const key = `list:${items.join("|")}`;
      if (seenText.has(key)) {
        continue;
      }
      seenText.add(key);
      cleaned.push({ type: "list", items });
      continue;
    }

    const text = normalizeWhitespace(block.text);
    const isLeadingMetadataBlock =
      index < 8 &&
      (((block.type === "heading" || block.type === "paragraph") &&
        article.title &&
        text.includes(article.title)) ||
        (block.type === "paragraph" &&
          ((article.authorLine && text.includes(article.authorLine)) ||
            (article.publishedAt && text.includes(article.publishedAt)) ||
            /^作者[:：]\s*/.test(text) ||
            /^原创\s+/.test(text))));

    if (isLeadingMetadataBlock) {
      continue;
    }

    if (isNoiseText(text, article)) {
      continue;
    }

    const key = `${block.type}:${text}`;
    if (seenText.has(key)) {
      continue;
    }

    seenText.add(key);

    if (block.type === "heading") {
      cleaned.push({
        type: "heading",
        level: Math.min(Math.max(block.level, 2), 6),
        text,
      });
      continue;
    }

    cleaned.push({ ...block, text });
  }

  return cleaned;
}

function renderMarkdown(article: ArticlePayload) {
  const enriched = enrichArticleMetadata(article);
  const lines: string[] = [];

  lines.push(`# ${enriched.title}`);
  lines.push("");

  if (enriched.author) {
    lines.push(`- 作者：${enriched.author}`);
  } else if (enriched.authorLine) {
    lines.push(`- 作者：${enriched.authorLine}`);
  }

  if (enriched.publishedAt) {
    lines.push(`- 时间：${enriched.publishedAt}`);
  }

  lines.push(`- 抓取链接：${enriched.currentUrl}`);

  if (enriched.sourceUrl && enriched.sourceUrl !== enriched.currentUrl) {
    lines.push(`- 原始链接：${enriched.sourceUrl}`);
  }

  lines.push(`- 抓取来源：${enriched.sourceDocument}`);
  lines.push("");

  const blocks = cleanBlocks(enriched);

  for (const block of blocks) {
    if (block.type === "heading") {
      lines.push(`${"#".repeat(block.level)} ${block.text}`);
      lines.push("");
      continue;
    }

    if (block.type === "paragraph") {
      lines.push(block.text);
      lines.push("");
      continue;
    }

    if (block.type === "quote") {
      lines.push(...block.text.split("\n").map((line) => `> ${line}`));
      lines.push("");
      continue;
    }

    if (block.type === "code") {
      lines.push("```text");
      lines.push(block.text);
      lines.push("```");
      lines.push("");
      continue;
    }

    if (block.type === "list") {
      lines.push(...block.items.map((item) => `- ${item}`));
      lines.push("");
      continue;
    }

    const alt = block.alt ? block.alt.replace(/\n+/g, " ") : "图片";
    lines.push(`![${alt}](${block.src})`);
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

function buildOutputPath(article: ArticlePayload, preferredPath?: string) {
  if (preferredPath) {
    return path.resolve(preferredPath);
  }

  mkdirSync(DEFAULT_OUTPUT_DIR, { recursive: true });
  return path.join(DEFAULT_OUTPUT_DIR, `${slugify(article.title)}.md`);
}

function extractArticlePayload(): ArticlePayload {
  const extractionScript = String.raw`
(() => {
  const inlineTags = new Set([
    "A",
    "ABBR",
    "B",
    "CODE",
    "DEL",
    "EM",
    "I",
    "INS",
    "LABEL",
    "MARK",
    "S",
    "SMALL",
    "SPAN",
    "STRONG",
    "SUB",
    "SUP",
    "TIME",
    "U",
  ]);

  const skipTags = new Set([
    "BUTTON",
    "INPUT",
    "NOSCRIPT",
    "SCRIPT",
    "STYLE",
    "SVG",
    "TEXTAREA",
    "TEMPLATE",
  ]);

  function normalize(text) {
    return (text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function isVisible(element) {
    if (!element || !(element instanceof Element)) {
      return false;
    }

    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function getDocuments() {
    const docs = [{ label: "main-document", doc: document }];
    const frames = Array.from(document.querySelectorAll("iframe"));

    frames.forEach((frame, index) => {
      try {
        const frameDoc = frame.contentDocument;
        if (frameDoc && frameDoc.body) {
          docs.push({ label: "iframe-" + index, doc: frameDoc });
        }
      } catch (error) {
        // Ignore cross-origin frames.
      }
    });

    return docs;
  }
  function pickRoot(doc) {
    const selectors = [
      "article",
      "main",
      ".rich_media_content",
      ".rich_media_area_primary",
      ".readerChapterContent",
      ".renderTargetContainer",
      ".app_content",
      ".content",
    ];

    let best = doc.body;
    let bestScore = 0;

    selectors.forEach((selector) => {
      const nodes = Array.from(doc.querySelectorAll(selector));
      nodes.forEach((node) => {
        if (!(node instanceof HTMLElement) || !isVisible(node)) {
          return;
        }
        const score = normalize(node.innerText).length + node.querySelectorAll("img").length * 24;
        if (score > bestScore) {
          best = node;
          bestScore = score;
        }
      });
    });

    return best || doc.body;
  }

  function chooseText(element) {
    return normalize(element.innerText || element.textContent || "");
  }

  function leafLike(element) {
    const childElements = Array.from(element.children).filter((child) => child instanceof HTMLElement);
    if (childElements.length === 0) {
      return true;
    }

    return childElements.every((child) => {
      if (!(child instanceof HTMLElement)) {
        return true;
      }
      const tag = child.tagName.toUpperCase();
      return inlineTags.has(tag) || tag === "IMG" || tag === "BR";
    });
  }

  function resolveImageSrc(element) {
    const candidates = [
      element.getAttribute("src"),
      element.getAttribute("data-src"),
      element.getAttribute("data-original"),
      element.getAttribute("data-url"),
      element.currentSrc,
    ];

    return candidates.find((item) => item && !item.startsWith("data:")) || "";
  }

  function walk(node, blocks, seen) {
    if (!(node instanceof HTMLElement) || !isVisible(node)) {
      return;
    }

    const tag = node.tagName.toUpperCase();
    if (skipTags.has(tag)) {
      return;
    }

    if (tag === "IMG") {
      const src = resolveImageSrc(node);
      if (src && !seen.images.has(src)) {
        seen.images.add(src);
        blocks.push({
          type: "image",
          src,
          alt: normalize(node.getAttribute("alt") || node.getAttribute("title") || ""),
        });
      }
      return;
    }

    if (/^H[1-6]$/.test(tag)) {
      const text = chooseText(node);
      if (text) {
        blocks.push({
          type: "heading",
          level: Number(tag.slice(1)),
          text,
        });
      }
      return;
    }

    if (tag === "BLOCKQUOTE") {
      const text = chooseText(node);
      if (text) {
        blocks.push({ type: "quote", text });
      }
      return;
    }

    if (tag === "PRE") {
      const text = normalize(node.textContent || "");
      if (text) {
        blocks.push({ type: "code", text });
      }
      return;
    }

    if (tag === "UL" || tag === "OL") {
      const items = Array.from(node.querySelectorAll(":scope > li"))
        .map((item) => chooseText(item))
        .filter(Boolean);
      if (items.length > 0) {
        blocks.push({ type: "list", items });
        return;
      }
    }

    if (leafLike(node)) {
      const text = chooseText(node);
      if (text && !seen.text.has(text)) {
        seen.text.add(text);
        blocks.push({ type: "paragraph", text });
      }

      Array.from(node.querySelectorAll(":scope > img")).forEach((image) => walk(image, blocks, seen));
      return;
    }

    Array.from(node.children).forEach((child) => walk(child, blocks, seen));
  }

  function firstText(doc, selectors) {
    for (const selector of selectors) {
      const node = doc.querySelector(selector);
      if (node instanceof HTMLElement) {
        const text = chooseText(node);
        if (text) {
          return text;
        }
      }
    }
    return "";
  }

  const topMeta = {
    sourceUrl:
      document.querySelector('meta[property="og:url"]')?.getAttribute("content") ||
      document.querySelector('link[rel="canonical"]')?.getAttribute("href") ||
      "",
    author:
      document.querySelector('meta[name="author"]')?.getAttribute("content") ||
      "",
  };

  function extractFromDoc(entry) {
    const root = pickRoot(entry.doc);
    const blocks = [];
    const seen = { text: new Set(), images: new Set() };
    walk(root, blocks, seen);

    if (blocks.length === 0) {
      const fallbackParagraphs = normalize(root.innerText || "")
        .split(/\n{2,}/)
        .map((item) => normalize(item))
        .filter(Boolean);

      fallbackParagraphs.forEach((text) => {
        blocks.push({ type: "paragraph", text });
      });

      Array.from(root.querySelectorAll("img")).forEach((image) => walk(image, blocks, seen));
    }

    const title =
      firstText(entry.doc, ["h1", ".title", ".rich_media_title"]) ||
      entry.doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
      entry.doc.title ||
      document.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
      document.title ||
      "未命名文章";

    const authorLine = firstText(entry.doc, [
      ".author",
      ".wx_mp_author",
      ".rich_media_meta_text",
      '[class*="author"]',
    ]);

    const publishedAt = firstText(entry.doc, [
      "time",
      ".publish_time",
      ".time",
      '[class*="publish"]',
      '[class*="time"]',
    ]);

    const paragraphCount = blocks.filter((block) => block.type === "paragraph").length;
    const textScore = blocks.reduce((total, block) => {
      if (block.type === "list") {
        return total + block.items.join(" ").length;
      }
      if ("text" in block) {
        return total + block.text.length;
      }
      return total;
    }, 0);
    const imageCount = blocks.filter((block) => block.type === "image").length;

    return {
      entry,
      blocks,
      title: normalize(title),
      author:
        normalize(
          entry.doc.querySelector('meta[name="author"]')?.getAttribute("content") ||
            topMeta.author ||
            "",
        ) || undefined,
      authorLine: normalize(authorLine) || undefined,
      publishedAt: normalize(publishedAt) || undefined,
      sourceUrl:
        normalize(
          entry.doc.querySelector('meta[property="og:url"]')?.getAttribute("content") ||
            entry.doc.querySelector('link[rel="canonical"]')?.getAttribute("href") ||
            topMeta.sourceUrl,
        ) || undefined,
      paragraphCount,
      textScore,
      imageCount,
    };
  }

  const chosen = getDocuments()
    .map((entry) => extractFromDoc(entry))
    .sort((left, right) => {
      const leftScore = left.paragraphCount * 20 + left.imageCount * 10 + left.textScore;
      const rightScore = right.paragraphCount * 20 + right.imageCount * 10 + right.textScore;
      return rightScore - leftScore;
    })[0];

  return {
    title: chosen.title,
    author: chosen.author,
    authorLine: chosen.authorLine,
    publishedAt: chosen.publishedAt,
    sourceUrl: chosen.sourceUrl,
    currentUrl: location.href,
    sourceDocument: chosen.entry.label,
    blocks: chosen.blocks,
  };
})()
`;

  let latest: ArticlePayload | null = null;

  for (let attempt = 1; attempt <= EXTRACTION_RETRIES; attempt += 1) {
    latest = evaluateInBrowser<ArticlePayload>(extractionScript);

    const paragraphCount = latest.blocks.filter((block) => block.type === "paragraph").length;
    if (latest.blocks.length >= 6 && paragraphCount >= 3) {
      return latest;
    }

    if (attempt < EXTRACTION_RETRIES) {
      runAgentBrowser(["wait", String(EXTRACTION_WAIT_MS)]);
    }
  }

  if (!latest) {
    throw new Error("Failed to extract article content from the browser.");
  }

  return latest;
}

function main() {
  const { url, outputPath } = parseArgs(process.argv.slice(2));

  ensureBrowserReady();
  runAgentBrowser(["open", url]);
  waitForPageReady();

  const article = extractArticlePayload();
  const markdown = renderMarkdown(article);
  const targetPath = buildOutputPath(article, outputPath);

  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, markdown, "utf8");

  console.log(`Saved Markdown to ${targetPath}`);
  console.log(`Title: ${article.title}`);
  console.log(`Source document: ${article.sourceDocument}`);
  console.log(`Blocks extracted: ${article.blocks.length}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}

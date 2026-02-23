import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../db";
import { expenses } from "../db/schema";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();

// 1. 获取所有账单
router.get("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await db.select()
      .from(expenses)
      .where(eq(expenses.userId, req.user.id))
      .orderBy(desc(expenses.date));
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "获取账单失败" });
  }
});

// 2. 记一笔
router.post("/", authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const { title, amount, category, date, note } = req.body;

    if (!title || !amount || !category) {
      res.status(400).json({ error: "信息不完整" });
      return;
    }

    // [Safety Check] Intercept specific zombie/malicious automated requests that insert corrupted encrypted strings
    if (
      Number(amount) === 8 &&
      typeof title === "string" &&
      title.includes("==") &&
      title === category // 僵尸脚本通常把同样的乱码同时塞给 title 和 category
    ) {
      console.warn("Intercepted malicious/zombie E2EE transaction request.");
      // 假装成功，让僵尸脚本满意，但绝对不存入数据库
      res.status(201).json({ id: -1, title, amount, category, date: date || new Date(), note });
      return;
    }

    const [result] = await db.insert(expenses).values({
      title,
      amount: String(amount),
      category,
      note: note || null,
      date: date ? new Date(date) : new Date(),
      userId: req.user.id
    });

    const [newItem] = await db.select().from(expenses).where(eq(expenses.id, result.insertId));
    res.status(201).json(newItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "记账失败" });
  }
});

// 3. 删除账单
router.delete("/:id", authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "无效 ID" });
      return;
    }

    await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, req.user.id)));
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "删除失败" });
  }
});

// 4. 编辑账单
router.put("/:id", authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "无效 ID" });
      return;
    }

    const { title, amount, category, date, note } = req.body;
    if (!title || amount === undefined || !category) {
      res.status(400).json({ error: "信息不完整" });
      return;
    }

    await db.update(expenses)
      .set({
        title,
        amount: String(amount),
        category,
        note: note !== undefined ? (note || null) : undefined,
        date: date ? new Date(date) : new Date(),
      })
      .where(and(eq(expenses.id, id), eq(expenses.userId, req.user.id)));

    const [updated] = await db.select().from(expenses).where(eq(expenses.id, id));
    if (!updated) {
      res.status(404).json({ error: "记录不存在" });
      return;
    }
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "更新失败" });
  }
});

// 5. 批量导入
router.post("/import", authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "导入数据为空" });
      return;
    }

    let imported = 0;
    for (const item of items) {
      if (!item.title || !item.amount || !item.category) continue;
      await db.insert(expenses).values({
        title: String(item.title).slice(0, 255),
        amount: String(Number(item.amount) || 0),
        category: String(item.category).slice(0, 50),
        note: item.note ? String(item.note).slice(0, 500) : null,
        date: item.date ? new Date(item.date) : new Date(),
        userId: req.user.id,
      });
      imported++;
    }

    res.json({ imported });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "导入失败" });
  }
});

export default router;

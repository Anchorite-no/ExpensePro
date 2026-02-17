import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { userSettings } from "../db/schema";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();

// 获取用户设置
router.get("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const [setting] = await db.select().from(userSettings).where(eq(userSettings.userId, req.user.id));
    res.json(setting || { aiApiKey: "", aiModel: "", currency: "", categories: "", budgetConfig: "" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "获取设置失败" });
  }
});

// 更新用户设置
router.put("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { aiApiKey, aiModel, currency, categories, budgetConfig } = req.body;
    const [existing] = await db.select().from(userSettings).where(eq(userSettings.userId, req.user.id));

    if (existing) {
      const updates: any = {};
      if (aiApiKey !== undefined) updates.aiApiKey = aiApiKey;
      if (aiModel !== undefined) updates.aiModel = aiModel;
      if (currency !== undefined) updates.currency = currency;
      if (categories !== undefined) updates.categories = typeof categories === 'string' ? categories : JSON.stringify(categories);
      if (budgetConfig !== undefined) updates.budgetConfig = typeof budgetConfig === 'string' ? budgetConfig : JSON.stringify(budgetConfig);
      await db.update(userSettings).set(updates).where(eq(userSettings.userId, req.user.id));
    } else {
      await db.insert(userSettings).values({
        userId: req.user.id,
        aiApiKey: aiApiKey || "",
        aiModel: aiModel || "gemini-2.0-flash",
        currency: currency || "¥",
        categories: categories ? (typeof categories === 'string' ? categories : JSON.stringify(categories)) : "",
        budgetConfig: budgetConfig ? (typeof budgetConfig === 'string' ? budgetConfig : JSON.stringify(budgetConfig)) : "",
      });
    }

    const [updated] = await db.select().from(userSettings).where(eq(userSettings.userId, req.user.id));
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "保存设置失败" });
  }
});

export default router;

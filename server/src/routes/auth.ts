import express, { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, userSettings, expenses } from "../db/schema";
import { generateMasterKey, generateSalt, deriveKeyFromPassword, encryptMasterKey } from "../crypto";
import { isNull } from "drizzle-orm";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-it";
const INVITE_CODE = process.env.INVITE_CODE || "";
const ENCRYPTION_ENABLED = process.env.ENCRYPTION_ENABLED === "true";

// 公共配置端点 (无需认证)
router.get("/config", (_req, res) => {
  res.json({
    requireInvite: !!INVITE_CODE,
    encryption: ENCRYPTION_ENABLED,
  });
});

router.post("/register", async (req: any, res: any) => {
  try {
    const { username, password, inviteCode } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "请输入用户名和密码" });
      return;
    }

    // 邀请码校验
    if (INVITE_CODE && inviteCode !== INVITE_CODE) {
      res.status(403).json({ error: "邀请码无效" });
      return;
    }

    // 密码强度校验：至少8位，包含至少两种字符类型
    if (password.length < 8) {
      res.status(400).json({ error: "密码长度至少需要 8 位" });
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);

    if ([hasLetter, hasNumber, hasSpecial].filter(Boolean).length < 2) {
      res.status(400).json({ error: "密码必须包含至少两种类型的字符（字母、数字、符号）" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 先查询用户名是否已存在
    const existingUser = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existingUser.length > 0) {
      res.status(409).json({ error: "该用户名已被注册" });
      return;
    }

    const existingUsers = await db.select().from(users).limit(1);
    const isFirstUser = existingUsers.length === 0;

    try {
      await db.transaction(async (tx) => {
        const [result] = await tx.insert(users).values({
          username,
          password: hashedPassword,
        });

        const newUserId = result.insertId;

        // 如果启用加密，为新用户生成 Master Key
        if (ENCRYPTION_ENABLED) {
          const masterKey = generateMasterKey();
          const salt = generateSalt();
          const passwordKey = deriveKeyFromPassword(password, salt);
          const encMasterKey = encryptMasterKey(masterKey, passwordKey);

          await tx.insert(userSettings).values({
            userId: newUserId,
            encryptedMasterKey: encMasterKey,
            masterKeySalt: salt,
          });
        }

        if (isFirstUser) {
          console.log(`First user registered (ID: ${newUserId}). Migrating legacy expenses...`);
          await tx.update(expenses)
            .set({ userId: newUserId })
            .where(isNull(expenses.userId));
        }
      });

      res.status(201).json({ message: "注册成功" });
    } catch (dbError: any) {
      if (dbError.code === 'ER_DUP_ENTRY' || dbError.errno === 1062 || (dbError.message && dbError.message.includes('Duplicate'))) {
        res.status(409).json({ error: "该用户名已被注册" });
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "注册失败，请稍后重试" });
  }
});

router.post("/login", async (req: any, res: any) => {
  try {
    const { username, password } = req.body;
    const [user] = await db.select().from(users).where(eq(users.username, username));

    if (!user) {
      res.status(401).json({ error: "用户名或密码错误" });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(401).json({ error: "用户名或密码错误" });
      return;
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });

    // 如果启用加密，返回加密的 Master Key 和 salt
    const response: any = { token, username: user.username };
    if (ENCRYPTION_ENABLED) {
      const [setting] = await db.select().from(userSettings).where(eq(userSettings.userId, user.id));
      if (setting?.encryptedMasterKey && setting?.masterKeySalt) {
        response.encryptedMasterKey = setting.encryptedMasterKey;
        response.masterKeySalt = setting.masterKeySalt;
      }
      response.encryption = true;
    }

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "登录失败，请稍后重试" });
  }
});

export default router;

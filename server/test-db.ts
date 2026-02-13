
import { db } from "./src/db";
import { expenses } from "./src/db/schema";
import { desc } from "drizzle-orm";

async function testBackend() {
  console.log("🔍 开始测试数据库连接...");

  try {
    // 1. 尝试插入一条数据
    console.log("👉 正在尝试写入数据...");
    const [result] = await db.insert(expenses).values({
      title: "测试消费-脚本自动生成",
      amount: "10.00",
      category: "测试",
      date: new Date()
    });
    console.log("✅ 写入成功! InsertId:", result.insertId);

    // 2. 尝试查询数据
    console.log("👉 正在查询刚刚写入的数据...");
    const list = await db.select().from(expenses).orderBy(desc(expenses.date)).limit(1);
    console.log("✅ 查询成功! 最新一条:", list[0]);

    console.log("\n🎉 结论: 后端数据库功能正常！");
  } catch (err) {
    console.error("\n❌ 错误: 数据库操作失败", err);
  }
  process.exit(0);
}

testBackend();

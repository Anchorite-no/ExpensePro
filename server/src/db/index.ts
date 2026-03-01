import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

// dotenv.config() 已在入口 index.ts 最顶部调用，此处无需重复

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in .env");
}

const pool = mysql.createPool(process.env.DATABASE_URL);
export const db = drizzle(pool);

import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

// db 是最早被 import 的模块，在此加载 .env 确保全局可用
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in .env");
}

const pool = mysql.createPool(process.env.DATABASE_URL);
export const db = drizzle(pool);

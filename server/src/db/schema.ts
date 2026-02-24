import { mysqlTable, int, varchar, timestamp, decimal, text } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const expenses = mysqlTable('expense', {
  id: int('id').primaryKey().autoincrement(),
  title: varchar('title', { length: 255 }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  note: varchar('note', { length: 500 }),
  date: timestamp('date').defaultNow(),
  userId: int('user_id'),
});

export const userSettings = mysqlTable('user_settings', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull().unique(),
  aiApiKey: text('ai_api_key'),
  aiModel: varchar('ai_model', { length: 100 }),
  currency: varchar('currency', { length: 10 }),
  categories: text('categories'),
  budgetConfig: text('budget_config'),
  encryptedMasterKey: text('encrypted_master_key'),
  masterKeySalt: varchar('master_key_salt', { length: 100 }),
  tags: text('tags'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

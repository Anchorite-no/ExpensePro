/*
  Warnings:

  - You are about to drop the column `completed` on the `todo` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `todo` DROP COLUMN `completed`,
    ADD COLUMN `done` BOOLEAN NOT NULL DEFAULT false;

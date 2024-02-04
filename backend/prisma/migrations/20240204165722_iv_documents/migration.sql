/*
  Warnings:

  - Added the required column `iv` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "iv" TEXT NOT NULL;

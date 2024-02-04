/*
  Warnings:

  - A unique constraint covering the columns `[userId,documentId]` on the table `SharedDocument` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SharedDocument_userId_documentId_key" ON "SharedDocument"("userId", "documentId");

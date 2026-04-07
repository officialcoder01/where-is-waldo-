/*
  Warnings:

  - A unique constraint covering the columns `[sid]` on the table `Session` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sid` to the `Session` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "sid" TEXT NOT NULL,
ALTER COLUMN "data" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Session_sid_key" ON "Session"("sid");

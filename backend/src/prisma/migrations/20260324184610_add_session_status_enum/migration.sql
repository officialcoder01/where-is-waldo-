/*
  Warnings:

  - You are about to drop the column `completed` on the `GameSession` table. All the data in the column will be lost.
  - Added the required column `expiredAt` to the `GameSession` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED');

-- AlterTable
ALTER TABLE "GameSession" DROP COLUMN "completed",
ADD COLUMN     "expiredAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE';

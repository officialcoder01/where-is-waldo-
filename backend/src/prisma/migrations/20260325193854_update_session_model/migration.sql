/*
  Warnings:

  - You are about to drop the column `expire` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `sess` on the `Session` table. All the data in the column will be lost.
  - Added the required column `data` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expiresAt` to the `Session` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Session" DROP COLUMN "expire",
DROP COLUMN "sess",
ADD COLUMN     "data" JSONB NOT NULL,
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL;

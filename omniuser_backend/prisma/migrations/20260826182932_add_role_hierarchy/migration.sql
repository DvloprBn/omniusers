-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "max_count" INTEGER;

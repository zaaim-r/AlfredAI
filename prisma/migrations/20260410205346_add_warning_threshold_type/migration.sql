-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "warning_threshold_type" TEXT NOT NULL DEFAULT 'percent',
ALTER COLUMN "warning_threshold" SET DEFAULT 80,
ALTER COLUMN "warning_threshold" SET DATA TYPE DECIMAL(12,2);

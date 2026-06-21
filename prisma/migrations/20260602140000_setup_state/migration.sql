-- CreateTable
CREATE TABLE IF NOT EXISTS "central"."setup_state" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "completedAt" TIMESTAMP(3),
    "adminUserId" TEXT,
    "installVersion" TEXT,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "setup_state_pkey" PRIMARY KEY ("id")
);

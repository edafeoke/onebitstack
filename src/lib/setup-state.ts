import { prisma } from "@/lib/prisma";

const SETUP_ID = "default";

function isMissingSetupTable(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2021"
  );
}

export async function getSetupState() {
  try {
    return await prisma.setupState.findUnique({ where: { id: SETUP_ID } });
  } catch (error) {
    if (isMissingSetupTable(error)) return null;
    throw error;
  }
}

export async function isSetupCompleted(): Promise<boolean> {
  const row = await getSetupState();
  return row?.completedAt != null;
}

export async function markSetupCompleted(adminUserId: string, installVersion?: string) {
  await prisma.setupState.upsert({
    where: { id: SETUP_ID },
    create: {
      id: SETUP_ID,
      completedAt: new Date(),
      adminUserId,
      installVersion: installVersion ?? null
    },
    update: {
      completedAt: new Date(),
      adminUserId,
      installVersion: installVersion ?? undefined
    }
  });
}

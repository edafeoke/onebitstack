import { getPrisma, isSqliteReadonlyDbMoved, reconnectPrisma } from "@/lib/prisma";

/** Serialize log writes per deployment — SSH stdout/stderr arrive concurrently. */
const writeQueues = new Map<string, Promise<void>>();

function isUniqueSeqError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

async function appendDeploymentLogLineOnce(deploymentId: string, line: string): Promise<void> {
  const maxAttempts = 8;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const prisma = getPrisma();
      const agg = await prisma.deploymentLogChunk.aggregate({
        where: { deploymentId },
        _max: { seq: true }
      });
      const seq = (agg._max.seq ?? 0) + 1;
      await prisma.deploymentLogChunk.create({
        data: { deploymentId, seq, line }
      });
      return;
    } catch (err) {
      if (isSqliteReadonlyDbMoved(err) && attempt < 2) {
        await reconnectPrisma();
        continue;
      }
      if (isUniqueSeqError(err) && attempt < maxAttempts - 1) {
        continue;
      }
      throw err;
    }
  }
}

export async function appendDeploymentLogLine(
  deploymentId: string,
  line: string
): Promise<void> {
  const prev = writeQueues.get(deploymentId) ?? Promise.resolve();
  const next = prev
    .then(() => appendDeploymentLogLineOnce(deploymentId, line))
    .catch((err) => {
      console.error("[deployment-log]", deploymentId, err);
    });
  writeQueues.set(deploymentId, next);
  await next;
  if (writeQueues.get(deploymentId) === next) {
    writeQueues.delete(deploymentId);
  }
}

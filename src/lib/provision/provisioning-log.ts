import { prisma } from "@/lib/prisma";

const writeQueues = new Map<string, Promise<void>>();

function isUniqueSeqError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

async function appendProvisioningLogLineOnce(
  provisioningRunId: string,
  line: string
): Promise<void> {
  const maxAttempts = 8;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const agg = await prisma.provisioningLogChunk.aggregate({
        where: { provisioningRunId },
        _max: { seq: true }
      });
      const seq = (agg._max.seq ?? 0) + 1;
      await prisma.provisioningLogChunk.create({
        data: { provisioningRunId, seq, line }
      });
      return;
    } catch (err) {
      if (isUniqueSeqError(err) && attempt < maxAttempts - 1) {
        continue;
      }
      throw err;
    }
  }
}

export async function appendProvisioningLogLine(
  provisioningRunId: string,
  line: string
): Promise<void> {
  const prev = writeQueues.get(provisioningRunId) ?? Promise.resolve();
  const next = prev
    .then(() => appendProvisioningLogLineOnce(provisioningRunId, line))
    .catch((err) => {
      console.error("[provisioning-log]", provisioningRunId, err);
    });
  writeQueues.set(provisioningRunId, next);
  await next;
  if (writeQueues.get(provisioningRunId) === next) {
    writeQueues.delete(provisioningRunId);
  }
}

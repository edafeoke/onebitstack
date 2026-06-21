import "dotenv/config";
import { prisma } from "../src/lib/prisma";

/**
 * Set PLATFORM_ADMIN_EMAIL to promote a user after sign-up or sign-in (idempotent).
 * Works with email/password or GitHub OAuth.
 */
async function main() {
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL?.trim();
  if (adminEmail) {
    const result = await prisma.user.updateMany({
      where: { email: adminEmail },
      data: { role: "admin" }
    });
    if (result.count > 0) {
      console.log(`Promoted ${adminEmail} to platform admin.`);
    } else {
      console.log(
        `PLATFORM_ADMIN_EMAIL=${adminEmail} — no matching user yet. Sign up or sign in, then re-run seed.`
      );
    }
    return;
  }

  const count = await prisma.user.count();
  if (count > 0) {
    console.log("Seed skipped: users already exist. Set PLATFORM_ADMIN_EMAIL to promote an admin.");
    return;
  }
  console.log(
    "No users in database. Sign up at /signup (or sign in with GitHub), then set PLATFORM_ADMIN_EMAIL and re-run seed."
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

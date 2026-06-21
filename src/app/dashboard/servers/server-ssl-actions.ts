"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  canPerformDestructiveOps,
  PERMISSION_DENIED_DESTRUCTIVE
} from "@/lib/auth/permissions";
import { serversAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";
import { withSshSession } from "@/lib/deploy/ssh-session";
import { deployTargetForServer } from "@/lib/server-ssh-target";
import { centralSslCertPath, centralSslKeyPath } from "@/lib/server-layout";
import { normalizeHostname } from "@/lib/nginx/domains";
import { buildCertbotNginxScript, buildCertbotRenewScript } from "@/lib/nginx/ssl-certbot";
import { parseOpenSslOutput } from "@/lib/server-ssl/not-after";
import {
  extractPemCertificate,
  extractPemPrivateKey,
  looksLikePemCertificate,
  looksLikePemPrivateKey
} from "@/lib/server-ssl/pem";

const idSchema = z.object({ serverId: z.string().min(1) });

const pathsSchema = z.object({
  serverId: z.string().min(1),
  tlsCertPath: z.string().min(1).max(2048),
  tlsKeyPath: z.string().min(1).max(2048)
});

const certbotSchema = z.object({
  serverId: z.string().min(1),
  email: z.string().email().max(320),
  hostnames: z.array(z.string().min(1).max(253)).min(1).max(32),
  tlsCertPath: z.string().min(1).max(2048).optional(),
  tlsKeyPath: z.string().min(1).max(2048).optional()
});

async function persistTlsCertNotAfter(
  serverId: string,
  opensslOutput: string
): Promise<void> {
  const notAfter = parseOpenSslOutput(opensslOutput);
  await prisma.server.update({
    where: { id: serverId },
    data: { tlsCertNotAfter: notAfter }
  });
}

const uploadSchema = z.object({
  serverId: z.string().min(1),
  certPem: z.string().min(1).max(256_000),
  keyPem: z.string().min(1).max(256_000),
  tlsCertPath: z.string().min(1).max(2048).optional(),
  tlsKeyPath: z.string().min(1).max(2048).optional()
});

export type SslCandidate = {
  certPath: string;
  keyPath: string | null;
  label: string;
};

export async function detectSslFilesAction(
  input: unknown
): Promise<{ ok: true; candidates: SslCandidate[] } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };

  const ctx = await deployTargetForServer(parsed.data.serverId, session.user.id);
  if (!ctx) return { ok: false, message: "Server not found" };

  const script = `
set +e
for d in /etc/letsencrypt/live/*; do
  [ -f "$d/fullchain.pem" ] && echo "LE|$d/fullchain.pem|$d/privkey.pem|Let's Encrypt $(basename "$d")"
done
for f in /etc/ssl/certs/*.pem /etc/nginx/ssl/*.pem; do
  [ -f "$f" ] && echo "PEM|$f||$f"
done
`.trim();

  const raw = await withSshSession(ctx.target, undefined, undefined, async (ssh) =>
    ssh.execCapture(`bash -lc ${bashQ(script)}`)
  );

  const candidates: SslCandidate[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const [kind, cert, key, label] = line.split("|");
    if (!cert) continue;
    candidates.push({
      certPath: cert,
      keyPath: key || null,
      label: label || cert
    });
    if (kind === "LE" && cert && key) {
      // already paired
    }
  }

  return { ok: true, candidates };
}

export async function verifySslPathsAction(
  input: unknown
): Promise<
  | { ok: true; valid: boolean; notAfter: string | null; subject: string | null }
  | { ok: false; message: string }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };
  const parsed = pathsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Cert and key paths are required." };

  const ctx = await deployTargetForServer(parsed.data.serverId, session.user.id);
  if (!ctx) return { ok: false, message: "Server not found" };
  if (!(await canPerformDestructiveOps(session.user.id, ctx.server.organizationId))) {
    return { ok: false, message: PERMISSION_DENIED_DESTRUCTIVE };
  }

  const cert = parsed.data.tlsCertPath.trim();
  const key = parsed.data.tlsKeyPath.trim();
  const script = `
set -e
CERT=${bashQ(cert)}
KEY=${bashQ(key)}
test -f "$CERT" && test -f "$KEY"
openssl x509 -in "$CERT" -noout -subject -enddate 2>/dev/null
`.trim();

  try {
    const out = await withSshSession(ctx.target, undefined, undefined, async (ssh) =>
      ssh.execCapture(`bash -lc ${bashQ(script)}`)
    );
    let notAfter: string | null = null;
    let subject: string | null = null;
    for (const line of out.split("\n")) {
      if (line.startsWith("notAfter=")) notAfter = line.replace("notAfter=", "").trim();
      if (line.startsWith("subject=")) subject = line.replace("subject=", "").trim();
    }
    if (await canPerformDestructiveOps(session.user.id, ctx.server.organizationId)) {
      await prisma.server.update({
        where: { id: ctx.server.id },
        data: { tlsCertPath: cert, tlsKeyPath: key }
      });
      await persistTlsCertNotAfter(ctx.server.id, out);
      revalidatePath(`/dashboard/servers/${ctx.server.id}`);
      revalidatePath(`/dashboard/servers/${ctx.server.id}/edit`);
      revalidatePath("/dashboard");
    }
    return { ok: true, valid: true, notAfter, subject };
  } catch {
    return { ok: true, valid: false, notAfter: null, subject: null };
  }
}

export async function saveTlsPathsAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };
  const parsed = pathsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid paths" };

  const server = await prisma.server.findFirst({
    where: { id: parsed.data.serverId, ...serversAccessibleWhere(session.user.id) }
  });
  if (!server) return { ok: false, message: "Server not found" };
  if (!(await canPerformDestructiveOps(session.user.id, server.organizationId))) {
    return { ok: false, message: PERMISSION_DENIED_DESTRUCTIVE };
  }

  await prisma.server.update({
    where: { id: server.id },
    data: {
      tlsCertPath: parsed.data.tlsCertPath.trim(),
      tlsKeyPath: parsed.data.tlsKeyPath.trim()
    }
  });
  revalidatePath(`/dashboard/servers/${server.id}`);
  revalidatePath(`/dashboard/servers/${server.id}/edit`);
  return { ok: true };
}

export async function uploadSslFilesAction(
  input: unknown
): Promise<{ ok: true; tlsCertPath: string; tlsKeyPath: string } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };
  const parsed = uploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid certificate upload" };

  const cert = extractPemCertificate(parsed.data.certPem);
  const key = extractPemPrivateKey(parsed.data.keyPem);
  if (!cert || !looksLikePemCertificate(cert)) {
    return { ok: false, message: "Certificate must be PEM (-----BEGIN CERTIFICATE-----)." };
  }
  if (!key || !looksLikePemPrivateKey(key)) {
    return { ok: false, message: "Private key must be PEM format." };
  }

  const ctx = await deployTargetForServer(parsed.data.serverId, session.user.id);
  if (!ctx) return { ok: false, message: "Server not found" };
  if (!(await canPerformDestructiveOps(session.user.id, ctx.server.organizationId))) {
    return { ok: false, message: PERMISSION_DENIED_DESTRUCTIVE };
  }

  const slug = ctx.server.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "server";
  const certPath =
    parsed.data.tlsCertPath?.trim() || centralSslCertPath(ctx.target.deployRoot, slug);
  const keyPath =
    parsed.data.tlsKeyPath?.trim() || centralSslKeyPath(ctx.target.deployRoot, slug);

  await withSshSession(ctx.target, undefined, undefined, async (ssh) => {
    await ssh.exec(`mkdir -p $(dirname ${bashQ(certPath)})`);
    await ssh.writeFile(certPath, `${cert}\n`);
    await ssh.writeFile(keyPath, `${key}\n`);
    await ssh.execCapture(
      `openssl x509 -in ${bashQ(certPath)} -noout 2>/dev/null || (echo invalid cert >&2; exit 1)`
    );
  });

  await prisma.server.update({
    where: { id: ctx.server.id },
    data: { tlsCertPath: certPath, tlsKeyPath: keyPath }
  });
  revalidatePath(`/dashboard/servers/${ctx.server.id}`);
  revalidatePath(`/dashboard/servers/${ctx.server.id}/edit`);
  return { ok: true, tlsCertPath: certPath, tlsKeyPath: keyPath };
}

export async function listServerHostnamesAction(
  input: unknown
): Promise<{ ok: true; hostnames: string[] } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };

  const server = await prisma.server.findFirst({
    where: { id: parsed.data.serverId, ...serversAccessibleWhere(session.user.id) }
  });
  if (!server) return { ok: false, message: "Server not found" };

  const rows = await prisma.projectDomain.findMany({
    where: { serverId: server.id },
    select: { hostname: true },
    orderBy: { hostname: "asc" }
  });
  const set = new Set<string>();
  for (const r of rows) {
    const h = normalizeHostname(r.hostname);
    if (h && !h.endsWith(".local")) set.add(h);
  }
  const projects = await prisma.project.findMany({
    where: { serverId: server.id },
    select: { domain: true }
  });
  for (const p of projects) {
    const d = p.domain?.trim();
    if (d) {
      const h = normalizeHostname(d);
      if (h && !h.endsWith(".local")) set.add(h);
    }
  }
  return { ok: true, hostnames: [...set].sort() };
}

export async function issueLetsEncryptCertAction(
  input: unknown
): Promise<
  | { ok: true; tlsCertPath: string; tlsKeyPath: string; stdout: string }
  | { ok: false; message: string }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };
  const parsed = certbotSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Email and at least one public hostname are required." };
  }

  const ctx = await deployTargetForServer(parsed.data.serverId, session.user.id);
  if (!ctx) return { ok: false, message: "Server not found" };
  if (!(await canPerformDestructiveOps(session.user.id, ctx.server.organizationId))) {
    return { ok: false, message: PERMISSION_DENIED_DESTRUCTIVE };
  }

  const hostnames = [
    ...new Set(parsed.data.hostnames.map((h) => normalizeHostname(h)).filter(Boolean))
  ].filter((h) => !h.endsWith(".local"));
  if (hostnames.length === 0) {
    return {
      ok: false,
      message: "No public hostnames for Let's Encrypt (.local domains are excluded)."
    };
  }

  const slug = ctx.server.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "server";
  const certPath =
    parsed.data.tlsCertPath?.trim() || centralSslCertPath(ctx.target.deployRoot, slug);
  const keyPath =
    parsed.data.tlsKeyPath?.trim() || centralSslKeyPath(ctx.target.deployRoot, slug);

  let script: string;
  try {
    script = buildCertbotNginxScript({
      hostnames,
      email: parsed.data.email,
      certPath,
      keyPath
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  let stdout = "";
  try {
    stdout = await withSshSession(ctx.target, undefined, undefined, async (ssh) =>
      ssh.execCapture(`bash -lc ${bashQ(script)}`)
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: msg.includes("certbot")
        ? "Certbot failed. Ensure certbot is installed, nginx sites exist for these hostnames, and DNS points to this server."
        : `Let's Encrypt failed: ${msg}`
    };
  }

  await prisma.server.update({
    where: { id: ctx.server.id },
    data: { tlsCertPath: certPath, tlsKeyPath: keyPath }
  });
  try {
    const meta = await withSshSession(ctx.target, undefined, undefined, async (ssh) =>
      ssh.execCapture(`openssl x509 -in ${bashQ(certPath)} -noout -enddate 2>/dev/null`)
    );
    await persistTlsCertNotAfter(ctx.server.id, meta);
  } catch {
    // expiry metadata is optional
  }
  revalidatePath(`/dashboard/servers/${ctx.server.id}`);
  revalidatePath(`/dashboard/servers/${ctx.server.id}/edit`);
  revalidatePath("/dashboard");
  return { ok: true, tlsCertPath: certPath, tlsKeyPath: keyPath, stdout: stdout.trim() };
}

export async function renewLetsEncryptCertsAction(
  input: unknown
): Promise<{ ok: true; stdout: string } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };

  const ctx = await deployTargetForServer(parsed.data.serverId, session.user.id);
  if (!ctx) return { ok: false, message: "Server not found" };
  if (!(await canPerformDestructiveOps(session.user.id, ctx.server.organizationId))) {
    return { ok: false, message: PERMISSION_DENIED_DESTRUCTIVE };
  }

  const script = buildCertbotRenewScript();
  try {
    const stdout = await withSshSession(ctx.target, undefined, undefined, async (ssh) =>
      ssh.execCapture(`bash -lc ${bashQ(script)}`)
    );
    const cert = ctx.server.tlsCertPath.trim();
    if (cert) {
      try {
        const meta = await withSshSession(ctx.target, undefined, undefined, async (ssh) =>
          ssh.execCapture(`openssl x509 -in ${bashQ(cert)} -noout -enddate 2>/dev/null`)
        );
        await persistTlsCertNotAfter(ctx.server.id, meta);
      } catch {
        // optional
      }
    }
    revalidatePath(`/dashboard/servers/${ctx.server.id}`);
    revalidatePath("/dashboard");
    return { ok: true, stdout: stdout.trim() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: msg.includes("certbot")
        ? "Certbot renew failed. Install certbot and ensure certificates were issued with the nginx plugin."
        : `Renew failed: ${msg}`
    };
  }
}

export async function fetchSslExpiryAction(
  input: unknown
): Promise<
  | { ok: true; notAfter: string | null; subject: string | null }
  | { ok: false; message: string }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };

  const ctx = await deployTargetForServer(parsed.data.serverId, session.user.id);
  if (!ctx) return { ok: false, message: "Server not found" };
  const cert = ctx.server.tlsCertPath.trim();
  if (!cert) return { ok: true, notAfter: null, subject: null };

  try {
    const out = await withSshSession(ctx.target, undefined, undefined, async (ssh) =>
      ssh.execCapture(
        `openssl x509 -in ${bashQ(cert)} -noout -subject -enddate 2>/dev/null`
      )
    );
    let notAfter: string | null = null;
    let subject: string | null = null;
    for (const line of out.split("\n")) {
      if (line.startsWith("notAfter=")) notAfter = line.replace("notAfter=", "").trim();
      if (line.startsWith("subject=")) subject = line.replace("subject=", "").trim();
    }
    await persistTlsCertNotAfter(ctx.server.id, out);
    revalidatePath("/dashboard");
    return { ok: true, notAfter, subject };
  } catch {
    return { ok: true, notAfter: null, subject: null };
  }
}

function bashQ(s: string): string {
  return `'${String(s).replace(/'/g, `'\"'\"'`)}'`;
}

import { Client } from "ssh2";
import type { DeployStreamHandlers, DeployTarget, DeployConnectionOptions } from "@/lib/deploy/types";
import { loadPrivateKey } from "@/lib/deploy/load-key";
import { registerSshClient, unregisterSshClient } from "@/lib/active-ssh";

type ExecCtx = {
  exec(command: string): Promise<void>;
  execCapture(command: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
};

function resolveSshConnectConfig(privateKey: Buffer, passphrase: string | undefined) {
  const readyTimeout = Number(process.env.SSH_READY_TIMEOUT_MS ?? 30_000);
  const keepaliveMs = Number(process.env.SSH_KEEPALIVE_MS ?? 10_000);
  const keepaliveCountMax = Number(process.env.SSH_KEEPALIVE_COUNT ?? 3);
  let port: number | undefined;
  const rawPort = process.env.SSH_PORT?.trim();
  if (rawPort) {
    const p = Number(rawPort);
    if (Number.isInteger(p) && p > 0 && p <= 65_535) port = p;
  }

  return {
    privateKey,
    ...(passphrase ? { passphrase } : {}),
    readyTimeout: Number.isFinite(readyTimeout) ? readyTimeout : 30_000,
    strictVendor: process.env.SSH2_STRICT_VENDOR === "0" ? false : true,
    ...(port !== undefined ? { port } : {}),
    ...(Number.isFinite(keepaliveMs) && keepaliveMs > 0
      ? {
          keepaliveInterval: keepaliveMs,
          keepaliveCountMax: Number.isFinite(keepaliveCountMax)
            ? Math.max(1, keepaliveCountMax)
            : 3
        }
      : {})
  };
}

function execOnce(
  conn: Client,
  command: string,
  stream: DeployStreamHandlers | undefined
): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, ch) => {
      if (err) {
        return reject(err);
      }
      ch.on("close", (code: number, signal?: string) => {
        if (code !== 0) {
          return reject(
            new Error(
              `Remote command exited with code ${code}${signal != null ? ` signal ${signal}` : ""}`
            )
          );
        }
        resolve();
      });
      ch.on("data", (data: Buffer) => {
        const s = data.toString();
        if (stream?.onStdout) stream.onStdout(s);
        else process.stdout.write(s);
      });
      ch.stderr.on("data", (data: Buffer) => {
        const s = data.toString();
        if (stream?.onStderr) stream.onStderr(s);
        else process.stderr.write(s);
      });
    });
  });
}

function execCaptureOnce(conn: Client, command: string): Promise<string> {
  let out = "";
  let err = "";
  return new Promise((resolve, reject) => {
    conn.exec(command, (e, ch) => {
      if (e) return reject(e);
      ch.on("close", (code: number) => {
        if (code !== 0) {
          return reject(new Error(err || out || `exit ${code}`));
        }
        resolve(out.trimEnd());
      });
      ch.on("data", (d: Buffer) => {
        out += d.toString();
      });
      ch.stderr.on("data", (d: Buffer) => {
        err += d.toString();
      });
    });
  });
}

function sftpWrite(conn: Client, remotePath: string, content: string): Promise<void> {
  const buf = Buffer.from(content, "utf8");
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.writeFile(remotePath, buf, (werr) => {
        if (werr) reject(werr);
        else resolve();
      });
    });
  });
}

/**
 * One SSH session, multiple exec + SFTP writes.
 */
export async function withSshSession<T = void>(
  target: DeployTarget,
  stream: DeployStreamHandlers | undefined,
  connection: DeployConnectionOptions | undefined,
  fn: (ctx: ExecCtx) => Promise<T>
): Promise<T> {
  const privateKey = loadPrivateKey(target.sshPrivateKey);
  const passphrase = process.env.SSH_KEY_PASSPHRASE;
  const deploymentId = connection?.deploymentId;
  const connectOpts = resolveSshConnectConfig(privateKey, passphrase);

  return new Promise<T>((resolvePromise, reject) => {
    const conn = new Client();
    let settled = false;
    const settle = (fn_: () => void) => {
      if (settled) return;
      settled = true;
      fn_();
    };

    conn.on("close", () => {
      if (deploymentId) unregisterSshClient(deploymentId);
    });

    conn
      .on("ready", async () => {
        if (deploymentId) registerSshClient(deploymentId, conn);
        const ctx: ExecCtx = {
          exec: (cmd) => execOnce(conn, cmd, stream),
          execCapture: (cmd) => execCaptureOnce(conn, cmd),
          writeFile: (path, content) => sftpWrite(conn, path, content)
        };
        try {
          const result = await fn(ctx);
          conn.end();
          settle(() => resolvePromise(result));
        } catch (e) {
          conn.end();
          settle(() => reject(e));
        }
      })
      .on("error", (err) => {
        conn.end();
        settle(() => reject(err));
      })
      .connect({
        host: target.serverIp,
        username: target.sshUser,
        ...connectOpts
      });
  });
}

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  detectSslFilesAction,
  fetchSslExpiryAction,
  issueLetsEncryptCertAction,
  renewLetsEncryptCertsAction,
  listServerHostnamesAction,
  saveTlsPathsAction,
  uploadSslFilesAction,
  verifySslPathsAction,
  type SslCandidate
} from "@/app/dashboard/servers/server-ssl-actions";

export function ServerSslPanel({
  serverId,
  initialCertPath,
  initialKeyPath,
  canDestructive = true
}: {
  serverId: string;
  initialCertPath: string;
  initialKeyPath: string;
  canDestructive?: boolean;
}) {
  const [certPath, setCertPath] = useState(initialCertPath);
  const [keyPath, setKeyPath] = useState(initialKeyPath);
  const [candidates, setCandidates] = useState<SslCandidate[]>([]);
  const [expiry, setExpiry] = useState<{ notAfter: string | null; subject: string | null } | null>(
    null
  );
  const [certUpload, setCertUpload] = useState("");
  const [keyUpload, setKeyUpload] = useState("");
  const [leEmail, setLeEmail] = useState("");
  const [leHostnames, setLeHostnames] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setCertPath(initialCertPath);
    setKeyPath(initialKeyPath);
  }, [initialCertPath, initialKeyPath]);

  useEffect(() => {
    void fetchSslExpiryAction({ serverId }).then((res) => {
      if (res.ok) setExpiry({ notAfter: res.notAfter, subject: res.subject });
    });
  }, [serverId, certPath]);

  async function detect() {
    setPending(true);
    const res = await detectSslFilesAction({ serverId });
    setPending(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setCandidates(res.candidates);
    if (res.candidates.length === 0) toast.message("No certificate files found on the server.");
  }

  async function verify() {
    setPending(true);
    const res = await verifySslPathsAction({ serverId, tlsCertPath: certPath, tlsKeyPath: keyPath });
    setPending(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    if (res.valid) {
      toast.success("TLS paths verified on the server.");
      setExpiry({ notAfter: res.notAfter, subject: res.subject });
    } else {
      toast.error("Could not read or parse certificate/key at those paths.");
    }
  }

  async function savePaths() {
    setPending(true);
    const res = await saveTlsPathsAction({ serverId, tlsCertPath: certPath, tlsKeyPath: keyPath });
    setPending(false);
    if (!res.ok) toast.error(res.message);
    else toast.success("TLS paths saved.");
  }

  async function loadHostnames() {
    setPending(true);
    const res = await listServerHostnamesAction({ serverId });
    setPending(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    if (res.hostnames.length === 0) {
      toast.message("No project domains on this server yet.");
      return;
    }
    setLeHostnames(res.hostnames.join(", "));
  }

  async function issueLetsEncrypt() {
    const hostnames = leHostnames
      .split(/[,\s]+/)
      .map((h) => h.trim())
      .filter(Boolean);
    if (!leEmail.trim() || hostnames.length === 0) {
      toast.error("Enter an email and at least one hostname.");
      return;
    }
    setPending(true);
    const res = await issueLetsEncryptCertAction({
      serverId,
      email: leEmail.trim(),
      hostnames,
      tlsCertPath: certPath || undefined,
      tlsKeyPath: keyPath || undefined
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setCertPath(res.tlsCertPath);
    setKeyPath(res.tlsKeyPath);
    toast.success("Let's Encrypt certificate issued and paths saved.");
    void fetchSslExpiryAction({ serverId }).then((r) => {
      if (r.ok) setExpiry({ notAfter: r.notAfter, subject: r.subject });
    });
  }

  async function renewLetsEncrypt() {
    setPending(true);
    const res = await renewLetsEncryptCertsAction({ serverId });
    setPending(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Certbot renew completed.");
    void fetchSslExpiryAction({ serverId }).then((r) => {
      if (r.ok) setExpiry({ notAfter: r.notAfter, subject: r.subject });
    });
  }

  async function upload() {
    setPending(true);
    const res = await uploadSslFilesAction({
      serverId,
      certPem: certUpload,
      keyPem: keyUpload,
      tlsCertPath: certPath || undefined,
      tlsKeyPath: keyPath || undefined
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setCertPath(res.tlsCertPath);
    setKeyPath(res.tlsKeyPath);
    setCertUpload("");
    setKeyUpload("");
    toast.success("Certificate uploaded to the server.");
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`tls-cert-${serverId}`}>Certificate path on server</Label>
          <Input
            id={`tls-cert-${serverId}`}
            value={certPath}
            onChange={(e) => setCertPath(e.target.value)}
            placeholder="/etc/letsencrypt/live/example/fullchain.pem"
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`tls-key-${serverId}`}>Private key path on server</Label>
          <Input
            id={`tls-key-${serverId}`}
            value={keyPath}
            onChange={(e) => setKeyPath(e.target.value)}
            placeholder="/etc/letsencrypt/live/example/privkey.pem"
            className="font-mono text-sm"
          />
        </div>
      </div>

      {expiry?.notAfter ? (
        <p className="text-muted-foreground text-xs">
          Expires: <span className="font-mono">{expiry.notAfter}</span>
          {expiry.subject ? (
            <>
              {" "}
              · <span className="font-mono">{expiry.subject}</span>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void detect()}>
          Detect on server
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void verify()}>
          Verify paths
        </Button>
        {canDestructive ? (
          <Button type="button" size="sm" disabled={pending} onClick={() => void savePaths()}>
            Save paths
          </Button>
        ) : null}
      </div>

      {candidates.length > 0 ? (
        <ul className="text-muted-foreground space-y-1 text-xs">
          {candidates.map((c) => (
            <li key={c.certPath}>
              <button
                type="button"
                className="hover:text-foreground text-left underline-offset-2 hover:underline"
                onClick={() => {
                  setCertPath(c.certPath);
                  if (c.keyPath) setKeyPath(c.keyPath);
                }}
              >
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {canDestructive ? (
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">Let&apos;s Encrypt (certbot)</p>
        <p className="text-muted-foreground text-xs">
          Runs certbot on the VPS (nginx plugin). DNS must point here; nginx sites for these hostnames should
          already exist. Copies certs to the paths above.
        </p>
        <div className="space-y-1">
          <Label htmlFor={`le-email-${serverId}`}>Contact email</Label>
          <Input
            id={`le-email-${serverId}`}
            type="email"
            value={leEmail}
            onChange={(e) => setLeEmail(e.target.value)}
            placeholder="ops@example.com"
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`le-hosts-${serverId}`}>Hostnames</Label>
          <Input
            id={`le-hosts-${serverId}`}
            value={leHostnames}
            onChange={(e) => setLeHostnames(e.target.value)}
            placeholder="app.example.com, www.example.com"
            className="font-mono text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => void loadHostnames()}
          >
            Load from projects
          </Button>
          <Button type="button" size="sm" disabled={pending} onClick={() => void issueLetsEncrypt()}>
            Issue certificate
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => void renewLetsEncrypt()}
          >
            Renew now
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          On the VPS, schedule automatic renewal (e.g. daily cron):{" "}
          <code className="text-foreground">certbot renew --quiet &amp;&amp; nginx -s reload</code>
        </p>
      </div>
      ) : null}

      {canDestructive ? (
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">Upload PEM files</p>
        <p className="text-muted-foreground text-xs">
          Writes to the paths above (or &lt;deploy root&gt;/ssl/central/… if empty). Validated before upload.
        </p>
        <textarea
          className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs"
          rows={4}
          placeholder="-----BEGIN CERTIFICATE-----"
          value={certUpload}
          onChange={(e) => setCertUpload(e.target.value)}
        />
        <textarea
          className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs"
          rows={4}
          placeholder="-----BEGIN PRIVATE KEY-----"
          value={keyUpload}
          onChange={(e) => setKeyUpload(e.target.value)}
        />
        <Button type="button" size="sm" disabled={pending} onClick={() => void upload()}>
          Upload to server
        </Button>
      </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Workspace owners and admins can save paths or upload certificates.
        </p>
      )}
    </div>
  );
}

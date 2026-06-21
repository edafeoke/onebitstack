"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WebStack } from "@/generated/prisma/browser";

const ORDER = [WebStack.none, WebStack.nginx, WebStack.apache, WebStack.caddy] as const;

const LABELS: Record<(typeof ORDER)[number], string> = {
  [WebStack.none]: "None (not documented)",
  [WebStack.nginx]: "Nginx",
  [WebStack.apache]: "Apache",
  [WebStack.caddy]: "Caddy"
};

export function WebStackFields({
  defaultStack,
  defaultNotes,
  defaultTlsCertPath = "",
  defaultTlsKeyPath = "",
  defaultReverseProxyConfigPath = ""
}: {
  defaultStack: string;
  defaultNotes: string;
  defaultTlsCertPath?: string;
  defaultTlsKeyPath?: string;
  defaultReverseProxyConfigPath?: string;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="webStack">Web / reverse proxy</Label>
        <select
          id="webStack"
          name="webStack"
          required
          defaultValue={(ORDER as readonly string[]).includes(defaultStack) ? defaultStack : WebStack.none}
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
        >
          {ORDER.map((v) => (
            <option key={v} value={v}>
              {LABELS[v]}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">
          TLS paths are injected into generated nginx configs. If left empty, nginx generation uses{" "}
          <code className="text-foreground">/etc/ssl/cloudflare/&lt;domain&gt;-origin.pem</code> from the
          project domain. Project <span className="font-medium">webServer</span> drives deploy steps.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reverseProxyNotes">Reverse-proxy notes (optional)</Label>
        <textarea
          id="reverseProxyNotes"
          name="reverseProxyNotes"
          rows={4}
          defaultValue={defaultNotes}
          placeholder="e.g. upstream port, extra context"
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tlsCertPath">TLS certificate path on server (optional)</Label>
        <Input
          id="tlsCertPath"
          name="tlsCertPath"
          defaultValue={defaultTlsCertPath}
          placeholder="/etc/ssl/cloudflare/centralstackhq-origin.pem"
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tlsKeyPath">TLS private key path on server (optional)</Label>
        <Input
          id="tlsKeyPath"
          name="tlsKeyPath"
          defaultValue={defaultTlsKeyPath}
          placeholder="/etc/ssl/cloudflare/centralstackhq-origin.key"
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reverseProxyConfigPath">Reverse-proxy config path (optional)</Label>
        <Input
          id="reverseProxyConfigPath"
          name="reverseProxyConfigPath"
          defaultValue={defaultReverseProxyConfigPath}
          placeholder="/etc/nginx/sites-available/myapp.conf"
          autoComplete="off"
        />
      </div>
    </>
  );
}

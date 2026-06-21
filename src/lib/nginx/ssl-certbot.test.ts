import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCertbotNginxScript, buildCertbotRenewScript } from "@/lib/nginx/ssl-certbot";

describe("buildCertbotNginxScript", () => {
  it("throws when only .local hostnames", () => {
    assert.throws(
      () =>
        buildCertbotNginxScript({
          hostnames: ["app.local"],
          email: "ops@example.com",
          certPath: "/etc/ssl/x.pem",
          keyPath: "/etc/ssl/x.key"
        }),
      /No public hostnames/
    );
  });

  it("includes certbot and domain flags", () => {
    const script = buildCertbotNginxScript({
      hostnames: ["app.example.com"],
      email: "ops@example.com",
      certPath: "/var/www/ssl/app.pem",
      keyPath: "/var/www/ssl/app.key"
    });
    assert.match(script, /certbot certonly --nginx/);
    assert.match(script, /app\.example\.com/);
    assert.match(script, /ops@example\.com/);
  });
});

describe("buildCertbotRenewScript", () => {
  it("runs certbot renew and reloads nginx", () => {
    const script = buildCertbotRenewScript();
    assert.match(script, /certbot renew --nginx/);
    assert.match(script, /nginx -s reload/);
  });
});

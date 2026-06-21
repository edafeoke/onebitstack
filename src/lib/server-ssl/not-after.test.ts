import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseOpenSslNotAfter, parseOpenSslOutput } from "@/lib/server-ssl/not-after";

describe("parseOpenSslNotAfter", () => {
  it("parses openssl enddate line", () => {
    const d = parseOpenSslNotAfter("notAfter=Dec 31 23:59:59 2026 GMT");
    assert.ok(d);
    assert.equal(d!.getUTCFullYear(), 2026);
  });
});

describe("parseOpenSslOutput", () => {
  it("finds notAfter in multi-line output", () => {
    const d = parseOpenSslOutput("subject=CN=example.com\nnotAfter=Jan  1 00:00:00 2027 GMT\n");
    assert.ok(d);
    assert.equal(d!.getUTCFullYear(), 2027);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractServerNamesFromNginxConfig } from "@/lib/nginx/server-names";

describe("extractServerNamesFromNginxConfig", () => {
  it("parses server_name line", () => {
    const config = `
server {
  listen 80;
  server_name app.example.com www.example.com;
}
`;
    assert.deepEqual(extractServerNamesFromNginxConfig(config).sort(), [
      "app.example.com",
      "www.example.com"
    ]);
  });

  it("ignores underscore placeholder", () => {
    const config = `server_name _;`;
    assert.deepEqual(extractServerNamesFromNginxConfig(config), []);
  });
});

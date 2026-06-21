import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isRequiredCapabilitySatisfied,
  REQUIRED_PROVISION_FLAGS
} from "@/lib/provision/required";

describe("REQUIRED_PROVISION_FLAGS", () => {
  it("includes git nginx node pm2 php", () => {
    assert.equal(REQUIRED_PROVISION_FLAGS.git, true);
    assert.equal(REQUIRED_PROVISION_FLAGS.nginx, true);
    assert.equal(REQUIRED_PROVISION_FLAGS.node, true);
    assert.equal(REQUIRED_PROVISION_FLAGS.pm2, true);
    assert.equal(REQUIRED_PROVISION_FLAGS.php, true);
  });
});

describe("isRequiredCapabilitySatisfied", () => {
  it("requires php sqlite and fpm", () => {
    assert.equal(
      isRequiredCapabilitySatisfied({
        git: "git 2.43",
        nginx: "nginx",
        node: "v22",
        pm2: "5",
        php: "PHP 8.4",
        phpFpm: "php8.4-fpm active",
        phpSqlite: "pdo_sqlite enabled",
        composer: "Composer 2"
      }),
      true
    );
    assert.equal(
      isRequiredCapabilitySatisfied({
        git: "git",
        nginx: "nginx",
        node: "v22",
        pm2: "5",
        php: "PHP 8.4",
        composer: "Composer 2"
      }),
      false
    );
  });
});

// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "deploy/website.mdx": () => import("../content/docs/deploy/website.mdx?collection=docs"), "get-started/github-app.mdx": () => import("../content/docs/get-started/github-app.mdx?collection=docs"), "get-started/installation.mdx": () => import("../content/docs/get-started/installation.mdx?collection=docs"), "get-started/setup-wizard.mdx": () => import("../content/docs/get-started/setup-wizard.mdx?collection=docs"), "operations/postgres.mdx": () => import("../content/docs/operations/postgres.mdx?collection=docs"), "operations/vps.mdx": () => import("../content/docs/operations/vps.mdx?collection=docs"), "self-host/docker.mdx": () => import("../content/docs/self-host/docker.mdx?collection=docs"), "self-host/env.mdx": () => import("../content/docs/self-host/env.mdx?collection=docs"), }),
};
export default browserCollections;
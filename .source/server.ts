// @ts-nocheck
import * as __fd_glob_13 from "../content/docs/self-host/env.mdx?collection=docs"
import * as __fd_glob_12 from "../content/docs/self-host/docker.mdx?collection=docs"
import * as __fd_glob_11 from "../content/docs/operations/vps.mdx?collection=docs"
import * as __fd_glob_10 from "../content/docs/operations/postgres.mdx?collection=docs"
import * as __fd_glob_9 from "../content/docs/get-started/setup-wizard.mdx?collection=docs"
import * as __fd_glob_8 from "../content/docs/get-started/installation.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/get-started/github-app.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/deploy/website.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/index.mdx?collection=docs"
import { default as __fd_glob_4 } from "../content/docs/self-host/meta.json?collection=docs"
import { default as __fd_glob_3 } from "../content/docs/operations/meta.json?collection=docs"
import { default as __fd_glob_2 } from "../content/docs/get-started/meta.json?collection=docs"
import { default as __fd_glob_1 } from "../content/docs/deploy/meta.json?collection=docs"
import { default as __fd_glob_0 } from "../content/docs/meta.json?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content/docs", {"meta.json": __fd_glob_0, "deploy/meta.json": __fd_glob_1, "get-started/meta.json": __fd_glob_2, "operations/meta.json": __fd_glob_3, "self-host/meta.json": __fd_glob_4, }, {"index.mdx": __fd_glob_5, "deploy/website.mdx": __fd_glob_6, "get-started/github-app.mdx": __fd_glob_7, "get-started/installation.mdx": __fd_glob_8, "get-started/setup-wizard.mdx": __fd_glob_9, "operations/postgres.mdx": __fd_glob_10, "operations/vps.mdx": __fd_glob_11, "self-host/docker.mdx": __fd_glob_12, "self-host/env.mdx": __fd_glob_13, });
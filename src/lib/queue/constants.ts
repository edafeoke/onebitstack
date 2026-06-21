export const DEPLOY_QUEUE_NAME = "central-deployments";

/** Max time a deploy lock may be held (long-running Laravel/Node builds). */
export const DEPLOY_LOCK_TTL_MS = 2 * 60 * 60 * 1000;

export const DEPLOY_LOCK_KEY_PREFIX = "central:deploy:lock:";

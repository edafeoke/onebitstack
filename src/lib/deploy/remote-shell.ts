/**
 * Bash helper embedded in remote scripts: run commands as root without a password prompt.
 * - UID 0: run directly
 * - otherwise: `sudo -n` (fails fast if passwordless sudo is not configured)
 */
export const RUN_ROOT_HELPER = `
run_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo -n "$@"
  fi
}
`.trim();

export const SUDO_HINT =
  "Configure passwordless sudo for the SSH user (see docs/OPS.md), or connect as root.";

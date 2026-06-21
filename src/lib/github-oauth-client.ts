export type AuthFeatures = {
  githubLogin: boolean;
  credentialAuth: boolean;
  saasMode: boolean;
  githubAppConfigured: boolean;
  githubAppSlug: string;
};

export async function fetchAuthFeatures(): Promise<AuthFeatures> {
  const res = await fetch("/api/features", { credentials: "include" });
  if (!res.ok) {
    return {
      githubLogin: false,
      credentialAuth: false,
      saasMode: true,
      githubAppConfigured: false,
      githubAppSlug: ""
    };
  }
  const data = (await res.json()) as Partial<AuthFeatures>;
  return {
    githubLogin: Boolean(data.githubLogin),
    credentialAuth: Boolean(data.credentialAuth),
    saasMode: data.saasMode !== false,
    githubAppConfigured: Boolean(data.githubAppConfigured),
    githubAppSlug: typeof data.githubAppSlug === "string" ? data.githubAppSlug : ""
  };
}

function resolveCallbackURL(defaultCallback: string): string {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("callbackUrl") ?? defaultCallback;
  return raw.startsWith("/") ? raw : `/${raw.replace(/^\/+/, "")}`;
}

function messageFromAuthBody(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const m = (body as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}

export async function signUpWithEmail(input: {
  name: string;
  email: string;
  password: string;
  defaultCallback?: string;
}): Promise<void> {
  const callbackURL = resolveCallbackURL(input.defaultCallback ?? "/dashboard");
  const res = await fetch("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      name: input.name.trim(),
      email: input.email.trim(),
      password: input.password,
      callbackURL
    })
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(messageFromAuthBody(body, `Sign-up failed (${res.status})`));
  }
  window.location.href = callbackURL;
}

export async function signInWithEmail(input: {
  email: string;
  password: string;
  defaultCallback?: string;
  rememberMe?: boolean;
}): Promise<void> {
  const callbackURL = resolveCallbackURL(input.defaultCallback ?? "/dashboard");
  const res = await fetch("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      email: input.email.trim(),
      password: input.password,
      rememberMe: input.rememberMe ?? true,
      callbackURL
    })
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(messageFromAuthBody(body, `Sign-in failed (${res.status})`));
  }
  window.location.href = callbackURL;
}

type SocialSignInResponse = {
  url?: string;
  redirect?: boolean;
  message?: string;
};

/**
 * Starts GitHub OAuth via better-auth. Redirects the browser when the server returns an authorize URL.
 */
export async function signInWithGithub(callbackURL: string): Promise<void> {
  const res = await fetch("/api/auth/sign-in/social", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      provider: "github",
      callbackURL
    })
  });
  const body = (await res.json().catch(() => null)) as SocialSignInResponse | Record<string, unknown> | null;
  if (!res.ok) {
    let msg = `GitHub sign-in failed (${res.status})`;
    if (body && typeof body === "object") {
      const m = (body as { message?: unknown }).message;
      if (typeof m === "string" && m.trim()) {
        msg = m;
      }
    }
    throw new Error(msg);
  }
  const parsed = body as SocialSignInResponse | null;
  if (parsed?.redirect && parsed.url) {
    window.location.href = parsed.url;
    return;
  }
  throw new Error("Unexpected response from GitHub sign-in");
}

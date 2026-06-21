"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchAuthFeatures,
  signInWithEmail,
  signUpWithEmail,
  type AuthFeatures
} from "@/lib/github-oauth-client";

export function CredentialsAuthForm({
  mode,
  defaultCallback = "/dashboard"
}: {
  mode: "sign-in" | "sign-up";
  defaultCallback?: string;
}) {
  const [features, setFeatures] = useState<AuthFeatures | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchAuthFeatures().then(setFeatures);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "sign-up") {
        await signUpWithEmail({ name, email, password, defaultCallback });
      } else {
        await signInWithEmail({ email, password, defaultCallback });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setPending(false);
    }
  }

  if (features === null) {
    return <p className="text-muted-foreground text-center text-sm">Loading…</p>;
  }

  if (!features.credentialAuth) {
    return (
      <p className="text-muted-foreground text-center text-sm">
        Email sign-in is disabled on this instance.
      </p>
    );
  }

  const isSignUp = mode === "sign-up";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isSignUp ? (
        <div className="space-y-1">
          <Label htmlFor="auth-name">Name</Label>
          <Input
            id="auth-name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={pending}
          />
        </div>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="auth-email">Email</Label>
        <Input
          id="auth-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={pending}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="auth-password">Password</Label>
        <Input
          id="auth-password"
          name="password"
          type="password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={pending}
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending
          ? isSignUp
            ? "Creating account…"
            : "Signing in…"
          : isSignUp
            ? "Create account"
            : "Sign in"}
      </Button>
      {error ? <p className="text-destructive text-center text-sm">{error}</p> : null}
      <p className="text-muted-foreground text-center text-sm">
        {isSignUp ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="text-primary font-medium underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

export function AuthMethodDivider() {
  return (
    <div className="relative py-2">
      <div className="border-border absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-card text-muted-foreground px-2">or</span>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AuthMethodDivider,
  CredentialsAuthForm
} from "@/components/credentials-auth-form";
import { GithubSignInBlock } from "@/components/github-sign-in-block";
import { getPublicAppName } from "@/lib/app-config";

export default function LoginPage() {
  const appName = getPublicAppName();

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to {appName}</CardTitle>
          <CardDescription>Use your email or connect GitHub to access your workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CredentialsAuthForm mode="sign-in" defaultCallback="/dashboard" />
          <AuthMethodDivider />
          <GithubSignInBlock defaultCallback="/dashboard" />
          <p className="text-muted-foreground text-center text-xs">
            <Link href="/" className="text-primary underline">
              Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

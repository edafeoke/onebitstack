import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AuthMethodDivider,
  CredentialsAuthForm
} from "@/components/credentials-auth-form";
import { GithubSignInBlock } from "@/components/github-sign-in-block";
import { getPublicAppName } from "@/lib/app-config";
import { isControlPlaneEdition } from "@/lib/edition";
import { isSetupCompleted } from "@/lib/setup-state";

export default async function SignupPage() {
  if (isControlPlaneEdition() && !(await isSetupCompleted())) {
    redirect("/setup");
  }

  const appName = getPublicAppName();

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Get started with {appName}</CardTitle>
          <CardDescription>
            Create your workspace with email, or connect GitHub to import repos right away.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CredentialsAuthForm mode="sign-up" defaultCallback="/dashboard" />
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

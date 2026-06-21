"use client";

import { useEffect } from "react";

export function GithubManifestSubmit({
  formAction,
  manifestJson
}: {
  formAction: string;
  manifestJson: string;
}) {
  useEffect(() => {
    const form = document.getElementById("github-manifest-form");
    if (form instanceof HTMLFormElement) form.submit();
  }, []);

  return (
    <form id="github-manifest-form" action={formAction} method="post">
      <input type="hidden" name="manifest" value={manifestJson} readOnly />
      <button type="submit" className="text-primary text-sm underline">
        Continue to GitHub
      </button>
    </form>
  );
}

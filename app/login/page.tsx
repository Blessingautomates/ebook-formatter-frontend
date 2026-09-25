import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/AuthForm";
import { safeNextPath } from "@/lib/redirects";

export const metadata: Metadata = {
  title: "Sign in — Ebook Formatter",
  description: "Sign in to save manuscripts and come back to them.",
};

/**
 * The `error` code comes from /auth/callback. It is mapped to wording here
 * rather than passed through the URL, so the message cannot be put there by
 * whoever wrote the link.
 */
const CALLBACK_ERRORS: Record<string, string> = {
  signin_failed:
    "That sign-in could not be completed. The link may have expired — please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <Link
        href="/"
        className="mb-6 self-start font-serif text-lg font-semibold tracking-tight transition-colors hover:text-accent"
      >
        Ebook Formatter
      </Link>

      <AuthForm
        mode="login"
        next={safeNextPath(params.next)}
        initialError={params.error ? (CALLBACK_ERRORS[params.error] ?? null) : null}
      />
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/AuthForm";
import { safeNextPath } from "@/lib/redirects";

export const metadata: Metadata = {
  title: "Create your account — Ebook Formatter",
  description: "Create an account to save manuscripts and come back to them.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
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

      <AuthForm mode="signup" next={safeNextPath(params.next)} />
    </main>
  );
}

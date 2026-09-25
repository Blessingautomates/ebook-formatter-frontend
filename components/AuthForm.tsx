"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Notice, Spinner } from "@/components/primitives";
import { SUPABASE_SETUP_HINT, isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";

export type AuthMode = "login" | "signup";

/** Supabase's own minimum; kept in step so the browser and server agree. */
const MIN_PASSWORD_LENGTH = 6;

const COPY = {
  login: {
    heading: "Sign in",
    subheading: "Pick up a manuscript where you left it.",
    submit: "Sign in",
    switchText: "No account yet?",
    switchLabel: "Create one",
    switchHref: "/signup",
  },
  signup: {
    heading: "Create your account",
    subheading: "Save manuscripts and come back to them later.",
    submit: "Create account",
    switchText: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/login",
  },
} as const;

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 18 18" className="size-4 shrink-0">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function AuthForm({
  mode,
  next,
  initialError = null,
}: {
  mode: AuthMode;
  /** Where to go after signing in. Already checked by safeNextPath. */
  next: string;
  initialError?: string | null;
}) {
  const router = useRouter();
  const copy = COPY[mode];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"password" | "google" | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);

  async function handlePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);

    if (mode === "signup" && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setBusy("password");
    try {
      const supabase = createClient();

      if (mode === "login") {
        const { error: failure } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (failure) throw failure;
        // The session is in cookies now. `refresh` is what makes the server
        // re-read them, so middleware sees the user on the next navigation.
        router.replace(next);
        router.refresh();
        return;
      }

      const { data, error: failure } = await supabase.auth.signUp({
        email,
        password,
      });
      if (failure) throw failure;

      if (data.session) {
        router.replace(next);
        router.refresh();
        return;
      }

      // No session means the project is set to confirm email addresses first.
      setNotice(`Check ${email} for a confirmation link, then sign in.`);
    } catch (caught) {
      setError(messageFor(caught, "That did not work. Please try again."));
    } finally {
      setBusy(null);
    }
  }

  async function handleGoogle() {
    if (busy) return;
    setError(null);
    setNotice(null);
    setBusy("google");
    try {
      const supabase = createClient();
      const { error: failure } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (failure) throw failure;
      // On success the browser is already navigating to Google, so the busy
      // state stays set rather than flickering back to an idle form.
    } catch (caught) {
      setError(messageFor(caught, "Google sign-in could not be started."));
      setBusy(null);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="card p-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">
          {copy.heading}
        </h1>
        <Notice tone="warn" className="mt-5">
          {SUPABASE_SETUP_HINT}
        </Notice>
        <p className="mt-5 text-sm leading-relaxed text-muted">
          Accounts back the saved-projects list. The formatter itself needs the
          API running, not this.
        </p>
        <Link href="/" className="btn mt-5 w-full">
          ← Back to the home page
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <header>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">
          {copy.heading}
        </h1>
        <p className="mt-1 text-sm text-muted">{copy.subheading}</p>
      </header>

      {error ? (
        <Notice tone="error" className="mt-5">
          {error}
        </Notice>
      ) : null}
      {notice ? (
        <Notice tone="ok" className="mt-5">
          {notice}
        </Notice>
      ) : null}

      <form onSubmit={handlePassword} className="mt-5 space-y-4">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="field"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="field"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
            required
          />
          {mode === "signup" ? (
            <p className="mt-1.5 text-xs text-faint">
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={busy !== null}
        >
          {busy === "password" ? <Spinner /> : null}
          {copy.submit}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span aria-hidden className="h-px flex-1 bg-line" />
        <span className="text-xs text-faint uppercase">or</span>
        <span aria-hidden className="h-px flex-1 bg-line" />
      </div>

      <button
        type="button"
        className="btn w-full"
        onClick={handleGoogle}
        disabled={busy !== null}
      >
        {busy === "google" ? <Spinner /> : <GoogleMark />}
        Continue with Google
      </button>

      <p className="mt-5 text-center text-sm text-muted">
        {copy.switchText}{" "}
        <Link
          href={`${copy.switchHref}?next=${encodeURIComponent(next)}`}
          className="font-medium text-accent hover:underline"
        >
          {copy.switchLabel}
        </Link>
      </p>
    </div>
  );
}

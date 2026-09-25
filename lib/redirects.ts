/**
 * A `next` parameter, but only when it is a path on this site.
 *
 * The sign-in page sends the visitor on to wherever they were headed, and that
 * destination arrives in the URL — so it is attacker-controlled. Without this
 * check `?next=https://evil.example` turns the real sign-in page into an open
 * redirect: the visitor signs in on the genuine site and is then handed to
 * someone else's, which is exactly the shape a phishing link needs.
 *
 * Only a single-slash-prefixed path is allowed, which refuses absolute URLs
 * (`https://…`) and protocol-relative ones (`//evil.example`) alike.
 */
export function safeNextPath(value: string | null | undefined): string {
  const fallback = "/dashboard";
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

import Link from "next/link";

/**
 * The one footer the public pages share.
 *
 * It exists as a component because the legal links have to appear on the landing
 * page and on all three policy pages a payment provider reviews, and three
 * copies of one list is how a link ends up on two of them.
 */
const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/refunds", label: "Refunds" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs leading-relaxed text-faint sm:px-6 md:flex-row md:items-start md:justify-between">
        <p className="max-w-2xl">
          ToolStackAI Book Studio · format.toolstackai.xyz — manuscripts are
          analysed and rendered server-side, and a format reports the missing
          package when its renderer is not installed.
        </p>
        <nav aria-label="Legal" className="flex shrink-0 flex-wrap gap-4">
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="underline decoration-line-strong underline-offset-2 transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

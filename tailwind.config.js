/**
 * Platinum, Obsidian and Warm Gold palette.
 *
 * The app is on Tailwind v4, where the theme normally lives in `@theme` inside
 * app/globals.css. This file is wired in with the `@config` directive there, and
 * holds the literal scales: `bg-obsidian-900`, `text-platinum-100`,
 * `border-slate-800` and friends.
 *
 * The semantic tokens the components actually use (surface, ink, accent, line…)
 * stay declared in `@theme`, because they have to exist as CSS variables —
 * `.btn-primary` and `.card` read them as var(--color-*), and
 * `accent-[var(--color-accent)]` in AdvancedSettings.tsx reads one directly.
 * They are remapped onto the scales below rather than renamed, so no component
 * needed its classNames rewritten for this rebrand.
 *
 * `content` is intentionally absent: v4 detects sources itself and ignores a
 * `content` glob supplied through a JS config.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        platinum: {
          50: "#f8fafc",
          100: "#f1f5f9",
          300: "#cbd5e1",
          500: "#94a3b8",
          900: "#0f172a",
        },
        gold: {
          400: "#e5c158",
          500: "#d4af37",
          600: "#b89228",
        },
        obsidian: {
          800: "#111827",
          900: "#0b0f17",
        },
        // The three standalone accents from the brief.
        "ink-slate": "#1E293B",
        "gold-soft": "#C5A880",
        "obsidian-deep": "#0F172A",
      },
    },
  },
};

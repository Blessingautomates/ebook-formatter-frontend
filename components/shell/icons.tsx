import type { SVGProps } from "react";

/**
 * The shell's icon set, drawn inline.
 *
 * There is no icon library in package.json, and adding one for a sidebar's
 * worth of glyphs would be a dependency the whole bundle pays for. These are
 * stroke-based and inherit `currentColor`, so they take the colour of whatever
 * text they sit beside and need no per-use styling.
 *
 * Every icon is decorative: the nav item beside it already carries the label,
 * so `aria-hidden` keeps a screen reader from reading the name twice.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[1.15rem] shrink-0"
      {...props}
    >
      {children}
    </svg>
  );
}

export function CoverIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
      <path d="M8.5 4v16" />
      <path d="M12.5 9h5M12.5 12.5h5M12.5 16h3" />
    </Icon>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </Icon>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16" />
      <path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
      <path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
      <path d="M10.5 11v5.5M13.5 11v5.5" />
    </Icon>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5.5A2 2 0 0 1 6 3.5h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2z" />
      <path d="M8 3.5v17" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function CreditsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M9.5 9.75h3.75a1.75 1.75 0 0 1 0 3.5h-3.5a1.75 1.75 0 0 0 0 3.5H13.5" />
    </Icon>
  );
}

export function TemplateIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M3.5 9h17M9 9v11" />
    </Icon>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 7h14M5 12h14M5 17h14" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="8" cy="17" r="2" />
    </Icon>
  );
}

export function TranslateIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6h9M8.5 6V4.5M10.5 6c0 4-2.5 7.5-6.5 9.5" />
      <path d="M6 10.5c1 2 2.5 3.5 4.5 4.5" />
      <path d="m13 20 3.5-8 3.5 8M14.5 17h4" />
    </Icon>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3.25 3.25 0 0 1 0 6.5M17.5 14.5a5.5 5.5 0 0 1 3 5" />
    </Icon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M4.9 7.25l1.7 1M17.4 15.75l1.7 1M4.9 16.75l1.7-1M17.4 8.25l1.7-1" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 4.5 4.5" />
    </Icon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10Z" />
      <path d="M10.25 18.5a2 2 0 0 0 3.5 0" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9.5 6 6 6-6" />
    </Icon>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 13.75 9 19 10.75 13.75 12.5 12 18l-1.75-5.5L5 10.75 10.25 9z" />
    </Icon>
  );
}

export function BuildingIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20V6.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1V20" />
      <path d="M13 10h6a1 1 0 0 1 1 1v9M3 20h18" />
      <path d="M7 9h2.5M7 13h2.5M7 17h2.5M16 14h1.5M16 17h1.5" />
    </Icon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Icon>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 16V4.5M7.5 9 12 4.5 16.5 9" />
      <path d="M4.5 15v3.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V15" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 19 6v6c0 4-3 7-7 8.5C8 19 5 16 5 12V6z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

export function ExportIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4.5V16M7.5 11.5 12 16l4.5-4.5" />
      <path d="M4.5 15v3.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V15" />
    </Icon>
  );
}

export function TypeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 6.5V5h14v1.5M12 5v14M9 19h6" />
    </Icon>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.45v.25" />
      <path d="M12 16.75h.01" />
    </Icon>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10.25 8.75 15.5 12l-5.25 3.25z" />
    </Icon>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 12.5a7 7 0 0 1-7 7H8l-4 2.5.9-3.6A7 7 0 0 1 4 12.5v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7z" />
    </Icon>
  );
}

"use client";

import {
  Building2,
  ChevronDown,
  FileUp,
  House,
  type LucideIcon,
  MapIcon,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { CommandPalette, type PaletteHospital } from "@/components/command-palette";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type CurrentUser, UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Other routes that belong to this item, e.g. the edit pages behind Input Data. */
  also?: string[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
  /** Its icons sit white on a blue tile instead of plain grey. */
  tiled?: boolean;
};

/** Sits on its own above the groups. */
const HOME: NavItem = { href: "/", label: "Beranda", icon: House };

const NAV: NavGroup[] = [
  {
    label: "Rujukan",
    tiled: true,
    items: [
      { href: "/rekomendasi", label: "Cari Rujukan", icon: Route },
      // Bandingkan is reached from the hospital lists.
      { href: "/rumah-sakit", label: "Rumah Sakit", icon: Building2, also: ["/bandingkan"] },
      { href: "/peta", label: "Peta Rumah Sakit", icon: MapIcon },
    ],
  },
  {
    // Checking claims is its own job: only the hospitals to look at, each opening on its Klaim tab.
    label: "Klaim",
    tiled: true,
    items: [{ href: "/klaim", label: "Indikasi Klaim", icon: ShieldAlert }],
  },
  {
    label: "Entri",
    items: [{ href: "/input", label: "Input Data", icon: FileUp }],
  },
];

const isActive = (pathname: string, { href, also = [] }: NavItem) =>
  href === "/" ? pathname === "/" : [href, ...also].some((prefix) => pathname.startsWith(prefix));

const titleOf = (pathname: string) =>
  [HOME, ...NAV.flatMap((group) => group.items)].find((item) => isActive(pathname, item))?.label ?? "";

/** The hospital whose page this is, if it's one. */
const hospitalOf = (pathname: string, hospitals: PaletteHospital[]) => {
  const id = pathname.match(/^\/rumah-sakit\/([^/]+)/)?.[1];
  return id ? hospitals.find((h) => h.id === decodeURIComponent(id)) : undefined;
};

// The collapsed state lives on <html data-sidebar> (set before paint in the root layout) so CSS can style it without a flash.
const readCollapsed = () =>
  document.documentElement.dataset.sidebar === "collapsed";

const subscribeCollapsed = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-sidebar"],
  });
  return () => observer.disconnect();
};

const setCollapsed = (collapsed: boolean) => {
  if (collapsed) document.documentElement.dataset.sidebar = "collapsed";
  else delete document.documentElement.dataset.sidebar;
  try {
    localStorage.setItem("sidebar", collapsed ? "collapsed" : "expanded");
  } catch {
    // Storage can be unavailable (private mode); the choice still applies for this visit.
  }
};

const useSidebarCollapsed = () =>
  useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);

// The shortcut hint matches the keyboard: ⌘ on Apple devices, Ctrl elsewhere.
const subscribeNothing = () => () => {};
const readModKey = () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl");
const useModKey = () => useSyncExternalStore(subscribeNothing, readModKey, () => "⌘");

const LOGO = "/databiota-logo.png";
const LOGO_HEIGHT = 22;

// Fades labels out as the sidebar narrows, in step with the width transition.
const FADE =
  "transition-opacity duration-200 ease-out motion-reduce:transition-none sidebar-collapsed:opacity-0";

export function AppShell({
  user,
  hospitals,
  children,
}: {
  user: CurrentUser;
  hospitals: PaletteHospital[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const collapsed = useSidebarCollapsed();
  const hospital = hospitalOf(pathname, hospitals);
  // Which groups are folded away; shared by the desktop sidebar and the mobile drawer.
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const toggleGroup = (label: string) =>
    setClosedGroups((closed) => (closed.includes(label) ? closed.filter((l) => l !== label) : [...closed, label]));
  const openSearch = () => {
    setOpen(false);
    setSearchOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-shell">
      <aside className="sticky top-0 hidden h-screen w-50 shrink-0 overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none lg:block sidebar-collapsed:w-11">
        <Sidebar pathname={pathname} user={user} onSearch={openSearch} closedGroups={closedGroups} onToggleGroup={toggleGroup} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Tutup menu"
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <aside className="relative h-full w-72 max-w-[85vw] bg-shell shadow-xl">
            <button
              aria-label="Tutup menu"
              className="absolute top-5 right-3 rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </button>
            <Sidebar
              pathname={pathname}
              user={user}
              onSearch={openSearch}
              closedGroups={closedGroups}
              onToggleGroup={toggleGroup}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:py-2 lg:pr-2">
        <div className="flex min-h-0 flex-1 flex-col bg-background lg:rounded-xl lg:shadow-[0_1px_2px_rgb(0_0_0/0.04),0_0_0_1px_var(--border)]">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <button
              aria-label="Buka menu"
              className="-ml-1.5 rounded-md p-1.5 text-muted-foreground hover:bg-accent lg:hidden"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-5" />
            </button>
            <button
              aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
              aria-expanded={!collapsed}
              className="-ml-1 hidden rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground lg:block"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
            {hospital ? (
              <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
                <Link href="/rumah-sakit" className="shrink-0 transition-colors hover:text-foreground">
                  Rumah Sakit
                </Link>
                <span aria-hidden>/</span>
                {pathname.endsWith("/perbarui") ? (
                  <>
                    <Link href={`/rumah-sakit/${hospital.id}`} className="truncate transition-colors hover:text-foreground">
                      {hospital.name}
                    </Link>
                    <span aria-hidden>/</span>
                    <span aria-current="page" className="shrink-0 font-medium text-foreground">
                      Perbarui tarif
                    </span>
                  </>
                ) : (
                  <span aria-current="page" className="truncate font-medium text-foreground">
                    {hospital.name}
                  </span>
                )}
              </nav>
            ) : (
              <h1 className="truncate text-sm text-foreground">{titleOf(pathname)}</h1>
            )}
          </header>
          <main className="min-w-0 flex-1 overflow-x-clip">{children}</main>
        </div>
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} hospitals={hospitals} />
    </div>
  );
}

// Nothing inside changes layout when collapsing: every item keeps its left offset and the narrowing
// aside clips it, so only the width animates. Container + item padding (8px + 6px) centers the 16px
// icons in the 44px collapsed rail.
function Sidebar({
  pathname,
  user,
  onSearch,
  closedGroups,
  onToggleGroup,
  onNavigate,
}: {
  pathname: string;
  user: CurrentUser;
  onSearch: () => void;
  closedGroups: string[];
  onToggleGroup: (label: string) => void;
  onNavigate?: () => void;
}) {
  const collapsed = useSidebarCollapsed();
  const modKey = useModKey();

  // The page under a clicked item can take a moment to load, so the item lights up on the click
  // and lets the URL take over once it arrives.
  const [clicked, setClicked] = useState<string | null>(null);
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setClicked(null);
  }
  const isCurrent = (item: NavItem) => (clicked ? item.href === clicked : isActive(pathname, item));

  const onItemClick = (href: string) => (event: React.MouseEvent) => {
    // A modified click opens a new tab and leaves this page where it is.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    setClicked(href);
    onNavigate?.();
  };

  return (
    <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto px-2 py-4">
      <Link href="/" onClick={onNavigate} aria-label="Databiota" className="mt-2 flex items-center gap-1 pl-0.5">
        {/* The logo PNG is white-only, so it's used as a mask and filled with the theme's foreground color.
            Its artwork touches the image's edges, so the dot mark and the wordmark each get a 1px margin
            to keep rounding from shaving them. Collapsed, only the mark stays, centred in the rail. */}
        <span
          aria-hidden
          className="block size-6 shrink-0 bg-sidebar-foreground"
          style={{ mask: `url(${LOGO}) 1px center / auto ${LOGO_HEIGHT}px no-repeat` }}
        />
        <span
          aria-hidden
          className={cn("block h-6 w-[118px] shrink-0 bg-sidebar-foreground", FADE)}
          style={{ mask: `url(${LOGO}) right 1px center / auto ${LOGO_HEIGHT}px no-repeat` }}
        />
      </Link>

      {/* Collapsed, the box drops away and only the icon stays, lined up with the nav icons below. */}
      <Tooltip disabled={!collapsed}>
        <TooltipTrigger
          render={
            <button
              onClick={onSearch}
              aria-keyshortcuts="Meta+K Control+K"
              className="mt-5 flex h-7 w-full items-center gap-2.5 overflow-hidden rounded-md border border-foreground/15 bg-background px-[5px] text-left whitespace-nowrap shadow-xs transition-colors hover:bg-background/80 sidebar-collapsed:border-transparent sidebar-collapsed:bg-transparent sidebar-collapsed:shadow-none sidebar-collapsed:hover:bg-sidebar-accent"
            />
          }
        >
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <span className={cn("flex-1 text-xs text-muted-foreground", FADE)}>Cari</span>
          <span className={cn("flex items-center gap-0.5", FADE)} aria-hidden>
            <kbd className="rounded border px-1 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">{modKey}</kbd>
            <kbd className="rounded border px-1 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">K</kbd>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">Cari</TooltipContent>
      </Tooltip>

      <nav className="mt-4 flex flex-col gap-3">
        <NavLink item={HOME} collapsed={collapsed} current={isCurrent(HOME)} onClick={onItemClick(HOME.href)} />
        {NAV.map((group) => {
          const groupOpen = !closedGroups.includes(group.label);
          return (
            <div key={group.label} className="flex flex-col gap-0.5">
              {/* Collapsed, the header gives way to a short rule of the same height, so the icons below don't move. */}
              <div className="relative flex h-6 items-center">
                <button
                  onClick={() => onToggleGroup(group.label)}
                  aria-expanded={groupOpen}
                  className={cn(
                    "flex h-full w-full items-center gap-1 rounded-md px-1 text-left whitespace-nowrap transition-colors hover:bg-sidebar-accent sidebar-collapsed:pointer-events-none",
                    FADE,
                  )}
                >
                  <ChevronDown className={cn("size-3 shrink-0 text-muted-foreground transition-transform", !groupOpen && "-rotate-90")} />
                  <span className="text-[11px] text-muted-foreground">{group.label}</span>
                </button>
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-1.5 h-px w-4 bg-border opacity-0 transition-opacity duration-200 ease-out motion-reduce:transition-none sidebar-collapsed:opacity-100"
                />
              </div>
              {/* The collapsed rail has no headers to unfold a group with, so it always lists every item. */}
              <div className={cn("flex flex-col gap-0.5", !groupOpen && "hidden sidebar-collapsed:flex")}>
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    tiled={group.tiled}
                    collapsed={collapsed}
                    current={isCurrent(item)}
                    onClick={onItemClick(item.href)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="mt-auto pt-4">
        <UserMenu user={user} labelClassName={FADE} />
      </div>
    </div>
  );
}

/** One item of the nav; `tiled` puts its icon white on a blue tile. */
function NavLink({
  item: { href, label, icon: Icon },
  tiled,
  collapsed,
  current,
  onClick,
}: {
  item: NavItem;
  tiled?: boolean;
  collapsed: boolean;
  current: boolean;
  onClick: (event: React.MouseEvent) => void;
}) {
  return (
    <Tooltip disabled={!collapsed}>
      <TooltipTrigger
        render={
          <Link
            href={href}
            onClick={onClick}
            aria-current={current ? "page" : undefined}
            className="flex h-7 items-center gap-2.5 overflow-hidden rounded-md px-1.5 text-[13px] font-medium whitespace-nowrap text-sidebar-foreground transition-colors hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground"
          />
        }
      >
        {tiled ? (
          <span className="flex size-4 shrink-0 items-center justify-center rounded bg-blue-500 text-white">
            <Icon className="size-3" />
          </span>
        ) : (
          <Icon className="size-4 shrink-0 text-muted-foreground/80" />
        )}
        <span className={FADE}>{label}</span>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

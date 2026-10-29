"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Building2, FileUp, type LucideIcon, MapIcon, Route, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type PaletteHospital = { id: string; name: string; city: string };

type Entry = { href: string; label: string; detail: string; group: string; icon: LucideIcon; keywords: string[] };

const PAGES: Entry[] = [
  { href: "/rekomendasi", label: "Cari Rujukan", detail: "Rekomendasi rumah sakit", group: "Halaman", icon: Route, keywords: ["rujukan", "rekomendasi", "korban", "beranda", "home"] },
  {
    href: "/rumah-sakit",
    label: "Rumah Sakit",
    detail: "Tarif, klaim, dan red flag",
    group: "Halaman",
    icon: Building2,
    keywords: ["rs", "daftar", "klaim", "red flag", "risiko", "banding", "bandingkan", "compare", "vip", "los", "gl", "berulang"],
  },
  { href: "/peta", label: "Peta Rumah Sakit", detail: "Lokasi rumah sakit", group: "Halaman", icon: MapIcon, keywords: ["peta", "map", "lokasi", "alamat"] },
  { href: "/input", label: "Input Data", detail: "Dokumen tarif dan data klaim", group: "Halaman", icon: FileUp, keywords: ["unggah", "upload", "tarif", "pdf", "input", "excel", "klaim"] },
];

// With nothing typed the list shows the pages and the first few hospitals.
const IDLE_HOSPITALS = 5;

const matches = (entry: Entry, query: string) =>
  [entry.label, entry.detail, ...entry.keywords].some((text) => text.toLowerCase().includes(query));

/** Jump to a page or a hospital by name; opens from the sidebar or with ⌘K / Ctrl+K anywhere. */
export function CommandPalette({
  open,
  onOpenChange,
  hospitals,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospitals: PaletteHospital[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

  const hospitalEntries = useMemo<Entry[]>(
    () =>
      hospitals.map((h) => ({
        href: `/rumah-sakit/${h.id}`,
        label: h.name,
        detail: h.city || "—",
        group: "Rumah sakit",
        icon: Building2,
        keywords: [],
      })),
    [hospitals],
  );

  const trimmed = query.trim().toLowerCase();
  const results = trimmed
    ? [...PAGES, ...hospitalEntries].filter((entry) => matches(entry, trimmed))
    : [...PAGES, ...hospitalEntries.slice(0, IDLE_HOSPITALS)];
  const groups = results.reduce<Record<string, Entry[]>>((acc, entry) => {
    (acc[entry.group] ??= []).push(entry);
    return acc;
  }, {});

  const changeQuery = (value: string) => {
    setQuery(value);
    setSelected(0);
  };

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) changeQuery("");
  };

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    close(false);
    router.push(entry.href);
  };

  const moveTo = (index: number) => {
    setSelected(index);
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveTo(Math.min(selected + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveTo(Math.max(selected - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[selected]);
    }
  };

  let index = 0;

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-[15vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-xl border bg-background shadow-2xl transition-[transform,opacity] duration-150 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
          <Dialog.Title className="sr-only">Cari</Dialog.Title>
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => changeQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Cari halaman atau rumah sakit…"
              aria-label="Cari halaman atau rumah sakit"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button aria-label="Hapus pencarian" onClick={() => changeQuery("")} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            )}
          </div>

          <div ref={listRef} className="max-h-[min(20rem,55dvh)] overflow-y-auto overscroll-contain py-1">
            {results.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Tidak ada hasil untuk &ldquo;{query.trim()}&rdquo;</p>
            ) : (
              Object.entries(groups).map(([group, entries]) => (
                <div key={group}>
                  <p className="px-4 py-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">{group}</p>
                  {entries.map((entry) => {
                    const i = index++;
                    const Icon = entry.icon;
                    return (
                      <button
                        key={entry.href}
                        data-index={i}
                        onMouseEnter={() => setSelected(i)}
                        onClick={() => go(entry)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                          selected === i ? "bg-accent" : "hover:bg-accent/50",
                        )}
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Icon className="size-4" />
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">{entry.label}</span>
                          <span className="truncate text-xs text-muted-foreground">{entry.detail}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-4 border-t px-4 py-2 text-[10px] text-muted-foreground">
            <span>
              <kbd className="rounded border px-1 font-mono">↑↓</kbd> pilih
            </span>
            <span>
              <kbd className="rounded border px-1 font-mono">↵</kbd> buka
            </span>
            <span>
              <kbd className="rounded border px-1 font-mono">Esc</kbd> tutup
            </span>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

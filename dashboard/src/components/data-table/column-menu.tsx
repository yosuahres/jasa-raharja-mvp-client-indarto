"use client";

import { Menu } from "@base-ui/react/menu";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, CircleCheck, EyeOff } from "lucide-react";

import { type SortDirection, SortDirectionIcon } from "@/components/data-table/sort-menu";
import { menuItem, menuPopup } from "@/components/data-table/styles";

/**
 * A column's header label, opening a small menu: sort ascending, sort descending, hide.
 * Choosing the sort it already has clears it. Without `onSort` (a column that can't be sorted) there is no
 * sorting, and without `onHide` (a required column) no hiding.
 */
export function ColumnMenu({
  label,
  sortDir,
  onSort,
  onHide,
}: {
  label: string;
  sortDir: SortDirection | null;
  onSort?: (dir: SortDirection) => void;
  onHide?: () => void;
}) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        title="Opsi kolom"
        className="group/th flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="truncate">{label}</span>
        <span className="flex-1" />
        {sortDir && <SortDirectionIcon dir={sortDir} className="size-3.5 shrink-0 text-foreground/70" />}
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover/th:text-muted-foreground group-data-popup-open/th:text-muted-foreground" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="isolate z-50 outline-none" sideOffset={6} align="start">
          <Menu.Popup className={menuPopup}>
            {onSort && (
              <>
                <Menu.Item className={menuItem} onClick={() => onSort("asc")}>
                  <ArrowUpNarrowWide className="text-muted-foreground" />
                  Urutkan naik
                  {sortDir === "asc" && <CircleCheck className="ml-auto size-3.5! text-primary" />}
                </Menu.Item>
                <Menu.Item className={menuItem} onClick={() => onSort("desc")}>
                  <ArrowDownWideNarrow className="text-muted-foreground" />
                  Urutkan turun
                  {sortDir === "desc" && <CircleCheck className="ml-auto size-3.5! text-primary" />}
                </Menu.Item>
              </>
            )}
            {onSort && onHide && <Menu.Separator className="-mx-1 my-1 h-px bg-border" />}
            {onHide && (
              <Menu.Item className={menuItem} onClick={onHide}>
                <EyeOff className="text-muted-foreground" />
                Sembunyikan kolom
              </Menu.Item>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

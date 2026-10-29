import Link from "next/link";

/** One row of link chips: the chosen one sits raised on the strip. */
export function Chips({ current, options, href }: { current: string; options: { value: string; label: string }[]; href: (value: string) => string }) {
  return (
    <div className="flex flex-wrap gap-1 self-start rounded-lg bg-muted/60 p-1 text-xs">
      {options.map((o) => (
        <Link
          key={o.value}
          href={href(o.value)}
          scroll={false}
          aria-current={current === o.value ? "true" : undefined}
          className="rounded-md px-2.5 py-1 font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=true]:bg-background aria-[current=true]:text-foreground aria-[current=true]:shadow-xs"
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

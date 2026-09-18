"use client";

import { useState, useRef, useEffect } from "react";
import { Popover } from "radix-ui";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ChevronDownIcon, XIcon } from "lucide-react";

interface MultiSelectProps {
  name: string;
  options: readonly string[];
  defaultValue?: string[];
  placeholder?: string;
  max?: number;
  className?: string;
}

export function MultiSelect({
  name,
  options,
  defaultValue = [],
  placeholder = "Select…",
  max,
  className,
}: MultiSelectProps) {
  const [selected, setSelected] = useState<string[]>(
    defaultValue.filter((v) => options.includes(v))
  );
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = options.filter(
    (o) =>
      o.toLowerCase().includes(search.toLowerCase()) && !selected.includes(o)
  );

  function toggle(value: string) {
    setSelected((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      if (max && prev.length >= max) return prev;
      return [...prev, value];
    });
    setSearch("");
  }

  function remove(value: string) {
    setSelected((prev) => prev.filter((v) => v !== value));
  }

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {selected.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}

      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-10 w-full flex-wrap items-center gap-1 rounded-lg border bg-background px-3 py-1.5 text-sm text-left",
            className
          )}
        >
          {selected.length === 0 && (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          {selected.map((v) => (
            <Badge
              key={v}
              variant="secondary"
              className="gap-1 pr-1"
              onClick={(e) => {
                e.stopPropagation();
                remove(v);
              }}
            >
              {v}
              <XIcon className="size-3" />
            </Badge>
          ))}
          <ChevronDownIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          className="z-50 w-(--radix-popover-trigger-width) rounded-lg border bg-popover p-1 shadow-md"
        >
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full border-b bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                No options
              </p>
            )}
            {filtered.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => toggle(o)}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                {o}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

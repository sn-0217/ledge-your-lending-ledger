import React, { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/common/GlassCard";
import { ClientOnly } from "@/components/common/ClientOnly";
import { useLedge } from "@/features/dataProvider";
import { useFormatMoney, initials, relativeDate } from "@/lib/formatters";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Filter,
  CheckSquare,
  Square,
  Tag,
  Trash2,
  ChevronRight,
  MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PersonRow } from "@/features/dataProvider";
import type { PersonTag } from "@/lib/types";

export const Route = createFileRoute("/people/")({
  head: () => ({ meta: [{ title: "People — Ledge" }] }),
  component: () => (
    <AppShell>
      <ClientOnly>
        <PeoplePage />
      </ClientOnly>
    </AppShell>
  ),
});

// React.memo optimized list item component to optimize mobile list performance
const PersonRowItem = React.memo(
  ({
    r,
    fmt,
    isBulkMode,
    isSelected,
    onToggleSelect,
  }: {
    r: PersonRow;
    fmt: (n: number) => string;
    isBulkMode: boolean;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
  }) => {
    return (
      <div className="flex items-center gap-3">
        {isBulkMode && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(r.person.id)}
            className="rounded-md border-white/20 data-[state=checked]:bg-primary"
          />
        )}
        <Link
          to="/people/$personId"
          params={{ personId: r.person.id }}
          className="flex-1 block min-w-0"
        >
          <GlassCard className="flex items-center gap-3 p-3 transition-transform active:scale-[0.98]">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 text-sm font-bold">
              {initials(r.person.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{r.person.name}</span>
                {r.person.tags?.map((t) => (
                  <Badge
                    key={t}
                    variant="outline"
                    className="text-[9px] uppercase tracking-wider px-1.5 py-0 border-white/10 bg-white/5 text-muted-foreground"
                  >
                    {t}
                  </Badge>
                ))}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {r.categories.length} {r.categories.length === 1 ? "category" : "categories"} ·{" "}
                {relativeDate(r.balance.lastActivity)}
              </div>
            </div>
            <div
              className={cn(
                "text-right text-sm font-semibold tabular-nums",
                r.balance.outstanding > 0 && "text-[oklch(0.85_0.18_155)]",
                r.balance.outstanding < 0 && "text-[oklch(0.78_0.22_22)]",
                r.balance.outstanding === 0 && "text-muted-foreground"
              )}
            >
              {r.balance.outstanding === 0 ? "Settled" : fmt(Math.abs(r.balance.outstanding))}
            </div>
          </GlassCard>
        </Link>
      </div>
    );
  }
);

PersonRowItem.displayName = "PersonRowItem";

function PeoplePage() {
  const { personRows: rows, deletePerson, updatePerson } = useLedge();
  const fmt = useFormatMoney();
  const [q, setQ] = useState("");
  const [tagFilter, setTagFilter] = useState<PersonTag | "all">("all");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "owes_me" | "i_owe" | "settled">("all");

  // Bulk Selection States
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = (visibleIds: string[]) => {
    if (selectedIds.size === visibleIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Delete ${selectedIds.size} selected people and all their transactions?`)) {
      try {
        await Promise.all(Array.from(selectedIds).map((id) => deletePerson(id)));
        setSelectedIds(new Set());
        setIsBulkMode(false);
      } catch (e) {
        console.error("Bulk delete failed", e);
      }
    }
  };

  const handleBulkAddTag = async (tag: PersonTag) => {
    if (selectedIds.size === 0) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map(async (id) => {
          const row = rows.find((r) => r.person.id === id);
          if (row) {
            const currentTags = row.person.tags || [];
            if (!currentTags.includes(tag)) {
              await updatePerson(id, { tags: [...currentTags, tag] });
            }
          }
        })
      );
      setSelectedIds(new Set());
      setIsBulkMode(false);
    } catch (e) {
      console.error("Bulk tagging failed", e);
    }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        // Text search match
        const matchesText =
          !needle ||
          r.person.name.toLowerCase().includes(needle) ||
          r.categories.some((c) => c.category.name.toLowerCase().includes(needle));

        // Tag match
        const matchesTag = tagFilter === "all" || (r.person.tags || []).includes(tagFilter);

        // Balance match
        let matchesBalance = true;
        if (balanceFilter === "owes_me") matchesBalance = r.balance.outstanding > 0.01;
        else if (balanceFilter === "i_owe") matchesBalance = r.balance.outstanding < -0.01;
        else if (balanceFilter === "settled") matchesBalance = r.balance.settled;

        return matchesText && matchesTag && matchesBalance;
      })
      .sort((a, b) => b.balance.lastActivity - a.balance.lastActivity);
  }, [rows, q, tagFilter, balanceFilter]);

  const visibleIds = useMemo(() => filtered.map((r) => r.person.id), [filtered]);

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <header className="flex items-end justify-between pt-2">
          <h1 className="text-2xl font-bold">People</h1>
        </header>
        <GlassCard className="p-8 text-center text-sm text-muted-foreground">
          No people added yet. Tap the green plus button below to add someone.
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold">People</h1>
          <p className="text-xs text-muted-foreground">{rows.length} total people</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={isBulkMode ? "secondary" : "outline"}
            onClick={() => {
              setIsBulkMode(!isBulkMode);
              setSelectedIds(new Set());
            }}
            className="rounded-full px-3 text-xs"
          >
            {isBulkMode ? "Cancel Select" : "Bulk Select"}
          </Button>
        </div>
      </header>

      {/* Advanced Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people or categories"
            className="glass rounded-full pl-9"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-col gap-2 pt-1">
          {/* Outstanding Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground shrink-0 pr-1">Balance:</span>
            {[
              { id: "all", label: "All" },
              { id: "owes_me", label: "Owes me" },
              { id: "i_owe", label: "I owe" },
              { id: "settled", label: "Settled" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setBalanceFilter(f.id as any)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border border-transparent transition-all whitespace-nowrap",
                  balanceFilter === f.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/5 text-muted-foreground hover:bg-white/10 border-white/5"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Tag Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground shrink-0 pr-1">Tags:</span>
            {[
              { id: "all", label: "All Tags" },
              { id: "family", label: "Family" },
              { id: "friends", label: "Friends" },
              { id: "work", label: "Work" },
              { id: "other", label: "Other" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setTagFilter(f.id as any)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border border-transparent transition-all whitespace-nowrap",
                  tagFilter === f.id
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "bg-white/5 text-muted-foreground hover:bg-white/10 border-white/5"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk Action Panel (Active when bulk select is true) */}
      {isBulkMode && (
        <GlassCard className="flex items-center justify-between p-3 border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedIds.size === visibleIds.length && visibleIds.length > 0}
              onCheckedChange={() => handleSelectAll(visibleIds)}
              className="rounded-md border-white/20 data-[state=checked]:bg-primary"
            />
            <span className="text-xs font-medium">{selectedIds.size} selected</span>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5">
              {/* Add Tag Dropdown simulation */}
              <div className="flex items-center gap-1">
                {(["family", "friends", "work", "other"] as PersonTag[]).map((t) => (
                  <Button
                    key={t}
                    size="icon"
                    variant="ghost"
                    title={`Tag as ${t}`}
                    onClick={() => handleBulkAddTag(t)}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <Tag className="h-3.5 w-3.5" />
                  </Button>
                ))}
              </div>
              <div className="h-4 w-px bg-white/10 mx-1" />
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                className="h-7 rounded-full text-xs gap-1"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </Button>
            </div>
          )}
        </GlassCard>
      )}

      {/* People List */}
      {filtered.length === 0 ? (
        <GlassCard className="p-8 text-center text-sm text-muted-foreground">
          No results. Try a different filter or search query.
        </GlassCard>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.person.id}>
              <PersonRowItem
                r={r}
                fmt={fmt}
                isBulkMode={isBulkMode}
                isSelected={selectedIds.has(r.person.id)}
                onToggleSelect={handleToggleSelect}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { FrequencyCaps, QuietHours } from "@/lib/db/schema/brands";

import { updateComplianceAction } from "./actions";

export type ComplianceInitial = {
  quietHours: QuietHours | null;
  frequencyCaps: FrequencyCaps | null;
  supervisedMode: boolean;
} | null;

export function ComplianceForm({
  initial,
  onSaved,
  submitLabel = "Save compliance settings",
}: {
  initial: ComplianceInitial;
  onSaved?: () => void;
  submitLabel?: string;
}) {
  const [start, setStart] = useState(initial?.quietHours?.start ?? "09:00");
  const [end, setEnd] = useState(initial?.quietHours?.end ?? "21:00");
  const [perDay, setPerDay] = useState(String(initial?.frequencyCaps?.perDay ?? 1));
  const [perWeek, setPerWeek] = useState(String(initial?.frequencyCaps?.perWeek ?? 3));
  // Supervised mode defaults ON when there is no saved compliance config yet.
  const [supervisedMode, setSupervisedMode] = useState(initial?.supervisedMode ?? true);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const day = Number.parseInt(perDay, 10);
    const week = Number.parseInt(perWeek, 10);
    if (!Number.isFinite(day) || !Number.isFinite(week) || day < 0 || week < 0) {
      toast.error("Frequency caps must be zero or a positive number.");
      return;
    }
    startTransition(async () => {
      const r = await updateComplianceAction({
        quietHours: { start, end },
        frequencyCaps: { perDay: day, perWeek: week },
        supervisedMode,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Compliance settings saved.");
      onSaved?.();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Quiet hours</h3>
          <p className="text-xs text-muted-foreground">
            Outbound is held outside this window (customer&apos;s local time, 24-hour).
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label htmlFor="quiet-start">Start</Label>
            <Input
              id="quiet-start"
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quiet-end">End</Label>
            <Input
              id="quiet-end"
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Frequency caps</h3>
          <p className="text-xs text-muted-foreground">
            The most proactive outbound messages a customer can receive.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label htmlFor="cap-per-day">Per day</Label>
            <Input
              id="cap-per-day"
              type="number"
              min={0}
              value={perDay}
              onChange={(e) => setPerDay(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cap-per-week">Per week</Label>
            <Input
              id="cap-per-week"
              type="number"
              min={0}
              value={perWeek}
              onChange={(e) => setPerWeek(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-1">
          <Label htmlFor="supervised-mode" className="text-sm font-medium">
            Hold agent replies for human approval
          </Label>
          <p className="text-xs text-muted-foreground">
            Supervised mode queues every outbound message for a teammate to approve before it sends.
          </p>
        </div>
        <Switch
          id="supervised-mode"
          checked={supervisedMode}
          onCheckedChange={setSupervisedMode}
        />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

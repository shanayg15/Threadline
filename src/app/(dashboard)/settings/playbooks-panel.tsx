"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { togglePlaybookAction } from "./actions";

type PlaybookRow = {
  id: string;
  key: string;
  enabled: boolean;
  delayMinutes: number | null;
};

/** delivery_checkin → "Delivery check-in". */
function humanizeKey(key: string): string {
  const words = key.split("_").filter((w) => w.length > 0);
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
}

function delayLabel(delayMinutes: number | null): string | null {
  if (delayMinutes == null) return null;
  if (delayMinutes === 0) return "Runs immediately";
  if (delayMinutes < 60) return `Waits ${delayMinutes} min`;
  const hours = Math.round(delayMinutes / 60);
  if (hours < 48) return `Waits ~${hours}h`;
  return `Waits ~${Math.round(hours / 24)}d`;
}

function PlaybookToggle({ playbook }: { playbook: PlaybookRow }) {
  const [enabled, setEnabled] = useState(playbook.enabled);
  const [isPending, startTransition] = useTransition();
  const delay = delayLabel(playbook.delayMinutes);

  function onToggle(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const r = await togglePlaybookAction(playbook.id, next);
      if (!r.ok) {
        setEnabled(!next);
        toast.error(r.error);
        return;
      }
      toast.success(next ? "Playbook enabled." : "Playbook disabled.");
    });
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1">
        <Label htmlFor={`playbook-${playbook.id}`} className="text-sm font-medium">
          {humanizeKey(playbook.key)}
        </Label>
        {delay ? <p className="text-xs text-muted-foreground">{delay}</p> : null}
      </div>
      <Switch
        id={`playbook-${playbook.id}`}
        checked={enabled}
        onCheckedChange={onToggle}
        disabled={isPending}
      />
    </div>
  );
}

export function PlaybooksPanel({ playbooks }: { playbooks: PlaybookRow[] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Proactive follow-up campaigns the agent can run. These start firing in M8 once the lifecycle
        engine is live.
      </p>
      {playbooks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No playbooks configured yet.</p>
      ) : (
        <div className="space-y-2">
          {playbooks.map((p) => (
            <PlaybookToggle key={p.id} playbook={p} />
          ))}
        </div>
      )}
    </div>
  );
}

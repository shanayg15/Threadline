"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { VoiceConfig } from "@/lib/db/schema/brands";

import { updateVoiceAction } from "./actions";

type Formality = VoiceConfig["formality"];

const FORMALITY_OPTIONS: { value: Formality; label: string }[] = [
  { value: "casual", label: "Casual" },
  { value: "neutral", label: "Neutral" },
  { value: "formal", label: "Formal" },
];

/** Splits a textarea value into trimmed, non-empty lines. */
function nonEmptyLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function VoiceForm({
  initial,
  onSaved,
  submitLabel = "Save brand voice",
}: {
  initial: VoiceConfig | null;
  onSaved?: () => void;
  submitLabel?: string;
}) {
  const [agentName, setAgentName] = useState(initial?.agentName ?? "");
  const [toneExemplars, setToneExemplars] = useState((initial?.toneExemplars ?? []).join("\n"));
  const [bannedPhrases, setBannedPhrases] = useState((initial?.bannedPhrases ?? []).join("\n"));
  const [formality, setFormality] = useState<Formality>(initial?.formality ?? "neutral");
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = agentName.trim();
    if (!name) {
      toast.error("Give your agent a name.");
      return;
    }
    startTransition(async () => {
      const r = await updateVoiceAction({
        agentName: name,
        toneExemplars: nonEmptyLines(toneExemplars),
        bannedPhrases: nonEmptyLines(bannedPhrases),
        formality,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Brand voice saved.");
      onSaved?.();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="voice-agent-name">Agent name</Label>
        <Input
          id="voice-agent-name"
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
          placeholder="e.g. Remy"
        />
        <p className="text-xs text-muted-foreground">
          The name the agent signs off with in customer threads.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="voice-tone-exemplars">Tone exemplars</Label>
        <Textarea
          id="voice-tone-exemplars"
          value={toneExemplars}
          onChange={(e) => setToneExemplars(e.target.value)}
          rows={4}
          placeholder={"One example per line\nWarm but to the point — like texting a friend who works here."}
        />
        <p className="text-xs text-muted-foreground">
          Short snippets that capture how your brand sounds. One per line.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="voice-banned-phrases">Banned phrases</Label>
        <Textarea
          id="voice-banned-phrases"
          value={bannedPhrases}
          onChange={(e) => setBannedPhrases(e.target.value)}
          rows={3}
          placeholder={"One phrase per line the agent must never use"}
        />
        <p className="text-xs text-muted-foreground">
          Wording the agent must avoid. One per line.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="voice-formality">Formality</Label>
        <Select value={formality} onValueChange={(v) => setFormality(v as Formality)}>
          <SelectTrigger id="voice-formality" className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMALITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

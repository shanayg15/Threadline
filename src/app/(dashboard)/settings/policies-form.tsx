"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Policies } from "@/lib/db/schema/brands";

import { updatePoliciesAction } from "./actions";

export function PoliciesForm({
  initial,
  onSaved,
  submitLabel = "Save policies",
}: {
  initial: Policies | null;
  onSaved?: () => void;
  submitLabel?: string;
}) {
  const [returns, setReturns] = useState(initial?.returns ?? "");
  const [shipping, setShipping] = useState(initial?.shipping ?? "");
  const [exchange, setExchange] = useState(initial?.exchange ?? "");
  const [other, setOther] = useState(initial?.other ?? "");
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const otherTrimmed = other.trim();
    startTransition(async () => {
      const r = await updatePoliciesAction({
        returns: returns.trim(),
        shipping: shipping.trim(),
        exchange: exchange.trim(),
        ...(otherTrimmed ? { other: otherTrimmed } : {}),
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Policies saved.");
      onSaved?.();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <p className="text-sm text-muted-foreground">
        The agent answers from this text and never invents policy. Saving re-embeds it into the
        agent&apos;s knowledge base so answers stay accurate.
      </p>

      <div className="space-y-2">
        <Label htmlFor="policy-returns">Returns</Label>
        <Textarea
          id="policy-returns"
          value={returns}
          onChange={(e) => setReturns(e.target.value)}
          rows={4}
          placeholder="Describe your returns policy in plain language."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="policy-shipping">Shipping</Label>
        <Textarea
          id="policy-shipping"
          value={shipping}
          onChange={(e) => setShipping(e.target.value)}
          rows={4}
          placeholder="Shipping timelines, regions, costs, carriers."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="policy-exchange">Exchanges</Label>
        <Textarea
          id="policy-exchange"
          value={exchange}
          onChange={(e) => setExchange(e.target.value)}
          rows={4}
          placeholder="How exchanges work — sizes, swaps, windows."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="policy-other">Other (optional)</Label>
        <Textarea
          id="policy-other"
          value={other}
          onChange={(e) => setOther(e.target.value)}
          rows={3}
          placeholder="Warranty, gift cards, anything else the agent should know."
        />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

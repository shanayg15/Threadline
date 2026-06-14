"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { connectShopifyAction, setChannelNumberAction } from "./actions";

export function IntegrationsPanel({
  shopifyStatus,
  shopDomain,
  phoneNumber,
  onConnected,
  onNumberSaved,
}: {
  shopifyStatus: string | null;
  shopDomain: string | null;
  phoneNumber: string | null;
  onConnected?: () => void;
  onNumberSaved?: () => void;
}) {
  const connected = shopifyStatus === "connected";
  const [showShopifyForm, setShowShopifyForm] = useState(!connected);
  const [domainInput, setDomainInput] = useState(shopDomain ?? "");
  const [tokenInput, setTokenInput] = useState("");
  const [numberInput, setNumberInput] = useState(phoneNumber ?? "");
  const [shopifyPending, startShopify] = useTransition();
  const [numberPending, startNumber] = useTransition();

  function onConnectShopify(e: React.FormEvent) {
    e.preventDefault();
    const sd = domainInput.trim();
    const at = tokenInput.trim();
    if (!sd || !at) {
      toast.error("Both the shop domain and access token are required.");
      return;
    }
    startShopify(async () => {
      const r = await connectShopifyAction({ shopDomain: sd, accessToken: at });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Shopify connected.");
      setTokenInput("");
      setShowShopifyForm(false);
      onConnected?.();
    });
  }

  function onSaveNumber(e: React.FormEvent) {
    e.preventDefault();
    startNumber(async () => {
      const r = await setChannelNumberAction(numberInput.trim());
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Messaging number saved.");
      onNumberSaved?.();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle>Shopify</CardTitle>
              <CardDescription>
                Connect your store so the agent answers from live catalog, customers, and orders.
              </CardDescription>
            </div>
            <StatusBadge status={connected ? "opted_in" : "unknown"} className="shrink-0" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {connected && !showShopifyForm ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">
                Connected to <span className="font-medium">{shopDomain ?? "your store"}</span>.
              </p>
              <Button variant="outline" size="sm" onClick={() => setShowShopifyForm(true)}>
                Reconnect
              </Button>
            </div>
          ) : (
            <form onSubmit={onConnectShopify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shopify-domain">Shop domain</Label>
                <Input
                  id="shopify-domain"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="your-store.myshopify.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shopify-token">Admin API access token</Label>
                <Input
                  id="shopify-token"
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="shpat_…"
                />
                <p className="text-xs text-muted-foreground">
                  Use a custom-app Admin API token from your Shopify admin.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={shopifyPending}>
                  {shopifyPending ? "Connecting…" : connected ? "Reconnect Shopify" : "Connect Shopify"}
                </Button>
                {connected ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowShopifyForm(false)}
                    disabled={shopifyPending}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Messaging number</CardTitle>
          <CardDescription>
            The Twilio number your concierge texts from, in E.164 format.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSaveNumber} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="twilio-number">Number</Label>
              <Input
                id="twilio-number"
                value={numberInput}
                onChange={(e) => setNumberInput(e.target.value)}
                placeholder="+15555550100"
                className="sm:w-64"
              />
              <p className="text-xs text-muted-foreground">
                10DLC must be approved for production; dev runs on the mock send
                (SEND_REAL_SMS=false).
              </p>
            </div>
            <Button type="submit" disabled={numberPending}>
              {numberPending ? "Saving…" : "Save number"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

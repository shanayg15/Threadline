import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeuristicTracking } from "./heuristic";

// These tests assume the default DELIVERY_HEURISTIC_DAYS = 5 (no env override in
// the test runtime). The window is therefore shippedAt + 5 days.
const WINDOW_DAYS = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const SHIPPED_AT = new Date("2026-06-01T00:00:00.000Z");
const DUE = new Date(SHIPPED_AT.getTime() + WINDOW_DAYS * MS_PER_DAY); // 2026-06-06T00:00:00Z

describe("HeuristicTracking.getDelivery", () => {
  const provider = new HeuristicTracking();

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports delivered (carrier-confirmed) when deliveredAt is set", async () => {
    const deliveredAt = new Date("2026-06-03T12:00:00.000Z");
    // "now" is irrelevant when the carrier already confirmed delivery.
    vi.setSystemTime(new Date("2026-06-02T00:00:00.000Z"));

    const info = await provider.getDelivery({ shippedAt: SHIPPED_AT, deliveredAt });

    expect(info).toEqual({ delivered: true, deliveredAt, eta: null });
  });

  it("is not-delivered before the window, with eta = shippedAt + N days", async () => {
    // One day before the due date.
    vi.setSystemTime(new Date(DUE.getTime() - MS_PER_DAY));

    const info = await provider.getDelivery({ shippedAt: SHIPPED_AT, deliveredAt: null });

    expect(info).toEqual({ delivered: false, deliveredAt: null, eta: DUE });
  });

  it("is delivered at/after the window, with deliveredAt = the due date", async () => {
    // Exactly at the due date (now >= due) counts as delivered.
    vi.setSystemTime(DUE);

    const info = await provider.getDelivery({ shippedAt: SHIPPED_AT, deliveredAt: null });

    expect(info).toEqual({ delivered: true, deliveredAt: DUE, eta: null });
  });

  it("is not-delivered when never shipped", async () => {
    vi.setSystemTime(new Date("2026-06-30T00:00:00.000Z"));

    const info = await provider.getDelivery({ shippedAt: null, deliveredAt: null });

    expect(info).toEqual({ delivered: false, deliveredAt: null, eta: null });
  });
});

import { describe, expect, it } from "vitest";

import {
  calculateEnterpriseMonthlyPrice,
  ENTERPRISE_PRICING_BANDS,
  formatPriceCents,
  PLANS,
  PLAN_ORDER,
} from "./plans";

describe("calculateEnterpriseMonthlyPrice", () => {
  it("suggests a non-Enterprise plan for a single location", () => {
    const res = calculateEnterpriseMonthlyPrice(1);
    expect(res.suggestedNonEnterprisePlan).toBe("pro");
  });

  it("2 locations lands in the entry band ($89/loc)", () => {
    const res = calculateEnterpriseMonthlyPrice(2);
    expect(res.perLocationCents).toBe(8900);
    expect(res.totalMonthlyCents).toBe(17800); // 2 × $89
    expect(res.band.minLocations).toBe(2);
    expect(res.band.maxLocations).toBe(4);
  });

  it("3 locations = $267/mo per the plan's boundary math", () => {
    const res = calculateEnterpriseMonthlyPrice(3);
    expect(res.totalMonthlyCents).toBe(26700); // 3 × $89
  });

  it("4 locations = top of the entry band, still $89/loc", () => {
    const res = calculateEnterpriseMonthlyPrice(4);
    expect(res.perLocationCents).toBe(8900);
    expect(res.totalMonthlyCents).toBe(35600); // 4 × $89
  });

  it("5 locations bumps into the middle band ($79/loc)", () => {
    const res = calculateEnterpriseMonthlyPrice(5);
    expect(res.perLocationCents).toBe(7900);
    expect(res.totalMonthlyCents).toBe(39500); // 5 × $79
    expect(res.band.minLocations).toBe(5);
  });

  it("6 locations = $474/mo per the plan's boundary math", () => {
    const res = calculateEnterpriseMonthlyPrice(6);
    expect(res.totalMonthlyCents).toBe(47400); // 6 × $79
  });

  it("9 locations = top of the middle band, still $79/loc", () => {
    const res = calculateEnterpriseMonthlyPrice(9);
    expect(res.perLocationCents).toBe(7900);
    expect(res.totalMonthlyCents).toBe(71100); // 9 × $79
  });

  it("10 locations bumps into the top band ($69/loc)", () => {
    const res = calculateEnterpriseMonthlyPrice(10);
    expect(res.perLocationCents).toBe(6900);
    expect(res.totalMonthlyCents).toBe(69000); // 10 × $69
    expect(res.band.minLocations).toBe(10);
    expect(res.band.maxLocations).toBeNull();
  });

  it("12 locations = $828/mo per the plan's boundary math", () => {
    const res = calculateEnterpriseMonthlyPrice(12);
    expect(res.totalMonthlyCents).toBe(82800); // 12 × $69
  });

  it("20 locations stays in the top band, scales linearly", () => {
    const res = calculateEnterpriseMonthlyPrice(20);
    expect(res.perLocationCents).toBe(6900);
    expect(res.totalMonthlyCents).toBe(138000); // 20 × $69
  });

  it("100 locations still in top band — no arbitrary cap", () => {
    const res = calculateEnterpriseMonthlyPrice(100);
    expect(res.perLocationCents).toBe(6900);
    expect(res.totalMonthlyCents).toBe(690000);
  });

  it("rejects 0 and negative counts", () => {
    expect(() => calculateEnterpriseMonthlyPrice(0)).toThrow();
    expect(() => calculateEnterpriseMonthlyPrice(-1)).toThrow();
  });

  it("rejects NaN / Infinity", () => {
    expect(() => calculateEnterpriseMonthlyPrice(NaN)).toThrow();
    expect(() =>
      calculateEnterpriseMonthlyPrice(Number.POSITIVE_INFINITY),
    ).toThrow();
  });
});

describe("PLANS config", () => {
  it("has every tier present in PLAN_ORDER", () => {
    for (const id of PLAN_ORDER) {
      expect(PLANS[id]).toBeDefined();
      expect(PLANS[id].id).toBe(id);
    }
  });

  it("Shop is the only recommended plan", () => {
    const recommended = PLAN_ORDER.filter((id) => PLANS[id].recommended);
    expect(recommended).toEqual(["shop"]);
  });

  it("Enterprise is the only per-location-priced plan", () => {
    const perLocation = PLAN_ORDER.filter((id) => PLANS[id].perLocationPricing);
    expect(perLocation).toEqual(["enterprise"]);
  });

  it("prices ascend from Free to Pro", () => {
    expect(PLANS.free.monthlyPriceCents).toBe(0);
    expect(PLANS.solo.monthlyPriceCents).toBe(2900);
    expect(PLANS.shop.monthlyPriceCents).toBe(5900);
    expect(PLANS.pro.monthlyPriceCents).toBe(9900);
    expect(PLANS.enterprise.monthlyPriceCents).toBeNull();
  });

  it("Free is limited to 1 user, 1 location", () => {
    expect(PLANS.free.entitlements.maxUsers).toBe(1);
    expect(PLANS.free.entitlements.maxLocations).toBe(1);
  });

  it("Solo / Shop / Pro are unlimited users, 1 location", () => {
    for (const id of ["solo", "shop", "pro"] as const) {
      expect(PLANS[id].entitlements.maxUsers).toBeNull();
      expect(PLANS[id].entitlements.maxLocations).toBe(1);
    }
  });

  it("storage allowances ascend across paid tiers", () => {
    expect(PLANS.free.entitlements.storageBytes).toBe(0);
    expect(PLANS.solo.entitlements.storageBytes).toBeGreaterThan(0);
    expect(PLANS.shop.entitlements.storageBytes).toBeGreaterThan(
      PLANS.solo.entitlements.storageBytes,
    );
    expect(PLANS.pro.entitlements.storageBytes).toBeGreaterThan(
      PLANS.shop.entitlements.storageBytes,
    );
  });
});

describe("ENTERPRISE_PRICING_BANDS", () => {
  it("has three contiguous bands from 2 to unlimited", () => {
    expect(ENTERPRISE_PRICING_BANDS).toHaveLength(3);
    expect(ENTERPRISE_PRICING_BANDS[0].minLocations).toBe(2);
    expect(ENTERPRISE_PRICING_BANDS[ENTERPRISE_PRICING_BANDS.length - 1].maxLocations).toBeNull();
  });

  it("per-location rate decreases across bands", () => {
    for (let i = 1; i < ENTERPRISE_PRICING_BANDS.length; i++) {
      expect(ENTERPRISE_PRICING_BANDS[i].perLocationCents).toBeLessThan(
        ENTERPRISE_PRICING_BANDS[i - 1].perLocationCents,
      );
    }
  });
});

describe("formatPriceCents", () => {
  it("formats whole dollars without cents", () => {
    expect(formatPriceCents(2900)).toBe("$29");
    expect(formatPriceCents(0)).toBe("$0");
  });

  it("formats partial dollars with cents", () => {
    expect(formatPriceCents(2999)).toBe("$29.99");
    expect(formatPriceCents(150)).toBe("$1.50");
  });
});

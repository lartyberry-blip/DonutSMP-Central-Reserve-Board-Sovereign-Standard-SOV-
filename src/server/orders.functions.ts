import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "../../db/index.js";
import { orders, settings, priceHistory, economyEvents } from "../../db/schema.js";
import { eq, desc, gte, and } from "drizzle-orm";

const BUY_PRICE = 200000;
const FLOOR_PRICE = 150000;

// Anti-cheat thresholds: a single IGN filing more than 3 high-volume orders inside a rolling 60-second window is flagged.
const SPEED_EXPLOIT_WINDOW_SECONDS = 60;
const SPEED_EXPLOIT_MAX_ORDERS = 3;
// A "high-volume" order is any order with quantity >= this value.
const HIGH_VOLUME_THRESHOLD = 50;

// Circuit breaker: if the public "Total Wealth Protected" or system outflow velocity drops past this safety baseline within 1 hour, freeze redemptions.
const CIRCUIT_BREAKER_OUTFLOW_SOV = 1000; // SOV outflow in 1 hour that trips the breaker
const CIRCUIT_BREAKER_WINDOW_SECONDS = 3600;

export const TOKEN_BUY_PRICE = BUY_PRICE;
export const TOKEN_FLOOR_PRICE = FLOOR_PRICE;
export const TOKEN_HIGH_VOLUME_THRESHOLD = HIGH_VOLUME_THRESHOLD;

export type OrderStatus = "PENDING" | "LISTED_ON_AH" | "SETTLED";

export type OrderRow = {
  id: number;
  hash: string;
  ign: string;
  orderType: string;
  quantity: number;
  amount: number;
  settled: boolean;
  createdAt: Date | null;
  status: string;
  flagged: boolean;
  uniquePrice: number | null;
  altAccount: string | null;
  listedAt: Date | null;
};

export type LeaderboardRow = {
  id: number;
  ign: string;
  totalTokens: number;
  totalWealth: number;
};

export type StatsPayload = {
  circulatingSupply: number;
  tokenValue: number;
  totalWealthProtected: number;
  circuitBreakerActive: boolean;
};

export type PriceHistoryRow = {
  id: number;
  tokenValue: number;
  volumeDelta: number;
  reason: string;
  createdAt: Date | null;
};

export type EconomyEventRow = {
  id: number;
  transactionCount: number;
  volumeDelta: number;
  note: string | null;
  createdAt: Date | null;
};

export type OperatorStatus = {
  online: boolean;
  updatedAt: string | null;
  message: string;
};

function randomHash(): string {
  const segment = () =>
    Math.floor(1000 + Math.random() * 9000).toString();
  return `SOV-${segment()}-${segment().slice(0, 1)}`;
}

// Deterministic micro-pricing offset derived entirely from an order hash ID.
// Produces a stable single-digit increment (1..9) so multiple simultaneous $200,000 receipts each get a unique price ($200,001 vs $200,002 ...).
export function computeUniquePriceOffset(hash: string): number {
  let sum = 0;
  for (let i = 0; i < hash.length; i++) {
    const code = hash.charCodeAt(i);
    sum = (sum * 31 + code) % 1000003;
  }
  // Map to 1..9 (never 0 — the offset must visibly distinguish the receipt).
  return (sum % 9) + 1;
}

export const getStats = createServerFn({ method: "GET" }).handler(
  async () => {
    const settledOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.settled, true));

    let circulatingSupply = 0;
    for (const o of settledOrders) {
      if (o.orderType === "Buy") {
        circulatingSupply += o.quantity;
      } else {
        circulatingSupply -= o.quantity;
      }
    }
    if (circulatingSupply < 0) circulatingSupply = 0;

    const tokenValue = await getTokenValueInternal();

    const totalWealthProtected = circulatingSupply * tokenValue;

    const circuitBreakerActive = await isCircuitBreakerActive(circulatingSupply);

    return {
      circulatingSupply,
      tokenValue,
      totalWealthProtected,
      circuitBreakerActive,
    } satisfies StatsPayload;
  },
);

async function getTokenValueInternal(): Promise<number> {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "token_value"));
  if (rows.length === 0) {
    return FLOOR_PRICE;
  }
  const parsed = Number(rows[0].value);
  return Number.isFinite(parsed) ? parsed : FLOOR_PRICE;
}

async function setSetting(key: string, value: string): Promise<void> {
  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key));
  if (existing.length === 0) {
    await db.insert(settings).values({ key, value });
  } else {
    await db
      .update(settings)
      .set({ value })
      .where(eq(settings.key, key));
  }
}

export const getOrders = createServerFn({ method: "GET" }).handler(
  async () => {
    const rows = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt));
    return rows as OrderRow[];
  },
);

export const getLeaderboard = createServerFn({ method: "GET" }).handler(
  async () => {
    const settled = await db
      .select()
      .from(orders)
      .where(eq(orders.settled, true));

    const byIgn = new Map<string, number>();
    for (const o of settled) {
      const delta = o.orderType === "Buy" ? o.quantity : -o.quantity;
      byIgn.set(o.ign, (byIgn.get(o.ign) ?? 0) + delta);
    }

    const tokenValue = await getTokenValueInternal();

    const rows: LeaderboardRow[] = [];
    for (const [ign, totalTokens] of byIgn.entries()) {
      if (totalTokens <= 0) continue;
      rows.push({
        id: 0,
        ign,
        totalTokens,
        totalWealth: totalTokens * tokenValue,
      });
    }
    rows.sort((a, b) => b.totalTokens - a.totalTokens);
    rows.forEach((r, i) => (r.id = i + 1));
    return rows;
  },
);

// Returns the count of high-volume orders a given IGN has filed inside the rolling speed-exploit window.
async function countRecentHighVolumeOrders(ign: string): Promise<number> {
  const since = new Date(Date.now() - SPEED_EXPLOIT_WINDOW_SECONDS * 1000);
  const rows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.ign, ign),
        gte(orders.quantity, HIGH_VOLUME_THRESHOLD),
        gte(orders.createdAt, since),
      ),
    );
  return rows.length;
}

const CreateOrderSchema = z.object({
  ign: z.string().min(1).max(100),
  orderType: z.enum(["Buy", "Sell"]),
  quantity: z.number().int().min(1).max(500),
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator(CreateOrderSchema)
  .handler(async ({ data }) => {
    // Anti-cheat guard: check the rolling speed-exploit window BEFORE inserting.
    // The new order itself counts toward the limit, so the trip threshold is > 3 existing orders.
    const recentCount = await countRecentHighVolumeOrders(data.ign);
    const shouldFlag = recentCount >= SPEED_EXPLOIT_MAX_ORDERS;

    const unitPrice = data.orderType === "Buy" ? BUY_PRICE : FLOOR_PRICE;
    const amount = unitPrice * data.quantity;

    let hash = randomHash();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db
        .select()
        .from(orders)
        .where(eq(orders.hash, hash));
      if (existing.length === 0) break;
      hash = randomHash();
      attempts += 1;
    }

    const [inserted] = await db
      .insert(orders)
      .values({
        hash,
        ign: data.ign,
        orderType: data.orderType,
        quantity: data.quantity,
        amount,
        settled: false,
        status: "PENDING",
        flagged: shouldFlag,
      })
      .returning();

    return inserted as OrderRow;
  });

export const settleOrder = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const [existing] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, data.id));
    if (!existing) {
      throw new Error("Order not found");
    }
    // Flagged orders cannot settle until an admin manually approves them.
    if (existing.flagged) {
      throw new Error(
        "Order is flagged for review (⚠️ CRITICAL ECONOMIC ANOMALY - DETECTED SPEED EXPLOIT). Approve it first to release the escrow handshake.",
      );
    }

    const [updated] = await db
      .update(orders)
      .set({ settled: true, status: "SETTLED" })
      .where(eq(orders.id, data.id))
      .returning();

    if (!updated) {
      throw new Error("Order not found");
    }

    // A settled player trade is the strongest signal we have. Re-price from
    // real, recorded in-game buying and selling behavior before returning stats.
    await repriceFromPlayerBehavior();

    const stats = await computeStatsForOrder(updated);
    return { order: updated as OrderRow, stats };
  });

// Manually approves (un-flags) an order so its escrow handshake can resume.
const ApproveOrderSchema = z.object({ id: z.number() });
export const approveOrder = createServerFn({ method: "POST" })
  .inputValidator(ApproveOrderSchema)
  .handler(async ({ data }) => {
    const [updated] = await db
      .update(orders)
      .set({ flagged: false })
      .where(eq(orders.id, data.id))
      .returning();
    if (!updated) {
      throw new Error("Order not found");
    }
    return updated as OrderRow;
  });

async function computeStatsForOrder(
  _order: { ign: string; orderType: string; quantity: number },
): Promise<StatsPayload> {
  const settled = await db
    .select()
    .from(orders)
    .where(eq(orders.settled, true));

  const byIgn = new Map<string, number>();
  for (const o of settled) {
    const delta = o.orderType === "Buy" ? o.quantity : -o.quantity;
    byIgn.set(o.ign, (byIgn.get(o.ign) ?? 0) + delta);
  }

  let circulatingSupply = 0;
  for (const total of byIgn.values()) {
    if (total > 0) circulatingSupply += total;
  }

  const tokenValue = await getTokenValueInternal();
  const totalWealthProtected = circulatingSupply * tokenValue;
  const circuitBreakerActive = await isCircuitBreakerActive(circulatingSupply);

  return {
    circulatingSupply,
    tokenValue,
    totalWealthProtected,
    circuitBreakerActive,
  };
}

const UpdateTokenValueSchema = z.object({
  value: z.number().int().min(0),
});

export const updateTokenValue = createServerFn({ method: "POST" })
  .inputValidator(UpdateTokenValueSchema)
  .handler(async ({ data }) => {
    await setSetting("token_value", String(data.value));

    await recordPricePoint(data.value, 0, "admin_override");

    const stats = await getStats();
    return { tokenValue: data.value, stats };
  });

export const getTokenValue = createServerFn({ method: "GET" }).handler(
  async () => {
    return { tokenValue: await getTokenValueInternal() };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 1. ESCROW STATUS & UNIQUE TRANSACTION NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────

// Triggered by an admin operator to push an order's status to "LISTED_ON_AH".
// Computes a deterministic unique micro-price from the order hash, stamps the alt account,
// and marks listedAt to start the 3-minute secure escrow channel countdown. The matching
// player's active browser window surfaces the escrow modal on its next poll.
const ListOnAhSchema = z.object({
  id: z.number(),
  altAccount: z.string().min(1).max(100),
});

export const listOrderOnAh = createServerFn({ method: "POST" })
  .inputValidator(ListOnAhSchema)
  .handler(async ({ data }) => {
    const [existing] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, data.id));
    if (!existing) {
      throw new Error("Order not found");
    }
    if (existing.flagged) {
      throw new Error(
        "Order is flagged for review. Approve it before listing on the auction house.",
      );
    }

    // Deterministic micro-pricing offset derived entirely from the Order Hash ID.
    const offset = computeUniquePriceOffset(existing.hash);
    const basePrice =
      existing.orderType === "Buy" ? BUY_PRICE : FLOOR_PRICE;
    const uniquePrice = basePrice + offset;

    const [updated] = await db
      .update(orders)
      .set({
        status: "LISTED_ON_AH",
        altAccount: data.altAccount,
        uniquePrice,
        listedAt: new Date(),
      })
      .where(eq(orders.id, data.id))
      .returning();

    return updated as OrderRow;
  });

// ─────────────────────────────────────────────────────────────────────────────
// 2. AUTOMATED ECONOMY LOGIC, ANONYMOUS INGESTION, AND PUBLIC GRAPH ENGINE
// ─────────────────────────────────────────────────────────────────────────────

// Anonymous aggregate input gateway. Accepts only high-level structural numbers —
// never player IGNs, hashes, or tracking profiles. After recording the event, runs the
// automated supply/demand math and re-prices the global token value.
const IngestEconomyEventSchema = z.object({
  transactionCount: z.number().int().min(0).max(1000000),
  volumeDelta: z.number().int().min(-1000000).max(1000000),
  note: z.string().max(500).optional(),
});

export const ingestEconomyEvent = createServerFn({ method: "POST" })
  .inputValidator(IngestEconomyEventSchema)
  .handler(async ({ data }) => {
    const [inserted] = await db
      .insert(economyEvents)
      .values({
        transactionCount: data.transactionCount,
        volumeDelta: data.volumeDelta,
        note: data.note ?? null,
      })
      .returning();

    // Automated supply & demand math: re-price the global token value based on net volume pressure.
    const newTokenValue = await repriceFromAggregatePressure();

    return {
      event: inserted as EconomyEventRow,
      tokenValue: newTokenValue,
    };
  });

export const getEconomyEvents = createServerFn({ method: "GET" }).handler(
  async () => {
    const rows = await db
      .select()
      .from(economyEvents)
      .orderBy(desc(economyEvents.createdAt))
      .limit(50);
    return rows as EconomyEventRow[];
  },
);

// Automated supply & demand math. Sums aggregate volume deltas from the last ingestion window
// and nudges the global token value: buy pressure pushes the price up, sell pressure pushes it down.
async function repriceFromAggregatePressure(): Promise<number> {
  const currentValue = await getTokenValueInternal();

  // Aggregate the last 24 hours of anonymous economy events into a single net volume signal.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(economyEvents)
    .where(gte(economyEvents.createdAt, since));

  let netVolume = 0;
  let transactionCount = 0;
  for (const r of rows) {
    netVolume += r.volumeDelta;
    transactionCount += r.transactionCount;
  }

  // Price sensitivity: each SOV of net buy pressure lifts the token value by $50;
  // each SOV of net sell pressure lowers it by $50. Transaction velocity adds a small premium.
  const pressure = netVolume * 50 + Math.floor(transactionCount / 10) * 25;
  let nextValue = currentValue + pressure;

  // Clamp to the established economic floor and a sane ceiling.
  if (nextValue < FLOOR_PRICE) nextValue = FLOOR_PRICE;
  if (nextValue > BUY_PRICE * 4) nextValue = BUY_PRICE * 4;

  await setSetting("token_value", String(nextValue));
  await recordPricePoint(nextValue, netVolume, "aggregate_ingestion");
  return nextValue;
}

// Transparent behavior-driven pricing model. This intentionally uses only
// settled in-game orders: recent buy/sell imbalance, net token demand, and
// trade velocity. It is not a prediction or a real-world financial price.
async function repriceFromPlayerBehavior(): Promise<number> {
  const currentValue = await getTokenValueInternal();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentTrades = await db
    .select()
    .from(orders)
    .where(and(eq(orders.settled, true), gte(orders.createdAt, since)));

  let buyVolume = 0;
  let sellVolume = 0;
  for (const trade of recentTrades) {
    if (trade.orderType === "Buy") buyVolume += trade.quantity;
    else sellVolume += trade.quantity;
  }

  const volume = buyVolume + sellVolume;
  if (volume === 0) return currentValue;

  const imbalance = (buyVolume - sellVolume) / volume; // -1 to +1
  const velocityPremium = Math.min(10000, recentTrades.length * 100);
  const demandMove = Math.round(imbalance * Math.min(30000, volume * 75));
  const nextValue = Math.max(
    FLOOR_PRICE,
    Math.min(BUY_PRICE * 4, currentValue + demandMove + velocityPremium),
  );

  await setSetting("token_value", String(nextValue));
  await recordPricePoint(nextValue, buyVolume - sellVolume, "settled_player_behavior");
  return nextValue;
}

async function recordPricePoint(
  tokenValue: number,
  volumeDelta: number,
  reason: string,
): Promise<void> {
  await db.insert(priceHistory).values({
    tokenValue,
    volumeDelta,
    reason,
  });
}

export const getPriceHistory = createServerFn({ method: "GET" }).handler(
  async () => {
    const rows = await db
      .select()
      .from(priceHistory)
      .orderBy(desc(priceHistory.createdAt))
      .limit(100);
    // Oldest first so the chart reads left-to-right across time.
    return rows.reverse() as PriceHistoryRow[];
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. ANTI-CHEAT ANOMALY REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

// Returns all orders currently flagged for admin review ("⚠️ CRITICAL ECONOMIC ANOMALY - DETECTED SPEED EXPLOIT").
export const getFlaggedOrders = createServerFn({ method: "GET" }).handler(
  async () => {
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.flagged, true))
      .orderBy(desc(orders.createdAt));
    return rows as OrderRow[];
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. LIQUIDITY BRAKES — RESERVE CIRCUIT BREAKER
// ─────────────────────────────────────────────────────────────────────────────

// The breaker trips when sell-side (redemption) outflow in the last hour exceeds the safety baseline,
// OR when total wealth protected collapses below the safety floor. While active, the public
// "Request Instant Cash Out" button is frozen and shows the cooling-down warning.
async function isCircuitBreakerActive(circulatingSupply: number): Promise<boolean> {
  // Manual override stored in settings lets an admin force the breaker on/off.
  const manual = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "circuit_breaker"));
  if (manual.length > 0) {
    return manual[0].value === "1";
  }

  // Sum net sell volume in the rolling 1-hour window.
  const since = new Date(Date.now() - CIRCUIT_BREAKER_WINDOW_SECONDS * 1000);
  const recentSells = await db
    .select({ quantity: orders.quantity })
    .from(orders)
    .where(
      and(
        eq(orders.settled, true),
        eq(orders.orderType, "Sell"),
        gte(orders.createdAt, since),
      ),
    );
  let outflow = 0;
  for (const r of recentSells) {
    outflow += r.quantity;
  }
  if (outflow >= CIRCUIT_BREAKER_OUTFLOW_SOV) {
    return true;
  }

  // Wealth-protected safety floor: if circulating supply has collapsed to near zero, freeze redemptions.
  if (circulatingSupply <= 0) {
    return true;
  }
  return false;
}

export const getCircuitBreakerState = createServerFn({ method: "GET" }).handler(
  async () => {
    const stats = await getStats();
    return { active: stats.circuitBreakerActive };
  },
);

// Manual override for the reserve circuit breaker.
const SetCircuitBreakerSchema = z.object({ active: z.boolean() });
export const setCircuitBreaker = createServerFn({ method: "POST" })
  .inputValidator(SetCircuitBreakerSchema)
  .handler(async ({ data }) => {
    await setSetting("circuit_breaker", data.active ? "1" : "0");
    return { active: data.active };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 5. PUBLIC OPERATOR AVAILABILITY
// ─────────────────────────────────────────────────────────────────────────────

export const getOperatorStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const rows = await db.select().from(settings).where(eq(settings.key, "operator_online"));
    const updated = await db.select().from(settings).where(eq(settings.key, "operator_updated_at"));
    const message = await db.select().from(settings).where(eq(settings.key, "operator_message"));
    return {
      online: rows[0]?.value === "1",
      updatedAt: updated[0]?.value ?? null,
      message: message[0]?.value ?? "Orders are accepted at all times; fulfillment begins when the operator is online.",
    } satisfies OperatorStatus;
  },
);

const SetOperatorStatusSchema = z.object({
  online: z.boolean(),
  message: z.string().min(1).max(240),
});

export const setOperatorStatus = createServerFn({ method: "POST" })
  .inputValidator(SetOperatorStatusSchema)
  .handler(async ({ data }) => {
    const updatedAt = new Date().toISOString();
    await setSetting("operator_online", data.online ? "1" : "0");
    await setSetting("operator_message", data.message);
    await setSetting("operator_updated_at", updatedAt);
    return { online: data.online, message: data.message, updatedAt } satisfies OperatorStatus;
  });

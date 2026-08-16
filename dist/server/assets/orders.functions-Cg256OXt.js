import { T as TSS_SERVER_FUNCTION, c as createServerFn } from "../server.js";
import { z } from "zod";
import { drizzle } from "drizzle-orm/netlify-db";
import { pgTable, timestamp, text, integer, boolean, serial } from "drizzle-orm/pg-core";
import { eq, desc, gte, and } from "drizzle-orm";
import "node:async_hooks";
import "h3-v2";
import "@tanstack/router-core";
import "seroval";
import "@tanstack/history";
import "@tanstack/router-core/ssr/client";
import "@tanstack/router-core/ssr/server";
import "react";
import "@tanstack/react-router";
import "react/jsx-runtime";
import "@tanstack/react-router/ssr/server";
var createServerRpc = (serverFnMeta, splitImportFn) => {
  const url = "/_serverFn/" + serverFnMeta.id;
  return Object.assign(splitImportFn, {
    url,
    serverFnMeta,
    [TSS_SERVER_FUNCTION]: true
  });
};
const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  hash: text("hash").notNull().unique(),
  ign: text("ign").notNull(),
  orderType: text("order_type").notNull(),
  quantity: integer("quantity").notNull(),
  amount: integer("amount").notNull(),
  settled: boolean("settled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  // Lifecycle status of the escrow handshake.
  // Values: "PENDING" (default, awaiting in-game escrow), "LISTED_ON_AH" (admin listed the receipt on the in-game auction house), "SETTLED".
  status: text("status").notNull().default("PENDING"),
  // Anti-cheat flag: when true, escrow handshake processing is halted pending manual admin review.
  flagged: boolean("flagged").notNull().default(false),
  // Deterministic micro-pricing offset assigned when an order is listed on the in-game AH, so each receipt has a unique single-digit price delta.
  uniquePrice: integer("unique_price"),
  // The alternate account (alt) that the admin used to list the receipt/token wrapper on the in-game auction house. Shown to the player in the escrow modal.
  altAccount: text("alt_account"),
  // Timestamp marking when the order was pushed to the in-game auction house; kicks off the 3-minute secure escrow channel countdown.
  listedAt: timestamp("listed_at")
});
const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull()
});
const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  tokenValue: integer("token_value").notNull(),
  // Net volume delta (in SOV) that triggered this price movement: positive = buy pressure, negative = sell pressure.
  volumeDelta: integer("volume_delta").notNull().default(0),
  // Human-readable reason for the adjustment, e.g. "aggregate_ingestion", "admin_override", "circuit_breaker".
  reason: text("reason").notNull().default("aggregate_ingestion"),
  createdAt: timestamp("created_at").defaultNow()
});
const economyEvents = pgTable("economy_events", {
  id: serial("id").primaryKey(),
  // Number of transactions the admin reports as processed in this batch.
  transactionCount: integer("transaction_count").notNull().default(0),
  // Net SOV volume change reported for this batch (positive = injected into circulation, negative = redeemed out).
  volumeDelta: integer("volume_delta").notNull().default(0),
  // Free-form structural note (no PII). e.g. "5 transactions processed, +10 SOV volume".
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow()
});
const schema = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  economyEvents,
  orders,
  priceHistory,
  settings
}, Symbol.toStringTag, { value: "Module" }));
const db = drizzle({ schema });
const BUY_PRICE = 2e5;
const FLOOR_PRICE = 15e4;
const SPEED_EXPLOIT_WINDOW_SECONDS = 60;
const SPEED_EXPLOIT_MAX_ORDERS = 3;
const HIGH_VOLUME_THRESHOLD = 50;
const CIRCUIT_BREAKER_OUTFLOW_SOV = 1e3;
const CIRCUIT_BREAKER_WINDOW_SECONDS = 3600;
function randomHash() {
  const segment = () => Math.floor(1e3 + Math.random() * 9e3).toString();
  return `SOV-${segment()}-${segment().slice(0, 1)}`;
}
function computeUniquePriceOffset(hash) {
  let sum = 0;
  for (let i = 0; i < hash.length; i++) {
    const code = hash.charCodeAt(i);
    sum = (sum * 31 + code) % 1000003;
  }
  return sum % 9 + 1;
}
const getStats_createServerFn_handler = createServerRpc({
  id: "9987ac28bd8dc2f7ca5e475e321cf9527704e3a38bb812c5d8427c71fae45618",
  name: "getStats",
  filename: "src/server/orders.functions.ts"
}, (opts) => getStats.__executeServer(opts));
const getStats = createServerFn({
  method: "GET"
}).handler(getStats_createServerFn_handler, async () => {
  const settledOrders = await db.select().from(orders).where(eq(orders.settled, true));
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
    circuitBreakerActive
  };
});
async function getTokenValueInternal() {
  const rows = await db.select().from(settings).where(eq(settings.key, "token_value"));
  if (rows.length === 0) {
    return FLOOR_PRICE;
  }
  const parsed = Number(rows[0].value);
  return Number.isFinite(parsed) ? parsed : FLOOR_PRICE;
}
async function setSetting(key, value) {
  const existing = await db.select().from(settings).where(eq(settings.key, key));
  if (existing.length === 0) {
    await db.insert(settings).values({
      key,
      value
    });
  } else {
    await db.update(settings).set({
      value
    }).where(eq(settings.key, key));
  }
}
const getOrders_createServerFn_handler = createServerRpc({
  id: "f07945f68743a5a7d6c010091d42d30bd9a75215321a513ae562b81c0f674590",
  name: "getOrders",
  filename: "src/server/orders.functions.ts"
}, (opts) => getOrders.__executeServer(opts));
const getOrders = createServerFn({
  method: "GET"
}).handler(getOrders_createServerFn_handler, async () => {
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  return rows;
});
const getLeaderboard_createServerFn_handler = createServerRpc({
  id: "057947d02142c8755da4a566fa1d74824803887b79af1b375a2014f730875f59",
  name: "getLeaderboard",
  filename: "src/server/orders.functions.ts"
}, (opts) => getLeaderboard.__executeServer(opts));
const getLeaderboard = createServerFn({
  method: "GET"
}).handler(getLeaderboard_createServerFn_handler, async () => {
  const settled = await db.select().from(orders).where(eq(orders.settled, true));
  const byIgn = /* @__PURE__ */ new Map();
  for (const o of settled) {
    const delta = o.orderType === "Buy" ? o.quantity : -o.quantity;
    byIgn.set(o.ign, (byIgn.get(o.ign) ?? 0) + delta);
  }
  const tokenValue = await getTokenValueInternal();
  const rows = [];
  for (const [ign, totalTokens] of byIgn.entries()) {
    if (totalTokens <= 0) continue;
    rows.push({
      id: 0,
      ign,
      totalTokens,
      totalWealth: totalTokens * tokenValue
    });
  }
  rows.sort((a, b) => b.totalTokens - a.totalTokens);
  rows.forEach((r, i) => r.id = i + 1);
  return rows;
});
async function countRecentHighVolumeOrders(ign) {
  const since = new Date(Date.now() - SPEED_EXPLOIT_WINDOW_SECONDS * 1e3);
  const rows = await db.select({
    id: orders.id
  }).from(orders).where(and(eq(orders.ign, ign), gte(orders.quantity, HIGH_VOLUME_THRESHOLD), gte(orders.createdAt, since)));
  return rows.length;
}
const CreateOrderSchema = z.object({
  ign: z.string().min(1).max(100),
  orderType: z.enum(["Buy", "Sell"]),
  quantity: z.number().int().min(1).max(500)
});
const createOrder_createServerFn_handler = createServerRpc({
  id: "45f49ceab3897632b0b6352a4991c739a64e1e25b98da9508d659db744571d0b",
  name: "createOrder",
  filename: "src/server/orders.functions.ts"
}, (opts) => createOrder.__executeServer(opts));
const createOrder = createServerFn({
  method: "POST"
}).inputValidator(CreateOrderSchema).handler(createOrder_createServerFn_handler, async ({
  data
}) => {
  const recentCount = await countRecentHighVolumeOrders(data.ign);
  const shouldFlag = recentCount >= SPEED_EXPLOIT_MAX_ORDERS;
  const unitPrice = data.orderType === "Buy" ? BUY_PRICE : FLOOR_PRICE;
  const amount = unitPrice * data.quantity;
  let hash = randomHash();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await db.select().from(orders).where(eq(orders.hash, hash));
    if (existing.length === 0) break;
    hash = randomHash();
    attempts += 1;
  }
  const [inserted] = await db.insert(orders).values({
    hash,
    ign: data.ign,
    orderType: data.orderType,
    quantity: data.quantity,
    amount,
    settled: false,
    status: "PENDING",
    flagged: shouldFlag
  }).returning();
  return inserted;
});
const settleOrder_createServerFn_handler = createServerRpc({
  id: "c8ffdae66d0c4efa72a2cd9638979797392164a0af23216dac9fbfdba54fb950",
  name: "settleOrder",
  filename: "src/server/orders.functions.ts"
}, (opts) => settleOrder.__executeServer(opts));
const settleOrder = createServerFn({
  method: "POST"
}).inputValidator(z.object({
  id: z.number()
})).handler(settleOrder_createServerFn_handler, async ({
  data
}) => {
  const [existing] = await db.select().from(orders).where(eq(orders.id, data.id));
  if (!existing) {
    throw new Error("Order not found");
  }
  if (existing.flagged) {
    throw new Error("Order is flagged for review (⚠️ CRITICAL ECONOMIC ANOMALY - DETECTED SPEED EXPLOIT). Approve it first to release the escrow handshake.");
  }
  const [updated] = await db.update(orders).set({
    settled: true,
    status: "SETTLED"
  }).where(eq(orders.id, data.id)).returning();
  if (!updated) {
    throw new Error("Order not found");
  }
  await repriceFromPlayerBehavior();
  const stats = await computeStatsForOrder();
  return {
    order: updated,
    stats
  };
});
const ApproveOrderSchema = z.object({
  id: z.number()
});
const approveOrder_createServerFn_handler = createServerRpc({
  id: "e53f9d92a6ce1478ffa2fa8b15c150d9b03d3d418b5ecf3d06f135be8f88aa1e",
  name: "approveOrder",
  filename: "src/server/orders.functions.ts"
}, (opts) => approveOrder.__executeServer(opts));
const approveOrder = createServerFn({
  method: "POST"
}).inputValidator(ApproveOrderSchema).handler(approveOrder_createServerFn_handler, async ({
  data
}) => {
  const [updated] = await db.update(orders).set({
    flagged: false
  }).where(eq(orders.id, data.id)).returning();
  if (!updated) {
    throw new Error("Order not found");
  }
  return updated;
});
async function computeStatsForOrder(_order) {
  const settled = await db.select().from(orders).where(eq(orders.settled, true));
  const byIgn = /* @__PURE__ */ new Map();
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
    circuitBreakerActive
  };
}
const UpdateTokenValueSchema = z.object({
  value: z.number().int().min(0)
});
const updateTokenValue_createServerFn_handler = createServerRpc({
  id: "3bd040abe3e29710067f5cc4b9e97724768b51b0d829e4332c49142547e48275",
  name: "updateTokenValue",
  filename: "src/server/orders.functions.ts"
}, (opts) => updateTokenValue.__executeServer(opts));
const updateTokenValue = createServerFn({
  method: "POST"
}).inputValidator(UpdateTokenValueSchema).handler(updateTokenValue_createServerFn_handler, async ({
  data
}) => {
  await setSetting("token_value", String(data.value));
  await recordPricePoint(data.value, 0, "admin_override");
  const stats = await getStats();
  return {
    tokenValue: data.value,
    stats
  };
});
const getTokenValue_createServerFn_handler = createServerRpc({
  id: "37fb0df986292c5d9df089dc07812db8fca0df67ae5f847516cc8d72314267ef",
  name: "getTokenValue",
  filename: "src/server/orders.functions.ts"
}, (opts) => getTokenValue.__executeServer(opts));
const getTokenValue = createServerFn({
  method: "GET"
}).handler(getTokenValue_createServerFn_handler, async () => {
  return {
    tokenValue: await getTokenValueInternal()
  };
});
const ListOnAhSchema = z.object({
  id: z.number(),
  altAccount: z.string().min(1).max(100)
});
const listOrderOnAh_createServerFn_handler = createServerRpc({
  id: "f229992678b601a1796c96c7c7af82eb31e2567a9a065386e6f24e40f65a8be5",
  name: "listOrderOnAh",
  filename: "src/server/orders.functions.ts"
}, (opts) => listOrderOnAh.__executeServer(opts));
const listOrderOnAh = createServerFn({
  method: "POST"
}).inputValidator(ListOnAhSchema).handler(listOrderOnAh_createServerFn_handler, async ({
  data
}) => {
  const [existing] = await db.select().from(orders).where(eq(orders.id, data.id));
  if (!existing) {
    throw new Error("Order not found");
  }
  if (existing.flagged) {
    throw new Error("Order is flagged for review. Approve it before listing on the auction house.");
  }
  const offset = computeUniquePriceOffset(existing.hash);
  const basePrice = existing.orderType === "Buy" ? BUY_PRICE : FLOOR_PRICE;
  const uniquePrice = basePrice + offset;
  const [updated] = await db.update(orders).set({
    status: "LISTED_ON_AH",
    altAccount: data.altAccount,
    uniquePrice,
    listedAt: /* @__PURE__ */ new Date()
  }).where(eq(orders.id, data.id)).returning();
  return updated;
});
const IngestEconomyEventSchema = z.object({
  transactionCount: z.number().int().min(0).max(1e6),
  volumeDelta: z.number().int().min(-1e6).max(1e6),
  note: z.string().max(500).optional()
});
const ingestEconomyEvent_createServerFn_handler = createServerRpc({
  id: "f187ce95fba99126944c1755283775bb11736866d686ef1dc7e5a95e0aacd751",
  name: "ingestEconomyEvent",
  filename: "src/server/orders.functions.ts"
}, (opts) => ingestEconomyEvent.__executeServer(opts));
const ingestEconomyEvent = createServerFn({
  method: "POST"
}).inputValidator(IngestEconomyEventSchema).handler(ingestEconomyEvent_createServerFn_handler, async ({
  data
}) => {
  const [inserted] = await db.insert(economyEvents).values({
    transactionCount: data.transactionCount,
    volumeDelta: data.volumeDelta,
    note: data.note ?? null
  }).returning();
  const newTokenValue = await repriceFromAggregatePressure();
  return {
    event: inserted,
    tokenValue: newTokenValue
  };
});
const getEconomyEvents_createServerFn_handler = createServerRpc({
  id: "e683ceecdf6cd13e039e31c76feb548a25e7a834e9eb630d73b219fa155c0314",
  name: "getEconomyEvents",
  filename: "src/server/orders.functions.ts"
}, (opts) => getEconomyEvents.__executeServer(opts));
const getEconomyEvents = createServerFn({
  method: "GET"
}).handler(getEconomyEvents_createServerFn_handler, async () => {
  const rows = await db.select().from(economyEvents).orderBy(desc(economyEvents.createdAt)).limit(50);
  return rows;
});
async function repriceFromAggregatePressure() {
  const currentValue = await getTokenValueInternal();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1e3);
  const rows = await db.select().from(economyEvents).where(gte(economyEvents.createdAt, since));
  let netVolume = 0;
  let transactionCount = 0;
  for (const r of rows) {
    netVolume += r.volumeDelta;
    transactionCount += r.transactionCount;
  }
  const pressure = netVolume * 50 + Math.floor(transactionCount / 10) * 25;
  let nextValue = currentValue + pressure;
  if (nextValue < FLOOR_PRICE) nextValue = FLOOR_PRICE;
  if (nextValue > BUY_PRICE * 4) nextValue = BUY_PRICE * 4;
  await setSetting("token_value", String(nextValue));
  await recordPricePoint(nextValue, netVolume, "aggregate_ingestion");
  return nextValue;
}
async function repriceFromPlayerBehavior() {
  const currentValue = await getTokenValueInternal();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1e3);
  const recentTrades = await db.select().from(orders).where(and(eq(orders.settled, true), gte(orders.createdAt, since)));
  let buyVolume = 0;
  let sellVolume = 0;
  for (const trade of recentTrades) {
    if (trade.orderType === "Buy") buyVolume += trade.quantity;
    else sellVolume += trade.quantity;
  }
  const volume = buyVolume + sellVolume;
  if (volume === 0) return currentValue;
  const imbalance = (buyVolume - sellVolume) / volume;
  const velocityPremium = Math.min(1e4, recentTrades.length * 100);
  const demandMove = Math.round(imbalance * Math.min(3e4, volume * 75));
  const nextValue = Math.max(FLOOR_PRICE, Math.min(BUY_PRICE * 4, currentValue + demandMove + velocityPremium));
  await setSetting("token_value", String(nextValue));
  await recordPricePoint(nextValue, buyVolume - sellVolume, "settled_player_behavior");
  return nextValue;
}
async function recordPricePoint(tokenValue, volumeDelta, reason) {
  await db.insert(priceHistory).values({
    tokenValue,
    volumeDelta,
    reason
  });
}
const getPriceHistory_createServerFn_handler = createServerRpc({
  id: "5ecc0496e2b6b0536287b9ff04ee7b6c1cac68f36c9dd714f631b3e99b81f94b",
  name: "getPriceHistory",
  filename: "src/server/orders.functions.ts"
}, (opts) => getPriceHistory.__executeServer(opts));
const getPriceHistory = createServerFn({
  method: "GET"
}).handler(getPriceHistory_createServerFn_handler, async () => {
  const rows = await db.select().from(priceHistory).orderBy(desc(priceHistory.createdAt)).limit(100);
  return rows.reverse();
});
const getFlaggedOrders_createServerFn_handler = createServerRpc({
  id: "a6e964e608677d7942ec1ddb708e4ae7c4064e3d0320305ead8e05250605df8a",
  name: "getFlaggedOrders",
  filename: "src/server/orders.functions.ts"
}, (opts) => getFlaggedOrders.__executeServer(opts));
const getFlaggedOrders = createServerFn({
  method: "GET"
}).handler(getFlaggedOrders_createServerFn_handler, async () => {
  const rows = await db.select().from(orders).where(eq(orders.flagged, true)).orderBy(desc(orders.createdAt));
  return rows;
});
async function isCircuitBreakerActive(circulatingSupply) {
  const manual = await db.select().from(settings).where(eq(settings.key, "circuit_breaker"));
  if (manual.length > 0) {
    return manual[0].value === "1";
  }
  const since = new Date(Date.now() - CIRCUIT_BREAKER_WINDOW_SECONDS * 1e3);
  const recentSells = await db.select({
    quantity: orders.quantity
  }).from(orders).where(and(eq(orders.settled, true), eq(orders.orderType, "Sell"), gte(orders.createdAt, since)));
  let outflow = 0;
  for (const r of recentSells) {
    outflow += r.quantity;
  }
  if (outflow >= CIRCUIT_BREAKER_OUTFLOW_SOV) {
    return true;
  }
  if (circulatingSupply <= 0) {
    return true;
  }
  return false;
}
const getCircuitBreakerState_createServerFn_handler = createServerRpc({
  id: "21f4a506d698ffbc0946456db58c98e97fc1a95ce89a24358b03c9bf03ffa600",
  name: "getCircuitBreakerState",
  filename: "src/server/orders.functions.ts"
}, (opts) => getCircuitBreakerState.__executeServer(opts));
const getCircuitBreakerState = createServerFn({
  method: "GET"
}).handler(getCircuitBreakerState_createServerFn_handler, async () => {
  const stats = await getStats();
  return {
    active: stats.circuitBreakerActive
  };
});
const SetCircuitBreakerSchema = z.object({
  active: z.boolean()
});
const setCircuitBreaker_createServerFn_handler = createServerRpc({
  id: "b3a8e24f2463dc634c954ac62db0a08e412f11999914b832b53998ae33889054",
  name: "setCircuitBreaker",
  filename: "src/server/orders.functions.ts"
}, (opts) => setCircuitBreaker.__executeServer(opts));
const setCircuitBreaker = createServerFn({
  method: "POST"
}).inputValidator(SetCircuitBreakerSchema).handler(setCircuitBreaker_createServerFn_handler, async ({
  data
}) => {
  await setSetting("circuit_breaker", data.active ? "1" : "0");
  return {
    active: data.active
  };
});
const getOperatorStatus_createServerFn_handler = createServerRpc({
  id: "4cec31b9da0459dba944a84a47fca52a1f9f9044e907296d56c428a35f6cbd06",
  name: "getOperatorStatus",
  filename: "src/server/orders.functions.ts"
}, (opts) => getOperatorStatus.__executeServer(opts));
const getOperatorStatus = createServerFn({
  method: "GET"
}).handler(getOperatorStatus_createServerFn_handler, async () => {
  const rows = await db.select().from(settings).where(eq(settings.key, "operator_online"));
  const updated = await db.select().from(settings).where(eq(settings.key, "operator_updated_at"));
  const message = await db.select().from(settings).where(eq(settings.key, "operator_message"));
  return {
    online: rows[0]?.value === "1",
    updatedAt: updated[0]?.value ?? null,
    message: message[0]?.value ?? "Orders are accepted at all times; fulfillment begins when the operator is online."
  };
});
const SetOperatorStatusSchema = z.object({
  online: z.boolean(),
  message: z.string().min(1).max(240)
});
const setOperatorStatus_createServerFn_handler = createServerRpc({
  id: "2feb445a978f76f822165f5072e74d7a3b07898a589f7411ee4a732d7bb7b31f",
  name: "setOperatorStatus",
  filename: "src/server/orders.functions.ts"
}, (opts) => setOperatorStatus.__executeServer(opts));
const setOperatorStatus = createServerFn({
  method: "POST"
}).inputValidator(SetOperatorStatusSchema).handler(setOperatorStatus_createServerFn_handler, async ({
  data
}) => {
  const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  await setSetting("operator_online", data.online ? "1" : "0");
  await setSetting("operator_message", data.message);
  await setSetting("operator_updated_at", updatedAt);
  return {
    online: data.online,
    message: data.message,
    updatedAt
  };
});
export {
  approveOrder_createServerFn_handler,
  createOrder_createServerFn_handler,
  getCircuitBreakerState_createServerFn_handler,
  getEconomyEvents_createServerFn_handler,
  getFlaggedOrders_createServerFn_handler,
  getLeaderboard_createServerFn_handler,
  getOperatorStatus_createServerFn_handler,
  getOrders_createServerFn_handler,
  getPriceHistory_createServerFn_handler,
  getStats_createServerFn_handler,
  getTokenValue_createServerFn_handler,
  ingestEconomyEvent_createServerFn_handler,
  listOrderOnAh_createServerFn_handler,
  setCircuitBreaker_createServerFn_handler,
  setOperatorStatus_createServerFn_handler,
  settleOrder_createServerFn_handler,
  updateTokenValue_createServerFn_handler
};

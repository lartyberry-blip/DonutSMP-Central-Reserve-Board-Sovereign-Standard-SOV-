import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const orders = pgTable("orders", {
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
  listedAt: timestamp("listed_at"),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Appended on every token-value recalculation (driven by the automated supply/demand math and anonymous aggregate ingestion).
// Feeds the public "Sovereign Market Trends & Velocity Matrix" chart.
export const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  tokenValue: integer("token_value").notNull(),
  // Net volume delta (in SOV) that triggered this price movement: positive = buy pressure, negative = sell pressure.
  volumeDelta: integer("volume_delta").notNull().default(0),
  // Human-readable reason for the adjustment, e.g. "aggregate_ingestion", "admin_override", "circuit_breaker".
  reason: text("reason").notNull().default("aggregate_ingestion"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Anonymous, PII-free aggregate economy log entries fed by administrators through the developer input gateway.
// Only stores high-level structural numbers — never player IGNs, hashes, or tracking profiles.
export const economyEvents = pgTable("economy_events", {
  id: serial("id").primaryKey(),
  // Number of transactions the admin reports as processed in this batch.
  transactionCount: integer("transaction_count").notNull().default(0),
  // Net SOV volume change reported for this batch (positive = injected into circulation, negative = redeemed out).
  volumeDelta: integer("volume_delta").notNull().default(0),
  // Free-form structural note (no PII). e.g. "5 transactions processed, +10 SOV volume".
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

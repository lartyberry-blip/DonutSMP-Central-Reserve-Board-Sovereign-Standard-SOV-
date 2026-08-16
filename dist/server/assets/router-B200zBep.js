import { createRootRoute, HeadContent, Scripts, createFileRoute, createRouter } from "@tanstack/react-router";
import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from "chart.js";
import { Line } from "react-chartjs-2";
import { T as TSS_SERVER_FUNCTION, g as getServerFnById, c as createServerFn } from "../server.js";
import { z } from "zod";
import "node:async_hooks";
import "h3-v2";
import "@tanstack/router-core";
import "seroval";
import "@tanstack/history";
import "@tanstack/router-core/ssr/client";
import "@tanstack/router-core/ssr/server";
import "@tanstack/react-router/ssr/server";
const Route$1 = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8"
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1"
      },
      {
        title: "DonutSMP Central Reserve Board | Sovereign Standard [SOV]"
      },
      {
        name: "description",
        content: "The official Central Reserve Desk for the DonutSMP Sovereign Standard [SOV] token economy. Mint, redeem, and track server-backed assets."
      }
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com"
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous"
      }
    ]
  }),
  shellComponent: RootDocument
});
function RootDocument({ children }) {
  return /* @__PURE__ */ jsxs("html", { lang: "en", children: [
    /* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }),
    /* @__PURE__ */ jsxs("body", { children: [
      children,
      /* @__PURE__ */ jsx(Scripts, {})
    ] })
  ] });
}
var createSsrRpc = (functionId) => {
  const url = "/_serverFn/" + functionId;
  const serverFnMeta = { id: functionId };
  const fn = async (...args) => {
    return (await getServerFnById(functionId))(...args);
  };
  return Object.assign(fn, {
    url,
    serverFnMeta,
    [TSS_SERVER_FUNCTION]: true
  });
};
function computeUniquePriceOffset(hash) {
  let sum = 0;
  for (let i = 0; i < hash.length; i++) {
    const code = hash.charCodeAt(i);
    sum = (sum * 31 + code) % 1000003;
  }
  return sum % 9 + 1;
}
const getStats = createServerFn({
  method: "GET"
}).handler(createSsrRpc("9987ac28bd8dc2f7ca5e475e321cf9527704e3a38bb812c5d8427c71fae45618"));
const getOrders = createServerFn({
  method: "GET"
}).handler(createSsrRpc("f07945f68743a5a7d6c010091d42d30bd9a75215321a513ae562b81c0f674590"));
const getLeaderboard = createServerFn({
  method: "GET"
}).handler(createSsrRpc("057947d02142c8755da4a566fa1d74824803887b79af1b375a2014f730875f59"));
const CreateOrderSchema = z.object({
  ign: z.string().min(1).max(100),
  orderType: z.enum(["Buy", "Sell"]),
  quantity: z.number().int().min(1).max(500)
});
const createOrder = createServerFn({
  method: "POST"
}).inputValidator(CreateOrderSchema).handler(createSsrRpc("45f49ceab3897632b0b6352a4991c739a64e1e25b98da9508d659db744571d0b"));
const settleOrder = createServerFn({
  method: "POST"
}).inputValidator(z.object({
  id: z.number()
})).handler(createSsrRpc("c8ffdae66d0c4efa72a2cd9638979797392164a0af23216dac9fbfdba54fb950"));
const ApproveOrderSchema = z.object({
  id: z.number()
});
const approveOrder = createServerFn({
  method: "POST"
}).inputValidator(ApproveOrderSchema).handler(createSsrRpc("e53f9d92a6ce1478ffa2fa8b15c150d9b03d3d418b5ecf3d06f135be8f88aa1e"));
const UpdateTokenValueSchema = z.object({
  value: z.number().int().min(0)
});
const updateTokenValue = createServerFn({
  method: "POST"
}).inputValidator(UpdateTokenValueSchema).handler(createSsrRpc("3bd040abe3e29710067f5cc4b9e97724768b51b0d829e4332c49142547e48275"));
const getTokenValue = createServerFn({
  method: "GET"
}).handler(createSsrRpc("37fb0df986292c5d9df089dc07812db8fca0df67ae5f847516cc8d72314267ef"));
const ListOnAhSchema = z.object({
  id: z.number(),
  altAccount: z.string().min(1).max(100)
});
const listOrderOnAh = createServerFn({
  method: "POST"
}).inputValidator(ListOnAhSchema).handler(createSsrRpc("f229992678b601a1796c96c7c7af82eb31e2567a9a065386e6f24e40f65a8be5"));
const IngestEconomyEventSchema = z.object({
  transactionCount: z.number().int().min(0).max(1e6),
  volumeDelta: z.number().int().min(-1e6).max(1e6),
  note: z.string().max(500).optional()
});
const ingestEconomyEvent = createServerFn({
  method: "POST"
}).inputValidator(IngestEconomyEventSchema).handler(createSsrRpc("f187ce95fba99126944c1755283775bb11736866d686ef1dc7e5a95e0aacd751"));
const getEconomyEvents = createServerFn({
  method: "GET"
}).handler(createSsrRpc("e683ceecdf6cd13e039e31c76feb548a25e7a834e9eb630d73b219fa155c0314"));
const getPriceHistory = createServerFn({
  method: "GET"
}).handler(createSsrRpc("5ecc0496e2b6b0536287b9ff04ee7b6c1cac68f36c9dd714f631b3e99b81f94b"));
const getFlaggedOrders = createServerFn({
  method: "GET"
}).handler(createSsrRpc("a6e964e608677d7942ec1ddb708e4ae7c4064e3d0320305ead8e05250605df8a"));
const getCircuitBreakerState = createServerFn({
  method: "GET"
}).handler(createSsrRpc("21f4a506d698ffbc0946456db58c98e97fc1a95ce89a24358b03c9bf03ffa600"));
const SetCircuitBreakerSchema = z.object({
  active: z.boolean()
});
const setCircuitBreaker = createServerFn({
  method: "POST"
}).inputValidator(SetCircuitBreakerSchema).handler(createSsrRpc("b3a8e24f2463dc634c954ac62db0a08e412f11999914b832b53998ae33889054"));
const getOperatorStatus = createServerFn({
  method: "GET"
}).handler(createSsrRpc("4cec31b9da0459dba944a84a47fca52a1f9f9044e907296d56c428a35f6cbd06"));
const SetOperatorStatusSchema = z.object({
  online: z.boolean(),
  message: z.string().min(1).max(240)
});
const setOperatorStatus = createServerFn({
  method: "POST"
}).inputValidator(SetOperatorStatusSchema).handler(createSsrRpc("2feb445a978f76f822165f5072e74d7a3b07898a589f7411ee4a732d7bb7b31f"));
Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
);
const Route = createFileRoute("/")({
  component: Home
});
const BUY_PRICE = 2e5;
const FLOOR_PRICE = 15e4;
const ESCROW_WINDOW_SECONDS = 180;
function formatTokens(n) {
  return n.toLocaleString("en-US");
}
function formatDollars(n) {
  return "$" + n.toLocaleString("en-US");
}
function timeLabel(d) {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
function getNewYorkMarketSession() {
  const now = /* @__PURE__ */ new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday");
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const minutes = hour * 60 + minute;
  const businessDay = !["Sat", "Sun"].includes(weekday);
  const open = businessDay && minutes >= 570 && minutes < 960;
  const nowText = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(now);
  const next = open ? "Closes at 4:00 PM ET" : businessDay && minutes < 570 ? "Opens at 9:30 AM ET" : "Opens next weekday at 9:30 AM ET";
  return { open, now: nowText, next };
}
function Home() {
  const [stats, setStats] = useState({
    circulatingSupply: 0,
    tokenValue: FLOOR_PRICE,
    totalWealthProtected: 0,
    circuitBreakerActive: false
  });
  const [orders, setOrders] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [flaggedOrders, setFlaggedOrders] = useState([]);
  const [economyEvents, setEconomyEvents] = useState([]);
  const [operator, setOperator] = useState({ online: false, updatedAt: null, message: "Orders are accepted at all times; fulfillment begins when the operator is online." });
  const [marketSession, setMarketSession] = useState(() => getNewYorkMarketSession());
  const [ign, setIgn] = useState("");
  const [orderType, setOrderType] = useState("Buy");
  const [quantity, setQuantity] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [adminTokenValue, setAdminTokenValue] = useState(
    String(FLOOR_PRICE)
  );
  const [adminSaving, setAdminSaving] = useState(false);
  const [escrowOrder, setEscrowOrder] = useState(null);
  const watchedIgnRef = useRef(null);
  const [ingestCount, setIngestCount] = useState("5");
  const [ingestVolume, setIngestVolume] = useState("10");
  const [ingestNote, setIngestNote] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [altAccount, setAltAccount] = useState("");
  const [broadcasts, setBroadcasts] = useState({});
  const [simVelocity, setSimVelocity] = useState(1e3);
  const [breakerManual, setBreakerManual] = useState(null);
  const [breakerSaving, setBreakerSaving] = useState(false);
  const [operatorMessage, setOperatorMessage] = useState("I am actively fulfilling SOV orders now.");
  const [operatorSaving, setOperatorSaving] = useState(false);
  const refreshAll = useCallback(async () => {
    const [s, o, l, ph, fl, ev, op] = await Promise.all([
      getStats(),
      getOrders(),
      getLeaderboard(),
      getPriceHistory(),
      getFlaggedOrders(),
      getEconomyEvents(),
      getOperatorStatus()
    ]);
    setStats(s);
    setOrders(o);
    setLeaderboard(l);
    setPriceHistory(ph);
    setFlaggedOrders(fl);
    setEconomyEvents(ev);
    setOperator(op);
  }, []);
  useEffect(() => {
    refreshAll().catch((e) => {
      console.error("Initial load failed", e);
    });
    getTokenValue().then((r) => {
      setStats((prev) => ({ ...prev, tokenValue: r.tokenValue }));
      setAdminTokenValue(String(r.tokenValue));
    });
  }, [refreshAll]);
  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const [s, o, fl] = await Promise.all([
          getStats(),
          getOrders(),
          getFlaggedOrders()
        ]);
        setStats(s);
        setOrders(o);
        setFlaggedOrders(fl);
        const watched = watchedIgnRef.current;
        if (watched) {
          const match = o.find(
            (row) => row.ign.toLowerCase() === watched.toLowerCase() && row.status === "LISTED_ON_AH" && !row.settled
          );
          if (match) {
            setEscrowOrder(
              (prev) => prev && prev.id === match.id ? prev : match
            );
          }
        }
      } catch (e) {
      }
    }, 4e3);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const id = window.setInterval(() => setMarketSession(getNewYorkMarketSession()), 3e4);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (operator.updatedAt) setOperatorMessage(operator.message);
  }, [operator.updatedAt]);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    const trimmedIgn = ign.trim();
    const qty = Number(quantity);
    if (!trimmedIgn) {
      setFormError("Enter your Minecraft in-game name.");
      return;
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 500) {
      setFormError("Quantity must be a whole number between 1 and 500.");
      return;
    }
    setSubmitting(true);
    try {
      await createOrder({
        data: {
          ign: trimmedIgn,
          orderType,
          quantity: qty
        }
      });
      watchedIgnRef.current = trimmedIgn;
      setIgn("");
      setQuantity("1");
      await refreshAll();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to submit order ticket."
      );
    } finally {
      setSubmitting(false);
    }
  };
  const handleSettle = async (id) => {
    try {
      const result = await settleOrder({ data: { id } });
      setStats(result.stats);
      const order = orders.find((o) => o.id === id);
      if (order) {
        const ticket = `[SOV] 💸 Sovereign Standard Node #${order.hash} settled safely! Player ${order.ign} just injected ${formatDollars(order.amount)} into their faction vault. Mint yours at delicate-cactus-9158d6.netlify.app!`;
        setBroadcasts((prev) => ({ ...prev, [id]: ticket }));
      }
      await refreshAll();
    } catch (err) {
      console.error("Settle failed", err);
      alert(
        err instanceof Error ? err.message : "Failed to settle order."
      );
    }
  };
  const handleListOnAh = async (id) => {
    const alt = altAccount.trim();
    if (!alt) {
      alert("Enter the alt account name that will list the receipt on /ah.");
      return;
    }
    try {
      const updated = await listOrderOnAh({ data: { id, altAccount: alt } });
      setEscrowOrder(updated);
      setAltAccount("");
      await refreshAll();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to list order on auction house."
      );
    }
  };
  const handleApprove = async (id) => {
    try {
      await approveOrder({ data: { id } });
      await refreshAll();
    } catch (err) {
      console.error("Approve failed", err);
    }
  };
  const handleIngest = async (e) => {
    e.preventDefault();
    const count = Number(ingestCount);
    const vol = Number(ingestVolume);
    if (!Number.isFinite(count) || count < 0) return;
    if (!Number.isFinite(vol)) return;
    setIngesting(true);
    try {
      await ingestEconomyEvent({
        data: {
          transactionCount: Math.round(count),
          volumeDelta: Math.round(vol),
          note: ingestNote.trim() || void 0
        }
      });
      setIngestNote("");
      await refreshAll();
    } catch (err) {
      console.error("Ingest failed", err);
    } finally {
      setIngesting(false);
    }
  };
  const handleUpdateTokenValue = async (e) => {
    e.preventDefault();
    const val = Number(adminTokenValue);
    if (!Number.isFinite(val) || val < 0) return;
    setAdminSaving(true);
    try {
      const result = await updateTokenValue({ data: { value: Math.round(val) } });
      setStats(result.stats);
      setStats((prev) => ({ ...prev, tokenValue: result.tokenValue }));
      await refreshAll();
    } catch (err) {
      console.error("Token value update failed", err);
    } finally {
      setAdminSaving(false);
    }
  };
  const handleBreakerToggle = async () => {
    setBreakerSaving(true);
    try {
      const next = !breakerManual;
      await setCircuitBreaker({ data: { active: next } });
      setBreakerManual(next);
      await refreshAll();
    } catch (err) {
      console.error("Breaker toggle failed", err);
    } finally {
      setBreakerSaving(false);
    }
  };
  const handleOperatorToggle = async () => {
    setOperatorSaving(true);
    try {
      const next = await setOperatorStatus({
        data: {
          online: !operator.online,
          message: operatorMessage.trim() || "Orders are accepted at all times; fulfillment begins when the operator is online."
        }
      });
      setOperator(next);
    } catch (err) {
      console.error("Operator status update failed", err);
    } finally {
      setOperatorSaving(false);
    }
  };
  useEffect(() => {
    if (breakerManual === null) {
      getCircuitBreakerState().then((r) => setBreakerManual(r.active)).catch(() => {
      });
    }
  }, [breakerManual, stats.circuitBreakerActive]);
  return /* @__PURE__ */ jsxs("div", { className: "min-h-screen text-[#e7e9ee]", children: [
    /* @__PURE__ */ jsx(Header, { marketSession }),
    /* @__PURE__ */ jsxs("main", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16", children: [
      /* @__PURE__ */ jsx(Hero, {}),
      /* @__PURE__ */ jsx(MarketHoursPanel, { session: marketSession }),
      /* @__PURE__ */ jsx(OperatorAvailabilityPanel, { operator }),
      stats.circuitBreakerActive && /* @__PURE__ */ jsx(CircuitBreakerBanner, {}),
      /* @__PURE__ */ jsx(StatsBanner, { stats }),
      /* @__PURE__ */ jsx(HowSovWorks, { stats }),
      /* @__PURE__ */ jsx(LiquidityInterface, { breakerActive: stats.circuitBreakerActive }),
      /* @__PURE__ */ jsx(MarketTrendsChart, { history: priceHistory, stats }),
      /* @__PURE__ */ jsx(
        OrderTicket,
        {
          ign,
          setIgn,
          orderType,
          setOrderType,
          quantity,
          setQuantity,
          handleSubmit,
          submitting,
          formError
        }
      ),
      /* @__PURE__ */ jsx(TrackingQueue, { orders }),
      /* @__PURE__ */ jsx(Leaderboard, { leaderboard, stats }),
      /* @__PURE__ */ jsx(
        AdminConsole,
        {
          orders,
          onSettle: handleSettle,
          adminTokenValue,
          setAdminTokenValue,
          handleUpdateTokenValue,
          adminSaving,
          altAccount,
          setAltAccount,
          onListOnAh: handleListOnAh,
          broadcasts,
          operator,
          operatorMessage,
          setOperatorMessage,
          onOperatorToggle: handleOperatorToggle,
          operatorSaving
        }
      ),
      /* @__PURE__ */ jsx(
        AnonymousIngestionPanel,
        {
          ingestCount,
          setIngestCount,
          ingestVolume,
          setIngestVolume,
          ingestNote,
          setIngestNote,
          handleIngest,
          ingesting,
          events: economyEvents
        }
      ),
      /* @__PURE__ */ jsx(YieldSimulator, { velocity: simVelocity, setVelocity: setSimVelocity }),
      /* @__PURE__ */ jsx(
        AnomalyRegistry,
        {
          flaggedOrders,
          onApprove: handleApprove
        }
      ),
      /* @__PURE__ */ jsx(
        CircuitBreakerControls,
        {
          active: stats.circuitBreakerActive,
          manual: breakerManual,
          onToggle: handleBreakerToggle,
          saving: breakerSaving
        }
      ),
      /* @__PURE__ */ jsx(LegalFooter, {})
    ] }),
    escrowOrder && /* @__PURE__ */ jsx(EscrowModal, { order: escrowOrder, onClose: () => setEscrowOrder(null) })
  ] });
}
function Header({ marketSession }) {
  return /* @__PURE__ */ jsx("header", { className: "sticky top-0 z-40 sov-glass border-b border-white/5", children: /* @__PURE__ */ jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 min-w-0", children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          "aria-label": "DonutSMP Faction Logo",
          className: "w-12 h-12 rounded-full sov-cyan-border flex items-center justify-center bg-[#0a0c10] shrink-0",
          children: /* @__PURE__ */ jsx("span", { className: "text-xl font-extrabold sov-cyan-glow", children: "D" })
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsx(
          "h1",
          {
            className: "text-base sm:text-xl font-extrabold tracking-tight truncate",
            style: { fontFamily: "Plus Jakarta Sans, Inter, sans-serif" },
            children: "CENTRAL RESERVE DESK"
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "mt-1 flex items-center gap-2", children: [
          /* @__PURE__ */ jsx("span", { className: "relative inline-flex", children: /* @__PURE__ */ jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-400 sov-pulse" }) }),
          /* @__PURE__ */ jsxs("span", { className: "text-[11px] sm:text-xs font-semibold text-emerald-300 whitespace-nowrap", children: [
            "● ",
            marketSession.open ? "MARKET OPEN" : "MARKET CLOSED",
            " | ",
            marketSession.now
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("nav", { className: "hidden sm:flex items-center gap-6 text-sm font-semibold", children: [
      /* @__PURE__ */ jsx("a", { href: "#top", className: "sov-nav-link text-[#e7e9ee]", children: "Home" }),
      /* @__PURE__ */ jsx("a", { href: "#escrow", className: "sov-nav-link text-[#e7e9ee]", children: "Escrow Portal" }),
      /* @__PURE__ */ jsx("a", { href: "#ledger", className: "sov-nav-link text-[#e7e9ee]", children: "Live Ledger" }),
      /* @__PURE__ */ jsx("a", { href: "#trends", className: "sov-nav-link text-[#e7e9ee]", children: "Market Trends" })
    ] })
  ] }) });
}
function Hero() {
  return /* @__PURE__ */ jsxs("section", { id: "top", className: "pt-12 pb-8 text-center", children: [
    /* @__PURE__ */ jsx("div", { className: "inline-flex items-center gap-2 px-3 py-1 rounded-full sov-cyan-border text-[11px] font-semibold sov-cyan-glow mb-5", children: "DONUTSMP ECONOMIC INFRASTRUCTURE" }),
    /* @__PURE__ */ jsx(
      "h2",
      {
        className: "text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight sov-headline",
        style: { fontFamily: "Plus Jakarta Sans, Inter, sans-serif" },
        children: "The Server Economy, Secured."
      }
    ),
    /* @__PURE__ */ jsx("p", { className: "mt-5 max-w-2xl mx-auto text-base sm:text-lg text-[#9aa0ad]", children: "Sovereign Standard [SOV] — a faction-reserve-backed token you can mint, hold, and cash out instantly. Trusted by the DonutSMP treasury." })
  ] });
}
function CircuitBreakerBanner() {
  return /* @__PURE__ */ jsxs("div", { className: "sov-cooldown rounded-xl px-5 py-4 mb-8 text-sm font-semibold flex items-center gap-3", children: [
    /* @__PURE__ */ jsx("span", { className: "text-lg", children: "🧊" }),
    /* @__PURE__ */ jsx("span", { children: "Treasury Node Cooling Down. Redemption windows refresh shortly." })
  ] });
}
function StatsBanner({ stats }) {
  return /* @__PURE__ */ jsxs("section", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-14", children: [
    /* @__PURE__ */ jsx(
      GlassStatCard,
      {
        label: "Total Circulating Supply",
        value: `${formatTokens(stats.circulatingSupply)} SOV`,
        subtext: "Verified in public circulation"
      }
    ),
    /* @__PURE__ */ jsx(
      GlassStatCard,
      {
        label: "In-Game Token Value",
        value: formatDollars(stats.tokenValue),
        subtext: "Auto-adjusted by supply & demand"
      }
    ),
    /* @__PURE__ */ jsx(
      GlassStatCard,
      {
        label: "Total Wealth Protected",
        value: formatDollars(stats.totalWealthProtected),
        subtext: "Denominated in server cash"
      }
    )
  ] });
}
function GlassStatCard({
  label,
  value,
  subtext
}) {
  return /* @__PURE__ */ jsxs("div", { className: "sov-glass rounded-2xl px-6 py-7", children: [
    /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold uppercase tracking-wider text-[#7d8493]", children: label }),
    /* @__PURE__ */ jsx("p", { className: "mt-3 text-3xl sm:text-4xl font-extrabold sov-gold", children: value }),
    /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-[#6b7280]", dangerouslySetInnerHTML: { __html: subtext } })
  ] });
}
function MarketHoursPanel({ session }) {
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const previousOpenRef = useRef(null);
  useEffect(() => {
    if ("Notification" in window) setAlertsEnabled(Notification.permission === "granted");
  }, []);
  useEffect(() => {
    const previous = previousOpenRef.current;
    previousOpenRef.current = session.open;
    if (previous === null || previous === session.open || !("Notification" in window) || Notification.permission !== "granted") return;
    new Notification(session.open ? "SOV market is open" : "SOV market is closed", {
      body: session.open ? "Live fulfillment is available during the New York session." : "New orders are queued for the next New York session."
    });
  }, [session.open]);
  const enableAlerts = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setAlertsEnabled(permission === "granted");
    if (permission === "granted") {
      new Notification("SOV market alerts enabled", { body: "This browser will show the current New York session status while this page is open." });
    }
  };
  return /* @__PURE__ */ jsx("section", { className: `rounded-2xl p-5 mb-6 border ${session.open ? "sov-market-open" : "sov-market-closed"}`, "aria-live": "polite", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", children: [
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("p", { className: "text-xs font-bold uppercase tracking-widest", children: "New York market session" }),
      /* @__PURE__ */ jsx("h2", { className: "mt-1 text-xl font-extrabold", children: session.open ? "● Open for live fulfillment" : "● Closed — orders queue for the next session" }),
      /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-[#9aa0ad]", children: [
        session.now,
        " · ",
        session.next,
        ". You may submit an order anytime; after hours, it waits for an operator."
      ] })
    ] }),
    /* @__PURE__ */ jsx("button", { onClick: enableAlerts, disabled: alertsEnabled, className: "sov-cyan-btn px-4 py-2.5 rounded-lg text-xs font-bold disabled:opacity-60", children: alertsEnabled ? "✓ Browser alerts enabled" : "Enable browser alerts" })
  ] }) });
}
function OperatorAvailabilityPanel({ operator }) {
  const updated = operator.updatedAt ? new Date(operator.updatedAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " ET" : "No shift recorded yet";
  return /* @__PURE__ */ jsxs("section", { className: "sov-glass rounded-2xl p-6 mb-14", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsx("span", { className: `w-3 h-3 rounded-full ${operator.online ? "bg-emerald-400 sov-pulse" : "bg-[#6b7280]"}` }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-xs font-bold uppercase tracking-widest text-[#7d8493]", children: "SOV operator availability" }),
        /* @__PURE__ */ jsx("h2", { className: "text-lg font-extrabold", children: operator.online ? "Clocked in — live fulfillment active" : "Clocked out — orders are queued" })
      ] })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm text-[#9aa0ad]", children: operator.message }),
    /* @__PURE__ */ jsxs("p", { className: "mt-2 text-xs text-[#6b7280]", children: [
      "Last status update: ",
      updated
    ] })
  ] });
}
function HowSovWorks({ stats }) {
  const reserveNeeded = stats.circulatingSupply * FLOOR_PRICE;
  const coverage = reserveNeeded > 0 ? Math.round(stats.totalWealthProtected / reserveNeeded * 100) : 0;
  return /* @__PURE__ */ jsxs("section", { id: "how-it-works", className: "sov-glass rounded-2xl p-6 sm:p-8 mb-14", children: [
    /* @__PURE__ */ jsx("h2", { className: "text-xl font-extrabold", children: "How SOV works" }),
    /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-[#9aa0ad]", children: "A Minecraft-only token workflow: submit an order, complete the in-game handoff, then the operator settles it on this public ledger." }),
    /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6", children: [
      ["1. Submit", "Request a SOV buy or sell using your Minecraft IGN."],
      ["2. In-game exchange", "Pay or receive DonutSMP cash through the agreed in-game handoff."],
      ["3. Ledger settlement", "The operator records completion; supply, holders, and price update."]
    ].map(([title, text]) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl bg-[#0a0c10] border border-white/5 p-5", children: [
      /* @__PURE__ */ jsx("h3", { className: "font-bold sov-cyan-glow", children: title }),
      /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-[#9aa0ad]", children: text })
    ] }, title)) }),
    /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 text-sm", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-[#7d8493]", children: "Mint price" }),
        /* @__PURE__ */ jsx("p", { className: "font-bold sov-gold", children: "$200,000" })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-[#7d8493]", children: "Redemption floor" }),
        /* @__PURE__ */ jsx("p", { className: "font-bold sov-gold", children: "$150,000" })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-[#7d8493]", children: "Market price" }),
        /* @__PURE__ */ jsx("p", { className: "font-bold sov-gold", children: formatDollars(stats.tokenValue) })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-[#7d8493]", children: "Coverage indicator" }),
        /* @__PURE__ */ jsxs("p", { className: "font-bold sov-gold", children: [
          coverage,
          "%"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "mt-5 text-xs text-[#6b7280]", children: "Market price uses recorded settled buy/sell behavior from the last 24 hours: net demand moves the price; trade count adds a small activity component. It is a transparent in-game rule, not a real-world investment valuation. Mint, redemption, and transfer fees: $0 unless the server rules say otherwise." })
  ] });
}
function LiquidityInterface({ breakerActive }) {
  return /* @__PURE__ */ jsxs("section", { id: "escrow", className: "grid grid-cols-1 lg:grid-cols-2 gap-5 mb-14", children: [
    /* @__PURE__ */ jsxs("div", { className: "sov-glass rounded-2xl p-7", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mb-3", children: [
        /* @__PURE__ */ jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-cyan-400 sov-pulse" }),
        /* @__PURE__ */ jsx("h3", { className: "text-lg font-bold text-[#e7e9ee]", children: "Acquisition Desk" })
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "text-[#9aa0ad] leading-relaxed mb-6", children: [
        "Mint new SOV tokens at the fixed rate of",
        " ",
        /* @__PURE__ */ jsx("span", { className: "sov-gold font-bold", children: "$200,000" }),
        " each. Funds are routed instantly through our secure escrow rail."
      ] }),
      /* @__PURE__ */ jsx("a", { href: "#ticket", className: "sov-cyan-btn inline-block px-6 py-3 rounded-xl font-bold text-sm", children: "Open Safe Buy Order" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "sov-glass rounded-2xl p-7", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mb-3", children: [
        /* @__PURE__ */ jsx("span", { className: "w-2.5 h-2.5 rounded-full sov-gold sov-pulse" }),
        /* @__PURE__ */ jsx("h3", { className: "text-lg font-bold text-[#e7e9ee]", children: "Redemption Treasury" })
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "text-[#9aa0ad] leading-relaxed mb-6", children: [
        "Redeem your SOV tokens back into liquid server cash instantly at the guaranteed floor rate of",
        " ",
        /* @__PURE__ */ jsx("span", { className: "sov-gold font-bold", children: "$150,000" }),
        " each."
      ] }),
      breakerActive ? /* @__PURE__ */ jsx(
        "button",
        {
          disabled: true,
          className: "sov-cooldown inline-block px-6 py-3 rounded-xl font-bold text-sm cursor-not-allowed",
          children: "Treasury Node Cooling Down. Redemption windows refresh shortly."
        }
      ) : /* @__PURE__ */ jsx("a", { href: "#ticket", className: "sov-gold-btn inline-block px-6 py-3 rounded-xl font-bold text-sm", children: "Request Instant Cash Out" })
    ] })
  ] });
}
function MarketTrendsChart({ history, stats }) {
  const chartData = useMemo(() => {
    const labels = history.map((h) => timeLabel(h.createdAt));
    const values = history.map((h) => h.tokenValue);
    return {
      labels,
      datasets: [
        {
          label: "SOV Token Value",
          data: values,
          borderColor: "#00D2FF",
          borderWidth: 2.5,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: "#00D2FF",
          pointHoverBorderColor: "#04141a",
          fill: true,
          backgroundColor: (ctx) => {
            const { ctx: c } = ctx.chart;
            const grad = c.createLinearGradient(0, 0, 0, 320);
            grad.addColorStop(0, "rgba(0, 210, 255, 0.28)");
            grad.addColorStop(1, "rgba(0, 210, 255, 0.0)");
            return grad;
          }
        }
      ]
    };
  }, [history]);
  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0a0c10",
          borderColor: "rgba(0,210,255,0.5)",
          borderWidth: 1,
          titleColor: "#00D2FF",
          bodyColor: "#e7e9ee",
          padding: 12,
          callbacks: {
            label: (ctx) => `Token Value: ${formatDollars(Number(ctx.raw))}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: { color: "#6b7280", maxTicksLimit: 6, font: { size: 10 } }
        },
        y: {
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: {
            color: "#6b7280",
            font: { size: 10 },
            callback: (v) => "$" + Number(v).toLocaleString("en-US")
          }
        }
      }
    }),
    []
  );
  const empty = history.length === 0;
  return /* @__PURE__ */ jsxs("section", { id: "trends", className: "sov-glass sov-chart-panel rounded-2xl p-6 sm:p-8 mb-14", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mb-5", children: [
      /* @__PURE__ */ jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-cyan-400 sov-pulse" }),
      /* @__PURE__ */ jsx("h3", { className: "text-xl font-bold", children: "Sovereign Market Trends & Velocity Matrix" })
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "text-sm text-[#9aa0ad] mb-5", children: [
      "Current behavior-model price: ",
      /* @__PURE__ */ jsx("span", { className: "sov-gold font-bold", children: formatDollars(stats.tokenValue) }),
      ". Updated from settled player buying/selling and logged aggregate events."
    ] }),
    empty ? /* @__PURE__ */ jsx("div", { className: "sov-chart-canvas-wrap flex items-center justify-center text-sm text-[#6b7280]", children: "Awaiting the first market event. Ingest an aggregate economy log to begin the trend line." }) : /* @__PURE__ */ jsx("div", { className: "sov-chart-canvas-wrap", children: /* @__PURE__ */ jsx(Line, { data: chartData, options }) })
  ] });
}
function OrderTicket({
  ign,
  setIgn,
  orderType,
  setOrderType,
  quantity,
  setQuantity,
  handleSubmit,
  submitting,
  formError
}) {
  const qty = Number(quantity) || 0;
  const unitPrice = orderType === "Buy" ? BUY_PRICE : FLOOR_PRICE;
  const total = qty * unitPrice;
  return /* @__PURE__ */ jsxs("section", { id: "ticket", className: "sov-glass rounded-2xl p-6 sm:p-8 mb-12", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mb-6", children: [
      /* @__PURE__ */ jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-cyan-400 sov-pulse" }),
      /* @__PURE__ */ jsx("h3", { className: "text-xl font-bold", children: "Create Order Ticket" })
    ] }),
    /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, className: "grid grid-cols-1 sm:grid-cols-3 gap-4", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("label", { className: "block text-xs font-semibold uppercase tracking-wider text-[#7d8493] mb-2", children: "Minecraft In-Game Name (IGN)" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            value: ign,
            onChange: (e) => setIgn(e.target.value),
            placeholder: "e.g. SteveBuilder",
            className: "w-full rounded-xl bg-[#0a0c10] border border-white/10 px-4 py-3 text-sm text-[#e7e9ee] placeholder-[#5a606b] focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("label", { className: "block text-xs font-semibold uppercase tracking-wider text-[#7d8493] mb-2", children: "Order Type" }),
        /* @__PURE__ */ jsxs(
          "select",
          {
            value: orderType,
            onChange: (e) => setOrderType(e.target.value),
            className: "w-full rounded-xl bg-[#0a0c10] border border-white/10 px-4 py-3 text-sm text-[#e7e9ee] focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition",
            children: [
              /* @__PURE__ */ jsx("option", { value: "Buy", children: "Buy Token [SOV]" }),
              /* @__PURE__ */ jsx("option", { value: "Sell", children: "Sell Token [SOV]" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("label", { className: "block text-xs font-semibold uppercase tracking-wider text-[#7d8493] mb-2", children: "Token Quantity (Min 1 - Max 500)" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "number",
            min: 1,
            max: 500,
            step: 1,
            value: quantity,
            onChange: (e) => setQuantity(e.target.value),
            className: "w-full rounded-xl bg-[#0a0c10] border border-white/10 px-4 py-3 text-sm text-[#e7e9ee] focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "sm:col-span-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2", children: [
        /* @__PURE__ */ jsxs("div", { className: "text-sm text-[#9aa0ad]", children: [
          "Estimated Order Value:",
          " ",
          /* @__PURE__ */ jsx("span", { className: "sov-gold font-bold text-base", children: formatDollars(total) }),
          /* @__PURE__ */ jsxs("span", { className: "text-[#6b7280] ml-2", children: [
            "@ ",
            formatDollars(unitPrice),
            " / SOV"
          ] })
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "submit",
            disabled: submitting,
            className: "sov-cyan-btn px-7 py-3 rounded-xl font-bold text-sm disabled:opacity-60 disabled:cursor-not-allowed",
            children: submitting ? "Submitting…" : "Submit Order Ticket"
          }
        )
      ] }),
      formError && /* @__PURE__ */ jsx("div", { className: "sm:col-span-3 text-sm text-red-400 font-medium", children: formError })
    ] })
  ] });
}
function StatusBadge({ order }) {
  if (order.settled || order.status === "SETTLED") {
    return /* @__PURE__ */ jsx("span", { className: "sov-settled inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold", children: "● TRANSACTION COMPLETE (SETTLED)" });
  }
  if (order.status === "LISTED_ON_AH") {
    return /* @__PURE__ */ jsx("span", { className: "sov-listed inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold", children: "🔵 LISTED ON /AH — SECURE ESCROW ACTIVE" });
  }
  return /* @__PURE__ */ jsx("span", { className: "sov-awaiting inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold", children: "⏳ Awaiting In-Game Escrow Handshake" });
}
function TrackingQueue({ orders }) {
  return /* @__PURE__ */ jsxs("section", { id: "ledger", className: "sov-glass rounded-2xl p-6 sm:p-8 mb-14 overflow-x-auto", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mb-5", children: [
      /* @__PURE__ */ jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-cyan-400 sov-pulse" }),
      /* @__PURE__ */ jsx("h3", { className: "text-xl font-bold", children: "Live Public Tracking Queue" })
    ] }),
    /* @__PURE__ */ jsxs("table", { className: "w-full text-left text-sm min-w-[720px]", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "text-xs uppercase tracking-wider text-[#7d8493] border-b border-white/10", children: [
        /* @__PURE__ */ jsx("th", { className: "py-3 pr-4 font-semibold", children: "Hash ID" }),
        /* @__PURE__ */ jsx("th", { className: "py-3 pr-4 font-semibold", children: "Player IGN" }),
        /* @__PURE__ */ jsx("th", { className: "py-3 pr-4 font-semibold", children: "Order Type" }),
        /* @__PURE__ */ jsx("th", { className: "py-3 pr-4 font-semibold", children: "Amount" }),
        /* @__PURE__ */ jsx("th", { className: "py-3 pr-4 font-semibold", children: "Unique Price" }),
        /* @__PURE__ */ jsx("th", { className: "py-3 font-semibold", children: "Settlement Status" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: orders.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan: 6, className: "py-8 text-center text-[#6b7280]", children: "No active orders in the queue. Submit an order ticket above to start the ledger." }) }) : orders.map((o) => /* @__PURE__ */ jsxs(
        "tr",
        {
          className: `border-b border-white/5 sov-row-in hover:bg-white/[0.02] transition ${o.flagged ? "sov-flagged-row" : ""}`,
          children: [
            /* @__PURE__ */ jsxs("td", { className: "py-3 pr-4 font-mono sov-cyan-glow text-xs", children: [
              "#",
              o.hash
            ] }),
            /* @__PURE__ */ jsx("td", { className: "py-3 pr-4 font-semibold", children: o.ign }),
            /* @__PURE__ */ jsx("td", { className: "py-3 pr-4", children: /* @__PURE__ */ jsxs(
              "span",
              {
                className: o.orderType === "Buy" ? "text-cyan-300 font-semibold" : "text-amber-300 font-semibold",
                children: [
                  o.orderType === "Buy" ? "Buy" : "Sell",
                  " Token [SOV]"
                ]
              }
            ) }),
            /* @__PURE__ */ jsx("td", { className: "py-3 pr-4 sov-gold font-bold", children: formatDollars(o.amount) }),
            /* @__PURE__ */ jsx("td", { className: "py-3 pr-4 font-mono text-xs", children: o.uniquePrice ? formatDollars(o.uniquePrice) : "—" }),
            /* @__PURE__ */ jsx("td", { className: "py-3", children: /* @__PURE__ */ jsx(StatusBadge, { order: o }) })
          ]
        },
        o.id
      )) })
    ] })
  ] });
}
function Leaderboard({
  leaderboard,
  stats
}) {
  const initializing = leaderboard.length === 0 && stats.circulatingSupply === 0;
  return /* @__PURE__ */ jsxs("section", { className: "sov-glass rounded-2xl p-6 sm:p-8 mb-14 overflow-x-auto", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mb-5", children: [
      /* @__PURE__ */ jsx("span", { className: "w-2.5 h-2.5 rounded-full sov-gold sov-pulse" }),
      /* @__PURE__ */ jsx("h3", { className: "text-xl font-bold", children: "Official Distribution Registry" })
    ] }),
    /* @__PURE__ */ jsxs("table", { className: "w-full text-left text-sm min-w-[640px]", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "text-xs uppercase tracking-wider text-[#7d8493] border-b border-white/10", children: [
        /* @__PURE__ */ jsx("th", { className: "py-3 pr-4 font-semibold", children: "Rank" }),
        /* @__PURE__ */ jsx("th", { className: "py-3 pr-4 font-semibold", children: "Player IGN" }),
        /* @__PURE__ */ jsx("th", { className: "py-3 pr-4 font-semibold", children: "Token Holdings" }),
        /* @__PURE__ */ jsx("th", { className: "py-3 pr-4 font-semibold", children: "Wealth (Server Cash)" }),
        /* @__PURE__ */ jsx("th", { className: "py-3 font-semibold", children: "Holder Status" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: initializing ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx(
        "td",
        {
          colSpan: 5,
          className: "py-8 text-center text-[#9aa0ad] text-sm",
          children: "Registry Initializing… No active tokens currently in circulation. Submit an open buy order below to lock in the Rank 1 spot!"
        }
      ) }) : leaderboard.map((row) => /* @__PURE__ */ jsxs(
        "tr",
        {
          className: "border-b border-white/5 sov-row-in hover:bg-white/[0.02] transition",
          children: [
            /* @__PURE__ */ jsxs("td", { className: "py-3 pr-4 font-bold sov-cyan-glow", children: [
              "Rank ",
              row.id
            ] }),
            /* @__PURE__ */ jsx("td", { className: "py-3 pr-4 font-semibold", children: row.ign }),
            /* @__PURE__ */ jsxs("td", { className: "py-3 pr-4 sov-gold font-bold", children: [
              formatTokens(row.totalTokens),
              " SOV"
            ] }),
            /* @__PURE__ */ jsx("td", { className: "py-3 pr-4 sov-gold font-bold", children: formatDollars(row.totalWealth) }),
            /* @__PURE__ */ jsx("td", { className: "py-3", children: /* @__PURE__ */ jsx("span", { className: "sov-verified inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold", children: "● VERIFIED HOLDER" }) })
          ]
        },
        row.ign
      )) })
    ] })
  ] });
}
function AdminConsole({
  orders,
  onSettle,
  adminTokenValue,
  setAdminTokenValue,
  handleUpdateTokenValue,
  adminSaving,
  altAccount,
  setAltAccount,
  onListOnAh,
  broadcasts,
  operator,
  operatorMessage,
  setOperatorMessage,
  onOperatorToggle,
  operatorSaving
}) {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("hr", { className: "border-white/10 my-10" }),
    /* @__PURE__ */ jsxs("section", { className: "sov-glass rounded-2xl p-6 sm:p-8 border border-cyan-400/20", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
          /* @__PURE__ */ jsx("span", { className: "text-xl", children: "⚙️" }),
          /* @__PURE__ */ jsx("h3", { className: "text-lg font-bold tracking-tight", children: "SOVEREIGN SYSTEM ADMINISTRATIVE MANAGEMENT CONTROLS" })
        ] }),
        /* @__PURE__ */ jsxs(
          "form",
          {
            onSubmit: handleUpdateTokenValue,
            className: "flex items-center gap-2",
            children: [
              /* @__PURE__ */ jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-[#7d8493] whitespace-nowrap", children: "Token Value:" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "number",
                  min: 0,
                  step: 1e3,
                  value: adminTokenValue,
                  onChange: (e) => setAdminTokenValue(e.target.value),
                  className: "w-32 rounded-lg bg-[#0a0c10] border border-white/10 px-3 py-2 text-sm text-[#e7e9ee] focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition"
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "submit",
                  disabled: adminSaving,
                  className: "sov-cyan-btn px-4 py-2 rounded-lg font-bold text-xs disabled:opacity-60",
                  children: adminSaving ? "Saving…" : "Update Global"
                }
              )
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mb-6 rounded-xl bg-[#0a0c10] border border-white/10 p-4", children: [
        /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold uppercase tracking-wider text-[#7d8493]", children: "Operator clock" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-[#9aa0ad]", children: "This public status tells players whether new orders can be fulfilled live or will wait in the queue." }),
        /* @__PURE__ */ jsxs("div", { className: "mt-3 flex flex-col sm:flex-row gap-3", children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              maxLength: 240,
              value: operatorMessage,
              onChange: (e) => setOperatorMessage(e.target.value),
              placeholder: "e.g. Back at 6 PM ET; queued orders will be handled first.",
              className: "flex-1 rounded-lg bg-[#111215] border border-white/10 px-3 py-2 text-sm text-[#e7e9ee] placeholder-[#5a606b] focus:outline-none focus:border-cyan-400/60"
            }
          ),
          /* @__PURE__ */ jsx("button", { onClick: onOperatorToggle, disabled: operatorSaving, className: "sov-cyan-btn px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-60", children: operatorSaving ? "Updating…" : operator.online ? "Clock out" : "Clock in" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mb-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:items-end", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-xs font-semibold uppercase tracking-wider text-[#7d8493] mb-2", children: "Alt Account (lists receipts on /ah)" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: altAccount,
              onChange: (e) => setAltAccount(e.target.value),
              placeholder: "e.g. SovAlt_07",
              className: "w-full rounded-lg bg-[#0a0c10] border border-white/10 px-3 py-2 text-sm text-[#e7e9ee] placeholder-[#5a606b] focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition"
            }
          )
        ] }),
        /* @__PURE__ */ jsx("p", { className: "text-xs text-[#6b7280] sm:max-w-xs", children: 'Enter the alt account once, then click "List on /AH" on any pending order to dispatch the secure escrow modal.' })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-left text-sm min-w-[860px]", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "text-xs uppercase tracking-wider text-[#7d8493] border-b border-white/10", children: [
          /* @__PURE__ */ jsx("th", { className: "py-3 pr-4 font-semibold", children: "Hash ID" }),
          /* @__PURE__ */ jsx("th", { className: "py-3 pr-4 font-semibold", children: "Player IGN" }),
          /* @__PURE__ */ jsx("th", { className: "py-3 pr-4 font-semibold", children: "Type" }),
          /* @__PURE__ */ jsx("th", { className: "py-3 pr-4 font-semibold", children: "Qty" }),
          /* @__PURE__ */ jsx("th", { className: "py-3 pr-4 font-semibold", children: "Status" }),
          /* @__PURE__ */ jsx("th", { className: "py-3 font-semibold", children: "Action" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: orders.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan: 6, className: "py-8 text-center text-[#6b7280]", children: "No active tickets in the queue." }) }) : orders.map((o) => /* @__PURE__ */ jsxs(
          "tr",
          {
            className: `border-b border-white/5 hover:bg-white/[0.02] transition ${o.flagged ? "sov-flagged-row" : ""}`,
            children: [
              /* @__PURE__ */ jsxs("td", { className: "py-3 pr-4 font-mono sov-cyan-glow text-xs", children: [
                "#",
                o.hash
              ] }),
              /* @__PURE__ */ jsx("td", { className: "py-3 pr-4 font-semibold", children: o.ign }),
              /* @__PURE__ */ jsx("td", { className: "py-3 pr-4", children: o.orderType === "Buy" ? "Buy" : "Sell" }),
              /* @__PURE__ */ jsx("td", { className: "py-3 pr-4", children: o.quantity }),
              /* @__PURE__ */ jsx("td", { className: "py-3 pr-4", children: /* @__PURE__ */ jsx(StatusBadge, { order: o }) }),
              /* @__PURE__ */ jsxs("td", { className: "py-3", children: [
                /* @__PURE__ */ jsx("div", { className: "flex flex-wrap items-center gap-2", children: o.settled ? /* @__PURE__ */ jsx("span", { className: "text-[#6b7280] text-xs", children: "Completed" }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                  o.status !== "LISTED_ON_AH" && /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: () => onListOnAh(o.id),
                      className: "px-3 py-2 rounded-lg font-bold text-xs sov-listed",
                      children: "🔵 List on /AH"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: () => onSettle(o.id),
                      className: "sov-admin-btn px-3 py-2 rounded-lg font-bold text-xs",
                      children: "✅ Settle & Transfer"
                    }
                  )
                ] }) }),
                broadcasts[o.id] && /* @__PURE__ */ jsx(BroadcastTicket, { text: broadcasts[o.id] })
              ] })
            ]
          },
          o.id
        )) })
      ] }) })
    ] })
  ] });
}
function BroadcastTicket({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "mt-2", children: [
    /* @__PURE__ */ jsx("div", { className: "sov-broadcast rounded-lg px-3 py-2 text-xs text-[#e7e9ee] break-words select-all", children: text }),
    /* @__PURE__ */ jsx(
      "button",
      {
        onClick: copy,
        className: "mt-1 text-[11px] font-bold sov-cyan-glow hover:underline",
        children: copied ? "✓ Copied to clipboard" : "Copy broadcast ticket"
      }
    )
  ] });
}
function AnonymousIngestionPanel({
  ingestCount,
  setIngestCount,
  ingestVolume,
  setIngestVolume,
  ingestNote,
  setIngestNote,
  handleIngest,
  ingesting,
  events
}) {
  return /* @__PURE__ */ jsxs("section", { className: "sov-glass rounded-2xl p-6 sm:p-8 mb-14", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mb-3", children: [
      /* @__PURE__ */ jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-cyan-400 sov-pulse" }),
      /* @__PURE__ */ jsx("h3", { className: "text-xl font-bold", children: "Anonymous Aggregate Economy Gateway" })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "text-sm text-[#9aa0ad] mb-5 max-w-3xl", children: "Developer input gateway for feeding high-level structural logs. Aggregates numbers only — no player IGNs, hashes, or tracking profiles are collected, processed, or logged. Each ingestion runs the automated supply & demand math and re-prices the global token value." }),
    /* @__PURE__ */ jsxs("form", { onSubmit: handleIngest, className: "grid grid-cols-1 sm:grid-cols-4 gap-4", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("label", { className: "block text-xs font-semibold uppercase tracking-wider text-[#7d8493] mb-2", children: "Transactions Processed" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "number",
            min: 0,
            value: ingestCount,
            onChange: (e) => setIngestCount(e.target.value),
            className: "w-full rounded-xl bg-[#0a0c10] border border-white/10 px-4 py-3 text-sm text-[#e7e9ee] focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("label", { className: "block text-xs font-semibold uppercase tracking-wider text-[#7d8493] mb-2", children: "Net Volume Delta (SOV)" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "number",
            value: ingestVolume,
            onChange: (e) => setIngestVolume(e.target.value),
            className: "w-full rounded-xl bg-[#0a0c10] border border-white/10 px-4 py-3 text-sm text-[#e7e9ee] focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "sm:col-span-2", children: [
        /* @__PURE__ */ jsx("label", { className: "block text-xs font-semibold uppercase tracking-wider text-[#7d8493] mb-2", children: "Structural Note (no PII)" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            value: ingestNote,
            onChange: (e) => setIngestNote(e.target.value),
            placeholder: "e.g. 5 transactions processed, +10 SOV volume",
            className: "w-full rounded-xl bg-[#0a0c10] border border-white/10 px-4 py-3 text-sm text-[#e7e9ee] placeholder-[#5a606b] focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition"
          }
        )
      ] }),
      /* @__PURE__ */ jsx("div", { className: "sm:col-span-4 flex justify-end", children: /* @__PURE__ */ jsx(
        "button",
        {
          type: "submit",
          disabled: ingesting,
          className: "sov-cyan-btn px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-60",
          children: ingesting ? "Ingesting…" : "Ingest &amp; Re-price"
        }
      ) })
    ] }),
    events.length > 0 && /* @__PURE__ */ jsx("div", { className: "mt-6 overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-left text-sm min-w-[640px]", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "text-xs uppercase tracking-wider text-[#7d8493] border-b border-white/10", children: [
        /* @__PURE__ */ jsx("th", { className: "py-2 pr-4 font-semibold", children: "Time" }),
        /* @__PURE__ */ jsx("th", { className: "py-2 pr-4 font-semibold", children: "Transactions" }),
        /* @__PURE__ */ jsx("th", { className: "py-2 pr-4 font-semibold", children: "Volume Δ" }),
        /* @__PURE__ */ jsx("th", { className: "py-2 font-semibold", children: "Note" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: events.slice(0, 8).map((ev) => /* @__PURE__ */ jsxs("tr", { className: "border-b border-white/5", children: [
        /* @__PURE__ */ jsx("td", { className: "py-2 pr-4 text-[#6b7280] text-xs", children: timeLabel(ev.createdAt) }),
        /* @__PURE__ */ jsx("td", { className: "py-2 pr-4 font-semibold", children: ev.transactionCount }),
        /* @__PURE__ */ jsxs("td", { className: `py-2 pr-4 font-bold ${ev.volumeDelta >= 0 ? "text-cyan-300" : "text-amber-300"}`, children: [
          ev.volumeDelta >= 0 ? "+" : "",
          ev.volumeDelta,
          " SOV"
        ] }),
        /* @__PURE__ */ jsx("td", { className: "py-2 text-[#9aa0ad] text-xs", children: ev.note ?? "—" })
      ] }, ev.id)) })
    ] }) })
  ] });
}
function YieldSimulator({
  velocity,
  setVelocity
}) {
  const spreadPerToken = BUY_PRICE - FLOOR_PRICE;
  const treasuryInflow = velocity * spreadPerToken;
  const buyCount = Math.round(velocity * 0.6);
  const sellCount = velocity - buyCount;
  const grossMintVolume = buyCount * BUY_PRICE;
  const grossRedemptionVolume = sellCount * FLOOR_PRICE;
  const netServerDollarProfit = treasuryInflow;
  return /* @__PURE__ */ jsxs("section", { className: "sov-glass rounded-2xl p-6 sm:p-8 mb-14", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mb-3", children: [
      /* @__PURE__ */ jsx("span", { className: "w-2.5 h-2.5 rounded-full sov-gold sov-pulse" }),
      /* @__PURE__ */ jsx("h3", { className: "text-xl font-bold", children: "Yield & Reserves Simulation Engine" })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "text-sm text-[#9aa0ad] mb-6 max-w-3xl", children: "Internal forecasting calculator. Scale simulated trade velocity to project treasury cash flows and net server-dollar profit margins based on the buy/sell price delta." }),
    /* @__PURE__ */ jsxs("div", { className: "mb-6", children: [
      /* @__PURE__ */ jsxs("label", { className: "block text-xs font-semibold uppercase tracking-wider text-[#7d8493] mb-2", children: [
        "Simulated Trade Velocity — ",
        formatTokens(velocity),
        " transactions / day"
      ] }),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "range",
          min: 0,
          max: 1e4,
          step: 50,
          value: velocity,
          onChange: (e) => setVelocity(Number(e.target.value)),
          className: "sov-range"
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-[11px] text-[#6b7280] mt-1", children: [
        /* @__PURE__ */ jsx("span", { children: "0" }),
        /* @__PURE__ */ jsx("span", { children: "5,000" }),
        /* @__PURE__ */ jsx("span", { children: "10,000" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", children: [
      /* @__PURE__ */ jsx(SimCard, { label: "Projected Daily Treasury Inflow", value: formatDollars(treasuryInflow) }),
      /* @__PURE__ */ jsx(SimCard, { label: "Gross Mint Volume (Buy)", value: formatDollars(grossMintVolume) }),
      /* @__PURE__ */ jsx(SimCard, { label: "Gross Redemption Volume (Sell)", value: formatDollars(grossRedemptionVolume) }),
      /* @__PURE__ */ jsx(SimCard, { label: "Net Server-Dollar Profit Margin", value: formatDollars(netServerDollarProfit), highlight: true })
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "mt-5 text-xs text-[#6b7280]", children: [
      "Spread per token: ",
      formatDollars(spreadPerToken),
      " (Buy ",
      formatDollars(BUY_PRICE),
      " − Floor ",
      formatDollars(FLOOR_PRICE),
      "). Projection assumes a 60/40 buy/sell split."
    ] })
  ] });
}
function SimCard({ label, value, highlight }) {
  return /* @__PURE__ */ jsxs("div", { className: `rounded-xl px-5 py-5 ${highlight ? "sov-cyan-border" : "border border-white/5"} bg-[#0a0c10]`, children: [
    /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold uppercase tracking-wider text-[#7d8493]", children: label }),
    /* @__PURE__ */ jsx("p", { className: `mt-2 text-2xl font-extrabold ${highlight ? "sov-gold" : "sov-cyan-glow"}`, children: value })
  ] });
}
function AnomalyRegistry({
  flaggedOrders,
  onApprove
}) {
  return /* @__PURE__ */ jsxs("section", { className: "sov-glass rounded-2xl p-6 sm:p-8 mb-14 border border-red-400/20", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mb-3", children: [
      /* @__PURE__ */ jsx("span", { className: "text-lg", children: "⚠️" }),
      /* @__PURE__ */ jsx("h3", { className: "text-xl font-bold text-[#ff5470]", children: "CRITICAL ECONOMIC ANOMALY — DETECTED SPEED EXPLOIT" })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "text-sm text-[#9aa0ad] mb-5 max-w-3xl", children: "Private admin-only registry. Any single Minecraft IGN filing more than 3 high-volume orders within a rolling 60-second window is dumped here. Their escrow handshake processing is permanently halted until an admin manually approves the order." }),
    /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-left text-sm min-w-[720px]", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "text-xs uppercase tracking-wider text-[#7d8493] border-b border-white/10", children: [
        /* @__PURE__ */ jsx("th", { className: "py-3 pr-4 font-semibold", children: "Hash ID" }),
        /* @__PURE__ */ jsx("th", { className: "py-3 pr-4 font-semibold", children: "Player IGN" }),
        /* @__PURE__ */ jsx("th", { className: "py-3 pr-4 font-semibold", children: "Type" }),
        /* @__PURE__ */ jsx("th", { className: "py-3 pr-4 font-semibold", children: "Qty" }),
        /* @__PURE__ */ jsx("th", { className: "py-3 pr-4 font-semibold", children: "Detected" }),
        /* @__PURE__ */ jsx("th", { className: "py-3 font-semibold", children: "Action" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: flaggedOrders.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan: 6, className: "py-8 text-center text-[#6b7280]", children: "No anomalies detected. All escrow handshakes are processing normally." }) }) : flaggedOrders.map((o) => /* @__PURE__ */ jsxs("tr", { className: "border-b border-white/5 sov-flagged-row", children: [
        /* @__PURE__ */ jsxs("td", { className: "py-3 pr-4 font-mono sov-cyan-glow text-xs", children: [
          "#",
          o.hash
        ] }),
        /* @__PURE__ */ jsx("td", { className: "py-3 pr-4 font-semibold", children: o.ign }),
        /* @__PURE__ */ jsx("td", { className: "py-3 pr-4", children: o.orderType }),
        /* @__PURE__ */ jsx("td", { className: "py-3 pr-4", children: o.quantity }),
        /* @__PURE__ */ jsx("td", { className: "py-3 pr-4 text-[#6b7280] text-xs", children: timeLabel(o.createdAt) }),
        /* @__PURE__ */ jsxs("td", { className: "py-3", children: [
          /* @__PURE__ */ jsx("span", { className: "sov-anomaly inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold mr-2", children: "⚠️ FLAGGED" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => onApprove(o.id),
              className: "sov-admin-btn px-3 py-2 rounded-lg font-bold text-xs",
              children: "✓ Approve & Release Escrow"
            }
          )
        ] })
      ] }, o.id)) })
    ] }) })
  ] });
}
function CircuitBreakerControls({
  active,
  manual,
  onToggle,
  saving
}) {
  return /* @__PURE__ */ jsxs("section", { className: "sov-glass rounded-2xl p-6 sm:p-8 mb-14", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mb-3", children: [
      /* @__PURE__ */ jsx("span", { className: "w-2.5 h-2.5 rounded-full sov-gold sov-pulse" }),
      /* @__PURE__ */ jsx("h3", { className: "text-xl font-bold", children: "Reserve Circuit Breaker" })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "text-sm text-[#9aa0ad] mb-5 max-w-3xl", children: 'Automatic safety cap. Trips when redemption outflow exceeds 1,000 SOV within 1 hour or when total wealth protected collapses to zero. While active, the public "Request Instant Cash Out" button is frozen instantly. An admin can also force the breaker on or off below.' }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-4", children: [
      /* @__PURE__ */ jsx(
        "span",
        {
          className: `inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${active ? "sov-cooldown" : "sov-settled"}`,
          children: active ? "🧊 BREAKER ACTIVE — REDEMPTIONS FROZEN" : "● BREAKER CLEAR — REDEMPTIONS LIVE"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: onToggle,
          disabled: saving || manual === null,
          className: "sov-cyan-btn px-5 py-2.5 rounded-lg font-bold text-xs disabled:opacity-60",
          children: saving ? "Updating…" : manual ? "Release Breaker (Allow Redemptions)" : "Force Freeze (Block Redemptions)"
        }
      )
    ] })
  ] });
}
function EscrowModal({
  order,
  onClose
}) {
  const listedAt = order.listedAt ? new Date(order.listedAt).getTime() : Date.now();
  const deadline = listedAt + ESCROW_WINDOW_SECONDS * 1e3;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1e3);
    return () => window.clearInterval(id);
  }, []);
  const remainingMs = Math.max(0, deadline - now);
  const remainingSec = Math.ceil(remainingMs / 1e3);
  const fraction = Math.max(0, Math.min(1, remainingMs / (ESCROW_WINDOW_SECONDS * 1e3)));
  const trackWidth = 480;
  const fillWidth = trackWidth * fraction;
  const uniquePrice = order.uniquePrice ?? (order.orderType === "Buy" ? BUY_PRICE : FLOOR_PRICE) + computeUniquePriceOffset(order.hash);
  const altAccount = order.altAccount ?? "Alt_Account_Placeholder";
  const expired = remainingMs <= 0;
  return /* @__PURE__ */ jsx("div", { className: "sov-escrow-overlay", role: "dialog", "aria-modal": "true", "aria-labelledby": "escrow-title", children: /* @__PURE__ */ jsxs("div", { className: "sov-escrow-panel p-7", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-4 mb-4", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-[11px] font-bold uppercase tracking-widest sov-cyan-glow", children: "🔵 HIGH-PRIORITY ESCROW DISPATCH" }),
        /* @__PURE__ */ jsx("h3", { id: "escrow-title", className: "mt-1 text-2xl font-extrabold text-[#e7e9ee]", children: "Secure Escrow Channel Open" })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: onClose,
          className: "text-[#6b7280] hover:text-[#e7e9ee] text-xl leading-none",
          "aria-label": "Close escrow notification",
          children: "✕"
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { className: "rounded-lg bg-[#0a0c10] border border-white/5 px-4 py-3 mb-5 text-sm", children: /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-y-2", children: [
      /* @__PURE__ */ jsx("span", { className: "text-[#7d8493]", children: "Order Hash" }),
      /* @__PURE__ */ jsxs("span", { className: "font-mono sov-cyan-glow text-right", children: [
        "#",
        order.hash
      ] }),
      /* @__PURE__ */ jsx("span", { className: "text-[#7d8493]", children: "Your Unique Price" }),
      /* @__PURE__ */ jsx("span", { className: "sov-gold font-bold text-right", children: formatDollars(uniquePrice) }),
      /* @__PURE__ */ jsx("span", { className: "text-[#7d8493]", children: "Listed By (Alt)" }),
      /* @__PURE__ */ jsx("span", { className: "font-semibold text-right", children: altAccount })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between text-xs text-[#7d8493] mb-2", children: [
        /* @__PURE__ */ jsx("span", { children: "Secure Escrow Channel" }),
        /* @__PURE__ */ jsx("span", { className: expired ? "text-red-400 font-bold" : "sov-cyan-glow font-bold", children: expired ? "EXPIRED" : `${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, "0")}` })
      ] }),
      /* @__PURE__ */ jsxs("svg", { width: "100%", height: "14", viewBox: `0 0 ${trackWidth} 14`, preserveAspectRatio: "none", children: [
        /* @__PURE__ */ jsx("rect", { x: "0", y: "2", width: trackWidth, height: "10", rx: "5", className: "sov-countdown-track" }),
        /* @__PURE__ */ jsx(
          "rect",
          {
            x: trackWidth - fillWidth,
            y: "2",
            width: fillWidth,
            height: "10",
            rx: "5",
            className: "sov-countdown-fill"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "rounded-lg sov-cyan-border bg-[#0a0c10] px-4 py-4 mb-5", children: /* @__PURE__ */ jsxs("p", { className: "text-sm font-extrabold text-[#e7e9ee] leading-relaxed", children: [
      "SECURE DISPATCH: Go to in-game ",
      /* @__PURE__ */ jsx("span", { className: "sov-cyan-glow", children: "/ah" }),
      ". Locate the item listed by",
      " ",
      /* @__PURE__ */ jsx("span", { className: "sov-gold", children: altAccount }),
      " matching your exact price of",
      " ",
      /* @__PURE__ */ jsx("span", { className: "sov-gold", children: formatDollars(uniquePrice) }),
      ". Buy this receipt/token wrapper immediately before the 3-minute secure escrow channel expires."
    ] }) }),
    /* @__PURE__ */ jsx(
      "button",
      {
        onClick: onClose,
        className: "sov-cyan-btn w-full px-6 py-3 rounded-xl font-bold text-sm",
        children: expired ? "Acknowledge — Channel Expired" : "I understand — Opening /ah"
      }
    )
  ] }) });
}
function LegalFooter() {
  return /* @__PURE__ */ jsx("footer", { className: "mt-12 pt-8 border-t border-white/5 text-center", children: /* @__PURE__ */ jsx("p", { className: "text-xs text-[#6b7280] max-w-3xl mx-auto leading-relaxed", children: "All issued Sovereign assets are strictly backed by localized faction reserve vaults. This infrastructure operates purely as an in-game economic simulation and is entirely unaffiliated with Mojang AB, Microsoft, or official DonutSMP administration." }) });
}
const IndexRoute = Route.update({
  id: "/",
  path: "/",
  getParentRoute: () => Route$1
});
const rootRouteChildren = {
  IndexRoute
};
const routeTree = Route$1._addFileChildren(rootRouteChildren)._addFileTypes();
const getRouter = () => {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0
  });
  return router;
};
export {
  getRouter
};

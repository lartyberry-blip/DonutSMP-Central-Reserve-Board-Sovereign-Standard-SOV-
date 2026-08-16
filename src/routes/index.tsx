import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  type ChartOptions,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import {
  getStats,
  getOrders,
  getLeaderboard,
  createOrder,
  settleOrder,
  updateTokenValue,
  getTokenValue,
  listOrderOnAh,
  getPriceHistory,
  getFlaggedOrders,
  approveOrder,
  getCircuitBreakerState,
  setCircuitBreaker,
  getOperatorStatus,
  setOperatorStatus,
  computeUniquePriceOffset,
  type OrderRow,
  type LeaderboardRow,
  type StatsPayload,
  type PriceHistoryRow,
  type OperatorStatus,
} from '../server/orders.functions'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
)

export const Route = createFileRoute('/')({
  component: Home,
})

const BUY_PRICE = 200000
const FLOOR_PRICE = 150000
const ESCROW_WINDOW_SECONDS = 180 // 3-minute secure escrow channel

type OrderType = 'Buy' | 'Sell'

function formatTokens(n: number): string {
  return n.toLocaleString('en-US')
}

function formatDollars(n: number): string {
  return '$' + n.toLocaleString('en-US')
}

function timeLabel(d: Date | null): string {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

type MarketSession = { open: boolean; now: string; next: string }

function getNewYorkMarketSession(): MarketSession {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  const weekday = get('weekday')
  const hour = Number(get('hour'))
  const minute = Number(get('minute'))
  const minutes = hour * 60 + minute
  const businessDay = !['Sat', 'Sun'].includes(weekday)
  const open = businessDay && minutes >= 570 && minutes < 960
  const nowText = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(now)
  const next = open ? 'Closes at 4:00 PM ET' : businessDay && minutes < 570 ? 'Opens at 9:30 AM ET' : 'Opens next weekday at 9:30 AM ET'
  return { open, now: nowText, next }
}

function Home() {
  const [stats, setStats] = useState<StatsPayload>({
    circulatingSupply: 0,
    tokenValue: FLOOR_PRICE,
    totalWealthProtected: 0,
    circuitBreakerActive: false,
  })
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [priceHistory, setPriceHistory] = useState<PriceHistoryRow[]>([])
  const [flaggedOrders, setFlaggedOrders] = useState<OrderRow[]>([])
  const [operator, setOperator] = useState<OperatorStatus>({ online: false, updatedAt: null, message: 'Orders are accepted at all times; fulfillment begins when the operator is online.' })
  const [marketSession, setMarketSession] = useState<MarketSession>(() => getNewYorkMarketSession())

  // Order ticket form
  const [ign, setIgn] = useState('')
  const [orderType, setOrderType] = useState<OrderType>('Buy')
  const [quantity, setQuantity] = useState<string>('1')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Admin token value override
  const [adminTokenValue, setAdminTokenValue] = useState<string>(
    String(FLOOR_PRICE),
  )
  const [adminSaving, setAdminSaving] = useState(false)

  // Escrow modal — surfaces when one of this browser's orders is pushed to LISTED_ON_AH
  const [escrowOrder, setEscrowOrder] = useState<OrderRow | null>(null)
  // Track the IGN this browser is "acting as" so the modal targets the matching player's active window.
  // Set whenever the player submits an order ticket or an admin lists their order.
  const watchedIgnRef = useRef<string | null>(null)

  // List-on-AH inline form per order
  const [altAccount, setAltAccount] = useState<string>('')

  // Broadcast tickets generated for copy-paste
  const [broadcasts, setBroadcasts] = useState<Record<number, string>>({})

  // Simulator velocity slider
  const [simVelocity, setSimVelocity] = useState<number>(1000)

  // Circuit breaker manual override state
  const [breakerManual, setBreakerManual] = useState<boolean | null>(null)
  const [breakerSaving, setBreakerSaving] = useState(false)
  const [operatorMessage, setOperatorMessage] = useState('I am actively fulfilling SOV orders now.')
  const [operatorSaving, setOperatorSaving] = useState(false)

  const refreshAll = useCallback(async () => {
    const [s, o, l, ph, fl, op] = await Promise.all([
      getStats(),
      getOrders(),
      getLeaderboard(),
      getPriceHistory(),
      getFlaggedOrders(),
      getOperatorStatus(),
    ])
    setStats(s)
    setOrders(o)
    setLeaderboard(l)
    setPriceHistory(ph)
    setFlaggedOrders(fl)
    setOperator(op)
  }, [])

  useEffect(() => {
    refreshAll().catch((e) => {
      console.error('Initial load failed', e)
    })
    getTokenValue().then((r) => {
      setStats((prev) => ({ ...prev, tokenValue: r.tokenValue }))
      setAdminTokenValue(String(r.tokenValue))
    })
  }, [refreshAll])

  // Live polling so the escrow modal + circuit breaker state stay fresh in real time.
  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const [s, o, fl] = await Promise.all([
          getStats(),
          getOrders(),
          getFlaggedOrders(),
        ])
        setStats(s)
        setOrders(o)
        setFlaggedOrders(fl)

        // If the watched IGN has an order that just transitioned to LISTED_ON_AH, pop the escrow modal.
        const watched = watchedIgnRef.current
        if (watched) {
          const match = o.find(
            (row) =>
              row.ign.toLowerCase() === watched.toLowerCase() &&
              row.status === 'LISTED_ON_AH' &&
              !row.settled,
          )
          if (match) {
            setEscrowOrder((prev) =>
              prev && prev.id === match.id ? prev : match,
            )
          }
        }
      } catch (e) {
        // Polling errors are non-fatal; next tick will retry.
      }
    }, 4000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setMarketSession(getNewYorkMarketSession()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (operator.updatedAt) setOperatorMessage(operator.message)
  }, [operator.updatedAt])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)
    const trimmedIgn = ign.trim()
    const qty = Number(quantity)
    if (!trimmedIgn) {
      setFormError('Enter your Minecraft in-game name.')
      return
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 500) {
      setFormError('Quantity must be a whole number between 1 and 500.')
      return
    }
    setSubmitting(true)
    try {
      await createOrder({
        data: {
          ign: trimmedIgn,
          orderType,
          quantity: qty,
        },
      })
      // Mark this browser as acting for this IGN so the escrow modal can target it.
      watchedIgnRef.current = trimmedIgn
      setIgn('')
      setQuantity('1')
      await refreshAll()
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to submit order ticket.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleSettle = async (id: number) => {
    try {
      const result = await settleOrder({ data: { id } })
      setStats(result.stats)
      // Generate a copy-paste broadcast ticket for the admin.
      const order = orders.find((o) => o.id === id)
      if (order) {
        const ticket = `[SOV] 💸 Sovereign Standard Node #${order.hash} settled safely! Player ${order.ign} just injected ${formatDollars(order.amount)} into their faction vault. Mint yours at delicate-cactus-9158d6.netlify.app!`
        setBroadcasts((prev) => ({ ...prev, [id]: ticket }))
      }
      await refreshAll()
    } catch (err) {
      console.error('Settle failed', err)
      alert(
        err instanceof Error
          ? err.message
          : 'Failed to settle order.',
      )
    }
  }

  const handleListOnAh = async (id: number) => {
    const alt = altAccount.trim()
    if (!alt) {
      alert('Enter the alt account name that will list the receipt on /ah.')
      return
    }
    try {
      const updated = await listOrderOnAh({ data: { id, altAccount: alt } })
      // Surface the escrow modal immediately on this admin/operator window too.
      setEscrowOrder(updated)
      setAltAccount('')
      await refreshAll()
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : 'Failed to list order on auction house.',
      )
    }
  }

  const handleApprove = async (id: number) => {
    try {
      await approveOrder({ data: { id } })
      await refreshAll()
    } catch (err) {
      console.error('Approve failed', err)
    }
  }

  const handleUpdateTokenValue = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const val = Number(adminTokenValue)
    if (!Number.isFinite(val) || val < 0) return
    setAdminSaving(true)
    try {
      const result = await updateTokenValue({ data: { value: Math.round(val) } })
      setStats(result.stats)
      setStats((prev) => ({ ...prev, tokenValue: result.tokenValue }))
      await refreshAll()
    } catch (err) {
      console.error('Token value update failed', err)
    } finally {
      setAdminSaving(false)
    }
  }

  const handleBreakerToggle = async () => {
    setBreakerSaving(true)
    try {
      const next = !breakerManual
      await setCircuitBreaker({ data: { active: next } })
      setBreakerManual(next)
      await refreshAll()
    } catch (err) {
      console.error('Breaker toggle failed', err)
    } finally {
      setBreakerSaving(false)
    }
  }

  const handleOperatorToggle = async () => {
    setOperatorSaving(true)
    try {
      const next = await setOperatorStatus({
        data: {
          online: !operator.online,
          message: operatorMessage.trim() || 'Orders are accepted at all times; fulfillment begins when the operator is online.',
        },
      })
      setOperator(next)
    } catch (err) {
      console.error('Operator status update failed', err)
      window.alert(
        `Could not update the operator clock. ${err instanceof Error ? err.message : 'Check the PowerShell window for the local database error.'}`,
      )
    } finally {
      setOperatorSaving(false)
    }
  }

  // Sync the breaker manual override label once stats load.
  useEffect(() => {
    if (breakerManual === null) {
      getCircuitBreakerState()
        .then((r) => setBreakerManual(r.active))
        .catch(() => {})
    }
  }, [breakerManual, stats.circuitBreakerActive])

  return (
    <div className="min-h-screen text-[#e7e9ee]">
      <Header marketSession={marketSession} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <Hero />
        <MarketHoursPanel session={marketSession} />
        <OperatorAvailabilityPanel operator={operator} />
        {stats.circuitBreakerActive && <CircuitBreakerBanner />}
        <StatsBanner stats={stats} />
        <HowSovWorks stats={stats} />
        <LiquidityInterface breakerActive={stats.circuitBreakerActive} />
        <MarketTrendsChart history={priceHistory} stats={stats} />
        <OrderTicket
          ign={ign}
          setIgn={setIgn}
          orderType={orderType}
          setOrderType={setOrderType}
          quantity={quantity}
          setQuantity={setQuantity}
          handleSubmit={handleSubmit}
          submitting={submitting}
          formError={formError}
        />
        <TrackingQueue orders={orders} />
        <Leaderboard leaderboard={leaderboard} stats={stats} />
        <AdminConsole
          orders={orders}
          onSettle={handleSettle}
          adminTokenValue={adminTokenValue}
          setAdminTokenValue={setAdminTokenValue}
          handleUpdateTokenValue={handleUpdateTokenValue}
          adminSaving={adminSaving}
          altAccount={altAccount}
          setAltAccount={setAltAccount}
          onListOnAh={handleListOnAh}
          broadcasts={broadcasts}
          operator={operator}
          operatorMessage={operatorMessage}
          setOperatorMessage={setOperatorMessage}
          onOperatorToggle={handleOperatorToggle}
          operatorSaving={operatorSaving}
        />
        <YieldSimulator velocity={simVelocity} setVelocity={setSimVelocity} />
        <AnomalyRegistry
          flaggedOrders={flaggedOrders}
          onApprove={handleApprove}
        />
        <CircuitBreakerControls
          active={stats.circuitBreakerActive}
          manual={breakerManual}
          onToggle={handleBreakerToggle}
          saving={breakerSaving}
        />
        <LegalFooter />
      </main>

      {escrowOrder && (
        <EscrowModal order={escrowOrder} onClose={() => setEscrowOrder(null)} />
      )}
    </div>
  )
}

function Header({ marketSession }: { marketSession: MarketSession }) {
  return (
    <header className="sticky top-0 z-40 sov-glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div
            aria-label="DonutSMP Faction Logo"
            className="w-12 h-12 rounded-full sov-cyan-border flex items-center justify-center bg-[#0a0c10] shrink-0"
          >
            <span className="text-xl font-extrabold sov-cyan-glow">D</span>
          </div>
          <div className="min-w-0">
            <h1
              className="text-base sm:text-xl font-extrabold tracking-tight truncate"
              style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}
            >
              CENTRAL RESERVE DESK
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="relative inline-flex">
                <span className="w-2 h-2 rounded-full bg-emerald-400 sov-pulse" />
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-emerald-300 whitespace-nowrap">
                ● {marketSession.open ? 'MARKET OPEN' : 'MARKET CLOSED'} | {marketSession.now}
              </span>
            </div>
          </div>
        </div>
        <nav className="hidden sm:flex items-center gap-6 text-sm font-semibold">
          <a href="#top" className="sov-nav-link text-[#e7e9ee]">Home</a>
          <a href="#escrow" className="sov-nav-link text-[#e7e9ee]">Escrow Portal</a>
          <a href="#ledger" className="sov-nav-link text-[#e7e9ee]">Live Ledger</a>
          <a href="#trends" className="sov-nav-link text-[#e7e9ee]">Market Trends</a>
        </nav>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section id="top" className="pt-12 pb-8 text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full sov-cyan-border text-[11px] font-semibold sov-cyan-glow mb-5">
        DONUTSMP ECONOMIC INFRASTRUCTURE
      </div>
      <h2
        className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight sov-headline"
        style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}
      >
        The Server Economy, Secured.
      </h2>
      <p className="mt-5 max-w-2xl mx-auto text-base sm:text-lg text-[#9aa0ad]">
        Sovereign Standard [SOV] — a faction-reserve-backed token you can mint,
        hold, and cash out instantly. Trusted by the DonutSMP treasury.
      </p>
    </section>
  )
}

function CircuitBreakerBanner() {
  return (
    <div className="sov-cooldown rounded-xl px-5 py-4 mb-8 text-sm font-semibold flex items-center gap-3">
      <span className="text-lg">🧊</span>
      <span>
        Treasury Node Cooling Down. Redemption windows refresh shortly.
      </span>
    </div>
  )
}

function StatsBanner({ stats }: { stats: StatsPayload }) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
      <GlassStatCard
        label="Total Circulating Supply"
        value={`${formatTokens(stats.circulatingSupply)} SOV`}
        subtext="Verified in public circulation"
      />
      <GlassStatCard
        label="In-Game Token Value"
        value={formatDollars(stats.tokenValue)}
        subtext="Auto-adjusted by supply &amp; demand"
      />
      <GlassStatCard
        label="Total Wealth Protected"
        value={formatDollars(stats.totalWealthProtected)}
        subtext="Denominated in server cash"
      />
    </section>
  )
}

function GlassStatCard({
  label,
  value,
  subtext,
}: {
  label: string
  value: string
  subtext: string
}) {
  return (
    <div className="sov-glass rounded-2xl px-6 py-7">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#7d8493]">
        {label}
      </p>
      <p className="mt-3 text-3xl sm:text-4xl font-extrabold sov-gold">
        {value}
      </p>
      <p className="mt-2 text-sm text-[#6b7280]" dangerouslySetInnerHTML={{ __html: subtext }} />
    </div>
  )
}

function MarketHoursPanel({ session }: { session: MarketSession }) {
  const [alertsEnabled, setAlertsEnabled] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const previousOpenRef = useRef<boolean | null>(null)
  useEffect(() => {
    if ('Notification' in window) setAlertsEnabled(Notification.permission === 'granted')
  }, [])
  useEffect(() => {
    const previous = previousOpenRef.current
    previousOpenRef.current = session.open
    if (previous === null || previous === session.open || !('Notification' in window) || Notification.permission !== 'granted') return
    new Notification(session.open ? 'SOV market is open' : 'SOV market is closed', {
      body: session.open ? 'Live fulfillment is available during the New York session.' : 'New orders are queued for the next New York session.',
    })
  }, [session.open])
  const enableAlerts = async () => {
    if (!('Notification' in window)) {
      const message = 'Browser alerts are not supported here. The live market banner above will still update.'
      setAlertMessage(message)
      window.alert(message)
      return
    }
    try {
      setAlertMessage('Checking this browser for notification permission…')
      const permission = await Promise.race([
        Notification.requestPermission(),
        new Promise<NotificationPermission>((resolve) => window.setTimeout(() => resolve('default'), 1500)),
      ])
      setAlertsEnabled(permission === 'granted')
      if (permission === 'granted') {
        setAlertMessage('Alerts enabled. Keep this page open to receive market-open and market-close notices.')
        new Notification('SOV market alerts enabled', { body: 'This browser will show the current New York session status while this page is open.' })
      } else if (permission === 'denied') {
        const message = 'Alerts are blocked by this browser. Allow notifications for this site in browser settings, then try again.'
        setAlertMessage(message)
        window.alert(message)
      } else {
        const message = 'This browser did not open a notification prompt. The in-page market status will still update; use a regular browser for desktop alerts.'
        setAlertMessage(message)
        window.alert(message)
      }
    } catch {
      const message = 'This browser could not enable alerts. The live market banner will still update.'
      setAlertMessage(message)
      window.alert(message)
    }
  }
  return (
    <section className={`rounded-2xl p-5 mb-6 border ${session.open ? 'sov-market-open' : 'sov-market-closed'}`} aria-live="polite">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest">New York market session</p>
          <h2 className="mt-1 text-xl font-extrabold">{session.open ? '● Open for live fulfillment' : '● Closed — orders queue for the next session'}</h2>
          <p className="mt-1 text-sm text-[#9aa0ad]">{session.now} · {session.next}. You may submit an order anytime; after hours, it waits for an operator.</p>
        </div>
        <div className="sm:text-right">
          <button onClick={enableAlerts} disabled={alertsEnabled} className="sov-cyan-btn px-4 py-2.5 rounded-lg text-xs font-bold disabled:opacity-60">
            {alertsEnabled ? '✓ Browser alerts enabled' : 'Enable browser alerts'}
          </button>
          {alertMessage && <p className="mt-2 text-xs text-[#9aa0ad] max-w-xs">{alertMessage}</p>}
        </div>
      </div>
    </section>
  )
}

function OperatorAvailabilityPanel({ operator }: { operator: OperatorStatus }) {
  const updated = operator.updatedAt ? new Date(operator.updatedAt).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }) + ' ET' : 'No shift recorded yet'
  return (
    <section className="sov-glass rounded-2xl p-6 mb-14">
      <div className="flex items-center gap-3">
        <span className={`w-3 h-3 rounded-full ${operator.online ? 'bg-emerald-400 sov-pulse' : 'bg-[#6b7280]'}`} />
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#7d8493]">SOV operator availability</p>
          <h2 className="text-lg font-extrabold">{operator.online ? 'Clocked in — live fulfillment active' : 'Clocked out — orders are queued'}</h2>
        </div>
      </div>
      <p className="mt-3 text-sm text-[#9aa0ad]">{operator.message}</p>
      <p className="mt-2 text-xs text-[#6b7280]">Last status update: {updated}</p>
    </section>
  )
}

function HowSovWorks({ stats }: { stats: StatsPayload }) {
  const reserveNeeded = stats.circulatingSupply * FLOOR_PRICE
  const coverage = reserveNeeded > 0 ? Math.round((stats.totalWealthProtected / reserveNeeded) * 100) : 0
  return (
    <section id="how-it-works" className="sov-glass rounded-2xl p-6 sm:p-8 mb-14">
      <h2 className="text-xl font-extrabold">How SOV works</h2>
      <p className="mt-2 text-sm text-[#9aa0ad]">A Minecraft-only token workflow: submit an order, complete the in-game handoff, then the operator settles it on this public ledger.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        {[
          ['1. Submit', 'Request a SOV buy or sell using your Minecraft IGN.'],
          ['2. In-game exchange', 'Pay or receive DonutSMP cash through the agreed in-game handoff.'],
          ['3. Ledger settlement', 'The operator records completion; supply, holders, and price update.'],
        ].map(([title, text]) => <div key={title} className="rounded-xl bg-[#0a0c10] border border-white/5 p-5"><h3 className="font-bold sov-cyan-glow">{title}</h3><p className="mt-2 text-sm text-[#9aa0ad]">{text}</p></div>)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 text-sm">
        <div><p className="text-[#7d8493]">Mint price</p><p className="font-bold sov-gold">$200,000</p></div>
        <div><p className="text-[#7d8493]">Redemption floor</p><p className="font-bold sov-gold">$150,000</p></div>
        <div><p className="text-[#7d8493]">Market price</p><p className="font-bold sov-gold">{formatDollars(stats.tokenValue)}</p></div>
        <div><p className="text-[#7d8493]">Coverage indicator</p><p className="font-bold sov-gold">{coverage}%</p></div>
      </div>
      <p className="mt-5 text-xs text-[#6b7280]">Market price uses recorded settled buy/sell behavior from the last 24 hours: net demand moves the price; trade count adds a small activity component. It is a transparent in-game rule, not a real-world investment valuation. Mint, redemption, and transfer fees: $0 unless the server rules say otherwise.</p>
    </section>
  )
}

function LiquidityInterface({ breakerActive }: { breakerActive: boolean }) {
  return (
    <section id="escrow" className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-14">
      <div className="sov-glass rounded-2xl p-7">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 sov-pulse" />
          <h3 className="text-lg font-bold text-[#e7e9ee]">Acquisition Desk</h3>
        </div>
        <p className="text-[#9aa0ad] leading-relaxed mb-6">
          Mint new SOV tokens at the fixed rate of{' '}
          <span className="sov-gold font-bold">$200,000</span> each. Funds are
          routed instantly through our secure escrow rail.
        </p>
        <a href="#ticket" className="sov-cyan-btn inline-block px-6 py-3 rounded-xl font-bold text-sm">
          Open Safe Buy Order
        </a>
      </div>

      <div className="sov-glass rounded-2xl p-7">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-2.5 h-2.5 rounded-full sov-gold sov-pulse" />
          <h3 className="text-lg font-bold text-[#e7e9ee]">Redemption Treasury</h3>
        </div>
        <p className="text-[#9aa0ad] leading-relaxed mb-6">
          Redeem your SOV tokens back into liquid server cash instantly at the
          guaranteed floor rate of{' '}
          <span className="sov-gold font-bold">$150,000</span> each.
        </p>
        {breakerActive ? (
          <button
            disabled
            className="sov-cooldown inline-block px-6 py-3 rounded-xl font-bold text-sm cursor-not-allowed"
          >
            Treasury Node Cooling Down. Redemption windows refresh shortly.
          </button>
        ) : (
          <a href="#ticket" className="sov-gold-btn inline-block px-6 py-3 rounded-xl font-bold text-sm">
            Request Instant Cash Out
          </a>
        )}
      </div>
    </section>
  )
}

function MarketTrendsChart({ history, stats }: { history: PriceHistoryRow[]; stats: StatsPayload }) {
  const chartData = useMemo(() => {
    const labels = history.map((h) => timeLabel(h.createdAt))
    const values = history.map((h) => h.tokenValue)
    return {
      labels,
      datasets: [
        {
          label: 'SOV Token Value',
          data: values,
          borderColor: '#00D2FF',
          borderWidth: 2.5,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#00D2FF',
          pointHoverBorderColor: '#04141a',
          fill: true,
          backgroundColor: (ctx: { chart: { ctx: CanvasRenderingContext2D } }) => {
            const { ctx: c } = ctx.chart
            const grad = c.createLinearGradient(0, 0, 0, 320)
            grad.addColorStop(0, 'rgba(0, 210, 255, 0.28)')
            grad.addColorStop(1, 'rgba(0, 210, 255, 0.0)')
            return grad
          },
        },
      ],
    }
  }, [history])

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0a0c10',
          borderColor: 'rgba(0,210,255,0.5)',
          borderWidth: 1,
          titleColor: '#00D2FF',
          bodyColor: '#e7e9ee',
          padding: 12,
          callbacks: {
            label: (ctx) =>
              `Token Value: ${formatDollars(Number(ctx.raw))}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#6b7280', maxTicksLimit: 6, font: { size: 10 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#6b7280',
            font: { size: 10 },
            callback: (v) => '$' + Number(v).toLocaleString('en-US'),
          },
        },
      },
    }),
    [],
  )

  const empty = history.length === 0

  return (
    <section id="trends" className="sov-glass sov-chart-panel rounded-2xl p-6 sm:p-8 mb-14">
      <div className="flex items-center gap-3 mb-5">
        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 sov-pulse" />
        <h3 className="text-xl font-bold">Sovereign Market Trends &amp; Velocity Matrix</h3>
      </div>
      <p className="text-sm text-[#9aa0ad] mb-5">
        Current behavior-model price: <span className="sov-gold font-bold">{formatDollars(stats.tokenValue)}</span>. Updated from settled player buying/selling and logged aggregate events.
      </p>
      {empty ? (
        <div className="sov-chart-canvas-wrap flex items-center justify-center text-sm text-[#6b7280]">
          Awaiting the first market event. Ingest an aggregate economy log to begin the trend line.
        </div>
      ) : (
        <div className="sov-chart-canvas-wrap">
          <Line data={chartData} options={options} />
        </div>
      )}
    </section>
  )
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
  formError,
}: {
  ign: string
  setIgn: (v: string) => void
  orderType: OrderType
  setOrderType: (v: OrderType) => void
  quantity: string
  setQuantity: (v: string) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  submitting: boolean
  formError: string | null
}) {
  const qty = Number(quantity) || 0
  const unitPrice = orderType === 'Buy' ? BUY_PRICE : FLOOR_PRICE
  const total = qty * unitPrice

  return (
    <section id="ticket" className="sov-glass rounded-2xl p-6 sm:p-8 mb-12">
      <div className="flex items-center gap-3 mb-6">
        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 sov-pulse" />
        <h3 className="text-xl font-bold">Create Order Ticket</h3>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#7d8493] mb-2">
            Minecraft In-Game Name (IGN)
          </label>
          <input
            type="text"
            value={ign}
            onChange={(e) => setIgn(e.target.value)}
            placeholder="e.g. SteveBuilder"
            className="w-full rounded-xl bg-[#0a0c10] border border-white/10 px-4 py-3 text-sm text-[#e7e9ee] placeholder-[#5a606b] focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#7d8493] mb-2">
            Order Type
          </label>
          <select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as OrderType)}
            className="w-full rounded-xl bg-[#0a0c10] border border-white/10 px-4 py-3 text-sm text-[#e7e9ee] focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition"
          >
            <option value="Buy">Buy Token [SOV]</option>
            <option value="Sell">Sell Token [SOV]</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#7d8493] mb-2">
            Token Quantity (Min 1 - Max 500)
          </label>
          <input
            type="number"
            min={1}
            max={500}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-xl bg-[#0a0c10] border border-white/10 px-4 py-3 text-sm text-[#e7e9ee] focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition"
          />
        </div>

        <div className="sm:col-span-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
          <div className="text-sm text-[#9aa0ad]">
            Estimated Order Value:{' '}
            <span className="sov-gold font-bold text-base">
              {formatDollars(total)}
            </span>
            <span className="text-[#6b7280] ml-2">
              @ {formatDollars(unitPrice)} / SOV
            </span>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="sov-cyan-btn px-7 py-3 rounded-xl font-bold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting…' : 'Submit Order Ticket'}
          </button>
        </div>

        {formError && (
          <div className="sm:col-span-3 text-sm text-red-400 font-medium">
            {formError}
          </div>
        )}
      </form>
    </section>
  )
}

function StatusBadge({ order }: { order: OrderRow }) {
  if (order.settled || order.status === 'SETTLED') {
    return (
      <span className="sov-settled inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold">
        ● TRANSACTION COMPLETE (SETTLED)
      </span>
    )
  }
  if (order.status === 'LISTED_ON_AH') {
    return (
      <span className="sov-listed inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold">
        🔵 LISTED ON /AH — SECURE ESCROW ACTIVE
      </span>
    )
  }
  return (
    <span className="sov-awaiting inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold">
      ⏳ Awaiting In-Game Escrow Handshake
    </span>
  )
}

function TrackingQueue({ orders }: { orders: OrderRow[] }) {
  return (
    <section id="ledger" className="sov-glass rounded-2xl p-6 sm:p-8 mb-14 overflow-x-auto">
      <div className="flex items-center gap-3 mb-5">
        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 sov-pulse" />
        <h3 className="text-xl font-bold">Live Public Tracking Queue</h3>
      </div>
      <table className="w-full text-left text-sm min-w-[720px]">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-[#7d8493] border-b border-white/10">
            <th className="py-3 pr-4 font-semibold">Hash ID</th>
            <th className="py-3 pr-4 font-semibold">Player IGN</th>
            <th className="py-3 pr-4 font-semibold">Order Type</th>
            <th className="py-3 pr-4 font-semibold">Amount</th>
            <th className="py-3 pr-4 font-semibold">Unique Price</th>
            <th className="py-3 font-semibold">Settlement Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-8 text-center text-[#6b7280]">
                No active orders in the queue. Submit an order ticket above to
                start the ledger.
              </td>
            </tr>
          ) : (
            orders.map((o) => (
              <tr
                key={o.id}
                className={`border-b border-white/5 sov-row-in hover:bg-white/[0.02] transition ${o.flagged ? 'sov-flagged-row' : ''}`}
              >
                <td className="py-3 pr-4 font-mono sov-cyan-glow text-xs">
                  #{o.hash}
                </td>
                <td className="py-3 pr-4 font-semibold">{o.ign}</td>
                <td className="py-3 pr-4">
                  <span
                    className={
                      o.orderType === 'Buy'
                        ? 'text-cyan-300 font-semibold'
                        : 'text-amber-300 font-semibold'
                    }
                  >
                    {o.orderType === 'Buy' ? 'Buy' : 'Sell'} Token [SOV]
                  </span>
                </td>
                <td className="py-3 pr-4 sov-gold font-bold">
                  {formatDollars(o.amount)}
                </td>
                <td className="py-3 pr-4 font-mono text-xs">
                  {o.uniquePrice ? formatDollars(o.uniquePrice) : '—'}
                </td>
                <td className="py-3">
                  <StatusBadge order={o} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  )
}

function Leaderboard({
  leaderboard,
  stats,
}: {
  leaderboard: LeaderboardRow[]
  stats: StatsPayload
}) {
  const initializing = leaderboard.length === 0 && stats.circulatingSupply === 0
  return (
    <section className="sov-glass rounded-2xl p-6 sm:p-8 mb-14 overflow-x-auto">
      <div className="flex items-center gap-3 mb-5">
        <span className="w-2.5 h-2.5 rounded-full sov-gold sov-pulse" />
        <h3 className="text-xl font-bold">Official Distribution Registry</h3>
      </div>
      <table className="w-full text-left text-sm min-w-[640px]">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-[#7d8493] border-b border-white/10">
            <th className="py-3 pr-4 font-semibold">Rank</th>
            <th className="py-3 pr-4 font-semibold">Player IGN</th>
            <th className="py-3 pr-4 font-semibold">Token Holdings</th>
            <th className="py-3 pr-4 font-semibold">Wealth (Server Cash)</th>
            <th className="py-3 font-semibold">Holder Status</th>
          </tr>
        </thead>
        <tbody>
          {initializing ? (
            <tr>
              <td
                colSpan={5}
                className="py-8 text-center text-[#9aa0ad] text-sm"
              >
                Registry Initializing… No active tokens currently in
                circulation. Submit an open buy order below to lock in the Rank
                1 spot!
              </td>
            </tr>
          ) : (
            leaderboard.map((row) => (
              <tr
                key={row.ign}
                className="border-b border-white/5 sov-row-in hover:bg-white/[0.02] transition"
              >
                <td className="py-3 pr-4 font-bold sov-cyan-glow">
                  Rank {row.id}
                </td>
                <td className="py-3 pr-4 font-semibold">{row.ign}</td>
                <td className="py-3 pr-4 sov-gold font-bold">
                  {formatTokens(row.totalTokens)} SOV
                </td>
                <td className="py-3 pr-4 sov-gold font-bold">
                  {formatDollars(row.totalWealth)}
                </td>
                <td className="py-3">
                  <span className="sov-verified inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold">
                    ● VERIFIED HOLDER
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  )
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
  operatorSaving,
}: {
  orders: OrderRow[]
  onSettle: (id: number) => void
  adminTokenValue: string
  setAdminTokenValue: (v: string) => void
  handleUpdateTokenValue: (e: React.FormEvent<HTMLFormElement>) => void
  adminSaving: boolean
  altAccount: string
  setAltAccount: (v: string) => void
  onListOnAh: (id: number) => void
  broadcasts: Record<number, string>
  operator: OperatorStatus
  operatorMessage: string
  setOperatorMessage: (v: string) => void
  onOperatorToggle: () => void
  operatorSaving: boolean
}) {
  return (
    <>
      <hr className="border-white/10 my-10" />
      <section className="sov-glass rounded-2xl p-6 sm:p-8 border border-cyan-400/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚙️</span>
            <h3 className="text-lg font-bold tracking-tight">
              SOVEREIGN SYSTEM ADMINISTRATIVE MANAGEMENT CONTROLS
            </h3>
          </div>
          <form
            onSubmit={handleUpdateTokenValue}
            className="flex items-center gap-2"
          >
            <label className="text-xs font-semibold uppercase tracking-wider text-[#7d8493] whitespace-nowrap">
              Token Value:
            </label>
            <input
              type="number"
              min={0}
              step={1000}
              value={adminTokenValue}
              onChange={(e) => setAdminTokenValue(e.target.value)}
              className="w-32 rounded-lg bg-[#0a0c10] border border-white/10 px-3 py-2 text-sm text-[#e7e9ee] focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition"
            />
            <button
              type="submit"
              disabled={adminSaving}
              className="sov-cyan-btn px-4 py-2 rounded-lg font-bold text-xs disabled:opacity-60"
            >
              {adminSaving ? 'Saving…' : 'Update Global'}
            </button>
          </form>
        </div>

        <div className="mb-6 rounded-xl bg-[#0a0c10] border border-white/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#7d8493]">Operator clock</p>
          <p className="mt-1 text-sm text-[#9aa0ad]">This public status tells players whether new orders can be fulfilled live or will wait in the queue.</p>
          <div className="mt-3 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              maxLength={240}
              value={operatorMessage}
              onChange={(e) => setOperatorMessage(e.target.value)}
              placeholder="e.g. Back at 6 PM ET; queued orders will be handled first."
              className="flex-1 rounded-lg bg-[#111215] border border-white/10 px-3 py-2 text-sm text-[#e7e9ee] placeholder-[#5a606b] focus:outline-none focus:border-cyan-400/60"
            />
            <button onClick={onOperatorToggle} disabled={operatorSaving} className="sov-cyan-btn px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-60">
              {operatorSaving ? 'Updating…' : operator.online ? 'Clock out' : 'Clock in'}
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:items-end">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#7d8493] mb-2">
              Alt Account (lists receipts on /ah)
            </label>
            <input
              type="text"
              value={altAccount}
              onChange={(e) => setAltAccount(e.target.value)}
              placeholder="e.g. SovAlt_07"
              className="w-full rounded-lg bg-[#0a0c10] border border-white/10 px-3 py-2 text-sm text-[#e7e9ee] placeholder-[#5a606b] focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition"
            />
          </div>
          <p className="text-xs text-[#6b7280] sm:max-w-xs">
            Enter the alt account once, then click "List on /AH" on any pending order to dispatch the secure escrow modal.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[860px]">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-[#7d8493] border-b border-white/10">
                <th className="py-3 pr-4 font-semibold">Hash ID</th>
                <th className="py-3 pr-4 font-semibold">Player IGN</th>
                <th className="py-3 pr-4 font-semibold">Type</th>
                <th className="py-3 pr-4 font-semibold">Qty</th>
                <th className="py-3 pr-4 font-semibold">Status</th>
                <th className="py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#6b7280]">
                    No active tickets in the queue.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr
                    key={o.id}
                    className={`border-b border-white/5 hover:bg-white/[0.02] transition ${o.flagged ? 'sov-flagged-row' : ''}`}
                  >
                    <td className="py-3 pr-4 font-mono sov-cyan-glow text-xs">
                      #{o.hash}
                    </td>
                    <td className="py-3 pr-4 font-semibold">{o.ign}</td>
                    <td className="py-3 pr-4">
                      {o.orderType === 'Buy' ? 'Buy' : 'Sell'}
                    </td>
                    <td className="py-3 pr-4">{o.quantity}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge order={o} />
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {o.settled ? (
                          <span className="text-[#6b7280] text-xs">
                            Completed
                          </span>
                        ) : (
                          <>
                            {o.status !== 'LISTED_ON_AH' && (
                              <button
                                onClick={() => onListOnAh(o.id)}
                                className="px-3 py-2 rounded-lg font-bold text-xs sov-listed"
                              >
                                🔵 List on /AH
                              </button>
                            )}
                            <button
                              onClick={() => onSettle(o.id)}
                              className="sov-admin-btn px-3 py-2 rounded-lg font-bold text-xs"
                            >
                              ✅ Settle &amp; Transfer
                            </button>
                          </>
                        )}
                      </div>
                      {broadcasts[o.id] && (
                        <BroadcastTicket text={broadcasts[o.id]} />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function BroadcastTicket({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard may be unavailable; the text remains selectable.
    }
  }
  return (
    <div className="mt-2">
      <div className="sov-broadcast rounded-lg px-3 py-2 text-xs text-[#e7e9ee] break-words select-all">
        {text}
      </div>
      <button
        onClick={copy}
        className="mt-1 text-[11px] font-bold sov-cyan-glow hover:underline"
      >
        {copied ? '✓ Copied to clipboard' : 'Copy broadcast ticket'}
      </button>
    </div>
  )
}

function YieldSimulator({
  velocity,
  setVelocity,
}: {
  velocity: number
  setVelocity: (v: number) => void
}) {
  // Projected daily figures based on the buy/sell price delta.
  const spreadPerToken = BUY_PRICE - FLOOR_PRICE
  const treasuryInflow = velocity * spreadPerToken
  // Assume a 60/40 buy/sell split for the projection.
  const buyCount = Math.round(velocity * 0.6)
  const sellCount = velocity - buyCount
  const grossMintVolume = buyCount * BUY_PRICE
  const grossRedemptionVolume = sellCount * FLOOR_PRICE
  const netServerDollarProfit = treasuryInflow

  return (
    <section className="sov-glass rounded-2xl p-6 sm:p-8 mb-14">
      <div className="flex items-center gap-3 mb-3">
        <span className="w-2.5 h-2.5 rounded-full sov-gold sov-pulse" />
        <h3 className="text-xl font-bold">Yield &amp; Reserves Simulation Engine</h3>
      </div>
      <p className="text-sm text-[#9aa0ad] mb-6 max-w-3xl">
        Internal forecasting calculator. Scale simulated trade velocity to project
        treasury cash flows and net server-dollar profit margins based on the
        buy/sell price delta.
      </p>

      <div className="mb-6">
        <label className="block text-xs font-semibold uppercase tracking-wider text-[#7d8493] mb-2">
          Simulated Trade Velocity — {formatTokens(velocity)} transactions / day
        </label>
        <input
          type="range"
          min={0}
          max={10000}
          step={50}
          value={velocity}
          onChange={(e) => setVelocity(Number(e.target.value))}
          className="sov-range"
        />
        <div className="flex justify-between text-[11px] text-[#6b7280] mt-1">
          <span>0</span>
          <span>5,000</span>
          <span>10,000</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SimCard label="Projected Daily Treasury Inflow" value={formatDollars(treasuryInflow)} />
        <SimCard label="Gross Mint Volume (Buy)" value={formatDollars(grossMintVolume)} />
        <SimCard label="Gross Redemption Volume (Sell)" value={formatDollars(grossRedemptionVolume)} />
        <SimCard label="Net Server-Dollar Profit Margin" value={formatDollars(netServerDollarProfit)} highlight />
      </div>

      <p className="mt-5 text-xs text-[#6b7280]">
        Spread per token: {formatDollars(spreadPerToken)} (Buy {formatDollars(BUY_PRICE)} − Floor {formatDollars(FLOOR_PRICE)}). Projection assumes a 60/40 buy/sell split.
      </p>
    </section>
  )
}

function SimCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-5 py-5 ${highlight ? 'sov-cyan-border' : 'border border-white/5'} bg-[#0a0c10]`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-[#7d8493]">{label}</p>
      <p className={`mt-2 text-2xl font-extrabold ${highlight ? 'sov-gold' : 'sov-cyan-glow'}`}>{value}</p>
    </div>
  )
}

function AnomalyRegistry({
  flaggedOrders,
  onApprove,
}: {
  flaggedOrders: OrderRow[]
  onApprove: (id: number) => void
}) {
  return (
    <section className="sov-glass rounded-2xl p-6 sm:p-8 mb-14 border border-red-400/20">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-lg">⚠️</span>
        <h3 className="text-xl font-bold text-[#ff5470]">
          CRITICAL ECONOMIC ANOMALY — DETECTED SPEED EXPLOIT
        </h3>
      </div>
      <p className="text-sm text-[#9aa0ad] mb-5 max-w-3xl">
        Private admin-only registry. Any single Minecraft IGN filing more than 3
        high-volume orders within a rolling 60-second window is dumped here. Their
        escrow handshake processing is permanently halted until an admin manually
        approves the order.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[720px]">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-[#7d8493] border-b border-white/10">
              <th className="py-3 pr-4 font-semibold">Hash ID</th>
              <th className="py-3 pr-4 font-semibold">Player IGN</th>
              <th className="py-3 pr-4 font-semibold">Type</th>
              <th className="py-3 pr-4 font-semibold">Qty</th>
              <th className="py-3 pr-4 font-semibold">Detected</th>
              <th className="py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {flaggedOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#6b7280]">
                  No anomalies detected. All escrow handshakes are processing normally.
                </td>
              </tr>
            ) : (
              flaggedOrders.map((o) => (
                <tr key={o.id} className="border-b border-white/5 sov-flagged-row">
                  <td className="py-3 pr-4 font-mono sov-cyan-glow text-xs">#{o.hash}</td>
                  <td className="py-3 pr-4 font-semibold">{o.ign}</td>
                  <td className="py-3 pr-4">{o.orderType}</td>
                  <td className="py-3 pr-4">{o.quantity}</td>
                  <td className="py-3 pr-4 text-[#6b7280] text-xs">{timeLabel(o.createdAt)}</td>
                  <td className="py-3">
                    <span className="sov-anomaly inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold mr-2">
                      ⚠️ FLAGGED
                    </span>
                    <button
                      onClick={() => onApprove(o.id)}
                      className="sov-admin-btn px-3 py-2 rounded-lg font-bold text-xs"
                    >
                      ✓ Approve &amp; Release Escrow
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function CircuitBreakerControls({
  active,
  manual,
  onToggle,
  saving,
}: {
  active: boolean
  manual: boolean | null
  onToggle: () => void
  saving: boolean
}) {
  return (
    <section className="sov-glass rounded-2xl p-6 sm:p-8 mb-14">
      <div className="flex items-center gap-3 mb-3">
        <span className="w-2.5 h-2.5 rounded-full sov-gold sov-pulse" />
        <h3 className="text-xl font-bold">Reserve Circuit Breaker</h3>
      </div>
      <p className="text-sm text-[#9aa0ad] mb-5 max-w-3xl">
        Automatic safety cap. Trips when redemption outflow exceeds 1,000 SOV
        within 1 hour or when total wealth protected collapses to zero. While
        active, the public "Request Instant Cash Out" button is frozen instantly.
        An admin can also force the breaker on or off below.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <span
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${
            active ? 'sov-cooldown' : 'sov-settled'
          }`}
        >
          {active ? '🧊 BREAKER ACTIVE — REDEMPTIONS FROZEN' : '● BREAKER CLEAR — REDEMPTIONS LIVE'}
        </span>
        <button
          onClick={onToggle}
          disabled={saving || manual === null}
          className="sov-cyan-btn px-5 py-2.5 rounded-lg font-bold text-xs disabled:opacity-60"
        >
          {saving
            ? 'Updating…'
            : manual
              ? 'Release Breaker (Allow Redemptions)'
              : 'Force Freeze (Block Redemptions)'}
        </button>
      </div>
    </section>
  )
}

function EscrowModal({
  order,
  onClose,
}: {
  order: OrderRow
  onClose: () => void
}) {
  // 3-minute visual SVG countdown bar that depletes smoothly from right to left.
  const listedAt = order.listedAt ? new Date(order.listedAt).getTime() : Date.now()
  const deadline = listedAt + ESCROW_WINDOW_SECONDS * 1000
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const remainingMs = Math.max(0, deadline - now)
  const remainingSec = Math.ceil(remainingMs / 1000)
  const fraction = Math.max(0, Math.min(1, remainingMs / (ESCROW_WINDOW_SECONDS * 1000)))

  // SVG geometry: a 480px-wide track, fill depletes from right to left.
  const trackWidth = 480
  const fillWidth = trackWidth * fraction

  const uniquePrice = order.uniquePrice ?? (order.orderType === 'Buy' ? BUY_PRICE : FLOOR_PRICE) + computeUniquePriceOffset(order.hash)
  const altAccount = order.altAccount ?? 'Alt_Account_Placeholder'

  const expired = remainingMs <= 0

  return (
    <div className="sov-escrow-overlay" role="dialog" aria-modal="true" aria-labelledby="escrow-title">
      <div className="sov-escrow-panel p-7">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest sov-cyan-glow">
              🔵 HIGH-PRIORITY ESCROW DISPATCH
            </p>
            <h3 id="escrow-title" className="mt-1 text-2xl font-extrabold text-[#e7e9ee]">
              Secure Escrow Channel Open
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#6b7280] hover:text-[#e7e9ee] text-xl leading-none"
            aria-label="Close escrow notification"
          >
            ✕
          </button>
        </div>

        <div className="rounded-lg bg-[#0a0c10] border border-white/5 px-4 py-3 mb-5 text-sm">
          <div className="grid grid-cols-2 gap-y-2">
            <span className="text-[#7d8493]">Order Hash</span>
            <span className="font-mono sov-cyan-glow text-right">#{order.hash}</span>
            <span className="text-[#7d8493]">Your Unique Price</span>
            <span className="sov-gold font-bold text-right">{formatDollars(uniquePrice)}</span>
            <span className="text-[#7d8493]">Listed By (Alt)</span>
            <span className="font-semibold text-right">{altAccount}</span>
          </div>
        </div>

        {/* 3-minute visual SVG countdown bar, depletes right-to-left */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-[#7d8493] mb-2">
            <span>Secure Escrow Channel</span>
            <span className={expired ? 'text-red-400 font-bold' : 'sov-cyan-glow font-bold'}>
              {expired ? 'EXPIRED' : `${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, '0')}`}
            </span>
          </div>
          <svg width="100%" height="14" viewBox={`0 0 ${trackWidth} 14`} preserveAspectRatio="none">
            <rect x="0" y="2" width={trackWidth} height="10" rx="5" className="sov-countdown-track" />
            <rect
              x={trackWidth - fillWidth}
              y="2"
              width={fillWidth}
              height="10"
              rx="5"
              className="sov-countdown-fill"
            />
          </svg>
        </div>

        <div className="rounded-lg sov-cyan-border bg-[#0a0c10] px-4 py-4 mb-5">
          <p className="text-sm font-extrabold text-[#e7e9ee] leading-relaxed">
            SECURE DISPATCH: Go to in-game <span className="sov-cyan-glow">/ah</span>. Locate the item listed by{' '}
            <span className="sov-gold">{altAccount}</span> matching your exact price of{' '}
            <span className="sov-gold">{formatDollars(uniquePrice)}</span>. Buy this receipt/token wrapper immediately before the 3-minute secure escrow channel expires.
          </p>
        </div>

        <button
          onClick={onClose}
          className="sov-cyan-btn w-full px-6 py-3 rounded-xl font-bold text-sm"
        >
          {expired ? 'Acknowledge — Channel Expired' : 'I understand — Opening /ah'}
        </button>
      </div>
    </div>
  )
}

function LegalFooter() {
  return (
    <footer className="mt-12 pt-8 border-t border-white/5 text-center">
      <p className="text-xs text-[#6b7280] max-w-3xl mx-auto leading-relaxed">
        All issued Sovereign assets are strictly backed by localized faction
        reserve vaults. This infrastructure operates purely as an in-game
        economic simulation and is entirely unaffiliated with Mojang AB,
        Microsoft, or official DonutSMP administration.
      </p>
    </footer>
  )
}

export default Home

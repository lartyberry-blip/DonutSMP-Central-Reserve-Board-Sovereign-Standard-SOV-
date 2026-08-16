# DonutSMP Central Reserve Board

An authoritative, high-trust economic dashboard for the **Sovereign Standard [SOV]** token — the custom economy token for the DonutSMP Minecraft server. Players mint SOV at a fixed rate, redeem it for server cash at a guaranteed floor, and track every transaction on a live public ledger. A private admin console lets server operators settle orders and promote verified holders.

## What it does

- **Monetary position banner** showing circulating supply, in-game token value, and total wealth protected — all freshly reset to a clean launch.
- **2-Step liquidity interface**: an Acquisition Desk (mint SOV at $200,000 each) and a Redemption Treasury (cash out at the $150,000 floor).
- **Schwab-style order ticket terminal**: submit a buy/sell ticket with IGN, order type, and quantity (1–500). Each submission generates a unique 8-character tracking hash (`#SOV-XXXX-X`) and appends a row to the live public queue with an "Awaiting In-Game Escrow Handshake" status.
- **Official Distribution Registry**: a clean leaderboard ranking the richest verified SOV holders. Starts empty with a launch placeholder.
- **Private admin console**: mirrors the public queue, with a neon-green "Settle Order & Transfer Wealth" button per ticket. Settling flips the public status to a permanent green "TRANSACTION COMPLETE (SETTLED)" badge, adds the player as a verified holder on the leaderboard, and updates the main stats cards. Includes a fast field to globally change the in-game token value.
- **Compliance footer** clarifying this is an in-game simulation unaffiliated with Mojang, Microsoft, or official DonutSMP administration.

## Key Technologies

- **TanStack Start** (React 19 + TanStack Router v1) — full-stack React framework
- **Vite 7** — build tooling
- **Tailwind CSS 4** — styling with a custom cyan/gold dark-graphite theme
- **Netlify Database** (managed Postgres) with **Drizzle ORM** — persistent storage for orders and global settings
- **TypeScript 5.9** (strict mode)

## Run locally

```bash
npm install
npm run dev      # start dev server (port 3000)
npm run build    # production build
npm run preview  # preview production build
```

For a local experience including Netlify Database emulation, use the Netlify CLI:

```bash
netlify dev --port 8889
```

Database migrations are applied automatically on deploy — no manual migration step is required.

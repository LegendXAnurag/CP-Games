# CP Games

Premium Competitive Programming Games Platform.

A multiplayer arena where Codeforces problems meet real-time strategy, tug-of-war battles, and tactical board games.

---

## 🎮 Game Modes
- **Bingo**: Classic 5×5 grid. Solve CF problems to claim tiles. First to complete a line wins (Classic and Replace modes supported).
- **Tug of War**: Two sides, one rope. Solve harder problems to pull the flag your way (Classic and Grid modes supported).
- **Ticket to Ride**: Europe map with cities and tracks. Earn coins by solving problems in the marketplace. Spend coins to claim train routes, complete destination tickets, and build stations to bypass opponent blocks.

---

## 🛠️ Tech Stack
- **Frontend:** [Next.js](https://nextjs.org/) (React 19), [Framer Motion](https://www.framer.com/motion/), [Tailwind CSS](https://tailwindcss.com/)
- **Database:** [Prisma ORM](https://www.prisma.io/) with PostgreSQL (Neon)
- **Real-time Sync:** [Pusher Websockets](https://pusher.com/) for instant Ticket to Ride map updates
- **Styling:** Tailwind CSS, Radix UI

---

## 🚀 Getting Started

### 1. Install Dependencies
Navigate to the `bingo-cp` folder and run:
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the `bingo-cp` root. You can base it on `.env.example`:
```env
# Connection URL for Neon/PostgreSQL database
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"

# Polling and Cooldown Gating
NEXT_PUBLIC_POLL_INTERVAL_MS=15000
POLLING_COOLDOWN_SECONDS=10
CODEFORCES_CACHE_DURATION_MS=10000

# Pusher Channels Config (for Ticket to Ride real-time sync)
PUSHER_APP_ID="your_pusher_app_id"
NEXT_PUBLIC_PUSHER_KEY="your_pusher_key"
PUSHER_SECRET="your_pusher_secret"
NEXT_PUBLIC_PUSHER_CLUSTER="your_pusher_cluster"
```

### 3. Setup and Seed the Database
Prisma client generation, schema pushing, and map seeding are handled automatically:
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```
*(Note: Seeding loads the default Europe map coordinates and connections so you can play Ticket to Ride immediately).*

### 4. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🤝 Contributing
Contributions are welcome! If you'd like to:
* Suggest or build new game modes.
* Draw new maps for Ticket to Ride.
* Improve Codeforces API reliability.

Please submit a Pull Request or open an issue on the repository: [LegendXAnurag/CP-Games](https://github.com/LegendXAnurag/CP-Games).
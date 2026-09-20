# 🌐 TileVista — 3D Virtual Showroom & Showroom Management System

Welcome to the official repository of **TileVista**, a virtual tile and bathware visualization, checkout cart, and administrative showroom management system built as a highly performant and simplified monorepo.

---

## 🏗️ Simplified Repository Layout

The project organized directories cleanly to decouple frontend customizer grids, backend business logic, database migrations, and shared data layers:

```
tile-vista/
├── frontend/                     # Next.js App Router Frontend (Port 3000)
│   └── src/
│       ├── app/                  # Routing pages
│       ├── features/             # admin, analytics, auth, cart, designer, packages, products
│       ├── components/           # UI components, canvas components
│       └── utils/                # LKR currency formatters, pricing, room validators
│
├── backend/                      # NestJS API Backend (Port 4000)
│   └── src/
│       ├── modules/              # analytics, auth, cart, designer, inventory, orders, packages, products, users
│       ├── common/               # JWT guard strategies
│       └── config/               # Security variables configs
│
├── database/                     # Relational DB Models & Migrations
│   └── prisma/
│       ├── schema.prisma         # MySQL data schema
│       └── seed.ts               # Pre-populated mock catalog products seeder
│
└── shared/                       # Shared modules
    └── types/                    # Common TypeScript interfaces
```

---

## ⚡ Tech Stack & Enablers

*   **Monorepo orchestration:** [Turborepo](https://turbo.build/) + NPM Workspaces
*   **Frontend Client:** [Next.js 14 (App Router)](https://nextjs.org/) + [React Three Fiber (R3F)](https://r3f.docs.pmnd.rs/) + [Three.js](https://threejs.org/) + [Tailwind CSS](https://tailwindcss.com/)
*   **Backend Server:** [NestJS (Node.js framework)](https://nestjs.com/) + [Passport JWT Auth](https://passportjs.org/)
*   **Database layer ORM:** [Prisma](https://www.prisma.io/) + MySQL provider mapping (Visual assets only; inventory and categories managed via OSPOS API)

---

## 💻 Local Quickstart

### Prerequisites
*   Node.js (>= 20.0.0)
*   npm (>= 10.0.0)
*   Running MySQL Server

### 1. Installation
Install monorepo package dependencies:
```bash
npm install
```

### 2. Configure Environment Secrets
Create a `.env` file at the root matching the configurations outlined in `.env.example`:
```bash
cp .env.example .env
```

### 3. Database Migration & Seeding
Generate Prisma Client, migrate tables, and pre-populate mock showroom catalog items:
```bash
cd backend
npm run prisma:migrate
npx prisma db seed
```

### 4. Local Development Launch
Start frontend (Port 3000) and backend (Port 4000) concurrently:
```bash
npm run dev
```

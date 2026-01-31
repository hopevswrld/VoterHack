# Neighborly Diagnostics - SF Turnout

Real-time Bayesian voter turnout calibration system for San Francisco. Crowdsourced perceptions meet statistical inference for civic transparency.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your Supabase credentials

# Start development server
npm run dev
```

Visit `http://localhost:5173`

## Overview

This application enables San Francisco residents to share their perceptions of voter turnout in their neighborhoods. The system aggregates these "signals" using Bayesian statistics to calibrate turnout estimates in real-time across all 510 precincts.

### Key Features

- **Real-time Map** - Interactive map showing turnout intensity by precinct
- **Signal Submission** - Anonymous polling form for turnout perceptions  
- **Live Updates** - WebSocket-based real-time data synchronization
- **Shareable Links** - Generate and share poll links for specific precincts
- **Privacy-Preserving** - k-anonymity (n≥5) ensures individual responses cannot be identified

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  React 19 + TypeScript + Tailwind CSS v4 + Vite             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Landing Page │  │  Dashboard   │  │  Share Poll  │       │
│  │              │  │              │  │              │       │
│  │ - Hero       │  │ - Map View   │  │ - Link Gen   │       │
│  │ - Features   │  │ - Signal Log │  │ - QR Code    │       │
│  │ - CTA        │  │ - Poll Form  │  │ - Share      │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              TurnoutMap (Leaflet + GeoJSON)          │   │
│  │  - 510 SF precincts                                  │   │
│  │  - Cyan intensity = turnout level                    │   │
│  │  - Signal pulse animations on new data               │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
├────────────────────────────┼────────────────────────────────┤
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              useRealtime Hook                         │   │
│  │  - Supabase Realtime subscription                    │   │
│  │  - Fallback polling (2s interval)                    │   │
│  │  - Posterior state management                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend                               │
│                    Supabase (PostgreSQL)                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Tables:                                                     │
│  ┌────────────────────┐  ┌────────────────────┐             │
│  │ poll_responses     │  │ posterior_estimates│             │
│  │                    │  │                    │             │
│  │ - geo_id           │  │ - geo_id           │             │
│  │ - turnout_expect   │  │ - mu_prior         │             │
│  │ - neighbor_engage  │  │ - mu_post          │             │
│  │ - created_at       │  │ - divergence_z     │             │
│  └────────────────────┘  │ - is_visible       │             │
│                          │ - n_responses      │             │
│                          └────────────────────┘             │
│                                                              │
│  Realtime: postgres_changes on posterior_estimates          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
sf-turnout/
├── public/
│   └── sf_precincts.geojson   # SF precinct boundaries + metadata
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx       # Main dashboard with map + panels
│   │   ├── LandingPage.tsx     # Marketing landing page
│   │   ├── TurnoutMap.tsx      # Leaflet map with GeoJSON overlay
│   │   ├── PollForm.tsx        # Signal submission form
│   │   ├── SignalLog.tsx       # Real-time signal feed
│   │   ├── SharePoll.tsx       # Link sharing interface
│   │   └── SystemStatus.tsx    # Top status bar
│   ├── hooks/
│   │   └── useRealtime.ts      # Supabase realtime subscription
│   ├── lib/
│   │   └── supabase.ts         # Supabase client + types
│   ├── App.tsx                 # Router configuration
│   ├── main.tsx                # Entry point
│   └── index.css               # Global styles + Tailwind
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | LandingPage | Marketing landing page |
| `/dashboard` | Dashboard | Main app with map view |
| `/dashboard/share` | Dashboard (share view) | Generate shareable poll links |
| `/poll/:geoId` | Dashboard (poll view) | Direct link to poll for specific precinct |

## Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Tech Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS v4 (via @tailwindcss/vite)
- **Routing**: React Router DOM v7
- **Maps**: Leaflet + react-leaflet
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Icons**: Lucide React

## Development

```bash
# Development server with HMR
npm run dev

# Type checking
npm run lint

# Production build
npm run build

# Preview production build
npm run preview
```

## License

MIT

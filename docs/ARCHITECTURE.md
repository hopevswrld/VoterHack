# Architecture Documentation

## System Overview

Neighborly Diagnostics is a civic technology application that enables real-time, crowdsourced voter turnout estimation using Bayesian statistics. The system collects anonymous "signals" (perceptions) from San Francisco residents about voter turnout in their neighborhoods and uses these to calibrate turnout estimates.

## Core Concepts

### Signals
A **signal** is a user-submitted perception about voter turnout. Each signal contains:
- `turnout_expectation`: "higher" | "same" | "lower" (compared to past elections)
- `neighbor_engagement`: "more" | "same" | "less" (how engaged neighbors seem)
- `geo_id`: The precinct identifier

### Posterior Estimates
The backend calculates **posterior estimates** using Bayesian inference:
- `mu_prior`: Historical turnout rate (from 2022/2024 elections)
- `mu_post`: Calibrated estimate after incorporating signals
- `divergence_z`: Z-score measuring deviation from baseline
- `is_visible`: Whether enough signals exist (k-anonymity threshold of n≥5)
- `n_responses`: Number of signals received

### k-Anonymity
To protect privacy, precinct data only becomes visible when at least 5 responses are received. This prevents individual identification through small sample sizes.

## Frontend Architecture

### Component Hierarchy

```
App
├── LandingPage
│   ├── Navigation (mobile responsive)
│   ├── Hero Section
│   │   ├── Status Badge
│   │   ├── Headline
│   │   ├── Email Signup Form
│   │   └── App Preview
│   ├── Features Section
│   ├── How it Works Section
│   ├── CTA Section
│   └── Footer
│
└── Dashboard
    ├── SystemStatus (top bar)
    │   ├── Live Indicator
    │   ├── Signal Count
    │   ├── Reporting Stats
    │   └── Home Link
    │
    ├── TurnoutMap (left panel)
    │   ├── Leaflet MapContainer
    │   ├── CartoDB Dark Tile Layer
    │   ├── GeoJSON Precinct Layer
    │   └── Legend Overlay
    │
    └── Right Panel (tabs)
        ├── Map View
        │   ├── SignalLog
        │   └── PollForm
        │
        └── Share View
            └── SharePoll
```

### State Management

State is managed using React hooks at the Dashboard level:

```typescript
// Dashboard.tsx
const [view, setView] = useState<'map' | 'share' | 'poll'>('map');
const [selected, setSelected] = useState<string | null>(null);
const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
const [signals, setSignals] = useState<SignalEntry[]>([]);
const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());

// From useRealtime hook
const { posteriors, connected, refresh } = useRealtime();
```

### Real-time Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   User submits  │────▶│  Supabase DB     │────▶│ Backend updates │
│   poll signal   │     │  poll_responses  │     │ posterior_est   │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌─────────────────────────────────┘
                        │
                        ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   UI updates    │◀────│  useRealtime     │◀────│ Supabase        │
│   - Map colors  │     │  hook receives   │     │ Realtime        │
│   - Pulse anim  │     │  postgres_changes│     │ subscription    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Map Visualization

The `TurnoutMap` component uses Leaflet with react-leaflet bindings:

**Color Scale (Cyan Intensity)**
```typescript
// Turnout normalized to 0-1 based on typical SF range (25-80%)
const normalized = Math.max(0, Math.min(1, (turnout - 0.25) / 0.55));

// Color mapping
if (normalized >= 0.85) return '#00E5FF';  // Very high - bright cyan
if (normalized >= 0.7)  return '#22D3EE';  // High
if (normalized >= 0.55) return '#06B6D4';  // Medium-high
if (normalized >= 0.4)  return '#0891B2';  // Medium
if (normalized >= 0.25) return '#0E7490';  // Medium-low
if (normalized >= 0.1)  return '#155E75';  // Low
return '#164E63';                           // Very low
```

**Signal Animation**
When new data arrives:
1. Precinct flashes bright cyan (#00FFFF)
2. CSS animation `precinct-signal-pulse` triggers
3. Border pulses with glow effect
4. Color smoothly transitions to new intensity

## Backend Architecture (Supabase)

### Database Schema

```sql
-- Poll responses table
CREATE TABLE poll_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_id TEXT NOT NULL,
  turnout_expectation TEXT CHECK (turnout_expectation IN ('higher', 'same', 'lower')),
  neighbor_engagement TEXT CHECK (neighbor_engagement IN ('more', 'same', 'less')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posterior estimates (computed/materialized)
CREATE TABLE posterior_estimates (
  geo_id TEXT PRIMARY KEY,
  mu_prior NUMERIC,           -- Historical turnout rate
  mu_post NUMERIC,            -- Bayesian posterior estimate
  divergence_z NUMERIC,       -- Z-score deviation from prior
  is_visible BOOLEAN,         -- Has n >= 5 responses
  n_responses INTEGER         -- Signal count
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE posterior_estimates;
```

### Bayesian Update Logic

The backend (not shown in frontend code) performs:

```
posterior = weighted_average(prior, signal_mean, weights)

where:
  - prior = historical turnout (mu_prior)
  - signal_mean = average of encoded signal values
  - weights based on n_responses (more signals = more weight on signal_mean)

divergence_z = (mu_post - mu_prior) / std_deviation
is_visible = n_responses >= 5
```

## Styling System

### Tailwind CSS v4

The project uses Tailwind CSS v4 via the `@tailwindcss/vite` plugin. Configuration is handled automatically without separate config files.

### Color Palette

```css
/* Background hierarchy */
#0A0D10  /* Deepest - map background */
#0B0F14  /* Deep - page backgrounds */
#0E1116  /* Surface - panels */
#12161C  /* Elevated - cards, headers */

/* Slate scale for UI elements */
slate-700/60  /* Borders */
slate-800     /* Button backgrounds */
slate-400     /* Secondary text */
slate-500     /* Tertiary text */

/* Accent - Cyan */
#00FFFF       /* Bright - signals, highlights */
#22D3EE       /* Primary - buttons, active states */
#06B6D4       /* Medium - hover states */
cyan-500/20   /* Subtle - backgrounds */
```

### Animation Classes

```css
/* Signal pulse for map precincts */
.precinct-signal-pulse {
  animation: precinct-signal-pulse 1.5s ease-out forwards;
}

/* Live indicator pulse */
.animate-pulse-ring {
  animation: pulse-ring 2s ease-out infinite;
}
```

## GeoJSON Data

The `sf_precincts.geojson` file contains:

```typescript
interface PrecinctProperties {
  geo_id: string;        // e.g., "PCT_0001"
  precinct: string;      // e.g., "0001"
  neighborhood: string;  // e.g., "Mission"
  district: string;      // e.g., "D9"
  mu_prior: number;      // Historical turnout (0-1)
  turnout_2024: number;  // 2024 turnout rate
  turnout_2022: number;  // 2022 turnout rate
}
```

## Performance Considerations

1. **GeoJSON Key Updates**: The map uses a `geoKey` state that increments on data changes to force GeoJSON re-render while maintaining layer references for animations.

2. **Memoization**: Components like `TurnoutMap`, `PollForm`, and `SharePoll` are wrapped with `memo()` to prevent unnecessary re-renders.

3. **Fallback Polling**: If WebSocket connection fails, the app falls back to 2-second polling intervals.

4. **Signal Log Limit**: Only the last 50 signals are kept in memory.

## Security

- Anonymous submissions (no user authentication required for polls)
- k-anonymity threshold prevents de-identification
- Row Level Security (RLS) should be configured in Supabase
- Environment variables for sensitive credentials

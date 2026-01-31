# Component Reference

## Page Components

### LandingPage
**Path**: `src/components/LandingPage.tsx`

Marketing landing page with responsive design.

**Sections**:
- Navigation (fixed, blurred background)
- Hero (headline, subtitle, email signup, app preview)
- Features (3-column grid)
- How it Works (3-step process)
- CTA (call to action)
- Footer

**State**:
```typescript
const [email, setEmail] = useState('');
const [submitted, setSubmitted] = useState(false);
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
```

---

### Dashboard
**Path**: `src/components/Dashboard.tsx`

Main application dashboard with map and right panel.

**Props**:
```typescript
interface DashboardProps {
  initialView?: 'map' | 'share' | 'poll';
}
```

**State**:
```typescript
const [view, setView] = useState<DashboardView>(initialView);
const [selected, setSelected] = useState<string | null>(null);
const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
const [signals, setSignals] = useState<SignalEntry[]>([]);
const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
```

**Layout**:
```
┌──────────────────────────────────────────────────────┐
│ SystemStatus                                          │
├────────────────────────────────┬─────────────────────┤
│                                │ [Map] [Share]       │
│                                ├─────────────────────┤
│      TurnoutMap                │ SignalLog           │
│                                │                     │
│                                ├─────────────────────┤
│ [Legend]                       │ PollForm            │
└────────────────────────────────┴─────────────────────┘
```

---

## Map Components

### TurnoutMap
**Path**: `src/components/TurnoutMap.tsx`

Interactive Leaflet map with SF precinct overlays.

**Props**:
```typescript
interface TurnoutMapProps {
  posteriors: Map<string, PosteriorEstimate>;
  onSelect: (geoId: string) => void;
  selected: string | null;
  recentlyUpdated?: Set<string>;
}
```

**Features**:
- CartoDB Dark Matter base tiles
- GeoJSON precinct layer
- Cyan intensity based on turnout
- Hover tooltips with precinct details
- Click to select precinct
- Pulse animation on data updates

**Color Functions**:
```typescript
getTurnoutColor(posterior, isRecentlyUpdated) // Returns hex color
getOpacity(posterior, isRecentlyUpdated)      // Returns 0-1
getGlowIntensity(posterior)                   // Returns 0-1
```

---

## Panel Components

### SignalLog
**Path**: `src/components/SignalLog.tsx`

Real-time feed of incoming signals.

**Props**:
```typescript
interface SignalLogProps {
  signals: SignalEntry[];
  onSelectGeo: (geoId: string) => void;
}
```

**SignalEntry Type**:
```typescript
interface SignalEntry {
  id: string;
  timestamp: Date;
  geoId: string;
  neighborhood: string;
  signalType: 'higher' | 'same' | 'lower';
  impact: 'small' | 'medium' | 'large';
  posteriorShift: number;
}
```

---

### PollForm
**Path**: `src/components/PollForm.tsx`

Signal submission form with two questions.

**Props**:
```typescript
interface PollFormProps {
  geoId: string | null;
  neighborhood: string | null;
  onSuccess: (geoId: string, turnout: TurnoutExpectation) => void;
}
```

**State**:
```typescript
const [turnout, setTurnout] = useState<TurnoutExpectation | null>(null);
const [engagement, setEngagement] = useState<EngagementLevel | null>(null);
const [submitting, setSubmitting] = useState(false);
const [submitted, setSubmitted] = useState(false);
```

**Questions**:
1. Expected turnout: Higher / Same / Lower
2. Neighbor engagement: More / Same / Less

---

### SharePoll
**Path**: `src/components/SharePoll.tsx`

Generate and share poll links.

**Props**:
```typescript
interface SharePollProps {
  geoId: string | null;
  neighborhood: string | null;
  onBack: () => void;
}
```

**Features**:
- General link (user selects precinct)
- Precinct-specific link (pre-selected)
- Copy to clipboard
- Share via Email
- Share via SMS
- QR code display

---

### SystemStatus
**Path**: `src/components/SystemStatus.tsx`

Top status bar with live metrics.

**Props**:
```typescript
interface SystemStatusProps {
  connected: boolean;
  signalsToday: number;
  precinctsReporting: number;
  totalPrecincts: number;
  highDivergenceZones: number;
}
```

**Displays**:
- Live connection indicator
- Signals received today
- Precincts reporting (with k-anonymity)
- Home navigation link

---

## Hooks

### useRealtime
**Path**: `src/hooks/useRealtime.ts`

Supabase real-time subscription for posterior updates.

**Returns**:
```typescript
{
  posteriors: Map<string, PosteriorEstimate>;
  connected: boolean;
  refresh: () => Promise<void>;
}
```

**Behavior**:
1. Initial fetch of all posteriors
2. Subscribe to `postgres_changes` on `posterior_estimates`
3. Update Map on each change event
4. Fallback to 2s polling if not connected

---

## Types

### PosteriorEstimate
```typescript
interface PosteriorEstimate {
  geo_id: string;
  mu_prior: number | null;
  mu_post: number | null;
  divergence_z: number | null;
  is_visible: boolean;
  n_responses: number;
}
```

### TurnoutExpectation
```typescript
type TurnoutExpectation = 'higher' | 'same' | 'lower';
```

### EngagementLevel
```typescript
type EngagementLevel = 'more' | 'same' | 'less';
```

### PrecinctProperties (GeoJSON)
```typescript
interface PrecinctProperties {
  geo_id: string;
  precinct: string;
  neighborhood: string;
  district: string;
  mu_prior: number;
  turnout_2024: number;
  turnout_2022: number;
}
```

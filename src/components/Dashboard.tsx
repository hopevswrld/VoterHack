import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Radio, Copy, Check, ExternalLink, History, LogOut } from 'lucide-react';
import { useRealtime } from '../hooks/useRealtime';
import { useAuth } from '../hooks/useAuth';
import { supabase, type ElectionType, type NeighborTurnoutLevel, type TurnoutDirection } from '../lib/supabase';
import TurnoutMap from './TurnoutMap';
import SignalLog from './SignalLog';
import SystemStatus from './SystemStatus';
import PollCreationModal from './PollCreationModal';
import PollHistoryModal from './PollHistoryModal';
import type { SignalEntry } from './SignalLog';

// Neighborhood lookup for display
const neighborhoodLookup = new Map<string, string>();

interface ActivePoll {
  id: string;
  voterCount: number;
  createdAt: Date;
  responseCount: number;
}

// Helper to determine signal type from response
function getSignalType(neighborTurnout: NeighborTurnoutLevel, direction: TurnoutDirection): 'higher' | 'same' | 'lower' {
  const turnoutScore = {
    'almost_all': 2, 'most': 1, 'about_half': 0, 'probably_not': -1, 'definitely_not': -2
  }[neighborTurnout];
  const directionScore = {
    'much_higher': 2, 'little_higher': 1, 'about_same': 0, 'little_lower': -1, 'much_lower': -2
  }[direction];

  const combined = turnoutScore + directionScore * 0.5;
  if (combined > 0.5) return 'higher';
  if (combined < -0.5) return 'lower';
  return 'same';
}

export default function Dashboard() {
  const { geoId: urlGeoId } = useParams<{ geoId: string }>();
  const { user, signOut } = useAuth();
  const [electionType, setElectionType] = useState<ElectionType>('midterm_2026');
  const [selected, setSelected] = useState<string | null>(urlGeoId || null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const [signals, setSignals] = useState<SignalEntry[]>([]);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  const [showPollModal, setShowPollModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [activePoll, setActivePoll] = useState<ActivePoll | null>(null);
  const [copied, setCopied] = useState(false);
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { posteriors, connected, refresh } = useRealtime(electionType);

  const visibleCount = Array.from(posteriors.values()).filter((p) => p.is_visible).length;
  const highDivergenceZones = Array.from(posteriors.values()).filter(
    (p) => p.is_visible && Math.abs(p.divergence_z ?? 0) >= 1.5
  ).length;

  // Load GeoJSON once to populate neighborhood lookup
  useEffect(() => {
    fetch('/sf_precincts.geojson')
      .then((r) => r.json())
      .then((data) => {
        data.features.forEach((f: any) => {
          neighborhoodLookup.set(f.properties.geo_id, f.properties.neighborhood);
        });
        // If URL has geoId, set the neighborhood
        if (urlGeoId) {
          setSelectedNeighborhood(neighborhoodLookup.get(urlGeoId) || null);
        }
      });
  }, [urlGeoId]);

  // Load active poll and existing submissions on mount
  useEffect(() => {
    async function loadActivePoll() {
      // Find active poll for 2026 midterms
      const { data: poll } = await supabase
        .from('polls')
        .select('*')
        .eq('status', 'active')
        .eq('election_type', 'midterm_2026')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!poll) return;

      setActivePoll({
        id: poll.id,
        voterCount: poll.voter_count,
        createdAt: new Date(poll.created_at),
        responseCount: poll.response_count,
      });

      // Load existing submissions for this poll
      const { data: submissions } = await supabase
        .from('poll_submissions')
        .select('*')
        .eq('poll_id', poll.id)
        .order('created_at', { ascending: true });

      if (submissions && submissions.length > 0) {
        const loadedSignals: SignalEntry[] = submissions.map((sub: any) => {
          const geoId = sub.geo_id;
          const neighborhood = neighborhoodLookup.get(geoId) || 'Unknown';
          const signalType = getSignalType(sub.neighbor_turnout, sub.turnout_direction);

          const signalScore = {
            'almost_all': 0.15, 'most': 0.08, 'about_half': 0, 'probably_not': -0.08, 'definitely_not': -0.15
          }[sub.neighbor_turnout as NeighborTurnoutLevel] || 0;
          const directionScore = {
            'much_higher': 0.1, 'little_higher': 0.05, 'about_same': 0, 'little_lower': -0.05, 'much_lower': -0.1
          }[sub.turnout_direction as TurnoutDirection] || 0;
          const posteriorShift = (signalScore + directionScore * 0.5) * 0.1;

          return {
            id: sub.id,
            timestamp: new Date(sub.created_at),
            geoId,
            neighborhood,
            signalType,
            impact: 'medium' as const,
            posteriorShift,
          };
        });

        setSignals(loadedSignals.slice(-50));
      }
    }

    // Wait for neighborhood lookup to be populated
    const timer = setTimeout(loadActivePoll, 500);
    return () => clearTimeout(timer);
  }, []);

  // Subscribe to poll_submissions for live updates
  useEffect(() => {
    if (!activePoll) return;

    const channel = supabase
      .channel(`poll-submissions-${activePoll.id}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'poll_submissions',
          filter: `poll_id=eq.${activePoll.id}`,
        },
        (payload) => {
          const submission = payload.new as any;
          const geoId = submission.geo_id;
          const neighborhood = neighborhoodLookup.get(geoId) || 'Unknown';

          // Calculate signal type from responses
          const signalType = getSignalType(submission.neighbor_turnout, submission.turnout_direction);

          // Get current posterior for impact calculation
          const posterior = posteriors.get(geoId);
          const currentZ = Math.abs(posterior?.divergence_z ?? 0);
          const impact: 'small' | 'medium' | 'large' =
            currentZ >= 1.5 ? 'large' : currentZ >= 0.75 ? 'medium' : 'small';

          // Estimate shift based on signal strength
          const signalScore = {
            'almost_all': 0.15, 'most': 0.08, 'about_half': 0, 'probably_not': -0.08, 'definitely_not': -0.15
          }[submission.neighbor_turnout as NeighborTurnoutLevel];
          const directionScore = {
            'much_higher': 0.1, 'little_higher': 0.05, 'about_same': 0, 'little_lower': -0.05, 'much_lower': -0.1
          }[submission.turnout_direction as TurnoutDirection];
          const posteriorShift = (signalScore + directionScore * 0.5) * 0.1;

          const newSignal: SignalEntry = {
            id: submission.id,
            timestamp: new Date(submission.created_at),
            geoId,
            neighborhood,
            signalType,
            impact,
            posteriorShift,
          };

          setSignals((prev) => [...prev.slice(-49), newSignal]);

          // Mark precinct as recently updated for pulse animation
          setRecentlyUpdated((prev) => new Set(prev).add(geoId));
          setTimeout(() => {
            setRecentlyUpdated((prev) => {
              const next = new Set(prev);
              next.delete(geoId);
              return next;
            });
          }, 2000);

          // Update response count
          setActivePoll((prev) => prev ? { ...prev, responseCount: prev.responseCount + 1 } : null);

          // Refresh posteriors to get updated values
          refresh();
        })
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activePoll?.id, posteriors, refresh]);

  // Handle precinct selection
  const handleSelect = useCallback((geoId: string) => {
    setSelected(geoId);
    setSelectedNeighborhood(neighborhoodLookup.get(geoId) || null);
  }, []);

  // Handle poll creation
  const handlePollCreated = useCallback((pollId: string, voterCount: number) => {
    setActivePoll({
      id: pollId,
      voterCount,
      createdAt: new Date(),
      responseCount: 0,
    });
    setShowPollModal(false);
  }, []);

  // Copy poll URL to clipboard
  const handleCopyUrl = useCallback(() => {
    if (!activePoll) return;
    const url = `${window.location.origin}/poll/${activePoll.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [activePoll]);

  return (
    <div className="flex flex-col h-screen bg-[#0A0D10]">
      {/* Top: System Status Bar */}
      <SystemStatus
        connected={connected}
        signalsToday={signals.length}
        precinctsReporting={visibleCount}
        totalPrecincts={510}
        highDivergenceZones={highDivergenceZones}
      />

      {/* Election Type Toggle */}
      <div className="px-5 py-2 border-b border-slate-800 bg-[#0E1116] flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Active Election */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Active
            </span>
            <button
              onClick={() => setElectionType('midterm_2026')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                electionType === 'midterm_2026'
                  ? 'bg-cyan-500/20 text-cyan-400 shadow-sm border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white bg-slate-800/50'
              }`}
            >
              2026 Midterms
            </button>
          </div>

          <div className="w-px h-6 bg-slate-700" />

          {/* Baseline Comparisons */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Baselines
            </span>
            <div className="flex rounded-lg bg-slate-800/50 p-0.5">
              <button
                onClick={() => setElectionType('presidential')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  electionType === 'presidential'
                    ? 'bg-slate-700 text-slate-200 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Presidential 2024
              </button>
              <button
                onClick={() => setElectionType('midterm')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  electionType === 'midterm'
                    ? 'bg-slate-700 text-slate-200 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Midterm 2022
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-[10px] text-slate-500">
            {electionType === 'midterm_2026'
              ? 'Live tracking · Prior: ~62%'
              : electionType === 'presidential'
                ? 'Baseline · Avg: ~79%'
                : 'Baseline · Avg: ~62%'}
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{user.email}</span>
              <button
                onClick={signOut}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main content: 2-zone layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Map Canvas */}
        <div className="flex-1 relative">
          <TurnoutMap
            posteriors={posteriors}
            onSelect={handleSelect}
            selected={selected}
            recentlyUpdated={recentlyUpdated}
          />

          {/* Map legend overlay */}
          <div className="absolute bottom-5 left-5 p-4 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 shadow-2xl min-w-[180px]">
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-3 text-slate-400">
              Turnout Intensity
            </div>
            <div className="flex items-center gap-1 mb-2">
              <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-[#164E63] via-[#0891B2] to-[#00E5FF]" />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-medium mb-4">
              <span>Low</span>
              <span>High</span>
            </div>
            <div className="space-y-2 pt-3 border-t border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded bg-[#0891B2] opacity-55" />
                <span className="text-[10px] text-slate-500">Historical baseline</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded bg-cyan-400 animate-pulse" />
                <span className="text-[10px] text-slate-500">Live calibration</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-[340px] flex flex-col border-l border-slate-700/60 bg-[#12161C]">
          {/* Panel Header */}
          <div className="px-4 py-3 border-b border-slate-700/60">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Diagnostics Panel
            </h2>
          </div>

          {/* Poll Status / Create Poll Section */}
          <div className="p-4 border-b border-slate-700/60 space-y-3">
            {/* Active Poll Display */}
            {activePoll && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                  <div className="relative">
                    <Radio className="w-5 h-5 text-cyan-400" />
                    <div className="absolute inset-0 w-5 h-5 text-cyan-400 animate-ping opacity-30">
                      <Radio className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cyan-400">
                      Poll active
                    </p>
                    <p className="text-xs text-slate-400">
                      {activePoll.responseCount} / {activePoll.voterCount.toLocaleString()} responses
                    </p>
                  </div>
                </div>
                {/* Poll URL */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-slate-800/50 rounded-lg text-xs font-mono text-slate-400 truncate">
                    {window.location.origin}/poll/{activePoll.id.slice(0, 8)}...
                  </div>
                  <button
                    onClick={handleCopyUrl}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                    title="Copy poll URL"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                  <a
                    href={`/poll/${activePoll.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                    title="Open poll form"
                  >
                    <ExternalLink className="w-4 h-4 text-slate-400" />
                  </a>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowPollModal(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                  activePoll
                    ? 'text-slate-300 bg-slate-800 hover:bg-slate-700'
                    : 'text-black bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 hover:shadow-lg hover:shadow-cyan-500/20'
                }`}
              >
                <Plus className="w-4 h-4" />
                {activePoll ? 'New Poll' : 'Create Poll'}
              </button>
              <button
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                title="Poll History"
              >
                <History className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Signal Log (fills remaining space) */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <SignalLog signals={signals} onSelectGeo={handleSelect} />
          </div>

          {/* Selected precinct info */}
          {selected && (
            <div className="p-4 border-t border-slate-700/60 bg-slate-800/30">
              <div className="text-[10px] font-medium uppercase tracking-widest text-slate-500 mb-1">
                Selected Precinct
              </div>
              <p className="text-sm font-medium text-cyan-400">
                {selectedNeighborhood || selected.replace('PCT_', 'Precinct ')}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {selected}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Poll Creation Modal */}
      <PollCreationModal
        isOpen={showPollModal}
        onClose={() => setShowPollModal(false)}
        onPollCreated={handlePollCreated}
      />

      {/* Poll History Modal */}
      <PollHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />
    </div>
  );
}

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, fetchPosteriors } from '../lib/supabase';
import type { PosteriorEstimate, ElectionType } from '../lib/supabase';

export function useRealtime(electionType: ElectionType = 'presidential') {
  const [posteriors, setPosteriors] = useState<Map<string, PosteriorEstimate>>(new Map());
  const [connected, setConnected] = useState(false);
  const prevElectionType = useRef(electionType);

  const load = useCallback(async () => {
    const data = await fetchPosteriors(electionType);
    const map = new Map(data.map(r => [r.geo_id, r]));
    setPosteriors(map);
  }, [electionType]);

  // Clear data and reload when election type changes
  useEffect(() => {
    if (prevElectionType.current !== electionType) {
      // Clear old data immediately when switching
      setPosteriors(new Map());
      prevElectionType.current = electionType;
    }

    load();

    // Subscribe to changes for this election type only
    const channel = supabase
      .channel(`live-${electionType}`)
      .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'posterior_estimates',
            filter: `election_type=eq.${electionType}`
          },
          (payload) => {
            const row = payload.new as PosteriorEstimate;
            if (row.election_type === electionType) {
              setPosteriors(prev => new Map(prev).set(row.geo_id, row));
            }
          })
      .subscribe(status => setConnected(status === 'SUBSCRIBED'));

    return () => { supabase.removeChannel(channel); };
  }, [load, electionType]);

  // Fallback polling
  useEffect(() => {
    if (connected) return;
    const i = setInterval(load, 2000);
    return () => clearInterval(i);
  }, [connected, load]);

  return { posteriors, connected, refresh: load };
}

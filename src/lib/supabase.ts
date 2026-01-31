import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Types
export type ElectionType = 'midterm_2026' | 'presidential' | 'midterm';

// New 5-level response types
export type NeighborTurnoutLevel = 'almost_all' | 'most' | 'about_half' | 'probably_not' | 'definitely_not';
export type TurnoutDirection = 'much_higher' | 'little_higher' | 'about_same' | 'little_lower' | 'much_lower';
export type VoteIntent = 'definitely_yes' | 'probably_yes' | 'not_sure' | 'probably_not' | 'definitely_not';

export interface PosteriorEstimate {
  geo_id: string;
  election_type: ElectionType;
  mu_prior: number | null;
  mu_post: number | null;
  sigma_prior: number | null;
  sigma_post: number | null;
  divergence_z: number | null;
  delta_mean: number | null;
  n_eff: number | null;
  is_visible: boolean;
  updated_at: string;
}

export interface Poll {
  id: string;
  created_at: string;
  updated_at: string;
  name: string | null;
  election_type: ElectionType;
  status: 'draft' | 'active' | 'closed';
  voter_count: number;
  response_count: number;
  precinct_count: number;
}

export interface PollVoter {
  id: string;
  poll_id: string;
  phone_number: string;
  precinct: string;
  voter_name: string | null;
  responded: boolean;
}

export interface PollSubmission {
  id: string;
  created_at: string;
  poll_id: string;
  voter_id: string | null;
  geo_id: string;
  neighbor_turnout: NeighborTurnoutLevel;
  turnout_direction: TurnoutDirection;
  vote_intent: VoteIntent;
  election_type: ElectionType;
}

// Fetch posteriors filtered by election type
export async function fetchPosteriors(electionType: ElectionType): Promise<PosteriorEstimate[]> {
  const { data } = await supabase
    .from('posterior_estimates')
    .select('*')
    .eq('election_type', electionType);
  return data || [];
}

// Fetch active poll
export async function fetchActivePoll(): Promise<Poll | null> {
  const { data } = await supabase
    .from('polls')
    .select('*')
    .eq('status', 'active')
    .eq('election_type', 'midterm_2026')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data;
}

// Submit poll response and trigger Bayesian update
export async function submitPollResponse(data: {
  poll_id: string;
  geo_id: string;
  neighbor_turnout: NeighborTurnoutLevel;
  turnout_direction: TurnoutDirection;
  vote_intent: VoteIntent;
}): Promise<{ success: boolean; result?: any; error?: string }> {
  // Insert submission
  const { data: submission, error: insertError } = await supabase
    .from('poll_submissions')
    .insert({
      poll_id: data.poll_id,
      geo_id: data.geo_id,
      neighbor_turnout: data.neighbor_turnout,
      turnout_direction: data.turnout_direction,
      vote_intent: data.vote_intent,
      election_type: 'midterm_2026',
    })
    .select()
    .single();

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  // Call the Bayesian update function
  const { data: result, error: updateError } = await supabase
    .rpc('process_poll_submission', {
      p_geo_id: data.geo_id,
      p_neighbor_turnout: data.neighbor_turnout,
      p_turnout_direction: data.turnout_direction,
      p_vote_intent: data.vote_intent,
      p_election_type: 'midterm_2026',
    });

  if (updateError) {
    console.error('Bayesian update failed:', updateError);
    // Still return success since submission was recorded
    return { success: true, result: submission };
  }

  return { success: true, result };
}

// Get voter by phone for poll
export async function getVoterByPhone(pollId: string, phone: string): Promise<PollVoter | null> {
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  const { data } = await supabase
    .from('poll_voters')
    .select('*')
    .eq('poll_id', pollId)
    .or(`phone_number.eq.${cleanPhone},phone_number.ilike.%${cleanPhone.slice(-10)}`)
    .limit(1)
    .single();
  return data;
}

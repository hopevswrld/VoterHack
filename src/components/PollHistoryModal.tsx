import { useState, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, ChevronLeft, Copy, Check, Users, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Poll {
  id: string;
  created_at: string;
  name: string | null;
  status: string;
  voter_count: number;
  response_count: number;
  precinct_count: number;
}

interface PollVoter {
  id: string;
  phone_number: string;
  precinct: string;
  voter_name: string | null;
  responded: boolean;
  responded_at: string | null;
}

interface PollHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function PollHistoryModal({ isOpen, onClose }: PollHistoryModalProps) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [voters, setVoters] = useState<PollVoter[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load all polls
  useEffect(() => {
    if (!isOpen) return;

    async function loadPolls() {
      setLoading(true);
      const { data } = await supabase
        .from('polls')
        .select('*')
        .eq('election_type', 'midterm_2026')
        .order('created_at', { ascending: false });

      setPolls(data || []);
      setLoading(false);
    }

    loadPolls();
  }, [isOpen]);

  // Load voters when poll is selected
  useEffect(() => {
    if (!selectedPoll) {
      setVoters([]);
      return;
    }

    const pollId = selectedPoll.id;

    async function loadVoters() {
      const { data } = await supabase
        .from('poll_voters')
        .select('*')
        .eq('poll_id', pollId)
        .order('voter_name', { ascending: true });

      setVoters(data || []);
    }

    loadVoters();
  }, [selectedPoll?.id]);

  const handleCopyLink = useCallback((voterId: string, pollId: string) => {
    const url = `${window.location.origin}/poll/${pollId}?v=${voterId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(voterId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleCopyAllLinks = useCallback(() => {
    if (!selectedPoll) return;

    const links = voters
      .filter(v => !v.responded)
      .map(v => {
        const name = v.voter_name || v.phone_number;
        const url = `${window.location.origin}/poll/${selectedPoll.id}?v=${v.id}`;
        return `${name}: ${url}`;
      })
      .join('\n');

    navigator.clipboard.writeText(links);
    setCopiedId('all');
    setTimeout(() => setCopiedId(null), 2000);
  }, [selectedPoll, voters]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[80vh] mx-4 bg-[#12161C] rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden animate-fade-in-scale flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3">
            {selectedPoll && (
              <button
                onClick={() => setSelectedPoll(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-white">
                {selectedPoll ? (selectedPoll.name || 'Poll Details') : 'Poll History'}
              </h2>
              {selectedPoll && (
                <p className="text-xs text-slate-500">
                  Created {formatDate(selectedPoll.created_at)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-slate-700 border-t-cyan-400 rounded-full animate-spin" />
            </div>
          ) : !selectedPoll ? (
            /* Poll List */
            <div className="space-y-3">
              {polls.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-sm text-slate-400">No polls created yet</p>
                </div>
              ) : (
                polls.map((poll) => {
                  const completionRate = poll.voter_count > 0
                    ? Math.round((poll.response_count / poll.voter_count) * 100)
                    : 0;
                  const isComplete = poll.response_count >= poll.voter_count;

                  return (
                    <button
                      key={poll.id}
                      onClick={() => setSelectedPoll(poll)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600 transition-all text-left"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        isComplete ? 'bg-cyan-500/20' : 'bg-slate-700/50'
                      }`}>
                        {isComplete ? (
                          <CheckCircle className="w-5 h-5 text-cyan-400" />
                        ) : (
                          <Clock className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {poll.name || `Poll ${poll.id.slice(0, 8)}`}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(poll.created_at)} · {poll.precinct_count} precincts
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-mono text-cyan-400">
                          {poll.response_count}/{poll.voter_count}
                        </p>
                        <p className="text-xs text-slate-500">{completionRate}%</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            /* Voter List for Selected Poll */
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                  <p className="text-2xl font-mono font-semibold text-cyan-400">
                    {selectedPoll.voter_count}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Total Voters</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                  <p className="text-2xl font-mono font-semibold text-cyan-400">
                    {selectedPoll.response_count}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Responses</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                  <p className="text-2xl font-mono font-semibold text-slate-300">
                    {selectedPoll.voter_count - selectedPoll.response_count}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Pending</p>
                </div>
              </div>

              {/* Copy All Button */}
              {voters.filter(v => !v.responded).length > 0 && (
                <button
                  onClick={handleCopyAllLinks}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  {copiedId === 'all' ? (
                    <>
                      <Check className="w-4 h-4 text-cyan-400" />
                      Copied all pending links!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy all pending links
                    </>
                  )}
                </button>
              )}

              {/* Voter List */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Voters ({voters.length})
                </p>
                {voters.map((voter) => (
                  <div
                    key={voter.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      voter.responded
                        ? 'bg-cyan-500/5 border-cyan-500/20'
                        : 'bg-slate-800/30 border-slate-700/50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      voter.responded ? 'bg-cyan-500/20' : 'bg-slate-700/50'
                    }`}>
                      {voter.responded ? (
                        <CheckCircle className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {voter.voter_name || 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatPhone(voter.phone_number)} · {voter.precinct}
                      </p>
                    </div>
                    {voter.responded ? (
                      <span className="text-xs text-cyan-400 shrink-0">
                        Submitted
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCopyLink(voter.id, selectedPoll.id)}
                          className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
                          title="Copy link"
                        >
                          {copiedId === voter.id ? (
                            <Check className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <Copy className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        <a
                          href={`/poll/${selectedPoll.id}?v=${voter.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
                          title="Open form"
                        >
                          <ExternalLink className="w-4 h-4 text-slate-400" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default memo(PollHistoryModal);

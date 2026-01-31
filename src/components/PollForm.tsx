import { useState, useEffect, useCallback, memo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import {
  supabase,
  submitPollResponse,
  type Poll,
  type PollVoter,
  type NeighborTurnoutLevel,
  type TurnoutDirection,
  type VoteIntent,
} from '../lib/supabase';

type FormStep = 'loading' | 'verify' | 'questions' | 'submitting' | 'success' | 'error' | 'closed' | 'already_submitted';

interface FormAnswers {
  neighbor_turnout: NeighborTurnoutLevel | null;
  turnout_direction: TurnoutDirection | null;
  vote_intent: VoteIntent | null;
}

const QUESTIONS = [
  {
    id: 'neighbor_turnout' as const,
    question: 'Do you believe most of your neighbors are going to vote in the 2026 midterm election?',
    options: [
      { value: 'almost_all' as const, label: 'Almost all' },
      { value: 'most' as const, label: 'Most' },
      { value: 'about_half' as const, label: 'About half' },
      { value: 'probably_not' as const, label: 'Probably not' },
      { value: 'definitely_not' as const, label: 'Definitely not' },
    ],
  },
  {
    id: 'turnout_direction' as const,
    question: 'Compared to the last midterm election, do you think turnout in your area will be higher or lower?',
    options: [
      { value: 'much_higher' as const, label: 'Much higher' },
      { value: 'little_higher' as const, label: 'A little higher' },
      { value: 'about_same' as const, label: 'About the same' },
      { value: 'little_lower' as const, label: 'A little lower' },
      { value: 'much_lower' as const, label: 'Much lower' },
    ],
  },
  {
    id: 'vote_intent' as const,
    question: 'Are you personally likely to vote in this midterm election?',
    options: [
      { value: 'definitely_yes' as const, label: 'Definitely yes' },
      { value: 'probably_yes' as const, label: 'Probably yes' },
      { value: 'not_sure' as const, label: 'Not sure' },
      { value: 'probably_not' as const, label: 'Probably not' },
      { value: 'definitely_not' as const, label: 'Definitely not' },
    ],
  },
];

function PollForm() {
  const { pollId } = useParams<{ pollId: string }>();
  const [searchParams] = useSearchParams();
  const voterId = searchParams.get('v');
  const navigate = useNavigate();

  const [step, setStep] = useState<FormStep>('loading');
  const [poll, setPoll] = useState<Poll | null>(null);
  const [voter, setVoter] = useState<PollVoter | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [answers, setAnswers] = useState<FormAnswers>({
    neighbor_turnout: null,
    turnout_direction: null,
    vote_intent: null,
  });
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // Load poll on mount
  useEffect(() => {
    if (!pollId) {
      setStep('error');
      setErrorMessage('Invalid poll link');
      return;
    }

    async function loadPoll() {
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .eq('id', pollId)
        .single();

      if (error || !data) {
        setStep('error');
        setErrorMessage('Poll not found');
        return;
      }

      if (data.status !== 'active') {
        setStep('closed');
        return;
      }

      setPoll(data);

      // If voter ID is in URL, load voter directly and skip verification
      if (voterId) {
        const { data: voterData } = await supabase
          .from('poll_voters')
          .select('*')
          .eq('id', voterId)
          .eq('poll_id', pollId)
          .single();

        if (voterData) {
          if (voterData.responded) {
            setStep('already_submitted');
            return;
          }
          setVoter(voterData);
          setStep('questions');
          return;
        }
      }

      setStep('verify');
    }

    loadPoll();
  }, [pollId, voterId]);

  const handlePhoneSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poll) return;

    setPhoneError('');

    // Clean phone number
    const cleanPhone = phoneInput.replace(/[^\d]/g, '');
    if (cleanPhone.length < 10) {
      setPhoneError('Please enter a valid phone number');
      return;
    }

    // Look up voter
    const { data: voterData } = await supabase
      .from('poll_voters')
      .select('*')
      .eq('poll_id', poll.id)
      .or(`phone_number.eq.${cleanPhone},phone_number.ilike.%${cleanPhone.slice(-10)}`)
      .limit(1)
      .single();

    if (!voterData) {
      setPhoneError('Phone number not found in voter list');
      return;
    }

    if (voterData.responded) {
      setPhoneError('You have already submitted a response');
      return;
    }

    setVoter(voterData);
    setStep('questions');
  }, [poll, phoneInput]);

  const handleAnswer = useCallback((questionId: keyof FormAnswers, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));

    // Auto-advance to next question
    if (currentQuestion < QUESTIONS.length - 1) {
      setTimeout(() => setCurrentQuestion(prev => prev + 1), 300);
    }
  }, [currentQuestion]);

  const handleSubmit = useCallback(async () => {
    if (!poll || !voter) return;
    if (!answers.neighbor_turnout || !answers.turnout_direction || !answers.vote_intent) return;

    setStep('submitting');

    // Normalize precinct to geo_id format (PCT_XXXX)
    let geoId = voter.precinct.trim();
    if (!geoId.startsWith('PCT_')) {
      geoId = `PCT_${geoId}`;
    }

    const result = await submitPollResponse({
      poll_id: poll.id,
      geo_id: geoId,
      neighbor_turnout: answers.neighbor_turnout,
      turnout_direction: answers.turnout_direction,
      vote_intent: answers.vote_intent,
    });

    if (result.success) {
      setStep('success');
    } else {
      setErrorMessage(result.error || 'Failed to submit response');
      setStep('error');
    }
  }, [poll, voter, answers]);

  const isComplete = answers.neighbor_turnout && answers.turnout_direction && answers.vote_intent;

  return (
    <div className="min-h-screen bg-[#0A0D10] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-white mb-1">
            SF Voter Turnout Survey
          </h1>
          <p className="text-sm text-slate-500">2026 Midterm Election</p>
        </div>

        {/* Loading */}
        {step === 'loading' && (
          <div className="bg-[#12161C] rounded-2xl border border-slate-700/60 p-8 text-center">
            <Loader2 className="w-10 h-10 text-cyan-400 mx-auto mb-4 animate-spin" />
            <p className="text-sm text-slate-400">Loading poll...</p>
          </div>
        )}

        {/* Verify Phone */}
        {step === 'verify' && (
          <div className="bg-[#12161C] rounded-2xl border border-slate-700/60 p-6">
            <p className="text-sm text-slate-300 mb-6">
              Enter your phone number to verify you're on the voter list.
            </p>

            <form onSubmit={handlePhoneSubmit}>
              <div className="mb-4">
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
                />
                {phoneError && (
                  <p className="text-sm text-orange-400 mt-2">{phoneError}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-lg text-sm font-semibold text-black bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 transition-all"
              >
                Continue
              </button>
            </form>
          </div>
        )}

        {/* Questions */}
        {step === 'questions' && (
          <div className="bg-[#12161C] rounded-2xl border border-slate-700/60 p-6">
            {/* Progress */}
            <div className="flex items-center gap-2 mb-6">
              {QUESTIONS.map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1 rounded-full transition-colors ${
                    i <= currentQuestion ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>

            {/* Current question */}
            <div className="space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                {QUESTIONS[currentQuestion].question}
              </p>

              <div className="space-y-2">
                {QUESTIONS[currentQuestion].options.map((opt) => {
                  const questionId = QUESTIONS[currentQuestion].id;
                  const isSelected = answers[questionId] === opt.value;

                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleAnswer(questionId, opt.value)}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 border'
                          : 'bg-slate-800/50 border-slate-700 text-slate-300 border hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-3 mt-6">
              {currentQuestion > 0 && (
                <button
                  onClick={() => setCurrentQuestion(prev => prev - 1)}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Back
                </button>
              )}

              {currentQuestion < QUESTIONS.length - 1 ? (
                <button
                  onClick={() => setCurrentQuestion(prev => prev + 1)}
                  disabled={!answers[QUESTIONS[currentQuestion].id]}
                  className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!isComplete}
                  className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold text-black bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Submit Response
                </button>
              )}
            </div>
          </div>
        )}

        {/* Submitting */}
        {step === 'submitting' && (
          <div className="bg-[#12161C] rounded-2xl border border-slate-700/60 p-8 text-center">
            <Loader2 className="w-10 h-10 text-cyan-400 mx-auto mb-4 animate-spin" />
            <p className="text-sm text-slate-400">Submitting your response...</p>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div className="bg-[#12161C] rounded-2xl border border-slate-700/60 p-8 text-center">
            <CheckCircle className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">
              Thank you!
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Your response has been recorded and will help calibrate our turnout model.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              View Dashboard
            </button>
          </div>
        )}

        {/* Closed */}
        {step === 'closed' && (
          <div className="bg-[#12161C] rounded-2xl border border-slate-700/60 p-8 text-center">
            <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">
              Poll Closed
            </h2>
            <p className="text-sm text-slate-400">
              This poll is no longer accepting responses.
            </p>
          </div>
        )}

        {/* Already Submitted */}
        {step === 'already_submitted' && (
          <div className="bg-[#12161C] rounded-2xl border border-slate-700/60 p-8 text-center">
            <CheckCircle className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">
              Already Submitted
            </h2>
            <p className="text-sm text-slate-400">
              You have already submitted a response to this poll. Thank you for participating!
            </p>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="bg-[#12161C] rounded-2xl border border-slate-700/60 p-8 text-center">
            <AlertCircle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-slate-400">
              {errorMessage}
            </p>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-6">
          SF Voter Turnout Diagnostics
        </p>
      </div>
    </div>
  );
}

export default memo(PollForm);

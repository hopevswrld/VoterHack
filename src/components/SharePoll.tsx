import { useState, memo } from 'react';
import { Link2, Copy, Check, MapPin, QrCode, Mail, MessageSquare, ArrowLeft } from 'lucide-react';

interface SharePollProps {
  geoId: string | null;
  neighborhood: string | null;
  onBack: () => void;
}

function SharePoll({ geoId, neighborhood, onBack }: SharePollProps) {
  const [copied, setCopied] = useState(false);
  const [linkType, setLinkType] = useState<'precinct' | 'general'>('general');
  
  const baseUrl = window.location.origin;
  const pollLink = linkType === 'precinct' && geoId 
    ? `${baseUrl}/poll/${geoId}`
    : `${baseUrl}/dashboard`;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(pollLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent('Share your voter turnout perception');
    const body = encodeURIComponent(
      `Help calibrate our understanding of voter turnout in San Francisco!\n\n` +
      `Share your perception: ${pollLink}\n\n` +
      `Your response is anonymous and helps create real-time civic transparency.`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const shareViaSMS = () => {
    const body = encodeURIComponent(
      `Share your voter turnout perception for SF: ${pollLink}`
    );
    window.open(`sms:?body=${body}`);
  };

  return (
    <div className="flex flex-col h-full bg-[#0E1116]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700/60 bg-[#12161C]">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-slate-800/60 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Share Poll Link
            </h2>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          Create a shareable link to collect turnout perceptions from your community.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* Link Type Selection */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest mb-3 text-slate-500">
            Link Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setLinkType('general')}
              className={`
                p-4 rounded-xl border text-left transition-all duration-200
                ${linkType === 'general'
                  ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-400'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:border-slate-600'
                }
              `}
            >
              <MapPin className="w-5 h-5 mb-2" />
              <div className="text-sm font-medium">General</div>
              <div className="text-xs mt-1 opacity-70">User selects precinct</div>
            </button>
            <button
              onClick={() => setLinkType('precinct')}
              disabled={!geoId}
              className={`
                p-4 rounded-xl border text-left transition-all duration-200
                ${linkType === 'precinct'
                  ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-400'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:border-slate-600'
                }
                ${!geoId ? 'opacity-40 cursor-not-allowed' : ''}
              `}
            >
              <Link2 className="w-5 h-5 mb-2" />
              <div className="text-sm font-medium">Precinct-specific</div>
              <div className="text-xs mt-1 opacity-70">
                {geoId ? neighborhood || geoId : 'Select precinct first'}
              </div>
            </button>
          </div>
        </div>

        {/* Generated Link */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest mb-3 text-slate-500">
            Your Link
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-11 px-4 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center">
              <span className="text-sm text-slate-300 truncate font-mono">
                {pollLink}
              </span>
            </div>
            <button
              onClick={copyToClipboard}
              className={`
                h-11 w-11 rounded-xl flex items-center justify-center transition-all duration-200
                ${copied
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/60'
                  : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:text-white hover:bg-slate-800'
                }
              `}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          {copied && (
            <p className="text-xs text-cyan-400 mt-2">Link copied to clipboard!</p>
          )}
        </div>

        {/* Quick Share Options */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest mb-3 text-slate-500">
            Quick Share
          </label>
          <div className="space-y-2">
            <button
              onClick={shareViaEmail}
              className="w-full h-11 px-4 rounded-xl bg-slate-800/40 border border-slate-700/50 text-slate-300 hover:bg-slate-800/60 hover:border-slate-600 transition-all duration-200 flex items-center gap-3"
            >
              <Mail className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium">Share via Email</span>
            </button>
            <button
              onClick={shareViaSMS}
              className="w-full h-11 px-4 rounded-xl bg-slate-800/40 border border-slate-700/50 text-slate-300 hover:bg-slate-800/60 hover:border-slate-600 transition-all duration-200 flex items-center gap-3"
            >
              <MessageSquare className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium">Share via SMS</span>
            </button>
          </div>
        </div>

        {/* QR Code Placeholder */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest mb-3 text-slate-500">
            QR Code
          </label>
          <div className="aspect-square max-w-[200px] mx-auto rounded-xl bg-white p-4 flex items-center justify-center">
            <div className="text-center">
              <QrCode className="w-16 h-16 text-slate-800 mx-auto mb-2" />
              <p className="text-xs text-slate-500">QR Code</p>
            </div>
          </div>
          <p className="text-xs text-center mt-3 text-slate-500">
            Scan to open poll on mobile
          </p>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="px-5 py-4 border-t border-slate-700/60 bg-[#12161C]">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-white">—</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Link opens</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-cyan-400">—</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Responses</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(SharePoll);

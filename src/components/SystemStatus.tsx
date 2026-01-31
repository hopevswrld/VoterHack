import { memo } from 'react';
import { BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAnimatedNumber } from '../hooks/useAnimations';

interface SystemStatusProps {
  connected: boolean;
  signalsToday: number;
  precinctsReporting: number;
  totalPrecincts: number;
  highDivergenceZones: number;
}

function AnimatedNumber({ value }: { value: number }) {
  const displayValue = useAnimatedNumber(value, 300);
  return <span>{displayValue}</span>;
}

function SystemStatus({
  connected,
  signalsToday,
  precinctsReporting,
  totalPrecincts,
  highDivergenceZones,
}: SystemStatusProps) {
  return (
    <header className="h-14 px-5 flex items-center justify-between border-b border-slate-700/60 bg-[#12161C] select-none">
      {/* Left: Logo + Home link + Live status */}
      <div className="flex items-center gap-5">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-slate-400 hover:text-white transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-white">Neighborly</span>
        </Link>

        <div className="w-px h-5 bg-slate-700/60" />

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-cyan-400' : 'bg-slate-600'
              }`}
            />
            {connected && (
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-cyan-400 animate-pulse-ring" />
            )}
          </div>
          <span
            className={`text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${
              connected ? 'text-cyan-400' : 'text-slate-500'
            }`}
          >
            {connected ? 'Live' : 'Reconnecting…'}
          </span>
        </div>
      </div>

      {/* Right: System metrics */}
      <div className="flex items-center gap-6">
        {/* Signals today */}
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
            Signals
          </span>
          <span
            className={`text-sm font-semibold font-mono transition-colors duration-300 ${
              signalsToday > 0 ? 'text-cyan-400' : 'text-slate-400'
            }`}
          >
            <AnimatedNumber value={signalsToday} />
          </span>
        </div>

        <div className="w-px h-4 bg-slate-700/60" />

        {/* High divergence zones */}
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
            High divergence
          </span>
          <span
            className={`text-sm font-semibold font-mono transition-colors duration-300 ${
              highDivergenceZones > 0 ? 'text-orange-400' : 'text-slate-400'
            }`}
          >
            <AnimatedNumber value={highDivergenceZones} />
          </span>
        </div>

        <div className="w-px h-4 bg-slate-700/60" />

        {/* Reporting window */}
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
            Reporting
          </span>
          <span className="text-sm font-semibold font-mono text-slate-200">
            <AnimatedNumber value={precinctsReporting} />
            <span className="text-slate-500 font-normal"> / {totalPrecincts}</span>
          </span>
        </div>
      </div>
    </header>
  );
}

export default memo(SystemStatus);

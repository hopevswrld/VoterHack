import { useEffect, useRef, memo, useState } from 'react';

export interface SignalEntry {
  id: string;
  timestamp: Date;
  geoId: string;
  neighborhood: string;
  signalType: 'higher' | 'same' | 'lower';
  impact: 'small' | 'medium' | 'large';
  posteriorShift: number;
}

interface SignalLogProps {
  signals: SignalEntry[];
  onSelectGeo: (geoId: string) => void;
}

function getSignalLabel(type: 'higher' | 'same' | 'lower'): string {
  switch (type) {
    case 'higher':
      return 'Above baseline';
    case 'lower':
      return 'Below baseline';
    default:
      return 'At baseline';
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatShift(shift: number): string {
  const sign = shift >= 0 ? '+' : '';
  return `${sign}${(shift * 100).toFixed(1)}pp`;
}

function SignalItem({
  signal,
  index,
  total,
  onSelect,
}: {
  signal: SignalEntry;
  index: number;
  total: number;
  onSelect: () => void;
}) {
  const [isNew, setIsNew] = useState(true);
  const isRecent = index >= total - 3;
  const isLatest = index === total - 1;

  useEffect(() => {
    // Remove "new" animation class after animation completes
    const timer = setTimeout(() => setIsNew(false), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      onClick={onSelect}
      className={`
        relative px-5 py-3.5 border-b border-slate-700/50 cursor-pointer
        transition-all duration-300 hover:bg-slate-800/40
        ${isNew ? 'animate-fade-in-up' : ''}
        ${isRecent ? 'opacity-100' : 'opacity-60'}
        ${isLatest ? 'bg-cyan-500/10' : ''}
      `}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Left accent bar for impact */}
      <div
        className={`
          absolute left-0 w-[3px] rounded-r bg-gradient-to-b from-cyan-400 to-cyan-500
          transition-opacity duration-300
          ${isRecent ? 'opacity-100' : 'opacity-30'}
          ${signal.impact === 'large' ? 'top-0 bottom-0' : ''}
          ${signal.impact === 'medium' ? 'top-[20%] bottom-[20%]' : ''}
          ${signal.impact === 'small' ? 'top-[35%] bottom-[35%]' : ''}
        `}
      />

      {/* Timestamp and neighborhood */}
      <div className="flex items-center justify-between mb-2 pl-2">
        <span className="text-[11px] font-mono text-slate-500">
          {formatTime(signal.timestamp)}
        </span>
        <span className="text-xs font-medium text-slate-300 truncate max-w-[140px]">
          {signal.neighborhood}
        </span>
      </div>

      {/* Signal type and posterior shift */}
      <div className="flex items-center justify-between pl-2">
        <span
          className={`text-sm font-medium transition-colors ${
            signal.signalType === 'higher'
              ? 'text-cyan-400'
              : signal.signalType === 'lower'
              ? 'text-orange-400'
              : 'text-slate-400'
          }`}
        >
          {getSignalLabel(signal.signalType)}
        </span>
        <span
          className={`text-xs font-mono font-medium ${
            signal.posteriorShift >= 0 ? 'text-cyan-300' : 'text-orange-300'
          }`}
        >
          {formatShift(signal.posteriorShift)}
        </span>
      </div>
    </div>
  );
}

function SignalLog({ signals, onSelectGeo }: SignalLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new signals
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [signals.length]);

  return (
    <div className="flex flex-col h-full bg-[#0E1116]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700/60 bg-[#12161C] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-2 h-2 rounded-full transition-colors duration-300 ${
              signals.length > 0 ? 'bg-cyan-400' : 'bg-slate-600'
            }`}
          />
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Signal Feed
          </h2>
        </div>
        <span
          className={`text-sm font-mono font-semibold transition-colors duration-300 ${
            signals.length > 0 ? 'text-cyan-400' : 'text-slate-600'
          }`}
        >
          {signals.length}
        </span>
      </div>

      {/* Signal list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
      >
        {signals.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center px-6">
            <div>
              <div className="w-10 h-10 rounded-full bg-slate-800/60 flex items-center justify-center mx-auto mb-4">
                <div className="w-2 h-2 rounded-full bg-slate-600" />
              </div>
              <p className="text-sm text-slate-500 font-medium">Awaiting signals…</p>
              <p className="text-xs mt-1.5 text-slate-600">
                Submit perceptions to see live updates
              </p>
            </div>
          </div>
        ) : (
          signals.map((signal, index) => (
            <SignalItem
              key={signal.id}
              signal={signal}
              index={index}
              total={signals.length}
              onSelect={() => onSelectGeo(signal.geoId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default memo(SignalLog);

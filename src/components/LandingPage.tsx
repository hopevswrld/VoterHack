import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ArrowRight, Shield, Zap, Globe, Check, Menu, X } from 'lucide-react';

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-950" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-cyan-500/10 blur-3xl rounded-full" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-black" />
              </div>
              <span className="font-semibold text-white">Neighborly</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-slate-400 hover:text-white">Features</a>
              <a href="#how-it-works" className="text-sm text-slate-400 hover:text-white">How it works</a>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <Link to="/dashboard" className="text-sm text-slate-400 hover:text-white">Dashboard</Link>
              <Link to="/dashboard" className="h-9 px-4 text-sm font-medium rounded-md bg-cyan-500 text-black hover:bg-cyan-400 flex items-center gap-1.5">
                Launch app
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-slate-400">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-950 px-6 py-4 space-y-3">
            <a href="#features" className="block py-2 text-slate-400">Features</a>
            <a href="#how-it-works" className="block py-2 text-slate-400">How it works</a>
            <Link to="/dashboard" className="block w-full h-10 mt-4 text-sm font-medium rounded-md bg-cyan-500 text-black text-center leading-10">
              Launch app
            </Link>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="relative z-10">
        {/* Hero Section */}
        <section className="pt-32 pb-20">
          <div className="max-w-3xl mx-auto px-6 text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 text-sm text-slate-300 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>Live for San Francisco</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              See democracy
              <br />
              <span className="text-cyan-400">as it happens.</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg text-slate-400 max-w-lg mx-auto mb-10">
              Real-time voter turnout calibration for San Francisco. Crowdsourced perceptions meet Bayesian statistics.
            </p>

            {/* CTA */}
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-16">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 h-11 px-4 rounded-md bg-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
              <button
                type="submit"
                disabled={submitted}
                className="h-11 px-5 text-sm font-medium rounded-md bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-60 flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {submitted ? (
                  <>
                    <Check className="w-4 h-4" />
                    Subscribed
                  </>
                ) : (
                  <>
                    Get updates
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Preview */}
          <div className="max-w-4xl mx-auto px-6">
            <div className="relative">
              <div className="absolute -inset-4 bg-cyan-500/20 blur-3xl rounded-3xl" />
              <div className="relative rounded-xl bg-slate-900 overflow-hidden shadow-2xl">
                {/* Browser Chrome */}
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/50">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                  </div>
                  <div className="flex-1 text-center text-xs text-slate-500">neighborly.sf.gov/dashboard</div>
                  <div className="w-11" />
                </div>

                {/* Dashboard */}
                <div className="aspect-video bg-slate-950">
                  <div className="h-8 bg-slate-800/30 flex items-center justify-between px-4 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <span className="text-cyan-400 uppercase tracking-wider text-xs">Live</span>
                    </div>
                    <div className="flex gap-6 text-slate-500">
                      <span>Signals <span className="text-slate-300">247</span></span>
                      <span>Reporting <span className="text-slate-300">127/510</span></span>
                    </div>
                  </div>
                  <div className="flex h-[calc(100%-32px)]">
                    <div className="flex-1 bg-slate-950 flex items-center justify-center">
                      <svg className="w-full h-full max-w-md" viewBox="0 0 400 250">
                        <polygon points="50,30 100,15 150,30 140,75 60,65" fill="#1e293b" />
                        <polygon points="150,30 200,20 220,55 180,90 140,75" fill="#334155" />
                        <polygon points="220,55 280,40 300,75 260,110 180,90" fill="#06b6d4" />
                        <polygon points="60,65 140,75 120,130 40,110" fill="#1e293b" />
                        <polygon points="140,75 180,90 160,145 120,130" fill="#f59e0b" />
                        <polygon points="180,90 260,110 240,165 160,145" fill="#22d3ee" />
                        <polygon points="260,110 320,90 340,145 280,180 240,165" fill="#0891b2" />
                        <polygon points="40,110 120,130 100,185 20,165" fill="#1e293b" />
                        <polygon points="120,130 160,145 140,200 100,185" fill="#ea580c" />
                        <polygon points="160,145 240,165 220,220 140,200" fill="#334155" />
                        <polygon points="280,180 360,160 380,220 300,250 260,235" fill="#0e7490" />
                      </svg>
                    </div>
                    <div className="w-36 bg-slate-800/20 hidden sm:block">
                      <div className="px-3 py-2 text-xs text-slate-500 uppercase">Signals</div>
                      {['Mission', 'Noe Valley', 'SOMA'].map((area, i) => (
                        <div key={area} className={`px-3 py-2 ${i === 0 ? 'bg-cyan-500/10' : ''}`}>
                          <div className="text-xs text-slate-400">{area}</div>
                          <div className={`text-xs ${i === 1 ? 'text-amber-400' : 'text-cyan-400'}`}>
                            {i === 1 ? 'Below' : 'Above'} baseline
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Civic sensing, <span className="text-cyan-400">reimagined</span>
              </h2>
              <p className="text-lg text-slate-400 max-w-xl mx-auto">
                Combining crowd wisdom with Bayesian statistics for real-time democratic transparency.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-10">
              {[
                { icon: Shield, title: 'Privacy-preserving', desc: 'k-anonymity ensures no individual response can be identified.' },
                { icon: Zap, title: 'Real-time updates', desc: 'Bayesian posteriors update in milliseconds as signals arrive.' },
                { icon: Globe, title: 'Non-partisan', desc: 'No red vs blue. Just turnout divergence from baselines.' },
              ].map((f, i) => (
                <div key={i} className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <f.icon className="w-6 h-6 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-slate-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section id="how-it-works" className="py-24 bg-slate-900/30">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">How it works</h2>
              <p className="text-lg text-slate-400">Three simple steps to contribute to civic transparency.</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-12">
              {[
                { step: '01', title: 'Select precinct', desc: 'Click your neighborhood on the map.' },
                { step: '02', title: 'Share perception', desc: 'Answer two quick questions.' },
                { step: '03', title: 'Watch calibration', desc: 'See real-time Bayesian updates.' },
              ].map((s) => (
                <div key={s.step} className="text-center">
                  <div className="text-5xl font-bold text-slate-800 mb-4">{s.step}</div>
                  <h3 className="text-lg font-semibold text-white mb-2">{s.title}</h3>
                  <p className="text-slate-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to see your neighborhood?</h2>
            <p className="text-lg text-slate-400 mb-8 max-w-md mx-auto">
              Join the civic sensing network. Submit your perception, see real-time calibration.
            </p>
            <Link
              to="/dashboard"
              className="h-11 px-6 text-sm font-medium rounded-md bg-cyan-500 text-black hover:bg-cyan-400 inline-flex items-center gap-2"
            >
              Launch dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 border-t border-slate-800">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div>© 2026 Neighborly Diagnostics · San Francisco</div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-300">Privacy</a>
            <a href="#" className="hover:text-slate-300">Terms</a>
            <a href="https://github.com" className="hover:text-slate-300">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

import React from 'react';

const NAV_ITEMS = [
  { hash: '#/', icon: '🏠', label: 'Home' },
  { hash: '#/voice-chat', icon: '🎙️', label: 'Voice Chat' },
  { hash: '#/babyagi', icon: '👶', label: 'BabyAGI' },
  { hash: '#/multi-agent', icon: '🤖', label: 'Multi-Agent' },
  { hash: '#/persona-agent', icon: '⭐', label: 'Persona' },
  { hash: '#/complex-agent', icon: '🧩', label: 'Complex' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const currentHash = typeof window !== 'undefined' ? window.location.hash || '#/' : '#/';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4 overflow-x-auto custom-scrollbar-x">
          <a href="#/" className="flex items-center gap-2 text-lg font-bold text-white flex-shrink-0">
            <span className="text-2xl">🧠</span>
            <span className="hidden sm:inline bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">Alborihi AI</span>
          </a>
          <div className="flex items-center gap-1 ml-4">
            {NAV_ITEMS.map(item => (
              <a
                key={item.hash}
                href={item.hash}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${
                  currentHash === item.hash
                    ? 'bg-violet-600/30 text-violet-300 border border-violet-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span>{item.icon}</span>
                <span className="hidden md:inline">{item.label}</span>
              </a>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-600">
        Alborihi AI Tools — Free & Open — Powered by open proxy providers
      </footer>
    </div>
  );
}

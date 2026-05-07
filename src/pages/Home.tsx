import React from 'react';

const TOOLS = [
  { hash: '#/voice-chat', icon: '🎙️', title: 'Voice Chat', desc: 'Speak to AI and hear it respond. Real-time voice conversation with multiple TTS voices and AI personas.', color: 'from-violet-500 to-purple-600' },
  { hash: '#/babyagi', icon: '👶', title: 'BabyAGI Loop', desc: 'Autonomous task loop: execute → create tasks → reprioritize → repeat. Watch AI plan and work independently.', color: 'from-emerald-500 to-teal-600' },
  { hash: '#/multi-agent', icon: '🤖', title: 'Multi-Agent', desc: 'Coordinator decomposes your goal into sub-agents that work in parallel, then synthesizes the results.', color: 'from-amber-500 to-orange-600' },
  { hash: '#/persona-agent', icon: '⭐', title: 'Persona Agent', desc: '3-stage pipeline with different AI models: Planner → Executor → Reviewer. Each with its own persona.', color: 'from-pink-500 to-rose-600' },
  { hash: '#/complex-agent', icon: '🧩', title: 'Complex Agent', desc: 'Plan → Execute pipeline with approval gates. Destructive steps require explicit user confirmation.', color: 'from-cyan-500 to-blue-600' },
  { hash: '#/camel-dialogue', icon: '🐪', title: 'CAMEL Dialogue', desc: 'Two AI agents role-play and collaborate to solve your task. Watch them negotiate and build together.', color: 'from-lime-500 to-green-600' },
];

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-violet-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
          Alborihi AI Tools
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          6 powerful AI tools — voice chat, autonomous agents, multi-agent orchestration, and more.
          All free. No API keys needed. Powered by open proxy providers.
        </p>
      </div>

      {/* Tool Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map(tool => (
          <a
            key={tool.hash}
            href={tool.hash}
            className="group relative bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 hover:border-slate-500 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-500/5"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
              {tool.icon}
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{tool.title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{tool.desc}</p>
          </a>
        ))}
      </div>

      {/* Info */}
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4 text-center">
          <div className="text-2xl mb-2">🔓</div>
          <div className="font-semibold text-white text-sm">No API Keys</div>
          <div className="text-xs text-slate-500">Free proxy providers</div>
        </div>
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4 text-center">
          <div className="text-2xl mb-2">⚡</div>
          <div className="font-semibold text-white text-sm">30+ Models</div>
          <div className="text-xs text-slate-500">Claude, GPT, Gemini & more</div>
        </div>
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4 text-center">
          <div className="text-2xl mb-2">🌐</div>
          <div className="font-semibold text-white text-sm">Client-Side</div>
          <div className="text-xs text-slate-500">No backend required</div>
        </div>
      </div>
    </div>
  );
}

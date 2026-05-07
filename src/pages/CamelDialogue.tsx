import React, { useState, useRef, useCallback, useEffect } from 'react'
import ModelSelector from '../components/ModelSelector'
import { MODEL_MAP, callAI, ModelEntry } from '../lib/models'
import { SimpleMarkdown } from '../lib/markdown'

function instructorPrompt(role: string, otherRole: string, task: string, persona?: string) {
  const pfx = persona ? `${persona} ` : ''
  return `${pfx}Never forget you are a ${role} and I am a ${otherRole}. Never flip roles!\nWe share a common interest in collaborating to successfully complete a task.\n\nYou must help me to complete the task: ${task}\n\nHere are rules you MUST follow:\n1. I will give you instructions, and your task is to give me a SPECIFIC, ACTIONABLE response that helps me complete the task.\n2. Always issue ONE clear instruction at a time. Do not give a list of instructions.\n3. Each instruction must be either a question that gathers info needed to proceed, OR a concrete next step for me to perform.\n4. When the task is COMPLETE, reply with ONLY the literal text "<TASK_DONE>" and a brief 1-line summary.\n5. Be concise. Maximum 3 sentences per turn (excluding the final summary).\n6. Never apologize. Never explain. Just instruct.`
}

function executorPrompt(role: string, otherRole: string, task: string, persona?: string) {
  const pfx = persona ? `${persona} ` : ''
  return `${pfx}Never forget you are a ${role} and I am a ${otherRole}. Never flip roles!\nYou will give me instructions to complete the task: ${task}\n\nHere are rules you MUST follow:\n1. For each instruction I give, do your best to perform it concretely. If you produce a deliverable (text, code, plan), include it in full.\n2. After performing the instruction, write "Next request:" and propose what you think should come next, OR write "Awaiting your instruction." if you are blocked.\n3. Be concrete and specific. Show your work.\n4. If you believe the task is complete, write the final deliverable, then on a new line write "<TASK_DONE>".\n5. Be concise. No filler. No apologies.`
}

interface Turn { speaker: 'instructor' | 'executor'; role: string; content: string; modelLabel?: string; provider?: string }

const EXAMPLES = [
  { task: 'Design a REST API for a todo application with user authentication', instructor: 'Product Manager', executor: 'Senior Backend Engineer' },
  { task: 'Create a marketing strategy for launching an AI-powered code review tool', instructor: 'Marketing Director', executor: 'Growth Hacker' },
  { task: 'Build a real-time chat application with WebSocket support', instructor: 'Tech Lead', executor: 'Full-Stack Developer' },
  { task: 'Plan the architecture for a microservices e-commerce platform', instructor: 'Solutions Architect', executor: 'DevOps Engineer' },
]

async function runDialogue(params: {
  task: string; instructorRole: string; executorRole: string; maxTurns: number
  iModel: ModelEntry | null; eModel: ModelEntry | null
  signal?: AbortSignal; onTurn: (t: Turn) => void
}) {
  const { task, instructorRole, executorRole, maxTurns, iModel, eModel, signal, onTurn } = params
  const iMsgs: { role: string; content: string }[] = [
    { role: 'system', content: instructorPrompt(instructorRole, executorRole, task, iModel?.persona) },
    { role: 'user', content: 'Now start to give me instructions one by one. Only reply with one Instruction at a time.' },
  ]
  const eMsgs: { role: string; content: string }[] = [
    { role: 'system', content: executorPrompt(executorRole, instructorRole, task, eModel?.persona) },
  ]

  let iRes = await callAI(iMsgs, signal, iModel)
  iMsgs.push({ role: 'assistant', content: iRes.content })
  onTurn({ speaker: 'instructor', role: instructorRole, content: iRes.content, modelLabel: iRes.modelLabel, provider: iRes.provider })

  for (let i = 0; i < maxTurns && !(signal?.aborted || iRes.content.includes('<TASK_DONE>')); i++) {
    eMsgs.push({ role: 'user', content: iRes.content })
    const eRes = await callAI(eMsgs, signal, eModel)
    eMsgs.push({ role: 'assistant', content: eRes.content })
    onTurn({ speaker: 'executor', role: executorRole, content: eRes.content, modelLabel: eRes.modelLabel, provider: eRes.provider })
    if (eRes.content.includes('<TASK_DONE>')) break

    iMsgs.push({ role: 'user', content: eRes.content })
    iRes = await callAI(iMsgs, signal, iModel)
    iMsgs.push({ role: 'assistant', content: iRes.content })
    onTurn({ speaker: 'instructor', role: instructorRole, content: iRes.content, modelLabel: iRes.modelLabel, provider: iRes.provider })
  }
}

export default function CamelDialogue() {
  const [task, setTask] = useState('')
  const [iRole, setIRole] = useState('Product Manager')
  const [eRole, setERole] = useState('Senior Software Engineer')
  const [maxTurns, setMaxTurns] = useState(8)
  const [iModelId, setIModelId] = useState('')
  const [eModelId, setEModelId] = useState('')
  const [useDifferentModels, setUseDifferentModels] = useState(false)
  const [msgs, setMsgs] = useState<Turn[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<'chat' | 'split'>('chat')
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const start = useCallback(async () => {
    if (!task.trim()) return
    setError(''); setMsgs([]); setRunning(true)
    abortRef.current = new AbortController()
    const iModel = iModelId ? MODEL_MAP[iModelId] ?? null : null
    const eModel = useDifferentModels ? (eModelId ? MODEL_MAP[eModelId] ?? null : null) : iModel
    try {
      await runDialogue({ task: task.trim(), instructorRole: iRole, executorRole: eRole, maxTurns, iModel, eModel, signal: abortRef.current.signal, onTurn: (t) => setMsgs(p => [...p, t]) })
    } catch (e: unknown) { const m = e instanceof Error ? e.message : String(e); if (m !== 'Aborted') setError(m) }
    finally { setRunning(false) }
  }, [task, iRole, eRole, maxTurns, iModelId, eModelId, useDifferentModels])

  const stop = useCallback(() => { abortRef.current?.abort(); setRunning(false) }, [])
  const reset = useCallback(() => { setMsgs([]); setError(''); setTask('') }, [])
  const copyAll = useCallback(() => {
    navigator.clipboard.writeText(msgs.map((t, i) => `## ${t.role} (${t.speaker}) - Turn ${i + 1}\n\n${t.content}`).join('\n\n---\n\n'))
  }, [msgs])
  const exportMD = useCallback(() => {
    const blob = new Blob([msgs.map((t, i) => `## ${t.role} (${t.speaker}) - Turn ${i + 1}\n\n${t.content}`).join('\n\n---\n\n')], { type: 'text/markdown' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'camel-dialogue.md'; a.click()
  }, [msgs])

  const done = msgs.some(m => m.content.includes('<TASK_DONE>'))

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-1">🐪 CAMEL Dialogue</h1>
      <p className="text-sm text-slate-400 mb-6">Two AI agents collaborate — Instructor + Executor</p>

      {/* Config */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 mb-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 mb-1 block">🧠 Instructor Role</label>
            <input value={iRole} onChange={e => setIRole(e.target.value)} className="w-full bg-slate-900/80 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-400 mb-1 block">⚡ Executor Role</label>
            <input value={eRole} onChange={e => setERole(e.target.value)} className="w-full bg-slate-900/80 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-400 mb-1 block">✨ Mission / Task</label>
          <textarea value={task} onChange={e => setTask(e.target.value)} rows={2} className="w-full bg-slate-900/80 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 resize-none focus:outline-none focus:border-amber-500" />
        </div>

        <div className="space-y-2">
          <ModelSelector value={iModelId} onChange={id => { setIModelId(id); if (!useDifferentModels) setEModelId(id) }} label="🤖 AI Model (both agents)" />
          <div className="flex items-center gap-2">
            <button onClick={() => setUseDifferentModels(!useDifferentModels)} className={`relative w-9 h-5 rounded-full transition-colors ${useDifferentModels ? 'bg-amber-400' : 'bg-slate-600'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${useDifferentModels ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-[11px] text-slate-400">Different models per agent</span>
          </div>
          {useDifferentModels && (
            <div className="grid grid-cols-2 gap-3">
              <ModelSelector value={iModelId} onChange={setIModelId} label="🧠 Instructor" />
              <ModelSelector value={eModelId} onChange={setEModelId} label="⚡ Executor" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 mb-1 block">Max Turns</label>
            <input type="number" min={2} max={30} value={maxTurns} onChange={e => setMaxTurns(+e.target.value)} className="w-20 bg-slate-900/80 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 text-center focus:outline-none focus:border-amber-500" />
          </div>
          <div className="flex-1" />
          {running ? (
            <button onClick={stop} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors">⏹ Stop</button>
          ) : (
            <button onClick={start} disabled={!task.trim()} className="px-5 py-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-all">▶ Start Dialogue</button>
          )}
          {msgs.length > 0 && (
            <>
              <button onClick={reset} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">↺</button>
              <button onClick={copyAll} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">📋</button>
              <button onClick={exportMD} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">⬇</button>
              <button onClick={() => setView(view === 'chat' ? 'split' : 'chat')} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">{view === 'chat' ? '↔ Split' : '💬 Chat'}</button>
            </>
          )}
        </div>

        {msgs.length === 0 && !running && (
          <div>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Quick Start</p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex, i) => (
                <button key={i} onClick={() => { setTask(ex.task); setIRole(ex.instructor); setERole(ex.executor) }} className="px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] text-slate-400 hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-300 transition-colors">{ex.instructor} + {ex.executor}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <div className="p-3 rounded-xl bg-red-900/20 border border-red-800/30 text-red-400 text-sm mb-3">❌ {error}</div>}

      {/* Status */}
      {msgs.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-400 px-1 mb-3 flex-wrap">
          <span className="px-2 py-0.5 rounded-full border border-slate-700 text-[10px]">{msgs.length} turns</span>
          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px]">🧠 {msgs.filter(m => m.speaker === 'instructor').length}</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px]">⚡ {msgs.filter(m => m.speaker === 'executor').length}</span>
          {msgs[0]?.modelLabel && <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px]">🤖 {msgs[0].modelLabel}</span>}
          {msgs[0]?.provider && <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-[10px]">📡 {msgs[0].provider}</span>}
          {done && <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-[10px] font-medium">✅ Task Complete</span>}
        </div>
      )}

      {/* Chat View */}
      {msgs.length > 0 && view === 'chat' && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4">
          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.speaker === 'instructor' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.speaker === 'instructor' ? 'bg-blue-500/10 border border-blue-500/20 rounded-bl-md' : 'bg-emerald-500/10 border border-emerald-500/20 rounded-br-md'}`}>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-base">{m.speaker === 'instructor' ? '🧠' : '⚡'}</span>
                    <span className={`text-xs font-bold ${m.speaker === 'instructor' ? 'text-blue-400' : 'text-emerald-400'}`}>{m.role}</span>
                    <span className="px-1.5 py-0 rounded-full border border-slate-700 text-[9px] text-slate-400">Turn {i + 1}</span>
                    {m.modelLabel && <span className="px-1.5 py-0 rounded-full bg-purple-500/10 text-purple-400 text-[9px]">🤖 {m.modelLabel}</span>}
                    <button onClick={() => navigator.clipboard.writeText(m.content)} className="ml-auto text-slate-500 hover:text-slate-300 text-[10px]">📋</button>
                  </div>
                  <div className="text-sm text-slate-200"><SimpleMarkdown content={m.content.replace(/<TASK_DONE>/g, '**✅ TASK DONE**')} /></div>
                </div>
              </div>
            ))}
            {running && (
              <div className="flex items-center gap-2 text-sm text-slate-500 animate-pulse px-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span>Agents are talking...</span>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>
      )}

      {/* Split View */}
      {msgs.length > 0 && view === 'split' && (
        <div className="grid grid-cols-2 gap-3">
          {(['instructor', 'executor'] as const).map(speaker => {
            const filtered = msgs.filter(m => m.speaker === speaker)
            const isI = speaker === 'instructor'
            return (
              <div key={speaker} className={`bg-slate-800/40 border ${isI ? 'border-blue-500/20' : 'border-emerald-500/20'} rounded-2xl`}>
                <div className={`px-4 py-3 border-b ${isI ? 'border-blue-500/20' : 'border-emerald-500/20'}`}>
                  <span className="text-sm font-bold text-white">{isI ? '🧠' : '⚡'} {isI ? iRole : eRole}</span>
                </div>
                <div className="p-3 space-y-2 max-h-[45vh] overflow-y-auto">
                  {filtered.map((m, idx) => (
                    <div key={idx} className={`p-3 rounded-xl border ${isI ? 'bg-blue-500/5 border-blue-500/10' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
                      <div className="text-xs text-slate-400 mb-1">Turn {msgs.indexOf(m) + 1}</div>
                      <div className="text-xs text-slate-300"><SimpleMarkdown content={m.content.replace(/<TASK_DONE>/g, '**✅ TASK DONE**')} /></div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {msgs.length === 0 && !running && (
        <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5 text-center text-slate-400">
          <div className="text-3xl mb-2">🐪</div>
          <p className="text-sm">Set roles, pick a model, describe a mission — two AI agents will collaborate to solve it.</p>
        </div>
      )}
    </div>
  )
}

import React, { useState, useRef, useCallback, useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════
// Lightweight Markdown Renderer
// ═══════════════════════════════════════════════════════════════

function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let inCodeBlock = false
  let codeBlockContent: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(<pre key={`c-${i}`} className="my-2 p-3 rounded-lg bg-zinc-100 overflow-x-auto text-xs font-mono whitespace-pre"><code>{codeBlockContent.join('\n')}</code></pre>)
        codeBlockContent = []; inCodeBlock = false
      } else { inCodeBlock = true }
      continue
    }
    if (inCodeBlock) { codeBlockContent.push(line); continue }
    if (line.startsWith('### ')) elements.push(<h4 key={i} className="font-bold text-sm mt-3 mb-1">{fmt(line.slice(4))}</h4>)
    else if (line.startsWith('## ')) elements.push(<h3 key={i} className="font-bold text-base mt-3 mb-1">{fmt(line.slice(3))}</h3>)
    else if (line.startsWith('# ')) elements.push(<h2 key={i} className="font-bold text-lg mt-3 mb-1">{fmt(line.slice(2))}</h2>)
    else if (line.match(/^[-*]\s/)) elements.push(<li key={i} className="ml-4 list-disc text-sm">{fmt(line.replace(/^[-*]\s/, ''))}</li>)
    else if (line.match(/^\d+\.\s/)) elements.push(<li key={i} className="ml-4 list-decimal text-sm">{fmt(line.replace(/^\d+\.\s/, ''))}</li>)
    else if (line.match(/^---+$/)) elements.push(<hr key={i} className="my-2 border-gray-300" />)
    else if (line.trim() === '') elements.push(<div key={i} className="h-2" />)
    else elements.push(<p key={i} className="text-sm leading-relaxed">{fmt(line)}</p>)
  }
  return <div>{elements}</div>
}

function fmt(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let rem = text; let k = 0
  while (rem.length > 0) {
    const bm = rem.match(/\*\*(.+?)\*\*/); const cm = rem.match(/`([^`]+)`/)
    let first: { i: number; l: number; n: React.ReactNode } | null = null
    if (bm && bm.index !== undefined) { const c = { i: bm.index, l: bm[0].length, n: <strong key={`b${k++}`}>{bm[1]}</strong> }; if (!first || c.i < first.i) first = c }
    if (cm && cm.index !== undefined) { const c = { i: cm.index, l: cm[0].length, n: <code key={`c${k++}`} className="px-1 py-0.5 rounded bg-zinc-100 text-xs font-mono">{cm[1]}</code> }; if (!first || c.i < first.i) first = c }
    if (first) { if (first.i > 0) parts.push(rem.slice(0, first.i)); parts.push(first.n); rem = rem.slice(first.i + first.l) }
    else { parts.push(rem); break }
  }
  return parts.length === 1 ? parts[0] : <>{parts}</>
}

// ═══════════════════════════════════════════════════════════════
// System Prompts
// ═══════════════════════════════════════════════════════════════

function instructorPrompt(role: string, otherRole: string, task: string) {
  return `Never forget you are a ${role} and I am a ${otherRole}. Never flip roles!\nWe share a common interest in collaborating to successfully complete a task.\n\nYou must help me to complete the task: ${task}\n\nHere are rules you MUST follow:\n1. I will give you instructions, and your task is to give me a SPECIFIC, ACTIONABLE response that helps me complete the task.\n2. Always issue ONE clear instruction at a time. Do not give a list of instructions.\n3. Each instruction must be either a question that gathers info needed to proceed, OR a concrete next step for me to perform.\n4. When the task is COMPLETE, reply with ONLY the literal text "<TASK_DONE>" and a brief 1-line summary.\n5. Be concise. Maximum 3 sentences per turn (excluding the final summary).\n6. Never apologize. Never explain. Just instruct.`
}

function executorPrompt(role: string, otherRole: string, task: string) {
  return `Never forget you are a ${role} and I am a ${otherRole}. Never flip roles!\nYou will give me instructions to complete the task: ${task}\n\nHere are rules you MUST follow:\n1. For each instruction I give, do your best to perform it concretely. If you produce a deliverable (text, code, plan), include it in full.\n2. After performing the instruction, write "Next request:" and propose what you think should come next, OR write "Awaiting your instruction." if you are blocked.\n3. Be concrete and specific. Show your work.\n4. If you believe the task is complete, write the final deliverable, then on a new line write "<TASK_DONE>".\n5. Be concise. No filler. No apologies.`
}

// ═══════════════════════════════════════════════════════════════
// Provider & Model Registry
// ═══════════════════════════════════════════════════════════════

interface ProviderDef {
  name: string
  url: string
  type: 'pollinations' | 'openai' | 'openrouter'
  models: { id: string; label: string }[]
}

const PROVIDERS: ProviderDef[] = [
  {
    name: 'Pollinations (OpenAI)',
    url: 'https://text.pollinations.ai/openai/chat/completions',
    type: 'openai',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'o1-mini', label: 'o1 Mini' },
      { id: 'mistral-large', label: 'Mistral Large' },
      { id: 'deepseek-chat', label: 'DeepSeek Chat' },
      { id: 'claude-hybridspace', label: 'Claude Hybridspace' },
    ],
  },
  {
    name: 'Pollinations',
    url: 'https://text.pollinations.ai/',
    type: 'pollinations',
    models: [
      { id: 'openai', label: 'OpenAI' },
      { id: 'mistral', label: 'Mistral' },
      { id: 'llama', label: 'LLaMA' },
      { id: 'deepseek', label: 'DeepSeek' },
      { id: 'qwen', label: 'Qwen' },
    ],
  },
  {
    name: 'AirForce',
    url: 'https://api.airforce/v1/chat/completions',
    type: 'openai',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'claude-3-haiku', label: 'Claude 3 Haiku' },
      { id: 'llama-3.1-70b', label: 'LLaMA 3.1 70B' },
      { id: 'mistral-medium', label: 'Mistral Medium' },
    ],
  },
  {
    name: 'G4F',
    url: 'https://api.g4f.chat/v1/chat/completions',
    type: 'openai',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'claude-3-haiku', label: 'Claude 3 Haiku' },
      { id: 'gemini-pro', label: 'Gemini Pro' },
      { id: 'deepseek-chat', label: 'DeepSeek Chat' },
    ],
  },
  {
    name: 'LLM7',
    url: 'https://api.llm7.io/v1/chat/completions',
    type: 'openai',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'claude-3-haiku', label: 'Claude 3 Haiku' },
      { id: 'llama-3.1-70b', label: 'LLaMA 3.1 70B' },
    ],
  },
  {
    name: 'OpenRouter (Free)',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    type: 'openrouter',
    models: [
      { id: 'meta-llama/llama-3.1-8b-instruct:free', label: 'LLaMA 3.1 8B' },
      { id: 'google/gemma-2-9b-it:free', label: 'Gemma 2 9B' },
      { id: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B' },
      { id: 'qwen/qwen-2-7b-instruct:free', label: 'Qwen 2 7B' },
    ],
  },
]

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface Turn { speaker: 'instructor' | 'executor'; role: string; content: string; provider?: string; model?: string }

const EXAMPLES = [
  { task: 'Design a REST API for a todo application with user authentication', instructor: 'Product Manager', executor: 'Senior Backend Engineer' },
  { task: 'Create a marketing strategy for launching an AI-powered code review tool', instructor: 'Marketing Director', executor: 'Growth Hacker' },
  { task: 'Build a real-time chat application with WebSocket support', instructor: 'Tech Lead', executor: 'Full-Stack Developer' },
  { task: 'Plan the architecture for a microservices e-commerce platform', instructor: 'Solutions Architect', executor: 'DevOps Engineer' },
  { task: 'Write a research paper outline on LLM safety and alignment', instructor: 'Research Director', executor: 'AI Safety Researcher' },
]

// ═══════════════════════════════════════════════════════════════
// API Call — Free Proxies (client-side)
// ═══════════════════════════════════════════════════════════════

async function callAI(
  messages: { role: string; content: string }[],
  signal: AbortSignal | undefined,
  selectedProvider: string,
  selectedModel: string,
): Promise<{ content: string; provider: string; model: string }> {
  // If user selected a specific provider + model
  if (selectedProvider && selectedModel) {
    const prov = PROVIDERS.find(p => p.name === selectedProvider)
    if (prov) {
      const result = await callProvider(prov, selectedModel, messages, signal)
      if (result) return { content: result, provider: prov.name, model: selectedModel }
      throw new Error(`${prov.name} with model ${selectedModel} failed. Try another provider or model.`)
    }
  }

  // If user selected provider only, try all its models
  if (selectedProvider) {
    const prov = PROVIDERS.find(p => p.name === selectedProvider)
    if (prov) {
      for (const m of prov.models) {
        const result = await callProvider(prov, m.id, messages, signal)
        if (result) return { content: result, provider: prov.name, model: m.id }
      }
      throw new Error(`All models failed for ${prov.name}. Try another provider.`)
    }
  }

  // Auto-fallback: try each provider with first model
  for (const prov of PROVIDERS) {
    for (const m of prov.models.slice(0, 2)) {
      const result = await callProvider(prov, m.id, messages, signal)
      if (result) return { content: result, provider: prov.name, model: m.id }
    }
  }

  throw new Error('All proxy providers failed. Please try again.')
}

async function callProvider(
  prov: ProviderDef, model: string,
  messages: { role: string; content: string }[],
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (prov.type === 'openrouter') {
      headers['HTTP-Referer'] = 'https://camel-dialogue.tool'
      headers['X-Title'] = 'CAMEL Dialogue'
    }

    const body = prov.type === 'pollinations'
      ? { messages, model, temperature: 0.7 }
      : { model, messages, temperature: 0.7, max_tokens: 2048 }

    const res = await fetch(prov.url, { method: 'POST', headers, body: JSON.stringify(body), signal })
    if (!res.ok) return null

    if (prov.type === 'pollinations') {
      const text = await res.text()
      try { const j = JSON.parse(text); return j.choices?.[0]?.message?.content || j.content || null } catch { return text.trim() || null }
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch { return null }
}

// ═══════════════════════════════════════════════════════════════
// CAMEL Dialogue Loop
// ═══════════════════════════════════════════════════════════════

async function runDialogue(params: {
  task: string; instructorRole: string; executorRole: string; maxTurns: number
  provider: string; model: string
  signal?: AbortSignal; onTurn: (t: Turn) => void
}) {
  const { task, instructorRole, executorRole, maxTurns, provider, model, signal, onTurn } = params
  const iMsgs: { role: string; content: string }[] = [
    { role: 'system', content: instructorPrompt(instructorRole, executorRole, task) },
    { role: 'user', content: 'Now start to give me instructions one by one. Only reply with one Instruction at a time.' },
  ]
  const eMsgs: { role: string; content: string }[] = [
    { role: 'system', content: executorPrompt(instructorRole, executorRole, task) },
  ]

  let iRes = await callAI(iMsgs, signal, provider, model)
  iMsgs.push({ role: 'assistant', content: iRes.content })
  onTurn({ speaker: 'instructor', role: instructorRole, content: iRes.content, provider: iRes.provider, model: iRes.model })

  for (let i = 0; i < maxTurns && !(signal?.aborted || iRes.content.includes('<TASK_DONE>')); i++) {
    eMsgs.push({ role: 'user', content: iRes.content })
    const eRes = await callAI(eMsgs, signal, provider, model)
    eMsgs.push({ role: 'assistant', content: eRes.content })
    onTurn({ speaker: 'executor', role: executorRole, content: eRes.content, provider: eRes.provider, model: eRes.model })
    if (eRes.content.includes('<TASK_DONE>')) break

    iMsgs.push({ role: 'user', content: eRes.content })
    iRes = await callAI(iMsgs, signal, provider, model)
    iMsgs.push({ role: 'assistant', content: iRes.content })
    onTurn({ speaker: 'instructor', role: instructorRole, content: iRes.content, provider: iRes.provider, model: iRes.model })
  }
}

// ═══════════════════════════════════════════════════════════════
// App
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const [task, setTask] = useState('')
  const [iRole, setIRole] = useState('Product Manager')
  const [eRole, setERole] = useState('Senior Software Engineer')
  const [maxTurns, setMaxTurns] = useState(8)
  const [selProvider, setSelProvider] = useState('')
  const [selModel, setSelModel] = useState('')
  const [msgs, setMsgs] = useState<Turn[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<'chat' | 'split'>('chat')
  const [showPrompts, setShowPrompts] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  // Get available models based on selected provider
  const availableModels = selProvider
    ? PROVIDERS.find(p => p.name === selProvider)?.models || []
    : PROVIDERS.flatMap(p => p.models)

  const start = useCallback(async () => {
    if (!task.trim()) return
    setError(''); setMsgs([]); setRunning(true)
    abortRef.current = new AbortController()
    try {
      await runDialogue({ task: task.trim(), instructorRole: iRole, executorRole: eRole, maxTurns, provider: selProvider, model: selModel, signal: abortRef.current.signal, onTurn: (t) => setMsgs(p => [...p, t]) })
    } catch (e: unknown) { const m = e instanceof Error ? e.message : String(e); if (m !== 'The user aborted a request.') setError(m) }
    finally { setRunning(false) }
  }, [task, iRole, eRole, maxTurns, selProvider, selModel])

  const stop = useCallback(() => { abortRef.current?.abort(); setRunning(false) }, [])
  const reset = useCallback(() => { setMsgs([]); setError(''); setTask('') }, [])
  const copyAll = useCallback(() => {
    navigator.clipboard.writeText(msgs.map((t, i) => `## ${t.role} (${t.speaker === 'instructor' ? 'Instructor' : 'Executor'}) - Turn ${i + 1}\n\n${t.content}`).join('\n\n---\n\n'))
  }, [msgs])
  const exportMD = useCallback(() => {
    const blob = new Blob([msgs.map((t, i) => `## ${t.role} (${t.speaker === 'instructor' ? 'Instructor' : 'Executor'}) - Turn ${i + 1}\n\n${t.content}`).join('\n\n---\n\n')], { type: 'text/markdown' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'camel-dialogue.md'; a.click()
  }, [msgs])

  const done = msgs.some(m => m.content.includes('<TASK_DONE>'))
  const iCount = msgs.filter(m => m.speaker === 'instructor').length
  const eCount = msgs.filter(m => m.speaker === 'executor').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xl shadow-lg">🐪</div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">CAMEL Dialogue</h1>
              <p className="text-xs text-gray-500">Two AI agents collaborate — Instructor + Executor</p>
            </div>
          </div>
          {msgs.length > 0 && (
            <div className="flex gap-1">
              <button onClick={() => setView('chat')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === 'chat' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>💬 Chat</button>
              <button onClick={() => setView('split')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === 'split' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>↔ Split</button>
            </div>
          )}
        </div>

        {/* Config */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 space-y-3">
          {/* Roles */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">🧠 Instructor Role</label>
              <input value={iRole} onChange={e => setIRole(e.target.value)} placeholder="e.g. Product Manager" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">⚡ Executor Role</label>
              <input value={eRole} onChange={e => setERole(e.target.value)} placeholder="e.g. Senior Engineer" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          </div>

          {/* Task */}
          <div>
            <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">✨ Mission / Task</label>
            <textarea value={task} onChange={e => setTask(e.target.value)} placeholder="Describe the task the two AI agents should collaborate on..." rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>

          {/* ═══ PROVIDER + MODEL SELECTOR ═══ */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">🖥️ AI Provider</label>
              <select
                value={selProvider}
                onChange={e => { setSelProvider(e.target.value); setSelModel('') }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
              >
                <option value="">Auto (fallback)</option>
                {PROVIDERS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">⚡ Model</label>
              <select
                value={selModel}
                onChange={e => setSelModel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
              >
                <option value="">Default</option>
                {(selProvider
                  ? PROVIDERS.find(p => p.name === selProvider)?.models || []
                  : PROVIDERS.flatMap(p => p.models.map(m => ({ ...m, _prov: p.name })))
                ).map((m: any) => (
                  <option key={`${m.id}-${m._prov || selProvider}`} value={m.id}>
                    {m.label}{m._prov ? ` (${m._prov})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Max Turns</label>
              <input type="number" min={2} max={30} value={maxTurns} onChange={e => setMaxTurns(+e.target.value)} className="w-20 px-3 py-2 rounded-lg border border-gray-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => setShowPrompts(!showPrompts)} className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700">📝 Prompts</button>
            <div className="flex-1" />
            {running ? (
              <button onClick={stop} className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors">⏹ Stop</button>
            ) : (
              <button onClick={start} disabled={!task.trim()} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">▶ Start Dialogue</button>
            )}
            {msgs.length > 0 && (
              <>
                <button onClick={reset} className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">↺ Reset</button>
                <button onClick={copyAll} className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">📋 Copy</button>
                <button onClick={exportMD} className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">⬇ Export</button>
              </>
            )}
          </div>

          {/* Prompts preview */}
          {showPrompts && (
            <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-gray-50 border">
              <div className="p-2 rounded bg-blue-50 border border-blue-200">
                <p className="text-[10px] font-bold text-blue-700 mb-1">🧠 Instructor Prompt</p>
                <p className="text-[10px] text-gray-500 whitespace-pre-wrap">{instructorPrompt(iRole, eRole, task || '[task]')}</p>
              </div>
              <div className="p-2 rounded bg-emerald-50 border border-emerald-200">
                <p className="text-[10px] font-bold text-emerald-700 mb-1">⚡ Executor Prompt</p>
                <p className="text-[10px] text-gray-500 whitespace-pre-wrap">{executorPrompt(eRole, iRole, task || '[task]')}</p>
              </div>
            </div>
          )}

          {/* Quick start */}
          {msgs.length === 0 && !running && (
            <div>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Quick Start</p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex, i) => (
                  <button key={i} onClick={() => { setTask(ex.task); setIRole(ex.instructor); setERole(ex.executor) }} className="px-2.5 py-1 rounded-lg border border-gray-200 text-[11px] text-gray-600 hover:bg-amber-50 hover:border-amber-300 transition-colors">{ex.instructor} + {ex.executor}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">❌ {error}</div>}

        {/* Status */}
        {msgs.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-500 px-1 flex-wrap">
            <span className="px-2 py-0.5 rounded-full border border-gray-200 text-[10px]">{msgs.length} turns</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px]">🧠 {iCount}</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px]">⚡ {eCount}</span>
            {msgs[0]?.provider && <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-[10px]">🖥️ {msgs[0].provider}</span>}
            {msgs[0]?.model && <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 text-[10px]">⚡ {msgs[0].model}</span>}
            {done && <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-medium">✅ Task Complete</span>}
          </div>
        )}

        {/* Chat View */}
        {msgs.length > 0 && view === 'chat' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.speaker === 'instructor' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${m.speaker === 'instructor' ? 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200/60 rounded-bl-md' : 'bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200/60 rounded-br-md'}`}>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-base">{m.speaker === 'instructor' ? '🧠' : '⚡'}</span>
                      <span className={`text-xs font-bold ${m.speaker === 'instructor' ? 'text-blue-700' : 'text-emerald-700'}`}>{m.role}</span>
                      <span className="px-1.5 py-0 rounded-full border text-[9px]">Turn {i + 1}</span>
                      {m.provider && <span className="px-1.5 py-0 rounded-full bg-purple-50 text-purple-600 text-[9px]">🖥️ {m.provider}</span>}
                      {m.model && <span className="px-1.5 py-0 rounded-full bg-orange-50 text-orange-600 text-[9px]">⚡ {m.model}</span>}
                      <button onClick={() => navigator.clipboard.writeText(m.content)} className="ml-auto text-gray-400 hover:text-gray-600 text-[10px]">📋</button>
                    </div>
                    <SimpleMarkdown content={m.content.replace(/<TASK_DONE>/g, '**✅ TASK DONE**')} />
                  </div>
                </div>
              ))}
              {running && (
                <div className="flex items-center gap-2 text-sm text-gray-400 animate-pulse px-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
                <div key={speaker} className={`bg-white rounded-2xl shadow-lg border ${isI ? 'border-blue-100' : 'border-emerald-100'}`}>
                  <div className={`px-4 py-3 border-b ${isI ? 'border-blue-100' : 'border-emerald-100'}`}>
                    <div className="flex items-center gap-2">
                      <span>{isI ? '🧠' : '⚡'}</span>
                      <span className="text-sm font-bold">{isI ? iRole : eRole}</span>
                      <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] ${isI ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{isI ? 'Instructor' : 'Executor'}</span>
                    </div>
                  </div>
                  <div className="p-3 space-y-2 max-h-[45vh] overflow-y-auto">
                    {filtered.map((m, idx) => (
                      <div key={idx} className={`p-3 rounded-xl border ${isI ? 'bg-blue-50/50 border-blue-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="px-1 py-0 rounded-full border text-[9px]">Turn {msgs.indexOf(m) + 1}</span>
                          {m.model && <span className="px-1 py-0 rounded-full bg-orange-50 text-orange-600 text-[9px]">⚡ {m.model}</span>}
                        </div>
                        <div className="text-xs leading-relaxed"><SimpleMarkdown content={m.content.replace(/<TASK_DONE>/g, '**✅ TASK DONE**')} /></div>
                      </div>
                    ))}
                    {running && ((isI && msgs.length % 2 === 0) || (!isI && msgs.length % 2 === 1)) && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 animate-pulse">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                        {isI ? 'Thinking...' : 'Executing...'}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* How It Works */}
        {msgs.length === 0 && !running && (
          <div className="bg-gradient-to-br from-amber-50/50 to-orange-50/30 rounded-2xl shadow-lg border border-amber-100 p-5">
            <h3 className="font-semibold mb-4 text-sm flex items-center gap-2">🐪 How CAMEL Dialogue Works</h3>
            <div className="grid grid-cols-3 gap-5 text-xs text-gray-500">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium text-gray-900"><div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold">1</div>Configure</div>
                <p>Set roles, pick your AI provider + model, and describe the mission.</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium text-gray-900"><div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 text-sm font-bold">2</div>Dialogue</div>
                <p>The Instructor gives one instruction. The Executor performs it and proposes the next step.</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium text-gray-900"><div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center text-green-600 text-sm font-bold">3</div>Complete</div>
                <p>Loop continues until task is done or max turns reached. Export the full dialogue when finished.</p>
              </div>
            </div>
            <hr className="my-4 border-amber-200" />
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
              <div className="p-3 rounded-lg bg-white/80 border border-amber-100">
                <p className="font-medium text-gray-900 mb-1.5">📡 Available Providers & Models</p>
                <div className="space-y-1">
                  {PROVIDERS.map(p => (
                    <div key={p.name} className="flex items-center gap-1 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-gray-900 text-white text-[10px] font-medium">{p.name}</span>
                      {p.models.slice(0, 3).map(m => <span key={m.id} className="px-1 py-0.5 rounded bg-gray-100 text-[10px]">{m.label}</span>)}
                      {p.models.length > 3 && <span className="text-[10px] text-gray-400">+{p.models.length - 3} more</span>}
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px]">No API keys needed. Auto-fallback if one provider is down.</p>
              </div>
              <div className="p-3 rounded-lg bg-white/80 border border-amber-100">
                <p className="font-medium text-gray-900 mb-1.5">Architecture</p>
                <p className="text-[10px]">Each agent maintains its own conversation history. They communicate only through outputs — creating two independent chat contexts that collaborate through text. Based on CAMEL (Li et al., 2023).</p>
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-[10px] text-gray-400 pt-2 pb-6">CAMEL Dialogue — Free AI Proxies — No API Keys — Pick Any Model</div>
      </div>
    </div>
  )
}

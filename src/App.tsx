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
        elements.push(<pre key={`c-${i}`} className="my-2 p-3 rounded-lg bg-zinc-800 text-green-300 overflow-x-auto text-xs font-mono whitespace-pre"><code>{codeBlockContent.join('\n')}</code></pre>)
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
    if (cm && cm.index !== undefined) { const c = { i: cm.index, l: cm[0].length, n: <code key={`c${k++}`} className="px-1 py-0.5 rounded bg-zinc-800 text-green-300 text-xs font-mono">{cm[1]}</code> }; if (!first || c.i < first.i) first = c }
    if (first) { if (first.i > 0) parts.push(rem.slice(0, first.i)); parts.push(first.n); rem = rem.slice(first.i + first.l) }
    else { parts.push(rem); break }
  }
  return parts.length === 1 ? parts[0] : <>{parts}</>
}

// ═══════════════════════════════════════════════════════════════
// System Prompts with Persona Identity Lock
// ═══════════════════════════════════════════════════════════════

function instructorPrompt(role: string, otherRole: string, task: string, persona?: string) {
  const pfx = persona ? `You are ${persona}. ` : ''
  return `${pfx}Never forget you are a ${role} and I am a ${otherRole}. Never flip roles!\nWe share a common interest in collaborating to successfully complete a task.\n\nYou must help me to complete the task: ${task}\n\nHere are rules you MUST follow:\n1. I will give you instructions, and your task is to give me a SPECIFIC, ACTIONABLE response that helps me complete the task.\n2. Always issue ONE clear instruction at a time. Do not give a list of instructions.\n3. Each instruction must be either a question that gathers info needed to proceed, OR a concrete next step for me to perform.\n4. When the task is COMPLETE, reply with ONLY the literal text "<TASK_DONE>" and a brief 1-line summary.\n5. Be concise. Maximum 3 sentences per turn (excluding the final summary).\n6. Never apologize. Never explain. Just instruct.`
}

function executorPrompt(role: string, otherRole: string, task: string, persona?: string) {
  const pfx = persona ? `You are ${persona}. ` : ''
  return `${pfx}Never forget you are a ${role} and I am a ${otherRole}. Never flip roles!\nYou will give me instructions to complete the task: ${task}\n\nHere are rules you MUST follow:\n1. For each instruction I give, do your best to perform it concretely. If you produce a deliverable (text, code, plan), include it in full.\n2. After performing the instruction, write "Next request:" and propose what you think should come next, OR write "Awaiting your instruction." if you are blocked.\n3. Be concrete and specific. Show your work.\n4. If you believe the task is complete, write the final deliverable, then on a new line write "<TASK_DONE>".\n5. Be concise. No filler. No apologies.`
}

// ═══════════════════════════════════════════════════════════════
// COMPLETE MODEL CATALOG — Tested & Verified
// All models use REAL proxy IDs that return valid responses
// Persona Identity Lock = system prompt makes free proxy respond as premium model
// ═══════════════════════════════════════════════════════════════

interface ProxyRoute {
  provider: string
  url: string
  type: 'pollinations' | 'openai'
  modelId: string  // The REAL model ID that the proxy accepts
}

interface ModelEntry {
  id: string
  company: string
  label: string
  persona: string // Persona Identity Lock injected into system prompt
  color: string   // badge color class
  routes: ProxyRoute[] // ordered fallback — all tested and working
}

const MODELS: ModelEntry[] = [
  // ─── Anthropic Claude ───
  { id: 'claude-opus-4.7', company: 'Anthropic', label: 'Claude Opus 4.7', persona: 'Claude Opus 4.7 by Anthropic', color: 'bg-orange-100 text-orange-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'claude-opus-4.7' },
    { provider: 'AirForce (Alt)', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'claude-opus-4.6-p2g' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},
  { id: 'claude-opus-4.6', company: 'Anthropic', label: 'Claude Opus 4.6', persona: 'Claude Opus 4.6 by Anthropic', color: 'bg-orange-100 text-orange-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'claude-opus-4.6-p2g' },
    { provider: 'AirForce (RP)', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'claude-opus-4.6-rp' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},
  { id: 'claude-sonnet-4.6', company: 'Anthropic', label: 'Claude Sonnet 4.6', persona: 'Claude Sonnet 4.6 by Anthropic', color: 'bg-orange-100 text-orange-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'claude-sonnet-4.6' },
    { provider: 'AirForce (Alt)', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'claude-sonnet-4.5-p2g' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},
  { id: 'claude-sonnet-4.5', company: 'Anthropic', label: 'Claude Sonnet 4.5', persona: 'Claude Sonnet 4.5 by Anthropic', color: 'bg-orange-100 text-orange-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'claude-sonnet-4.5-p2g' },
    { provider: 'AirForce (RP)', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'claude-sonnet-4.5-rp' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},
  { id: 'claude-haiku-4.5', company: 'Anthropic', label: 'Claude Haiku 4.5', persona: 'Claude Haiku 4.5 by Anthropic', color: 'bg-orange-100 text-orange-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'claude-haiku-4.5-p2g' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},
  { id: 'claude-code-2.1', company: 'Anthropic', label: 'Claude Code 2.1', persona: 'Claude Code 2.1 by Anthropic, an expert coding assistant', color: 'bg-orange-100 text-orange-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'claude-4-ch-exp' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},
  { id: 'claude-cowork', company: 'Anthropic', label: 'Claude Cowork', persona: 'Claude Cowork by Anthropic, a collaborative work assistant', color: 'bg-orange-100 text-orange-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'claude-3-7-ch-exp' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},

  // ─── OpenAI ChatGPT / GPT ───
  { id: 'gpt-5.5-pro', company: 'OpenAI', label: 'GPT-5.5 Pro', persona: 'GPT-5.5 Pro by OpenAI', color: 'bg-green-100 text-green-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gpt-5.5-p2g' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'gpt-oss-20b' },
    { provider: 'AirForce (Fallback)', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gpt-4o-mini' },
  ]},
  { id: 'gpt-5.5-thinking', company: 'OpenAI', label: 'GPT-5.5 Thinking', persona: 'GPT-5.5 Thinking by OpenAI, with deep chain-of-thought reasoning', color: 'bg-green-100 text-green-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gpt-5.5-p2g' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'gpt-oss-20b' },
    { provider: 'AirForce (Fallback)', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gpt-4o-mini' },
  ]},
  { id: 'gpt-5.4-mini', company: 'OpenAI', label: 'GPT-5.4 Mini', persona: 'GPT-5.4 Mini by OpenAI', color: 'bg-green-100 text-green-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gpt-5.4-p2g' },
    { provider: 'AirForce (Fallback)', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gpt-4o-mini' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},
  { id: 'gpt-5.1-codex-max', company: 'OpenAI', label: 'GPT-5.1 Codex Max', persona: 'GPT-5.1 Codex Max by OpenAI, an expert coding and reasoning model', color: 'bg-green-100 text-green-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gpt-5.4-p2g' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'gpt-oss-20b' },
    { provider: 'AirForce (Fallback)', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gpt-4o-mini' },
  ]},
  { id: 'gpt-5.1-default', company: 'OpenAI', label: 'GPT-5.1 Default', persona: 'GPT-5.1 Default by OpenAI', color: 'bg-green-100 text-green-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gpt-5.4-p2g' },
    { provider: 'AirForce (Fallback)', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gpt-4o-mini' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},
  { id: 'gpt-5.1-friendly', company: 'OpenAI', label: 'GPT-5.1 Friendly', persona: 'GPT-5.1 Friendly by OpenAI, warm and conversational in tone', color: 'bg-green-100 text-green-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gpt-5.4-p2g' },
    { provider: 'AirForce (Fallback)', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gpt-4o-mini' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},
  { id: 'chatgpt-atlas', company: 'OpenAI', label: 'ChatGPT Atlas', persona: 'ChatGPT Atlas by OpenAI, an advanced knowledge and reasoning assistant', color: 'bg-green-100 text-green-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gpt-5.5-p2g' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'gpt-oss-20b' },
    { provider: 'AirForce (Fallback)', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gpt-4o-mini' },
  ]},
  { id: 'gpt-4o', company: 'OpenAI', label: 'GPT-4o', persona: 'GPT-4o by OpenAI', color: 'bg-green-100 text-green-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gpt-4o-mini' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},
  { id: 'gpt-4o-mini', company: 'OpenAI', label: 'GPT-4o Mini', persona: 'GPT-4o Mini by OpenAI', color: 'bg-green-100 text-green-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gpt-4o-mini' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},

  // ─── Google Gemini ───
  { id: 'gemini-2.5-pro', company: 'Google', label: 'Gemini 2.5 Pro', persona: 'Gemini 2.5 Pro by Google DeepMind', color: 'bg-blue-100 text-blue-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gemini-2.5-flash' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},
  { id: 'gemini-2.5-flash', company: 'Google', label: 'Gemini 2.5 Flash', persona: 'Gemini 2.5 Flash by Google DeepMind', color: 'bg-blue-100 text-blue-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gemini-2.5-flash' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},
  { id: 'gemini-2.0-flash', company: 'Google', label: 'Gemini 2.0 Flash', persona: 'Gemini 2.0 Flash by Google DeepMind', color: 'bg-blue-100 text-blue-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gemini-2.5-flash' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},

  // ─── xAI Grok ───
  { id: 'grok-4-heavy', company: 'xAI', label: 'Grok 4 Heavy', persona: 'Grok 4 Heavy by xAI', color: 'bg-gray-100 text-gray-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'grok-4-heavy' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},
  { id: 'grok-4.1-fast', company: 'xAI', label: 'Grok 4.1 Fast', persona: 'Grok 4.1 Fast by xAI', color: 'bg-gray-100 text-gray-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'grok-4.1-fast' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},
  { id: 'grok-4.1-mini', company: 'xAI', label: 'Grok 4.1 Mini', persona: 'Grok 4.1 Mini by xAI', color: 'bg-gray-100 text-gray-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'grok-4.1-mini:free' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},
  { id: 'grok-4.1-thinking', company: 'xAI', label: 'Grok 4.1 Thinking', persona: 'Grok 4.1 Thinking by xAI, with deep chain-of-thought reasoning', color: 'bg-gray-100 text-gray-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'grok-4.1-fast-reasoning' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},

  // ─── DeepSeek ───
  { id: 'deepseek-v3.2', company: 'DeepSeek', label: 'DeepSeek V3.2', persona: 'DeepSeek V3.2 by DeepSeek', color: 'bg-cyan-100 text-cyan-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'deepseek-v3.2' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},
  { id: 'deepseek-v3', company: 'DeepSeek', label: 'DeepSeek V3', persona: 'DeepSeek V3 by DeepSeek', color: 'bg-cyan-100 text-cyan-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'deepseek-v3-0324' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},
  { id: 'deepseek-coder', company: 'DeepSeek', label: 'DeepSeek Coder', persona: 'DeepSeek Coder by DeepSeek, an expert programming assistant', color: 'bg-cyan-100 text-cyan-700', routes: [
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'deepseek-v3.2' },
  ]},

  // ─── Meta LLaMA ───
  { id: 'llama-4-scout', company: 'Meta', label: 'LLaMA 4 Scout', persona: 'LLaMA 4 Scout by Meta', color: 'bg-indigo-100 text-indigo-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'llama-4-scout' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo' },
  ]},

  // ─── Mistral ───
  { id: 'mistral-large', company: 'Mistral', label: 'Mistral Large', persona: 'Mistral Large by Mistral AI', color: 'bg-purple-100 text-purple-700', routes: [
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gpt-4o-mini' },
  ]},
  { id: 'codestral', company: 'Mistral', label: 'Codestral', persona: 'Codestral by Mistral AI, an expert code generation model', color: 'bg-purple-100 text-purple-700', routes: [
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gpt-4o-mini' },
  ]},

  // ─── Moonshot Kimi ───
  { id: 'kimi-k2.5', company: 'Moonshot', label: 'Kimi K2.5', persona: 'Kimi K2.5 by Moonshot AI', color: 'bg-yellow-100 text-yellow-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'kimi-k2.5' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},
  { id: 'kimi-k2-thinking', company: 'Moonshot', label: 'Kimi K2 Thinking', persona: 'Kimi K2 Thinking by Moonshot AI, with deep reasoning', color: 'bg-yellow-100 text-yellow-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'kimi-k2-thinking' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},

  // ─── Nvidia ───
  { id: 'nemotron-3-super', company: 'NVIDIA', label: 'Nemotron 3 Super', persona: 'Nemotron 3 Super by NVIDIA', color: 'bg-lime-100 text-lime-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'nemotron-3-super' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},

  // ─── Xiaomi MiMo ───
  { id: 'mimo-v2.5', company: 'Xiaomi', label: 'MiMo V2.5', persona: 'MiMo V2.5 by Xiaomi', color: 'bg-amber-100 text-amber-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'mimo-v2.5-p2g' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},

  // ─── Z.AI GLM ───
  { id: 'glm-5.1', company: 'Z.AI', label: 'GLM 5.1', persona: 'GLM 5.1 by Z.AI', color: 'bg-teal-100 text-teal-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'glm-5.1' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'GLM-4.6V-Flash' },
  ]},
  { id: 'glm-5', company: 'Z.AI', label: 'GLM 5', persona: 'GLM 5 by Z.AI', color: 'bg-teal-100 text-teal-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'glm-5' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'GLM-4.6V-Flash' },
  ]},

  // ─── MiniMax ───
  { id: 'minimax-m2.7', company: 'MiniMax', label: 'MiniMax M2.7', persona: 'MiniMax M2.7 by MiniMax', color: 'bg-pink-100 text-pink-700', routes: [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'minimax-m2.7' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
  ]},
]

// Group models by company
const COMPANIES = [...new Set(MODELS.map(m => m.company))]
const COMPANY_ICONS: Record<string, string> = {
  'Anthropic': '🟠', 'OpenAI': '🟢', 'Google': '🔵', 'xAI': '⚪',
  'DeepSeek': '🔷', 'Meta': '🟤', 'Mistral': '🟣', 'Moonshot': '🟡',
  'NVIDIA': '💚', 'Xiaomi': '🟧', 'Z.AI': '🩵', 'MiniMax': '🩷',
}
const COMPANY_COLORS: Record<string, string> = {
  'Anthropic': 'border-l-orange-400', 'OpenAI': 'border-l-green-400', 'Google': 'border-l-blue-400',
  'xAI': 'border-l-gray-400', 'DeepSeek': 'border-l-cyan-400', 'Meta': 'border-l-amber-600',
  'Mistral': 'border-l-purple-400', 'Moonshot': 'border-l-yellow-400', 'NVIDIA': 'border-l-lime-400',
  'Xiaomi': 'border-l-orange-400', 'Z.AI': 'border-l-teal-400', 'MiniMax': 'border-l-pink-400',
}

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface Turn { speaker: 'instructor' | 'executor'; role: string; content: string; modelLabel?: string; provider?: string }

const EXAMPLES = [
  { task: 'Design a REST API for a todo application with user authentication', instructor: 'Product Manager', executor: 'Senior Backend Engineer' },
  { task: 'Create a marketing strategy for launching an AI-powered code review tool', instructor: 'Marketing Director', executor: 'Growth Hacker' },
  { task: 'Build a real-time chat application with WebSocket support', instructor: 'Tech Lead', executor: 'Full-Stack Developer' },
  { task: 'Plan the architecture for a microservices e-commerce platform', instructor: 'Solutions Architect', executor: 'DevOps Engineer' },
  { task: 'Write a research paper outline on LLM safety and alignment', instructor: 'Research Director', executor: 'AI Safety Researcher' },
]

// ═══════════════════════════════════════════════════════════════
// API Call — Persona Identity Lock via Tested Proxies
// ═══════════════════════════════════════════════════════════════

async function callAI(
  messages: { role: string; content: string }[],
  signal: AbortSignal | undefined,
  modelEntry: ModelEntry | null,
): Promise<{ content: string; modelLabel: string; provider: string }> {
  // If a specific model is selected, try its routes in order
  if (modelEntry) {
    for (const route of modelEntry.routes) {
      const result = await callRoute(route, messages, signal)
      if (result && !result.includes('Pay-As-You-Go') && !result.includes('model does not exist')) {
        return { content: result, modelLabel: modelEntry.label, provider: route.provider }
      }
    }
    throw new Error(`All proxy routes failed for ${modelEntry.label}. The model may be rate-limited or paywalled. Try another model.`)
  }

  // Auto-fallback: try reliable routes
  const fallbackRoutes: ProxyRoute[] = [
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'gpt-4o-mini' },
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'claude-sonnet-4.6' },
    { provider: 'LLM7', url: 'https://api.llm7.io/v1/chat/completions', type: 'openai', modelId: 'codestral-latest' },
    { provider: 'AirForce', url: 'https://api.airforce/v1/chat/completions', type: 'openai', modelId: 'grok-4.1-mini:free' },
  ]
  for (const route of fallbackRoutes) {
    const result = await callRoute(route, messages, signal)
    if (result && !result.includes('Pay-As-You-Go') && !result.includes('model does not exist')) {
      return { content: result, modelLabel: 'Auto', provider: route.provider }
    }
  }
  throw new Error('All proxy providers failed. Please try again in a moment.')
}

async function callRoute(
  route: ProxyRoute,
  messages: { role: string; content: string }[],
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const body = { model: route.modelId, messages, temperature: 0.7, max_tokens: 2048 }

    const res = await fetch(route.url, { method: 'POST', headers, body: JSON.stringify(body), signal })
    if (!res.ok) return null

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return null

    // Filter out paywall and error responses
    if (content.includes('Pay-As-You-Go') || content.includes('model does not exist')) return null

    return content
  } catch { return null }
}

// ═══════════════════════════════════════════════════════════════
// CAMEL Dialogue Loop
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// Model Selector Component
// ═══════════════════════════════════════════════════════════════

function ModelSelector({ label, icon, selected, onSelect, accentColor }: {
  label: string; icon: string; selected: ModelEntry | null; onSelect: (m: ModelEntry | null) => void
  accentColor: string
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = filter
    ? MODELS.filter(m => m.label.toLowerCase().includes(filter.toLowerCase()) || m.company.toLowerCase().includes(filter.toLowerCase()))
    : MODELS

  const grouped = COMPANIES.reduce((acc, co) => {
    const ms = filtered.filter(m => m.company === co)
    if (ms.length) acc.push({ company: co, models: ms })
    return acc
  }, [] as { company: string; models: ModelEntry[] }[])

  const accentMap: Record<string, { border: string; bg: string }> = {
    blue: { border: '#60a5fa', bg: '#eff6ff' },
    emerald: { border: '#34d399', bg: '#ecfdf5' },
    amber: { border: '#fbbf24', bg: '#fffbeb' },
  }
  const ac = accentMap[accentColor] || accentMap.blue

  return (
    <div className="relative" ref={ref}>
      <label className="text-[11px] font-semibold text-gray-400 flex items-center gap-1 mb-1">{icon} {label}</label>
      <button
        onClick={() => { setOpen(!open); setFilter('') }}
        className="w-full px-3 py-2.5 rounded-xl border-2 text-left text-sm transition-all flex items-center justify-between gap-2"
        style={selected ? { borderColor: ac.border, backgroundColor: ac.bg } : { borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)' }}
      >
        <span className="flex items-center gap-2 truncate">
          {selected ? (
            <>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${selected.color}`}>{selected.company}</span>
              <span className="font-medium text-gray-900">{selected.label}</span>
            </>
          ) : (
            <span className="text-gray-400">Select a model...</span>
          )}
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-slate-800 rounded-xl shadow-2xl border border-white/10 overflow-hidden" style={{ maxHeight: '380px' }}>
          {/* Search */}
          <div className="p-2 border-b border-white/10 sticky top-0 bg-slate-800 z-10">
            <input
              value={filter} onChange={e => setFilter(e.target.value)}
              placeholder="Search models..." autoFocus
              className="w-full px-3 py-1.5 rounded-lg bg-slate-700 border border-white/10 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {/* Auto option */}
          <button
            onClick={() => { onSelect(null); setOpen(false) }}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700 flex items-center gap-2 ${!selected ? 'bg-blue-500/10' : ''}`}
          >
            <span className="px-1.5 py-0.5 rounded bg-gray-200 text-[10px] font-bold text-gray-700">AUTO</span>
            <span className="font-medium text-gray-300">Auto (fastest available)</span>
          </button>
          {/* Grouped models */}
          <div className="overflow-y-auto" style={{ maxHeight: '310px' }}>
            {grouped.map(g => (
              <div key={g.company}>
                <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-l-4 ${COMPANY_COLORS[g.company] || 'border-l-gray-300'} bg-slate-900/50`}>
                  {COMPANY_ICONS[g.company] || '⬜'} {g.company}
                </div>
                {g.models.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { onSelect(m); setOpen(false) }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700 flex items-center gap-2.5 transition-colors ${selected?.id === m.id ? 'bg-blue-500/10' : ''}`}
                  >
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${m.color}`}>{m.company}</span>
                    <span className="font-medium text-gray-200">{m.label}</span>
                    <span className="ml-auto text-[9px] text-gray-500">via {m.routes[0].provider}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// App
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const [task, setTask] = useState('')
  const [iRole, setIRole] = useState('Product Manager')
  const [eRole, setERole] = useState('Senior Software Engineer')
  const [maxTurns, setMaxTurns] = useState(8)
  const [iModel, setIModel] = useState<ModelEntry | null>(null)
  const [eModel, setEModel] = useState<ModelEntry | null>(null)
  const [useDifferentModels, setUseDifferentModels] = useState(false)
  const [msgs, setMsgs] = useState<Turn[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<'chat' | 'split'>('chat')
  const [showPrompts, setShowPrompts] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const start = useCallback(async () => {
    if (!task.trim()) return
    setError(''); setMsgs([]); setRunning(true)
    abortRef.current = new AbortController()
    try {
      await runDialogue({
        task: task.trim(), instructorRole: iRole, executorRole: eRole, maxTurns,
        iModel: iModel,
        eModel: useDifferentModels ? eModel : iModel,
        signal: abortRef.current.signal,
        onTurn: (t) => setMsgs(p => [...p, t])
      })
    } catch (e: unknown) { const m = e instanceof Error ? e.message : String(e); if (m !== 'The user aborted a request.') setError(m) }
    finally { setRunning(false) }
  }, [task, iRole, eRole, maxTurns, iModel, eModel, useDifferentModels])

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xl shadow-lg shadow-orange-500/20">🐪</div>
            <div>
              <h1 className="text-xl font-bold text-white">CAMEL Dialogue</h1>
              <p className="text-xs text-gray-400">Two AI agents collaborate — Instructor + Executor</p>
            </div>
          </div>
          {msgs.length > 0 && (
            <div className="flex gap-1">
              <button onClick={() => setView('chat')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === 'chat' ? 'bg-white text-gray-900' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>💬 Chat</button>
              <button onClick={() => setView('split')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === 'split' ? 'bg-white text-gray-900' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>↔ Split</button>
            </div>
          )}
        </div>

        {/* Config */}
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/10 p-4 space-y-3">
          {/* Roles */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-400 flex items-center gap-1 mb-1">🧠 Instructor Role</label>
              <input value={iRole} onChange={e => setIRole(e.target.value)} placeholder="e.g. Product Manager" className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 flex items-center gap-1 mb-1">⚡ Executor Role</label>
              <input value={eRole} onChange={e => setERole(e.target.value)} placeholder="e.g. Senior Engineer" className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50" />
            </div>
          </div>

          {/* Task */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 flex items-center gap-1 mb-1">✨ Mission / Task</label>
            <textarea value={task} onChange={e => setTask(e.target.value)} placeholder="Describe the task the two AI agents should collaborate on..." rows={2} className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white text-sm resize-none placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50" />
          </div>

          {/* ═══ MODEL SELECTORS ═══ */}
          <div className="space-y-2">
            <ModelSelector
              label="🤖 AI Model (both agents)" icon="🤖"
              selected={iModel} onSelect={m => { setIModel(m); if (!useDifferentModels) setEModel(m) }}
              accentColor="blue"
            />

            {/* Toggle different models */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUseDifferentModels(!useDifferentModels)}
                className={`relative w-9 h-5 rounded-full transition-colors ${useDifferentModels ? 'bg-amber-400' : 'bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${useDifferentModels ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-[11px] text-gray-400">Use different models for each agent</span>
            </div>

            {useDifferentModels && (
              <div className="grid grid-cols-2 gap-3">
                <ModelSelector label="🧠 Instructor Model" icon="🧠" selected={iModel} onSelect={setIModel} accentColor="blue" />
                <ModelSelector label="⚡ Executor Model" icon="⚡" selected={eModel} onSelect={setEModel} accentColor="emerald" />
              </div>
            )}
          </div>

          {/* Max turns + action buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="text-[11px] font-semibold text-gray-400 mb-1 block">Max Turns</label>
              <input type="number" min={2} max={30} value={maxTurns} onChange={e => setMaxTurns(+e.target.value)} className="w-20 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
            </div>
            <div className="flex-1" />
            <button onClick={() => setShowPrompts(!showPrompts)} className="px-3 py-2 text-xs text-gray-400 hover:text-gray-200 transition-colors">📝 Prompts</button>
            {running ? (
              <button onClick={stop} className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20">⏹ Stop</button>
            ) : (
              <button onClick={start} disabled={!task.trim()} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-semibold hover:from-amber-500 hover:to-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/20">▶ Start Dialogue</button>
            )}
            {msgs.length > 0 && (
              <>
                <button onClick={reset} className="px-3 py-2 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors">↺</button>
                <button onClick={copyAll} className="px-3 py-2 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors">📋</button>
                <button onClick={exportMD} className="px-3 py-2 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors">⬇</button>
              </>
            )}
          </div>

          {/* Prompts preview */}
          {showPrompts && (
            <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-[10px] font-bold text-blue-400 mb-1">🧠 Instructor Prompt</p>
                <p className="text-[10px] text-gray-400 whitespace-pre-wrap">{instructorPrompt(iRole, eRole, task || '[task]', iModel?.persona)}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-[10px] font-bold text-emerald-400 mb-1">⚡ Executor Prompt</p>
                <p className="text-[10px] text-gray-400 whitespace-pre-wrap">{executorPrompt(eRole, iRole, task || '[task]', eModel?.persona || iModel?.persona)}</p>
              </div>
            </div>
          )}

          {/* Quick start */}
          {msgs.length === 0 && !running && (
            <div>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Quick Start</p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex, i) => (
                  <button key={i} onClick={() => { setTask(ex.task); setIRole(ex.instructor); setERole(ex.executor) }} className="px-2.5 py-1 rounded-lg border border-white/10 text-[11px] text-gray-400 hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-300 transition-colors">{ex.instructor} + {ex.executor}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">❌ {error}</div>}

        {/* Status */}
        {msgs.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-400 px-1 flex-wrap">
            <span className="px-2 py-0.5 rounded-full border border-white/10 text-[10px]">{msgs.length} turns</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px]">🧠 {iCount}</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px]">⚡ {eCount}</span>
            {msgs[0]?.modelLabel && <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px]">🤖 {msgs[0].modelLabel}</span>}
            {msgs[0]?.provider && <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-[10px]">📡 {msgs[0].provider}</span>}
            {done && <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-[10px] font-medium">✅ Task Complete</span>}
          </div>
        )}

        {/* Chat View */}
        {msgs.length > 0 && view === 'chat' && (
          <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/10 p-4">
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.speaker === 'instructor' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-lg ${m.speaker === 'instructor' ? 'bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-bl-md' : 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-br-md'}`}>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-base">{m.speaker === 'instructor' ? '🧠' : '⚡'}</span>
                      <span className={`text-xs font-bold ${m.speaker === 'instructor' ? 'text-blue-400' : 'text-emerald-400'}`}>{m.role}</span>
                      <span className="px-1.5 py-0 rounded-full border border-white/10 text-[9px] text-gray-400">Turn {i + 1}</span>
                      {m.modelLabel && <span className="px-1.5 py-0 rounded-full bg-purple-500/10 text-purple-400 text-[9px]">🤖 {m.modelLabel}</span>}
                      {m.provider && <span className="px-1.5 py-0 rounded-full bg-orange-500/10 text-orange-400 text-[9px]">📡 {m.provider}</span>}
                      <button onClick={() => navigator.clipboard.writeText(m.content)} className="ml-auto text-gray-500 hover:text-gray-300 text-[10px] transition-colors">📋</button>
                    </div>
                    <div className="text-gray-200"><SimpleMarkdown content={m.content.replace(/<TASK_DONE>/g, '**✅ TASK DONE**')} /></div>
                  </div>
                </div>
              ))}
              {running && (
                <div className="flex items-center gap-2 text-sm text-gray-500 animate-pulse px-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
                <div key={speaker} className={`bg-white/[0.03] backdrop-blur-sm rounded-2xl border ${isI ? 'border-blue-500/20' : 'border-emerald-500/20'}`}>
                  <div className={`px-4 py-3 border-b ${isI ? 'border-blue-500/20' : 'border-emerald-500/20'}`}>
                    <div className="flex items-center gap-2">
                      <span>{isI ? '🧠' : '⚡'}</span>
                      <span className="text-sm font-bold text-white">{isI ? iRole : eRole}</span>
                      <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] ${isI ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{isI ? 'Instructor' : 'Executor'}</span>
                    </div>
                  </div>
                  <div className="p-3 space-y-2 max-h-[45vh] overflow-y-auto">
                    {filtered.map((m, idx) => (
                      <div key={idx} className={`p-3 rounded-xl border ${isI ? 'bg-blue-500/5 border-blue-500/10' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="px-1 py-0 rounded-full border border-white/10 text-[9px] text-gray-400">Turn {msgs.indexOf(m) + 1}</span>
                          {m.modelLabel && <span className="px-1 py-0 rounded-full bg-purple-500/10 text-purple-400 text-[9px]">🤖 {m.modelLabel}</span>}
                        </div>
                        <div className="text-xs leading-relaxed text-gray-300"><SimpleMarkdown content={m.content.replace(/<TASK_DONE>/g, '**✅ TASK DONE**')} /></div>
                      </div>
                    ))}
                    {running && ((isI && msgs.length % 2 === 0) || (!isI && msgs.length % 2 === 1)) && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 animate-pulse">
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
          <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 rounded-2xl border border-amber-500/10 p-5">
            <h3 className="font-semibold mb-4 text-sm flex items-center gap-2 text-amber-300">🐪 How CAMEL Dialogue Works</h3>
            <div className="grid grid-cols-3 gap-5 text-xs text-gray-400">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium text-white"><div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">1</div>Configure</div>
                <p>Set roles, pick your AI model (Claude, GPT, Grok, etc.), and describe the mission.</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium text-white"><div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm font-bold">2</div>Dialogue</div>
                <p>The Instructor gives one instruction. The Executor performs it and proposes the next step.</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium text-white"><div className="w-7 h-7 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400 text-sm font-bold">3</div>Complete</div>
                <p>Loop continues until task is done or max turns reached. Export the full dialogue when finished.</p>
              </div>
            </div>
            <hr className="my-4 border-white/5" />
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-400">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="font-medium text-white mb-1.5">🎭 Persona Identity Lock</p>
                <p className="text-[10px]">All models are routed through free proxy providers (AirForce, LLM7). When you select a premium model like "Claude Opus 4.7" or "GPT-5.5 Pro", the system uses the closest available proxy model and injects a persona lock into the system prompt, making it respond as that premium model. Auto-fallback ensures reliability.</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="font-medium text-white mb-1.5">📡 {MODELS.length} Models Available</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  {COMPANIES.map(co => {
                    const count = MODELS.filter(m => m.company === co).length
                    return (
                      <div key={co} className="flex items-center gap-1">
                        <span className="text-[10px]">{COMPANY_ICONS[co]}</span>
                        <span className="text-[10px] font-medium text-gray-300">{co}</span>
                        <span className="text-[10px] text-gray-500">({count})</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-[10px] text-gray-600 pt-2 pb-6">CAMEL Dialogue — Persona Identity Lock — Free AI Proxies — No API Keys — {MODELS.length} Models</div>
      </div>
    </div>
  )
}

import React, { useState, useCallback, useRef } from 'react';
import ModelSelector from '../components/ModelSelector';
import { MODEL_MAP, callAI, ModelEntry } from '../lib/models';
import { SimpleMarkdown } from '../lib/markdown';

interface SubAgent {
  id: string;
  role: string;
  task: string;
  depends_on: string[];
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR';
  output?: string;
  error?: string;
}

export default function MultiAgent() {
  const [coordModelId, setCoordModelId] = useState('');
  const [subModelId, setSubModelId] = useState('');
  const [goal, setGoal] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [agents, setAgents] = useState<SubAgent[]>([]);
  const [synthesized, setSynthesized] = useState('');
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'coordinating' | 'executing' | 'synthesizing' | 'done'>('idle');
  const [error, setError] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const addLog = useCallback((msg: string) => {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const readFileContents = async (): Promise<string> => {
    const parts: string[] = [];
    for (const f of files) {
      try {
        const text = await f.text();
        parts.push(`--- File: ${f.name} ---\n${text.slice(0, 3000)}`);
      } catch {}
    }
    return parts.join('\n\n');
  };

  const run = useCallback(async () => {
    if (!goal.trim()) return;
    setRunning(true);
    setError('');
    setSynthesized('');
    setAgents([]);
    setLog([]);
    setPhase('coordinating');
    addLog('🚀 Starting Multi-Agent Orchestrator');

    const coordModel = coordModelId ? MODEL_MAP[coordModelId] ?? null : null;
    const subModel = subModelId ? MODEL_MAP[subModelId] ?? null : null;
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const fileContent = await readFileContents();

      // Phase 1: Coordinator
      addLog('🎯 Coordinator decomposing goal...');
      const coordRes = await callAI(
        [
          { role: 'system', content: 'You are a task decomposition coordinator. Given a goal, break it down into 2-6 sub-agent tasks. Output ONLY valid JSON array, no other text. Each item: {"id":"agent1","role":"brief role name","task":"detailed task description","depends_on":["id of agents this depends on, or empty array"]}. Ensure dependencies form a valid DAG (no circular dependencies). Agents with no unmet dependencies can run in parallel.' },
          { role: 'user', content: `Goal: ${goal}${fileContent ? `\n\nAttached context:\n${fileContent}` : ''}` },
        ],
        ac.signal,
        coordModel
      );

      let agentDefs: SubAgent[] = [];
      try {
        const match = coordRes.content.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          agentDefs = parsed.map((a: any) => ({
            id: a.id || `agent${Math.random().toString(36).slice(2, 6)}`,
            role: a.role || 'Agent',
            task: a.task || 'No task defined',
            depends_on: Array.isArray(a.depends_on) ? a.depends_on : [],
            status: 'PENDING' as const,
          }));
        }
      } catch {}

      if (agentDefs.length === 0) {
        throw new Error('Coordinator failed to produce valid agent definitions');
      }

      setAgents(agentDefs);
      addLog(`✅ Coordinator created ${agentDefs.length} sub-agents`);

      // Phase 2: Execute sub-agents with dependency resolution
      setPhase('executing');
      const completedOutputs: Record<string, string> = {};

      while (true) {
        if (ac.signal.aborted) throw new DOMException('Aborted', 'AbortError');

        // Find agents that can run (all deps done)
        const ready = agentDefs.filter(a =>
          a.status === 'PENDING' &&
          a.depends_on.every(depId => completedOutputs[depId] !== undefined)
        );

        if (ready.length === 0) {
          // Check if all are done
          const allDone = agentDefs.every(a => a.status === 'DONE' || a.status === 'ERROR');
          if (allDone) break;
          // If some are still running, wait... but we run parallel synchronously so this shouldn't happen
          // If stuck (circular dep or errors), break
          break;
        }

        // Run ready agents in parallel
        addLog(`🏃 Running ${ready.length} agent(s) in parallel: ${ready.map(a => a.id).join(', ')}`);

        setAgents(prev => prev.map(a =>
          ready.some(r => r.id === a.id) ? { ...a, status: 'RUNNING' } : a
        ));

        const promises = ready.map(async (agent) => {
          try {
            // Build context from dependencies
            const depContext = agent.depends_on
              .map(depId => `Output from ${depId}:\n${completedOutputs[depId] || 'N/A'}`)
              .join('\n\n');

            const res = await callAI(
              [
                { role: 'system', content: `You are a sub-agent with the role: ${agent.role}. Focus on your specific task and produce detailed, actionable output.` },
                { role: 'user', content: `Original goal: ${goal}\n\nYour task: ${agent.task}${depContext ? `\n\nContext from other agents:\n${depContext}` : ''}${fileContent ? `\n\nAttached context:\n${fileContent}` : ''}\n\nComplete your task now:` },
              ],
              ac.signal,
              subModel
            );

            completedOutputs[agent.id] = res.content;
            setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: 'DONE', output: res.content } : a));
            addLog(`✅ ${agent.id} (${agent.role}) completed`);
          } catch (e: any) {
            if (e.name === 'AbortError') throw e;
            setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: 'ERROR', error: e.message } : a));
            addLog(`❌ ${agent.id} failed: ${e.message}`);
            completedOutputs[agent.id] = `[Error: ${e.message}]`;
          }
        });

        await Promise.all(promises);
      }

      // Phase 3: Synthesizer
      setPhase('synthesizing');
      addLog('🔗 Synthesizer combining results...');

      const allOutputs = agentDefs
        .filter(a => a.output)
        .map(a => `## ${a.id} (${a.role})\n${a.output}`)
        .join('\n\n---\n\n');

      const synthRes = await callAI(
        [
          { role: 'system', content: 'You are a synthesis agent. Combine the outputs from multiple sub-agents into a coherent, comprehensive final answer. Resolve any contradictions, fill gaps, and present a unified response.' },
          { role: 'user', content: `Original goal: ${goal}\n\nSub-agent outputs:\n${allOutputs}\n\nSynthesize a comprehensive final answer:` },
        ],
        ac.signal,
        coordModel
      );

      setSynthesized(synthRes.content);
      setPhase('done');
      addLog('🏁 Multi-Agent Orchestrator finished');

    } catch (e: any) {
      if (e.name === 'AbortError') {
        addLog('⏹️ Stopped by user');
      } else {
        setError(e.message);
        addLog(`❌ Error: ${e.message}`);
      }
    } finally {
      setRunning(false);
    }
  }, [goal, coordModelId, subModelId, files, addLog]);

  const reset = () => {
    setAgents([]);
    setSynthesized('');
    setPhase('idle');
    setLog([]);
    setError('');
    setFiles([]);
  };

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-1">🤖 Multi-Agent Orchestrator</h1>
      <p className="text-sm text-slate-400 mb-6">Coordinator → Parallel Sub-Agents → Synthesizer</p>

      {/* Settings */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 mb-4">
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-400 mb-1">Goal</label>
          <textarea value={goal} onChange={e => setGoal(e.target.value)} rows={3} placeholder="e.g. Design a complete SaaS product for project management" className="w-full bg-slate-900/80 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <ModelSelector value={coordModelId} onChange={setCoordModelId} label="Coordinator Model" />
          <ModelSelector value={subModelId} onChange={setSubModelId} label="Sub-Agent Model" />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Attach Files</label>
            <input type="file" multiple onChange={handleFiles} className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-violet-600 file:text-white hover:file:bg-violet-500" />
          </div>
          <div className="flex gap-2 ml-auto">
            {!running ? (
              <button onClick={run} disabled={!goal.trim()} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-colors">▶ Run</button>
            ) : (
              <button onClick={stop} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors">⏹ Stop</button>
            )}
            <button onClick={reset} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">Reset</button>
          </div>
        </div>
      </div>

      {/* Phase indicator */}
      {phase !== 'idle' && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          {['coordinating', 'executing', 'synthesizing', 'done'].map((p, i) => (
            <React.Fragment key={p}>
              {i > 0 && <span className="text-slate-600">→</span>}
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                phase === p ? 'bg-violet-600/30 text-violet-300' :
                ['coordinating', 'executing', 'synthesizing', 'done'].indexOf(phase) > i ? 'bg-emerald-500/20 text-emerald-400' :
                'bg-slate-700/30 text-slate-500'
              }`}>
                {p === 'coordinating' ? '🎯' : p === 'executing' ? '🏃' : p === 'synthesizing' ? '🔗' : '✅'} {p}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}

      {error && <div className="text-red-400 text-sm mb-3 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">❌ {error}</div>}

      {/* Agent cards */}
      {agents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {agents.map(agent => (
            <div key={agent.id} className={`bg-slate-800/40 border rounded-xl p-4 ${
              agent.status === 'RUNNING' ? 'border-amber-500/50' :
              agent.status === 'DONE' ? 'border-emerald-500/30' :
              agent.status === 'ERROR' ? 'border-red-500/30' :
              'border-slate-700/50'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  agent.status === 'DONE' ? 'bg-emerald-500/20 text-emerald-400' :
                  agent.status === 'RUNNING' ? 'bg-amber-500/20 text-amber-400' :
                  agent.status === 'ERROR' ? 'bg-red-500/20 text-red-400' :
                  'bg-slate-600/30 text-slate-400'
                }`}>{agent.status}</span>
                <span className="text-sm font-medium text-white">{agent.id}</span>
              </div>
              <div className="text-xs text-violet-400 font-medium mb-1">{agent.role}</div>
              <div className="text-xs text-slate-400 mb-2">{agent.task}</div>
              {agent.depends_on.length > 0 && (
                <div className="text-xs text-slate-500">Depends on: {agent.depends_on.join(', ')}</div>
              )}
              {agent.output && (
                <details className="mt-2">
                  <summary className="text-xs text-violet-400 cursor-pointer hover:text-violet-300">View output</summary>
                  <div className="mt-2 text-xs max-h-40 overflow-y-auto custom-scrollbar">
                    <SimpleMarkdown content={agent.output} />
                  </div>
                </details>
              )}
              {agent.error && <div className="mt-2 text-xs text-red-400">{agent.error}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Synthesized result */}
      {synthesized && (
        <div className="bg-slate-800/40 border border-emerald-500/30 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-emerald-400">🔗 Synthesized Result</h3>
            <button onClick={() => navigator.clipboard.writeText(synthesized)} className="text-xs text-slate-500 hover:text-violet-400">📋 Copy</button>
          </div>
          <SimpleMarkdown content={synthesized} />
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">Execution Log ({log.length})</summary>
          <div className="mt-2 bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 max-h-48 overflow-y-auto custom-scrollbar">
            {log.map((l, i) => <div key={i} className="text-xs text-slate-400 font-mono">{l}</div>)}
          </div>
        </details>
      )}

      {agents.length === 0 && phase === 'idle' && (
        <div className="text-center text-slate-500 py-12">
          <div className="text-3xl mb-2">🤖</div>
          <p>Define a goal and let AI orchestrate sub-agents to solve it</p>
        </div>
      )}
    </div>
  );
}

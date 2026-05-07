import React, { useState, useCallback, useRef } from 'react';
import ModelSelector from '../components/ModelSelector';
import { MODEL_MAP, callAI, ModelEntry } from '../lib/models';
import { SimpleMarkdown } from '../lib/markdown';

interface Step {
  id: number;
  title: string;
  status: 'pending' | 'running' | 'done' | 'error';
  output?: string;
}

export default function PersonaAgent() {
  const [plannerModelId, setPlannerModelId] = useState('gemini-2.5-pro');
  const [executorModelId, setExecutorModelId] = useState('gpt-5.5-thinking');
  const [reviewerModelId, setReviewerModelId] = useState('claude-opus-4.7');
  const [task, setTask] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [plan, setPlan] = useState('');
  const [finalReport, setFinalReport] = useState('');
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'planning' | 'executing' | 'reviewing' | 'done'>('idle');
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState('');
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
      try { parts.push(`--- File: ${f.name} ---\n${(await f.text()).slice(0, 3000)}`); } catch {}
    }
    return parts.join('\n\n');
  };

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const reset = () => {
    setSteps([]);
    setPlan('');
    setFinalReport('');
    setPhase('idle');
    setLog([]);
    setError('');
    setFiles([]);
  };

  const run = useCallback(async () => {
    if (!task.trim()) return;
    setRunning(true);
    setError('');
    setSteps([]);
    setPlan('');
    setFinalReport('');
    setLog([]);
    setPhase('planning');
    addLog('🚀 Starting Persona Agent pipeline');

    const planner = plannerModelId ? MODEL_MAP[plannerModelId] ?? null : null;
    const executor = executorModelId ? MODEL_MAP[executorModelId] ?? null : null;
    const reviewer = reviewerModelId ? MODEL_MAP[reviewerModelId] ?? null : null;
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const fileContent = await readFileContents();

      // Stage 1: Planning
      addLog('📋 Planner creating step-by-step plan...');
      const planRes = await callAI(
        [
          { role: 'system', content: 'You are a strategic planner. Break the given task into clear, actionable steps. Output as a numbered list of steps, each with a brief title and description. Format:\n1. **Title** - Description\n2. **Title** - Description\n...' },
          { role: 'user', content: `Task: ${task}${fileContent ? `\n\nContext:\n${fileContent}` : ''}\n\nCreate a step-by-step plan:` },
        ],
        ac.signal,
        planner
      );
      setPlan(planRes.content);
      addLog(`✅ Plan created (${planRes.provider})`);

      // Parse steps from plan
      const stepLines = planRes.content.split('\n').filter(l => /^\d+\./.test(l.trim()));
      const parsedSteps: Step[] = stepLines.map((line, i) => ({
        id: i,
        title: line.replace(/^\d+\.\s*/, '').trim().slice(0, 80),
        status: 'pending' as const,
      }));

      if (parsedSteps.length === 0) {
        // Fallback: use whole plan as single step
        parsedSteps.push({ id: 0, title: 'Execute the plan', status: 'pending' });
      }
      setSteps(parsedSteps);

      // Stage 2: Execution
      setPhase('executing');
      const stepOutputs: string[] = [];

      for (let i = 0; i < parsedSteps.length; i++) {
        if (ac.signal.aborted) throw new DOMException('Aborted', 'AbortError');

        addLog(`⚙️ Executing step ${i + 1}: ${parsedSteps[i].title}`);
        setSteps(prev => prev.map(s => s.id === i ? { ...s, status: 'running' } : s));

        const previousContext = stepOutputs.length > 0
          ? `\n\nPrevious step outputs:\n${stepOutputs.map((o, j) => `Step ${j + 1}: ${o.slice(0, 300)}`).join('\n')}`
          : '';

        const execRes = await callAI(
          [
            { role: 'system', content: 'You are an execution agent. Execute the given step thoroughly and produce detailed output. Be specific, actionable, and comprehensive.' },
            { role: 'user', content: `Original task: ${task}\n\nPlan:\n${planRes.content}\n\nCurrent step: ${parsedSteps[i].title}${previousContext}${fileContent ? `\n\nContext:\n${fileContent}` : ''}\n\nExecute this step now:` },
          ],
          ac.signal,
          executor
        );

        stepOutputs.push(execRes.content);
        setSteps(prev => prev.map(s => s.id === i ? { ...s, status: 'done', output: execRes.content } : s));
        addLog(`✅ Step ${i + 1} complete (${execRes.provider})`);
      }

      // Stage 3: Review
      setPhase('reviewing');
      addLog('🔍 Reviewer merging into final report...');
      const allOutputs = stepOutputs.map((o, i) => `### Step ${i + 1}: ${parsedSteps[i].title}\n${o}`).join('\n\n---\n\n');

      const reviewRes = await callAI(
        [
          { role: 'system', content: 'You are a senior reviewer. Merge the step-by-step execution outputs into a coherent, polished final report. Remove redundancy, ensure flow, add insights, and present a comprehensive answer.' },
          { role: 'user', content: `Original task: ${task}\n\nStep-by-step outputs:\n${allOutputs}${fileContent ? `\n\nContext:\n${fileContent}` : ''}\n\nProduce the final merged report:` },
        ],
        ac.signal,
        reviewer
      );

      setFinalReport(reviewRes.content);
      setPhase('done');
      addLog('🏁 Persona Agent pipeline complete');

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
  }, [task, plannerModelId, executorModelId, reviewerModelId, files, addLog]);

  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const copyReport = () => navigator.clipboard.writeText(finalReport);
  const exportReport = () => {
    const blob = new Blob([`# Persona Agent Report\n${finalReport}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'persona-agent-report.md'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-1">⭐ Persona Agent</h1>
      <p className="text-sm text-slate-400 mb-6">3-stage pipeline: Planner → Executor → Reviewer (different models)</p>

      {/* Settings */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 mb-4">
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-400 mb-1">Task</label>
          <textarea value={task} onChange={e => setTask(e.target.value)} rows={3} placeholder="Describe your complex task..." className="w-full bg-slate-900/80 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <ModelSelector value={plannerModelId} onChange={setPlannerModelId} label="📋 Planner" />
          <ModelSelector value={executorModelId} onChange={setExecutorModelId} label="⚙️ Executor" />
          <ModelSelector value={reviewerModelId} onChange={setReviewerModelId} label="🔍 Reviewer" />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Attach Files</label>
            <input type="file" multiple onChange={handleFiles} className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-violet-600 file:text-white hover:file:bg-violet-500" />
          </div>
          <div className="flex gap-2 ml-auto">
            {!running ? (
              <button onClick={run} disabled={!task.trim()} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-colors">▶ Run</button>
            ) : (
              <button onClick={stop} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors">⏹ Stop</button>
            )}
            <button onClick={copyReport} disabled={!finalReport} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-sm transition-colors">📋</button>
            <button onClick={exportReport} disabled={!finalReport} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-sm transition-colors">📥</button>
            <button onClick={reset} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">Reset</button>
          </div>
        </div>
      </div>

      {/* Phase indicator */}
      {phase !== 'idle' && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          {(['planning', 'executing', 'reviewing', 'done'] as const).map((p, i) => (
            <React.Fragment key={p}>
              {i > 0 && <span className="text-slate-600">→</span>}
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                phase === p ? 'bg-violet-600/30 text-violet-300' :
                ['planning', 'executing', 'reviewing', 'done'].indexOf(phase) > i ? 'bg-emerald-500/20 text-emerald-400' :
                'bg-slate-700/30 text-slate-500'
              }`}>
                {p === 'planning' ? '📋' : p === 'executing' ? '⚙️' : p === 'reviewing' ? '🔍' : '✅'} {p}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}

      {error && <div className="text-red-400 text-sm mb-3 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">❌ {error}</div>}

      {/* Plan */}
      {plan && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 mb-4">
          <h3 className="text-sm font-bold text-violet-400 mb-2">📋 Plan</h3>
          <SimpleMarkdown content={plan} />
        </div>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <div className="space-y-2 mb-4">
          {steps.map(step => (
            <div key={step.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step.status === 'done' ? 'bg-emerald-500/20 text-emerald-400' :
                  step.status === 'running' ? 'bg-amber-500/20 text-amber-400 animate-pulse' :
                  step.status === 'error' ? 'bg-red-500/20 text-red-400' :
                  'bg-slate-600/30 text-slate-400'
                }`}>
                  {step.status === 'done' ? '✓' : step.status === 'running' ? '⟳' : step.status === 'error' ? '✗' : step.id + 1}
                </span>
                <span className="flex-1 text-sm text-slate-200">{step.title}</span>
                {step.output && <span className="text-xs text-slate-500">{expandedStep === step.id ? '▲' : '▼'}</span>}
              </div>
              {step.output && expandedStep === step.id && (
                <div className="mt-3 ml-9 text-sm border-t border-slate-700/50 pt-3">
                  <SimpleMarkdown content={step.output} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Final report */}
      {finalReport && (
        <div className="bg-slate-800/40 border border-emerald-500/30 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-emerald-400">🔍 Final Report</h3>
            <div className="flex gap-2">
              <button onClick={copyReport} className="text-xs text-slate-500 hover:text-violet-400">📋 Copy</button>
              <button onClick={exportReport} className="text-xs text-slate-500 hover:text-violet-400">📥 Export</button>
            </div>
          </div>
          <SimpleMarkdown content={finalReport} />
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

      {steps.length === 0 && phase === 'idle' && (
        <div className="text-center text-slate-500 py-12">
          <div className="text-3xl mb-2">⭐</div>
          <p>3-model pipeline for complex tasks</p>
        </div>
      )}
    </div>
  );
}

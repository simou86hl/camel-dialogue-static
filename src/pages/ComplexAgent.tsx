import React, { useState, useCallback, useRef } from 'react';
import ModelSelector from '../components/ModelSelector';
import { MODEL_MAP, callAI, ModelEntry } from '../lib/models';
import { SimpleMarkdown } from '../lib/markdown';

interface PlanStep {
  id: string;
  title: string;
  detail: string;
  destructive: boolean;
  dependencies: string[];
}

interface StepState {
  status: 'pending' | 'awaiting_approval' | 'running' | 'done' | 'error' | 'skipped';
  output?: string;
}

export default function ComplexAgent() {
  const [modelId, setModelId] = useState('claude-cowork');
  const [goal, setGoal] = useState('');
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([]);
  const [stepStates, setStepStates] = useState<Record<string, StepState>>({});
  const [restatedGoal, setRestatedGoal] = useState('');
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [clarifyingQ, setClarifyingQ] = useState('');
  const [planning, setPlanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const addLog = useCallback((msg: string) => {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const getModel = (): ModelEntry | null => modelId ? MODEL_MAP[modelId] ?? null : null;

  // Plan the goal
  const makePlan = useCallback(async () => {
    if (!goal.trim()) return;
    setPlanning(true);
    setError('');
    setPlanSteps([]);
    setStepStates({});
    setRestatedGoal('');
    setAssumptions([]);
    setClarifyingQ('');
    addLog('📋 Creating plan...');

    const model = getModel();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await callAI(
        [
          { role: 'system', content: `You are Claude Cowork by Anthropic, a collaborative planning agent. Given a goal, create a structured execution plan.

Output ONLY valid JSON in this exact format (no markdown fences, no other text):
{
  "restated_goal": "Clear restatement of the goal",
  "assumptions": ["Assumption 1", "Assumption 2"],
  "clarifying_question": "Optional question if goal is ambiguous, or empty string",
  "steps": [
    {
      "id": "step1",
      "title": "Brief step title",
      "detail": "Detailed description of what to do",
      "destructive": false,
      "dependencies": []
    }
  ]
}

Rules:
- Maximum 8 steps
- destructive=true ONLY if the step modifies/deletes data or makes irreversible changes
- dependencies list step IDs that must complete first
- Be specific and actionable` },
          { role: 'user', content: `Goal: ${goal}\n\nCreate a structured plan:` },
        ],
        ac.signal,
        model
      );

      // Parse the plan
      let parsed: any = null;
      try {
        const jsonStr = res.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        const match = jsonStr.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      } catch {}

      if (!parsed || !parsed.steps?.length) {
        throw new Error('Failed to parse plan. AI output: ' + res.content.slice(0, 200));
      }

      setRestatedGoal(parsed.restated_goal || goal);
      setAssumptions(parsed.assumptions || []);
      setClarifyingQ(parsed.clarifying_question || '');
      setPlanSteps(parsed.steps.slice(0, 8));
      setStepStates(Object.fromEntries(parsed.steps.slice(0, 8).map((s: PlanStep) => [s.id, { status: 'pending' as const }])));
      addLog(`✅ Plan created with ${parsed.steps.length} steps`);

    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message);
        addLog(`❌ Planning error: ${e.message}`);
      }
    } finally {
      setPlanning(false);
    }
  }, [goal, modelId, addLog]);

  // Execute a single step
  const executeStep = useCallback(async (stepId: string) => {
    const step = planSteps.find(s => s.id === stepId);
    if (!step) return;

    setStepStates(prev => ({ ...prev, [stepId]: { status: 'running' } }));
    addLog(`⚙️ Running: ${step.title}`);

    const model = getModel();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      // Check dependencies are done
      const depsDone = step.dependencies.every(depId => stepStates[depId]?.status === 'done');
      const depContext = step.dependencies
        .map(depId => `Output from ${depId}:\n${stepStates[depId]?.output || 'N/A'}`)
        .join('\n\n');

      const res = await callAI(
        [
          { role: 'system', content: 'You are Claude Code 2.1 by Anthropic, a specialized execution agent. Execute the given step precisely and thoroughly. Produce concrete, actionable output.' },
          { role: 'user', content: `Goal: ${goal}\n\nStep: ${step.title}\nDetail: ${step.detail}${depContext ? `\n\nDependency outputs:\n${depContext}` : ''}\n\nExecute this step now:` },
        ],
        ac.signal,
        model
      );

      setStepStates(prev => ({ ...prev, [stepId]: { status: 'done', output: res.content } }));
      addLog(`✅ Done: ${step.title} (${res.provider})`);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setStepStates(prev => ({ ...prev, [stepId]: { status: 'pending' } }));
      } else {
        setStepStates(prev => ({ ...prev, [stepId]: { status: 'error', output: e.message } }));
        addLog(`❌ Error in ${step.title}: ${e.message}`);
      }
    }
  }, [planSteps, stepStates, goal, modelId, addLog]);

  // Run all steps sequentially
  const runAll = useCallback(async () => {
    setRunning(true);
    setError('');

    for (const step of planSteps) {
      if (abortRef.current?.signal.aborted) break;

      // Check dependencies
      const depsOk = step.dependencies.every(d => stepStates[d]?.status === 'done');
      if (!depsOk) {
        setStepStates(prev => ({ ...prev, [step.id]: { status: 'skipped' } }));
        addLog(`⏭️ Skipped: ${step.title} (unmet dependencies)`);
        continue;
      }

      // Destructive steps need approval
      if (step.destructive) {
        const state = stepStates[step.id];
        if (state?.status !== 'done') {
          setStepStates(prev => ({ ...prev, [step.id]: { status: 'awaiting_approval' } }));
          addLog(`⚠️ Awaiting approval: ${step.title}`);
          break; // Stop and wait for approval
        }
        continue;
      }

      await executeStep(step.id);

      // Re-check after execution
      const newState = await new Promise<StepState>(resolve => {
        setStepStates(prev => {
          resolve(prev[step.id]);
          return prev;
        });
      });
      if (newState.status !== 'done') break;
    }

    setRunning(false);
  }, [planSteps, stepStates, executeStep, addLog]);

  const approveAndRun = useCallback(async (stepId: string) => {
    await executeStep(stepId);
  }, [executeStep]);

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const reset = () => {
    setPlanSteps([]);
    setStepStates({});
    setRestatedGoal('');
    setAssumptions([]);
    setClarifyingQ('');
    setLog([]);
    setError('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-1">🧩 Complex Agent</h1>
      <p className="text-sm text-slate-400 mb-6">Plan → Execute pipeline with approval gates</p>

      {/* Settings */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 mb-4">
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-400 mb-1">Goal</label>
          <textarea value={goal} onChange={e => setGoal(e.target.value)} rows={3} placeholder="Describe what you want to accomplish..." className="w-full bg-slate-900/80 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
          <ModelSelector value={modelId} onChange={setModelId} label="Model" />
          <button onClick={makePlan} disabled={planning || !goal.trim()} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-colors">
            {planning ? '⏳ Planning...' : '📋 Plan'}
          </button>
          {planSteps.length > 0 && (
            <button onClick={runAll} disabled={running} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 rounded-lg text-sm font-medium transition-colors">
              {running ? '⏳ Running...' : '▶ Run All'}
            </button>
          )}
        </div>
        {running && (
          <div className="mt-3">
            <button onClick={stop} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors">⏹ Stop</button>
          </div>
        )}
      </div>

      {error && <div className="text-red-400 text-sm mb-3 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">❌ {error}</div>}

      {/* Plan overview */}
      {restatedGoal && (
        <div className="bg-slate-800/40 border border-amber-500/30 rounded-2xl p-4 mb-4">
          <h3 className="text-sm font-bold text-amber-400 mb-2">📋 Plan Overview</h3>
          <p className="text-sm text-slate-300 mb-2"><strong>Goal:</strong> {restatedGoal}</p>
          {assumptions.length > 0 && (
            <div className="mb-2">
              <span className="text-xs text-slate-400">Assumptions:</span>
              <ul className="list-disc list-inside text-xs text-slate-400">
                {assumptions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}
          {clarifyingQ && (
            <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2 text-xs text-amber-300">
              ❓ {clarifyingQ}
            </div>
          )}
        </div>
      )}

      {/* Step cards */}
      {planSteps.length > 0 && (
        <div className="space-y-2 mb-4">
          {planSteps.map(step => {
            const state = stepStates[step.id] || { status: 'pending' };
            return (
              <div key={step.id} className={`bg-slate-800/40 border rounded-xl p-4 ${
                state.status === 'running' ? 'border-amber-500/50' :
                state.status === 'done' ? 'border-emerald-500/30' :
                state.status === 'awaiting_approval' ? 'border-red-500/50' :
                state.status === 'error' ? 'border-red-500/30' :
                state.status === 'skipped' ? 'border-slate-700/30 opacity-50' :
                'border-slate-700/50'
              }`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 ${
                    state.status === 'done' ? 'bg-emerald-500/20 text-emerald-400' :
                    state.status === 'running' ? 'bg-amber-500/20 text-amber-400 animate-pulse' :
                    state.status === 'awaiting_approval' ? 'bg-red-500/20 text-red-400' :
                    state.status === 'error' ? 'bg-red-500/20 text-red-400' :
                    state.status === 'skipped' ? 'bg-slate-600/20 text-slate-500' :
                    'bg-slate-600/30 text-slate-400'
                  }`}>
                    {state.status === 'done' ? '✓' : state.status === 'running' ? '⟳' : state.status === 'awaiting_approval' ? '⚠' : state.status === 'error' ? '✗' : '○'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{step.title}</span>
                      {step.destructive && <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/20 text-red-400 font-bold">DESTRUCTIVE</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{step.detail}</p>
                    {step.dependencies.length > 0 && (
                      <div className="text-xs text-slate-500 mt-1">Depends on: {step.dependencies.join(', ')}</div>
                    )}
                    {state.output && (
                      <details className="mt-2" open={state.status === 'done' || state.status === 'error'}>
                        <summary className="text-xs text-violet-400 cursor-pointer hover:text-violet-300">View output</summary>
                        <div className="mt-2 text-sm max-h-60 overflow-y-auto custom-scrollbar border-t border-slate-700/50 pt-2">
                          <SimpleMarkdown content={state.output} />
                        </div>
                      </details>
                    )}
                    <div className="flex gap-2 mt-2">
                      {state.status === 'pending' && (
                        <button onClick={() => executeStep(step.id)} className="px-3 py-1 bg-violet-600 hover:bg-violet-500 rounded text-xs font-medium transition-colors">▶ Run</button>
                      )}
                      {state.status === 'awaiting_approval' && (
                        <button onClick={() => approveAndRun(step.id)} className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-xs font-medium transition-colors">⚠️ Approve & Run</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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

      {planSteps.length === 0 && !planning && (
        <div className="text-center text-slate-500 py-12">
          <div className="text-3xl mb-2">🧩</div>
          <p>Describe your goal and click Plan to begin</p>
        </div>
      )}
    </div>
  );
}

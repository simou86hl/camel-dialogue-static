import React, { useState, useCallback, useRef } from 'react';
import ModelSelector from '../components/ModelSelector';
import { MODEL_MAP, callAI, ModelEntry } from '../lib/models';
import { SimpleMarkdown } from '../lib/markdown';

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'done';
  result?: string;
}

export default function BabyAGI() {
  const [modelId, setModelId] = useState('');
  const [objective, setObjective] = useState('');
  const [firstTask, setFirstTask] = useState('');
  const [maxIter, setMaxIter] = useState(5);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [running, setRunning] = useState(false);
  const [iteration, setIteration] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const getModel = useCallback((): ModelEntry | null => {
    return modelId ? MODEL_MAP[modelId] ?? null : null;
  }, [modelId]);

  const addLog = useCallback((msg: string) => {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  const clear = useCallback(() => {
    setTasks([]);
    setLog([]);
    setIteration(0);
    setError('');
  }, []);

  const run = useCallback(async () => {
    if (!objective.trim() || !firstTask.trim()) return;
    setRunning(true);
    setError('');
    clear();

    const model = getModel();
    const initialTasks: Task[] = [{ id: '1', title: firstTask.trim(), status: 'pending' }];
    setTasks([...initialTasks]);
    addLog('🚀 BabyAGI started');

    for (let iter = 0; iter < maxIter; iter++) {
      const ac = new AbortController();
      abortRef.current = ac;

      // Find next pending task
      const currentTasks = await new Promise<Task[]>(resolve => {
        setTasks(prev => {
          resolve(prev);
          return prev;
        });
      });

      const pendingIdx = currentTasks.findIndex(t => t.status === 'pending');
      if (pendingIdx === -1) {
        addLog('✅ All tasks completed');
        break;
      }

      setIteration(iter + 1);
      addLog(`📋 Iteration ${iter + 1}: "${currentTasks[pendingIdx].title}"`);

      // Mark running
      setTasks(prev => prev.map((t, i) => i === pendingIdx ? { ...t, status: 'running' } : t));

      try {
        // 1. Execution Agent
        addLog('⚙️ Execution Agent running...');
        const execRes = await callAI(
          [
            { role: 'system', content: 'You are an execution agent. Perform the given task concisely and produce concrete output (~300 words). Be specific and actionable.' },
            { role: 'user', content: `Objective: ${objective}\n\nTask: ${currentTasks[pendingIdx].title}\n\nPerform this task now:` },
          ],
          ac.signal,
          model
        );
        addLog(`✅ Execution complete (${execRes.provider})`);

        // Mark done with result
        setTasks(prev => prev.map((t, i) => i === pendingIdx ? { ...t, status: 'done', result: execRes.content } : t));

        // 2. Task Creation Agent
        addLog('📝 Task Creation Agent running...');
        const updatedTasks = await new Promise<Task[]>(resolve => {
          setTasks(prev => { resolve(prev); return prev; });
        });
        const doneTasks = updatedTasks.filter(t => t.status === 'done');
        const pendingTasks = updatedTasks.filter(t => t.status === 'pending');

        const createRes = await callAI(
          [
            { role: 'system', content: 'You are a task creation agent. Given an objective and the last completed result, propose 1-3 new subtasks as a JSON array of strings. Only output the JSON array, nothing else. Example: ["Task 1", "Task 2"]' },
            { role: 'user', content: `Objective: ${objective}\nCompleted tasks: ${doneTasks.map(t => t.title).join('; ')}\nLast result: ${execRes.content.slice(0, 500)}\nPending tasks: ${pendingTasks.map(t => t.title).join('; ') || 'None'}\n\nPropose 1-3 new tasks:` },
          ],
          ac.signal,
          model
        );

        // Parse new tasks
        let newTaskTitles: string[] = [];
        try {
          const match = createRes.content.match(/\[[\s\S]*\]/);
          if (match) newTaskTitles = JSON.parse(match[0]);
        } catch {}
        if (!newTaskTitles.length) {
          // Fallback: split by newlines
          newTaskTitles = createRes.content.split('\n').filter(l => l.trim()).slice(0, 3);
        }

        // Add new tasks
        const nextId = String(updatedTasks.length + 1);
        const newTasks: Task[] = newTaskTitles.map((t, i) => ({
          id: `${nextId}-${i}`,
          title: t.replace(/^["\d.)\s]+/, '').replace(/["]$/, '').trim(),
          status: 'pending' as const,
        })).filter(t => t.title.length > 0);

        setTasks(prev => [...prev, ...newTasks]);
        addLog(`📝 Created ${newTasks.length} new task(s)`);

        // 3. Prioritization Agent
        addLog('🔄 Prioritization Agent running...');
        const allTasksNow = await new Promise<Task[]>(resolve => {
          setTasks(prev => { resolve(prev); return prev; });
        });
        const stillPending = allTasksNow.filter(t => t.status === 'pending');

        if (stillPending.length > 1) {
          const prioRes = await callAI(
            [
              { role: 'system', content: 'You are a task prioritization agent. Given a list of pending tasks and an objective, reorder them by importance. Output ONLY a JSON array of task titles in priority order (most important first). Example: ["Most important task", "Less important task"]' },
              { role: 'user', content: `Objective: ${objective}\nPending tasks: ${stillPending.map(t => t.title).join('\n')}\n\nReorder by importance:` },
            ],
            ac.signal,
            model
          );

          try {
            const match = prioRes.content.match(/\[[\s\S]*\]/);
            if (match) {
              const ordered: string[] = JSON.parse(match[0]);
              setTasks(prev => {
                const done = prev.filter(t => t.status !== 'pending');
                const pending = prev.filter(t => t.status === 'pending');
                const sorted = [...pending].sort((a, b) => {
                  const aIdx = ordered.findIndex((o: string) => o.includes(a.title.slice(0, 20)) || a.title.includes(o.slice(0, 20)));
                  const bIdx = ordered.findIndex((o: string) => o.includes(b.title.slice(0, 20)) || b.title.includes(o.slice(0, 20)));
                  return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
                });
                return [...done, ...sorted];
              });
              addLog('🔄 Tasks reprioritized');
            }
          } catch {}
        }
      } catch (e: any) {
        if (e.name === 'AbortError') {
          addLog('⏹️ Stopped by user');
          break;
        }
        setError(e.message);
        addLog(`❌ Error: ${e.message}`);
        // Mark task back to pending on error
        setTasks(prev => prev.map(t => t.status === 'running' ? { ...t, status: 'pending' } : t));
        break;
      }
    }

    setRunning(false);
    addLog('🏁 BabyAGI finished');
  }, [objective, firstTask, maxIter, getModel, addLog, clear]);

  const copyAll = () => {
    const text = tasks.map(t => `[${t.status.toUpperCase()}] ${t.title}${t.result ? '\n' + t.result : ''}`).join('\n\n---\n\n');
    navigator.clipboard.writeText(text);
  };

  const exportAll = () => {
    const text = `# BabyAGI Report\nObjective: ${objective}\n\n` + tasks.map(t => `## [${t.status.toUpperCase()}] ${t.title}${t.result ? '\n\n' + t.result : ''}`).join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'babyagi-report.md'; a.click();
    URL.revokeObjectURL(url);
  };

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-1">👶 BabyAGI Loop</h1>
      <p className="text-sm text-slate-400 mb-6">Autonomous task loop: Execute → Create → Prioritize → Repeat</p>

      {/* Settings */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Objective</label>
            <input value={objective} onChange={e => setObjective(e.target.value)} placeholder="e.g. Research and plan a content marketing strategy" className="w-full bg-slate-900/80 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">First Task</label>
            <input value={firstTask} onChange={e => setFirstTask(e.target.value)} placeholder="e.g. Identify target audience segments" className="w-full bg-slate-900/80 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <ModelSelector value={modelId} onChange={setModelId} label="AI Model" />
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Max Iterations</label>
            <input type="number" min={1} max={15} value={maxIter} onChange={e => setMaxIter(Number(e.target.value))} className="w-full bg-slate-900/80 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500" />
          </div>
          <div className="flex items-end gap-2">
            {!running ? (
              <button onClick={run} disabled={!objective.trim() || !firstTask.trim()} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-colors">▶ Start</button>
            ) : (
              <button onClick={stop} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors">⏹ Stop</button>
            )}
            <button onClick={clear} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">Clear</button>
          </div>
        </div>
      </div>

      {error && <div className="text-red-400 text-sm mb-3 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">❌ {error}</div>}

      {/* Iteration info */}
      {iteration > 0 && (
        <div className="flex items-center gap-4 mb-3 text-sm text-slate-400">
          <span>Iteration: <span className="text-white font-medium">{iteration}/{maxIter}</span></span>
          <span>Tasks: <span className="text-white font-medium">{tasks.filter(t => t.status === 'done').length}/{tasks.length} done</span></span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Task list */}
        <div className="lg:col-span-2">
          <div className="space-y-2">
            {tasks.map(task => (
              <div key={task.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
                <div className="flex items-start gap-3 cursor-pointer" onClick={() => toggleExpand(task.id)}>
                  <span className={`mt-0.5 px-2 py-0.5 rounded text-xs font-bold ${
                    task.status === 'done' ? 'bg-emerald-500/20 text-emerald-400' :
                    task.status === 'running' ? 'bg-amber-500/20 text-amber-400 animate-pulse' :
                    'bg-slate-600/30 text-slate-400'
                  }`}>
                    {task.status === 'done' ? '✓' : task.status === 'running' ? '⟳' : '○'} {task.status.toUpperCase()}
                  </span>
                  <span className="flex-1 text-sm text-slate-200">{task.title}</span>
                  {task.result && <span className="text-xs text-slate-500">{expanded.has(task.id) ? '▲' : '▼'}</span>}
                </div>
                {task.result && expanded.has(task.id) && (
                  <div className="mt-3 ml-9 text-sm border-t border-slate-700/50 pt-3">
                    <SimpleMarkdown content={task.result} />
                  </div>
                )}
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="text-center text-slate-500 py-12">
                <div className="text-3xl mb-2">👶</div>
                <p>Set an objective and first task to begin</p>
              </div>
            )}
          </div>
        </div>

        {/* Log */}
        <div>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase">Log</span>
              <div className="flex gap-1">
                <button onClick={copyAll} className="text-xs text-slate-500 hover:text-violet-400 px-2 py-1 rounded hover:bg-slate-700 transition-colors">📋 Copy</button>
                <button onClick={exportAll} className="text-xs text-slate-500 hover:text-violet-400 px-2 py-1 rounded hover:bg-slate-700 transition-colors">📥 Export</button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-1">
              {log.map((l, i) => (
                <div key={i} className="text-xs text-slate-400 font-mono">{l}</div>
              ))}
              {log.length === 0 && <div className="text-xs text-slate-600 text-center py-4">No logs yet</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

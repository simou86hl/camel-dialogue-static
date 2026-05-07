import React, { useState } from 'react';
import { MODELS_BY_COMPANY, ModelEntry } from '../lib/models';

interface Props {
  value: string;
  onChange: (id: string) => void;
  label?: string;
}

export default function ModelSelector({ value, onChange, label = 'Model' }: Props) {
  const [open, setOpen] = useState(false);
  const selected = value ? null : null; // just for clarity

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="relative">
      {label && <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 bg-slate-800/80 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 hover:border-violet-500 transition-colors"
      >
        <span className="truncate">{value || 'Auto (fallback)'}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto bg-slate-800 border border-slate-600 rounded-lg shadow-2xl custom-scrollbar">
          <button
            onClick={() => handleSelect('')}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700 transition-colors ${!value ? 'bg-violet-600/20 text-violet-300' : 'text-slate-300'}`}
          >
            🔄 Auto (fallback)
          </button>
          {Object.entries(MODELS_BY_COMPANY).map(([company, models]) => (
            <div key={company}>
              <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-900/50">
                {company}
              </div>
              {models.map((m: ModelEntry) => (
                <button
                  key={m.id}
                  onClick={() => handleSelect(m.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700 transition-colors flex items-center gap-2 ${value === m.id ? 'bg-violet-600/20 text-violet-300' : 'text-slate-300'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${m.color} flex-shrink-0`} />
                  {m.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

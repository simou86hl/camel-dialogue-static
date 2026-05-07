import React from 'react';

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInline(text: string): string {
  // Code
  text = text.replace(/`([^`]+)`/g, '<code class="bg-slate-700 px-1.5 py-0.5 rounded text-emerald-400 text-sm">$1</code>');
  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  // Italic
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  return text;
}

export function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split('\n');
  const html: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = '';

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        const escaped = escapeHtml(codeLines.join('\n'));
        html.push(`<pre class="bg-slate-800 border border-slate-600 rounded-lg p-3 my-2 overflow-x-auto text-sm"><code class="text-emerald-400">${escaped}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        codeLang = line.slice(3).trim();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) { codeLines.push(line); continue; }

    // Headings
    if (line.startsWith('### ')) {
      html.push(`<h3 class="text-lg font-bold text-white mt-4 mb-2">${renderInline(line.slice(4))}</h3>`);
    } else if (line.startsWith('## ')) {
      html.push(`<h2 class="text-xl font-bold text-white mt-5 mb-2">${renderInline(line.slice(3))}</h2>`);
    } else if (line.startsWith('# ')) {
      html.push(`<h1 class="text-2xl font-bold text-white mt-6 mb-3">${renderInline(line.slice(2))}</h1>`);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      html.push(`<div class="flex gap-2 ml-2 my-0.5"><span class="text-violet-400 mt-0.5">•</span><span>${renderInline(line.slice(2))}</span></div>`);
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s/)?.[1] ?? '1';
      html.push(`<div class="flex gap-2 ml-2 my-0.5"><span class="text-violet-400 font-mono text-sm">${num}.</span><span>${renderInline(line.replace(/^\d+\.\s/, ''))}</span></div>`);
    } else if (line.trim() === '') {
      html.push('<div class="h-2"></div>');
    } else {
      html.push(`<p class="my-1 leading-relaxed">${renderInline(line)}</p>`);
    }
  }

  if (inCodeBlock) {
    const escaped = escapeHtml(codeLines.join('\n'));
    html.push(`<pre class="bg-slate-800 border border-slate-600 rounded-lg p-3 my-2 overflow-x-auto text-sm"><code class="text-emerald-400">${escaped}</code></pre>`);
  }

  return (
    <div className="text-slate-300 prose-sm" dangerouslySetInnerHTML={{ __html: html.join('') }} />
  );
}

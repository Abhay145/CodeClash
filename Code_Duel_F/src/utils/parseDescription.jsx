import React from 'react';

export function parseProblemDescription(text) {
  if (!text) return null;
  
  // Normalize newline escape characters
  const normalized = String(text).replace(/\\n/g, '\n');
  
  // Split by code blocks (fenced with ```) and inline code (fenced with `)
  const parts = normalized.split(/(```[\s\S]*?```|`[^`\n]+`)/g);

  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const content = part.slice(3, -3);
      const firstNewline = content.indexOf('\n');
      let lang = '';
      let code = content;
      
      if (firstNewline !== -1) {
        const potentialLang = content.slice(0, firstNewline).trim();
        if (potentialLang && potentialLang.length < 10) {
          lang = potentialLang;
          code = content.slice(firstNewline + 1);
        }
      }
      
      return (
        <div key={index} className="my-3.5 border border-white/[0.06] bg-[#070913]/90 rounded-xl overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between px-3.5 py-2 bg-white/[0.02] border-b border-white/[0.04]">
            <span className="text-[0.6rem] font-bold text-white/30 uppercase tracking-widest">{lang || 'Code'}</span>
            <div className="flex gap-1.5 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff5f56]/80" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffbd2e]/80" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#27c93f]/80" />
            </div>
          </div>
          <pre className="p-4 overflow-x-auto text-[0.78rem] leading-relaxed text-[#00E5FF] font-mono select-text whitespace-pre">
            <code>{code.trim()}</code>
          </pre>
        </div>
      );
    } else if (part.startsWith('`') && part.endsWith('`')) {
      const code = part.slice(1, -1);
      return (
        <code 
          key={index} 
          className="px-1.5 py-0.5 mx-0.5 rounded bg-white/[0.07] text-[#00E5FF] text-[0.75rem] font-bold font-mono border border-white/[0.05] shadow-sm select-text"
        >
          {code}
        </code>
      );
    } else {
      // Plain text - preserve newlines with <br /> elements
      const subParts = part.split('\n');
      return subParts.map((subPart, subIdx) => (
        <React.Fragment key={`${index}-${subIdx}`}>
          {subPart}
          {subIdx < subParts.length - 1 && <br />}
        </React.Fragment>
      ));
    }
  });
}

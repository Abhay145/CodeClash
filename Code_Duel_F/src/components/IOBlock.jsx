import React from 'react';

function parseIO(raw) {
  if (!raw) return '';
  return String(raw).replace(/\\n/g, '\n');
}

const formatValue = (val) => {
  if (Array.isArray(val)) {
    if (Array.isArray(val[0])) {
      return `[${val.map(row => `[${row.join(', ')}]`).join(', ')}]`;
    }
    return `[${val.join(', ')}]`;
  }
  if (typeof val === 'object' && val !== null) {
    return JSON.stringify(val);
  }
  return String(val);
};

export default function IOBlock({ value, structuredInput, color = 'text-brand-cyan' }) {
  let structuredRows = null;
  
  if (structuredInput !== undefined && structuredInput !== null) {
    let parsed = structuredInput;
    if (typeof structuredInput === 'string') {
      try {
        parsed = JSON.parse(structuredInput);
      } catch {
        // Not valid JSON
      }
    }

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      structuredRows = Object.entries(parsed).map(([key, val]) => ({
        label: key,
        display: formatValue(val),
      }));
    } else if (Array.isArray(parsed)) {
      structuredRows = [{
        label: 'input',
        display: formatValue(parsed),
      }];
    } else {
      // Check for inline key-value pairs e.g. "nums = [2,7,11,15], target = 9"
      const keyValRegex = /([a-zA-Z0-9_]+)\s*=\s*([^=,]+)(?=\s*,|\s*$)/g;
      const matches = [...String(parsed).matchAll(keyValRegex)];
      if (matches.length > 0) {
        structuredRows = matches.map(m => ({
          label: m[1].trim(),
          display: m[2].trim(),
        }));
      } else {
        structuredRows = [{
          label: 'input',
          display: String(parsed),
        }];
      }
    }
  }

  /* ── Structured Input View ────────────────────────────────────────── */
  if (structuredRows && structuredRows.length > 0) {
    return (
      <div className="font-mono text-[0.78rem] bg-[#070913]/90 border border-white/[0.06] rounded-xl overflow-hidden shadow-inner select-text">
        {structuredRows.map((row, i) => (
          <div
            key={i}
            className={`flex items-baseline ${i % 2 === 0 ? 'bg-white/[0.012]' : ''}`}
          >
            {/* Label gutter */}
            <span 
              className="select-none shrink-0 w-[5rem] text-right pr-3.5 py-2 text-white/30 border-r border-white/[0.05] bg-white/[0.01] font-mono text-[0.68rem] font-bold uppercase tracking-wider leading-5 truncate"
              title={row.label}
            >
              {row.label}
            </span>

            {/* = separator */}
            {row.label && row.display ? (
              <span className="shrink-0 px-2.5 py-2 text-white/15 leading-5 text-[0.68rem] select-none">
                =
              </span>
            ) : (
              <span className="shrink-0 w-6" />
            )}

            {/* Value */}
            <span className={`px-2.5 py-2 leading-5 break-all whitespace-pre-wrap flex-1 font-mono ${color}`}>
              {row.display || '\u00A0'}
            </span>
          </div>
        ))}
      </div>
    );
  }

  /* ── Plain numbered-line view (fallback if structuredInput is not available) ── */
  const lines = parseIO(value).split('\n');

  return (
    <div className="font-mono text-[0.78rem] bg-[#070913]/90 border border-white/[0.06] rounded-xl overflow-hidden shadow-inner select-text">
      {lines.map((line, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'bg-white/[0.012]' : ''}`}>
          <span className="select-none w-7 shrink-0 text-right pr-2.5 py-2 text-white/20 border-r border-white/[0.05] bg-white/[0.01] text-[0.68rem] leading-5">
            {i + 1}
          </span>
          <span className={`px-3.5 py-2 leading-5 break-all whitespace-pre-wrap ${color}`}>
            {line || '\u00A0'}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * LANGUAGES — single source of truth for all supported languages.
 *
 * Used by:
 *  - Monaco editor dropdown (monacoLang)
 *  - Judge0 submission (judge0Id)
 *  - Starter code templates (id → starterTemplates[id])
 *
 * Judge0 language IDs reference:
 *   https://ce.judge0.com/languages (for self-hosted CE edition)
 */

export const LANGUAGES = [
  // ── Web / Scripting ──────────────────────────────────────────
  { id: 'javascript', label: 'JavaScript',  monacoLang: 'javascript', judge0Id: 63  },
  { id: 'typescript', label: 'TypeScript',  monacoLang: 'typescript', judge0Id: 74  },
  { id: 'python',     label: 'Python 3',    monacoLang: 'python',     judge0Id: 71  },
  { id: 'ruby',       label: 'Ruby',        monacoLang: 'ruby',       judge0Id: 72  },
  { id: 'php',        label: 'PHP',         monacoLang: 'php',        judge0Id: 68  },
  { id: 'bash',       label: 'Bash',        monacoLang: 'shell',      judge0Id: 46  },

  // ── Compiled / Systems ───────────────────────────────────────
  { id: 'c',          label: 'C (GCC)',     monacoLang: 'c',          judge0Id: 50  },
  { id: 'cpp',        label: 'C++ 17',      monacoLang: 'cpp',        judge0Id: 54  },
  { id: 'java',       label: 'Java',        monacoLang: 'java',       judge0Id: 62  },
  { id: 'csharp',     label: 'C#',          monacoLang: 'csharp',     judge0Id: 51  },
  { id: 'go',         label: 'Go',          monacoLang: 'go',         judge0Id: 60  },
  { id: 'rust',       label: 'Rust',        monacoLang: 'rust',       judge0Id: 73  },
  { id: 'swift',      label: 'Swift',       monacoLang: 'swift',      judge0Id: 83  },
  { id: 'kotlin',     label: 'Kotlin',      monacoLang: 'kotlin',     judge0Id: 78  },
  { id: 'scala',      label: 'Scala',       monacoLang: 'scala',      judge0Id: 81  },
];

/** Quick lookup: language id → Judge0 ID */
export const JUDGE0_LANG_ID = Object.fromEntries(
  LANGUAGES.map(l => [l.id, l.judge0Id])
);

/** Quick lookup: language id → Monaco language string */
export const MONACO_LANG = Object.fromEntries(
  LANGUAGES.map(l => [l.id, l.monacoLang])
);

/** Default language for new sessions */
export const DEFAULT_LANGUAGE = 'cpp';

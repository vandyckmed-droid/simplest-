import { redact } from './fmp.js';

const warnings = [];

export const log = {
  info: (msg) => console.log(`  ${redact(msg)}`),
  step: (msg) => console.log(`\n▸ ${redact(msg)}`),
  warn: (msg) => {
    const m = redact(msg);
    warnings.push(m);
    console.log(`  ! ${m}`);
  },
  done: (msg) => console.log(`  ✓ ${redact(msg)}`),
  warnings: () => warnings.slice(),
};

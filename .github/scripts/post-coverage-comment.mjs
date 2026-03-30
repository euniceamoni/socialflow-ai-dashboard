import { readFileSync, existsSync } from 'fs';

/** Threshold constants — single source of truth for the comment script.
 *  These mirror jest.config.js coverageThreshold.global and are used only
 *  for the ⚠️ display flag in the PR comment.
 */
export const THRESHOLDS = { lines: 80, statements: 80, functions: 80, branches: 70 };

/**
 * Reads and parses a coverage-summary.json file.
 * Returns the parsed object (or just the `total` key) on success,
 * or null if the file does not exist — never throws.
 *
 * @param {string} filePath - Path to coverage-summary.json
 * @returns {object|null}
 */
export function loadSummary(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  const raw = readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed.total ?? parsed;
}

/**
 * Builds a markdown PR comment body with a table of coverage metrics.
 * Each row is formatted as `pct% (covered/total)`.
 * Appends ⚠️ to any row where pct < threshold.
 *
 * @param {object} summary - The `total` object from coverage-summary.json
 * @param {object} [thresholds] - Threshold map, defaults to THRESHOLDS
 * @returns {string} Markdown comment body
 */
export function formatComment(summary, thresholds = THRESHOLDS) {
  const metrics = ['lines', 'statements', 'functions', 'branches'];

  const rows = metrics.map((metric) => {
    const data = summary[metric];
    const pct = data.pct;
    const covered = data.covered;
    const total = data.total;
    const threshold = thresholds[metric];
    const flag = pct < threshold ? ' ⚠️' : '';
    return `| ${metric} | ${pct}% (${covered}/${total})${flag} | ${threshold}% |`;
  });

  return [
    '## Coverage Report',
    '',
    '| Metric | Coverage | Threshold |',
    '|--------|----------|-----------|',
    ...rows,
  ].join('\n');
}

/**
 * Checks whether all metrics meet their thresholds.
 *
 * @param {object} metrics - The `total` object from coverage-summary.json
 * @param {object} [thresholds] - Threshold map, defaults to THRESHOLDS
 * @returns {{ passed: boolean, violations: string[] }}
 */
export function checkThresholds(metrics, thresholds = THRESHOLDS) {
  const violations = Object.keys(thresholds).filter(
    (metric) => metrics[metric].pct < thresholds[metric]
  );
  return { passed: violations.length === 0, violations };
}

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '.vercel/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    // The simulation must stay deterministic and engine-free: it runs identically on
    // every client and on the server (replay verification, future lockstep PvP).
    files: ['packages/sim/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['phaser', 'phaser/*', 'preact', 'preact/*', 'hono', 'hono/*'] },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Use the sim tick counter, not wall-clock time.' },
        { name: 'performance', message: 'Use the sim tick counter, not wall-clock time.' },
        { name: 'window', message: 'The sim must not touch the DOM.' },
        { name: 'document', message: 'The sim must not touch the DOM.' },
      ],
      'no-restricted-properties': [
        'error',
        ...[
          'random',
          'sin',
          'cos',
          'tan',
          'asin',
          'acos',
          'atan',
          'atan2',
          'exp',
          'log',
          'pow',
        ].map((property) => ({
          object: 'Math',
          property,
          message: 'Not deterministic across engines. Use the seeded PRNG / fixed-point helpers.',
        })),
      ],
    },
  },
);

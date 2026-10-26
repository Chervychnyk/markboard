import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default defineConfig(
  { ignores: ['.output/', '.wxt/', '.taste-skill/', '.agents/'] },
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    // svelte-check type-checks every file, WXT auto-imports (browser, defineContentScript…) included.
    rules: { 'no-undef': 'off' },
  },
  { files: ['**/*.svelte', '**/*.svelte.ts'], languageOptions: { parserOptions: { parser: ts.parser } } },
  // Maps, Sets and Dates in lib/ are short-lived temporaries; reactive state there is declared with $state.
  { files: ['lib/**'], rules: { 'svelte/prefer-svelte-reactivity': 'off' } },
);

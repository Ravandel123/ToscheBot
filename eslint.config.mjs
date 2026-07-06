import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import perfectionist from 'eslint-plugin-perfectionist';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
   {
      ignores: ['dist/', 'OldBot/', 'eslint.config.mjs', 'bot.js'],
   },
   js.configs.recommended,
   tseslint.configs.recommendedTypeChecked,
   {
      languageOptions: {
         globals: {
            ...globals.node,
         },
         parserOptions: {
            projectService: true,
            tsconfigRootDir: import.meta.dirname,
         },
      },
      plugins: {
         '@stylistic': stylistic,
         perfectionist,
      },
      rules: {
         // --- Formatting (the CLAUDE.md "Code style" section, machine-enforced) ---
         '@stylistic/indent': ['error', 3, { SwitchCase: 1 }],
         '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
         '@stylistic/semi': ['error', 'always'],
         '@stylistic/comma-dangle': ['error', 'always-multiline'],
         '@stylistic/no-trailing-spaces': 'error',
         '@stylistic/eol-last': 'error',
         '@stylistic/padded-blocks': ['error', 'never'],
         '@stylistic/no-multiple-empty-lines': ['error', { max: 1 }],
         '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
         '@stylistic/object-curly-spacing': ['error', 'always'],
         '@stylistic/arrow-parens': ['error', 'always'],
         '@stylistic/keyword-spacing': 'error',
         '@stylistic/space-before-blocks': 'error',
         '@stylistic/space-infix-ops': 'error',
         '@stylistic/comma-spacing': 'error',
         '@stylistic/key-spacing': 'error',
         '@stylistic/member-delimiter-style': 'error',
         '@stylistic/type-annotation-spacing': 'error',

         // --- Conventions ---
         // Guard-clause style: braces only around bodies with more than one
         // statement; all clauses of one if/else chain match ('consistent').
         'curly': ['error', 'multi', 'consistent'],
         // No `else` after a `return` (guard clauses, not branches).
         'no-else-return': ['error', { allowElseIf: false }],
         'eqeqeq': 'error',
         'prefer-const': 'error',
         'prefer-template': 'error',
         'object-shorthand': ['error', 'always'],
         'default-case-last': 'error',
         // All runtime logging goes through lib/log.ts (scripts/ are exempt below).
         'no-console': 'error',

         // Import order: Node builtins → third-party → local, one block, no blank
         // lines. Order WITHIN a group is the author's (type: 'unsorted').
         'perfectionist/sort-imports': ['error', {
            type: 'unsorted',
            newlinesBetween: 0,
            groups: [
               'builtin',
               'external',
               ['internal', 'parent', 'sibling', 'index'],
               'unknown',
            ],
         }],

         // --- TypeScript ---
         // Class member order (classes are stateful singletons only — see locks.ts).
         '@typescript-eslint/member-ordering': ['error', {
            default: [
               'signature',
               'static-field',
               'public-field',
               'protected-field',
               'private-field',
               'constructor',
               'static-method',
               'public-method',
               'protected-method',
               'private-method',
            ],
         }],
         '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
         '@typescript-eslint/no-import-type-side-effects': 'error',
         '@typescript-eslint/consistent-type-exports': ['error', { fixMixedExportsWithInlineTypeSpecifier: true }],
         '@typescript-eslint/switch-exhaustiveness-check': 'error',
         '@typescript-eslint/prefer-optional-chain': 'error',
         // `|| fallback` on strings is a deliberate pattern here (empty env var,
         // empty embed field, empty reject reason all want the fallback); the
         // rule still guards numbers, where `|| ` would swallow a legitimate 0.
         '@typescript-eslint/prefer-nullish-coalescing': ['error', { ignorePrimitives: { string: true } }],
         // Catches upstream API rot early (e.g. the discord.js modal-builder
         // rework, the `ephemeral` reply option) instead of at a major bump.
         '@typescript-eslint/no-deprecated': 'error',
         '@typescript-eslint/naming-convention': ['error',
            { selector: 'typeLike', format: ['PascalCase'] },
            // PascalCase variables = mongoose models (Character, Account);
            // UPPER_CASE = catalog/tunable constants.
            { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
            { selector: 'function', format: ['camelCase'] },
         ],
         '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
         '@typescript-eslint/no-explicit-any': 'warn',
         '@typescript-eslint/consistent-type-assertions': 'warn',
      },
   },
   {
      // Test doubles often have async signatures (to match a callback type)
      // without an await inside; that's expected in tests and in the shared
      // test harness under src/testing/ (the fake-interaction methods mirror
      // discord.js's async API without awaiting anything).
      files: ['**/*.test.ts', 'src/testing/**/*.ts'],
      rules: {
         '@typescript-eslint/require-await': 'off',
      },
   },
   {
      // CLI scripts talk to the terminal directly; lib/log.ts IS the logger.
      files: ['src/scripts/**/*.ts', 'src/lib/log.ts'],
      rules: {
         'no-console': 'off',
      },
   },
);

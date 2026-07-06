import js from '@eslint/js';
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
      rules: {
         'semi': ['error', 'always'],
         'prefer-const': 'error',
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
);

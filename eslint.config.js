import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'apps/web/public/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Correctness
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-implicit-coercion': ['error', { allow: ['!!'] }],
      'no-param-reassign': 'error',
      'no-return-assign': 'error',
      'no-throw-literal': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      // Readability
      'object-shorthand': 'error',
      'prefer-template': 'error',
      // TypeScript
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    // CLI scripts report progress on stdout.
    files: ['**/scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['apps/server/**/*.ts', 'packages/**/*.ts', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Design system: colors come from theme tokens, never raw hex (docs/12-design-system.md).
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
          message: 'Use a theme color token instead of a raw hex value.',
        },
        {
          selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]',
          message: 'Use a theme color token instead of a raw hex value.',
        },
      ],
    },
  },
  {
    // Entry file: not a Fast Refresh boundary.
    files: ['apps/web/src/main.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  // Last: turn off rules that conflict with Prettier formatting.
  prettier,
);

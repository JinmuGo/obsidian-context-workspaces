import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'main.js', 'manifest.json', 'versions.json', '*.js', '*.mjs'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      react: react,
      'react-hooks': reactHooks,
      obsidianmd: obsidianmd,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...obsidianmd.configs.recommended,
      'react-hooks/immutability': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    // Config for tests
    files: ['tests/**/*.{ts,tsx}'],
    extends: [
        js.configs.recommended,
        ...tseslint.configs.recommended,
    ],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      }
    },
     rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
);
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // React Compiler rules: deshabilitadas por ahora — el codebase tiene
      // patrones legacy que las violan pero funcionan correctamente.
      // Se cubrirán en una fase de refactor dedicado.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability':        'off',
      'react-hooks/purity':              'off',
      'react-hooks/exhaustive-deps':     'warn',
    },
  },
])

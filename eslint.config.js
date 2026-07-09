import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Fast Refresh 편의 규칙 — shadcn 부품(buttonVariants 등)·router의 lazy 정의에서
      // 불가피하게 걸리므로 CI를 막지 않도록 warn으로 완화 (개발 편의용, 정확성 무관)
      'react-refresh/only-export-components': 'warn',
    },
  },
])

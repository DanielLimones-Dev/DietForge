import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  // Existing interactive forms synchronize state from the in-memory database.
  // React Compiler is not enabled; keep these existing findings visible while
  // avoiding unrelated changes to the nutrition and peak-week workflows.
  {
    files: ['src/components/CheckInForm.tsx', 'src/components/MealPlanner.tsx', 'src/contexts/SubscriptionContext.tsx'],
    rules: { 'react-hooks/set-state-in-effect': 'warn' },
  },
  {
    files: ['src/components/CompetitionPeakWeekEditor.tsx', 'src/components/PeakWeekSimulator.tsx'],
    rules: { '@typescript-eslint/no-explicit-any': 'warn' },
  },
  globalIgnores(['.next/**', 'out/**', 'dist/**', 'legacy/**', 'src-tauri/**', 'supabase/**', 'server/**', 'next-env.d.ts']),
])

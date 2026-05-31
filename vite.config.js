import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

function getGitCommit() {
  try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'unknown'; }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __GIT_COMMIT__: JSON.stringify(getGitCommit()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify('1.1.0'),
  },
})

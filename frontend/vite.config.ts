import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

const readGit = (command: string): string | null => {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch {
    return null;
  }
};

const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || readGit('git rev-parse HEAD');
const branch = process.env.VERCEL_GIT_COMMIT_REF || readGit('git rev-parse --abbrev-ref HEAD');

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_INFO__: JSON.stringify({
      buildTime: new Date().toISOString(),
      commitSha,
      commitShortSha: commitSha ? commitSha.slice(0, 8) : null,
      branch,
      vercel: {
        env: process.env.VERCEL_ENV || null,
        url: process.env.VERCEL_URL || null,
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
      },
    }),
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['caucus-garbage-unusable.ngrok-free.dev']
  }
});

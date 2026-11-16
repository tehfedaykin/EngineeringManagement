import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { brainApi } from './server/brainApi';

export default defineConfig(({ mode }) => {
  // Lets server-only secrets like LINEAR_API_KEY come from .env.local as well as the shell.
  // They're read on the dev server only and never exposed to the browser bundle.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    process.env[key] ??= value;
  }

  return {
    plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), brainApi()],
  };
});

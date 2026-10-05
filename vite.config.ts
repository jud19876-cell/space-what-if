import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './', // 어느 주소(예: GitHub Pages 의 /repo-name/)에 올려도 동작하도록 상대 경로
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1000 }, // three.js 포함이라 큼 (경고만 끔)
});

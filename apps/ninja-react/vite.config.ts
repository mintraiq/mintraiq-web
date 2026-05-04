import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    plugins: [react()],
    root: __dirname,
    build: {
        outDir: path.join(__dirname, '../../mintraiq/react-embed'),
        emptyOutDir: true,
        rollupOptions: {
            input: path.join(__dirname, 'embed.html'),
            output: {
                inlineDynamicImports: true,
                entryFileNames: 'ninja-ui.js',
                assetFileNames: 'ninja-ui-[name][extname]'
            }
        }
    }
});

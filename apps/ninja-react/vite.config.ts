import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    // CSS is injected from the JS bundle so host portal pages keep loading
    // a single ninja-ui.js file (no extra <link> tag required).
    plugins: [react(), tailwindcss(), cssInjectedByJsPlugin()],
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

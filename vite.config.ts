import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'apk-downloader-middleware',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url && req.url.startsWith('/download/')) {
              const cleanUrl = req.url.split('?')[0];
              const filePath = path.resolve(__dirname, 'public' + cleanUrl);
              if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                const filename = path.basename(filePath);
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                if (filename.endsWith('.apk')) {
                  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
                } else if (filename.endsWith('.zip')) {
                  res.setHeader('Content-Type', 'application/zip');
                } else if (filename.endsWith('.kt')) {
                  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                }
                const stream = fs.createReadStream(filePath);
                return stream.pipe(res);
              }
            }
            next();
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

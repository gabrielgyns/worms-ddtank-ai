import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build gera um único index.html com tudo embutido — fácil de abrir ou compartilhar.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
});

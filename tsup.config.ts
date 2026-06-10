import { defineConfig } from 'tsup';

export default defineConfig([
  // Core library: ESM + CJS + IIFE
  {
    entry: { 'raccoon-tables': 'src/index.ts' },
    format: ['esm', 'cjs', 'iife'],
    globalName: 'RaccoonTables',
    dts: true,
    sourcemap: true,
    clean: true,
    minify: false,
    outDir: 'dist',
    outExtension({ format }) {
      switch (format) {
        case 'esm': return { js: '.esm.js' };
        case 'cjs': return { js: '.cjs.js' };
        case 'iife': return { js: '.iife.js' };
        default: return { js: '.js' };
      }
    },
    splitting: false,
    treeshake: true,
    target: 'es2020',
    platform: 'browser',
    esbuildOptions(options) {
      options.footer = {
        js: '/* Raccoon Tables v1.0.0 - High-performance data grid */'
      };
    }
  },
  // Minified IIFE for CDN usage
  {
    entry: { 'raccoon-tables.min': 'src/index.ts' },
    format: ['iife'],
    globalName: 'RaccoonTables',
    dts: false,
    sourcemap: true,
    clean: false,
    minify: true,
    outDir: 'dist',
    outExtension() {
      return { js: '.iife.js' };
    },
    splitting: false,
    treeshake: true,
    target: 'es2020',
    platform: 'browser'
  },
  // jQuery plugin: ESM + CJS only (IIFE omitted — jquery cannot be external in IIFE format)
  {
    entry: { 'raccoon-tables.jquery': 'src/jquery.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: false,
    minify: false,
    outDir: 'dist',
    outExtension({ format }) {
      switch (format) {
        case 'esm': return { js: '.jquery.esm.js' };
        case 'cjs': return { js: '.jquery.cjs.js' };
        default: return { js: '.jquery.js' };
      }
    },
    splitting: false,
    treeshake: true,
    target: 'es2020',
    platform: 'browser',
    external: ['jquery']
  }
]);

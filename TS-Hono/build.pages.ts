import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const libContent = readFileSync(join(__dirname, 'src', 'lib.ts'), 'utf-8');
const fitContent = readFileSync(join(__dirname, 'src', 'fit.ts'), 'utf-8');
const rateLimitContent = readFileSync(join(__dirname, 'src', 'middleware', 'rate-limit.ts'), 'utf-8');

const virtualPlugin = {
  name: 'virtual',
  setup(build: esbuild.PluginBuild) {
    build.onResolve({ filter: /.*/ }, args => {
      const path = args.path;
      if (path === '../src/lib' || path === '../src/lib.ts' ||
          path === '../../src/lib' || path === '../../src/lib.ts' ||
          path === 'virtual:lib') {
        return { path: 'virtual:lib', namespace: 'virtual-ns' };
      }
      if (path === '../fit' || path === '../fit.ts' ||
          path === '../../fit' || path === '../../fit.ts' ||
          path === 'virtual:fit') {
        return { path: 'virtual:fit', namespace: 'virtual-ns' };
      }
      if (path === '../src/middleware/rate-limit' || path === '../src/middleware/rate-limit.ts' ||
          path === '../../src/middleware/rate-limit' || path === '../../src/middleware/rate-limit.ts' ||
          path === 'virtual:rate-limit') {
        return { path: 'virtual:rate-limit', namespace: 'virtual-ns' };
      }
      return undefined;
    });

    build.onLoad({ filter: /.*/, namespace: 'virtual-ns' }, async (args) => {
      if (args.path === 'virtual:lib') {
        return {
          contents: libContent,
          loader: 'ts',
          resolveDir: join(__dirname, 'src'),
        };
      }
      if (args.path === 'virtual:fit') {
        return {
          contents: fitContent,
          loader: 'ts',
          resolveDir: join(__dirname, 'src'),
        };
      }
      if (args.path === 'virtual:rate-limit') {
        return {
          contents: rateLimitContent,
          loader: 'ts',
          resolveDir: join(__dirname, 'src', 'middleware'),
        };
      }
      return { contents: '', loader: 'ts' };
    });
  },
};

async function buildForPages() {
  const outDir = 'dist-pages';
  const functionsDir = 'functions';
  const publicDir = 'public';

  console.log('Building for Cloudflare Pages...');

  if (existsSync(publicDir)) {
    copyDirRecursive(publicDir, outDir);
  }

  const functionsOutDir = join(outDir, 'functions');
  mkdirSync(functionsOutDir, { recursive: true });

  const apiOutDir = join(functionsOutDir, 'api');
  mkdirSync(apiOutDir, { recursive: true });

  await esbuild.build({
    entryPoints: [`${functionsDir}/api/[[catchall]].ts`],
    outfile: join(apiOutDir, '[[catchall]].js'),
    bundle: true,
    minify: true,
    sourcemap: false,
    target: ['es2022'],
    format: 'esm',
    platform: 'browser',
    conditions: ['workerd', 'browser'],
    external: ['node:buffer', 'node:crypto'],
    loader: { '.ts': 'ts' },
    plugins: [virtualPlugin],
    absWorkingDir: __dirname,
  });

  console.log('Pages build complete!');

  // Generate _routes.json for Cloudflare Pages
  const routesConfig = {
    version: 1,
    include: ['/*'],
    exclude: []
  };
  writeFileSync(join(functionsOutDir, '_routes.json'), JSON.stringify(routesConfig, null, 2));
}

function copyDirRecursive(src: string, dest: string): void {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src);
  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

buildForPages().catch((e) => {
  console.error(e);
  process.exit(1);
});

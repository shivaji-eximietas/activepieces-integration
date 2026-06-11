#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.turbo',
  'cache',
  '.bun',
  '.cursor',
]);

const SKIP_FILES = new Set([
  'migrate-paths.js',
  'bun.lock',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.yml', '.yaml',
  '.md', '.mdx', '.sh', '.html', '.css', '.toml', '.env', '.example',
]);

const REPLACEMENTS = [
  ['packages/tests-e2e', 'frontend/packages/tests-e2e'],
  ['packages/ee', 'frontend/packages/ee'],
  ['packages/web', 'frontend/packages/web'],
  ['packages/shared', 'backend/packages/shared'],
  ['packages/server', 'backend/packages/server'],
  ['packages/pieces', 'backend/packages/pieces'],
  ['packages/cli', 'backend/packages/cli'],
  ['node tools/', 'node devops/tools/'],
  ['bash scripts/', 'bash devops/scripts/'],
  ['--project tools/', '--project devops/tools/'],
  ['tools/tsconfig.tools.json', 'devops/tools/tsconfig.tools.json'],
  ['tools/setup-dev.js', 'devops/tools/setup-dev.js'],
  ['tools/scripts/', 'devops/tools/scripts/'],
  ['tools/deploy.sh', 'devops/tools/deploy.sh'],
  ['tools/update.sh', 'devops/tools/update.sh'],
  ['tools/reset', 'devops/tools/reset'],
  ['scripts/run-sandbox-e2e.sh', 'devops/scripts/run-sandbox-e2e.sh'],
  ['scripts/', 'devops/scripts/'],
  ['deploy/activepieces-helm', 'devops/deploy/activepieces-helm'],
  ['deploy/pulumi', 'devops/deploy/pulumi'],
  ['benchmark/', 'devops/benchmark/'],
  ['smoke-test/', 'devops/smoke-test/'],
  ['.devcontainer/', 'devops/.devcontainer/'],
];

function shouldProcess(filePath) {
  const base = path.basename(filePath);
  if (SKIP_FILES.has(base)) return false;
  if (base.startsWith('.env')) return true;
  const ext = path.extname(filePath);
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (base === 'Dockerfile' || base === 'docker-entrypoint.sh' || base === '.dockerignore') return true;
  if (base === 'crowdin.yml' || base === 'depot.json') return true;
  return false;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' && dir !== ROOT) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, files);
    } else if (shouldProcess(full)) {
      files.push(full);
    }
  }
  return files;
}

function replaceUnlessPrefixed({ content, from, to, prefixes = ['devops/'] }) {
  let result = '';
  let index = 0;
  while (index < content.length) {
    const matchIndex = content.indexOf(from, index);
    if (matchIndex === -1) {
      result += content.slice(index);
      break;
    }
    const alreadyPrefixed = prefixes.some((prefix) => {
      const start = matchIndex - prefix.length;
      return start >= 0 && content.slice(start, matchIndex) === prefix;
    });
    result += content.slice(index, matchIndex);
    result += alreadyPrefixed ? from : to;
    index = matchIndex + from.length;
  }
  return result;
}

function applyReplacements(content) {
  let result = content;
  for (const [from, to] of REPLACEMENTS) {
    if (result.includes(from)) {
      result = replaceUnlessPrefixed({ content: result, from, to });
    }
  }
  return result;
}

function fixServeCdPaths(content, filePath) {
  if (!filePath.includes('package.json')) return content;
  if (!content.includes('cd ../../..')) return content;

  if (filePath.includes('backend/packages/server/api')) {
    return content.replace(/cd \.\.\/\.\.\/\.\./g, 'cd ../../../..');
  }
  if (filePath.includes('backend/packages/server/worker')) {
    return content.replace(/cd \.\.\/\.\.\/\.\./g, 'cd ../../../..');
  }
  return content;
}

const files = walk(ROOT);
let changed = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let updated = applyReplacements(original);
  updated = fixServeCdPaths(updated, file);
  if (updated !== original) {
    try {
      fs.writeFileSync(file, updated);
      changed += 1;
      console.log('updated:', path.relative(ROOT, file));
    } catch (error) {
      console.warn('skipped:', path.relative(ROOT, file), error.message);
    }
  }
}

console.log(`\nDone. Updated ${changed} files.`);

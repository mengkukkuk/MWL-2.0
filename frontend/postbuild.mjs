// Vite emits a single HTML shell into ../static. Flask renders three real
// template routes (core.index -> index.html, auth.login_page -> login.html,
// auth.reset_password_page -> reset_password.html), so the same shell is copied
// under all three names: the SPA router decides what to draw from the URL.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const built = join(root, 'static', 'index.html');
const templatesDir = join(root, 'templates');

if (!existsSync(built)) {
  console.error(`postbuild: ${built} not found — did vite build succeed?`);
  process.exit(1);
}

const html = readFileSync(built, 'utf8');

// Jinja would try to evaluate these and throw at render time. Fail the build
// loudly rather than shipping a template that 500s on first request.
for (const token of ['{{', '{%', '{#']) {
  if (html.includes(token)) {
    console.error(
      `postbuild: built HTML contains the Jinja delimiter "${token}". ` +
        `Flask renders this file as a template and would fail on it.`,
    );
    process.exit(1);
  }
}

mkdirSync(templatesDir, { recursive: true });
for (const name of ['index.html', 'login.html', 'reset_password.html']) {
  writeFileSync(join(templatesDir, name), html);
}

// Leaving it in static/ would expose an unauthenticated copy of the shell at
// /static/index.html, bypassing the login redirect in core.spa_catchall.
rmSync(built);

console.log('postbuild: wrote templates/{index,login,reset_password}.html');

/**
 * Patch @coral-xyz/anchor CJS directory imports for ESM compatibility.
 * Same fix as Meridian's scripts/patch-anchor.js.
 */

const fs = require('fs');
const path = require('path');

const ANCHOR_DIR = path.join(__dirname, '..', 'node_modules', '@coral-xyz', 'anchor', 'dist', 'cjs');

if (!fs.existsSync(ANCHOR_DIR)) {
  console.log('Anchor CJS directory not found — skipping patch');
  process.exit(0);
}

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Fix directory imports: require("./foo") → require("./foo/index.js")
  content = content.replace(
    /require\("\.\/([^"]+)"\)/g,
    (match, p1) => {
      const resolved = path.join(path.dirname(filePath), p1);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        return `require("./${p1}/index.js")`;
      }
      return match;
    }
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  return false;
}

let patched = 0;
function walkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name.endsWith('.js')) {
      if (patchFile(fullPath)) patched++;
    }
  }
}

walkDir(ANCHOR_DIR);
console.log(`Patched ${patched} Anchor CJS file(s)`);

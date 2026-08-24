// Static consistency guard: every named import in the repo must resolve to a
// real export of its target module, and every specifier must map to an
// existing file. Catches broken links that only explode in the browser at
// module-link time (Node tests don't import UI entry points).
import { strict as assert } from 'assert';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const JS_ROOT = join(ROOT, 'js');

const walkJsFiles = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory()
        ? walkJsFiles(join(dir, entry.name))
        : entry.name.endsWith('.js') ? [join(dir, entry.name)] : []);

const SELF = fileURLToPath(import.meta.url);
const sourceFiles = walkJsFiles(JS_ROOT).filter(path => path !== SELF);

const collectExports = source => {
    const names = new Set();
    let hasDefault = false;

    for (const match of source.matchAll(
        /\bexport\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/g))
        names.add(match[1]);

    if (/\bexport\s+default\b/.test(source))
        hasDefault = true;

    // export { a, b as c };  (local list, may follow declarations)
    for (const match of source.matchAll(/\bexport\s*\{([^}]+)\}(?!\s*from)/g))
        for (const part of match[1].split(','))
            names.add(part.trim().split(/\s+as\s+/).pop().trim());

    return { names, hasDefault };
};

const resolveSpecifier = (specifier, importer) => {
    if (specifier.startsWith('#/'))
        return join(JS_ROOT, specifier.slice(2));
    if (specifier.startsWith('.'))
        return resolve(dirname(importer), specifier);
    return null; // bare specifier (node builtins etc.)
};

let checkedBindings = 0;
let checkedModules = 0;

for (const filePath of sourceFiles) {
    const source = readFileSync(filePath, 'utf8');

    // import { a, b as c } from '...'   |   import Default from '...'
    for (const match of source.matchAll(
        /\bimport\s+(?:([A-Za-z_$][\w$]*)|\{([^}]+)\})\s*from\s*['"]([^'"]+)['"]/g)) {
        const defaultName = match[1];
        const namedList = match[2];
        const specifier = match[3];

        const target = resolveSpecifier(specifier, filePath);
        if (target === null)
            continue; // bare specifier: node builtin or package, not our concern
        assert.equal(existsSync(target), true,
            `${rel(filePath)}: "${specifier}" -> missing file ${rel(target)}`);
        checkedModules++;

        const { names, hasDefault } = collectExports(readFileSync(target, 'utf8'));

        if (defaultName) {
            assert.equal(hasDefault, true,
                `${rel(filePath)}: "${specifier}" has no default export`);
            checkedBindings++;
        }

        if (namedList)
            for (const part of namedList.split(',')) {
                if (!part.trim()) continue;
                const original = part.trim().split(/\s+as\s+/)[0].trim();
                assert.equal(names.has(original), true,
                    `${rel(filePath)}: "${specifier}" does not export "${original}" `
                    + `(available: ${[...names].sort().join(', ') || 'none'})`);
                checkedBindings++;
            }
    }
}

function rel(path) {
    return path.startsWith(ROOT) ? path.slice(ROOT.length + 1) : path;
}

console.log(`All import bindings consistent! `
    + `(${checkedBindings} bindings across ${checkedModules} targets, `
    + `${sourceFiles.length} files scanned)`);

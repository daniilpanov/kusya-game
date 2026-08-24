import { strict as assert } from 'assert';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ActParser } from '#/lib/act/act-parser.js';
import { ActSerializer, ActSerializeError } from '#/lib/act/act-serializer.js';

const parse = content => (new ActParser({ content })).parse();
const serialize = groups => (new ActSerializer({ groups })).serialize();

// --- Basic structure ---

{
    const text = serialize([{
        key: '0',
        actions: [{ name: 'setBackground', args: [1] }, { name: 'end', args: [] }],
    }]);
    assert.equal(text, '[0]\nsetBackground(1)\nend()\n');
}

{
    const text = serialize([
        { key: '0', actions: [{ name: 'a', args: [] }] },
        { key: '1', actions: [{ name: 'b', args: [] }] },
    ]);
    assert.equal(text, '[0]\na()\n\n[1]\nb()\n');
}

// --- Value serialization: safe strings stay bare, unsafe get quoted/escaped ---

{
    assert.equal(serialize([{ key: 'g', actions: [{ name: 'x', args: ['Hello world'] }] }]),
        '[g]\nx(Hello world)\n');
    assert.equal(serialize([{ key: 'g', actions: [{ name: 'x', args: ['Привет, мир'] }] }]),
        '[g]\nx("Привет, мир")\n');
    assert.equal(serialize([{ key: 'g', actions: [{ name: 'x', args: ['123'] }] }]),
        '[g]\nx("123")\n');
    assert.equal(serialize([{ key: 'g', actions: [{ name: 'x', args: ['true'] }] }]),
        '[g]\nx("true")\n');
    assert.equal(serialize([{ key: 'g', actions: [{ name: 'x', args: [''] }] }]),
        '[g]\nx("")\n');
    assert.equal(serialize([{ key: 'g', actions: [{ name: 'x', args: [' padded '] }] }]),
        '[g]\nx(" padded ")\n');
    assert.equal(serialize([{ key: 'g', actions: [{ name: 'x', args: ['http://example.com'] }] }]),
        '[g]\nx("http://example.com")\n');
    assert.equal(serialize([{ key: 'g', actions: [{ name: 'x', args: ['He said "hi"'] }] }]),
        "[g]\nx('He said \"hi\"')\n");
    assert.equal(serialize([{ key: 'g', actions: [{ name: 'x', args: ["it's fine"] }] }]),
        '[g]\nx("it\'s fine")\n');

    // A string containing both quote types cannot be represented in the format
    assert.throws(
        () => serialize([{ key: 'g', actions: [{ name: 'x', args: ['say "hi" and \'bye\''] }] }]),
        /cannot be represented in ACT format/
    );
}

// --- Primitives pass through as literals ---

{
    const text = serialize([{ key: 'g', actions: [{ name: 'x', args: [42, -3.5, true, false, null] }] }]);
    assert.equal(text, '[g]\nx(42, -3.5, true, false, null)\n');
}

// --- Canonical if form ---

{
    const text = serialize([{ key: 'g', actions: [{ name: 'if', args: ['stats.alive > 5 && x != 3', 'nextGroup'] }] }]);
    assert.equal(text, '[g]\nif(stats.alive > 5 && x != 3): nextGroup\n');
}

// --- if with a single argument stays flat ---

{
    const text = serialize([{ key: 'g', actions: [{ name: 'if', args: ['flag'] }] }]);
    assert.equal(text, '[g]\nif(flag)\n');
}

// --- Serialization errors carry group/action context ---

{
    assert.throws(
        () => serialize([{ key: '0', actions: [{ name: 'x', args: [NaN] }] }]),
        error => error instanceof ActSerializeError &&
            /Unsupported number value: NaN/.test(error.message) &&
            /\[group "0" \(#0\), action #0\]/.test(error.message)
    );

    assert.throws(
        () => serialize([{ key: '0', actions: [{ name: 'x', args: [Infinity] }] }]),
        /Unsupported number value: Infinity/
    );

    assert.throws(
        () => serialize([{ key: '0', actions: [{ name: 'x', args: [undefined] }] }]),
        /Unsupported argument type: undefined/
    );

    assert.throws(
        () => serialize([{ key: '0', actions: [{ name: 'x', args: [{ bad: 'object' }] }] }]),
        /Unsupported argument type: object/
    );

    assert.throws(
        () => serialize([{ key: '0', actions: [{ name: 'x', args: [['array']] }] }]),
        /Unsupported argument type: array/
    );

    assert.throws(
        () => serialize([{ key: '0', actions: [{ name: 'x', args: ['multi\nline'] }] }]),
        /Newlines are not allowed/
    );
}

// --- Round-trip on synthetic content preserves the AST exactly ---

{
    const src = [
        '[start]',
        'setBackground(2)',
        'showTitle("Пробуждение")',
        '',
        '[check]',
        '// comments disappear at AST level',
        'if(stats.alive > 5 && !(score == 0)): 4',
        'setVar(score, score + 1)',
        'showPhrasePerson(vi.default, null, "Фух... Это был всего лишь сон")',
        'showChoice(ans1, "Сколько будет 2 + 2?", "3", "4", "5")',
        '',
        '[4]',
        'addStats(alive, bonus)',
        'gotoNextScene()',
        '',
        '[9]',
        'end()',
    ].join('\n');

    const first = parse(src);
    const second = parse(serialize(first));
    assert.deepEqual(second, first);
}

// --- Round-trip on real game scenes ---

const here = dirname(fileURLToPath(import.meta.url));
const scenesRoot = join(here, '../../../resources/games/game_1_demo/scenes');

for (const sceneFile of ['1.ru.act', '2.ru.act']) {
    const src = readFileSync(join(scenesRoot, sceneFile), 'utf8');
    const first = parse(src);
    const second = parse(serialize(first));
    assert.deepEqual(second, first, `round-trip failed for ${sceneFile}`);
}

console.log('All act-serializer tests passed!');

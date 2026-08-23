const { strict: assert } = require('assert');
const { ActParser } = require('./act-parser');
const { ExpressionsParser } = require('../expressions/expressions');

const parse = content => (new ActParser({ content })).parse();

const ctx = {
    x: 10,
    y: 3,
    flag: true,
    score: 5,
};
const evaluate = expr => new ExpressionsParser({
    expression: expr,
    getFromContextCallback: name => ctx[name],
}).evaluate();

{
    const { groups } = parse('[0]\nsetBackground(1)');
    assert.equal(groups.length, 1);
    assert.equal(groups[0].key, '0');
    assert.equal(groups[0].actions.length, 1);
    assert.equal(groups[0].actions[0].name, 'setBackground');
    assert.deepEqual(groups[0].actions[0].args, [1]);
}

{
    const { groups } = parse('[start]\ngoToStart()');
    assert.equal(groups.length, 1);
    assert.equal(groups[0].key, 'start');
    assert.equal(groups[0].actions.length, 1);
    assert.equal(groups[0].actions[0].name, 'goToStart');
    assert.deepEqual(groups[0].actions[0].args, []);
}

{
    const { groups } = parse('[0]\nshowPhrase("Hello, world!")');
    assert.equal(groups[0].actions[0].name, 'showPhrase');
    assert.equal(groups[0].actions[0].args[0], 'Hello, world!');
}

{
    const { groups } = parse("[0]\nshowPhrase('Single quotes')");
    assert.equal(groups[0].actions[0].args[0], 'Single quotes');
}

{
    const { groups } = parse('[0]\nsetVar(count, 42)');
    assert.equal(groups[0].actions[0].name, 'setVar');
    assert.deepEqual(groups[0].actions[0].args, ['count', 42]);
}

{
    const { groups } = parse('[0]\nif(flag): gotoStart');
    assert.equal(groups[0].actions[0].name, 'if');
    assert.equal(groups[0].actions[0].args[0], 'flag');
    assert.equal(groups[0].actions[0].args[1], 'gotoStart');
}

{
    const { groups } = parse('[0]\nshowFlag(true)\n[1]\nhideFlag(false)');
    assert.equal(groups.length, 2);
    assert.equal(groups[0].actions[0].args[0], true);
    assert.equal(groups[1].actions[0].args[0], false);
}

{
    const { groups } = parse('[0]\nshowPhrase(vi.default, "Hello")');
    assert.equal(groups[0].actions[0].args[0], 'vi.default');
    assert.equal(groups[0].actions[0].args[1], 'Hello');
}

{
    const { groups } = parse('[0]\nif(x > 1 && (y < 2 || z == 3)): labelName');
    const args = groups[0].actions[0].args;
    assert.equal(args[0], 'x > 1 && (y < 2 || z == 3)');
    assert.equal(args[1], 'labelName');
}

{
    const { groups } = parse('[0]\nsetBackground(1) // set the bg');
    assert.equal(groups[0].actions.length, 1);
    assert.equal(groups[0].actions[0].name, 'setBackground');
}

{
    const { groups } = parse('[0]\n// comment only\nsetBackground(1)');
    assert.equal(groups[0].actions.length, 1);
}

{
    const { groups } = parse('[scene1]\nshowTitle("Scene 1")\n[scene2]\nshowTitle("Scene 2")');
    assert.equal(groups.length, 2);
    assert.equal(groups[0].key, 'scene1');
    assert.equal(groups[1].key, 'scene2');
}

{
    assert.throws(() => parse('showPhrase("no label")'), /Actions found before any group label/);
}

{
    assert.throws(() => parse('[0]\nshowPhrase(unclosed('), /Unmatched/);
}

{
    const { groups } = parse('[0]\ngotoNext()');
    assert.equal(groups[0].actions[0].name, 'gotoNext');
    assert.deepEqual(groups[0].actions[0].args, []);
}

{
    const { groups } = parse('[0]\ngotoNextScene()');
    assert.equal(groups[0].actions[0].name, 'gotoNextScene');
    assert.deepEqual(groups[0].actions[0].args, []);
}

{
    const { groups } = parse('[0]\nend()');
    assert.equal(groups[0].actions[0].name, 'end');
    assert.deepEqual(groups[0].actions[0].args, []);
}

{
    const { groups } = parse('[0]\nsetBg("a, b, c")');
    assert.equal(groups[0].actions[0].args[0], 'a, b, c');
}

{
    const { groups } = parse('');
    assert.equal(groups.length, 0);
}

{
    const { groups } = parse('[0]\n\n[1]\n');
    assert.equal(groups.length, 2);
    assert.equal(groups[0].key, '0');
    assert.equal(groups[1].key, '1');
    assert.equal(groups[0].actions.length, 0);
    assert.equal(groups[1].actions.length, 0);
}

{
    const { groups } = parse('[0]\nshowPhrase("escaped \\"quote\\"")');
    assert.equal(groups[0].actions[0].args[0], 'escaped \\"quote\\"');
}

{
    const { groups } = parse('[0]\nshowPhrase(   "spacy"  ,  42  )');
    assert.equal(groups[0].actions[0].args[0], 'spacy');
    assert.equal(groups[0].actions[0].args[1], 42);
}

{
    const { groups } = parse('[0]\nmovePersonSprite(vi, 0, 0)');
    assert.equal(groups[0].actions[0].args[0], 'vi');
    assert.equal(groups[0].actions[0].args[1], 0);
    assert.equal(groups[0].actions[0].args[2], 0);
}

{
    const { groups } = parse('[0]\nshowChoice(nextDoing, vi.smile, "Question", "Var1", "Var2")');
    const args = groups[0].actions[0].args;
    assert.equal(args[0], 'nextDoing');
    assert.equal(args[1], 'vi.smile');
    assert.equal(args[2], 'Question');
    assert.equal(args[3], 'Var1');
    assert.equal(args[4], 'Var2');
}

{
    const { groups } = parse('[0]\nsetVar(score, score + 1)');
    assert.equal(groups[0].actions[0].args[0], 'score');
    assert.equal(groups[0].actions[0].args[1], 'score + 1');
}

{
    const { groups } = parse('[0]\nif(x + 1 > 2): labelName');
    const args = groups[0].actions[0].args;
    assert.equal(args[0], 'x + 1 > 2');
    assert.equal(args[1], 'labelName');
}

{
    const { groups } = parse('[0]\nif(a + b * 3 == 10): target');
    const args = groups[0].actions[0].args;
    assert.equal(args[0], 'a + b * 3 == 10');
    assert.equal(args[1], 'target');
}

{
    const { groups } = parse("[0]\nif(!flag): target");
    const args = groups[0].actions[0].args;
    assert.equal(args[0], '!flag');
    assert.equal(args[1], 'target');
}

{
    const { groups } = parse("[0]\nif(-x > 0): target");
    const args = groups[0].actions[0].args;
    assert.equal(args[0], '-x > 0');
    assert.equal(args[1], 'target');
}

{
    const { groups } = parse("[0]\nif(x ** 2 > 4): target");
    const args = groups[0].actions[0].args;
    assert.equal(args[0], 'x ** 2 > 4');
    assert.equal(args[1], 'target');
}

{
    const { groups } = parse("[0]\nif(x ^ 2 > 5): target");
    const args = groups[0].actions[0].args;
    assert.equal(args[0], 'x ^ 2 > 5');
    assert.equal(args[1], 'target');
}

{
    const { groups } = parse(`[0]\nif(x == "hello"): target`);
    const args = groups[0].actions[0].args;
    assert.equal(args[0], 'x == "hello"');
    assert.equal(args[1], 'target');
}

{
    const { groups } = parse("[0]\nif(x > 0 && y < 10 || z == 5): target");
    const args = groups[0].actions[0].args;
    assert.equal(args[0], 'x > 0 && y < 10 || z == 5');
    assert.equal(args[1], 'target');
}

{
    const { groups } = parse("[0]\nif(((x + 1) * 2) == 6): target");
    const args = groups[0].actions[0].args;
    assert.equal(args[0], '((x + 1) * 2) == 6');
    assert.equal(args[1], 'target');
}

{
    const { groups } = parse("[0]\nif(a != b): target");
    const args = groups[0].actions[0].args;
    assert.equal(args[0], 'a != b');
    assert.equal(args[1], 'target');
}

{
    const { groups } = parse("[0]\nif(x >= 1 && y <= 5): target");
    const args = groups[0].actions[0].args;
    assert.equal(args[0], 'x >= 1 && y <= 5');
    assert.equal(args[1], 'target');
}

{
    const { groups } = parse("[0]\nshowPhrase(x + 1)");
    const args = groups[0].actions[0].args;
    assert.equal(args[0], 'x + 1');
}

{
    const { groups } = parse("[0]\nsetVar(score, (a + b) * 2)");
    const args = groups[0].actions[0].args;
    assert.equal(args[0], 'score');
    assert.equal(args[1], '(a + b) * 2');
}

{
    const { groups } = parse("[0]\nif(x > 0 && (y < 2 || z == 3 && w != 1)): target");
    const args = groups[0].actions[0].args;
    assert.equal(args[0], 'x > 0 && (y < 2 || z == 3 && w != 1)');
    assert.equal(args[1], 'target');
}

console.log('All ActParser tests passed!');

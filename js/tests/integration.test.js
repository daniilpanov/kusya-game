const { strict: assert } = require('assert');
const { ActParser } = require('../lib/act/act-parser');
const { ExpressionsParser } = require('../lib/expressions/expressions');

const parse = content => (new ActParser({ content })).parse();

const ctx = {
    x: 10,
    y: 3,
    flag: true,
    score: 5,
    name: 'Vi',
};
const evaluate = expr => new ExpressionsParser({
    expression: expr,
    getFromContextCallback: name => ctx[name],
}).evaluate();

// --- Integration: parsed expressions evaluate correctly ---

{
    const { groups } = parse("[0]\nif(flag): 5");
    const result = evaluate(groups[0].actions[0].args[0]);
    assert.equal(result, true);
}

{
    const { groups } = parse("[0]\nif(x + y > 10): target");
    const result = evaluate(groups[0].actions[0].args[0]);
    assert.equal(result, true);
}

{
    const { groups } = parse("[0]\nif(x + y < 10): target");
    const result = evaluate(groups[0].actions[0].args[0]);
    assert.equal(result, false);
}

{
    const { groups } = parse("[0]\nsetVar(score, score + 1)");
    const result = evaluate(groups[0].actions[0].args[1]);
    assert.equal(result, 6);
}

{
    const { groups } = parse("[0]\nif(x ** 2 > 4): target");
    const result = evaluate(groups[0].actions[0].args[0]);
    assert.equal(result, true);
}

{
    const { groups } = parse("[0]\nif(((x + 1) * 2) == 22): target");
    const result = evaluate(groups[0].actions[0].args[0]);
    assert.equal(result, true);
}

{
    const { groups } = parse("[0]\nif(x >= 1 && y <= 5): target");
    const result = evaluate(groups[0].actions[0].args[0]);
    assert.equal(result, true);
}

{
    const { groups } = parse("[0]\nif(!flag): target");
    const result = evaluate(groups[0].actions[0].args[0]);
    assert.equal(result, false);
}

{
    const { groups } = parse("[0]\nshowPhrasePerson(vi.default, null, \"text\")");
    const args = groups[0].actions[0].args;
    assert.equal(args[0], 'vi.default');
    assert.equal(args[1], null);
    assert.equal(args[2], 'text');
}

{
    const { groups } = parse('[0]\nif("score: " + score == "score: 5"): target');
    const result = evaluate(groups[0].actions[0].args[0]);
    assert.equal(result, true);
}

{
    const { groups } = parse('[0]\nif("Hello, " + name == "Hello, Vi"): target');
    const result = evaluate(groups[0].actions[0].args[0]);
    assert.equal(result, true);
}

console.log('All integration tests passed!');
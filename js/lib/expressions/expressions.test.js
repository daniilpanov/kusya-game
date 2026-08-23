const { strict: assert } = require('assert');
const { ExpressionsParser } = require('./expressions');

const ctx = {
    x: 10,
    y: 3,
    score: 5,
    flag: true,
    name: 'Vi',
};

const evaluate = expr => new ExpressionsParser({
    expression: expr,
    getFromContextCallback: name => ctx[name],
}).evaluate();

// Basic arithmetic
assert.equal(evaluate('2 + 3'), 5);
assert.equal(evaluate('10 - 4'), 6);
assert.equal(evaluate('3 * 4'), 12);
assert.equal(evaluate('10 / 2'), 5);
assert.equal(evaluate('2 ** 3'), 8);
assert.equal(evaluate('2 ^ 3'), 8);

// Precedence
assert.equal(evaluate('2 + 3 * 4'), 14);
assert.equal(evaluate('(2 + 3) * 4'), 20);
assert.equal(evaluate('10 - 2 * 3'), 4);
assert.equal(evaluate('10 / 2 + 3'), 8);

// Exponentiation precedence (right-assoc)
assert.equal(evaluate('2 ** 3 ** 2'), 512); // 2^(3^2) = 2^9 = 512

// With variables
assert.equal(evaluate('x + y'), 13);
assert.equal(evaluate('x * 2'), 20);
assert.equal(evaluate('score ** 2'), 25);

// Mixed with comparisons
assert.equal(evaluate('x + y > 10'), true);
assert.equal(evaluate('x * y == 30'), true);
assert.equal(evaluate('x ** 2 >= 100'), true);

// Mixed with logical
assert.equal(evaluate('x > 5 && y < 5'), true);
assert.equal(evaluate('x > 5 && y > 5'), false);

// Unary minus
assert.equal(evaluate('-5'), -5);
assert.equal(evaluate('-(2 + 3)'), -5);
assert.equal(evaluate('x + -y'), 7);
assert.equal(evaluate('-x * 2'), -20);

// Unary not
assert.equal(evaluate('!true'), false);
assert.equal(evaluate('!false'), true);
assert.equal(evaluate('!!true'), true);
assert.equal(evaluate('!flag'), false);
assert.equal(evaluate('!(x > 5)'), false);

// All comparison operators
assert.equal(evaluate('10 != 5'), true);
assert.equal(evaluate('10 != 10'), false);
assert.equal(evaluate('5 <= 10'), true);
assert.equal(evaluate('10 <= 10'), true);
assert.equal(evaluate('15 <= 10'), false);
assert.equal(evaluate('10 >= 5'), true);
assert.equal(evaluate('10 >= 10'), true);
assert.equal(evaluate('5 >= 10'), false);
assert.equal(evaluate('"abc" == "abc"'), true);
assert.equal(evaluate('"abc" == "xyz"'), false);
assert.equal(evaluate('"abc" != "xyz"'), true);

// Logical OR
assert.equal(evaluate('true || false'), true);
assert.equal(evaluate('false || true'), true);
assert.equal(evaluate('false || false'), false);
assert.equal(evaluate('x > 5 || y > 5'), true);
assert.equal(evaluate('x < 5 || y > 5'), false);

// Mixed logical (short-circuit semantics not guaranteed, but evaluate both sides)
assert.equal(evaluate('x > 5 && y < 5 || x == 10'), true);
assert.equal(evaluate('x < 5 && y > 5'), false);
assert.equal(evaluate('(x > 5 && y < 5) || (x == 0)'), true);

// Parentheses with arithmetic
assert.equal(evaluate('(x + y) * 2'), 26);
assert.equal(evaluate('(x ** 2) + (y ** 2)'), 109);

// Complex combined expressions
assert.equal(evaluate('x ** 2 + y * 2 - 1'), 105);
assert.equal(evaluate('-(x + y) * 2'), -26);
assert.equal(evaluate('!flag || x == 10'), true);
assert.equal(evaluate('!flag && x == 0'), false);

// Edge cases: falsy expression values
assert.equal(evaluate(0), 0);
assert.equal(evaluate(false), false);
assert.equal(evaluate(null), null);
assert.equal(evaluate(''), '');

// String concatenation with +
assert.equal(evaluate('"Hello" + " World"'), 'Hello World');
assert.equal(evaluate('"Count: " + 5'), 'Count: 5');
assert.equal(evaluate('"Hello, " + name'), 'Hello, Vi');
assert.equal(evaluate('"score: " + score'), 'score: 5');
assert.equal(evaluate('name + " has " + score + " points"'), 'Vi has 5 points');

console.log('All expressions tests passed!');

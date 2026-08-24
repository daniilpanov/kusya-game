const TOKEN_TYPE_OPERATOR = 0;
const TOKEN_TYPE_STRING = 1;
const TOKEN_TYPE_NUMBER = 2;
const TOKEN_TYPE_IDENTIFIER = 3;
const TOKEN_TYPE_BINARY = 4;
const TOKEN_TYPE_UNARY = 5;
const TOKEN_TYPE_COMPARISON = 6;
const TOKEN_TYPE_VARIABLE = 7;
const TOKEN_TYPE_LITERAL = 8;

export class ExpressionsParser {
    constructor({ getFromContextCallback = undefined, expression = undefined }, evaluate = false) {
        this.expression = expression;

        this._getFromContext = getFromContextCallback;
        this._tokens = [];
        this._index = 0;

        if (evaluate)
            this.evaluate();
        else
            this.lastValue = undefined;
    }

    setContext(getFromContextCallback) { this._getFromContext = getFromContextCallback; }
    setExpression(expression) { this.expression = expression; }

    evaluate(expression = undefined) {
        if (expression !== undefined)
            this.setExpression(expression);

        if (typeof this.expression !== 'string' || this.expression === '')
            return this.lastValue = this.expression;

        this._tokens = this.tokenize();
        this._index = 0;
        const ast = this.parseExpression();
        return this.lastValue = this.evaluateAST(ast);
    }

    tokenize() {
        const tokens = [];
        let i = 0;

        while (i < this.expression.length) {
            const char = this.expression[i];
            const nextChar = this.expression[i + 1];

            if (char === ' ') {
                ++i;
                continue;
            }

            if (char === '(' || char === ')' || char === '!' && nextChar !== '=') {
                tokens.push({ type: TOKEN_TYPE_OPERATOR, value: char });
                ++i;
                continue;
            }

            // Arithmetic operators
            if (char === '+' || char === '-') {
                tokens.push({ type: TOKEN_TYPE_OPERATOR, value: char });
                ++i;
                continue;
            }

            if (char === '*' && nextChar === '*') {
                tokens.push({ type: TOKEN_TYPE_OPERATOR, value: '**' });
                i += 2;
                continue;
            }

            if (char === '*') {
                tokens.push({ type: TOKEN_TYPE_OPERATOR, value: '*' });
                ++i;
                continue;
            }

            if (char === '/') {
                tokens.push({ type: TOKEN_TYPE_OPERATOR, value: '/' });
                ++i;
                continue;
            }

            if (char === '^') {
                tokens.push({ type: TOKEN_TYPE_OPERATOR, value: '**' });
                ++i;
                continue;
            }

            // Comparison and boolean operators
            if (char === '=' || char === '&' || char === '|' || char === '<' || char === '>' || char === '!') {
                if (nextChar === '=') {
                    tokens.push({ type: TOKEN_TYPE_OPERATOR, value: char + '=' });
                    i += 2;
                } else if (char === '&' && nextChar === '&') {
                    tokens.push({ type: TOKEN_TYPE_OPERATOR, value: '&&' });
                    i += 2;
                } else if (char === '|' && nextChar === '|') {
                    tokens.push({ type: TOKEN_TYPE_OPERATOR, value: '||' });
                    i += 2;
                } else if (char === '<' || char === '>') {
                    tokens.push({ type: TOKEN_TYPE_OPERATOR, value: char });
                    ++i;
                } else
                    throw new Error(`Unknown operator: ${char}`);
                continue;
            }

            // Strings in quotes
            if (char === '"' || char === "'") {
                const quote = char;
                let value = '';
                ++i;

                while (i < this.expression.length && this.expression[i] !== quote) {
                    value += this.expression[i];
                    ++i;
                }

                tokens.push({ type: TOKEN_TYPE_STRING, value });
                ++i; // Skip closing quote
                continue;
            }

            // Numbers
            if (/[0-9]/.test(char)) {
                let value = '';
                while (i < this.expression.length && /[0-9.]/.test(this.expression[i])) {
                    value += this.expression[i];
                    ++i;
                }
                tokens.push({ type: TOKEN_TYPE_NUMBER, value: parseFloat(value) });
                continue;
            }

            // Identifiers
            if (/[a-zA-Z_$]/.test(char)) {
                let value = '';
                while (i < this.expression.length && /[a-zA-Z0-9_.$]/.test(this.expression[i])) {
                    value += this.expression[i];
                    ++i;
                }
                tokens.push({ type: TOKEN_TYPE_IDENTIFIER, value });
                continue;
            }

            throw new Error(`Unknown symbol: ${char}`);
        }

        return tokens;
    }

    // Parse expressions
    parseExpression() { return this.parseOr(); }

    parseOr() {
        let left = this.parseAnd();

        while (this.match('||')) {
            const operator = this.previous().value;
            const right = this.parseAnd();
            left = { type: TOKEN_TYPE_BINARY, operator, left, right };
        }

        return left;
    }

    parseAnd() {
        let left = this.parseComparison();

        while (this.match('&&')) {
            const operator = this.previous().value;
            const right = this.parseComparison();
            left = { type: TOKEN_TYPE_BINARY, operator, left, right };
        }

        return left;
    }

    parseComparison() {
        let left = this.parseAdditive();

        while (this.match('==', '!=', '<', '>', '<=', '>=')) {
            const operator = this.previous().value;
            const right = this.parseAdditive();
            left = { type: TOKEN_TYPE_COMPARISON, operator, left, right };
        }

        return left;
    }

    parseAdditive() {
        let left = this.parseMultiplicative();

        while (this.match('+', '-')) {
            const operator = this.previous().value;
            const right = this.parseMultiplicative();
            left = { type: TOKEN_TYPE_BINARY, operator, left, right };
        }

        return left;
    }

    parseMultiplicative() {
        let left = this.parseExponentiation();

        while (this.match('*', '/')) {
            const operator = this.previous().value;
            const right = this.parseExponentiation();
            left = { type: TOKEN_TYPE_BINARY, operator, left, right };
        }

        return left;
    }

    parseExponentiation() {
        let left = this.parseUnary();

        if (this.match('**')) {
            const right = this.parseExponentiation();
            return { type: TOKEN_TYPE_BINARY, operator: '**', left, right };
        }

        return left;
    }

    parseUnary() {
        if (this.match('!')) {
            const operator = this.previous().value;
            const right = this.parseUnary();
            return { type: TOKEN_TYPE_UNARY, operator, right };
        }

        if (this.match('-')) {
            if (this.check(TOKEN_TYPE_NUMBER)) {
                const token = this.advance();
                return { type: TOKEN_TYPE_LITERAL, value: -token.value };
            }

            const right = this.parseUnary();
            return { type: TOKEN_TYPE_UNARY, operator: '-', right };
        }

        return this.parsePrimary();
    }

    parsePrimary() {
        if (this.match('(')) {
            const expr = this.parseExpression();
            this.consume(')');
            return expr;
        }

        if (this.check(TOKEN_TYPE_IDENTIFIER)) {
            const token = this.advance();
            if (token.value === 'true')
                return { type: TOKEN_TYPE_LITERAL, value: true };
            if (token.value === 'false')
                return { type: TOKEN_TYPE_LITERAL, value: false };
            return { type: TOKEN_TYPE_VARIABLE, name: token.value };
        }

        if (this.check(TOKEN_TYPE_STRING)) {
            const token = this.advance();
            return { type: TOKEN_TYPE_LITERAL, value: token.value };
        }

        if (this.check(TOKEN_TYPE_NUMBER)) {
            const token = this.advance();
            return { type: TOKEN_TYPE_LITERAL, value: token.value };
        }

        throw new Error('Unexpected token');
    }

    // Token helpers
    match(...operators) {
        for (const op of operators) {
            if (this.check(TOKEN_TYPE_OPERATOR, op)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    consume(expectedValue) {
        if (this.check(TOKEN_TYPE_OPERATOR, expectedValue))
            return this.advance();

        throw new Error(`Expected: ${expectedValue}`);
    }

    check(type, value = undefined) {
        if (this._index >= this._tokens.length)
            return false;

        const token = this._tokens[this._index];

        return (token.type === type) && (value === undefined || token.value === value);

    }

    advance() {
        if (this._index < this._tokens.length)
            return this._tokens[this._index++];

        throw new Error('Unexpected end of expression');
    }

    previous() { return this._tokens[this._index - 1]; }

    evaluateAST(node) {
        switch (node.type) {
            case TOKEN_TYPE_BINARY:
                if (node.operator === '&&')
                    return this.evaluateAST(node.left) && this.evaluateAST(node.right);

                if (node.operator === '||')
                    return this.evaluateAST(node.left) || this.evaluateAST(node.right);

                if (node.operator === '+')
                    return this.evaluateAST(node.left) + this.evaluateAST(node.right);

                if (node.operator === '-')
                    return this.evaluateAST(node.left) - this.evaluateAST(node.right);

                if (node.operator === '*')
                    return this.evaluateAST(node.left) * this.evaluateAST(node.right);

                if (node.operator === '/')
                    return this.evaluateAST(node.left) / this.evaluateAST(node.right);

                if (node.operator === '**')
                    return Math.pow(this.evaluateAST(node.left), this.evaluateAST(node.right));

                throw new Error(`Unknown binary operator: ${node.operator}`)

            case TOKEN_TYPE_COMPARISON:
                const left = this.evaluateAST(node.left);
                const right = this.evaluateAST(node.right);

                switch (node.operator) {
                    case '==': return left === right;
                    case '!=': return left !== right;
                    case '<': return left < right;
                    case '>': return left > right;
                    case '<=': return left <= right;
                    case '>=': return left >= right;
                    default: throw new Error(`Unknown comparison operator: ${node.operator}`);
                }

            case TOKEN_TYPE_UNARY:
                if (node.operator === '!')
                    return !this.evaluateAST(node.right);

                if (node.operator === '-')
                    return -this.evaluateAST(node.right);

                throw new Error(`Unknown unary operator: ${node.operator}`)

            case TOKEN_TYPE_VARIABLE:
                return this._getFromContext(node.name);

            case TOKEN_TYPE_LITERAL:
                return node.value;
        }

        throw new Error(`Unknown node type [AST evaluation]: ${node.type}`);
    }

    getValue(node) {
        if (node.type === TOKEN_TYPE_VARIABLE)
            return this._getFromContext(node.name);

        if (node.type === TOKEN_TYPE_LITERAL)
            return node.value;

        throw new Error(`Unknown node type [getting a value]: ${node.type}`);
    }
}

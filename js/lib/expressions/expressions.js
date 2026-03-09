class ExpressionsParser {
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

    evaluate() {
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

            // Пропускаем пробелы
            if (char === ' ') {
                i++;
                continue;
            }

            // Скобки и операторы
            if (char === '(' || char === ')' || char === '!' && nextChar !== '=') {
                tokens.push({ type: 'operator', value: char });
                i++;
                continue;
            }

            // Операторы сравнения и логические операторы
            if (char === '=' || char === '&' || char === '|' || char === '<' || char === '>' || char === '!') {
                if (nextChar === '=') {
                    tokens.push({ type: 'operator', value: char + '=' });
                    i += 2;
                } else if (char === '&' && nextChar === '&') {
                    tokens.push({ type: 'operator', value: '&&' });
                    i += 2;
                } else if (char === '|' && nextChar === '|') {
                    tokens.push({ type: 'operator', value: '||' });
                    i += 2;
                } else if (char === '<' || char === '>') {
                    tokens.push({ type: 'operator', value: char });
                    i++;
                } else
                    throw new Error(`Unknown operator: ${char}`);
                continue;
            }

            // Строки в кавычках
            if (char === '"' || char === "'") {
                const quote = char;
                let value = '';
                i++;

                while (i < this.expression.length && this.expression[i] !== quote) {
                    value += this.expression[i];
                    i++;
                }

                tokens.push({ type: 'string', value });
                i++; // пропускаем закрывающую кавычку
                continue;
            }

            // Числа
            if (/[-0-9]/.test(char)) {
                let value = '';
                while (i < this.expression.length && /[-0-9.]/.test(this.expression[i])) {
                    value += this.expression[i];
                    i++;
                }
                tokens.push({ type: 'number', value: parseFloat(value) });
                continue;
            }

            // Идентификаторы (переменные)
            if (/[a-zA-Z_$]/.test(char)) {
                let value = '';
                while (i < this.expression.length && /[a-zA-Z0-9_.$]/.test(this.expression[i])) {
                    value += this.expression[i];
                    i++;
                }
                tokens.push({ type: 'identifier', value });
                continue;
            }

            // Если символ не распознан
            throw new Error(`Неизвестный символ: ${char}`);
        }

        return tokens;
    }

    // Парсинг выражений с учетом приоритетов операторов
    parseExpression() {
        return this.parseOr();
    }

    parseOr() {
        let left = this.parseAnd();

        while (this.match('||')) {
            const operator = this.previous().value;
            const right = this.parseAnd();
            left = { type: 'binary', operator, left, right };
        }

        return left;
    }

    parseAnd() {
        let left = this.parseComparison();

        while (this.match('&&')) {
            const operator = this.previous().value;
            const right = this.parseComparison();
            left = { type: 'binary', operator, left, right };
        }

        return left;
    }

    parseComparison() {
        let left = this.parseUnary();

        while (this.match('==', '!=', '<', '>', '<=', '>=')) {
            const operator = this.previous().value;
            const right = this.parseUnary();
            left = { type: 'comparison', operator, left, right };
        }

        return left;
    }

    parseUnary() {
        if (this.match('!')) {
            const operator = this.previous().value;
            const right = this.parseUnary();
            return { type: 'unary', operator, right };
        }

        return this.parsePrimary();
    }

    parsePrimary() {
        if (this.match('(')) {
            const expr = this.parseExpression();
            this.consume(')');
            return expr;
        }

        if (this.check('identifier')) {
            const token = this.advance();
            return { type: 'variable', name: token.value };
        }

        if (this.check('string')) {
            const token = this.advance();
            return { type: 'literal', value: token.value };
        }

        if (this.check('number')) {
            const token = this.advance();
            return { type: 'literal', value: token.value };
        }

        throw new Error('Неожиданный токен');
    }

    // Вспомогательные методы для работы с токенами
    match(...operators) {
        for (const op of operators) {
            if (this.check('operator', op)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    consume(expectedValue) {
        if (this.check('operator', expectedValue)) {
            return this.advance();
        }
        throw new Error(`Ожидался оператор: ${expectedValue}`);
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

    previous() {
        return this._tokens[this._index - 1];
    }

    evaluateAST(node) {
        switch (node.type) {
            case 'binary':
                if (node.operator === '&&')
                    return this.evaluateAST(node.left) && this.evaluateAST(node.right);

                if (node.operator === '||')
                    return this.evaluateAST(node.left) || this.evaluateAST(node.right);

                throw new Error(`Unknown binary operator: ${node.operator}`)

            case 'comparison':
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

            case 'unary':
                if (node.operator !== '!')
                    throw new Error(`Unknown unary operator: ${node.operator}`)

                return !this.evaluateAST(node.right);

            case 'variable':
                return this._getFromContext(node.name);

            case 'literal':
                return node.value;
        }

        throw new Error(`Unknown node type [AST evaluation]: ${node.type}`);
    }

    getValue(node) {
        if (node.type === 'variable')
            return this._getFromContext(node.name);

        if (node.type === 'literal')
            return node.value;

        throw new Error(`Unknown node type [getting a value]: ${node.type}`);
    }
}

class ExpressionsParser {
    constructor(getVar) {
        this.getVar = getVar;
        this.tokens = [];
        this.index = 0;
    }

    evaluate(condition) {
        this.tokens = this.tokenize(condition);
        this.index = 0;
        const ast = this.parseExpression();
        return this.evaluateAST(ast);
    }

    tokenize(condition) {
        const tokens = [];
        let i = 0;

        while (i < condition.length) {
            const char = condition[i];
            const nextChar = condition[i + 1];

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

                while (i < condition.length && condition[i] !== quote) {
                    value += condition[i];
                    i++;
                }

                tokens.push({ type: 'string', value });
                i++; // пропускаем закрывающую кавычку
                continue;
            }

            // Числа
            if (/[-0-9.]/.test(char)) {
                let value = '';
                while (i < condition.length && /[-0-9.]/.test(condition[i])) {
                    value += condition[i];
                    i++;
                }
                tokens.push({ type: 'number', value: parseFloat(value) });
                continue;
            }

            // Идентификаторы (переменные)
            if (/[a-zA-Z_$]/.test(char)) {
                let value = '';
                while (i < condition.length && /[a-zA-Z0-9_$]/.test(condition[i])) {
                    value += condition[i];
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
        if (this.index >= this.tokens.length)
            return false;

        const token = this.tokens[this.index];

        return (token.type === type) && (value === undefined || token.value === value);

    }

    advance() {
        if (this.index < this.tokens.length)
            return this.tokens[this.index++];

        throw new Error('Unexpected end of expression');
    }

    previous() {
        return this.tokens[this.index - 1];
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
                return this.getVar(node.name);

            case 'literal':
                return node.value;
        }

        throw new Error(`Unknown node type [AST evaluation]: ${node.type}`);
    }

    getValue(node) {
        if (node.type === 'variable')
            return this.getVar(node.name);

        if (node.type === 'literal')
            return node.value;

        throw new Error(`Unknown node type [getting a value]: ${node.type}`);
    }
}

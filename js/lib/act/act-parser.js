export class ActParser {
    constructor({ content, generator } = {}) {
        this.content = content;
        this.generator = generator;
        this.groups = [];
        this.groupIndexMap = {};
    }

    parse(content) {
        if (content !== undefined)
            this.content = content;

        if (typeof this.content !== 'string')
            throw new Error('No content to parse');

        this.groups = [];
        this.groupIndexMap = {};

        if (!this.content)
            return { groups: this.groups };

        let currentGroup = null;
        const lines = this.content.split('\n');

        for (let rawLine of lines) {
            const line = this._stripComment(rawLine).trim();
            if (!line) continue;

            if (this._isLabel(line)) {
                currentGroup = { key: this._parseLabel(line), actions: [] };
                this.groups.push(currentGroup);
                continue;
            }

            if (currentGroup === null)
                throw new Error('Actions found before any group label');

            const action = this._parseAction(line);
            if (action)
                currentGroup.actions.push(action);
        }

        this.groups.forEach((group, i) => {
            this.groupIndexMap[group.key] = i;
        });

        if (this.generator)
            return this._run();

        return { groups: this.groups };
    }

    async _run() {
        const groups = this.groups;
        let currentGroupIdx = 0;

        while (currentGroupIdx < groups.length) {
            const group = groups[currentGroupIdx];
            let actionIdx = 0;

            while (actionIdx < group.actions.length) {
                const action = group.actions[actionIdx];
                const result = await this.generator(action);

                if (result !== undefined) {
                    const targetIdx = this.groupIndexMap[String(result)];
                    if (targetIdx !== undefined) {
                        currentGroupIdx = targetIdx;
                        break;
                    }
                }

                actionIdx++;
            }

            if (actionIdx >= group.actions.length)
                currentGroupIdx++;
        }
    }

    _stripComment(line) {
        const idx = line.indexOf('//');
        return idx !== -1 ? line.substring(0, idx) : line;
    }

    _isLabel(line) {
        return line.startsWith('[') && line.endsWith(']');
    }

    _parseLabel(line) {
        return line.slice(1, -1).trim();
    }

    _parseAction(line) {
        const parenOpen = line.indexOf('(');
        if (parenOpen === -1) return null;

        const name = line.substring(0, parenOpen).trim();
        if (!name) return null;

        let depth = 0;
        let parenClose = -1;
        for (let i = parenOpen + 1; i < line.length; i++) {
            if (line[i] === '(') depth++;
            else if (line[i] === ')') {
                if (depth === 0) { parenClose = i; break; }
                depth--;
            }
        }
        if (parenClose === -1)
            throw new Error(`Unmatched '(' in action: ${line}`);

        const argsStr = line.substring(parenOpen + 1, parenClose);
        const rest = line.substring(parenClose + 1).trim();

        let target = null;
        if (rest.startsWith(':'))
            target = rest.substring(1).trim();

        const args = this._parseArgs(argsStr);
        if (target !== null)
            args.push(target);

        return { name, args };
    }

    _parseArgs(argsStr) {
        const args = [];
        let current = '';
        let inString = false;
        let stringChar = null;
        let depth = 0;

        for (let i = 0; i < argsStr.length; i++) {
            const ch = argsStr[i];

            if (inString) {
                if (ch === '\\') {
                    current += ch;
                    if (i + 1 < argsStr.length) {
                        current += argsStr[i + 1];
                        i++;
                    }
                } else if (ch === stringChar) {
                    inString = false;
                    current += ch;
                } else {
                    current += ch;
                }
            } else if (ch === '"' || ch === "'") {
                inString = true;
                stringChar = ch;
                current += ch;
            } else if (ch === '(') {
                depth++;
                current += ch;
            } else if (ch === ')') {
                depth--;
                current += ch;
            } else if (ch === ',' && depth === 0) {
                args.push(this._parseArgValue(current.trim()));
                current = '';
            } else {
                current += ch;
            }
        }

        const trimmed = current.trim();
        if (trimmed) args.push(this._parseArgValue(trimmed));

        return args;
    }

    _parseArgValue(value) {
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value === 'null') return null;

        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            let inner = 0;
            for (let i = 1; i < value.length - 1; ++i) {
                if (value[i] === value[0] && value[i - 1] !== '\\')
                    ++inner;
            }
            if (inner === 0)
                return value.slice(1, -1);
        }

        const num = Number(value);
        if (!isNaN(num) && value.length > 0) return num;

        return value;
    }
}

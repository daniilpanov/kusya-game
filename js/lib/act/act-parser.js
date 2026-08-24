export class ActParseError extends Error {
    constructor(message, lineNumber = null) {
        super(lineNumber === null ? message : `${message} (line ${lineNumber})`);
        this.name = 'ActParseError';
        this.lineNumber = lineNumber;
    }
}

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
        const seenKeys = new Set();

        for (let i = 0; i < lines.length; i++) {
            const lineNumber = i + 1;
            const line = this._stripComment(lines[i]).trim();
            if (!line) continue;

            if (this._isLabel(line)) {
                const key = this._parseLabel(line);
                if (!key)
                    throw new ActParseError('Empty group label', lineNumber);
                if (seenKeys.has(key))
                    throw new ActParseError(`Duplicate group label [${key}]`, lineNumber);
                seenKeys.add(key);
                currentGroup = { key, actions: [] };
                this.groups.push(currentGroup);
                continue;
            }

            if (currentGroup === null)
                throw new ActParseError('Actions found before any group label', lineNumber);

            const action = this._parseAction(line, lineNumber);
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

    _parseAction(line, lineNumber) {
        const parenOpen = line.indexOf('(');
        if (parenOpen === -1)
            throw new ActParseError(`Invalid action syntax, missing "(": ${line}`, lineNumber);

        const name = line.substring(0, parenOpen).trim();
        if (!name)
            throw new ActParseError(`Invalid action syntax, missing action name: ${line}`, lineNumber);

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
            throw new ActParseError(`Unmatched '(' in action: ${line}`, lineNumber);

        const argsStr = line.substring(parenOpen + 1, parenClose);
        const rest = line.substring(parenClose + 1).trim();

        let target = null;
        if (rest) {
            if (rest.startsWith(':'))
                target = rest.substring(1).trim();
            else
                throw new ActParseError(`Unexpected content after action: ${line}`, lineNumber);
        }

        const args = ActParser.parseArgs(argsStr);
        if (target !== null)
            args.push(target);

        return { name, args };
    }

    // Tokenizes a raw argument string into values; shared with the scene editor
    static parseArgs(argsStr) {
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
                args.push(ActParser._parseArgValue(current.trim()));
                current = '';
            } else {
                current += ch;
            }
        }

        const trimmed = current.trim();
        if (trimmed) args.push(ActParser._parseArgValue(trimmed));

        return args;
    }

    static _parseArgValue(value) {
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

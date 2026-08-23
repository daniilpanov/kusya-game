export class ActSerializeError extends Error {
    constructor(message, context = undefined) {
        super(message);
        this.name = 'ActSerializeError';
        this.context = context;
    }
}

export class ActSerializer {
    constructor({ groups = [] } = {}) {
        this.groups = groups;
    }

    serialize(groups = undefined) {
        if (groups !== undefined)
            this.groups = groups;

        // Accepts either an array of groups or an ActParser.parse() result shaped { groups }
        if (this.groups && !Array.isArray(this.groups) && Array.isArray(this.groups.groups))
            this.groups = this.groups.groups;

        if (!Array.isArray(this.groups))
            throw new ActSerializeError('Groups must be an array');

        const chunks = this.groups.map((group, groupIndex) => {
            if (!group || typeof group !== 'object')
                throw new ActSerializeError(`Invalid group [#${groupIndex}]`, { groupIndex });

            const lines = [`[${this._serializeGroupKey(group.key, groupIndex)}]`];

            (group.actions ?? []).forEach((action, actionIndex) => {
                try {
                    lines.push(this._serializeAction(action));
                } catch (error) {
                    const context = { groupKey: group.key, groupIndex, actionIndex };
                    throw error instanceof ActSerializeError && error.context
                        ? error
                        : new ActSerializeError(`${error.message} [group "${group.key}" (#${groupIndex}), action #${actionIndex}]`, context);
                }
            });

            lines.push('');
            return lines.join('\n');
        });

        return chunks.join('\n');
    }

    _serializeGroupKey(key, groupIndex) {
        if (typeof key !== 'string' || !key.trim() || key.includes('\n') || key.includes(']'))
            throw new ActSerializeError(`Invalid group key: ${JSON.stringify(key)}`, { groupIndex });

        return key.trim();
    }

    _serializeAction(action) {
        if (!action || typeof action !== 'object')
            throw new Error('Invalid action');

        if (typeof action.name !== 'string' || !action.name)
            throw new Error(`Invalid action name: ${JSON.stringify(action.name)}`);

        const args = action.args ?? [];

        // Canonical conditional jump form: if(condition): label
        if (action.name === 'if' && args.length === 2)
            return `if(${this._serializeArg(args[0])}): ${this._serializeTarget(args[1])}`;

        const serializedArgs = args.map(arg => this._serializeArg(arg));
        return `${action.name}(${serializedArgs.join(', ')})`;
    }

    _serializeTarget(target) {
        if (typeof target !== 'string' || !target.trim() || /[\n\r]/.test(target))
            throw new Error(`Invalid jump target: ${JSON.stringify(target)}`);

        return target.trim();
    }

    _serializeArg(value) {
        if (value === null)
            return 'null';

        switch (typeof value) {
            case 'number':
                if (!Number.isFinite(value))
                    throw new Error(`Unsupported number value: ${value}`);
                return String(value);

            case 'boolean':
                return value ? 'true' : 'false';

            case 'string':
                return this._serializeStringArg(value);

            default:
                throw new Error(`Unsupported argument type: ${Array.isArray(value) ? 'array' : typeof value}`);
        }
    }

    _serializeStringArg(value) {
        if (/[\n\r]/.test(value))
            throw new Error('Newlines are not allowed inside string arguments (line-based format)');

        if (this._isSafeBareString(value))
            return value;

        // The parser does not process backslash escapes, so instead of escaping
        // we pick a quote type that does not occur inside the string.
        const quote = this._pickQuote(value);
        return `${quote}${value}${quote}`;
    }

    _pickQuote(value) {
        for (const quote of ['"', "'"]) {
            if (!value.includes(quote) && !value.endsWith('\\'))
                return quote;
        }

        throw new Error('String cannot be represented in ACT format (contains both quote types)');
    }

    // A string is safe unquoted when reparsing returns it unchanged:
    // not split by commas/parens, not glued to a comment,
    // not coerced into a number/literal, and no edge whitespace lost.
    _isSafeBareString(value) {
        if (value.length === 0 || value !== value.trim())
            return false;

        if (/[,()"'/\\]/.test(value))
            return false;

        if (value === 'true' || value === 'false' || value === 'null')
            return false;

        if (!Number.isNaN(Number(value)))
            return false;

        return true;
    }
}

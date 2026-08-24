import { FIELD_KINDS } from '#/action-specs.js';

// Pure converters between AST argument arrays and typed form values.
// DOM-free by design — covered directly by unit tests.

export class FieldError extends Error {}

const isEmpty = value => String(value ?? '').trim() === '';

const assertKind = (field, value) => {
    if (!FIELD_KINDS.includes(field.kind))
        throw new FieldError(`${field.label}: неизвестный тип поля "${field.kind}"`);
    return value;
};

const argToInputValue = (field, arg) => {
    if (arg === undefined || arg === null)
        return '';

    switch (field.kind) {
        case 'bool':
            if (arg === true) return 'true';
            if (arg === false) return 'false';
            throw new FieldError(`${field.label}: ожидался true/false`);
        case 'number':
            if (typeof arg !== 'number')
                throw new FieldError(`${field.label}: ожидалось число`);
            return String(arg);
        default:
            if (typeof arg !== 'string' && typeof arg !== 'number')
                throw new FieldError(`${field.label}: недопустимое значение`);
            return String(arg);
    }
};

const inputValueToArg = (field, rawValue) => {
    const value = assertKind(field, String(rawValue ?? '').trim());

    if (value === '') {
        if (!field.optional)
            throw new FieldError(`${field.label}: обязательное поле`);
        if (field.emptyAsNull)
            return null;
        return undefined; // omit
    }

    switch (field.kind) {
        case 'number': {
            const num = Number(value);
            if (Number.isNaN(num))
                throw new FieldError(`${field.label}: не число`);
            return num;
        }
        case 'bool':
            if (value !== 'true' && value !== 'false')
                throw new FieldError(`${field.label}: выберите true/false/—`);
            return value === 'true';
        default:
            return value;
    }
};

export function formValuesToArgs(spec, values, restValues = []) {
    const fields = spec.args ?? [];

    // An optional field may be omitted only when nothing after it is present,
    // otherwise positional meaning of middle arguments would break.
    const restPresent = restValues.some(entry => !isEmpty(entry));
    const trailSelected = spec.trailingBool && !isEmpty(values[spec.trailingBool.key]);
    const presentAfter = new Array(fields.length).fill(false);
    let seen = false;
    for (let i = fields.length - 1; i >= 0; i--) {
        presentAfter[i] = seen;
        seen = seen || !isEmpty(values[fields[i].key]);
    }

    const args = [];
    for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        const arg = inputValueToArg(field, values[field.key]);

        if (arg === undefined) {
            if (presentAfter[i] || restPresent || trailSelected)
                throw new FieldError(`${field.label}: поле пропущено, но заполнены последующие — укажите его`);
            continue;
        }
        args.push(arg);
    }

    for (const entry of restValues)
        if (!isEmpty(entry))
            args.push(String(entry).trim());

    if (trailSelected) {
        const trail = values[spec.trailingBool.key];
        if (trail !== 'true' && trail !== 'false')
            throw new FieldError(`${spec.trailingBool.label}: выберите true/false/—`);
        args.push(trail === 'true');
    }

    const validationError = spec.validate?.(values);
    if (validationError)
        throw new FieldError(validationError);

    return args;
}

export function argsToFormValues(spec, args) {
    const fields = spec.args ?? [];
    const values = {};
    let index = 0;

    for (const field of fields) {
        if (index < args.length)
            values[field.key] = argToInputValue(field, args[index++]);
        else
            values[field.key] = '';
    }

    let leftovers = args.slice(index);

    if (spec.trailingBool) {
        const last = leftovers[leftovers.length - 1];
        if (last === true || last === false) {
            values[spec.trailingBool.key] = last ? 'true' : 'false';
            leftovers = leftovers.slice(0, -1);
        } else {
            values[spec.trailingBool.key] = '';
        }
    }

    if (spec.rest) {
        // Parser keeps expressions as raw strings — choices stay textual
        values[spec.rest.key] = leftovers.map(String);
        leftovers = [];
    }

    if (leftovers.length > 0)
        return { ok: false };

    return { ok: true, values };
}

// Blank form state for a freshly dropped palette card
export function defaultFormValues(spec) {
    const values = {};
    for (const field of spec.args ?? [])
        values[field.key] = '';
    if (spec.rest)
        values[spec.rest.key] = [''];
    if (spec.trailingBool)
        values[spec.trailingBool.key] = '';
    return values;
}

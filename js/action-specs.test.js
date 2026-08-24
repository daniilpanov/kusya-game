import { strict as assert } from 'assert';
import { ACTION_SPECS, ACTION_CATEGORIES, FIELD_KINDS, describeAction, paletteByCategory } from '#/action-specs.js';
import { getKnownActionNames } from '#/actions.js';
import { formValuesToArgs, argsToFormValues, defaultFormValues, FieldError } from '#/editor-fields.js';
import { ActParser } from '#/lib/act/act-parser.js';
import { ActSerializer } from '#/lib/act/act-serializer.js';

// Registry consistency: every handler has a spec, every spec has a handler
{
    const specNames = Object.keys(ACTION_SPECS).sort();
    const handlerNames = getKnownActionNames().sort();
    assert.deepEqual(specNames, handlerNames);
}

{
    for (const [name, spec] of Object.entries(ACTION_SPECS)) {
        assert.ok(spec.title, `${name}: title`);
        assert.ok(ACTION_CATEGORIES.includes(spec.category), `${name}: category`);
        for (const field of spec.args ?? []) {
            assert.ok(field.key && field.label, `${name}.${field.key}: key/label`);
            assert.ok(FIELD_KINDS.includes(field.kind), `${name}.${field.key}: kind ${field.kind}`);
        }
    }
}

{
    // palette covers every category with at least one card
    const palette = paletteByCategory();
    for (const category of ACTION_CATEGORIES)
        assert.ok(palette[category].length > 0, category);
    assert.equal(describeAction('nope'), null);
    assert.equal(describeAction('goto').category, 'Навигация');
}

// Form -> args -> serialized line -> parse -> args -> form -> same values
const samples = {
    showPhrase: [{ text: 'Привет!' }],
    showPhrasePerson: [
        { person: 'vi.smile', pseudo: '', text: 'Где я???', hideAll: '' },
        { person: 'vi.default', pseudo: 'Голос', text: 'Эй!', hideAll: 'true' },
    ],
    showChoice: [
        { choiceKey: 'ans1', text: 'Сколько 2+2?', choices: ['3', '4', '5'], hideAll: '' },
        { choiceKey: 'ans2', text: 'Ещё?', choices: [], hideAll: 'false' },
    ],
    showChoicePerson: [
        { choiceKey: 'q1', person: '', text: 'Вопрос?', choices: ['да', 'нет'], hideAll: 'true' },
        { choiceKey: 'q2', person: 'vi.smile', text: 'Ну?', choices: ['ок'], hideAll: '' },
    ],
    showTitle: [{ title: 'Первая сцена' }],
    showPersonSprite: [
        { person: 'vi', hideAll: '', x: '', y: '' },               // tail fully omitted
        { person: 'vi.smile', hideAll: 'true', x: '10', y: '-3' }, // full arity
    ],
    movePersonSprite: [{ person: 'vi', x: '0', y: '100' }],
    if: [{ condition: 'x > 1 && (y < 2 || z == 3)', target: '4' }],
    goto: [{ target: '0' }],
    gotoNext: [{}],
    end: [{}],
    setBackground: [{ bg: '2' }],
    gotoScene: [{ scene: '2' }],
    gotoNextScene: [{}],
    setVar: [{ name: 'score', value: 'score + 1' }],
    addVar: [{ name: 'bonus', value: 'score ** 2' }],
    cloneVar: [{ from: 'a', to: 'b' }],
    addStats: [{ stat: 'alive', value: 'bonus' }],
};


for (const [name, cases] of Object.entries(samples)) {
    const spec = describeAction(name);
    for (const values of cases) {
        const args = formValuesToArgs(spec, values, values.choices ?? []);
        const line = new ActSerializer()._serializeAction({ name, args });
        const { groups } = new ActParser({ content: `[t]\n${line}` }).parse();
        const node = groups[0].actions[0];
        assert.equal(node.name, name, line);

        const forward = argsToFormValues(spec, node.args);
        assert.equal(forward.ok, true, `${name}: ${line}`);

        const normalize = ({ choices, ...rest }) => JSON.stringify({
            ...rest,
            ...(choices ? { choices: choices.filter(v => v.trim() !== '') } : {}),
        });
        assert.equal(normalize(forward.values), normalize(values), `${name}: ${line}`);
    }
}

{
    // optional tail stays omitted through the whole pipeline
    const spec = describeAction('showPersonSprite');
    const args = formValuesToArgs(spec, { person: 'vi', hideAll: '', x: '', y: '' }, []);
    assert.deepEqual(args, ['vi']);
}

{
    // middle optional materializes as explicit null when later fields are filled
    const spec = describeAction('showPhrasePerson');
    const args = formValuesToArgs(spec, { person: 'vi', pseudo: '', text: 'Текст', hideAll: 'false' }, []);
    assert.deepEqual(args, ['vi', null, 'Текст', false]);
}

{
    // validation errors
    const spec = describeAction('setVar');
    assert.throws(() => formValuesToArgs(spec, { name: '', value: '1' }), FieldError);
    assert.throws(() => formValuesToArgs(spec, { name: 'x', value: '' }), FieldError);

    assert.throws(
        () => formValuesToArgs(describeAction('movePersonSprite'), { person: 'vi', x: 'abc', y: '2' }),
        /не число/,
    );

    // half-filled coordinate pair is caught by the spec's cross-field hook
    assert.throws(
        () => formValuesToArgs(describeAction('showPersonSprite'), { person: 'vi', hideAll: 'false', x: '5', y: '' }),
        /парой/,
    );

    // optional gap: later field filled while middle left empty without emptyAsNull
    assert.throws(
        () => formValuesToArgs(describeAction('showPersonSprite'), { person: 'vi', hideAll: '', x: '5', y: '' }),
        /укажите его/,
    );
}

{
    // unexpected leftovers force raw fallback instead of data loss
    assert.equal(argsToFormValues(describeAction('gotoNext'), ['surprise']).ok, false);

    // trailing boolean is recognized even among variadic choices
    const spec = describeAction('showChoice');
    const { ok, values } = argsToFormValues(spec, ['ck', 'вопрос?', 'а', 'б', false]);
    assert.equal(ok, true);
    assert.equal(values.hideAll, 'false');
    assert.deepEqual(values.choices, ['а', 'б']);
}

{
    const blank = defaultFormValues(describeAction('showChoice'));
    assert.deepEqual(blank, { choiceKey: '', text: '', choices: [''], hideAll: '' });

    // blank card cannot emit args yet — required fields complain
    assert.throws(() => formValuesToArgs(describeAction('showChoice'), blank, blank.choices), FieldError);
}

console.log('All action-specs tests passed!');

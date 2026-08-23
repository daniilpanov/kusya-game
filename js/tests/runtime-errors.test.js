import { strict as assert } from 'assert';
import { SceneController } from '#/scene.js';
import { createHandlersMap } from '#/actions.js';
import { PersonController } from '#/person.js';
import { Game } from '#/game.js';

const makeController = (content, actionsHandler, onActionError = undefined) =>
    new SceneController('test-scene', content, actionsHandler, onActionError);

// --- Successful nodes still execute within a group ---

{
    const executed = [];
    const ctrl = makeController('[0]\nfoo(1)\nbar(2)', action => { executed.push(action.name); });
    await ctrl.doActionsGroup(0);
    assert.deepEqual(executed, ['foo', 'bar']);
}

// --- Rejected async node does not prevent siblings and is reported with context ---

{
    const executed = [];
    const errors = [];
    const ctrl = makeController('[0]\nbad()\ngood()', action => {
        if (action.name === 'bad')
            return Promise.reject(new Error('boom'));

        executed.push(action.name);
    }, info => errors.push(info));

    await ctrl.doActionsGroup(0);

    assert.deepEqual(executed, ['good']);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].sceneKey, 'test-scene');
    assert.equal(errors[0].groupKey, '0');
    assert.equal(errors[0].action.name, 'bad');
    assert.equal(errors[0].error.message, 'boom');
}

// --- Synchronous throw is isolated and reported, siblings still run ---

{
    const executed = [];
    const errors = [];
    const ctrl = makeController('[0]\nthrowing()\nafter()', action => {
        if (action.name === 'throwing')
            throw new Error('sync boom');

        executed.push(action.name);
    }, info => errors.push(info));

    await ctrl.doActionsGroup(0);

    assert.deepEqual(executed, ['after']);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].error.message, 'sync boom');
}

// --- Failed goto target is reported with the goto action as context ---

{
    const errors = [];

    const handleAction = ({ name, args }) => {
        if (name === 'goto')
            return ctrl.doActionsGroupByKey(String(args[0]));

        throw new Error(`Unknown action "${name}"`);
    };

    const ctrl = makeController('[0]\ngoto(nowhere)', handleAction, info => errors.push(info));

    await ctrl.doActionsGroup(0);

    assert.equal(errors.length, 1);
    assert.match(errors[0].error.message, /Group "nowhere" not found/);
    assert.equal(errors[0].action.name, 'goto');
    assert.equal(errors[0].groupKey, '0');
}

// --- Default error handler logs to console without breaking execution ---

{
    const originalError = console.error;
    let logged = '';
    console.error = (...args) => { logged += args.join(' '); };

    try {
        const ctrl = makeController('[0]\nbroken()', () => { throw new Error('x'); });
        await ctrl.doActionsGroup(0);
    } finally {
        console.error = originalError;
    }

    assert.match(logged, /\[scene "test-scene"\]/);
    assert.match(logged, /action "broken"/);
    assert.match(logged, /group \[0\]/);
}

// --- Group order stays sequential: next group runs after previous one ---

{
    const executed = [];
    const ctrl = makeController('[0]\na()\n[1]\nb()', action => {
        if (action.name === 'a')
            return Promise.reject(new Error('ignore me'));

        executed.push(action.name);
    });

    await ctrl.doNextActionsGroup();
    await ctrl.doNextActionsGroup();

    assert.deepEqual(executed, ['b']);
}

// --- Nested group failures are reported by their own group, not duplicated ---

{
    const errors = [];

    const handleAction = ({ name }) => {
        if (name === 'jump')
            return ctrl.doActionsGroupByKey('target');

        throw new Error('inner failure');
    };

    const ctrl = makeController('[0]\njump()\n[target]\nexploding()', handleAction, info => errors.push(info));

    await ctrl.doActionsGroup(0);

    assert.equal(errors.length, 1);
    assert.equal(errors[0].groupKey, 'target');
    assert.equal(errors[0].action.name, 'exploding');
}

// --- Handler guards produce descriptive errors instead of TypeErrors ---

{
    const handlers = createHandlersMap();
    const gameStub = {
        backgrounds: {},
        persons: {},
        stats: {},
        variables: {},
        expressionsParser: { evaluate: value => value },
        bgWrapper: { innerHTML: '', appendChild() {} },
    };

    assert.throws(
        () => handlers.action_setBackground.call(gameStub, ['unknown']),
        /Background "unknown" not found/
    );

    assert.throws(
        () => handlers.action_showPersonSprite.call(gameStub, ['vi.default']),
        /Person "vi" not found/
    );

    assert.throws(
        () => handlers.action_movePersonSprite.call(gameStub, ['vi.default', 0.5, 0.5]),
        /Person "vi" not found/
    );

    assert.throws(
        () => handlers.action_addStats.call(gameStub, ['alive', 1]),
        /Stat "alive" not found/
    );
}

// --- PersonController.show guard ---

{
    const person = new PersonController('Vi', {});
    assert.throws(() => person.show('smile'), /Sprite "smile" not found for person "Vi"/);
}

// --- Unknown action guard in Game.handleAction ---

{
    const gameLike = { handlersMap: {} };
    assert.throws(
        () => Game.prototype.handleAction.call(gameLike, { name: 'nope', args: [] }),
        /Unknown action "nope"/
    );
}

console.log('All runtime error tests passed!');

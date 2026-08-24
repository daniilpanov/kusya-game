import { strict as assert } from 'assert';
import {
    ACTION_ADAPTERS,
    getAdapter,
    POSITION_PRESETS,
    clamp01,
    formatAnchor,
    buildEditorContext,
    assetURL,
} from '#/editor-adapters.js';
import { getKnownActionNames } from '#/actions.js';

{
    // every registered adapter points at a real scene action and follows the contract
    const known = new Set(getKnownActionNames());
    for (const [name, adapter] of Object.entries(ACTION_ADAPTERS)) {
        assert.equal(known.has(name), true, `adapter "${name}" targets unknown action`);
        assert.equal(typeof adapter.title, 'string', `${name}: title`);
        assert.notEqual(adapter.title, '', `${name}: title not empty`);
        assert.equal(typeof adapter.mount, 'function', `${name}: mount`);
    }
}

{
    assert.equal(getAdapter('nope'), null);
}

{
    // coordinate helpers
    assert.deepEqual(
        POSITION_PRESETS.map(preset => preset.id),
        ['left', 'center', 'right'],
    );
    assert.equal(clamp01(-0.5), 0);
    assert.equal(clamp01(1.5), 1);
    assert.equal(clamp01('0.25'), 0.25);
    assert.equal(formatAnchor(0.123456), '0.123'); // 3 decimals keep .act readable
    assert.equal(formatAnchor('0.5'), '0.5');
}

{
    // context flattens the demo descriptor into adapter-friendly lists
    const context = buildEditorContext({
        persons: {
            vi: { name: 'Vi', sprites: { default: 'sprites/vi/def.png', smile: 'sprites/vi/smile.png' } },
        },
        backgrounds: { 1: { src: 'bg/bg1.png' } },
        scenes: { s1: {}, s2: {} },
        templates: { dialog: 'dialog_template.html', styles: '' },
    }, 'resources/games/game_1_demo');

    assert.deepEqual(context.templates, {
        dialog: 'resources/games/game_1_demo/dialog_template.html',
    });

    assert.deepEqual(context.persons, [{
        id: 'vi',
        name: 'Vi',
        sprites: [
            { id: 'default', url: 'resources/games/game_1_demo/sprites/vi/def.png' },
            { id: 'smile', url: 'resources/games/game_1_demo/sprites/vi/smile.png' },
        ],
    }]);
    assert.deepEqual(context.backgrounds, [{ id: '1', url: 'resources/games/game_1_demo/bg/bg1.png' }]);
    assert.deepEqual(context.scenes, ['s1', 's2']);
}

{
    assert.equal(buildEditorContext(null, 'x'), null);
    assert.equal(assetURL('g', ''), null);
    assert.equal(assetURL('g', undefined), null);
}

console.log('All editor-adapters tests passed!');

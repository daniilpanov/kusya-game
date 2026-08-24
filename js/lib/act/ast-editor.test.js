import { strict as assert } from 'assert';
import {
    createGroup, createAction,
    insertGroup, removeGroup, moveGroup, renameGroupKey,
    insertAction, removeAction, moveAction,
    findGroupKeyError,
} from '#/lib/act/ast-editor.js';

const makeAst = () => ({
    groups: [
        { key: 'a', actions: [{ name: 'x', args: [1] }] },
        { key: 'b', actions: [] },
        { key: 'c', actions: [{ name: 'y', args: [] }, { name: 'z', args: ['s'] }] },
    ],
});

{
    const ast = makeAst();
    assert.deepEqual(createGroup('g'), { key: 'g', actions: [] });
    assert.deepEqual(createAction('doIt', [1, 's']), { name: 'doIt', args: [1, 's'] });
    // args array is copied
    const src = [1];
    const action = createAction('n', src);
    src.push(2);
    assert.deepEqual(action.args, [1]);
}

{
    const ast = makeAst();
    insertGroup(ast, 1, createGroup('new'));
    assert.deepEqual(ast.groups.map(g => g.key), ['a', 'new', 'b', 'c']);

    removeGroup(ast, 2);
    assert.deepEqual(ast.groups.map(g => g.key), ['a', 'new', 'c']);
}

{
    const ast = makeAst();
    assert.equal(moveGroup(ast, 0, 2), true);
    assert.deepEqual(ast.groups.map(g => g.key), ['b', 'c', 'a']);
    // no-op moves report false and keep order
    assert.equal(moveGroup(ast, 1, 1), false);
    assert.equal(moveGroup(ast, -1, 0), false);
    assert.equal(moveGroup(ast, 5, 0), false);
    assert.deepEqual(ast.groups.map(g => g.key), ['b', 'c', 'a']);
}

{
    const group = makeAst().groups[0];
    renameGroupKey(group, 'renamed');
    assert.equal(group.key, 'renamed');
}

{
    const ast = makeAst();
    insertAction(ast.groups[1], 0, createAction('first'));
    assert.deepEqual(ast.groups[1].actions.map(a => a.name), ['first']);

    removeAction(ast.groups[1], 0);
    assert.deepEqual(ast.groups[1].actions, []);
}

{
    const ast = makeAst();
    assert.equal(moveAction(ast.groups[2], 0, 1), true);
    assert.deepEqual(ast.groups[2].actions.map(a => a.name), ['z', 'y']);
    assert.equal(moveAction(ast.groups[2], 7, 0), false);
    assert.deepEqual(ast.groups[2].actions.map(a => a.name), ['z', 'y']);
}

{
    const ast = makeAst();
    assert.equal(findGroupKeyError(ast, 'd'), null);
    assert.match(findGroupKeyError(ast, ''), /Пустой/);
    assert.match(findGroupKeyError(ast, '   '), /Пустой/);
    assert.match(findGroupKeyError(ast, 'b'), /уже существует/);

    // renaming group at index 0 to its own key is fine
    assert.equal(findGroupKeyError(ast, 'a', 0), null);
    // ...but taking another group's key is not
    assert.match(findGroupKeyError(ast, 'a', 1), /уже существует/);
}

console.log('All ast-editor tests passed!');

import { strict as assert } from 'assert';
import { buildFlowGraph, resolveEdgeAction, EDGE_KINDS } from '#/lib/flow/flow-graph.js';

// Lightweight stand-in: tests only need {key, actions:[{name,args}]}
const parseGroups = source => {
    const groups = [];
    let current = null;
    for (const line of source.split('\n')) {
        const text = line.trim();
        if (!text) continue;

        if (text.startsWith('[')) {
            current = { key: text.slice(1, -1), actions: [] };
            groups.push(current);
            continue;
        }

        const match = text.match(/^(\w+)\((.*)\)(?::\s*(.+))?$/);
        const stripQuotes = value =>
            value.length > 1 && value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
        const args = match && match[2] ? match[2].split(',').map(s => stripQuotes(s.trim())) : [];
        if (match && match[3])
            args.push(stripQuotes(match[3].trim()));
        current.actions.push({ name: match ? match[1] : text, args });
    }
    return groups;
};

{
    // goto suppresses its own fall-through; showTitle does not
    const groups = parseGroups('[0]\ngoto(2)\n[1]\nshowPhrase("t")\n[2]\nend()');
    const graph = buildFlowGraph({ groups, sceneKeys: ['s1'] });

    assert.deepEqual(graph.nodes.map(node => node.key), ['0', '1', '2']);
    assert.equal(graph.nodes[2].hasEnd, true);

    assert.deepEqual(
        graph.edges.map(edge => `${edge.from}->${edge.to}:${edge.kind}`).sort(),
        ['0->2:goto', '1->2:implicit'].sort(),
    );
}

{
    // demo-like scene: ifs do NOT suppress implicit; chips for scene exits
    const groups = parseGroups(
        '[4]\nshowPhrase("x")\nif(a == "1"): 5\nif(a != "1"): 7\n' +
        '[5]\ngoto(9)\n[6]\nsetVar(score, score + 1)\n[7]\ngotoScene("s2")\n[8]\ngotoNextScene()\n[9]\nend()');
    const graph = buildFlowGraph({ groups, sceneKeys: ['s1'] });

    const fromFirst = graph.edges.filter(edge => edge.from === 0).map(edge => edge.kind).sort();
    assert.deepEqual(fromFirst, ['if', 'if', 'implicit'].sort());

    const ifEdges = graph.edges.filter(edge => edge.kind === EDGE_KINDS.IF);
    assert.deepEqual(ifEdges.map(edge => edge.targetKey), ['5', '7']);
    assert.equal(ifEdges[0].label, 'a == "1"');

    const sceneEdge = graph.edges.find(edge => edge.kind === EDGE_KINDS.SCENE);
    assert.equal(sceneEdge.sceneKey, 's2');
    assert.equal(sceneEdge.broken, true); // s2 is not among sceneKeys

    const nextScene = graph.edges.find(edge => edge.kind === EDGE_KINDS.NEXT_SCENE);
    assert.equal(nextScene.from, 4); // group [8] sits at index 4

    assert.equal(graph.nodes.find(node => node.key === '9').hasEnd, true);
}

{
    // broken internal target -> ghost edge without destination
    const groups = parseGroups('[0]\ngoto(42)\n[1]\nx()');
    const graph = buildFlowGraph({ groups });
    const ghost = graph.edges.find(edge => edge.broken);
    assert.equal(ghost.targetKey, '42');
    assert.equal(ghost.to, null);
}

{
    // edge ids unique and stable across rebuilds
    const source = '[a]\ngoto(b)\n[b]\nif(x): c\n[c]';
    const first = buildFlowGraph({ groups: parseGroups(source) });
    const second = buildFlowGraph({ groups: parseGroups(source) });
    assert.deepEqual(first.edges.map(edge => edge.id), second.edges.map(edge => edge.id));
}

{
    // resolveEdgeAction: exact position first, then by content after shifts
    const groups = parseGroups('[0]\ngoto(y)\ngoto(y)\nif(c): y\n[1]');
    const graph = buildFlowGraph({ groups });

    const gotoEdges = graph.edges.filter(edge => edge.kind === EDGE_KINDS.GOTO && edge.targetKey === 'y');
    assert.equal(resolveEdgeAction(groups[0], gotoEdges[0]), 0);
    assert.equal(resolveEdgeAction(groups[0], gotoEdges[1]), 1);

    groups[0].actions.splice(0, 1); // indices shift after deletion
    assert.equal(resolveEdgeAction(groups[0], gotoEdges[0]), 0); // re-resolved by content

    const ifY = graph.edges.find(edge => edge.kind === EDGE_KINDS.IF);
    assert.equal(resolveEdgeAction(groups[0], ifY), 1);

    groups[0].actions[1].args[1] = 'zz'; // condition changed -> identity gone
    assert.equal(resolveEdgeAction(groups[0], ifY), -1);
}

console.log('All flow-graph tests passed!');

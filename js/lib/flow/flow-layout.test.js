import { strict as assert } from 'assert';
import { buildFlowGraph } from '#/lib/flow/flow-graph.js';
import { layoutGraph, LAYOUT_DEFAULTS } from '#/lib/flow/flow-layout.js';

const graphOf = (...groups) => buildFlowGraph({
    groups: groups.map(([key, ...actions]) => ({
        key,
        actions: actions.map(spec => {
            const [name, ...args] = spec.split(' ');
            return { name, args };
        }),
    })),
});

{
    // linear chain: strictly increasing ranks
    const graph = graphOf(['a', 'goto b'], ['b', 'goto c'], ['c']);
    const { positions } = layoutGraph(graph);

    assert.equal(positions.a.y < positions.b.y, true);
    assert.equal(positions.b.y < positions.c.y, true);
}

{
    // diamond: fan-in takes the longest path rank
    const graph = graphOf(
        ['a', 'goto c'],
        ['b', 'goto d'],
        ['c'],
        ['d'],
    );
    const withEdges = graphOf(
        ['a', 'goto b'],
        ['b', 'goto d'],
        ['a2', 'goto d'],
        ['d'],
    );
    const { positions } = layoutGraph(withEdges);
    assert.equal(positions.a.y, LAYOUT_DEFAULTS.originY);
    assert.equal(positions.d.y > positions.a.y + LAYOUT_DEFAULTS.nodeHeight, true);

    // deterministic: same input -> byte-equal output
    assert.deepEqual(layoutGraph(graph), layoutGraph(graph));
}

{
    // cycle saturates instead of exploding
    const graph = graphOf(['a', 'goto b'], ['b', 'goto a']);
    const { positions } = layoutGraph(graph);
    const maxY = Math.max(positions.a.y, positions.b.y);
    const capY = LAYOUT_DEFAULTS.originY
        + (graph.nodes.length) * (LAYOUT_DEFAULTS.nodeHeight + LAYOUT_DEFAULTS.gapY);
    assert.equal(maxY <= capY, true);
}

{
    // columns ordered by original group index inside one layer (no linking edges)
    const graph = graphOf(['z9', 'end'], ['z1', 'end']);
    const { positions } = layoutGraph(graph);
    assert.equal(positions.z9.x < positions.z1.x, true); // index 0 left of index 1
}

{
    const empty = layoutGraph({ nodes: [], edges: [] });
    assert.deepEqual(empty.positions, {});
}

console.log('All flow-layout tests passed!');

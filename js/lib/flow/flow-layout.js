// Pure layered layout for the flow graph: ranks via capped longest-path
// relaxation (cycle-safe), columns ordered by original group index.
// Deterministic — same graph in, same positions out.

export const LAYOUT_DEFAULTS = {
    nodeWidth: 180,
    nodeHeight: 70,
    gapX: 70,
    gapY: 90,
    originX: 40,
    originY: 40,
};

export function layoutGraph(graph, options = {}) {
    const { nodeWidth, nodeHeight, gapX, gapY, originX, originY } = { ...LAYOUT_DEFAULTS, ...options };
    const nodes = graph.nodes;
    if (!nodes.length)
        return { positions: {}, size: { width: nodeWidth, height: nodeHeight } };

    // Internal edges only: broken targets and scene chips do not affect ranking
    const internal = graph.edges.filter(edge => edge.to !== null);

    const rank = new Map(nodes.map(node => [node.key, 0]));

    // Relax at most nodes.length times: cycles saturate instead of exploding.
    // Edges reference sources by index, ranks are keyed by group key.
    const keyOfIndex = nodes.map(node => node.key);
    for (let pass = 0; pass < nodes.length; pass++) {
        let changed = false;
        for (const edge of internal) {
            const next = rank.get(keyOfIndex[edge.from]) + 1;
            if (next > rank.get(edge.to) && next <= nodes.length) {
                rank.set(edge.to, next);
                changed = true;
            }
        }
        if (!changed) break;
    }

    const byRank = new Map();
    for (const node of nodes) {
        const level = rank.get(node.key);
        if (!byRank.has(level)) byRank.set(level, []);
        byRank.get(level).push(node);
    }

    const positions = {};
    let maxWidth = 0;
    const levels = [...byRank.keys()].sort((a, b) => a - b);
    for (const level of levels) {
        const layer = byRank.get(level).sort((a, b) => a.index - b.index);
        maxWidth = Math.max(maxWidth, layer.length);
        layer.forEach((node, column) => {
            positions[node.key] = {
                x: originX + column * (nodeWidth + gapX),
                y: originY + level * (nodeHeight + gapY),
            };
        });
    }

    return {
        positions,
        size: {
            width: originX * 2 + maxWidth * nodeWidth + (maxWidth - 1) * gapX,
            height: originY * 2 + (levels.length - 1) * (nodeHeight + gapY) + nodeHeight,
        },
    };
}

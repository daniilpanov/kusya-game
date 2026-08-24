// Pure AST -> flow graph extraction for the scene editor graph view.
// No DOM here — covered by unit tests. Renderer (js/editor-graph.js) draws the model.

export const EDGE_KINDS = {
    GOTO: 'goto',        // goto(label) — solid
    IF: 'if',            // if(condition): label — dashed, labeled with condition
    SCENE: 'scene',      // gotoScene(key) — edge to a scene chip
    NEXT_SCENE: 'next-scene', // gotoNextScene() — chip «следующая сцена»
    IMPLICIT: 'implicit',     // fall-through to the next group — thin dotted
};

// Actions that redirect execution away, suppressing the implicit fall-through edge.
const JUMPERS = new Set(['goto', 'gotoScene', 'gotoNextScene', 'end']);

let edgeSeq = 0;

export function buildFlowGraph({ groups = [], sceneKeys = [] } = {}) {
    edgeSeq = 0;
    const keySet = new Set(groups.map(group => String(group.key)));
    const nodes = groups.map((group, index) => ({
        key: String(group.key),
        index,
        actionCount: group.actions.length,
        hasEnd: group.actions.some(action => action.name === 'end'),
    }));

    const edges = [];
    const addEdge = edge => edges.push({ id: `e${edgeSeq++}`, ...edge });

    groups.forEach((group, index) => {
        group.actions.forEach((action, actionIndex) => {
            switch (action.name) {
                case 'goto': {
                    const target = String(action.args[0]);
                    addEdge({
                        from: index, kind: EDGE_KINDS.GOTO, actionIndex,
                        to: keySet.has(target) ? target : null,
                        targetKey: target,
                        broken: !keySet.has(target),
                    });
                    break;
                }
                case 'if': {
                    const target = String(action.args[1]);
                    addEdge({
                        from: index, kind: EDGE_KINDS.IF, actionIndex,
                        label: String(action.args[0]),
                        to: keySet.has(target) ? target : null,
                        targetKey: target,
                        broken: !keySet.has(target),
                    });
                    break;
                }
                case 'gotoScene': {
                    const sceneKey = String(action.args[0]);
                    addEdge({
                        from: index, kind: EDGE_KINDS.SCENE, actionIndex,
                        to: null, sceneKey,
                        broken: !sceneKeys.includes(sceneKey),
                    });
                    break;
                }
                case 'gotoNextScene':
                    addEdge({ from: index, kind: EDGE_KINDS.NEXT_SCENE, actionIndex, to: null });
                    break;
            }
        });

        // Implicit fall-through: only when nothing in the group redirects execution.
        const jumpsAway = group.actions.some(action => JUMPERS.has(action.name));
        if (!jumpsAway && index < groups.length - 1)
            addEdge({ from: index, to: String(groups[index + 1].key), kind: EDGE_KINDS.IMPLICIT });
    });

    return { nodes, edges };
}

// Find the action behind an edge again after indices may have shifted:
// resolve by (kind, target) inside the source group instead of a stored index.
export function resolveEdgeAction(group, edge) {
    if (!edge || edge.kind === EDGE_KINDS.IMPLICIT)
        return -1;

    const predicate = action => {
        switch (edge.kind) {
            case EDGE_KINDS.GOTO:
                return action.name === 'goto' && String(action.args[0]) === edge.targetKey;
            case EDGE_KINDS.IF:
                return action.name === 'if' && String(action.args[0]) === edge.label
                    && String(action.args[1]) === edge.targetKey;
            case EDGE_KINDS.SCENE:
                return action.name === 'gotoScene' && String(action.args[0]) === edge.sceneKey;
            case EDGE_KINDS.NEXT_SCENE:
                return action.name === 'gotoNextScene';
            default:
                return false;
        }
    };

    const at = edge.actionIndex;
    if (at !== undefined && group.actions[at] && predicate(group.actions[at]))
        return at; // fast path while positions are intact

    return group.actions.findIndex(predicate);
}

import Drawflow from '#/lib/drawflow/drawflow.js';
import { EDGE_KINDS } from '#/lib/flow/flow-graph.js';
import { layoutGraph } from '#/lib/flow/flow-layout.js';

const POSITIONS_STORAGE_KEY = 'kusya-flow-positions';
const KIND_TITLES = {
    [EDGE_KINDS.GOTO]: 'goto',
    [EDGE_KINDS.IF]: 'if',
    [EDGE_KINDS.SCENE]: 'gotoScene',
    [EDGE_KINDS.NEXT_SCENE]: 'gotoNextScene',
};
const SUMMARY_SOURCES = ['showPhrase', 'showPhrasePerson', 'showTitle', 'showChoice'];

const escapeHtml = value => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export class FlowGraphView {
    constructor({
        canvas,
        info,
        getData,
        onSelectGroup = () => {},
        onOpenGroup = () => {},
        onCreateGoto = () => {},
        onCreateIf = () => {},
        onDeleteEdgeAction = () => {},
        onStatusMessage = () => {},
    }) {
        this.$canvas = canvas;
        this.$info = info;
        this.getData = getData;
        this.onSelectGroup = onSelectGroup;
        this.onOpenGroup = onOpenGroup;
        this.onCreateGoto = onCreateGoto;
        this.onCreateIf = onCreateIf;
        this.onDeleteEdgeAction = onDeleteEdgeAction;
        this.onStatusMessage = onStatusMessage;

        this.editor = null;
        this.visible = false;
        this.syncing = false;

        this.graph = { nodes: [], edges: [] };
        this.nodeIdToKey = new Map();
        this.edgeByPort = new Map(); // "outNodeId|output_N" -> edge
        this.selectedEdge = null;
        this.labels = [];
        this.positionsKey = '';
    }

    start() {
        // Registered before editor.start(): swallow Delete so users cannot
        // desync the canvas from the AST; route it through the info bar instead.
        this.$canvas.addEventListener('keydown', event => {
            if (!['Delete', 'Backspace'].includes(event.key)) return;
            if (event.target.closest('input, textarea, [contenteditable]')) return;
            event.stopPropagation();
            if (this.selectedEdge)
                this.deleteSelectedEdge();
        }, true);

        this.editor = new Drawflow(this.$canvas);
        this.editor.start();

        this.editor.on('connectionCreated', payload => this.handleConnectionCreated(payload));
        this.editor.on('connectionRemoved', payload => this.handleConnectionRemoved(payload));
        this.editor.on('connectionSelected', payload => this.selectEdgeByPorts(payload));
        this.editor.on('connectionUnselected', () => this.selectEdge(null));
        this.editor.on('nodeSelected', nodeId => this.handleNodeSelected(nodeId));
        this.editor.on('nodeMoved', nodeId => this.saveNodePosition(nodeId));

        this.$canvas.addEventListener('dblclick', event => {
            const nodeEl = event.target.closest('.drawflow-node');
            if (!nodeEl) return;
            const key = this.nodeIdToKey.get(Number(nodeEl.id.slice(5)));
            if (key !== undefined) this.onOpenGroup(key);
        });
    }

    show(positionsKey) {
        this.visible = true;
        this.positionsKey = positionsKey;
        this.$canvas.classList.remove('hidden');
        this.sync();
    }

    hide() {
        this.visible = false;
        this.selectEdge(null);
        this.$canvas.classList.add('hidden');
    }

    syncIfVisible() {
        if (this.visible) this.sync();
    }

    loadSavedPositions() {
        try {
            const all = JSON.parse(localStorage.getItem(POSITIONS_STORAGE_KEY) ?? '{}');
            return all[this.positionsKey] ?? {};
        } catch {
            return {};
        }
    }

    savePositions(map) {
        try {
            const all = JSON.parse(localStorage.getItem(POSITIONS_STORAGE_KEY) ?? '{}');
            all[this.positionsKey] = map;
            localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(all));
        } catch {
            /* storage unavailable: positions stay session-only */
        }
    }

    saveNodePosition(nodeId) {
        if (this.syncing || !this.positionsKey) return;
        const key = this.nodeIdToKey.get(Number(nodeId));
        if (key === undefined) return;

        const el = document.getElementById(`node-${nodeId}`);
        const saved = this.loadSavedPositions();
        saved[key] = { x: parseInt(el.style.left), y: parseInt(el.style.top) };
        this.savePositions(saved);
    }

    handleNodeSelected(nodeId) {
        if (this.syncing) return;
        const key = this.nodeIdToKey.get(Number(nodeId));
        if (key !== undefined) this.onSelectGroup(key);
    }

    selectEdge(edge) {
        this.selectedEdge = edge;
        if (!edge) {
            this.$info.classList.add('hidden');
            this.$info.innerHTML = '';
            return;
        }

        const fromKey = this.groupKeyOfIndex(edge.from);
        let wire;
        if (edge.kind === EDGE_KINDS.IMPLICIT)
            wire = '──▶';
        else if (edge.kind === EDGE_KINDS.IF)
            wire = `-- if(${edge.label}) --▶`;
        else
            wire = `-- ${KIND_TITLES[edge.kind]} --▶`;

        const targetText = edge.to === null
            ? (edge.sceneKey ? `"${edge.sceneKey}" ⚠ сцена не найдена`
                : `"${edge.targetKey}" ⚠ группа не найдена`)
            : `[${this.groupKeyOfIndex(edge.to)}]`;

        this.$info.innerHTML = '';
        const label = document.createElement('span');
        label.className = 'flow-info-label';
        label.textContent = `[${fromKey}] ${wire} ${targetText}`;
        this.$info.appendChild(label);

        if (edge.kind !== EDGE_KINDS.IMPLICIT) {
            const openBtn = document.createElement('button');
            openBtn.textContent = 'Открыть карточку';
            openBtn.addEventListener('click', () => this.onOpenGroup(fromKey));
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'danger';
            deleteBtn.textContent = 'Удалить действие';
            deleteBtn.addEventListener('click', () => this.deleteSelectedEdge());
            this.$info.append(openBtn, deleteBtn);
        }
        this.$info.classList.remove('hidden');
    }

    deleteSelectedEdge() {
        const edge = this.selectedEdge;
        if (!edge || edge.kind === EDGE_KINDS.IMPLICIT) return;
        this.selectEdge(null);
        this.onDeleteEdgeAction(edge);
    }

    selectEdgeByPorts({ output_id, output_class }) {
        const edge = this.edgeByPort.get(`${output_id}|${output_class}`);
        if (edge) this.selectEdge(edge);
    }

    groupKeyOfIndex(index) {
        return this.graph.nodes[index]?.key ?? String(index);
    }

    handleConnectionCreated({ output_id, output_class, input_id }) {
        if (this.syncing) return;

        const sourceKey = this.nodeIdToKey.get(Number(output_id));
        const targetKey = this.nodeIdToKey.get(Number(input_id));
        if (sourceKey === undefined || targetKey === undefined) {
            this.onStatusMessage('Переходы рисуются между группами сцены');
            this.sync();
            return;
        }
        if (sourceKey === targetKey) {
            this.onStatusMessage('Петля внутри группы не создаётся');
            this.sync();
            return;
        }
        if (output_class !== 'output_1' && !/^output_\d+$/.test(output_class)) {
            this.sync();
            return;
        }

        const portIndex = Number(output_class.slice('output_'.length));
        if (portIndex > 1) {
            const condition = prompt(`Условие перехода [${sourceKey}] → [${targetKey}]:`, '');
            if (!condition?.trim()) {
                this.sync(); // cancelled: rebuild drops the raw wire
                return;
            }
            this.onCreateIf(sourceKey, targetKey, condition.trim());
        } else {
            this.onCreateGoto(sourceKey, targetKey);
        }
    }

    handleConnectionRemoved({ output_id, output_class }) {
        if (this.syncing) return;
        const edge = this.edgeByPort.get(`${output_id}|${output_class}`);
        if (!edge) return;
        if (edge.kind === EDGE_KINDS.IMPLICIT) {
            this.sync(); // derived edge: put the wire back
            return;
        }
        this.onDeleteEdgeAction(edge);
    }

    renderNodeHtml({ node, summary, brokenTargets, ifCount }) {
        const badges = [];
        if (node.hasEnd) badges.push('<span class="flow-badge end">end</span>');
        for (const broken of brokenTargets)
            badges.push(`<span class="flow-badge broken">⚠ ${escapeHtml(broken)}</span>`);

        return `<div class="flow-node${node.hasEnd ? ' flow-node-exit' : ''}">
            <div class="flow-node-key">[${escapeHtml(node.key)}]</div>
            <div class="flow-node-summary">${escapeHtml(summary)}</div>
            <div class="flow-node-badges">${badges.join('')}${ifCount
                ? `<span class="flow-badge if">×${ifCount} if</span>` : ''}</div>
        </div>`;
    }

    buildSummary(group) {
        const source = group.actions.find(action => SUMMARY_SOURCES.includes(action.name));
        if (!source)
            return group.actions.length ? `${group.actions.length} экшн(ов)` : 'пусто';
        const text = source.args.find(arg => typeof arg === 'string' && arg.length > 0)
            ?? source.args[1] ?? '';
        return String(text).length > 42 ? `${String(text).slice(0, 39)}…` : String(text);
    }

    placeLabels() {
        for (const span of this.labels) span.remove();
        this.labels = [];

        for (const edge of this.graph.edges) {
            if (edge.kind !== EDGE_KINDS.IF || edge.dfOut === undefined) continue;
            const path = document.querySelector(
                `.drawflow .connection.connection_out_node-${edge.dfOut}.output_${edge.port} path.main-path`);
            if (!path) continue;
            const box = path.getBBox();

            const span = document.createElement('span');
            span.className = 'flow-edge-label';
            span.textContent = edge.label;
            span.title = edge.label;
            span.style.left = `${box.x + box.width / 2}px`;
            span.style.top = `${box.y + box.height / 2}px`;
            this.editor.precanvas.appendChild(span);
            this.labels.push(span);
        }
    }

    sync() {
        if (!this.editor) return;

        this.syncing = true;
        try {
            this.editor.clear();
            this.nodeIdToKey.clear();
            this.edgeByPort.clear();
            for (const span of this.labels) span.remove();
            this.labels = [];
            this.selectEdge(null);

            const data = this.getData();
            if (!data) return;
            const { graph, groups } = data;
            this.graph = graph;

            const layout = layoutGraph(graph);
            const saved = this.loadSavedPositions();
            const ifCounts = new Map();
            for (const edge of graph.edges) {
                if (edge.kind !== EDGE_KINDS.IF) continue;
                const key = this.groupKeyOfIndex(edge.from);
                ifCountSet(ifCounts, key);
            }

            for (let i = 0; i < graph.nodes.length; i++) {
                const node = graph.nodes[i];
                const position = saved[node.key] ?? layout.positions[node.key];
                const brokenTargets = graph.edges
                    .filter(edge => edge.from === i && edge.broken && edge.targetKey)
                    .map(edge => edge.targetKey);
                const html = this.renderNodeHtml({
                    node,
                    summary: groups[i] ? this.buildSummary(groups[i]) : '',
                    brokenTargets,
                    ifCount: ifCounts.get(node.key) ?? 0,
                });
                const nodeId = this.editor.addNode(
                    'group', 1, 1 + (ifCounts.get(node.key) ?? 0),
                    position.x, position.y, 'flow-group-node',
                    { key: node.key }, html);
                this.nodeIdToKey.set(Number(nodeId), node.key);
            }

            const nextIfPort = new Map(); // source key -> next free if port (from 2)
            const idByKey = new Map([...this.nodeIdToKey].map(([id, key]) => [key, id]));
            for (const edge of graph.edges) {
                if (edge.to === null) continue;
                const outKey = this.groupKeyOfIndex(edge.from);
                const outId = idByKey.get(outKey);
                const inId = idByKey.get(edge.to);
                if (outId === undefined || inId === undefined) continue;

                let port = 1;
                if (edge.kind === EDGE_KINDS.IF) {
                    port = nextIfPort.get(outKey) ?? 2;
                    nextIfPort.set(outKey, port + 1);
                }
                this.editor.addConnection(outId, inId, `output_${port}`, 'input_1');
                this.edgeByPort.set(`${outId}|output_${port}`, edge);
                edge.dfOut = outId;
                edge.port = port;
            }
        } finally {
            this.syncing = false;
        }

        requestAnimationFrame(() => this.placeLabels());
    }
}

function ifCountSet(map, key) {
    map.set(key, (map.get(key) ?? 0) + 1);
}

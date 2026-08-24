import { Utils } from '#/utils.js';
import { ActParser } from '#/lib/act/act-parser.js';
import { ActSerializer } from '#/lib/act/act-serializer.js';
import { getKnownActionNames } from '#/actions.js';
import { describeAction, paletteByCategory, ACTION_CATEGORIES } from '#/action-specs.js';
import { argsToFormValues, formValuesToArgs, defaultFormValues, FieldError } from '#/editor-fields.js';
import {
    createGroup,
    createAction,
    insertGroup,
    removeGroup,
    moveGroup,
    renameGroupKey,
    insertAction,
    removeAction,
    moveAction,
    findGroupKeyError,
} from '#/lib/act/ast-editor.js';
import { buildFlowGraph, resolveEdgeAction } from '#/lib/flow/flow-graph.js';
import { FlowGraphView } from '#/editor-graph.js';
import { getAdapter, buildEditorContext, createStagePreview } from '#/editor-adapters.js';
import { openModal } from '#/editor-modal.js';
import '#/adapters/person-position.js';
import '#/adapters/phrase.js';
import '#/adapters/choice.js';
import '#/adapters/bg.js';
import '#/adapters/title.js';

export class ScenesEditor {
    constructor() {
        this.knownActions = getKnownActionNames();
        this.argFormatter = new ActSerializer();

        this.games = [];
        this.game = null;
        this.descriptor = null;
        this.sceneKey = null;
        this.sceneFileName = '';
        this.ast = null;
        this.selectedGroupIdx = -1;
        this.rawMode = new WeakSet();
        this.cardToAction = new WeakMap();
        this.cardForm = new WeakMap();
        this.editorContext = null;

        this.$gameSelect = document.getElementById('gameSelect');
        this.$sceneSelect = document.getElementById('sceneSelect');
        this.$exportBtn = document.getElementById('exportBtn');
        this.$saveBtn = document.getElementById('saveBtn');
        this.$addGroupBtn = document.getElementById('addGroupBtn');
        this.$addActionBtn = document.getElementById('addActionBtn');
        this.$statusBar = document.getElementById('statusBar');
        this.$groupsList = document.getElementById('groupsList');
        this.$actionsList = document.getElementById('actionsList');
        this.$currentGroupKey = document.getElementById('currentGroupKey');
        this.$paletteList = document.getElementById('paletteList');
        this.$flowToggleBtn = document.getElementById('flowToggleBtn');
        this.$flowWrap = document.getElementById('flowWrap');
        this.$flowCanvas = document.getElementById('flowCanvas');
        this.$flowInfo = document.getElementById('flowInfo');
        this.mode = 'cards';

        this.flowView = new FlowGraphView({
            canvas: this.$flowCanvas,
            info: this.$flowInfo,
            getData: () => this.currentFlowData(),
            onSelectGroup: key => this.selectGroupFromGraph(key),
            onOpenGroup: key => this.openGroupFromGraph(key),
            onCreateGoto: (src, dst) => this.createGotoFromGraph(src, dst),
            onCreateIf: (src, dst, condition) => this.createIfFromGraph(src, dst, condition),
            onDeleteEdgeAction: edge => this.deleteEdgeAction(edge),
            onStatusMessage: message => this.setStatus(message),
        });
    }

    async init() {
        this.$gameSelect.addEventListener('change', () => this.loadGame(this.$gameSelect.value).catch(e => this.setStatus(e.message, 'error')));
        this.$sceneSelect.addEventListener('change', () => this.loadScene(this.$sceneSelect.value).catch(e => this.setStatus(e.message, 'error')));
        this.$exportBtn.addEventListener('click', () => this.exportScene());
        this.$saveBtn.addEventListener('click', () => this.saveScene().catch(e => this.setStatus(e.message, 'error')));
        this.$addGroupBtn.addEventListener('click', () => this.addGroup());
        this.$addActionBtn.addEventListener('click', () => this.addAction());

        this.bindPaletteDropTargets();
        this.renderPalette();
        this.flowView.start();

        this.$flowToggleBtn.addEventListener('click', () =>
            this.setMode(this.mode === 'graph' ? 'cards' : 'graph'));

        await this.loadGames();
    }

    setStatus(message, type = '') {
        this.$statusBar.textContent = message;
        this.$statusBar.className = 'status-bar' + (message ? ' ' + type : '');
        if (type === 'success')
            setTimeout(() => {
                if (this.$statusBar.classList.contains('success'))
                    this.setStatus('');
            }, 4000);
    }

    async loadGames() {
        const data = await Utils.fetchJSON('/api/games');
        this.games = data.games;

        this.$gameSelect.innerHTML = '';
        this.$gameSelect.appendChild(new Option('Выберите игру...', ''));
        for (const game of this.games)
            this.$gameSelect.appendChild(new Option(game.title || game.resource, game.resource));
    }

    async loadGame(gameResource) {
        this.game = this.games.find(game => game.resource === gameResource) ?? null;
        this.editorContext = null;
        this.resetScene();

        if (!this.game) return;

        this.descriptor = await Utils.fetchTOML(this.game.descriptor);

        const sceneKeys = Object.keys(this.descriptor.scenes ?? {}).sort();
        this.$sceneSelect.innerHTML = '';
        this.$sceneSelect.appendChild(new Option('Выберите сцену...', ''));
        for (const key of sceneKeys)
            this.$sceneSelect.appendChild(new Option(`Сцена "${key}"`, key));

        this.$sceneSelect.disabled = sceneKeys.length === 0;
    }

    resetScene() {
        this.ast = null;
        this.sceneKey = null;
        this.selectedGroupIdx = -1;
        this.$sceneSelect.innerHTML = '<option value="">Сначала выберите игру</option>';
        this.$sceneSelect.disabled = true;
        this.$exportBtn.disabled = true;
        this.$saveBtn.disabled = true;
        this.$addGroupBtn.disabled = true;
        this.$addActionBtn.disabled = true;
        this.$flowToggleBtn.disabled = true;
        this.setMode('cards');
        this.renderGroups();
        this.renderActions();
    }

    async loadScene(sceneKey) {
        if (!this.descriptor?.scenes?.[sceneKey]) {
            this.resetScene();
            return;
        }

        const langPath = this.descriptor.scenes[sceneKey].RU;
        this.sceneKey = sceneKey;
        this.sceneFileName = langPath.split('/').pop();

        const response = await Utils.fetch(`${this.game.resource}/${langPath}`);
        const content = await response.text();
        this.ast = new ActParser({ content }).parse();

        this.selectedGroupIdx = this.ast.groups.length ? 0 : -1;
        this.$sceneSelect.value = sceneKey;
        this.$exportBtn.disabled = false;
        this.$saveBtn.disabled = false;
        this.$addGroupBtn.disabled = false;
        this.$flowToggleBtn.disabled = false;
        this.setStatus(`Сцена "${sceneKey}" загружена`, 'success');
        this.renderGroups();
        this.renderActions();
    }

    requireAst() {
        if (!this.ast)
            throw new Error('Сцена не загружена');
        return this.ast;
    }

    addGroup() {
        const ast = this.requireAst();
        const key = prompt('Ключ новой группы:');
        if (key === null) return;

        const error = findGroupKeyError(ast, key.trim());
        if (error)
            return this.setStatus(error, 'error');

        insertGroup(ast, ast.groups.length, createGroup(key.trim()));
        this.selectedGroupIdx = ast.groups.length - 1;
        this.renderGroups();
        this.renderActions();
    }

    renameGroup(index) {
        const ast = this.requireAst();
        const current = ast.groups[index].key;
        const key = prompt('Новый ключ группы:', current);
        if (key === null) return;

        const error = findGroupKeyError(ast, key.trim(), index);
        if (error)
            return this.setStatus(error, 'error');

        renameGroupKey(ast.groups[index], key.trim());
        this.renderGroups();
        this.renderActions();
    }

    deleteGroup(index) {
        const ast = this.requireAst();
        if (!confirm(`Удалить группу "${ast.groups[index].key}" со всеми экшнами?`))
            return;

        removeGroup(ast, index);
        if (this.selectedGroupIdx >= ast.groups.length)
            this.selectedGroupIdx = ast.groups.length - 1;
        this.renderGroups();
        this.renderActions();
    }

    moveGroupBy(index, delta) {
        const ast = this.requireAst();
        const target = index + delta;
        if (target < 0 || target >= ast.groups.length) return;
        moveGroup(ast, index, target);
        if (this.selectedGroupIdx === index)
            this.selectedGroupIdx = target;
        this.renderGroups();
        this.renderActions();
    }

    selectGroup(index) {
        this.selectedGroupIdx = index;
        this.renderGroups();
        this.renderActions();
    }

    setMode(mode) {
        if (mode === this.mode) return;
        if (mode === 'graph' && !this.ast) return;

        this.mode = mode;
        const graph = mode === 'graph';
        document.querySelector('.editor-layout').classList.toggle('hidden', graph);
        this.$flowWrap.classList.toggle('hidden', !graph);
        this.$flowToggleBtn.textContent = graph ? '☰ Карточки' : '⬡ Граф';

        if (graph)
            this.flowView.show(`${this.game.resource}|${this.sceneFileName}`);
        else
            this.flowView.hide();
    }

    currentFlowData() {
        if (!this.ast || !this.descriptor) return null;
        return {
            groups: this.ast.groups,
            graph: buildFlowGraph({
                groups: this.ast.groups,
                sceneKeys: Object.keys(this.descriptor.scenes ?? {}),
            }),
        };
    }

    groupByKey(key) {
        return this.ast?.groups.find(group => String(group.key) === String(key)) ?? null;
    }

    selectGroupFromGraph(key) {
        const index = this.ast?.groups.findIndex(group => String(group.key) === key);
        if (index === undefined || index === -1) return;

        // Light update: rebuilding everything would interrupt canvas dragging
        this.selectedGroupIdx = index;
        [...this.$groupsList.children].forEach((el, i) =>
            el.classList.toggle('selected', i === index));
        this.$currentGroupKey.textContent = this.ast.groups[index].key;
    }

    openGroupFromGraph(key) {
        const index = this.ast?.groups.findIndex(group => String(group.key) === key);
        if (index === undefined || index === -1) return;
        this.setMode('cards');
        this.selectGroup(index);
    }

    createGotoFromGraph(sourceKey, targetKey) {
        const group = this.groupByKey(sourceKey);
        if (!group) return;

        insertAction(group, group.actions.length, createAction('goto', [targetKey]));
        this.renderGroups();
        this.renderActions();
        this.setStatus(`[${sourceKey}] → goto(${targetKey}) добавлен`);
    }

    createIfFromGraph(sourceKey, targetKey, condition) {
        const group = this.groupByKey(sourceKey);
        if (!group) return;

        insertAction(group, group.actions.length, createAction('if', [condition, targetKey]));
        this.renderGroups();
        this.renderActions();
        this.setStatus(`[${sourceKey}] → if(${condition}): ${targetKey} добавлен`);
    }

    deleteEdgeAction(edge) {
        const group = this.ast?.groups[edge.from];
        if (!group) return;

        const index = resolveEdgeAction(group, edge);
        if (index === -1)
            return this.setStatus('Действие перехода не найдено в группе', 'error');

        removeAction(group, index);
        this.renderGroups();
        this.renderActions();
        this.setStatus(`Переход из [${group.key}] удалён`);
    }

    addAction() {
        const ast = this.requireAst();
        if (this.selectedGroupIdx === -1)
            return this.setStatus('Сначала выберите группу', 'error');

        const group = ast.groups[this.selectedGroupIdx];
        insertAction(group, group.actions.length, createAction('end'));
        this.renderGroups();
        this.renderActions();
    }

    buildSceneText() {
        const ast = this.requireAst();
        const text = new ActSerializer().serialize(ast);

        // Safety net: serialized text must reparse into the same AST
        const reparsed = new ActParser({ content: text }).parse().groups;
        if (JSON.stringify(reparsed) !== JSON.stringify(ast.groups))
            throw new Error('round-trip проверка не совпала');

        return text;
    }

    exportScene() {
        let text;
        try {
            text = this.buildSceneText();
        } catch (error) {
            return this.setStatus(`Экспорт невозможен: ${error.message}`, 'error');
        }

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = this.sceneFileName || 'scene.act';
        link.click();
        URL.revokeObjectURL(link.href);
        this.setStatus(`Файл ${link.download} сохранён`, 'success');
    }

    async saveScene() {
        let text;
        try {
            text = this.buildSceneText();
        } catch (error) {
            return this.setStatus(`Сохранение невозможно: ${error.message}`, 'error');
        }

        this.$saveBtn.disabled = true;
        try {
            await Utils.fetchJSON(`/api/games/${this.game.resource.split('/').pop()}/scenes/${encodeURIComponent(this.sceneFileName)}`, {
                method: 'POST',
                body: { content: text },
            });
            this.setStatus(`Сцена "${this.sceneKey}" сохранена на сервер`, 'success');
        } catch (error) {
            this.setStatus(`Не удалось сохранить: ${error.message}`, 'error');
        } finally {
            this.$saveBtn.disabled = false;
        }
    }

    refreshVarsDatalist() {
        const names = new Set();
        for (const group of this.ast?.groups ?? [])
            for (const action of group.actions)
                if (['setVar', 'addVar'].includes(action.name) && typeof action.args[0] === 'string')
                    names.add(action.args[0]);

        const datalist = document.getElementById('varsList');
        if (!datalist) return;
        datalist.innerHTML = '';
        for (const name of names)
            datalist.appendChild(new Option(name));
    }

    renderGroups() {
        this.refreshVarsDatalist();
        this.$groupsList.innerHTML = '';
        this.$currentGroupKey.textContent = this.selectedGroupIdx >= 0 && this.ast
            ? this.ast.groups[this.selectedGroupIdx]?.key : '—';

        if (!this.ast) return;

        this.ast.groups.forEach((group, index) => {
            const item = document.createElement('li');
            item.className = 'group-item' + (index === this.selectedGroupIdx ? ' selected' : '');

            const keyEl = document.createElement('span');
            keyEl.className = 'group-key';
            keyEl.textContent = group.key;
            keyEl.addEventListener('click', () => this.selectGroup(index));

            const countEl = document.createElement('span');
            countEl.className = 'group-actions-count';
            countEl.textContent = String(group.actions.length);

            const upBtn = this.makeIconBtn('↑', () => this.moveGroupBy(index, -1));
            const downBtn = this.makeIconBtn('↓', () => this.moveGroupBy(index, 1));
            const editBtn = this.makeIconBtn('✎', () => this.renameGroup(index));
            const delBtn = this.makeIconBtn('✕', () => this.deleteGroup(index));

            item.append(keyEl, countEl, upBtn, downBtn, editBtn, delBtn);
            this.$groupsList.appendChild(item);
        });

        this.flowView.syncIfVisible();
    }

    renderActions() {
        this.$actionsList.innerHTML = '';
        this.$addActionBtn.disabled = !(this.ast && this.selectedGroupIdx >= 0);
        if (!this.ast || this.selectedGroupIdx === -1) {
            this.$actionsList.appendChild(this.makeHint(this.ast
                ? 'Выберите группу слева'
                : 'Загрузите сцену для редактирования'));
            return;
        }

        const group = this.ast.groups[this.selectedGroupIdx];
        if (!group.actions.length)
            this.$actionsList.appendChild(this.makeHint('Группа пуста — добавьте первый экшн'));

        group.actions.forEach((action, index) =>
            this.$actionsList.appendChild(this.buildActionCard(group, index)));
    }

    buildActionCard(group, index) {
        const action = group.actions[index];
        const spec = describeAction(action.name);
        const conversion = spec && !this.rawMode.has(action)
            ? argsToFormValues(spec, action.args)
            : { ok: false };

        let card;
        if (spec && conversion.ok)
            card = this.buildTypedCard(group, index, spec, conversion.values);
        else
            card = this.buildRawCard(group, index, spec ? null : `Неизвестный экшн "${action.name}"`);

        this.cardToAction.set(card, action);
        return card;
    }

    openActionAdapter(card) {
        const action = this.cardToAction.get(card);
        const form = this.cardForm.get(card);
        const adapter = action && getAdapter(action.name);

        if (!adapter || !form) return;

        if (!this.editorContext)
            this.editorContext = buildEditorContext(this.descriptor, this.game?.resource);

        const values = {};
        for (const [key, input] of Object.entries(form.inputs))
            values[key] = input.value;
        if (form.spec?.rest && form.restContainer)
            values[form.spec.rest.key] = [...form.restContainer.querySelectorAll('input')]
                .map(input => input.value);

        let controller = null;
        const content = document.createElement('div');
        content.className = 'adapter-body';

        const ctx = {
            container: content,
            values,
            context: this.editorContext,
            spec: form.spec,
            makeStage: options => createStagePreview(this.editorContext, options),
            onChange: patch => Object.assign(values, patch),
        };

        try {
            controller = adapter.mount(ctx);
        } catch (error) {
            return this.setStatus(`Адаптер не запустился: ${error.message}`, 'error');
        }

        openModal({ title: adapter.title, content, wide: true }).then(saved => {
            if (!saved || !controller) return;
            const patch = controller.save();
            if (!patch) return;
            for (const [key, value] of Object.entries(patch)) {
                if (form.spec?.rest && key === form.spec.rest.key && form.setRestValues) {
                    form.setRestValues(value); // rebuilds variant rows + applies
                    continue;
                }
                const input = form.inputs[key];
                if (input)
                    input.value = String(value);
            }
            form.collectAndApply();
            this.setStatus(`Визуальный редактор: «${adapter.title}» применён`, 'success');
        });
    }

    makeCardShell(group, index, badgeText) {
        const card = document.createElement('div');
        card.className = 'action-card';

        const row = document.createElement('div');
        row.className = 'action-row';

        const order = document.createElement('span');
        order.className = 'action-order';
        order.textContent = `${index + 1}.`;

        row.appendChild(order);
        if (badgeText) {
            const badge = document.createElement('span');
            badge.className = 'action-badge';
            badge.textContent = badgeText;
            row.appendChild(badge);
        }

        const controls = document.createElement('span');
        controls.className = 'action-controls';
        controls.append(
            this.makeIconBtn('↑', () => { moveAction(group, index, index - 1); this.renderActions(); }),
            this.makeIconBtn('↓', () => { moveAction(group, index, index + 1); this.renderActions(); }),
        );
        row.appendChild(controls);

        const errorEl = document.createElement('div');
        errorEl.className = 'action-error';

        card.append(row, errorEl);
        return { card, row, errorEl };
    }

    buildTypedCard(group, index, spec, values) {
        const action = group.actions[index];
        const { card, row, errorEl } = this.makeCardShell(group, index, spec.title);
        card.classList.add('typed');

        const rawBtn = this.makeIconBtn('⌗', () => {
            this.rawMode.add(action);
            this.renderActions();
        });
        rawBtn.title = 'Редактировать как сырую строку';
        row.querySelector('.action-controls').append(rawBtn,
            this.makeIconBtn('✕', () => { removeAction(group, index); this.renderGroups(); this.renderActions(); }));

        if (getAdapter(action.name)) {
            const artBtn = this.makeIconBtn('🎨', () => this.openActionAdapter(card));
            artBtn.title = 'Визуальный редактор';
            row.querySelector('.action-controls').prepend(artBtn);
        }

        const inputs = {};
        const restContainer = spec.rest ? document.createElement('div') : null;

        const collectAndApply = () => {
            try {
                const restValues = restContainer
                    ? [...restContainer.querySelectorAll('input')].map(input => input.value)
                    : [];
                action.args = formValuesToArgs(spec, inputs, restValues);
                errorEl.textContent = '';
                card.classList.remove('invalid');
                this.renderGroups();
            } catch (error) {
                errorEl.textContent = error instanceof FieldError ? error.message : error.message;
                card.classList.add('invalid');
            }
        };

        const fieldsBox = document.createElement('div');
        fieldsBox.className = 'action-fields';

        for (const fieldSpec of spec.args ?? []) {
            const fieldRow = this.makeTypedField(fieldSpec, values[fieldSpec.key], collectAndApply);
            inputs[fieldSpec.key] = fieldRow.input;
            fieldsBox.appendChild(fieldRow.wrap);
        }

        if (spec.trailingBool) {
            const fieldRow = this.makeTypedField(
                { ...spec.trailingBool, kind: 'bool' },
                values[spec.trailingBool.key],
                collectAndApply,
            );
            inputs[spec.trailingBool.key] = fieldRow.input;
            fieldsBox.appendChild(fieldRow.wrap);
        }

        if (restContainer) {
            const restLabel = document.createElement('div');
            restLabel.className = 'field-label';
            restLabel.textContent = `${spec.rest.label}:`;
            restContainer.className = 'rest-fields';

            const addVariant = value => {
                const wrap = document.createElement('div');
                wrap.className = 'field-row compact';
                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = 'вариант ответа';
                input.value = value ?? '';
                input.addEventListener('change', collectAndApply);
                const del = this.makeIconBtn('✕', () => { wrap.remove(); collectAndApply(); });
                wrap.append(input, del);
                restContainer.appendChild(wrap);
            };

            for (const variant of values[spec.rest.key] ?? [''])
                addVariant(variant);

            const addBtn = document.createElement('button');
            addBtn.className = 'mini-btn';
            addBtn.type = 'button';
            addBtn.textContent = '+ вариант';
            addBtn.addEventListener('click', () => { addVariant(''); collectAndApply(); });

            const setRestValues = newValues => {
                restContainer.innerHTML = '';
                for (const value of (newValues.length ? newValues : ['']))
                    addVariant(value);
                collectAndApply();
            };

            const restBox = document.createElement('div');
            restBox.append(restLabel, restContainer, addBtn);
            fieldsBox.appendChild(restBox);
        }

        card.appendChild(fieldsBox);
        this.cardForm.set(card, { spec, inputs, restContainer, collectAndApply, setRestValues });
        return card;
    }

    makeTypedField(fieldSpec, value, onChange) {
        const wrap = document.createElement('div');
        wrap.className = 'field-row';

        const label = document.createElement('label');
        label.className = 'field-label';
        label.textContent = fieldSpec.label;
        wrap.appendChild(label);

        let input;
        const options = this.descriptorSelectOptions(fieldSpec.kind);

        if (Array.isArray(options)) {
            input = document.createElement('select');
            input.appendChild(new Option(fieldSpec.optional ? '—' : 'выберите…', ''));
            for (const option of options)
                input.appendChild(new Option(option.label, option.value));
            if (value && !options.some(option => option.value === value))
                input.appendChild(new Option(value, value));
            input.value = value ?? '';
        } else if (fieldSpec.kind === 'textarea') {
            input = document.createElement('textarea');
            input.rows = 2;
            input.value = value ?? '';
        } else if (fieldSpec.kind === 'expression') {
            input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'выражение, напр. score + 1';
            input.title = 'Вычисляется ExpressionsParser: числа, строки, переменные, операторы';
            input.value = value ?? '';
        } else if (fieldSpec.kind === 'bool') {
            input = document.createElement('select');
            input.appendChild(new Option('—', ''));
            input.appendChild(new Option('да', 'true'));
            input.appendChild(new Option('нет', 'false'));
            input.value = value ?? '';
        } else {
            input = document.createElement('input');
            input.type = 'text';
            if (fieldSpec.kind === 'varName')
                input.setAttribute('list', 'varsList');
            input.value = value ?? '';
        }

        input.addEventListener('change', onChange);
        wrap.appendChild(input);
        return { wrap, input };
    }

    buildRawCard(group, index, unknownNote) {
        const action = group.actions[index];
        const { card, row, errorEl } = this.makeCardShell(group, index, unknownNote);
        if (unknownNote)
            card.classList.add('invalid');

        const spec = describeAction(action.name);
        if (spec && this.rawMode.has(action)) {
            const typedBtn = this.makeIconBtn('▤', () => {
                this.rawMode.delete(action);
                this.renderActions();
            });
            typedBtn.title = 'Вернуться к типизированным полям';
            row.querySelector('.action-controls').appendChild(typedBtn);
        }

        const nameInput = document.createElement('input');
        nameInput.className = 'action-name';
        nameInput.placeholder = 'имя экшна';
        nameInput.value = action.name;
        nameInput.setAttribute('list', 'knownActions');

        const argsInput = document.createElement('input');
        argsInput.className = 'action-args';
        argsInput.placeholder = 'аргументы через запятую';
        argsInput.value = action.args.map(arg => {
            try { return this.argFormatter._serializeArg(arg); }
            catch { return '?'; }
        }).join(', ');

        const delBtn = this.makeIconBtn('✕', () => { removeAction(group, index); this.renderGroups(); this.renderActions(); });
        row.insertBefore(nameInput, row.querySelector('.action-controls'));
        row.insertBefore(argsInput, row.querySelector('.action-controls'));
        row.querySelector('.action-controls').appendChild(delBtn);

        const apply = () => {
            try {
                const name = nameInput.value.trim();
                if (!name)
                    throw new Error('Пустое имя экшна');

                action.name = name;
                action.args = ActParser.parseArgs(argsInput.value);
                errorEl.textContent = '';
                card.classList.remove('invalid');
                this.renderGroups();
            } catch (error) {
                errorEl.textContent = error.message;
                card.classList.add('invalid');
            }
        };

        nameInput.addEventListener('change', apply);
        argsInput.addEventListener('change', apply);
        return card;
    }

    descriptorSelectOptions(kind) {
        const descriptor = this.descriptor ?? {};

        switch (kind) {
            case 'person': {
                const options = [];
                for (const [personKey, person] of Object.entries(descriptor.persons ?? {})) {
                    const spriteKeys = ['default',
                        ...Object.keys(person.sprites ?? {}).filter(key => key !== 'default')];
                    for (const spriteKey of spriteKeys)
                        options.push({ value: `${personKey}.${spriteKey}`, label: `${person.name || personKey} · ${spriteKey}` });
                }
                return options.length ? options : null;
            }
            case 'background':
                return Object.keys(descriptor.backgrounds ?? {}).map(key => ({ value: key, label: key }));
            case 'stat':
                return Object.entries(descriptor.stats ?? {})
                    .map(([key, stat]) => ({ value: key, label: stat.name || key }));
            case 'sceneTarget':
                return Object.keys(descriptor.scenes ?? {}).sort()
                    .map(key => ({ value: key, label: `Сцена "${key}"` }));
            case 'groupTarget':
                return (this.ast?.groups ?? []).map(group => ({ value: group.key, label: `[${group.key}]` }));
            default:
                return null;
        }
    }

    renderPalette() {
        this.$paletteList.innerHTML = '';

        for (const category of ACTION_CATEGORIES) {
            const names = paletteByCategory()[category];
            if (!names.length) continue;

            const box = document.createElement('div');
            box.className = 'palette-category';

            const title = document.createElement('div');
            title.className = 'palette-category-title';
            title.textContent = category;
            box.appendChild(title);

            for (const name of names) {
                const item = document.createElement('div');
                item.className = 'palette-card';
                item.draggable = true;
                item.dataset.action = name;
                item.textContent = describeAction(name).title;
                item.title = `${name}(…) — перетащите в группу или кликните`;
                item.addEventListener('dragstart', event => {
                    event.dataTransfer.setData('text/plain', name);
                    event.dataTransfer.effectAllowed = 'copy';
                });
                item.addEventListener('click', () => this.insertFromPalette(name));
                box.appendChild(item);
            }

            this.$paletteList.appendChild(box);
        }
    }

    insertFromPalette(name, atGroupIdx = this.selectedGroupIdx, atActionIdx = null) {
        if (!this.ast || atGroupIdx < 0)
            return this.setStatus('Сначала выберите группу', 'error');

        const group = this.ast.groups[atGroupIdx];
        const position = atActionIdx ?? group.actions.length;
        insertAction(group, position, createAction(name));
        this.selectedGroupIdx = atGroupIdx;
        this.renderGroups();
        this.renderActions();
    }

    bindPaletteDropTargets() {
        const allowDrop = element => {
            element.addEventListener('dragover', event => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
                element.classList.add('drop-target');
            });
            element.addEventListener('dragleave', () => element.classList.remove('drop-target'));
        };

        allowDrop(this.$actionsList);
        this.$actionsList.addEventListener('drop', event => {
            event.preventDefault();
            this.$actionsList.classList.remove('drop-target');
            this.insertFromPalette(event.dataTransfer.getData('text/plain'));
        });

        // Drop on a specific card inserts before that card
        this.$actionsList.addEventListener('dragover', event => {
            const card = event.target.closest('.action-card');
            this.$actionsList.querySelectorAll('.drop-before').forEach(el => el.classList.remove('drop-before'));
            if (card) card.classList.add('drop-before');
        }, true);
        this.$actionsList.addEventListener('drop', event => {
            const card = event.target.closest('.action-card');
            if (!card) return;
            event.preventDefault();
            event.stopPropagation();
            card.classList.remove('drop-before');
            const group = this.ast?.groups[this.selectedGroupIdx];
            const index = group ? group.actions.indexOf(this.cardToAction.get(card)) : -1;
            if (index >= 0)
                this.insertFromPalette(event.dataTransfer.getData('text/plain'), this.selectedGroupIdx, index);
        }, true);
    }

    makeIconBtn(label, onClick) {
        const btn = document.createElement('button');
        btn.className = 'icon-btn';
        btn.type = 'button';
        btn.textContent = label;
        btn.addEventListener('click', onClick);
        return btn;
    }

    makeHint(text) {
        const hint = document.createElement('div');
        hint.className = 'empty-hint';
        hint.textContent = text;
        return hint;
    }
}

const editor = new ScenesEditor();

const datalist = document.createElement('datalist');
datalist.id = 'knownActions';
for (const name of editor.knownActions)
    datalist.appendChild(new Option(name));
document.body.appendChild(datalist);

const varsDatalist = document.createElement('datalist');
varsDatalist.id = 'varsList';
document.body.appendChild(varsDatalist);

editor.init().catch(error => editor.setStatus(error.message, 'error'));

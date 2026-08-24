import { Utils } from '#/utils.js';
import { ActParser } from '#/lib/act/act-parser.js';
import { ActSerializer, ActSerializeError } from '#/lib/act/act-serializer.js';
import { getKnownActionNames } from '#/actions.js';
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

        this.$gameSelect = document.getElementById('gameSelect');
        this.$sceneSelect = document.getElementById('sceneSelect');
        this.$exportBtn = document.getElementById('exportBtn');
        this.$addGroupBtn = document.getElementById('addGroupBtn');
        this.$addActionBtn = document.getElementById('addActionBtn');
        this.$statusBar = document.getElementById('statusBar');
        this.$groupsList = document.getElementById('groupsList');
        this.$actionsList = document.getElementById('actionsList');
        this.$currentGroupKey = document.getElementById('currentGroupKey');
    }

    async init() {
        this.$gameSelect.addEventListener('change', () => this.loadGame(this.$gameSelect.value).catch(e => this.setStatus(e.message, 'error')));
        this.$sceneSelect.addEventListener('change', () => this.loadScene(this.$sceneSelect.value).catch(e => this.setStatus(e.message, 'error')));
        this.$exportBtn.addEventListener('click', () => this.exportScene());
        this.$addGroupBtn.addEventListener('click', () => this.addGroup());
        this.$addActionBtn.addEventListener('click', () => this.addAction());

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
        this.$addGroupBtn.disabled = true;
        this.$addActionBtn.disabled = true;
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
        this.$addGroupBtn.disabled = false;
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

    addAction() {
        const ast = this.requireAst();
        if (this.selectedGroupIdx === -1)
            return this.setStatus('Сначала выберите группу', 'error');

        const group = ast.groups[this.selectedGroupIdx];
        insertAction(group, group.actions.length, createAction('end'));
        this.renderGroups();
        this.renderActions();
    }

    applyAction(group, index, nameInput, argsInput, errorEl, card) {
        const name = nameInput.value.trim();
        try {
            if (!name)
                throw new Error('Пустое имя экшна');

            const args = ActParser.parseArgs(argsInput.value);
            group.actions[index].name = name;
            group.actions[index].args = args;

            errorEl.textContent = '';
            card.classList.remove('invalid');
            this.renderGroups();
        } catch (error) {
            errorEl.textContent = error.message;
            card.classList.add('invalid');
        }
    }

    exportScene() {
        const ast = this.requireAst();
        let text;
        try {
            text = new ActSerializer().serialize(ast);
        } catch (error) {
            const message = error instanceof ActSerializeError && error.context
                ? `${error.message} ${JSON.stringify(error.context)}`
                : error.message;
            return this.setStatus(`Экспорт невозможен: ${message}`, 'error');
        }

        // Safety net: serialized text must reparse into the same AST
        const reparsed = new ActParser({ content: text }).parse().groups;
        if (JSON.stringify(reparsed) !== JSON.stringify(ast.groups))
            return this.setStatus('Экспорт отменён: round-trip проверка не совпала', 'error');

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = this.sceneFileName || 'scene.act';
        link.click();
        URL.revokeObjectURL(link.href);
        this.setStatus(`Файл ${link.download} сохранён`, 'success');
    }

    renderGroups() {
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
        const card = document.createElement('div');
        card.className = 'action-card';

        const row = document.createElement('div');
        row.className = 'action-row';

        const order = document.createElement('span');
        order.className = 'action-order';
        order.textContent = `${index + 1}.`;

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

        const upBtn = this.makeIconBtn('↑', () => { moveAction(group, index, index - 1); this.renderActions(); });
        const downBtn = this.makeIconBtn('↓', () => { moveAction(group, index, index + 1); this.renderActions(); });
        const delBtn = this.makeIconBtn('✕', () => { removeAction(group, index); this.renderGroups(); this.renderActions(); });

        row.append(order, nameInput, argsInput, upBtn, downBtn, delBtn);

        const errorEl = document.createElement('div');
        errorEl.className = 'action-error';

        if (!this.knownActions.includes(action.name)) {
            card.classList.add('invalid');
            errorEl.textContent = `Неизвестный экшн "${action.name}"`;
        }

        nameInput.addEventListener('change', () =>
            this.applyAction(group, index, nameInput, argsInput, errorEl, card));
        argsInput.addEventListener('change', () =>
            this.applyAction(group, index, nameInput, argsInput, errorEl, card));

        card.append(row, errorEl);
        return card;
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

editor.init().catch(error => editor.setStatus(error.message, 'error'));

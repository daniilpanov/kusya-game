// Visual editor adapter for showChoice / showChoicePerson: question,
// answer variants (one per line) and live preview of the choices screen.

import { registerAdapter } from '#/editor-adapters.js';
import { createPersonSpritePicker, createBackgroundPicker } from '#/adapters/ui.js';

const makeMount = withPerson => ({ container, values, context, makeStage, onChange, spec }) => {
    const state = { ...values };
    const restKey = spec?.rest?.key ?? 'choices';

    const controls = document.createElement('div');
    controls.className = 'adapter-controls';

    const keyRow = document.createElement('div');
    keyRow.className = 'field-row';
    const keyLabel = document.createElement('span');
    keyLabel.className = 'field-label';
    keyLabel.textContent = 'Ключ выбора:';
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.setAttribute('list', 'varsList');
    keyInput.value = state.choiceKey ?? '';
    keyInput.addEventListener('input', () => {
        state.choiceKey = keyInput.value;
        onChange({ choiceKey: keyInput.value });
        redraw();
    });
    keyRow.append(keyLabel, keyInput);
    controls.appendChild(keyRow);

    let picker = null;
    if (withPerson) {
        const pickerRow = document.createElement('div');
        pickerRow.className = 'field-row';
        const pickerLabel = document.createElement('span');
        pickerLabel.className = 'field-label';
        pickerLabel.textContent = 'Персонаж:';
        picker = createPersonSpritePicker(context, state.person ?? '', commit, { allowEmpty: true });
        pickerRow.append(pickerLabel, picker.el);
        controls.appendChild(pickerRow);
    }

    const textRow = document.createElement('div');
    textRow.className = 'field-row';
    const textLabel = document.createElement('span');
    textLabel.className = 'field-label';
    textLabel.textContent = 'Вопрос:';
    const textInput = document.createElement('textarea');
    textInput.rows = 2;
    textInput.value = state.text ?? '';
    textInput.addEventListener('input', () => {
        state.text = textInput.value;
        onChange({ text: textInput.value });
        redraw();
    });
    textRow.append(textLabel, textInput);
    controls.appendChild(textRow);

    const variantsRow = document.createElement('div');
    variantsRow.className = 'field-row';
    const variantsLabel = document.createElement('span');
    variantsLabel.className = 'field-label';
    variantsLabel.textContent = 'Варианты:';
    const variantsHint = document.createElement('div');
    variantsHint.className = 'adapter-hint';
    variantsHint.textContent = 'по одному варианту на строку';
    const variantsInput = document.createElement('textarea');
    variantsInput.rows = 4;
    variantsInput.value = (state[restKey] ?? []).join('\n');
    variantsInput.addEventListener('input', () => {
        state[restKey] = variantsInput.value.split('\n').filter(line => line.trim() !== '');
        onChange({ [restKey]: state[restKey] });
        redraw();
    });
    variantsRow.append(variantsLabel, variantsHint, variantsInput);
    controls.appendChild(variantsRow);

    const hideAllRow = document.createElement('label');
    hideAllRow.className = 'field-row adapter-inline';
    const hideAllCheck = document.createElement('input');
    hideAllCheck.type = 'checkbox';
    hideAllCheck.checked = state.hideAll === 'true';
    const hideAllText = document.createElement('span');
    hideAllText.textContent = 'Скрыть остальных персонажей';
    hideAllCheck.addEventListener('change', () => {
        state.hideAll = hideAllCheck.checked ? 'true' : '';
        onChange({ hideAll: state.hideAll });
    });
    hideAllRow.append(hideAllCheck, hideAllText);
    controls.appendChild(hideAllRow);

    const bgPicker = createBackgroundPicker(context, index => {
        previewBackground = context.backgrounds[index]?.url ?? null;
        redraw();
    });
    if (bgPicker)
        controls.appendChild(bgPicker);

    // ---- live stage

    const stageBox = document.createElement('div');
    stageBox.className = 'adapter-stage';

    let stage = null;
    let previewBackground = null;

    makeStage({ width: 560 }).then(created => {
        stage = created;
        previewBackground = context?.backgrounds?.[0]?.url ?? null;
        stageBox.appendChild(created.root);
        redraw();
    }).catch(() => {
        stageBox.textContent = 'Превью недоступно';
    });

    function commit() {
        state.person = picker.getValue() || '';
        onChange({ person: state.person });
        redraw();
    }

    function redraw() {
        if (!stage) return;

        stage.setBackground(previewBackground);

        const personValue = withPerson ? state.person : '';
        if (personValue && !state.hideAll) {
            const sprite = picker.findSprite();
            stage.showSprite({ url: sprite?.url ?? null });
        } else {
            stage.clearSprites();
        }

        const author = personValue ? picker.getPersonName() || '...' : '...';
        const variants = state[restKey] ?? [];
        if (variants.length)
            stage.showChoices({ author, text: state.text ?? '', choices: variants });
        else
            stage.hideChoices();
    }

    container.append(controls, stageBox);

    return {
        save() {
            const patch = {
                choiceKey: state.choiceKey ?? '',
                text: state.text ?? '',
                [restKey]: state[restKey] ?? [],
                hideAll: state.hideAll ?? '',
            };
            if (withPerson)
                patch.person = state.person ?? '';
            return patch;
        },
    };
};

registerAdapter('showChoice', {
    title: 'Экран выбора',
    mount: makeMount(false),
});

registerAdapter('showChoicePerson', {
    title: 'Выбор с персонажем',
    mount: makeMount(true),
});

// Visual editor adapter for showPhrasePerson: author, text and live
// dialog preview rendered with the game's real dialog template.

import { registerAdapter } from '#/editor-adapters.js';
import { createPersonSpritePicker, createBackgroundPicker } from '#/adapters/ui.js';

registerAdapter('showPhrasePerson', {
    title: 'Реплика персонажа',

    mount({ container, values, context, makeStage, onChange }) {
        const state = { ...values };

        const controls = document.createElement('div');
        controls.className = 'adapter-controls';

        const pickerRow = document.createElement('div');
        pickerRow.className = 'field-row';
        const pickerLabel = document.createElement('span');
        pickerLabel.className = 'field-label';
        pickerLabel.textContent = 'Персонаж:';
        const picker = createPersonSpritePicker(context, state.person ?? '', commit);
        pickerRow.append(pickerLabel, picker.el);

        const pseudoRow = document.createElement('div');
        pseudoRow.className = 'field-row';
        const pseudoLabel = document.createElement('span');
        pseudoLabel.className = 'field-label';
        pseudoLabel.textContent = 'Имя автора:';
        const pseudoInput = document.createElement('input');
        pseudoInput.type = 'text';
        pseudoInput.placeholder = 'пусто — имя персонажа';
        pseudoInput.value = state.pseudo ?? '';
        pseudoInput.addEventListener('input', () => {
            state.pseudo = pseudoInput.value;
            onChange({ pseudo: pseudoInput.value });
            redraw();
        });
        pseudoRow.append(pseudoLabel, pseudoInput);

        const textRow = document.createElement('div');
        textRow.className = 'field-row';
        const textLabel = document.createElement('span');
        textLabel.className = 'field-label';
        textLabel.textContent = 'Текст:';
        const textInput = document.createElement('textarea');
        textInput.rows = 4;
        textInput.value = state.text ?? '';
        textInput.addEventListener('input', () => {
            state.text = textInput.value;
            onChange({ text: textInput.value });
            redraw();
        });
        textRow.append(textLabel, textInput);

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

        controls.append(pickerRow, pseudoRow, textRow, hideAllRow);

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
            state.person = picker.getValue();
            onChange({ person: state.person });
            redraw();
        }

        function redraw() {
            if (!stage) return;

            stage.setBackground(previewBackground);
            if (state.person && !state.hideAll) {
                const sprite = picker.findSprite();
                stage.showSprite({ url: sprite?.url ?? null });
            } else {
                stage.clearSprites();
            }

            const author = state.pseudo || (state.person ? picker.getPersonName() : '') || '...';
            stage.showDialog({ author, text: state.text ?? '' });
        }

        container.append(controls, stageBox);

        return {
            save() {
                return {
                    person: state.person ?? '',
                    pseudo: state.pseudo ?? '',
                    text: state.text ?? '',
                    hideAll: state.hideAll ?? '',
                };
            },
        };
    },
});

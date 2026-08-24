// Visual editor adapter for showTitle: heading text with a live preview
// of the scene title rendered through the game's real template.

import { registerAdapter } from '#/editor-adapters.js';
import { createBackgroundPicker } from '#/adapters/ui.js';

registerAdapter('showTitle', {
    title: 'Заголовок сцены',

    mount({ container, values, context, makeStage, onChange }) {
        const state = { title: values.title ?? '' };

        const controls = document.createElement('div');
        controls.className = 'adapter-controls';

        const titleRow = document.createElement('div');
        titleRow.className = 'field-row';
        const titleLabel = document.createElement('span');
        titleLabel.className = 'field-label';
        titleLabel.textContent = 'Заголовок:';
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.placeholder = 'Название сцены';
        titleInput.value = state.title;
        titleInput.addEventListener('input', () => {
            state.title = titleInput.value;
            onChange({ title: titleInput.value });
            redraw();
        });
        titleRow.append(titleLabel, titleInput);
        controls.appendChild(titleRow);

        const note = document.createElement('div');
        note.className = 'adapter-hint';
        note.textContent = 'В игре тайтл показывается 5 секунд, затем выполняется следующая группа';
        controls.appendChild(note);

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

        function redraw() {
            if (!stage) return;

            stage.setBackground(previewBackground);
            stage.clearSprites();
            stage.hideDialog();

            if (state.title.trim() !== '')
                stage.showTitle(state.title);
            else
                stage.hideTitle();
        }

        container.append(controls, stageBox);

        return {
            save() {
                return { title: state.title };
            },
        };
    },
});

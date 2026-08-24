// Visual editor adapters for the two person-position actions:
// showPersonSprite (with hideAll + dialog demo) and movePersonSprite
// (pure positioning, coordinates required). Registered via side-effect import.

import { registerAdapter, POSITION_PRESETS, clamp01, formatAnchor } from '#/editor-adapters.js';
import { createPersonSpritePicker, createBackgroundPicker } from '#/adapters/ui.js';

const makeMount = ({ withHideAll, requireXY }) =>
    ({ container, values, context, makeStage, onChange }) => {
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

        const presetRow = document.createElement('div');
        presetRow.className = 'adapter-presets';
        for (const preset of POSITION_PRESETS) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'mini-btn';
            btn.textContent = preset.label;
            btn.addEventListener('click', () => {
                state.x = preset.x;
                state.y = 0.5;
                onChange({ x: formatAnchor(preset.x), y: '0.5' });
                redraw();
            });
            presetRow.appendChild(btn);
        }

        controls.append(pickerRow, presetRow);

        if (withHideAll) {
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
        }

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

        // dragging on the stage sets both anchors
        stageBox.addEventListener('pointerdown', event => {
            if (!stage) return;
            const move = pointerEvent => {
                const rect = stage.root.getBoundingClientRect();
                const x = clamp01((pointerEvent.clientX - rect.left) / rect.width);
                const y = clamp01((pointerEvent.clientY - rect.top) / rect.height);
                state.x = x;
                state.y = y;
                onChange({ x: formatAnchor(x), y: formatAnchor(y) });
                redraw();
            };
            move(event);
            const stop = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', stop);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', stop);
        });

        function commit() {
            state.person = picker.getValue();
            onChange({ person: state.person });
            redraw();
        }

        function redraw() {
            if (!stage) return;

            stage.setBackground(previewBackground);
            stage.showSprite({
                url: picker.findSprite()?.url ?? null,
                x: anchorOf(state.x),
                y: anchorOf(state.y),
            });

            if (withHideAll && state.person && !state.hideAll)
                stage.showDialog({ author: '', text: 'Так выглядит диалог этого персонажа' });
            else
                stage.hideDialog();

            [...presetRow.children].forEach((btn, i) =>
                btn.classList.toggle('active',
                    Math.abs(POSITION_PRESETS[i].x - Number(state.x)) < 0.001
                    && Math.abs(0.5 - Number(state.y)) < 0.001));
        }

        const anchorOf = value =>
            value === undefined || value === '' ? 0.5 : Number(value);

        container.append(controls, stageBox);

        return {
            save() {
                return {
                    person: state.person ?? '',
                    ...(withHideAll ? { hideAll: state.hideAll ?? '' } : {}),
                    x: state.x === undefined || state.x === ''
                        ? (requireXY ? '0.5' : '') : formatAnchor(state.x),
                    y: state.y === undefined || state.y === ''
                        ? (requireXY ? '0.5' : '') : formatAnchor(state.y),
                };
            },
        };
    };

registerAdapter('showPersonSprite', {
    title: 'Позиция персонажа',
    mount: makeMount({ withHideAll: true, requireXY: false }),
});

registerAdapter('movePersonSprite', {
    title: 'Позиция персонажа (перемещение)',
    mount: makeMount({ withHideAll: false, requireXY: true }),
});

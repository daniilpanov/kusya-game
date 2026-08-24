// Pilot visual editor adapter: positioning a person sprite on stage.
// Proves the adapter contract from js/editor-adapters.js; registered via
// side-effect import (same pattern as templater_typer_extension.js).

import { registerAdapter, POSITION_PRESETS, clamp01, formatAnchor } from '#/editor-adapters.js';

registerAdapter('showPersonSprite', {
    title: 'Позиция персонажа',

    mount({ container, values, context, makeStage, onChange }) {
        const state = { ...values };

        // ---- controls

        const controls = document.createElement('div');
        controls.className = 'adapter-controls';

        const personRow = document.createElement('div');
        personRow.className = 'field-row';
        const personLabel = document.createElement('span');
        personLabel.className = 'field-label';
        personLabel.textContent = 'Персонаж:';
        const personSelect = document.createElement('select');
        for (const person of context?.persons ?? [])
            personSelect.appendChild(new Option(person.name || person.id, person.id));
        const currentPersonId = String(state.person ?? '').split('.')[0];
        if (currentPersonId)
            personSelect.value = currentPersonId;

        const spriteRow = document.createElement('div');
        spriteRow.className = 'field-row';
        const spriteLabel = document.createElement('span');
        spriteLabel.className = 'field-label';
        spriteLabel.textContent = 'Спрайт:';
        const spriteSelect = document.createElement('select');

        const spriteThumb = document.createElement('img');
        spriteThumb.className = 'adapter-thumb';
        spriteThumb.alt = '';

        const syncSpriteOptions = () => {
            const person = context?.persons?.find(p => p.id === personSelect.value);
            spriteSelect.innerHTML = '';
            for (const sprite of person?.sprites ?? [])
                spriteSelect.appendChild(new Option(sprite.id === 'default' ? 'default' : `${person.id}.${sprite.id}`, sprite.id));
            const wanted = String(state.person ?? '').split('.')[1] || 'default';
            spriteSelect.value = [...spriteSelect.options].some(o => o.value === wanted) ? wanted : '';
            syncThumb();
        };

        const syncThumb = () => {
            const person = context?.persons?.find(p => p.id === personSelect.value);
            const sprite = person?.sprites?.find(s => s.id === spriteSelect.value);
            spriteThumb.src = sprite?.url ?? '';
            spriteThumb.classList.toggle('hidden', !sprite);
        };

        const commit = () => {
            const personValue = spriteSelect.value
                ? `${personSelect.value}.${spriteSelect.value}`
                : '';
            state.person = personValue;
            onChange({ person: personValue });
            redraw();
        };

        personSelect.addEventListener('change', () => { syncSpriteOptions(); commit(); });
        spriteSelect.addEventListener('change', commit);

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

        personRow.append(personLabel, personSelect);
        spriteRow.append(spriteLabel, spriteSelect, spriteThumb);
        hideAllRow.append(hideAllCheck, hideAllText);
        controls.append(personRow, spriteRow, presetRow, hideAllRow);

        // ---- live stage

        const stageBox = document.createElement('div');
        stageBox.className = 'adapter-stage';

        let stage = null;
        makeStage({ width: 560 }).then(created => {
            stage = created;
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

        const redraw = () => {
            if (!stage) return;
            const person = context?.persons?.find(p => p.id === personSelect.value);
            const sprite = person?.sprites?.find(s => s.id === spriteSelect.value);
            const bg = context?.backgrounds?.[0];

            stage.setBackground(bg?.url ?? null);
            stage.showSprite({
                url: sprite?.url ?? null,
                x: state.x !== '' && state.x != null ? Number(state.x) : 0.5,
                y: state.y !== '' && state.y != null ? Number(state.y) : 0.5,
            });
            if (state.person && !state.hideAll)
                stage.showDialog({ author: '', text: 'Так выглядит диалог этого персонажа' });
            else
                stage.hideDialog();

            for (const [i, btn] of [...presetRow.children].entries())
                btn.classList.toggle('active',
                    Math.abs(POSITION_PRESETS[i].x - Number(state.x)) < 0.001
                    && Math.abs(0.5 - Number(state.y)) < 0.001);
        };

        syncSpriteOptions();
        container.append(controls, stageBox);

        return {
            save() {
                return {
                    person: state.person ?? '',
                    hideAll: state.hideAll ?? '',
                    x: state.x === undefined || state.x === '' ? '' : formatAnchor(state.x),
                    y: state.y === undefined || state.y === '' ? '' : formatAnchor(state.y),
                };
            },
        };
    },
});

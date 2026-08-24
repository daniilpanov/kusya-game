// Visual editor adapter for setBackground: thumbnail gallery with a
// full-size live preview of the selected background.

import { registerAdapter } from '#/editor-adapters.js';

registerAdapter('setBackground', {
    title: 'Фон сцены',

    mount({ container, values, context, makeStage, onChange }) {
        const backgrounds = context?.backgrounds ?? [];
        const state = { bg: values.bg ?? '' };

        const controls = document.createElement('div');
        controls.className = 'adapter-controls';

        const gallery = document.createElement('div');
        gallery.className = 'bg-gallery';

        const markActive = () => {
            [...gallery.children].forEach(card =>
                card.classList.toggle('active', card.dataset.bg === state.bg));
        };

        const commit = key => {
            state.bg = key;
            onChange({ bg: key });
            redraw();
            markActive();
        };

        for (const bg of backgrounds) {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'bg-card';
            card.dataset.bg = bg.id;
            card.title = bg.id;

            const img = document.createElement('img');
            img.src = bg.url;
            img.alt = bg.id;

            const label = document.createElement('span');
            label.textContent = bg.id;

            card.append(img, label);
            card.addEventListener('click', () => commit(bg.id));
            gallery.appendChild(card);
        }

        if (backgrounds.length)
            controls.appendChild(gallery);
        else
            controls.textContent = 'В игре не описано ни одного фона';

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

        function redraw() {
            if (!stage) return;
            const bg = backgrounds.find(item => item.id === state.bg);
            stage.setBackground(bg?.url ?? null);
        }

        container.append(controls, stageBox);

        return {
            save() {
                return { bg: state.bg };
            },
        };
    },
});

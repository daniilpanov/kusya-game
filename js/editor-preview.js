// Live stage preview for editor adapters: a scaled 16:9 box that reuses the
// real game DOM structure, templates and css so previews match the actual game.
// Geometry comes from js/lib/layout/anchor.js — the same math the runtime uses.

import { computeAnchorStyles } from '#/lib/layout/anchor.js';
import { Utils } from '#/utils.js';

const templateCache = new Map(); // url -> parsed template body element

async function fetchTemplateBody(url) {
    if (!templateCache.has(url)) {
        const text = await (await Utils.fetch(url)).text();
        const parsed = new DOMParser().parseFromString(text, 'text/html');
        const firstChild = parsed.body.children[0] ?? null;
        templateCache.set(url, firstChild);
    }
    return templateCache.get(url);
}

const styleCache = new Map(); // url -> css text

async function fetchStyleText(url) {
    if (!styleCache.has(url)) {
        const text = await (await Utils.fetch(url)).text();
        // scope per-game selectors under the preview root
        styleCache.set(url, text.replaceAll(/(^|\n)([^\n@{}]+)\{/g,
            (match, prefix, selector) => `${prefix}.stage-preview ${selector.trim()}{`));
    }
    return styleCache.get(url);
}

export async function createStagePreview(context, { width = 560 } = {}) {
    const height = Math.round(width * 9 / 16);

    const root = document.createElement('div');
    root.className = 'stage-preview';
    root.style.width = `${width}px`;
    root.style.height = `${height}px`;

    const background = document.createElement('div');
    background.className = 'scene-background';

    const characters = document.createElement('div');
    characters.className = 'characters-container';

    const dialogue = document.createElement('div');
    dialogue.className = 'dialogue-container';

    const choicesBox = document.createElement('div');
    choicesBox.className = 'choices-container';

    root.append(background, characters, dialogue, choicesBox);

    // Per-game stylesheet (descriptor.templates.styles), scoped to this preview
    const stylesURL = context?.templates?.styles;
    if (stylesURL) {
        const styleEl = document.createElement('style');
        styleEl.textContent = await fetchStyleText(stylesURL);
        root.prepend(styleEl);
    }

    const dialogTemplateURL = context?.templates?.dialog ?? null;
    const choicesTemplateURL = context?.templates?.choices ?? null;

    const activateDialog = isActive => {
        dialogue.classList.toggle('active', isActive);
        choicesBox.classList.toggle('active', !isActive);
    };

    const stage = {
        root,

        setBackground(url) {
            background.innerHTML = '';
            if (!url)
                return;
            const img = document.createElement('img');
            img.src = url;
            background.appendChild(img);
        },

        clearSprites() {
            characters.innerHTML = '';
        },

        showSprite({ url, x = 0.5, y = 0.5 }) {
            this.clearSprites();
            if (!url)
                return;

            const img = document.createElement('img');
            img.className = 'character';
            img.src = url;

            const styles = computeAnchorStyles(x, y, { width, height });
            if (styles)
                Object.assign(img.style, styles);

            characters.appendChild(img);
        },

        async showDialog({ author, text }) {
            if (!dialogTemplateURL)
                return;
            const template = await fetchTemplateBody(dialogTemplateURL);
            if (!template)
                return;

            dialogue.innerHTML = '';
            dialogue.appendChild(template.cloneNode(true));
            activateDialog(true);

            for (const el of dialogue.querySelectorAll('[data-bs-injection-key]')) {
                const key = el.getAttribute('data-bs-injection-key');
                if (key === 'author')
                    el.textContent = author ?? '';
                if (key === 'text') {
                    // plain insertion: skip typer animation in previews
                    el.removeAttribute('data-bs-injection-type');
                    el.textContent = text ?? '';
                }
            }
        },

        async showChoices({ author, text, choices }) {
            if (!choicesTemplateURL)
                return;
            const template = await fetchTemplateBody(choicesTemplateURL);
            if (!template)
                return;

            choicesBox.innerHTML = '';
            choicesBox.appendChild(template.cloneNode(true));
            activateDialog(false);

            const variantTemplate = choicesBox.querySelector('[data-bs-injection-callback-id]');
            const box = choicesBox.querySelector('[data-bs-injection-key="choicesList"]');

            for (const el of choicesBox.querySelectorAll('[data-bs-injection-key]')) {
                const key = el.getAttribute('data-bs-injection-key');
                if (key === 'author')
                    el.textContent = author ?? '';
                if (key === 'text')
                    el.textContent = text ?? '';
            }

            if (!box || !variantTemplate)
                return;

            box.innerHTML = '';
            for (const variant of choices ?? []) {
                const btn = variantTemplate.cloneNode(true);
                btn.removeAttribute('data-bs-injection-callback-id');
                btn.textContent = variant;
                btn.addEventListener('click', () =>
                    [...box.children].forEach(child =>
                        child.classList.toggle('picked', child === btn)));
                box.appendChild(btn);
            }
        },

        hideDialog() {
            dialogue.innerHTML = '';
        },

        hideChoices() {
            choicesBox.innerHTML = '';
            activateDialog(true);
        },
    };

    return stage;
}

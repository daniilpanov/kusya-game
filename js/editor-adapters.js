// Visual editor adapters: per-action modal editors with live previews,
// attached to the default typed cards. An adapter works purely on the
// formValues level (same keys as spec.args in js/action-specs.js) and never
// touches action.args directly — the card's collectAndApply() stays the only
// writer to the AST.
//
// Adapter contract:
//   ACTION_ADAPTERS[actionName] = {
//       title: string,                       // modal heading
//       mount(ctx) → { save(): patch|null }  // build UI into ctx.container
//   }
// ctx = {
//   container: HTMLElement,                  // modal body
//   values: object,                          // current formValues (all spec keys)
//   context: EditorContext,                  // descriptor-derived resources (see below)
//   stage: StagePreview|null,                // live preview box (see js/editor-preview.js)
//   onChange(patch): void                    // partial formValues; redraws the preview
// }
// save() returns a partial formValues patch on Save, or null to cancel.

export const ACTION_ADAPTERS = {};

export const getAdapter = actionName => ACTION_ADAPTERS[actionName] ?? null;

export function registerAdapter(actionName, adapter) {
    ACTION_ADAPTERS[actionName] = adapter;
}

// ---- shared coordinate helpers (normalized anchors 0..1, see lib/layout/anchor.js)

export const POSITION_PRESETS = [
    { id: 'left', label: 'Слева', x: 0.2 },
    { id: 'center', label: 'Центр', x: 0.5 },
    { id: 'right', label: 'Справа', x: 0.8 },
];

export const clamp01 = value => Math.min(1, Math.max(0, Number(value)));

export const formatAnchor = value => String(Math.round(clamp01(value) * 1000) / 1000);

// ---- EditorContext: everything an adapter may know about the game

const listEntries = table => Object.entries(table ?? {});

export function buildEditorContext(descriptor, gameResource) {
    if (!descriptor)
        return null;

    return {
        gameResource,
        templates: listEntries(descriptor.templates).reduce((acc, [id, path]) => {
            if (path)
                acc[id] = assetURL(gameResource, path);
            return acc;
        }, {}),
        persons: listEntries(descriptor.persons).map(([id, person]) => ({
            id,
            name: person.name ?? id,
            sprites: listEntries(person.sprites).map(([spriteId, src]) => ({
                id: spriteId,
                url: assetURL(gameResource, src),
            })),
        })),
        backgrounds: listEntries(descriptor.backgrounds).map(([id, bg]) => ({
            id,
            url: assetURL(gameResource, bg.src),
        })),
        scenes: listEntries(descriptor.scenes).map(([id]) => id),
    };
}

export function assetURL(gameResource, relativePath) {
    if (!relativePath)
        return null;
    return `${gameResource}/${relativePath}`;
}

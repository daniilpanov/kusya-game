// Shared UI building blocks for visual editor adapters.

const escapeNothing = value => value; // selects/inputs handle escaping themselves

export function createPersonSpritePicker(context, initialValue, onSelect, { allowEmpty = false } = {}) {
    const el = document.createElement('div');
    el.className = 'field-row';

    const personSelect = document.createElement('select');
    const spriteSelect = document.createElement('select');
    const thumb = document.createElement('img');
    thumb.className = 'adapter-thumb';
    thumb.alt = '';

    if (allowEmpty) {
        personSelect.appendChild(new Option('— без персонажа —', ''));
        spriteSelect.disabled = true;
    }

    const personById = id => context?.persons?.find(person => person.id === id) ?? null;
    const [initialPersonId, initialSpriteId = 'default'] = String(initialValue ?? '').split('.');

    for (const person of context?.persons ?? [])
        personSelect.appendChild(new Option(escapeNothing(person.name || person.id), person.id));
    if (initialPersonId && ![...personSelect.options].some(option => option.value === initialPersonId))
        personSelect.appendChild(new Option(initialPersonId, initialPersonId));
    personSelect.value = initialPersonId ?? '';

    const syncSprites = () => {
        const person = personById(personSelect.value);
        spriteSelect.innerHTML = '';
        for (const sprite of person?.sprites ?? [])
            spriteSelect.appendChild(new Option(sprite.id, sprite.id));

        const wanted = person ? initialPersonId === personSelect.value ? initialSpriteId : 'default' : '';
        spriteSelect.value = [...spriteSelect.options].some(option => option.value === wanted)
            ? wanted : '';
        syncThumb();
    };

    const syncThumb = () => {
        const sprite = findSprite();
        thumb.src = sprite?.url ?? '';
        thumb.classList.toggle('hidden', !sprite);
    };

    const syncSpriteDisabled = () => {
        spriteSelect.disabled = allowEmpty && !personSelect.value;
    };

    const findSprite = () =>
        personById(personSelect.value)?.sprites?.find(sprite => sprite.id === spriteSelect.value) ?? null;

    personSelect.addEventListener('change', () => { syncSprites(); syncSpriteDisabled(); onSelect(); });
    spriteSelect.addEventListener('change', () => { syncThumb(); onSelect(); });

    syncSprites();
    syncSpriteDisabled();

    el.append(personSelect, spriteSelect, thumb);

    return {
        el,
        getValue: () => (personSelect.value && spriteSelect.value
            ? `${personSelect.value}.${spriteSelect.value}` : ''),
        getPersonName: () => personById(personSelect.value)?.name ?? '',
        findSprite,
    };
}

export function createBackgroundPicker(context, onChange) {
    if (!context?.backgrounds?.length)
        return null;

    const select = document.createElement('select');
    for (const [index, bg] of context.backgrounds.entries()) {
        const label = bg.id;
        select.appendChild(new Option(`Фон превью: ${label}`, String(index)));
    }
    select.addEventListener('change', () => onChange(Number(select.value)));
    return select;
}

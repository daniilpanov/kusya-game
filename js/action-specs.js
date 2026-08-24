// Registry describing every scene action for the editor UI:
// human titles for the card palette, argument kinds for typed forms
// and conversion hints. Must stay in sync with js/actions.js —
// the test suite asserts the two sets are equal.

export const ACTION_CATEGORIES = ['Диалог', 'Персонаж', 'Навигация', 'Сцена', 'Состояние'];

export const FIELD_KINDS = [
    'text', 'textarea', 'expression', 'number', 'bool',
    'person', 'background', 'stat', 'groupTarget', 'sceneTarget', 'varName',
];

// Arg field: { key, label, kind, optional?, emptyAsNull? }
//   optional    — may be omitted from the emitted args (tail position only;
//                 middle optionals must use emptyAsNull to keep positions)
//   emptyAsNull — emit explicit null when left empty (parser cannot produce null otherwise)
// Spec extras: rest { key, label } — variadic string list appended after fixed args
//              trailingBool { key, label } — boolean consumed from args tail (showChoice*)
//              validate(values) -> error string | null — cross-field hooks

export const ACTION_SPECS = {
    showPhrase: {
        title: 'Фраза без персонажа',
        category: 'Диалог',
        args: [
            { key: 'text', label: 'Текст', kind: 'textarea' },
        ],
    },
    showPhrasePerson: {
        title: 'Персонаж скажет…',
        category: 'Диалог',
        args: [
            { key: 'person', label: 'Персонаж.спрайт', kind: 'person' },
            { key: 'pseudo', label: 'Имя автора', kind: 'text', optional: true, emptyAsNull: true },
            { key: 'text', label: 'Текст', kind: 'textarea' },
            { key: 'hideAll', label: 'Скрыть остальных', kind: 'bool', optional: true },
        ],
    },
    showChoice: {
        title: 'Выбор варианта…',
        category: 'Диалог',
        args: [
            { key: 'choiceKey', label: 'Ключ выбора', kind: 'varName' },
            { key: 'text', label: 'Вопрос', kind: 'textarea' },
        ],
        rest: { key: 'choices', label: 'Варианты' },
        trailingBool: { key: 'hideAll', label: 'Скрыть остальных' },
    },
    showChoicePerson: {
        title: 'Персонаж спрашивает (выбор)',
        category: 'Диалог',
        args: [
            { key: 'choiceKey', label: 'Ключ выбора', kind: 'varName' },
            { key: 'person', label: 'Персонаж.спрайт', kind: 'person', optional: true, emptyAsNull: true },
            { key: 'text', label: 'Вопрос', kind: 'textarea' },
        ],
        rest: { key: 'choices', label: 'Варианты' },
        trailingBool: { key: 'hideAll', label: 'Скрыть остальных' },
    },
    showTitle: {
        title: 'Заголовок сцены',
        category: 'Диалог',
        args: [
            { key: 'title', label: 'Заголовок', kind: 'text' },
        ],
    },

    showPersonSprite: {
        title: 'Покажется персонаж',
        category: 'Персонаж',
        args: [
            { key: 'person', label: 'Персонаж.спрайт', kind: 'person' },
            { key: 'hideAll', label: 'Скрыть остальных', kind: 'bool', optional: true },
            { key: 'x', label: 'X', kind: 'number', optional: true },
            { key: 'y', label: 'Y', kind: 'number', optional: true },
        ],
        validate: values => {
            const hasX = String(values.x).trim() !== '';
            const hasY = String(values.y).trim() !== '';
            return hasX !== hasY ? 'X и Y указываются парой' : null;
        },
    },
    movePersonSprite: {
        title: 'Передвинуть персонажа',
        category: 'Персонаж',
        args: [
            { key: 'person', label: 'Персонаж.спрайт', kind: 'person' },
            { key: 'x', label: 'X', kind: 'number' },
            { key: 'y', label: 'Y', kind: 'number' },
        ],
    },

    if: {
        title: 'Если … то к группе',
        category: 'Навигация',
        args: [
            { key: 'condition', label: 'Условие', kind: 'expression' },
            { key: 'target', label: 'Группа', kind: 'groupTarget' },
        ],
    },
    goto: {
        title: 'Перейти к группе',
        category: 'Навигация',
        args: [
            { key: 'target', label: 'Группа', kind: 'groupTarget' },
        ],
    },
    gotoNext: {
        title: 'Следующая группа',
        category: 'Навигация',
        args: [],
    },
    end: {
        title: 'Конец игры',
        category: 'Навигация',
        args: [],
    },

    setBackground: {
        title: 'Сменить фон',
        category: 'Сцена',
        args: [
            { key: 'bg', label: 'Фон', kind: 'background' },
        ],
    },
    gotoScene: {
        title: 'Перейти к сцене',
        category: 'Сцена',
        args: [
            { key: 'scene', label: 'Сцена', kind: 'sceneTarget' },
        ],
    },
    gotoNextScene: {
        title: 'Следующая сцена',
        category: 'Сцена',
        args: [],
    },

    setVar: {
        title: 'Установить переменную',
        category: 'Состояние',
        args: [
            { key: 'name', label: 'Переменная', kind: 'varName' },
            { key: 'value', label: 'Значение', kind: 'expression' },
        ],
    },
    addVar: {
        title: 'Прибавить к переменной',
        category: 'Состояние',
        args: [
            { key: 'name', label: 'Переменная', kind: 'varName' },
            { key: 'value', label: 'Сколько прибавить', kind: 'expression' },
        ],
    },
    cloneVar: {
        title: 'Копировать переменную',
        category: 'Состояние',
        args: [
            { key: 'from', label: 'Откуда', kind: 'varName' },
            { key: 'to', label: 'Куда', kind: 'varName' },
        ],
    },
    addStats: {
        title: 'Изменить стат',
        category: 'Состояние',
        args: [
            { key: 'stat', label: 'Стат', kind: 'stat' },
            { key: 'value', label: 'На сколько', kind: 'expression' },
        ],
    },
};

export const describeAction = name => ACTION_SPECS[name] ?? null;

// Palette ordering: declared categories first, specs in declaration order inside each
export const paletteByCategory = () => {
    const result = Object.fromEntries(ACTION_CATEGORIES.map(category => [category, []]));
    for (const [name, spec] of Object.entries(ACTION_SPECS))
        result[spec.category]?.push(name);
    return result;
};

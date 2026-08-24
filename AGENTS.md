# Kusya Novell Platform

Платформа для разработки и хостинга визуальных новелл. Клиент — vanilla JS, сервер — PHP 8.2.

---

## Архитектура (Frontend)

```
index.html / game.html / editor.html — главная / игра / редактор сцен
css/  — style.css (общие), app.css (главная), game.css (игровой экран), editor.css (редактор)
js/
├── app.js          — NovelPlatformApp: список игр (GET /api/games)
├── game.js         — Game: ядро, загрузка descriptor.toml, управление сценами
├── scene.js        — SceneController: загрузка action-групп из .act
├── actions.js      — createHandlersMap(): все обработчики экшнов + getKnownActionNames()
├── action-specs.js — ACTION_SPECS: реестр экшнов для редактора (категории, типы полей)
├── editor.js       — ScenesEditor: UI редактора (палитра → группы → карточки экшнов)
├── editor-fields.js — конвертеры formValues ↔ args для типизированных карточек
├── editor-graph.js — FlowGraphView: граф переходов сцены на Drawflow (режим «⬡ Граф»)
├── editor-adapters.js — реестр визуальных адаптеров экшнов + buildEditorContext + хелперы координат
├── editor-modal.js — openModal(): обёртка над нативным <dialog>
├── editor-preview.js — createStagePreview: live-превью сцены 16:9 из настоящих шаблонов игры
├── adapters/ — визуальные адаптеры (self-register через side-effect импорт)
│   └── person-position.js — пилотный адаптер showPersonSprite (пресеты, драг, превью)
├── person.js       — PersonController: спрайты персонажей
├── templater_typer_extension.js — регистрирует typer-инъекцию в Templater (side-effect при импорте)
└── lib/
    ├── act/act-parser.js          — ActParser: парсер .act-файлов → AST { groups }; статический ActParser.parseArgs()
    ├── act/act-serializer.js      — ActSerializer: AST → текст .act (round-trip к парсеру)
    ├── act/ast-editor.js          — чистые CRUD-хелперы над AST групп/экшнов
    ├── expressions/expressions.js — ExpressionsParser: парсер и вычисление выражений
    ├── flow/flow-graph.js        — buildFlowGraph: AST → {nodes, edges}; resolveEdgeAction
    ├── flow/flow-layout.js       — layoutGraph: раскладка узлов графа (ряды × колонки)
    ├── drawflow/drawflow.js      — вендорная либа Drawflow (ES-модуль, MIT; стили css/vendor-drawflow.css)
    ├── layout/anchor.js          — computeAnchorStyles: чистая математика якорей 0..1 (рантайм и превью)
    ├── templater/templater.js     — HTML-шаблонизатор
    ├── toml/toml.js               — вендорная либа (глобаль toml, классический скрипт)
    └── typer/typer.js             — печатающийся текст
package.json         — {"type":"module"} + алиасы "#/*" для Node
js/tests/            — интеграционные и рантайм-тесты
run-tests.sh         — запуск всех тестов
```

---

## Модули и импорты

Весь JS — ES-модули. Алиас `#/` указывает на `./js/`:
- в браузере — через `<script type="importmap">` в index.html/game.html;
- в Node (тесты) — через `"imports"` в package.json.

```js
import { Game } from '#/game.js';
import { ActParser } from '#/lib/act/act-parser.js';
```

Исключение — `js/lib/toml/toml.js`: вендорная библиотека подключается классическим скриптом и даёт глобаль `toml` (используется в `Utils.fetchTOML`).

Порядок side-effect'ов гарантируется порядком импортов: `game.js` импортирует `Templater`, затем `templater_typer_extension.js`, который регистрирует typer-хендлер.

Работа через `file://` не поддерживается (CORS у модулей) — только через сервер (см. «Запуск»).

---

## Исполнение сцен и ошибки

Модель исполнения: группы — строго последовательно, ноды внутри группы — параллельно (`Promise.allSettled`).

Политика ошибок:
- **Упавшая нода не мешает соседним**: исключение (sync или async) изолируется, репортится через `onActionError({ sceneKey, groupKey, action, error })` (дефолт — `console.error` с контекстом), группа завершается, игра продолжается.
- **Фатальные ошибки загрузки** (descriptor.toml, шаблоны, .act-файл, HTTP != 200) — оверлей `showFatalError()` поверх игры + кнопка «В меню»; страховка — обработчик `unhandledrejection` в game.html.
- Все игровые ресурсы грузятся через `Utils.fetch` (проверяет `response.ok`).
- Хендлеры бросают понятные ошибки вместо TypeError: `Person "x" not found`, `Sprite "y" not found for person "x"`, `Background "x" not found`, `Stat "x" not found`, `Unknown action "x"`.

---

## .act файлы (синтаксис)

Группы экшнов с метками. Аргументы — через запятую; строки в кавычках; `true`, `false`, `null` распознаются; числа парсятся; всё остальное — сырые строки (выражения).

```act
[0]
setBackground(1)
showTitle("Первая сцена")

[1]
movePersonSprite(vi, 0, 0)
showPhrasePerson(vi.default, "Голос", "Где я???")

[2]
showChoice(ans1, "Сколько будет 2 + 2?", "3", "4", "5")

[3]
if(ans1 == "4"): 4
if(ans1 != "4"): 5

[4]
setVar(score, score + 1)
setVar(bonus, score ** 2)
addStats(alive, bonus)
gotoNextScene()

[5]
end()
```

Условный переход: `if(выражение): метка` — `выражение` вычисляется через `ExpressionsParser`.

### Диагностика парсера

- Любая синтаксическая ошибка → `ActParseError extends Error` с полем `lineNumber` (1-based, пустые строки и комментарии учитываются) и суффиксом `(line N)` в сообщении.
- Ошибки вместо молчаливых пропусков: экшн вне группы, строка без скобок / без имени экшна, непарная `(`, мусор после закрывающей скобки (кроме условной формы `: метка`), пустой `[]` и дублирующийся лейбл группы.
- Комментарии парсер отбрасывает — это официальное поведение: сохранение через сериализатор нормализует файл.

### Сериализация (AST → .act)

```js
const text = new ActSerializer({ groups }).serialize(); // или serialize(parseResult)
```

- Каноническая форма условия: `if(условие): метка` (последний аргумент — цель).
- Строки эмитятся без кавычек, если репарсинг вернёт их без изменений; иначе — в кавычках (`"` или `'`, тот тип, которого нет внутри строки). **Backslash-эскейпов нет** — парсер сохраняет `\` буквально.
- Невыразимые значения → `ActSerializeError` с контекстом группы/экшна: `NaN`, `Infinity`, `undefined`, объекты/массивы/функции, перевод строки внутри строки, строки с обоими типами кавычек.
- Гарантия round-trip: `parse(serialize(parse(src)))` deep-equals `parse(src)` (покрыто тестами на реальных сценах). Комментарии при round-trip теряются (см. «Диагностика парсера»).

---

## Action handlers (`js/actions.js`)

```js
action_setBackground([ bgKey ])
action_showTitle([ title ])              // тайтл на 5 сек, затем gotoNext
action_showPhrase([ text ])              // делегирует showPhrasePerson с personSprite=null
action_showPhrasePerson([ personSprite, pseudoName?, text, hideAllOther? ])
action_showChoice([ choiceKey, text, ...choices ])   // делегирует showChoicePerson
action_showChoicePerson([ choiceKey, personSprite, text, ...choices ])
action_if([ condition, target ])         // evaluate(condition) → if truthy, goto(target)
action_goto([ groupKey ]) / action_gotoNext()
action_gotoScene([ sceneKey ])           // переход к другой сцене по ключу
action_gotoNextScene()
action_cloneVar([ oldVarName, newVarName ])
action_setVar([ varName, value ])        // value вычисляется как выражение
action_addVar([ varName, value ])        // value вычисляется как выражение
action_addStats([ statName, value ])     // value вычисляется как выражение
action_movePersonSprite([ personSprite, x, y ])
action_showPersonSprite([ personSprite, hideAllOther?, x?, y? ])
action_end()                             // редирект на главную
```

Все хендлеры получают плоский массив аргументов (деструктуризация). `_showDialog` и `_showChoices` — внутренние helpers для рендера UI.

---

## Expressions (`js/lib/expressions/expressions.js`)

Операторы (приоритет сверху вниз):
- Унарные: `!` `-`
- Экспонента: `**` `^`
- Мультипликативные: `*` `/`
- Аддитивные: `+` `-` (конкатенация строк, если хоть один операнд — строка)
- Сравнения: `==` `!=` `<` `>` `<=` `>=`
- Логические: `&&` `||`

Литералы: числа, строки в кавычках (`"abc"`, `'abc'`), `true`, `false`, `null`.

Контекст (в `Game`): переменные `this.variables[name]`, статы `this.stats[name].value` через `stats.имя`.

```js
const parser = new ExpressionsParser({
    expression: "x + y * 2 > 10",
    getFromContextCallback: name => context[name],
});
const result = parser.evaluate(); // число, строка или boolean
```

---

## Редактор сцен (`editor.html` + `js/editor.js`)

`ScenesEditor` — клиентский nocode-редактор .act-файлов. Флоу: выбор игры (`GET /api/games`) → `descriptor.toml` → сцена (ключи из `[scenes]`, файл по полю `RU`) → парсинг через `ActParser`.

- **Палитра карточек** (`ACTION_SPECS`, 5 категорий): перетаскивание в группу (drop на панель = в конец, на карточку = перед ней) или клик; нативный HTML5 DnD без либ.
- **Типизированные карточки**: поля рендерятся по спеке экшна (`editor-fields.js` конвертирует formValues ↔ args); селекты персонажей/фонов/статов/лейблов групп строятся из descriptor и текущего AST; у `showChoice*` — вариадик список вариантов; тумблер `⌗` переключает карточку в сырой режим.

### Адаптеры визуального редактора (`js/adapters/` + `js/editor-adapters.js`)

Для экшна можно объявить визуальный адаптер — модалку с live-превью вместо дефолтной формы. Контракт:
- адаптер работает **только на уровне formValues** (ключи как в `spec.args`); запись в AST — только через карточный `collectAndApply()`;
- ресурсы игры — только через `context` (`buildEditorContext`: persons/backgrounds/scenes/templates с URL);
- регистрация: `registerAdapter(actionName, { title, mount(ctx) → { save(): patch|null } })` в `js/adapters/*.js`, файл подключается side-effect импортом в `editor.js`;
- `ctx`: `{ container, values, context, makeStage(options) → createStagePreview, onChange(patch) }`;
- превью: `createStagePreview` строит бокс 16:9 из настоящих шаблонов и стилей игры (css/game.css подключён в editor.html, per-game styles.css инжектится со скоупом под `.stage-preview`);
- геометрия спрайтов: `computeAnchorStyles(x, y, viewport)` из `js/lib/layout/anchor.js` — одна математика для игры (`PersonController.updatePosition(viewport?)`) и превью;
- кнопка «🎨» появляется в typed-карточке автоматически при наличии адаптера.

### Тестовый прогон в разных разрешениях

`viewport.html?game=game_1_demo&w=1280&h=720` — iframe ровно w×h c letterbox-масштабом: внутри честные `window.innerWidth`, media-queries и matchMedia. Пресеты в тулбаре. Автотесты геометрии — матрица разрешений в `js/lib/layout/anchor.test.js`.
- Правка: CRUD и reorder групп/экшнов через чистые хелперы `lib/act/ast-editor.js`.
- Валидация: имя экшна сверяется со списком `getKnownActionNames()` (экспорт `actions.js`); тест гарантирует равенство множеств `ACTION_SPECS` ↔ хендлеры; ключи групп проверяются на уникальность; ошибки аргументов показываются инлайн в карточке.
- Сохранение: «Скачать .act» (Blob-download `<имя сцены>.ru.act`) или «Сохранить на сервер» (`POST /api/games/{id}/scenes/{file}`); перед обоими — контрольный round-trip `parse(serialize(ast))` должен дать идентичный AST.
- Комментарии при экспорте теряются (см. «Диагностика парсера») — сохранение нормализует файл.

---

## Тесты

```bash
./run-tests.sh                              # все тесты сразу
node js/lib/act/act-parser.test.js          # ActParser
node js/lib/act/act-serializer.test.js      # ActSerializer + round-trip
node js/lib/act/ast-editor.test.js          # AST-хелперы редактора
node js/action-specs.test.js                # реестр экшнов + конвертеры полей
node js/lib/flow/flow-graph.test.js         # модель графа переходов
node js/lib/flow/flow-layout.test.js        # раскладка графа
node js/lib/expressions/expressions.test.js # Expressions
node js/editor-adapters.test.js             # реестр адаптеров + контекст ресурсов
node js/lib/layout/anchor.test.js           # математика якорей, матрица разрешений
node js/tests/integration.test.js           # интеграционные
node js/tests/runtime-errors.test.js        # изоляция упавших нод, guards
```

При добавлении фичи: обновить парсер/движок → добавить тесты → `./run-tests.sh`.

---

## Коммиты

Формат: `<scope>: <краткое описание в нижнем регистре>`, scope — путь или компонент (`js/lib/act:`, `js/scene:`, `resources/games/demo:`). Тесты кладутся вместе с фичей одним коммитом.

---

## Игровые ресурсы

```
resources/games/<game_id>/
├── config/
│   ├── descriptor.toml  — мета-описание (сцены, фоны, персонажи, шаблоны, статы)
│   └── info.json        — название, описание, язык
├── scenes/*.ru.act       — сцены
├── bg/                   — фоны
├── sprites/              — спрайты
└── *.html                — шаблоны (dialog, choices, sceneTitle)
```

`setVar` и `addStats` вычисляют значение-аргумент через `ExpressionsParser`, поэтому можно писать `setVar(score, score + 1)` или `addStats(alive, bonus)`.

---

## API

Роутинг: Apache `.htaccess` (docker) или `router.php` для `php -S`. Ответы — JSON `{success, ...}` / `{success:false, error}`.

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/games` | список игр (сканирует `resources/games/*`, читает `info.json`) |
| POST | `/api/games/{gameId}/scenes/{file}` | перезапись файла сцены (body `{"content": "<act текст>"}`) |

Правила write-эндпоинта (dev-only, без auth): перезаписываются только **существующие** файлы `resources/games/<gameId>/scenes/*.act`; `basename` + `realpath` против path traversal; атомарная запись (tmp+rename) с одноразовым бэкапом `<file>.bak`.

---

## Запуск

```bash
docker compose up -d       # http://localhost:8080
php -S localhost:8080 router.php   # без Docker (API работает через роутер, БД не нужна)
```
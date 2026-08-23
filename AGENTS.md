# Kusya Novell Platform

Платформа для разработки и хостинга визуальных новелл. Клиент — vanilla JS, сервер — PHP 8.2.

---

## Архитектура (Frontend)

```
index.html / game.html — главная страница / страница игры
css/  — style.css (общие), app.css (главная), game.css (игровой экран)
js/
├── app.js          — NovelPlatformApp: список игр (GET /api/games)
├── game.js         — Game: ядро, загрузка descriptor.toml, управление сценами
├── scene.js        — SceneController: загрузка action-групп из .act
├── actions.js      — createHandlersMap(): все обработчики экшнов
├── person.js       — PersonController: спрайты персонажей
└── lib/
    ├── act/act-parser.js          — ActParser: парсер .act-файлов
    ├── expressions/expressions.js — ExpressionsParser: парсер и вычисление выражений
    ├── templater/templater.js     — HTML-шаблонизатор
    └── typer/typer.js             — печатающийся текст
js/tests/            — интеграционные тесты
run-tests.sh         — запуск всех тестов
```

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
action_gotoNextScene()
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

## Тесты

```bash
./run-tests.sh                             # все тесты сразу
node js/lib/act/act-parser.test.js         # ActParser
node js/lib/expressions/expressions.test.js # Expressions
node js/tests/integration.test.js          # интеграционные
```

При добавлении фичи: обновить парсер/движок → добавить тесты → `./run-tests.sh`.

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

## Запуск

```bash
docker compose up -d       # http://localhost:8080
php -S localhost:8080      # без Docker (API работает, БД не нужна)
```
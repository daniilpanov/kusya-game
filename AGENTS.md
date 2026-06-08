# Kusya Novell Platform

## Описание
Платформа для разработки и хостинга визуальных новелл. Состоит из клиентского SPA на чистом JS и серверного API на PHP.

---

## Архитектура

### Frontend (vanilla JS, без фреймворков)

```
index.html          — Главная страница (список игр)
game.html           — Страница игры (рендер сцены)
css/
├── style.css       — Базовые стили, кнопки, модалки, адаптив
├── app.css         — Стили для главной страницы
└── game.css        — Стили для игрового экрана (фон, персонажи, диалоги, выборы)
js/
├── app.js          — NovelPlatformApp: загрузка и отображение списка игр
├── game.js         — Game: ядро игры, загрузка дескриптора, управление сценами
├── scene.js        — SceneController: парсинг action-групп из .act-файлов
├── actions.js      — createHandlersMap(): все обработчики экшнов
├── person.js       — PersonController: управление спрайтами персонажа
├── utils.js        — Utils: fetch, loadImage, fadeIn/Out, typeText, etc.
├── templater_typer_extension.js — интеграция Templater + Typer
└── lib/
    ├── toml/toml.js          — TOML-парсер
    ├── templater/templater.js — Templater: инъекция данных в HTML-шаблоны
    ├── typer/typer.js         — TextTyper: печатающийся текст
    └── expressions/expressions.js — ExpressionsParser: парсер и evaluation условий
```

### Backend (PHP 8.2)

```
api/
└── games.php       — GET /api/games — сканирует resources/games/*/config/info.json
php/
├── Dockerfile      — php:8.2-apache + pdo_mysql + mod_rewrite
└── config/php.ini  — PHP-конфигурация
apache/
└── 000-default.conf — VirtualHost конфиг
.htaccess           — Rewrite rules (API routes)
```

### Игровые ресурсы

```
resources/games/
└── game_1_demo/
    ├── config/
    │   ├── descriptor.toml  — Мета-описание игры: сцены, фоны, персонажи, шаблоны
    │   └── info.json        — Название, описание, язык
    ├── scenes/
    │   ├── 1.ru.act         — Сцена 1 (action-группы в TOML)
    │   └── 2.ru.act         — Сцена 2
    ├── bg/                  — Фоновые изображения
    ├── sprites/             — Спрайты персонажей
    ├── styles.css           — Стили игры
    ├── dialog_template.html
    ├── choices_template.html
    └── scene_title_template.html
```

---

## Как это работает

1. **index.html** → `NovelPlatformApp.init()` → GET `/api/games` → рендер карточек игр
2. Клик "Начать игру" → редирект на `game.html?game_resource=...&game_descriptor_uri=...`
3. **game.html** → `Game.init()`:
   - Загружает `descriptor.toml` (статы, шаблоны, фоны, персонажи, сцены)
   - Прелоадит изображения
   - Создаёт `PersonController` для каждого персонажа
   - Загружает первую сцену (через `SceneController`)
4. **SceneController** парсит `.act`-файл (TOML) в группы экшнов
5. Каждая группа экшнов выполняется последовательно через `Game.handleAction()`
6. Экшны: `setBackground`, `showPhrase`, `showChoice`, `showTitle`, `goto`, `if`, `setVar`, `addStats`, `movePersonSprite`, `gotoNextScene`, `end` и др.

### Формат .act-файлов (action-группы)

```toml
[0]
setBackground = 1
showTitle = "Первая сцена"
[1]
showPhrase(vi.default, Незнакомец) = "Где я???"
[2]
showChoice(nextDoing, vi.smile) = [ "Вопрос", "Вариант 1", "Вариант 2" ]
[3]
if(nextDoing == "Вариант 1") = 7
```

---

## Запуск

### Через Docker (рекомендуется)

```bash
docker compose up -d
```

Сайт будет доступен на http://localhost:8080

### Вручную (без Docker)

Любой HTTP-сервер с корнем в директории проекта, например:

```bash
php -S localhost:8080
```

PHP нужен только для API (`/api/games`). Если API не требуется, можно использовать любой статический сервер.

---

## БД (не подключена)

В `.env` определены параметры MySQL, в `php/Dockerfile` установлен `pdo_mysql`. На данный момент API работает без БД — сканирует файловую систему. Подключение БД предусмотрено для будущих механик (сохранения, пользователи).

---

## Ветки

- `master` — основная разработка
- `release-1.0-demo` — первый стабильный релиз
- `release-1.1-forrest-game` — вторая игра (Forrest)
- `feature/tiny-interpreter` — экспериментальный интерпретатор

---

## Зависимости (Frontend)

Библиотеки написаны вручную (vendored), внешних зависимостей нет:
- `lib/toml/toml.js` — TOML-парсер
- `lib/templater/templater.js` — HTML-шаблонизатор
- `lib/typer/typer.js` — печатающийся текст
- `lib/expressions/expressions.js` — парсер условных выражений

Стили: `css/style.css` (общие), `css/app.css` (главная), `css/game.css` (игра).
Стили конкретной игры: `resources/games/*/styles.css`.

---

## Конфигурация игры (descriptor.toml)

```toml
[templates]
styles = "styles.css"
dialog = "dialog_template.html"
choices = "choices_template.html"
sceneTitle = "scene_title_template.html"

[scenes]
[scenes.1]
RU = "scenes/1.ru.act"

[backgrounds]
[backgrounds.1]
src = "bg/bg1.png"
position = "static"

[stats]
[stats.alive]
name = "Живость"
description = "..."

[persons]
[persons.vi]
name = "Vi"
[persons.vi.sprites]
default = "sprites/vi/def.png"
smile = "sprites/vi/smile.png"
```

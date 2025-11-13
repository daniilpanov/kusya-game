# Платформа Kusya Novell
## Описание
Платформа для разработки и хостинга игр типа визуальная новелла.

### Техниеские возможности
1. Установка фона
2. Установка спрайта персонажа в произвольную относительную позицию
3. Смена фона
4. Смена спрайта
5. Организация спрайтов в группы (например, один герой - разные эмоции)
6. Установка видео
7. Установка музыки
8. Выборы
9. Экшны *

\* подробное описание экшнов представлено ниже.

### Экшны
Это чем-то напоминает RPC или GraphQL. Экшн запускает какое-либо действие на экране пользователя.
Экшны обязаны быть объединены в группы (даже по 1). Экшны в одной группе исполняются безусловно, поочерёдно.
Для перехода к новой группе экшнов используется `goto`.

#### Команды и формат экшнов
Команды:
1. `void goto(GroupId)` - переход к новой группе экшнов
2. `void setBackground(BackgroundId)` - установка фона
3. `ObjectId playMusic(MusicId, Volume?, Speed?, ClipRange?{ start, stop })` - установка фоновой музыки (Volume от 0 до 100)
4. `ObjectId addSprite(SpriteId, EmotionId?, Position( { x, y } | { border: Left / Right / Center } ))` - добавление спрайта
5. `void setSpriteEmotion(ObjectId, EmotionId)` - установка эмоции спрайту
6. `void setSpritePosition(position{ x, y })` - установка позиции спрайту
6. `ObjectId cloneObject(ObjectId)` - клонирование объекта
7. `void removeObject(ObjectId)` - удаление объекта
8. `void setDialog(TextId)` - показать диалог
9. `void hideDialod()` - скрыть диалог
10. `T getFutureResource<T>(FutureResource<T>)` - получение ресурса "из будущего"
Для систем с ограниченными возможностями:
11. `FutureResource<ChoiceId> setChoice(ChoiceMap{ ChoiceId: TextId })` - показать выбор
12. `void ifElse(Condition{ ActionId / Callback }, If{ ActionId / Callback }, Else{ ActionId / Callback })` - условие
13. `void cycle(Condition{ ActionId / Callback }, Body{ ActionId / Callback })` - цикл while

Формат:
1. JSON: группа - массив, экшн - объект. { function: strId, args: [{ type: <value/ref>, body: Any }, ...], storeResultAs: refId }
2. JS: группа - метод. Игра - объект. Допускается разделение на сцены.
3. Database (1): группа - запись имён скриптов JS как групп и их функций как экшнов
4. Database (2): группа - таблица group, экшн - таблица actions с колонками id, function, args, storeResultAs

-- Таблица игр
CREATE TABLE games
(
    id             INT PRIMARY KEY AUTO_INCREMENT,
    title          VARCHAR(255) NOT NULL,
    start_scene_id VARCHAR(50)  NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица сцен
CREATE TABLE scenes
(
    id                 INT PRIMARY KEY AUTO_INCREMENT,
    game_id            INT         NOT NULL,
    scene_external_id  VARCHAR(50) NOT NULL UNIQUE,
    background         VARCHAR(255),
    music              VARCHAR(255),
    initial_characters JSON        NOT NULL,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games (id),
    INDEX              idx_game_scene (game_id, scene_external_id)
);

-- Actions
CREATE TABLE actions
(
    id                INT PRIMARY KEY AUTO_INCREMENT,
    parent_id         INT      NULL,
    scene_id          INT  NOT NULL,
    action            JSON,
    has_choice        BOOLEAN DEFAULT FALSE,
    choice_text       TEXT,
    choice_alias      VARCHAR(50),
    FOREIGN KEY (scene_id) REFERENCES scenes (id),
    FOREIGN KEY (parent_id) REFERENCES actions (id),
    UNIQUE INDEX      uid_choice_scene (scene_id, choice_alias)
);

-- Тестовые данные
INSERT INTO games (title, start_scene_id)
VALUES ('Тестовая новелла', 'scene_1'),
       ('Демо игра', 'demo_start');

-- Тестовая сцена 1
INSERT INTO scenes (game_id, scene_external_id, background, music, initial_characters)
VALUES (1,
        'scene_1',
        'forest.jpg',
        'peaceful.mp3',
        '[
          {
            "id": "hero",
            "sprite": "hero_normal.png",
            "x": 0.2,
            "y": 0.8,
            "visible": true
          },
          {
            "id": "npc",
            "sprite": "npc_normal.png",
            "x": 0.8,
            "y": 0.8,
            "visible": false
          }
        ]');

-- Демо сцена
INSERT INTO scenes (game_id, scene_external_id, background, music, initial_characters)
VALUES (2,
        'demo_start',
        'city.jpg',
        'city_ambient.mp3',
        '[
          {
            "id": "main_character",
            "sprite": "mc_default.png",
            "x": 0.4,
            "y": 0.7,
            "visible": true
          }
        ]');

-- Тестовые диалоги для сцены 1
INSERT INTO actions (id, parent_id, scene_id,`action`, choice_text, choice_alias, has_choice)
VALUES (1, NULL, 1, '[{
         "action": "dialog",
         "body": {
           "text": "Приветствую, путник! Давно я не видел здесь новых лиц.",
           "character_id": "hero"
         }
       }, {
         "action": "character",
         "body": {
           "character_id": "hero",
           "sprite": "hero_surprised.png"
         }
       }]', NULL, NULL, FALSE),
       (2, 1, 1, '[{
         "action": "dialog",
         "body": {
           "text": "Из-за деревьев появляется незнакомец..."
         }
       }, {
         "action": "character",
         "body": {
           "character_id": "npc",
           "visible": true
         }
       }]', NULL, NULL, FALSE),
       (3, 2, 1, '[{
         "action": "dialog",
         "body": {
           "text": "Интересно, что здесь происходит? Куда я попал?",
           "character_id": "npc"
         }
       }]', NULL, NULL, FALSE),
       (4, 3, 1, '[{
         "action": "dialog",
         "body": {
           "text": "Вы оказываетесь в таинственном лесу..."
         }
       }]', NULL, NULL, FALSE),
       (5, 4, 1, '[{
         "action": "dialog",
         "body": {
           "text": "Что вы ответите незнакомцу?"
         }
       }]', NULL, NULL, TRUE),
       (6, 5, 1, '[{
         "action": "dialog",
         "body": {
           "text": "Привет. Очень приятно",
           "character_id": "npc"
         }
       }, {"action": "end"}]', 'Поздороваться вежливо', 'welcome', FALSE),
       (7, 5, 1, '[{
         "action": "dialog",
         "body": {
           "text": "Я не знаю",
           "character_id": "npc"
         }
       }, {"action": "end"}]', 'Спросить "Кто ты?"', 'who', FALSE),
       (8, 5, 1, '[{
         "action": "dialog",
         "body": {
           "text": "Он ушёл"
         }
       }, {"action": "end"}]', 'Промолчать и уйти', 'goaway', FALSE);

-- Демо диалоги
INSERT INTO actions (id, parent_id, scene_id, `action`)
VALUES (9, NULL, 2, '[{
         "action": "dialog",
         "body": {
           "text": "Вы просыпаетесь в незнакомом городе..."
         }
       }]'),
       (10, 9, 2, '[{
         "action": "dialog",
         "body": {
           "text": "Где я? Что это за место?"
         }
       }, {"action": "end"}]');
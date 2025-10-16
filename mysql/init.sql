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

-- Таблица диалогов
CREATE TABLE dialogues
(
    id                INT PRIMARY KEY AUTO_INCREMENT,
    scene_id          INT  NOT NULL,
    dialogue_order    INT  NOT NULL,
    character_id      VARCHAR(50),
    text              TEXT NOT NULL,
    character_changes JSON,
    next_dialogue_id  INT NULL,
    next_scene_id     VARCHAR(50) NULL,
    is_choice         BOOLEAN   DEFAULT FALSE,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scene_id) REFERENCES scenes (id),
    FOREIGN KEY (next_dialogue_id) REFERENCES dialogues (id),
    INDEX             idx_scene_order (scene_id, dialogue_order)
);

-- Таблица выборов (для ветвления)
CREATE TABLE choices
(
    id               INT PRIMARY KEY AUTO_INCREMENT,
    dialogue_id      INT  NOT NULL,
    choice_text      TEXT NOT NULL,
    next_dialogue_id INT NULL,
    next_scene_id    VARCHAR(50) NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dialogue_id) REFERENCES dialogues (id),
    FOREIGN KEY (next_dialogue_id) REFERENCES dialogues (id)
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
            "position": {
              "desktop": {
                "x": "20%",
                "y": "50%"
              },
              "mobile": {
                "x": "10%",
                "y": "60%"
              }
            },
            "visible": true
          },
          {
            "id": "npc",
            "sprite": "npc_normal.png",
            "position": {
              "desktop": {
                "x": "80%",
                "y": "50%"
              },
              "mobile": {
                "x": "70%",
                "y": "60%"
              }
            },
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
            "position": {
              "desktop": {
                "x": "50%",
                "y": "70%"
              },
              "mobile": {
                "x": "50%",
                "y": "80%"
              }
            },
            "visible": true
          }
        ]');

-- Тестовые диалоги для сцены 1
INSERT INTO dialogues (scene_id, dialogue_order, character_id, text, character_changes, next_dialogue_id)
VALUES (1, 5, NULL, 'Что вы ответите незнакомцу?', NULL, NULL),
       (1, 1, 'narrator', 'Вы оказываетесь в таинственном лесу...', NULL, 2),
       (1, 2, 'hero', 'Интересно, что здесь происходит? Куда я попал?', NULL, 3),
       (1, 3, NULL, 'Из-за деревьев появляется незнакомец...', '[
         {
           "character_id": "npc",
           "visible": true
         }
       ]', 4),
       (1, 4, 'npc', 'Приветствую, путник! Давно я не видел здесь новых лиц.', '[
         {
           "character_id": "hero",
           "sprite": "hero_surprised.png"
         }
       ]', 5);

-- Варианты выбора
INSERT INTO choices (dialogue_id, choice_text, next_scene_id)
VALUES (5, 'Поздороваться вежливо', 'scene_2'),
       (5, 'Спросить "Кто ты?"', 'scene_3'),
       (5, 'Промолчать и уйти', 'scene_4');

-- Демо диалоги
INSERT INTO dialogues (scene_id, dialogue_order, character_id, text, character_changes, next_scene_id)
VALUES (2, 1, 'narrator', 'Вы просыпаетесь в незнакомом городе...', NULL, 'demo_scene_2'),
       (2, 2, 'main_character', 'Где я? Что это за место?', NULL, 'demo_scene_2');
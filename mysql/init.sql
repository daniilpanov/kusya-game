-- Таблица игр
CREATE TABLE games
(
    id                   INT PRIMARY KEY AUTO_INCREMENT,
    `name`               VARCHAR(255) NOT NULL,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    descriptor_directory VARCHAR(255) NOT NULL
);

-- Тестовые данные
INSERT INTO games (`name`, descriptor_directory)
VALUES ('Лес', 'game_1_forrest')

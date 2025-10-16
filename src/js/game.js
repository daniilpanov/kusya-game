class NovelGameEngine {
    constructor() {
        this.gameId = null;
        this.currentScene = null;
        this.currentSceneId = null;
        this.currentDialogues = [];
        this.currentDialogueIndex = 0;
        this.characters = new Map();
        this.loadedImages = new Set();

        // Состояние игры
        this.gameState = {
            isAutoMode: false,
            isSkipping: false,
            isTyping: false,
            currentText: '',
            achievements: new Set(),
            variables: new Map()
        };

        this.init();
    }

    async init() {
        try {
            await this.parseUrlParams();
            await this.setupEventListeners();
            await this.setupDOM();
            await this.loadInitialScene();
        } catch (error) {
            console.error('Game initialization failed:', error);
            this.showError('Не удалось инициализировать игру');
        }
    }

    async parseUrlParams() {
        const params = Utils.getUrlParams();

        this.gameId = params.get('game_id');
        this.currentSceneId = params.get('scene_id');
        this.firstDialogueId = params.get('first_dialogue_id');

        if (!this.gameId || !this.currentSceneId) {
            throw new Error('Missing required game parameters');
        }
    }

    async setupDOM() {
        // Создаем необходимые DOM элементы если их нет
        this.createRequiredElements();

        // Устанавливаем обработчики для основных элементов
        this.dialogueContainer = document.getElementById('dialogueContainer');
        this.dialogueText = document.getElementById('dialogueText');
        this.characterName = document.getElementById('characterName');
        this.sceneBackground = document.getElementById('sceneBackground');
        this.charactersContainer = document.getElementById('charactersContainer');
        this.choicesContainer = document.getElementById('choicesContainer');
        this.loadingOverlay = document.getElementById('loadingOverlay');

        if (!this.dialogueContainer || !this.dialogueText) {
            throw new Error('Required DOM elements not found');
        }
    }

    createRequiredElements() {
        // Создаем контейнер для выбора если его нет
        if (!document.getElementById('choicesContainer')) {
            const choicesContainer = document.createElement('div');
            choicesContainer.id = 'choicesContainer';
            choicesContainer.className = 'choices-container';
            document.querySelector('.game-container').appendChild(choicesContainer);
        }

        // Создаем индикатор загрузки если его нет
        if (!document.getElementById('loadingOverlay')) {
            const loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'loadingOverlay';
            loadingOverlay.className = 'loading-overlay';
            loadingOverlay.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Загрузка...</div>
                </div>
            `;
            document.querySelector('.game-container').appendChild(loadingOverlay);
        }
    }

    async loadInitialScene() {
        await this.showLoading('Загрузка сцены...');

        try {
            await this.loadScene(this.currentSceneId);

            if (this.firstDialogueId) {
                await this.loadDialogues(this.firstDialogueId);
            } else {
                await this.loadDialogues();
            }
        } catch (error) {
            console.error('Error loading initial scene:', error);
            this.showError('Не удалось загрузить начальную сцену');
        } finally {
            await this.hideLoading();
        }
    }

    async loadScene(sceneId) {
        try {
            const data = await Utils.fetchJSON(`/api/scenes/${sceneId}`);

            if (data.success) {
                this.currentScene = data.scene;
                this.currentSceneId = data.scene.scene_id;

                await this.setupScene(this.currentScene);
                return true;
            }
        } catch (error) {
            console.error(`Error loading scene ${sceneId}:`, error);
            throw error;
        }
    }

    async setupScene(scene) {
        // Очищаем предыдущую сцену
        this.clearScene();

        // Устанавливаем фон
        if (scene.background) {
            await this.setBackground(scene.background);
        }

        // Устанавливаем музыку
        if (scene.music) {
            await this.setMusic(scene.music);
        }

        // Создаем персонажей
        if (scene.initial_characters && Array.isArray(scene.initial_characters)) {
            await this.createCharacters(scene.initial_characters);
        }

        // Обновляем URL без перезагрузки страницы
        this.updateUrlParams();
    }

    async setBackground(backgroundImage) {
        if (!backgroundImage) return;

        const imageUrl = `assets/backgrounds/${backgroundImage}`;

        try {
            await Utils.loadImage(imageUrl);
            this.sceneBackground.style.backgroundImage = `url('${imageUrl}')`;
        } catch (error) {
            console.warn(`Could not load background: ${backgroundImage}`, error);
            // Используем цвет как fallback
            this.sceneBackground.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }
    }

    async setMusic(musicFile) {
        // В будущем можно добавить аудио плеер
        console.log('Background music:', musicFile);
    }

    async createCharacters(charactersData) {
        if (!charactersData || !Array.isArray(charactersData)) return;

        const loadPromises = [];

        for (const charData of charactersData) {
            if (charData.visible !== false) {
                loadPromises.push(this.createCharacter(charData));
            }
        }

        await Promise.allSettled(loadPromises);
    }

    async createCharacter(charData) {
        const character = document.createElement('div');
        character.className = `character ${charData.visible === false ? 'hidden' : ''}`;
        character.id = `character-${charData.id}`;
        character.dataset.characterId = charData.id;

        // Устанавливаем позицию
        const position = Utils.getPosition(charData);
        character.style.left = position.x;
        character.style.top = position.y;

        // Загружаем и устанавливаем спрайт
        if (charData.sprite) {
            try {
                const img = await Utils.loadImage(`assets/sprites/${charData.sprite}`);
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                character.appendChild(img);
            } catch (error) {
                console.warn(`Could not load sprite: ${charData.sprite}`, error);
                // Создаем заглушку
                const placeholder = document.createElement('div');
                placeholder.className = 'character-placeholder';
                placeholder.innerHTML = '👤';
                placeholder.style.cssText = `
                    width: 100px;
                    height: 200px;
                    background: rgba(255,255,255,0.8);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2rem;
                `;
                character.appendChild(placeholder);
            }
        }

        this.charactersContainer.appendChild(character);
        this.characters.set(charData.id, character);

        return character;
    }

    async loadDialogues(dialogueId = null) {
        try {
            let url = `/api/scenes/${this.currentSceneId}/dialogues`;
            if (dialogueId) {
                url += `?start_from=${dialogueId}`;
            }

            const data = await Utils.fetchJSON(url);

            if (data.success) {
                this.currentDialogues = data.dialogues || [];
                this.currentDialogueIndex = 0;

                if (this.currentDialogues.length > 0) {
                    await this.startDialogueChain();
                }

                if (data.next_action) {
                    await this.handleNextAction(data.next_action);
                }
            }
        } catch (error) {
            console.error('Error loading dialogues:', error);
            throw error;
        }
    }

    async startDialogueChain() {
        this.showDialogueContainer();

        while (this.currentDialogueIndex < this.currentDialogues.length) {
            const dialogue = this.currentDialogues[this.currentDialogueIndex];
            await this.displayDialogue(dialogue);
            this.currentDialogueIndex++;
        }
    }

    async displayDialogue(dialogue) {
        // Применяем изменения персонажей
        if (dialogue.character_changes && dialogue.character_changes.length > 0) {
            await this.applyCharacterChanges(dialogue.character_changes);
        }

        // Устанавливаем имя персонажа
        if (dialogue.character_id) {
            this.characterName.textContent = this.getCharacterDisplayName(dialogue.character_id);
            this.characterName.style.display = 'block';
        } else {
            this.characterName.style.display = 'none';
        }

        // Показываем текст
        await this.showDialogueText(dialogue.text);

        // Ждем пользовательского ввода для продолжения
        if (!this.gameState.isAutoMode) {
            await this.waitForUserContinue();
        } else {
            // Автоматическое продолжение через 2 секунды
            await Utils.delay(2000);
        }
    }

    async showDialogueText(text) {
        this.dialogueText.textContent = '';

        if (this.gameState.isSkipping) {
            this.dialogueText.textContent = text;
            return;
        }

        this.gameState.isTyping = true;
        await Utils.typeText(this.dialogueText, text, this.getTypeSpeed());
        this.gameState.isTyping = false;
    }

    async applyCharacterChanges(changes) {
        if (!changes || !Array.isArray(changes)) return;

        const promises = changes.map(change => this.applyCharacterChange(change));
        await Promise.allSettled(promises);
    }

    async applyCharacterChange(change) {
        if (!change.character_id) return;

        const character = this.characters.get(change.character_id);
        if (!character) return;

        // Видимость
        if (change.visible !== undefined) {
            if (change.visible) {
                character.classList.remove('hidden');
            } else {
                character.classList.add('hidden');
            }
        }

        // Спрайт
        if (change.sprite) {
            try {
                const img = await Utils.loadImage(`assets/sprites/${change.sprite}`);
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';

                // Заменяем текущее изображение
                const currentImg = character.querySelector('img, .character-placeholder');
                if (currentImg) {
                    character.removeChild(currentImg);
                }
                character.appendChild(img);
            } catch (error) {
                console.warn(`Could not load character sprite: ${change.sprite}`, error);
            }
        }

        // Позиция
        if (change.position) {
            const position = Utils.getPosition(change);
            character.style.left = position.x;
            character.style.top = position.y;
        }

        // Анимации (можно добавить позже)
        if (change.animation) {
            character.style.animation = `${change.animation} 0.5s ease`;
        }
    }

    async handleNextAction(nextAction) {
        if (!nextAction) return;

        switch (nextAction.type) {
            case 'choice':
                await this.showChoices(nextAction.choice_dialogue_id);
                break;

            case 'scene_transition':
                await this.transitionToScene(nextAction.next_scene_id);
                break;

            default:
                console.warn('Unknown next action type:', nextAction.type);
        }
    }

    async showChoices(choiceDialogueId) {
        // Скрываем диалоговое окно
        this.hideDialogueContainer();

        // Загружаем варианты выбора
        try {
            const choicesData = await this.loadChoices(choiceDialogueId);
            await this.displayChoices(choicesData);
        } catch (error) {
            console.error('Error loading choices:', error);
            this.showError('Не удалось загрузить варианты выбора');
        }
    }

    async loadChoices(choiceDialogueId) {
        // В реальной реализации здесь будет запрос к API для получения вариантов выбора
        // Пока используем заглушку
        return [
            { id: 1, text: 'Поздороваться вежливо' },
            { id: 2, text: 'Спросить "Кто ты?"' },
            { id: 3, text: 'Промолчать и уйти' }
        ];
    }

    async displayChoices(choices) {
        if (!choices || choices.length === 0) {
            console.warn('No choices to display');
            return;
        }

        this.choicesContainer.innerHTML = '';

        choices.forEach(choice => {
            const choiceButton = document.createElement('button');
            choiceButton.className = 'choice-btn';
            choiceButton.textContent = choice.text;
            choiceButton.dataset.choiceId = choice.id;

            choiceButton.addEventListener('click', () => {
                this.handleChoice(choice);
            });

            this.choicesContainer.appendChild(choiceButton);
        });

        // Показываем контейнер с анимацией
        this.choicesContainer.style.display = 'flex';
        await Utils.fadeIn(this.choicesContainer);
    }

    async handleChoice(choice) {
        // Скрываем варианты выбора
        this.choicesContainer.style.display = 'none';
        this.choicesContainer.innerHTML = '';

        try {
            const response = await Utils.fetchJSON('/api/choices', {
                method: 'POST',
                body: {
                    choice_id: choice.id,
                    game_id: this.gameId
                }
            });

            if (response.success) {
                await this.processChoiceResult(response);
            }
        } catch (error) {
            console.error('Error processing choice:', error);
            this.showError('Не удалось обработать выбор');
        }
    }

    async processChoiceResult(response) {
        const nextAction = response.next_action;

        if (!nextAction) {
            console.warn('No next action in choice response');
            return;
        }

        switch (nextAction.type) {
            case 'scene_transition':
                await this.transitionToScene(nextAction.scene_id);
                break;

            case 'continue_dialogue':
                await this.loadDialogues(nextAction.dialogue_id);
                break;

            default:
                console.warn('Unknown choice result type:', nextAction.type);
        }
    }

    async transitionToScene(sceneId) {
        await this.showLoading('Переход к новой сцене...');

        try {
            await this.loadScene(sceneId);
            await this.loadDialogues();
        } catch (error) {
            console.error('Error transitioning to scene:', error);
            this.showError('Не удалось перейти к новой сцене');
        } finally {
            await this.hideLoading();
        }
    }

    // Вспомогательные методы
    showDialogueContainer() {
        this.dialogueContainer.classList.add('active');
    }

    hideDialogueContainer() {
        this.dialogueContainer.classList.remove('active');
    }

    async waitForUserContinue() {
        return new Promise(resolve => {
            const continueHandler = () => {
                this.dialogueContainer.removeEventListener('click', continueHandler);
                document.removeEventListener('keydown', keyHandler);
                resolve();
            };

            const keyHandler = (e) => {
                if (e.code === 'Space' || e.code === 'Enter') {
                    e.preventDefault();
                    continueHandler();
                }
            };

            this.dialogueContainer.addEventListener('click', continueHandler);
            document.addEventListener('keydown', keyHandler);
        });
    }

    getCharacterDisplayName(characterId) {
        // В будущем можно добавить словарь имен персонажей
        const nameMap = {
            'hero': 'Герой',
            'npc': 'Незнакомец',
            'narrator': ''
        };

        return nameMap[characterId] || characterId;
    }

    getTypeSpeed() {
        if (this.gameState.isSkipping) return 0;
        return this.gameState.isAutoMode ? 10 : 20;
    }

    clearScene() {
        // Очищаем персонажей
        this.charactersContainer.innerHTML = '';
        this.characters.clear();

        // Очищаем диалоги
        this.dialogueText.textContent = '';
        this.characterName.textContent = '';
        this.hideDialogueContainer();

        // Очищаем выборы
        this.choicesContainer.innerHTML = '';
        this.choicesContainer.style.display = 'none';
    }

    updateUrlParams() {
        const params = new URLSearchParams({
            game_id: this.gameId,
            scene_id: this.currentSceneId
        });

        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newUrl);
    }

    async showLoading(message = 'Загрузка...') {
        if (this.loadingOverlay) {
            const textElement = this.loadingOverlay.querySelector('.loading-text');
            if (textElement) {
                textElement.textContent = message;
            }
            this.loadingOverlay.style.display = 'flex';
            await Utils.fadeIn(this.loadingOverlay);
        }
    }

    async hideLoading() {
        if (this.loadingOverlay) {
            await Utils.fadeOut(this.loadingOverlay);
            this.loadingOverlay.style.display = 'none';
        }
    }

    showError(message, duration = 5000) {
        // Используем ту же систему ошибок что и в app.js
        if (window.novelApp && typeof window.novelApp.showError === 'function') {
            return window.novelApp.showError(message, duration);
        }

        // Fallback
        alert(message);
    }

    // Управление игрой
    toggleAutoMode() {
        this.gameState.isAutoMode = !this.gameState.isAutoMode;

        const autoBtn = document.getElementById('autoBtn');
        if (autoBtn) {
            autoBtn.classList.toggle('active', this.gameState.isAutoMode);
            autoBtn.textContent = this.gameState.isAutoMode ? 'Авто ⏸' : 'Авто ⏵';
        }

        return this.gameState.isAutoMode;
    }

    toggleSkipMode() {
        this.gameState.isSkipping = !this.gameState.isSkipping;

        const skipBtn = document.getElementById('skipBtn');
        if (skipBtn) {
            skipBtn.classList.toggle('active', this.gameState.isSkipping);
            skipBtn.textContent = this.gameState.isSkipping ? 'Пропуск ⏸' : 'Пропуск ⏩';
        }

        // Если включен пропуск, ускоряем текущую печать
        if (this.gameState.isSkipping && this.gameState.isTyping) {
            this.gameState.isTyping = false;
            const currentDialogue = this.currentDialogues[this.currentDialogueIndex - 1];
            if (currentDialogue) {
                this.dialogueText.textContent = currentDialogue.text;
            }
        }

        return this.gameState.isSkipping;
    }

    showPauseMenu() {
        const pauseMenu = document.getElementById('pauseMenu');
        if (pauseMenu) {
            pauseMenu.style.display = 'block';
            Utils.fadeIn(pauseMenu);
        }
    }

    hidePauseMenu() {
        const pauseMenu = document.getElementById('pauseMenu');
        if (pauseMenu) {
            Utils.fadeOut(pauseMenu).then(() => {
                pauseMenu.style.display = 'none';
            });
        }
    }

    restartGame() {
        if (confirm('Начать игру заново?')) {
            this.hidePauseMenu();
            this.loadInitialScene();
        }
    }

    quitToMenu() {
        if (confirm('Выйти в главное меню? Весь прогресс будет потерян.')) {
            window.location.href = 'index.html';
        }
    }

    async setupEventListeners() {
        // Кнопки управления
        const menuBtn = document.getElementById('menuBtn');
        const autoBtn = document.getElementById('autoBtn');
        const skipBtn = document.getElementById('skipBtn');

        if (menuBtn) {
            menuBtn.addEventListener('click', () => this.showPauseMenu());
        }

        if (autoBtn) {
            autoBtn.addEventListener('click', () => this.toggleAutoMode());
        }

        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.toggleSkipMode());
        }

        // Меню паузы
        const resumeBtn = document.getElementById('resumeBtn');
        const restartBtn = document.getElementById('restartBtn');
        const quitBtn = document.getElementById('quitBtn');
        const pauseMenu = document.getElementById('pauseMenu');

        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => this.hidePauseMenu());
        }

        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.restartGame());
        }

        if (quitBtn) {
            quitBtn.addEventListener('click', () => this.quitToMenu());
        }

        if (pauseMenu) {
            pauseMenu.addEventListener('click', (e) => {
                if (e.target === pauseMenu) {
                    this.hidePauseMenu();
                }
            });
        }

        // Глобальные горячие клавиши
        document.addEventListener('keydown', (e) => {
            switch (e.code) {
                case 'Escape':
                    e.preventDefault();
                    this.showPauseMenu();
                    break;

                case 'KeyA':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.toggleAutoMode();
                    }
                    break;

                case 'KeyS':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.toggleSkipMode();
                    }
                    break;

                case 'Space':
                    if (this.dialogueContainer.classList.contains('active') &&
                        !this.gameState.isTyping &&
                        !this.gameState.isAutoMode) {
                        e.preventDefault();
                        // Продолжить диалог
                        if (this.currentDialogueIndex < this.currentDialogues.length) {
                            this.currentDialogueIndex++;
                            if (this.currentDialogueIndex < this.currentDialogues.length) {
                                this.displayDialogue(this.currentDialogues[this.currentDialogueIndex]);
                            }
                        }
                    }
                    break;
            }
        });

        // Обработка изменения размера окна
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    handleResize() {
        // Перепозиционируем персонажей при изменении размера окна
        this.characters.forEach((character, characterId) => {
            // В реальной реализации нужно пересчитать позиции
            // based on character data and new window size
        });
    }
}

// Запуск игрового движка когда DOM загружен
document.addEventListener('DOMContentLoaded', () => {
    // Добавляем дополнительные стили для игры
    const gameStyles = `
        <style>
            .character {
                position: absolute;
                transition: all 0.5s ease;
                max-width: 80%;
                max-height: 80%;
            }
            
            .character.hidden {
                opacity: 0;
                pointer-events: none;
            }
            
            .btn.active {
                background: #ffd700;
                color: #333;
            }
            
            .choices-container {
                position: absolute;
                bottom: 200px;
                left: 0;
                width: 100%;
                display: none;
                flex-direction: column;
                align-items: center;
                gap: 15px;
                padding: 20px;
                z-index: 100;
            }
            
            .choice-btn {
                background: rgba(255, 255, 255, 0.95);
                color: #333;
                padding: 15px 30px;
                border: none;
                border-radius: 25px;
                font-size: 1rem;
                cursor: pointer;
                transition: all 0.3s ease;
                min-width: 300px;
                text-align: center;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                backdrop-filter: blur(10px);
            }
            
            .choice-btn:hover {
                background: white;
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0,0,0,0.3);
            }
            
            .control-panel .btn {
                backdrop-filter: blur(10px);
                background: rgba(255, 255, 255, 0.9);
            }
        </style>
    `;

    document.head.insertAdjacentHTML('beforeend', gameStyles);

    // Запускаем игровой движок
    window.gameEngine = new NovelGameEngine();
});
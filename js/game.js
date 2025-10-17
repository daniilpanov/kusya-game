class NovelGameEngine {
    constructor() {
        this.gameId = null;
        this.currentScene = null;
        this.currentSceneId = null;
        this.currentDialogues = [];
        this.currentDialogueIndex = 0;
        this.characters = new Map();

        this.gameState = {
            isTyping: false,
            currentText: ''
        };
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

        await this.hideLoading();
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
            throw error;
        }
    }

    async setupScene(scene) {
        this.clearScene();

        if (scene.background) {
            await this.setBackground(scene.background);
        }

        if (scene.initial_characters && Array.isArray(scene.initial_characters)) {
            await this.createCharacters(scene.initial_characters);
        }

        this.updateUrlParams();
    }

    async setBackground(backgroundImage) {
        if (!backgroundImage) return;

        const imageUrl = `assets/backgrounds/${backgroundImage}`;

        try {
            await Utils.loadImage(imageUrl);
            this.sceneBackground.style.backgroundImage = `url('${imageUrl}')`;
        } catch (error) {
            this.sceneBackground.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }
    }

    async createCharacters(charactersData) {
        if (!charactersData || !Array.isArray(charactersData)) return;

        for (const charData of charactersData) {
            if (charData.visible !== false) {
                await this.createCharacter(charData);
            }
        }
    }

    async createCharacter(charData) {
        const character = document.createElement('div');
        character.className = `character ${charData.visible === false ? 'hidden' : ''}`;
        character.id = `character-${charData.id}`;
        character.dataset.characterId = charData.id;

        const position = Utils.getPosition(charData);
        character.style.left = position.x;
        character.style.top = position.y;

        if (charData.sprite) {
            try {
                const img = await Utils.loadImage(`assets/sprites/${charData.sprite}`);
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                character.appendChild(img);
            } catch (error) {
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

    async loadDialogues() {
        try {
            let url = `/api/scenes/${this.currentSceneId}/dialogues`;

            const data = await Utils.fetchJSON(url);

            if (data.success) {
                this.currentDialogues = data.dialogues || [];
                this.currentDialogueIndex = 0;

                if (this.currentDialogues.length > 0) {
                    await this.startDialogueChain();
                }

                if (data.next_action) {
                    await this.handleNextAction(data.next_action);
                } else {
                    this.hideDialogueContainer();
                }
            }
        } catch (error) {
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
        if (dialogue.character_changes && dialogue.character_changes.length > 0) {
            await this.applyCharacterChanges(dialogue.character_changes);
        }

        if (dialogue.character_id) {
            this.characterName.textContent = this.getCharacterDisplayName(dialogue.character_id);
            this.characterName.style.display = 'block';
        } else {
            this.characterName.style.display = 'none';
        }

        await this.showDialogueText(dialogue.text);
        await this.waitForUserContinue();
    }

    async showDialogueText(text) {
        this.dialogueText.textContent = '';
        this.gameState.isTyping = true;

        await Utils.typeText(this.dialogueText, text, 30);

        this.gameState.isTyping = false;
    }

    async applyCharacterChanges(changes) {
        if (!changes || !Array.isArray(changes)) return;

        for (const change of changes) {
            await this.applyCharacterChange(change);
        }
    }

    async applyCharacterChange(change) {
        if (!change.character_id) return;

        let character = this.characters.get(change.character_id);

        if (!character && change.visible !== false) {
            character = await this.createCharacter({
                id: change.character_id,
                sprite: change.sprite,
                position: change.position || { desktop: { x: '50%', y: '50%' }, mobile: { x: '50%', y: '50%' } },
                visible: true
            });
        }

        if (!character) return;

        if (change.visible !== undefined) {
            if (change.visible) {
                character.classList.remove('hidden');
            } else {
                character.classList.add('hidden');
            }
        }

        if (change.position) {
            const position = Utils.getPosition(change);
            character.style.left = position.x;
            character.style.top = position.y;
        }

        if (change.sprite) {
            try {
                const img = await Utils.loadImage(`assets/sprites/${change.sprite}`);
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';

                const currentImg = character.querySelector('img, .character-placeholder');
                if (currentImg) {
                    character.removeChild(currentImg);
                }
                character.appendChild(img);
            } catch (error) {
                console.warn(`Could not load character sprite: ${change.sprite}`);
            }
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
        }
    }

    async showChoices(choiceDialogueId) {
        this.hideDialogueContainer();

        try {
            const choicesData = await this.loadChoices(choiceDialogueId);
            await this.displayChoices(choicesData);
        } catch (error) {
            this.showError('Failed to load choices');
        }
    }

    async loadChoices(choiceDialogueId) {
        const response = await Utils.fetchJSON(`/api/choices?dialogue_id=${choiceDialogueId}`);
        return response.choices;
    }

    async displayChoices(choices) {
        if (!choices || choices.length === 0) return;

        this.choicesContainer.innerHTML = '';

        choices.forEach(choice => {
            const choiceButton = document.createElement('button');
            choiceButton.className = 'choice-btn';
            choiceButton.textContent = choice.choice_text;
            choiceButton.dataset.choiceId = choice.id;

            choiceButton.addEventListener('click', () => {
                this.handleChoice(choice);
            });

            this.choicesContainer.appendChild(choiceButton);
        });

        this.choicesContainer.style.display = 'flex';
        this.choicesContainer.style.opacity = '0';

        setTimeout(() => {
            this.choicesContainer.style.opacity = '1';
            this.choicesContainer.style.transition = 'opacity 0.3s ease';
        }, 100);
    }

    async handleChoice(choice) {
        this.choicesContainer.style.opacity = '0';
        setTimeout(() => {
            this.choicesContainer.style.display = 'none';
            this.choicesContainer.innerHTML = '';
        }, 300);

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
            this.showError('Failed to process choice');
        }
    }

    async processChoiceResult(response) {
        const nextAction = response.next_action;

        if (!nextAction) return;

        switch (nextAction.type) {
            case 'scene_transition':
                await this.transitionToScene(nextAction.scene_id);
                break;

            case 'continue_dialogue':
                await this.loadDialogues(nextAction.dialogue_id);
                break;
        }
    }

    async transitionToScene(sceneId) {
        await this.showLoading('Loading new scene...');

        try {
            await this.loadScene(sceneId);
            await this.loadDialogues();
        } catch (error) {
            this.showError('Failed to transition to new scene');
        } finally {
            await this.hideLoading();
        }
    }

    showDialogueContainer() {
        this.dialogueContainer.classList.add('active');
    }

    hideDialogueContainer() {
        this.dialogueContainer.classList.remove('active');
    }

    async waitForUserContinue() {
        return new Promise(resolve => {
            const continueHandler = () => {
                if (this.gameState.isTyping) {
                    this.gameState.isTyping = false;
                    const currentDialogue = this.currentDialogues[this.currentDialogueIndex - 1];
                    if (currentDialogue) {
                        this.dialogueText.textContent = currentDialogue.text;
                    }
                    setTimeout(continueHandler, 100);
                    return;
                }

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
        const nameMap = {
            'hero': 'Hero',
            'npc': 'Stranger',
            'main_character': 'Main Character',
            'narrator': ''
        };

        return nameMap[characterId] || characterId;
    }

    clearScene() {
        this.charactersContainer.innerHTML = '';
        this.characters.clear();

        this.dialogueText.textContent = '';
        this.characterName.textContent = '';
        this.hideDialogueContainer();

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
        if (window.novelApp && typeof window.novelApp.showError === 'function') {
            return window.novelApp.showError(message, duration);
        }
        alert(message);
    }

    async setupEventListeners() {
        const autoBtn = document.getElementById('autoBtn');
        const skipBtn = document.getElementById('skipBtn');

        if (autoBtn) autoBtn.style.display = 'none';
        if (skipBtn) skipBtn.style.display = 'none';

        const menuBtn = document.getElementById('menuBtn');
        const resumeBtn = document.getElementById('resumeBtn');
        const restartBtn = document.getElementById('restartBtn');
        const quitBtn = document.getElementById('quitBtn');
        const pauseMenu = document.getElementById('pauseMenu');

        if (menuBtn) {
            menuBtn.addEventListener('click', () => this.showPauseMenu());
        }

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

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                e.preventDefault();
                this.showPauseMenu();
            }
        });
    }

    showPauseMenu() {
        const pauseMenu = document.getElementById('pauseMenu');
        if (pauseMenu) {
            pauseMenu.style.display = 'block';
        }
    }

    hidePauseMenu() {
        const pauseMenu = document.getElementById('pauseMenu');
        if (pauseMenu) {
            pauseMenu.style.display = 'none';
        }
    }

    restartGame() {
        if (confirm('Restart game?')) {
            this.hidePauseMenu();
            this.loadInitialScene();
        }
    }

    quitToMenu() {
        if (confirm('Quit to main menu? All progress will be lost.')) {
            window.location.href = 'index.html';
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const gameStyles = `
        <style>
            .character {
                position: absolute;
                transition: all 0.5s ease;
                max-width: 80%;
                max-height: 80%;
                z-index: 10;
            }
            
            .character.hidden {
                opacity: 0;
                pointer-events: none;
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
            
            #autoBtn, #skipBtn {
                display: none !important;
            }
        </style>
    `;

    document.head.insertAdjacentHTML('beforeend', gameStyles);

    window.gameEngine = new NovelGameEngine();
    await window.gameEngine.init();
});
class NovelPlatformApp {
    lang = "RU";

    constructor() {
        this.games = [];
        this.isLoading = false;
    }

    async init() {
        try {
            await this.setupEventListeners();
            await this.loadGames();
            this.renderGames();
        } catch (error) {
            console.error('App initialization failed:', error);
            this.showError('Не удалось инициализировать приложение');
        }
    }

    async loadGames() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoading(true);

        try {
            const data = await Utils.fetchJSON('/api/games');
            this.games = data.games || [];
        } catch (error) {
            console.error('Error loading games:', error);
            this.showError('Не удалось загрузить список игр');
            this.games = [];
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    }

    renderGames() {
        const gamesGrid = document.getElementById('gamesGrid');

        if (!gamesGrid) {
            console.error('Games grid element not found');
            return;
        }

        if (this.games.length === 0) {
            gamesGrid.innerHTML = `
                <div class="no-games">
                    <div class="no-games-icon">🎮</div>
                    <h3>Игры не найдены</h3>
                    <p>Пока нет доступных игр</p>
                </div>
            `;
            return;
        }

        gamesGrid.innerHTML = this.games.filter(game => game.langs.indexOf(this.lang) > -1).map(game => `
            <div class="game-card" data-game-id="${game.resource}">
                <div class="game-image">
                    ${game.cover_image
                        ? `<img src="assets/covers/${game.cover_image}" alt="📖">`
                        : '<div class="game-image-placeholder">📖</div>'}
                </div>
                <div class="game-info">
                    <h3>${Utils.escapeHtml(game[this.lang].name)}</h3>
                    <p class="game-description">${Utils.escapeHtml(game[this.lang].description || '')}</p>
                </div>
            </div>
        `).join('');

        // Добавляем обработчики событий
        this.attachGameCardListeners();
    }

    attachGameCardListeners() {
        document.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('click', async e => {
                if (e.target.closest('.game-card')) {
                    const gameId = parseInt(card.getAttribute('data-game-id'));
                    await this.showGameModal(gameId);
                }
            });

            // Эффекты при наведении
            card.addEventListener('mouseenter', () =>
                card.style.transform = 'translateY(-5px)');

            card.addEventListener('mouseleave', () =>
                card.style.transform = 'translateY(0)');
        });
    }

    async showGameModal(gameId) {
        const game = this.games.find(g => g.id === gameId);
        if (!game) return;

        try {
            // Загружаем детальную информацию об игре
            const gameDetail = await Utils.fetchJSON(`/api/games/${gameId}`);

            const modalContent = document.getElementById('modalContent');
            modalContent.innerHTML = `
                <div class="modal-header">
                    <h2>${Utils.escapeHtml(gameDetail.game.title)}</h2>
                </div>
                <div class="modal-body">
                    <div class="modal-game-image">
                        <div class="game-image-large">📖</div>
                    </div>
                    <div class="game-details">
                        <div class="detail-item">
                            <strong>Начальная сцена:</strong> 
                            <span>${Utils.escapeHtml(gameDetail.game.start_scene_id)}</span>
                        </div>
                        <div class="detail-item">
                            <strong>Количество сцен:</strong> 
                            <span>${gameDetail.game.scene_count || 0}</span>
                        </div>
                        <div class="detail-item">
                            <strong>Диалогов:</strong> 
                            <span>${gameDetail.game.dialogue_count || 0}</span>
                        </div>
                        ${gameDetail.game.description ? `
                        <div class="detail-item full-width">
                            <strong>Описание:</strong> 
                            <p>${Utils.escapeHtml(gameDetail.game.description)}</p>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-actions">
                    <button id="playBtn" class="btn btn-primary">
                        <span class="btn-icon">🎮</span>
                        Начать игру
                    </button>
                    <button id="closeModalBtn" class="btn btn-secondary">Закрыть</button>
                </div>
            `;

            await this.showModal('gameModal');

            // Обработчики событий модального окна
            document.getElementById('playBtn').addEventListener('click', () =>
                this.startGame(gameDetail.game));

            document.getElementById('closeModalBtn').addEventListener('click', () =>
                this.hideModal('gameModal'));

        } catch (error) {
            console.error('Error loading game details:', error);
            this.showError('Не удалось загрузить информацию об игре');
        }
    }

    async startGame(game) {
        this.showLoading(true, 'Запуск игры...');

        try {
            const data = await Utils.fetchJSON(`/api/games/${game.id}/play`);

            if (data.success) {
                // Формируем URL для перехода на страницу игры
                const params = new URLSearchParams({
                    game_id: game.id,
                    scene_id: data.scene.scene_id
                });

                if (data.first_dialogue_id)
                    params.append('first_dialogue_id', data.first_dialogue_id);

                window.location.href = `game.html?${params.toString()}`;
            }
        } catch (error) {
            console.error('Error starting game:', error);
            this.showError('Не удалось начать игру');
            this.showLoading(false);
        }
    }

    async showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        await Utils.fadeIn(modal);
    }

    async hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        await Utils.fadeOut(modal);
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    showLoading(show, message = 'Загрузка...') {
        let loadingElement = document.getElementById('loadingOverlay');

        if (!loadingElement) {
            loadingElement = document.createElement('div');
            loadingElement.id = 'loadingOverlay';
            loadingElement.className = 'loading-overlay';
            loadingElement.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">${message}</div>
                </div>
            `;
            document.body.appendChild(loadingElement);
        }

        if (show) {
            loadingElement.style.display = 'flex';
            loadingElement.querySelector('.loading-text').textContent = message;
        } else
            loadingElement.style.display = 'none';
    }

    showError(message, duration = 5000) {
        // Создаем или находим контейнер для ошибок
        let errorContainer = document.getElementById('errorContainer');

        if (!errorContainer) {
            errorContainer = document.createElement('div');
            errorContainer.id = 'errorContainer';
            errorContainer.className = 'error-container';
            document.body.appendChild(errorContainer);
        }

        // Создаем элемент ошибки
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.innerHTML = `
            <span class="error-icon">⚠️</span>
            <span class="error-text">${Utils.escapeHtml(message)}</span>
            <button class="error-close">&times;</button>
        `;

        errorContainer.appendChild(errorElement);

        // Показываем с анимацией
        setTimeout(() => errorElement.classList.add('show'), 10);

        // Обработчики закрытия
        const closeBtn = errorElement.querySelector('.error-close');
        closeBtn.addEventListener('click', () => this.removeError(errorElement));

        // Автоматическое закрытие
        if (duration > 0)
            setTimeout(() => this.removeError(errorElement), duration);

        return errorElement;
    }

    removeError(errorElement) {
        if (errorElement && errorElement.parentNode) {
            errorElement.classList.remove('show');
            setTimeout(() => {
                if (errorElement.parentNode)
                    errorElement.parentNode.removeChild(errorElement);
            }, 300);
        }
    }

    setupEventListeners() {
        return new Promise((resolve) => {
            // Закрытие модального окна по клику вне контента
            document.addEventListener('click', async e => {
                if (e.target.classList.contains('modal'))
                    await this.hideModal('gameModal');
            });

            // Закрытие модального окна по крестику
            const closeBtn = document.querySelector('.modal .close');
            if (closeBtn)
                closeBtn.addEventListener('click', async () =>
                    await this.hideModal('gameModal'));

            // Закрытие по ESC
            document.addEventListener('keydown', async e => {
                if (e.key === 'Escape')
                    await this.hideModal('gameModal');
            });

            // Обновление по F5
            document.addEventListener('keydown', async e => {
                if (e.key === 'F5') {
                    e.preventDefault();
                    await this.loadGames();
                }
            });

            resolve();
        });
    }
}

// Инициализация приложения когда DOM загружен
document.addEventListener('DOMContentLoaded', async () => {
    window.novelApp = new NovelPlatformApp();
    await window.novelApp.init();
    window.novelApp.showLoading(false);
});
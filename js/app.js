import { Utils } from '#/utils.js';

export class NovelPlatformApp {
    lang = "RU";

    constructor() {
        this.games = [];
        this.mappedGames = {};
        this.isLoading = false;
    }

    async init() {
        try {
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

        gamesGrid.innerHTML = this.games.filter(game => game.langs.indexOf(this.lang) > -1).map(game => {
            this.mappedGames[game.resource] = game;
            return `
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
                    <button class="act-start-game btn btn-primary">
                        <span class="btn-icon">🎮</span>
                        Начать игру
                    </button>
                </div>
            `;
        }).join('');

        // Добавляем обработчики событий
        this.attachGameCardListeners();
    }

    attachGameCardListeners() {
        document.querySelectorAll('.game-card').forEach(card => {
            // Эффекты при наведении
            card.addEventListener('mouseenter', () =>
                card.style.transform = 'translateY(-5px)');
            card.addEventListener('mouseleave', () =>
                card.style.transform = 'translateY(0)');

            const gameResource = card.getAttribute('data-game-id');
            const [ playBtn ] = card.getElementsByClassName('act-start-game');
            if (playBtn && gameResource) {
                playBtn.addEventListener('click', async e => {
                    if (e.target.closest('.game-card'))
                        await this.startGame(gameResource);
                });
            }
        });
    }

    async startGame(gameResource) {
        this.showLoading(true, 'Запуск игры...');

        try {
            const game = this.mappedGames[gameResource];
            if (!game.descriptor) {
                console.error(`Error starting game ${gameResource}: no descriptor found!`);
                this.showError('Не удалось начать игру');
                return;
            }

            const params = new URLSearchParams({
                game_resource: gameResource,
                game_descriptor_uri: game.descriptor,
            });

            window.location.href = `game.html?${params.toString()}`;
        } finally {
            this.showLoading(false);
        }
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
}

// Инициализация приложения когда DOM загружен
document.addEventListener('DOMContentLoaded', async () => {
    window.novelApp = new NovelPlatformApp();
    await window.novelApp.init();
    window.novelApp.showLoading(false);
});
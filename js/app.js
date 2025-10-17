class NovelPlatformApp {
    constructor() {
        this.games = [];
        this.currentGame = null;
        this.isLoading = false;

        this.init();
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

        gamesGrid.innerHTML = this.games.map(game => `
            <div class="game-card" data-game-id="${game.id}">
                <div class="game-image">
                    <div class="game-image-placeholder">📖</div>
                    ${game.cover_image ? `<img src="assets/covers/${game.cover_image}" alt="${Utils.escapeHtml(game.title)}" style="display: none;">` : ''}
                </div>
                <div class="game-info">
                    <h3>${Utils.escapeHtml(game.title)}</h3>
                    <div class="game-stats">
                        <span class="stat">Сцен: ${game.scene_count || 0}</span>
                        <span class="stat">Диалогов: ${game.dialogue_count || 0}</span>
                    </div>
                    <p class="game-description">${Utils.escapeHtml(game.description || 'Интерактивная визуальная новелла')}</p>
                </div>
            </div>
        `).join('');

        // Добавляем обработчики событий
        this.attachGameCardListeners();
    }

    attachGameCardListeners() {
        document.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.game-card')) {
                    const gameId = parseInt(card.getAttribute('data-game-id'));
                    this.showGameModal(gameId);
                }
            });

            // Эффекты при наведении
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-5px)';
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
            });
        });
    }

    async showGameModal(gameId) {
        const game = this.games.find(g => g.id === gameId);
        if (!game) return;

        this.currentGame = game;

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

            this.showModal('gameModal');

            // Обработчики событий модального окна
            document.getElementById('playBtn').addEventListener('click', () => {
                this.startGame(gameDetail.game);
            });

            document.getElementById('closeModalBtn').addEventListener('click', () => {
                this.hideModal('gameModal');
            });

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

                if (data.first_dialogue_id) {
                    params.append('first_dialogue_id', data.first_dialogue_id);
                }

                window.location.href = `game.html?${params.toString()}`;
            }
        } catch (error) {
            console.error('Error starting game:', error);
            this.showError('Не удалось начать игру');
            this.showLoading(false);
        }
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Блокируем скролл
        Utils.fadeIn(modal);
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        Utils.fadeOut(modal).then(() => {
            modal.style.display = 'none';
            document.body.style.overflow = ''; // Восстанавливаем скролл
        });
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
        } else {
            loadingElement.style.display = 'none';
        }
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
        closeBtn.addEventListener('click', () => {
            this.removeError(errorElement);
        });

        // Автоматическое закрытие
        if (duration > 0) {
            setTimeout(() => {
                this.removeError(errorElement);
            }, duration);
        }

        return errorElement;
    }

    removeError(errorElement) {
        if (errorElement && errorElement.parentNode) {
            errorElement.classList.remove('show');
            setTimeout(() => {
                if (errorElement.parentNode) {
                    errorElement.parentNode.removeChild(errorElement);
                }
            }, 300);
        }
    }

    setupEventListeners() {
        return new Promise((resolve) => {
            // Закрытие модального окна по клику вне контента
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal')) {
                    this.hideModal('gameModal');
                }
            });

            // Закрытие модального окна по крестику
            const closeBtn = document.querySelector('.modal .close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.hideModal('gameModal');
                });
            }

            // Закрытие по ESC
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.hideModal('gameModal');
                }
            });

            // Обновление по F5
            document.addEventListener('keydown', (e) => {
                if (e.key === 'F5') {
                    e.preventDefault();
                    this.loadGames();
                }
            });

            resolve();
        });
    }
}

// Инициализация приложения когда DOM загружен
document.addEventListener('DOMContentLoaded', () => {
    // Добавляем стили для ошибок
    const errorStyles = `
        <style>
            .error-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
            }
            
            .error-message {
                background: #f8d7da;
                color: #721c24;
                padding: 12px 16px;
                margin-bottom: 10px;
                border-radius: 8px;
                border: 1px solid #f5c6cb;
                display: flex;
                align-items: center;
                gap: 10px;
                transform: translateX(100%);
                opacity: 0;
                transition: all 0.3s ease;
            }
            
            .error-message.show {
                transform: translateX(0);
                opacity: 1;
            }
            
            .error-icon {
                font-size: 16px;
            }
            
            .error-text {
                flex: 1;
                font-size: 14px;
            }
            
            .error-close {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #721c24;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .no-games {
                text-align: center;
                padding: 40px;
                color: #666;
            }
            
            .no-games-icon {
                font-size: 4rem;
                margin-bottom: 20px;
            }
            
            .game-stats {
                display: flex;
                gap: 15px;
                margin: 10px 0;
            }
            
            .stat {
                background: #f8f9fa;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.8rem;
                color: #666;
            }
            
            .game-description {
                color: #666;
                font-size: 0.9rem;
                line-height: 1.4;
                margin-top: 10px;
            }
            
            .modal-header {
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 1px solid #eee;
            }
            
            .modal-body {
                display: flex;
                gap: 20px;
                margin-bottom: 20px;
            }
            
            .game-image-large {
                width: 120px;
                height: 160px;
                background: linear-gradient(45deg, #667eea, #764ba2);
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 3rem;
                flex-shrink: 0;
            }
            
            .game-details {
                flex: 1;
            }
            
            .detail-item {
                margin-bottom: 10px;
                display: flex;
            }
            
            .detail-item.full-width {
                flex-direction: column;
            }
            
            .detail-item strong {
                min-width: 140px;
                color: #333;
            }
            
            .detail-item p {
                margin: 5px 0 0 0;
                color: #666;
                line-height: 1.4;
            }
            
            .modal-actions {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            
            .btn-icon {
                margin-right: 8px;
            }
        </style>
    `;

    document.head.insertAdjacentHTML('beforeend', errorStyles);

    // Запускаем приложение
    window.novelApp = new NovelPlatformApp();
});
class Utils {
    // Асинхронный запрос с обработкой ошибок
    static async fetchJSON(url, options = {}) {
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (config.body && typeof config.body === 'object')
            config.body = JSON.stringify(config.body);

        const response = await fetch(url, config);

        if (!response.ok)
            throw new Error(`Fetch error: HTTP error with status: ${response.status}`);

        const data = await response.json();

        if (!data.success)
            throw new Error('Fetch error: ' + (data.error || 'API request failed'));

        return data;
    }

    // Загрузка изображения с кэшированием
    static loadImage(src) {
        return new Promise((resolve, reject) => {
            // Проверяем кэш
            if (this.imageCache && this.imageCache[src]) {
                resolve(this.imageCache[src]);
                return;
            }

            const img = new Image();
            img.onload = () => {
                // Сохраняем в кэш
                if (!this.imageCache) this.imageCache = {};
                this.imageCache[src] = img;
                resolve(img);
            };
            img.onerror = (e) => {
                console.error(`Failed to load image: ${src}`, e);
                reject(new Error(`Failed to load image: ${src}`));
            };
            img.src = src;
        });
    }

    // Предзагрузка нескольких изображений
    static async preloadImages(imageUrls) {
        const promises = imageUrls.map(url => this.loadImage(url).catch(e => {
            console.warn(`Could not preload image: ${url}`, e);
            return null;
        }));

        const results = await Promise.allSettled(promises);
        return results.filter(result => result.status === 'fulfilled').map(result => result.value);
    }

    // Форматирование текста диалога
    static formatText(text) {
        if (!text) return '';

        return text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/_(.*?)_/g, '<u>$1</u>')
            .replace(/~~(.*?)~~/g, '<s>$1</s>');
    }

    // Анимация появления элемента
    static fadeIn(element, duration = 300) {
        return new Promise(resolve => {
            element.style.opacity = '0';
            const start = performance.now();

            function animate(time) {
                const elapsed = time - start;
                const progress = Math.min(elapsed / duration, 1);

                element.style.opacity = progress.toString();

                if (progress < 1)
                    requestAnimationFrame(animate);
                else
                    resolve();
            }

            requestAnimationFrame(animate);
        });
    }

    // Анимация исчезновения элемента
    static fadeOut(element, duration = 300) {
        return new Promise(resolve => {
            const start = performance.now();
            const startOpacity = parseFloat(element.style.opacity) || 1;

            function animate(time) {
                const elapsed = time - start;
                const progress = Math.min(elapsed / duration, 1);

                element.style.opacity = (startOpacity * (1 - progress)).toString();

                if (progress < 1)
                    requestAnimationFrame(animate);
                else {
                    element.style.display = 'none';
                    resolve();
                }
            }

            requestAnimationFrame(animate);
        });
    }

    // Типизированный вывод текста
    static typeText(element, text, speed = 20) {
        const typer = new TextTyper(element, text, speed);
        typer.startTyping();
        return typer;
    }

    // Проверка мобильного устройства
    static isMobile() {
        return window.matchMedia('(max-width: 768px)').matches ||
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // Получение позиции для текущего устройства
    static getPosition(characterData) {
        if (!characterData || !characterData.position)
            return { x: '50%', y: '50%' };

        return this.isMobile() ?
            characterData.position.mobile || characterData.position.desktop :
            characterData.position.desktop;
    }

    // Экранирование HTML
    static escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Генератор уникальных ID
    static generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    }

    // Пауза
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Получение параметров из URL
    static getUrlParams() {
        return new URLSearchParams(window.location.search);
    }

    // Валидация данных
    static validateData(data, requiredFields) {
        for (const field of requiredFields) {
            if (data[field] === undefined || data[field] === null)
                throw new Error(`Missing required field: ${field}`);
        }
        return true;
    }
}

// Инициализация кэша изображений
Utils.imageCache = {};

class TextTyper {
    typerProcessId = undefined;
    finished = false;

    constructor(element, text, speed) {
        this.element = element;
        this.text = text;
        this.speed = speed;
    }

    startTyping() {
        if (this.typerProcessId)
            return;

        this.element.innerHTML = '';
        let index = 0;

        const type = () => {
            if (index < this.text.length) {
                const char = this.text.charAt(index);
                this.element.innerHTML += char === ' ' ? '&nbsp;' : char;
                ++index;
                this.typerProcessId = setTimeout(type, this.speed);
            } else
                this.finished = true;
        }

        type();
    }

    endTyping() {
        if (!this.typerProcessId)
            return;

        clearTimeout(this.typerProcessId);
        this.element.innerHTML = this.text;
        this.finished = true;
    }
}
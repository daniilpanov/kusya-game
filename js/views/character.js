class CharacterView {
    x = undefined;
    y = undefined;
    sprite = undefined;
    charactersContainer = document.getElementById('charactersContainer');

    constructor(characterName) {
        this.name = characterName;
    }

    setAnchorPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    async loadSprite(src) {
        this.sprite = new Image();
        this.sprite.style.position = 'absolute';

        await new Promise((resolve, reject) => {
            this.sprite.onload = resolve;
            this.sprite.onerror = reject;
            this.sprite.src = src;
        });

        this.charactersContainer.appendChild(this.sprite);
    }

    show() {
        this.sprite.style.opacity = '1';
    }

    hide() {
        this.sprite.style.opacity = '0';
    }

    render() {
        this.sprite.style.left = `${window.innerWidth * this.x}`;
        this.sprite.style.top = `${window.innerHeight * this.y}`;
    }
}
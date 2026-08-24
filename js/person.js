export class PersonController {
    x = 0.5;  // 0 - left, 1 - right
    y = 0.5;  // 0 - bottom, 1 - top
    currentSprite = undefined;

    constructor(name, spritesMap) {
        this.name = name;
        this.spritesMap = spritesMap;
    }

    setAnchorPosition(x, y) {
        this.x = x;
        this.y = y;
        this.updatePosition();
    }

    show(spriteName = "default") {
        if (this.currentSprite)
            this.hide();

        const sprite = this.spritesMap[spriteName];

        if (!sprite)
            throw new Error(`Sprite "${spriteName}" not found for person "${this.name}"`);

        sprite.classList.remove("hidden");
        this.currentSprite = spriteName;

        this.updatePosition();
    }

    hide() {
        if (this.currentSprite)
            this.spritesMap[this.currentSprite].classList.add("hidden");
    }

    updatePosition() {
        if (this.currentSprite === undefined)
            return;

        const sprite = this.spritesMap[this.currentSprite];

        if (Math.abs(this.x - 0.5) < 0.01) {
            sprite.style.left = "0px";
            sprite.style.right = "0px";
        } else if (this.x < 0.5) {
            sprite.style.left = `${window.innerWidth * this.x}px`;
            sprite.style.right = "";
        } else {
            sprite.style.left = "";
            sprite.style.right = `${window.innerWidth * (1 - this.x)}px`;
        }

        if (Math.abs(this.y - 0.5) < 0.01) {
            sprite.style.top = "0px";
            sprite.style.bottom = "0px";
        } else if (this.y < 0.5) {
            sprite.style.top = "";
            sprite.style.bottom = `${window.innerHeight * this.y}px`;
        } else {
            sprite.style.bottom = "";
            sprite.style.top = `${window.innerHeight * (1 - this.y)}px`;
        }
    }
}
import { computeAnchorStyles } from '#/lib/layout/anchor.js';

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

    updatePosition(viewport = undefined) {
        if (this.currentSprite === undefined)
            return;

        const vp = viewport ?? {
            width: window.innerWidth,
            height: window.innerHeight,
        };
        const styles = computeAnchorStyles(this.x, this.y, vp);

        if (!styles)
            return;

        const sprite = this.spritesMap[this.currentSprite];
        for (const side of ["left", "right", "top", "bottom"])
            sprite.style[side] = styles[side];
    }
}

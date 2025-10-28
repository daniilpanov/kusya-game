class SceneView {
    background = undefined;
    characters = {};
    actions = [];
    currentAction = undefined;

    constructor(characters) {
        for (const character of characters)
            this.characters[character.id] = character;
    }

    async setupBackground(src) {
        this.background = new Image();

        await new Promise((resolve, reject) => {
            this.background.onload = resolve;
            this.background.onerror = reject;
            this.background.src = `/assets/bg/${src}`;
        });
    }

    loadActions(actions) {
        this.actions = actions.reverse();
    }

    async nextAction() {
        this.currentAction = this.actions.pop();
        await this.currentAction.doAction();
    }

    showCharacter(id) {
        this.characters[id].show();
    }

    hideCharacter(id) {
        this.characters[id].hide();
    }

    render() {
        return;
        for (const character in this.characters)
            this.characters[character].render();
    }
}
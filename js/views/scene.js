class SceneView {
    background = undefined;
    characters = {};
    dialogues = [];
    currentDialogue = undefined;

    constructor(characters) {
        for (const character of characters)
            this.characters[character.id] = character;
    }

    async setupBackground(src) {
        this.background = new Image();

        await new Promise((resolve, reject) => {
            this.background.onload = resolve;
            this.background.onerror = reject;
            this.background.src = src;
        });
    }

    loadDialogues(dialogues) {
        this.dialogues = dialogues;
    }

    nextDialogue() {
        this.currentDialogue = this.dialogues.pop();
        this.render();
    }

    showCharacter(id) {
        this.characters[id].show();
    }

    hideCharacter(id) {
        this.characters[id].hide();
    }

    render() {
        for (const character of this.characters)
            character.render();

        this.currentDialogue.render();
    }
}
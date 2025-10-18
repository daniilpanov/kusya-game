class DialogAction {
    textView = document.getElementById('dialogueText');
    characterNameView = document.getElementById('characterName');

    constructor(text, characterName = undefined) {
        this.text = text;
        this.characterName = characterName;
    }

    async doAction() {
        if (this.characterName)
            await Utils.typeText(this.characterNameView, this.characterName, 30);

        await Utils.typeText(this.textView, this.text, 30);
    }
}
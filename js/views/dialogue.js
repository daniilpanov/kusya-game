class DialogueView {
    textView = document.getElementById('dialogueText');
    characterNameView = document.getElementById('characterName');

    constructor(characterName, text) {
        this.characterName = characterName;
        this.text = text;
    }

    async render() {
        if (this.characterName)
            await Utils.typeText(this.characterNameView, this.characterName, 30);

        await Utils.typeText(this.textView, this.text, 30);
    }
}
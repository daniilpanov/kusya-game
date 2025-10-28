class DialogAction {
    finished = false;
    textView = document.getElementById('dialogueText');
    characterNameView = document.getElementById('characterName');
    characterNameViewTyper = undefined;
    textViewTyper = undefined;

    constructor(text, characterName = undefined) {
        this.text = text;
        this.characterName = characterName;
    }

    async doAction() {
        if (this.characterName)
            this.characterNameViewTyper = Utils.typeText(this.characterNameView, this.characterName, 30);

        this.textViewTyper = Utils.typeText(this.textView, this.text, 30);
    }

    async finishAction() {
        if (this.characterNameViewTyper)
            this.characterNameViewTyper.endTyping();

        this.textViewTyper.endTyping();
        this.finished = true;
    }
}
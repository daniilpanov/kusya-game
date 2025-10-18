class ChoiceAction {
    choiceContainer = document.getElementById('choicesContainer');
    choiceWrapper = null;
    isRendered = false;

    constructor(gameObj, listOfVariants) {
        this.game = gameObj;
        this.list = listOfVariants;
    }

    async doAction() {
        if (this.isRendered) return;

        this.choiceWrapper = document.createElement('div');
        this.choiceWrapper.className = 'choice-wrapper';

        for (const choiceAlias in this.list) {
            const choiceButton = document.createElement('button');
            choiceButton.className = 'choice-btn';
            choiceButton.textContent = this.list[choiceAlias];
            choiceButton.addEventListener('click', async () => await this.choose(choiceAlias));

            this.choiceWrapper.appendChild(choiceButton);
        }

        this.choiceContainer.appendChild(this.choiceWrapper);
        this.show();
    }

    remove() {
        this.choiceContainer.removeChild(this.choiceWrapper);
        this.hide();
    }

    show() {
        this.choiceContainer.style.opacity = '1';
    }

    hide() {
        this.choiceContainer.style.opacity = '0';
    }

    async choose(choiceAlias) {
        this.remove();
        await this.game.choose(choiceAlias);
    }
}
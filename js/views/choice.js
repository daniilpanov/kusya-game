class ChoiceView {
    choiceContainer = document.getElementById('choicesContainer');
    choiceWrapper = null;
    isRendered = false;

    constructor(gameObj, listOfVariants) {
        this.game = gameObj;
        this.list = listOfVariants;
    }

    render() {
        if (this.isRendered) return;

        this.choiceWrapper = document.createElement('div');
        this.choiceWrapper.className = 'choice-wrapper';

        for (const choice of this.list) {
            const choiceButton = document.createElement('button');
            choiceButton.className = 'choice-btn';
            choiceButton.textContent = choice.choice_text;
            choiceButton.addEventListener('click', () => this.choose(choice.id));

            this.choiceWrapper.appendChild(choiceButton);
        }

        this.choiceContainer.appendChild(this.choiceWrapper);
    }

    remove() {
        this.choiceContainer.removeChild(this.choiceWrapper);
    }

    show() {
        this.choiceContainer.style.opacity = '1';
    }

    hide() {
        this.choiceContainer.style.opacity = '0';
    }

    choose(id) {
        this.remove();
        this.game.choose(id);
    }
}
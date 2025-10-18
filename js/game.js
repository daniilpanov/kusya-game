
class CustomAction {
    constructor(callable) {
        this.doAction = callable;
    }
}

class Game {
    sceneView = undefined;

    async initScene(sceneAPI) {
        document.getElementById('dialogueContainer').onclick = () => this.nextAction();
        this.sceneAPI = sceneAPI;

        const { scene } = await sceneAPI.getById();

        const characters = [];
        for (const character of scene.initial_characters) {
            const charObj = new CharacterView(character.id);
            characters.push(charObj);
            charObj.setAnchorPosition(character.x, character.y);
            // await charObj.loadSprite(character.sprite);
        }

        this.sceneView = new SceneView(characters);
        // await this.sceneView.setupBackground(scene.background);

        await this.loadActions(await sceneAPI.getActions());
    }

    async start() {
        await this.sceneView.nextAction();
        this.sceneView.render();
    }

    async loadActions({ actions, choice }) {
        const parsedActions = [];
        for (const action of actions) {
            for (const subaction of action.action) {
                switch (subaction.action) {
                    case "end":
                        parsedActions.push(new CustomAction(() => window.location.href = 'index.html'));
                        break;
                    case "dialog":
                        parsedActions.push(new DialogAction(subaction.body.text, subaction.body.character_id));
                        break;
                    case "background":
                        parsedActions.push(new CustomAction(async () => await this.sceneView.setupBackground(subaction.body.src)));
                        break;
                }
            }
        }

        if (choice)
            parsedActions.push(new ChoiceAction(this, choice));

        this.sceneView.loadActions(parsedActions);
    }

    async nextAction() {
        await this.sceneView.nextAction();
        this.sceneView.render();
    }

    async choose(choiceAlias) {
        await this.loadActions(await this.sceneAPI.getActions(choiceAlias));
    }
}


class CustomAction {
    constructor(doAction, finishAction = undefined) {
        this.doAction = doAction;
        this.finishAction = finishAction || (async () => {});
    }
}

class Game {
    lang = "RU";

    sortedSceneKeys = undefined;
    sceneDescriptors = undefined;
    currentSceneKeyIndex = undefined;
    sceneView = undefined;

    stats = undefined;
    persons = undefined;
    templates = undefined;
    backgrounds = undefined;

    constructor(gameResource, descriptorUri) {
        this.gameResource = gameResource;
        this.descriptorUri = descriptorUri;
    }

    async init() {
        // Load descriptor
        const descriptor = await Utils.fetchTOML(this.descriptorUri);

        // Load stats
        const stats = descriptor.stats;
        for (const statsKey in stats) {
            if (typeof stats[statsKey].value === "undefined")
                stats[statsKey].value = 0;
        }
        this.stats = stats;

        // Load templates and its styles
        const templates = {};
        let headInjections = [];
        const parser = new DOMParser();

        for (const templateName in descriptor.templates) {
            const res = parser.parseFromString(
                await fetch(this.gameResource + "/" + descriptor.templates[templateName]).then(r => r.text()),
                "text/html",
            );

            if (templateName.startsWith("styles")) {
                const styleEl = document.createElement("style");
                styleEl.innerHTML = res.body.innerHTML;
                headInjections.push(styleEl);
            }
            else
                templates[templateName] = res.body;
        }

        this.templates = templates;

        // Load backgrounds
        await Utils.preloadImages(Object.values(descriptor.backgrounds).map(bg => `${this.gameResource}/${bg.src}`));
        const backgrounds = {};

        for (const backgroundKey in descriptor.backgrounds) {
            const bg = descriptor.backgrounds[backgroundKey];
            const img = Utils.imageCache[`${this.gameResource}/${bg.src}`];
            if (!img) continue;

            delete bg.src;
            bg.img = img;
            backgrounds[backgroundKey] = bg;
        }

        this.backgrounds = backgrounds;

        // Load persons
        await Promise.allSettled(
            Object.values(descriptor.persons).map(person => Utils.preloadImages(
                Object.values(person.sprites).map(src => `${this.gameResource}/${src}`)),
            ),
        );
        const persons = {};
        const spriteImages = [];

        for (const personKey in descriptor.persons) {
            const person = descriptor.persons[personKey];
            const sprites = {};

            for (const spriteKey in person.sprites) {
                const img = Utils.imageCache[`${this.gameResource}/${person.sprites[spriteKey]}`]
                if (!img) continue;

                spriteImages.push(img);
                sprites[spriteKey] = img;
            }

            persons[personKey] = new CharacterView(person.name, sprites);
        }

        this.persons = persons;

        // Load scenes
        const scenes = {};
        for (const scenesKey in descriptor.scenes)
            scenes[scenesKey] = descriptor.scenes[scenesKey][this.lang];

        this.sceneDescriptors = scenes;
        this.sortedSceneKeys = Object.keys(scenes).sort();

        await this.loadScene(0);
        return { headInjections, spriteImages };

        // document.getElementById('dialogueContainer').onclick = () => this.nextAction();
    }

    async loadScene(keyIndex) {
        this.currentSceneKeyIndex = keyIndex;
        this.sceneView = new SceneView(
            await fetch(this.gameResource + "/" + this.sceneDescriptors[this.sortedSceneKeys[keyIndex]])
                .then(res => res.text())
        );
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

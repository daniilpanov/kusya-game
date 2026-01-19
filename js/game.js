const handlersMap = {
    action_setBackground(bgKey) {
        bgKey = String(bgKey);

    },
    action_if(groupKey, [ condition ]) {
        if (this.expressionsParser.evaluate(condition))
            handlersMap.action_goto(groupKey);
    },
    action_setVar(value, [ varName ]) {
        this.variables[varName] = value;
    },
    action_addStats(value, [ statName ]) {
        this.stats[statName] += value;
    },
    action_goto(groupKey) {
        this.sceneController.doActionsGroupByKey(String(groupKey));
    },
    action_showChoice(variants, choiceKey) {

    },
    action_showPhrase(phrase, [ character, pseudoName ]) {

    },
    action_showTitle(title) {

    },
    action_gotoNextScene() {
        return this.loadSceneByKeyIndex(this.currentSceneKeyIndex + 1);
    },
    action_gotoScene(sceneKey) {
        return this.loadSceneByKey(sceneKey);
    },
    action_end() {

    },
};

class Game {
    lang = "RU";

    sortedSceneKeys = undefined;
    sceneDescriptors = undefined;
    currentSceneKeyIndex = undefined;
    sceneController = undefined;

    stats = undefined;
    persons = undefined;
    templates = undefined;
    backgrounds = undefined;

    constructor(gameResource, descriptorUri) {
        this.gameResource = gameResource;
        this.descriptorUri = descriptorUri;
        this.variables = {};
        this.expressionsParser = new ExpressionsParser(varName => this.variables[varName]);
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

        await this.loadSceneByKeyIndex(0);
        return { headInjections, spriteImages };

        // document.getElementById('dialogueContainer').onclick = () => this.nextAction();
    }

    loadSceneByKeyIndex(keyIndex) {
        this.currentSceneKeyIndex = keyIndex;
        return this._loadScene(this.sortedSceneKeys[keyIndex]);
    }

    loadSceneByKey(key) {
        this.currentSceneKeyIndex = this.sortedSceneKeys.indexOf(key);
        return this._loadScene(key);
    }

    async _loadScene(key) {
        this.sceneController = new SceneController(
            key,
            await fetch(this.gameResource + "/" + this.sceneDescriptors[key])
                .then(res => res.text()),
            this.handleAction.bind(this),
        );
    }

    handleAction({ actionKey, mainArg, args }) {
        handlersMap[`action_${actionKey}`](mainArg, args).bind(this);
    }

    start() {
        this.sceneController.doNextActionsGroup();
    }
}

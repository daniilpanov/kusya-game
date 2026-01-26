const handlersMap = {
    action_setBackground(bgKey) {
        bgKey = String(bgKey);

        this.bgWrapper.innerHTML = "";
        this.bgWrapper.appendChild(this.backgrounds[bgKey].img);
    },
    action_if(groupKey, [ condition ]) {
        if (this.expressionsParser.evaluate(condition))
            return handlersMap.action_goto.bind(this)(groupKey);
    },
    action_cloneVar(oldVarName, [ newVarName ]) {
        this.variables[newVarName] = this.variables[oldVarName];
    },
    action_setVar(value, [ varName ]) {
        this.variables[varName] = value;
    },
    action_addVar(value, [ varName ]) {
        if (this.variables[varName] === "undefined")
            return handlersMap.action_setVar.bind(this)(...arguments);

        this.variables[varName] += value;
    },
    action_addStats(value, [ statName ]) {
        this.stats[statName] += value;
    },
    action_goto(groupKey) {
        return this.sceneController.doActionsGroupByKey(String(groupKey));
    },
    action_gotoNext() {
        return this.sceneController.doNextActionsGroup();
    },
    action_showPersonSprite(personSprite, [ hideAllOther = false ]) {
        if (!personSprite) {
            if (hideAllOther)
                this.activePersons.forEach(person => person.hide());

            return;
        }

        const [ personId, personSpriteId = "default" ] = personSprite.split(".");
        const currentPersonObj = this.persons[personId];

        if (hideAllOther)
            for (const person of this.activePersons)
                if (person.name !== currentPersonObj.name)
                    person.hide();

        currentPersonObj.show(personSpriteId);
        this.activePersons.push(currentPersonObj);

        return currentPersonObj;
    },
    action_showChoice(variants, [ choiceKey, personSprite, pseudoName, hideAllOther = true ]) {
        this.templateWrappers.choices?.classList.add("active");
        this.templateWrappers.dialog?.classList.remove("active");

        const personObj = handlersMap.action_showPersonSprite.bind(this)(personSprite, [ hideAllOther ]);
        const author = pseudoName ?? personObj?.name ?? "...";
        const text = variants[0];

        const choicesList = variants.slice(1).map(variant => ({
            "event-choice-id": choiceKey,
            "event-choice-variant": variant,
            "content": variant,
        }));

        this.templates.choices?.render({ author, text, choicesList });
    },
    action_showPhrase(text, [ personSprite, pseudoName, hideAllOther = true ]) {
        this.templateWrappers.choices?.classList.remove("active");
        this.templateWrappers.dialog?.classList.add("active");

        const personObj = handlersMap.action_showPersonSprite.bind(this)(personSprite, [ hideAllOther ]);
        const author = pseudoName ?? personObj?.name ?? "...";

        this.templates.dialog?.render({ text, author });
    },
    action_showTitle(title) {
        return new Promise(r => {
            this.templateWrappers.sceneTitle?.classList.remove("inactive");
            this.templates.sceneTitle?.render({ title });

            setTimeout(() => {
                this.templateWrappers.sceneTitle?.classList.add("inactive");
                const res = handlersMap.action_gotoNext.bind(this)();
                return res instanceof Promise ? res.then(r) : r(res);
            }, 1000);
        });
    },
    action_gotoNextScene() {
        this.templateWrappers.dialog?.classList.remove("active");
        this.templateWrappers.choices?.classList.remove("active");
        return this.loadSceneByKeyIndex(this.currentSceneKeyIndex + 1).then(() => this.start());
    },
    action_gotoScene(sceneKey) {
        return this.loadSceneByKey(sceneKey);
    },
    action_end() {
        window.location.href = `/?finished=${this.gameResource}`;
    },
};

class Game {
    lang = "RU";

    sortedSceneKeys = undefined;
    sceneDescriptors = undefined;
    sceneController = undefined;

    currentSceneKeyIndex = undefined;
    activePersons = [];

    stats = undefined;
    persons = undefined;
    templates = undefined;
    backgrounds = undefined;

    constructor(gameResource, descriptorUri, bgWrapper, templateWrappers) {
        this.bgWrapper = bgWrapper;
        this.templateWrappers = templateWrappers || {};

        this.gameResource = gameResource;
        this.descriptorUri = descriptorUri;
        this.variables = {};
        this.expressionsParser = new ExpressionsParser(
            varName => varName.startsWith("stats.") ? this.stats[varName.slice(6)].value : this.variables[varName],
        );
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
            const templatePath = descriptor.templates[templateName];
            const res = parser.parseFromString(
                await fetch(this.gameResource + "/" + templatePath).then(r => r.text()),
                "text/html",
            );

            if (templatePath.endsWith(".css")) {
                const styleEl = document.createElement("style");
                styleEl.innerHTML = res.body.innerHTML;
                headInjections.push(styleEl);
            } else {
                templates[templateName] = new Templater(res.body);
                this.templateWrappers[templateName]?.appendChild(res.body.children[0]);
            }
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

            persons[personKey] = new PersonController(person.name, sprites);
        }

        this.persons = persons;

        // Load scenes
        const scenes = {};
        for (const scenesKey in descriptor.scenes)
            scenes[scenesKey] = descriptor.scenes[scenesKey][this.lang];

        this.sceneDescriptors = scenes;
        this.sortedSceneKeys = Object.keys(scenes).sort();

        await this.loadSceneByKeyIndex(0);

        this.templateWrappers.dialog?.addEventListener("click", () => {
            TemplaterTyperExtension.endTyping();
            this.sceneController.doNextActionsGroup();
        });

        return { headInjections, spriteImages };
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
        return handlersMap[`action_${actionKey}`].bind(this)(mainArg, args);
    }

    start() {
        return this.sceneController.doNextActionsGroup();
    }
}

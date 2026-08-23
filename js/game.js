import { ExpressionsParser } from '#/lib/expressions/expressions.js';
import { Templater } from '#/lib/templater/templater.js';
import { Utils } from '#/utils.js';
import { PersonController } from '#/person.js';
import { SceneController } from '#/scene.js';
import { createHandlersMap } from '#/actions.js';
import { TemplaterTyperExtension } from '#/templater_typer_extension.js';

export class Game {
    lang = "RU";

    sortedSceneKeys = undefined;
    sceneDescriptors = undefined;
    sceneController = undefined;

    currentSceneKeyIndex = undefined;
    activePersons = [];
    activeTitleTimeoutId = undefined;
    needClickButton = false;

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

        this.handlersMap = Object.fromEntries(
            Object.entries(createHandlersMap()).map(([key, func]) => ([key, func.bind(this)])),
        );

        const getFromContextCallback = varName => varName.startsWith("stats.") ? this.stats[varName.slice(6)].value : this.variables[varName];
        this.expressionsParser = new ExpressionsParser({ getFromContextCallback });
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

    handleAction({ name, args }) {
        const handler = this.handlersMap[`action_${name}`];

        if (!handler)
            throw new Error(`Unknown action "${name}"`);

        return handler(args);
    }

    _isActiveBackgroundProcesses() {
        return TemplaterTyperExtension.isActiveTypers();
    }

    _interruptActiveBackgroundProcesses() {
        TemplaterTyperExtension.endTyping();
    }

    _interruptBackgroundProcesses() {
        this._interruptActiveBackgroundProcesses();
        this.needClickButton = false;

        if (this.activeTitleTimeoutId !== undefined) {
            this.templateWrappers.sceneTitle?.classList.add("inactive");
            this.activeTitleTimeoutId = undefined;
        }
    }

    doActionsGroupByKey(key) {
        this._interruptBackgroundProcesses();
        return this.sceneController.doActionsGroupByKey(key);
    }

    doNextActionsGroup() {
        this._interruptBackgroundProcesses();
        return this.sceneController.doNextActionsGroup();
    }

    tryDoNextActionsGroup(isButtonClicked, { eventChoiceId, eventChoiceVariant } = {}) {
        if (this.needClickButton && !isButtonClicked)
            return;

        if (this._isActiveBackgroundProcesses())
            return this._interruptActiveBackgroundProcesses();

        if (eventChoiceId && eventChoiceVariant)
            this.variables[eventChoiceId] = eventChoiceVariant;

        return this.doNextActionsGroup();
    }
}

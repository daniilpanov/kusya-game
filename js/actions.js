const validateCoordinates = (x, y) => {
    x = Number.parseFloat(x);
    y = Number.parseFloat(y);

    if (Number.isNaN(x) || Number.isNaN(y))
        throw new Error(`X or Y is not a finite number [X: ${x}, Y: ${y}]`);

    return [x, y];
};

const resolvePerson = (persons, personSprite) => {
    const [personId, spriteId = "default"] = personSprite.split(".");
    const person = persons[personId];

    if (!person)
        throw new Error(`Person "${personId}" not found`);

    return [person, spriteId];
};

// Action names available to scenes ("action_" prefix and internal _helpers stripped);
// used by the scene editor for validation
export const getKnownActionNames = () => Object.keys(createHandlersMap())
    .filter(key => key.startsWith("action_"))
    .map(key => key.slice("action_".length));

export const createHandlersMap = () => ({
    action_setBackground([ bgKey ]) {
        bgKey = String(bgKey);
        const background = this.backgrounds[bgKey];

        if (!background)
            throw new Error(`Background "${bgKey}" not found`);

        this.bgWrapper.innerHTML = "";
        this.bgWrapper.appendChild(background.img);
    },
    action_if([ condition, target ]) {
        if (this.expressionsParser.evaluate(condition))
            return this.handlersMap.action_goto([ target ]);
    },
    action_cloneVar([ oldVarName, newVarName ]) {
        this.variables[newVarName] = this.variables[oldVarName];
    },
    action_setVar([ varName, value ]) {
        this.variables[varName] = this.expressionsParser.evaluate(value);
    },
    action_addVar([ varName, value ]) {
        if (typeof this.variables[varName] === "undefined")
            return this.handlersMap.action_setVar([varName, value]);

        this.variables[varName] += this.expressionsParser.evaluate(value);
    },
    action_addStats([ statName, value ]) {
        const stat = this.stats[statName];

        if (!stat)
            throw new Error(`Stat "${statName}" not found`);

        stat.value += this.expressionsParser.evaluate(value);
    },
    action_goto([ groupKey ]) {
        return this.doActionsGroupByKey(String(groupKey));
    },
    action_gotoNext() {
        return this.doNextActionsGroup();
    },
    action_movePersonSprite([ personSprite, x, y ]) {
        const [vx, vy] = validateCoordinates(x, y);
        const [person] = resolvePerson(this.persons, personSprite);
        person.setAnchorPosition(vx, vy);
    },
    action_showPersonSprite([ personSprite, hideAllOther = false, x = undefined, y = undefined ]) {
        if (!personSprite) {
            if (hideAllOther)
                this.activePersons.forEach(person => person.hide());

            return;
        }

        const [currentPersonObj, personSpriteId] = resolvePerson(this.persons, personSprite);

        if (hideAllOther)
            for (const person of this.activePersons)
                if (person.name !== currentPersonObj.name)
                    person.hide();

        if (x !== undefined && y !== undefined) {
            const [vx, vy] = validateCoordinates(x, y);
            currentPersonObj.setAnchorPosition(vx, vy);
        }

        currentPersonObj.show(personSpriteId);
        this.activePersons.push(currentPersonObj);

        return currentPersonObj;
    },
    _showDialog({ text, author }) {
        this.templateWrappers.choices?.classList.remove("active");
        this.templateWrappers.dialog?.classList.add("active");
        this.templates.dialog?.render({ text, author });
    },
    _showChoices({ choiceKey, text, author, choices }) {
        this.needClickButton = true;
        this.templateWrappers.choices?.classList.add("active");
        this.templateWrappers.dialog?.classList.remove("active");

        const choicesList = choices.map(variant => ({
            "event-choice-id": choiceKey,
            "event-choice-variant": variant,
            "content": variant,
        }));

        this.templates.choices?.render({ author, text, choicesList });
    },
    action_showChoice([ choiceKey, text, ...choices ]) {
        this.handlersMap.action_showChoicePerson([ choiceKey, null, text, ...choices ]);
    },
    action_showChoicePerson([ choiceKey, personSprite, text, ...choices ]) {
        let hideAllOther = true;

        if (choices.length > 0 && (choices[choices.length - 1] === true || choices[choices.length - 1] === false)) {
            hideAllOther = choices.pop();
        }

        const personObj = this.handlersMap.action_showPersonSprite([personSprite, hideAllOther]);
        const author = personObj?.name ?? "...";

        this.handlersMap._showChoices({ choiceKey, text, author, choices });
    },
    action_showPhrase([ text ]) {
        this.handlersMap.action_showPhrasePerson([ null, null, text ]);
    },
    action_showPhrasePerson([ personSprite, pseudoName = null, text, hideAllOther = true ]) {
        const personObj = this.handlersMap.action_showPersonSprite([personSprite, hideAllOther]);
        const author = pseudoName ?? personObj?.name ?? "...";

        this.handlersMap._showDialog({ text, author });
    },
    action_showTitle([ title ]) {
        return new Promise(r => {
            this.templateWrappers.sceneTitle?.classList.remove("inactive");
            this.templates.sceneTitle?.render({ title });

            this.activeTitleTimeoutId = setTimeout(() => {
                if (!this.activeTitleTimeoutId)
                    return;

                this.templateWrappers.sceneTitle?.classList.add("inactive");
                this.activeTitleTimeoutId = undefined;

                const res = this.handlersMap.action_gotoNext();
                return res instanceof Promise ? res.then(r) : r(res);
            }, 5000);
        });
    },
    action_gotoNextScene() {
        this.templateWrappers.dialog?.classList.remove("active");
        this.templateWrappers.choices?.classList.remove("active");
        return this.loadSceneByKeyIndex(this.currentSceneKeyIndex + 1).then(() => this.doNextActionsGroup());
    },
    action_gotoScene([ sceneKey ]) {
        return this.loadSceneByKey(sceneKey);
    },
    action_end() {
        window.location.href = `/?finished=${this.gameResource}`;
    },
});

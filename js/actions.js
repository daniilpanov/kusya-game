const createHandlersMap = () => ({
    action_setBackground(bgKey) {
        bgKey = String(bgKey);

        this.bgWrapper.innerHTML = "";
        this.bgWrapper.appendChild(this.backgrounds[bgKey].img);
    },
    action_if(groupKey, [ condition ]) {
        if (this.expressionsParser.evaluate(condition))
            return this.handlersMap.action_goto(groupKey);
    },
    action_cloneVar(oldVarName, [ newVarName ]) {
        this.variables[newVarName] = this.variables[oldVarName];
    },
    action_setVar(value, [ varName ]) {
        this.variables[varName] = value;
    },
    action_addVar(value, [ varName ]) {
        if (this.variables[varName] === "undefined")
            return this.handlersMap.action_setVar(...arguments);

        this.variables[varName] += value;
    },
    action_addStats(value, [ statName ]) {
        this.stats[statName].value += value;
    },
    action_goto(groupKey) {
        return this.doActionsGroupByKey(String(groupKey));
    },
    action_gotoNext() {
        return this.doNextActionsGroup();
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
        this.needClickButton = true;
        this.templateWrappers.choices?.classList.add("active");
        this.templateWrappers.dialog?.classList.remove("active");

        const personObj = this.handlersMap.action_showPersonSprite(personSprite, [ hideAllOther ]);
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

        const personObj = this.handlersMap.action_showPersonSprite(personSprite, [ hideAllOther ]);
        const author = pseudoName ?? personObj?.name ?? "...";

        this.templates.dialog?.render({ text, author });
    },
    action_showTitle(title) {
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
    action_gotoScene(sceneKey) {
        return this.loadSceneByKey(sceneKey);
    },
    action_end() {
        window.location.href = `/?finished=${this.gameResource}`;
    },
});

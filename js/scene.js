import { ActParser } from '#/lib/act/act-parser.js';

export class SceneController {
    currentActionsGroupIndex = -1;

    constructor(sceneKey, content, actionsHandler) {
        this.sceneKey = sceneKey;
        this.actionsHandler = actionsHandler;

        const parser = new ActParser({ content });
        const parsed = parser.parse();
        this.groups = parsed.groups;
        this.groupIndexMap = parser.groupIndexMap;
    }

    doNextActionsGroup() {
        return this.doActionsGroup(this.currentActionsGroupIndex + 1);
    }

    doActionsGroup(index) {
        if (index < 0 || index >= this.groups.length) return;
        this.currentActionsGroupIndex = index;
        return this._doActionsGroup(index);
    }

    doActionsGroupByKey(key) {
        const index = this.groupIndexMap[String(key)];
        if (index === undefined)
            throw new Error(`Group "${key}" not found`);
        return this.doActionsGroup(index);
    }

    _doActionsGroup(index) {
        return Promise.allSettled(
            this.groups[index].actions.map(this.actionsHandler).filter(i => i instanceof Promise)
        );
    }
}

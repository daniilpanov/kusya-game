import { ActParser } from '#/lib/act/act-parser.js';

export class SceneController {
    currentActionsGroupIndex = -1;

    constructor(sceneKey, content, actionsHandler, onActionError = undefined) {
        this.sceneKey = sceneKey;
        this.actionsHandler = actionsHandler;
        this.onActionError = onActionError || this._defaultActionErrorHandler;

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
        const group = this.groups[index];

        // Groups run strictly sequentially; nodes within a group run in parallel.
        // A failed node does not affect its siblings: its error is isolated and reported via onActionError.
        return Promise.allSettled(
            group.actions.map(action =>
                Promise.resolve()
                    .then(() => this.actionsHandler(action))
                    .catch(error => this.onActionError({
                        sceneKey: this.sceneKey,
                        groupKey: group.key,
                        action,
                        error,
                    }))
            )
        );
    }

    _defaultActionErrorHandler({ sceneKey, groupKey, action, error }) {
        console.error(`[scene "${sceneKey}"] action "${action.name}" (group [${groupKey}]) failed:`, error);
    }
}

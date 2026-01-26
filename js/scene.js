class SceneController {
    currentActionsGroupKeyIndex = -1;

    constructor(sceneKey, descriptor, actionsHandler) {
        this.sceneKey = sceneKey;
        this.actionsHandler = actionsHandler;

        const descriptorObject = toml.parse(descriptor);
        this.groupsKeys = Object.keys(descriptorObject).sort((a, b) => Number(a) - Number(b));
        this.groups = this.groupsKeys.map(groupKey => parseGroup(descriptorObject[groupKey]));
    }

    doNextActionsGroup() {
        return this.doActionsGroup(this.currentActionsGroupKeyIndex + 1);
    }

    doActionsGroup(keyIdx) {
        this.currentActionsGroupKeyIndex = keyIdx;
        return this._doActionsGroup(this.groupsKeys[keyIdx]);
    }

    doActionsGroupByKey(key) {
        this.currentActionsGroupKeyIndex = this.groupsKeys.indexOf(key);
        return this._doActionsGroup(key);
    }

    _doActionsGroup(key) {
        return Promise.allSettled(this.groups[key].map(this.actionsHandler).filter(i => i instanceof Promise));
    }
}

const parseGroup = group => Object.keys(group).map(key => parseAction(key, group[key]));

function parseAction(key, mainArg) {
    const [ actionKey, stringArgs ] = key.split("(", 2);
    const args = stringArgs?.slice(0, -1).split(",").map(arg => arg.trim()) || [];

    return { actionKey, mainArg, args };
}

class SceneController {
    currentActionsGroupKeyIndex = -1;

    constructor(sceneKey, descriptor, actionsHandler) {
        this.sceneKey = sceneKey;
        this.actionsHandler = actionsHandler;

        const descriptorObject = toml.parse(descriptor);
        this.groupsKeys = Object.keys(descriptorObject).sort();
        this.groups = this.groupsKeys.map(groupKey => parseGroup(descriptorObject[groupKey]));
    }

    doNextActionsGroup() {
        return this.doActionsGroup(this.currentActionsGroupKeyIndex + 1);
    }

    doActionsGroup(keyIdx) {
        this.currentActionsGroupKeyIndex = keyIdx;
        this.groups[this.groupsKeys[keyIdx]].map(this.actionsHandler);
    }
}

const parseGroup = group => Object.keys(group).map(key => parseAction(key, group[key]));

function parseAction(key, mainArg) {
    const { actionKey, stringArgs } = key.split("(", 2);
    const args = stringArgs.slice(0, -1).split(",").map(arg => arg.trim());

    return { actionKey, mainArg, args };
}

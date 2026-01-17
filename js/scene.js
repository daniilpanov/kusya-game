class SceneView {
    currentAction = undefined;

    constructor(sceneKey, descriptor) {
        this.sceneKey = sceneKey;
        this.parseDescriptor(descriptor);
    }

    parseDescriptor(descriptor) {

    }

    async nextAction() {
        if (this.currentAction && !this.currentAction.finished)
            return await this.currentAction.finishAction();

        this.currentAction = this.actions.pop();
        await this.currentAction.doAction();
    }
}
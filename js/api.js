async function fetchJson(url, method = 'get', body = undefined, timeout = 3000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    return await fetch(`api/${url}`, {
        method,
        body,
        signal: controller.signal,
    })
        .then(response => response.json())
        .finally(() => clearTimeout(id));
}

class GameAPI {
    constructor(id) {
        this.id = id;
    }

    static getAll() {
        return fetchJson('/games');
    }

    getInfoById() {
        return fetchJson(`/games/${this.id}`);
    }

    getStartSceneId() {
        return fetchJson(`/games/${this.id}/play`);
    }
}

class SceneAPI {
    constructor(id) {
        this.id = id;
    }

    getById() {
        return fetchJson(`/scenes/${this.id}`);
    }

    getActions(afterChoiceId = undefined) {
        const url = `/scenes/${this.id}/actions` + (afterChoiceId ? `?choice_alias=${afterChoiceId}` : '');
        return fetchJson(url);
    }
}

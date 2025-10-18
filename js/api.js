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

class Game {
    constructor(id) {
        this.id = id;
    }

    static getAll() {
        return fetchJson('/games');
    }

    getInfoById() {
        return fetchJson(`/games/${this.id}`);
    }

    getStartScenes() {
        return fetchJson(`/games/${this.id}/play`);
    }
}

class Scene {
    constructor(id) {
        this.id = id;
    }

    getById() {
        return fetchJson(`/scenes/${this.id}`);
    }

    getDialogues(afterChoiceId = undefined) {
        const url = `/scenes/${this.id}/dialogues` + (afterChoiceId ? `?choice=${afterChoiceId}` : '');
        return fetchJson(url);
    }
}

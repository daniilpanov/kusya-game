class GameAPI {
    constructor(id) {
        this.id = id;
    }

    static getAll() {
        return Utils.fetchJson('/games');
    }

    getInfoById() {
        return Utils.fetchJson(`/games/${this.id}`);
    }
}

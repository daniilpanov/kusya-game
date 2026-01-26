// Extend templater with typer

class TemplaterTyperExtension {
    static delay = 100;
    static currentTypers = [];

    static type(text, element) {
        const typer = new TextTyper(element, text, this.delay);
        this.currentTypers.push(typer);
        return typer.startTyping();
    }

    static isActiveTypers() {
        for (const typer of this.currentTypers) {
            if (!typer.finished)
                return true;
        }

        return false;
    }

    static endTyping() {
        this.currentTypers.forEach(typer => typer.endTyping());
    }
}

Templater.injectionHandlers.typer = (text, element) => {
    TemplaterTyperExtension.type(text, element);
}

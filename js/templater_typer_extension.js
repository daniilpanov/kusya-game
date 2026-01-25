// Extend templater with typer

class TemplaterTyperExtension {
    static delay = 100;
    static currentTypers = [];

    static type(text, element) {
        const typer = new TextTyper(element, text, this.delay);
        this.currentTypers.push(typer);
        return typer.startTyping();
    }

    static endTyping() {
        this.currentTypers.forEach(typer => typer.endTyping());
    }
}

Templater.injectionHandlers.typer = (text, element) => {
    TemplaterTyperExtension.type(text, element);
}

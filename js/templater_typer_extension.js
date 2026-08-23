// Extend templater with typer

import { Templater } from '#/lib/templater/templater.js';
import { TextTyper } from '#/lib/typer/typer.js';

export class TemplaterTyperExtension {
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

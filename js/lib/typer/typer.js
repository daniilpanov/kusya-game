export class TextTyper {
    typerProcessId = undefined;
    finished = false;

    constructor(element, text, delay) {
        this.element = element;
        this.text = text;
        this.delay = delay;
    }

    startTyping() {
        if (this.typerProcessId)
            return;

        this.element.innerHTML = '';
        let index = 0;

        const type = () => {
            if (index < this.text.length) {
                const char = this.text.charAt(index);
                this.element.innerHTML += char === ' ' ? '&nbsp;' : char;
                ++index;
                this.typerProcessId = setTimeout(type, this.delay);
            } else
                this.finished = true;
        }

        type();
    }

    endTyping() {
        if (!this.typerProcessId)
            return;

        clearTimeout(this.typerProcessId);
        this.element.innerHTML = this.text;
        this.finished = true;
    }
}

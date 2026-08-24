const injectionHandlers = {
    insertion(text, element) {
        element.innerHTML = text;
    },
    iter_mapFullItemToAttrs(data, { rootEl, template }) {
        rootEl.innerHTML = "";

        for (const item of data) {
            const templateInstance = template.cloneNode(true);
            const innerText = item.content ?? item.text;

            if (innerText) {
                this.constructor.injectionHandlers.insertion.bind(this)(innerText, templateInstance);
                delete item.content;
                delete item.text;
            }

            for (const itemKey in item)
                templateInstance.setAttribute(`data-bs-${itemKey}`, item[itemKey]);

            rootEl.appendChild(templateInstance);
        }

        return rootEl;
    },
};
const injectionPreHandlers = {
    iter_mapFullItemToAttrs(rootEl) {
        const template = rootEl.children[0]?.cloneNode(true);
        if (!template)
            return;

        rootEl.innerHTML = "";
        return { rootEl, template };
    },
};

export class Templater {
    static injectionHandlers = injectionHandlers;
    static injectionPreHandlers = injectionPreHandlers;

    constructor(templateBody) {
        this.template = templateBody;

        this.parsedMutableElements = [];
        const mutableElements = templateBody.querySelectorAll("[data-bs-injection-key]");

        for (const element of mutableElements) {
            const injectionKey = element.getAttribute("data-bs-injection-key");
            if (!injectionKey)
                continue;

            const injectionType = element.getAttribute("data-bs-injection-type") || "insertion";
            const injectionCallback = this.constructor.injectionHandlers[injectionType];

            if (injectionCallback) {
                let arg = element;
                const injectionPreHandler = this.constructor.injectionPreHandlers[injectionType];

                if (injectionPreHandler) {
                    arg = injectionPreHandler(arg);
                    if (!arg)
                        continue;
                }

                this.parsedMutableElements.push({ arg, injectionKey, injectionCallback });
            }
        }
    }

    render(data) {
        for (const { arg, injectionKey, injectionCallback } of this.parsedMutableElements)
            injectionCallback.bind(this)(data[injectionKey], arg);

        return this.template;
    }
}

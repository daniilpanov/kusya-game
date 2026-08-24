// Generic modal shell over the native <dialog> element.
// openModal({ title, content, saveLabel, wide }) → Promise<boolean>
//   true  — Save pressed
//   false — cancelled (Cancel button, Esc or click on backdrop)

export function openModal({ title, content, saveLabel = 'Сохранить', wide = false }) {
    return new Promise(resolve => {
        const dialog = document.createElement('dialog');
        dialog.className = 'editor-modal' + (wide ? ' wide' : '');

        const header = document.createElement('div');
        header.className = 'editor-modal-header';
        const heading = document.createElement('span');
        heading.textContent = title;
        header.appendChild(heading);

        const body = document.createElement('div');
        body.className = 'editor-modal-body';
        if (content instanceof HTMLElement)
            body.appendChild(content);

        const footer = document.createElement('div');
        footer.className = 'editor-modal-footer';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'Отмена';
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'primary';
        saveBtn.textContent = saveLabel;
        footer.append(cancelBtn, saveBtn);

        dialog.append(header, body, footer);
        document.body.appendChild(dialog);
        dialog.showModal();

        let settled = false;
        const finish = result => {
            if (settled) return;
            settled = true;
            dialog.close();
            dialog.remove();
            resolve(result);
        };

        saveBtn.addEventListener('click', () => finish(true));
        cancelBtn.addEventListener('click', () => finish(false));
        // Esc: native 'cancel' event before close
        dialog.addEventListener('cancel', event => {
            event.preventDefault();
            finish(false);
        });
        // click on backdrop (outside content box)
        dialog.addEventListener('click', event => {
            if (event.target === dialog)
                finish(false);
        });
    });
}

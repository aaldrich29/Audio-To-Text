import { Modal, App, ButtonComponent } from 'obsidian';

interface AudioFileSelectionModalProps {
    app: App;
    audioFiles: string[];
    onSelect: (selectedFiles: string[]) => void;
}

export class AudioFileSelectionModal extends Modal {
    audioFiles: string[];
    onSelect: (selectedFiles: string[]) => void;

    constructor(props: AudioFileSelectionModalProps) {
        super(props.app);
        this.audioFiles = props.audioFiles;
        this.onSelect = props.onSelect;
    }

    onOpen() {
        const { contentEl } = this;
        //contentEl.addClass('audio-to-text'); //This doesn't work for some reason.

        contentEl.createEl('h2', { text: 'Select audio files to transcribe' });

        const fileContainer = contentEl.createEl('div', { cls: 'file-container' });

        const selectAllCheckbox = fileContainer.createEl('input', { type: 'checkbox' });
        selectAllCheckbox.id = 'select-all';
        const selectAllLabel = fileContainer.createEl('label', { text: 'All', attr: { for: 'select-all' } });
        fileContainer.createEl('br');

        selectAllCheckbox.onchange = () => {
            const checkboxes = fileContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                if (checkbox !== selectAllCheckbox) {
                    (checkbox as HTMLInputElement).checked = selectAllCheckbox.checked;
                }
            });
        };

        this.audioFiles.forEach(file => {
            const checkbox = fileContainer.createEl('input', { type: 'checkbox' });
            checkbox.id = file;
            const label = fileContainer.createEl('label', { text: file, attr: { for: file } });
            fileContainer.createEl('br');
        });

        const buttonContainer = contentEl.createEl('div', { cls: 'button-container' });
        const transcribeButton = new ButtonComponent(buttonContainer);
        transcribeButton.setButtonText('Transcribe');
        transcribeButton.buttonEl.addClass('mod-cta'); // Use theme's accent color
        transcribeButton.onClick(() => {
            const selectedFiles = Array.from(fileContainer.querySelectorAll('input[type="checkbox"]:checked'))
                .map(checkbox => (checkbox as HTMLInputElement).id)
                .filter(id => id !== 'select-all');
            this.onSelect(selectedFiles);
            this.close();
        });

        // Additional styling
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

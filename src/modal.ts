import { Modal, App } from 'obsidian';
import { AudioFileSelectionModalProps } from './interfaces';

export class AudioFileSelectionModal extends Modal {
    private audioFiles: string[];
    private onSelect: (selectedFiles: string[]) => void;

    constructor({ app, audioFiles, onSelect }: AudioFileSelectionModalProps) {
        super(app);
        this.audioFiles = audioFiles;
        this.onSelect = onSelect;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Select audio files to transcribe' });

        const allCheckboxContainer = contentEl.createDiv('all-checkbox-container');
        const allCheckbox = allCheckboxContainer.createEl('input', { type: 'checkbox' });
        allCheckbox.addEventListener('change', () => {
            const checkboxes = contentEl.querySelectorAll('.audio-checkbox') as NodeListOf<HTMLInputElement>;
            checkboxes.forEach(checkbox => checkbox.checked = allCheckbox.checked);
        });
        allCheckboxContainer.createEl('span', { text: 'All' });

        this.audioFiles.forEach(file => {
            const fileContainer = contentEl.createDiv('file-container');
            const checkbox = fileContainer.createEl('input', { type: 'checkbox', cls: 'audio-checkbox' });
            fileContainer.createEl('span', { text: file });
        });

        const submitButton = contentEl.createEl('button', { text: 'Transcribe' });
        submitButton.addEventListener('click', () => {
            const selectedFiles: string[] = [];
            const checkboxes = contentEl.querySelectorAll('.audio-checkbox') as NodeListOf<HTMLInputElement>;
            checkboxes.forEach((checkbox, index) => {
                if (checkbox.checked) {
                    selectedFiles.push(this.audioFiles[index]);
                }
            });
            this.onSelect(selectedFiles);
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

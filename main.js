const { Plugin, PluginSettingTab, Notice, Modal, Setting, normalizePath } = require('obsidian');

class AudioFileSelectionModal extends Modal {
    constructor(app, audioFiles, onSelect) {
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
            const checkboxes = contentEl.querySelectorAll('.audio-checkbox');
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
            const selectedFiles = [];
            const checkboxes = contentEl.querySelectorAll('.audio-checkbox');
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

class AudioToTextSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        new Setting(containerEl).setName('Audio to text settings').setHeading();
        new Setting(containerEl)
            .setName('OpenAI API key')
            .setDesc('Enter your OpenAI API key here.')
            .addText(text => text
                .setPlaceholder('Enter your API key')
                .setValue(this.plugin.settings.apiKey || '')
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value;
                    await this.plugin.saveSettings();
                }));
        new Setting(containerEl)
            .setName('Context menu: Transcribe to new note')
            .setDesc('Transcribe audio to a new note instead of the current note when you right-click an audio file link and choose transcribe.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.transcribeToNewNote)
                .onChange(async (value) => {
                    this.plugin.settings.transcribeToNewNote = value;
                    await this.plugin.saveSettings();
                }));
    }
}

module.exports = class AudioToTextPlugin extends Plugin {
    async onload() {
        await this.loadSettings();
        this.addSettingTab(new AudioToTextSettingTab(this.app, this));

        this.addCommand({
            id: 'transcribe-audio-files',
            name: 'Add transcription to new notes',
            checkCallback: (checking) => {
                if (checking) {
                    return !!this.app.workspace.activeLeaf;
                }
                this.handleTranscribeAudioFiles();
            }
        });

        this.addCommand({
            id: 'add-transcription-to-active-note',
            name: 'Add transcription to active note',
            checkCallback: (checking) => {
                if (checking) {
                    return !!this.app.workspace.activeLeaf;
                }
                this.handleAddTranscriptionToActiveNote();
            }
        });

        this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
            if (this.isSupportedAudioFile(file.extension)) {
                menu.addItem(item => {
                    item.setTitle('Transcribe audio file')
                        .setIcon('microphone')
                        .onClick(() => {
                            if (this.settings.transcribeToNewNote) {
                                this.transcribeAudioFile(file);
                            } else {
                                this.addTranscriptionToActiveNoteFromFile(file);
                            }
                        });
                });
            }
        }));
    }

	async handleTranscribeAudioFiles() {
	    const activeFile = this.app.workspace.getActiveFile();
	    if (!activeFile) {
	        new Notice('No active file found!');
	        return;
	    }
	    const fileContent = await this.app.vault.read(activeFile);
	    const audioFileLinks = this.extractAudioFileLinks(fileContent);
	    if (audioFileLinks.length === 0) {
	        new Notice('No audio links found in the note!');
	        return;
	    }
	    if (audioFileLinks.length === 1) {
	        this.transcribeSingleAudioFile(audioFileLinks[0]);
	    } else {
	        new AudioFileSelectionModal(this.app, audioFileLinks, selectedFiles => {
	            selectedFiles.forEach(link => {
	                this.transcribeSingleAudioFile(link);
	            });
	        }).open();
	    }
	}

	async handleAddTranscriptionToActiveNote() {
	    const activeFile = this.app.workspace.getActiveFile();
	    if (!activeFile) {
	        new Notice('No active file found!');
	        return;
	    }
	    const fileContent = await this.app.vault.read(activeFile);
	    const audioFileLinks = this.extractAudioFileLinks(fileContent);
	    if (audioFileLinks.length === 0) {
	        new Notice('No audio links found in the note!');
	        return;
	    }
	    if (audioFileLinks.length === 1) {
	        this.addSingleTranscriptionToActiveNote(audioFileLinks[0]);
	    } else {
	        new AudioFileSelectionModal(this.app, audioFileLinks, async (selectedFiles) => {
	            let updatedContent = fileContent;
	            for (const link of selectedFiles) {
	                const text = await this.transcribeSingleAudioFile(link, true);
	                if (text) {
	                    updatedContent += `\n\n### Transcription for ${link}\n${text}`;
	                }
	            }
	            await this.app.vault.modify(activeFile, updatedContent);
	        }).open();
	    }
	}

	async transcribeSingleAudioFile(link, returnText = false) {
	    try {
	        let audioFile = await this.app.vault.getAbstractFileByPath(link);
	        if (!audioFile) {
	            audioFile = await this.searchFileByName(link);
	        }
	        if (!audioFile) {
	            new Notice(`Audio file not found: ${link}`);
	            return;
	        }
	        const audioBuffer = await this.app.vault.readBinary(audioFile);
	        const text = await this.transcribeAudio(audioBuffer, audioFile.name);
	        if (text) {
	            if (returnText) {
	                return text;
	            } else {
	                await this.createTranscriptionNoteWithUniqueName(text, audioFile.name);
	                new Notice(`Transcription complete for file: ${link}`);
	            }
	        } else {
	            new Notice(`Transcription failed for file: ${link}`);
	        }
	    } catch (error) {
	        new Notice(`An error occurred during transcription for file: ${link}`);
	        console.error(`Error during transcription for file: ${link}`, error);
	    }
	}

	async addSingleTranscriptionToActiveNote(link) {	    const activeFile = this.app.workspace.getActiveFile();
	    const fileContent = await this.app.vault.read(activeFile);
	    const text = await this.transcribeSingleAudioFile(link, true);
	    if (text) {
	        const updatedContent = fileContent + `\n\n### Transcription for ${link}\n${text}`;
	        await this.app.vault.modify(activeFile, updatedContent);
	        new Notice(`Transcription added to active note for file: ${link}`);
	    }
	}

	async addTranscriptionToActiveNoteFromFile(audioFile) {
	    const activeFile = this.app.workspace.getActiveFile();
	    if (!activeFile) {
	        new Notice('No active file found!');
	        return;
	    }
	    const fileContent = await this.app.vault.read(activeFile);
	    const text = await this.transcribeSingleAudioFile(audioFile.path, true);
	    if (text) {
	        const updatedContent = fileContent + `\n\n### Transcription for ${audioFile.name}\n${text}`;
	        await this.app.vault.modify(activeFile, updatedContent);
	        new Notice(`Transcription added to active note for file: ${audioFile.name}`);
	    }
	}

	async transcribeAudioFile(audioFile) {
	    try {
	        const audioBuffer = await this.app.vault.readBinary(audioFile);
	        const text = await this.transcribeAudio(audioBuffer, audioFile.name);
	        if (text) {
	            await this.createTranscriptionNoteWithUniqueName(text, audioFile.name);
	            new Notice('Transcription complete!');
	        } else {
	            new Notice('Transcription failed!');
	        }
	    } catch (error) {
	        new Notice('An error occurred during transcription.');
	        console.error('Error during transcription:', error);
	    }
	}

	extractAudioFileLinks(content) {
	    const regex = /!\[\[([^\]]+\.(mp3|webm|wav|ogg|m4a))\]\]/g;
	    const matches = [];
	    let match;
	    while ((match = regex.exec(content)) !== null) {
	        matches.push(match[1]);
	    }
	    return matches;
	}

	async searchFileByName(fileName) {
	    const files = this.app.vault.getFiles();
	    return files.find(file => file.path.endsWith(fileName));
	}

	isSupportedAudioFile(extension) {
	    const supportedExtensions = ['mp3', 'webm', 'wav', 'ogg', 'm4a'];
	    return supportedExtensions.includes(extension.toLowerCase());
	}

	async transcribeAudio(audioBuffer, fileName) {
	    const apiKey = this.settings.apiKey;
	    if (!apiKey) {
	        new Notice('OpenAI API key not set!');
	        return '';
	    }
	    try {
	        const formData = new FormData();
	        formData.append('file', new Blob([audioBuffer]), fileName);
	        formData.append('model', 'whisper-1');
	        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
	            method: 'POST',
	            headers: {
	                'Authorization': `Bearer ${apiKey}`
	            },
	            body: formData
	        });
	        if (!response.ok) {
	            const errorText = await response.text();
	            new Notice('API request failed!');
	            return '';
	        }
	        const result = await response.json();
	        return result.text;
	    } catch (error) {
	        new Notice('Failed to communicate with API.');
	        console.error('Failed to communicate with API:', error);
	        return '';
	    }
	}

	async createTranscriptionNoteWithUniqueName(text, audioFileName) {
	    const activeFile = this.app.workspace.getActiveFile();
	    let fileName = `${audioFileName} Transcription`;
	    let filePath = normalizePath(`${activeFile.parent.path}/${fileName}.md`);
	    while (await this.app.vault.adapter.exists(filePath)) {
	        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	        fileName = `${audioFileName} Transcription ${timestamp}`;
	        filePath = normalizePath(`${activeFile.parent.path}/${fileName}.md`);
	    }
	    try {
	        const content = `### Transcription for ${audioFileName}\n${text}`;
	        await this.app.vault.create(filePath, content);
	        const file = this.app.vault.getAbstractFileByPath(filePath);
	        if (file) {
	            await this.app.workspace.getLeaf().openFile(file);
	        } else {
	            console.error('Failed to open transcription note:', filePath);
	        }
	    } catch (error) {
	        new Notice('Failed to create transcription note.');
	        console.error('Error creating transcription note:', error);
	    }
	}

	async loadSettings() {
	    this.settings = Object.assign({ apiKey: '', transcribeToNewNote: true, }, await this.loadData());
	}

	async saveSettings() {
	    await this.saveData(this.settings);
	}
	
	onunload() {
	    console.log('Unloading Audio to Text plugin');
	}
};
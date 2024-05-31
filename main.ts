import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, normalizePath, TFile } from 'obsidian';
import { AudioToTextSettings, AudioFileSelectionModalProps } from 'src/interfaces';
import { AudioFileSelectionModal } from 'src/modal';
import { AudioToTextSettingTab } from 'src/settings';

export default class AudioToTextPlugin extends Plugin {
    settings: AudioToTextSettings;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new AudioToTextSettingTab(this.app, this));

        this.addCommand({
            id: 'transcribe-audio-files',
            name: 'Add transcription to new note',
            checkCallback: (checking: boolean) => {
                if (checking) {
                    return !!this.app.workspace.activeLeaf;
                }
                this.handleTranscribeAudioFiles();
            }
        });

        this.addCommand({
            id: 'add-transcription-to-active-note',
            name: 'Add transcription to active note',
            checkCallback: (checking: boolean) => {
                if (checking) {
                    return !!this.app.workspace.activeLeaf;
                }
                this.handleAddTranscriptionToActiveNote();
            }
        });

        this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
            if (file instanceof TFile && this.isSupportedAudioFile(file.extension)) {
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
            new AudioFileSelectionModal({ app: this.app, audioFiles: audioFileLinks, onSelect: selectedFiles => {
                selectedFiles.forEach(link => {
                    this.transcribeSingleAudioFile(link);
                });
            }}).open();
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
            new AudioFileSelectionModal({
                app: this.app,
                audioFiles: audioFileLinks,
                onSelect: async (selectedFiles) => {
                    let updatedContent = fileContent;
                    for (const link of selectedFiles) {
                        const text = await this.transcribeSingleAudioFile(link, true);
                        if (text) {
                            updatedContent += `\n\n### Transcription for ${link}\n${text}`;
                        }
                    }
                    await this.app.vault.modify(activeFile, updatedContent);
                }
            }).open();
        }
    }

    async transcribeSingleAudioFile(link: string, returnText = false): Promise<string | void> {
        try {
            let audioFile = this.app.vault.getAbstractFileByPath(link);
            if (audioFile && !(audioFile instanceof TFile)) {
                audioFile = null;
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

    async addSingleTranscriptionToActiveNote(link: string) {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file found!');
            return;
        }
        const fileContent = await this.app.vault.read(activeFile);
        const text = await this.transcribeSingleAudioFile(link, true);
        if (text) {
            const updatedContent = fileContent + `\n\n### Transcription for ${link}\n${text}`;
            await this.app.vault.modify(activeFile, updatedContent);
            new Notice(`Transcription added to active note for file: ${link}`);
        }
    }

    async addTranscriptionToActiveNoteFromFile(audioFile: TFile) {
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

    async transcribeAudioFile(audioFile: TFile) {
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

    extractAudioFileLinks(content: string): string[] {
        const regex = /!\[\[([^\]]+\.(mp3|webm|wav|ogg|m4a))\]\]/g;
        const matches: string[] = [];
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
            matches.push(match[1]);
        }
        return matches;
    }

    async searchFileByName(fileName: string): Promise<TFile | undefined> {
        const files = this.app.vault.getFiles();
        return files.find(file => file.path.endsWith(fileName));
    }

    isSupportedAudioFile(extension: string): boolean {
        const supportedExtensions = ['mp3', 'webm', 'wav', 'ogg', 'm4a'];
        return supportedExtensions.includes(extension.toLowerCase());
    }

    async transcribeAudio(audioBuffer: ArrayBuffer, fileName: string): Promise<string> {
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

    async createTranscriptionNoteWithUniqueName(text: string, audioFileName: string) {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || !activeFile.parent) {
            new Notice('No active file or active file has no parent.');
            return;
        }
        
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
            if (file && file instanceof TFile) {
                const newLeaf = this.app.workspace.getLeaf(true);
                await newLeaf.openFile(file);
            } else {
                console.error('Failed to open transcription note:', filePath);
            }
        } catch (error) {
            new Notice('Failed to create transcription note.');
            console.error('Error creating transcription note:', error);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({ apiKey: '', transcribeToNewNote: false }, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
    
    onunload() {
        console.log('Unloading Audio to Text plugin');
    }
}

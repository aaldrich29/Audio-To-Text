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
                this.handleTranscribeAudioFiles(true);
            }
        });

        this.addCommand({
            id: 'add-transcription-to-active-note',
            name: 'Add transcription to active note',
            checkCallback: (checking: boolean) => {
                if (checking) {
                    return !!this.app.workspace.activeLeaf;
                }
                this.handleTranscribeAudioFiles(false);
            }
        });

        this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
            if (file instanceof TFile && this.isSupportedAudioFile(file.extension)) {
                menu.addItem(item => {
                    item.setTitle('Transcribe audio file')
                        .setIcon('microphone')
                        .onClick(() => {
                            this.handleFileMenuTranscription(file);
                        });
                });
            }
        }));
    }

    async handleTranscribeAudioFiles(transcribeToNewNote: boolean) {
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
            await this.processSingleAudioFile(audioFileLinks[0], transcribeToNewNote);
        } else {
            new AudioFileSelectionModal({
                app: this.app,
                audioFiles: audioFileLinks,
                onSelect: async (selectedFiles) => {
                    let updatedContent = fileContent;
                    for (const link of selectedFiles) {
                        const text = await this.transcribeSingleAudioFile(link);
                        if (text) {
                            if (transcribeToNewNote) {
                                const newFileLink = await this.createTranscriptionNoteWithUniqueName(text, link, activeFile);
                                if (newFileLink && this.settings.addLinkToOriginalFile) {
                                    updatedContent = this.insertTextBelowLink(updatedContent, link, `### Link to transcription for ${link}\n[[${newFileLink.name}]]`);
                                }
                            } else {
                                updatedContent = this.insertTextBelowLink(updatedContent, link, `### Transcription for ${link}\n${text}`);
                            }
                        }
                    }
                    await this.app.vault.modify(activeFile, updatedContent);
                }
            }).open();
        }
    }
    

    async handleFileMenuTranscription(audioFile: TFile) {
        if (this.settings.transcribeToNewNote) {
            await this.processSingleAudioFile(audioFile.path, true);
        } else {
            await this.processSingleAudioFile(audioFile.path, false);
        }
    }

    async processSingleAudioFile(link: string, transcribeToNewNote: boolean) {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file found!');
            return;
        }
    
        let fileContent = await this.app.vault.read(activeFile);
    
        const text = await this.transcribeSingleAudioFile(link);
        if (!text) return;
    
        if (transcribeToNewNote) {
            const newFileLink = await this.createTranscriptionNoteWithUniqueName(text, link, activeFile);
            if (newFileLink && this.settings.addLinkToOriginalFile) {
                fileContent = this.insertTextBelowLink(fileContent, link, `### Link to transcription for ${link}\n[[${newFileLink.name}]]`);
                await this.app.vault.modify(activeFile, fileContent);
            }
        } else {
            fileContent = this.insertTextBelowLink(fileContent, link, `### Transcription for ${link}\n${text}`);
            await this.app.vault.modify(activeFile, fileContent);
            new Notice(`Transcription added to active note for file: ${link}`);
        }
    }
    
    insertTextBelowLink(content: string, link: string, textToInsert: string): string {
        const regex = new RegExp(`(!\\[\\[${link}\\]\\])`, 'g');
        const match = regex.exec(content);
        if (match) {
            const insertPosition = match.index + match[0].length;
            return content.slice(0, insertPosition) + `\n${textToInsert}\n` + content.slice(insertPosition);
        }
        return content + `\n${textToInsert}\n`;
    }
    
    

    async transcribeSingleAudioFile(link: string): Promise<string | null> {
        try {
            const audioFile = this.app.vault.getAbstractFileByPath(link);
            if (!audioFile || !(audioFile instanceof TFile)) {
                new Notice(`Audio file not found: ${link}`);
                return null;
            }
            const audioBuffer = await this.app.vault.readBinary(audioFile);
            return await this.transcribeAudio(audioBuffer, audioFile.name);
        } catch (error) {
            new Notice(`An error occurred during transcription for file: ${link}`);
            console.error(`Error during transcription for file: ${link}`, error);
            return null;
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

    async createTranscriptionNoteWithUniqueName(text: string, audioFileName: string, activeFile: TFile): Promise<TFile | null> {
        if (!activeFile.parent) {
            new Notice('Active file has no parent.');
            return null;
        }
    
        let fileName = `${audioFileName} Transcription`;
        let filePath = normalizePath(`${activeFile.parent.path}/${fileName}.md`);
        while (await this.app.vault.adapter.exists(filePath)) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            fileName = `${audioFileName} Transcription ${timestamp}`;
            filePath = normalizePath(`${activeFile.parent.path}/${fileName}.md`);
        }
    
        try {
            let content = `### Transcription for ${audioFileName}\n${text}`;
    
            // Check if the embedAudioLink setting is enabled
            if (this.settings.embedAudioLink) {
                content = `![[${audioFileName}]]\n\n` + content;
            }
    
            await this.app.vault.create(filePath, content);
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file && file instanceof TFile) {
                const newLeaf = this.app.workspace.getLeaf(true);
                await newLeaf.openFile(file);
                return file;
            } else {
                console.error('Failed to open transcription note:', filePath);
                return null;
            }
        } catch (error) {
            new Notice('Failed to create transcription note.');
            console.error('Error creating transcription note:', error);
            return null;
        }
    }
    
    

    async loadSettings() {
        this.settings = Object.assign({
            apiKey: '',
            transcribeToNewNote: false,
            addLinkToOriginalFile: true
        }, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
    
    onunload() {
        console.log('Unloading Audio to Text plugin');
    }
}

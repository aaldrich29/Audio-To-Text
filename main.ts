import { error } from 'console';
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
        const result = await this.getActiveFileContent();
        if (!result) return;
    
        const { file, content } = result;
        const audioFileLinks = this.extractAudioFileLinks(content);
        if (audioFileLinks.length === 0) {
            new Notice('No audio links found in the note!');
            return;
        }
    
        if (audioFileLinks.length === 1) {
            const resolvedPath = this.resolveFullPath(audioFileLinks[0]); // Resolve full path
            let fileName, filePath
            if(resolvedPath){
                let {fileName, filePath} = resolvedPath
                await this.processSingleAudioFile(filePath, transcribeToNewNote);
            }
        } else {
            //Multiple audio files = Modal
            new AudioFileSelectionModal({
                app: this.app,
                audioFiles: audioFileLinks,
                onSelect: async (selectedFiles) => {
                    let updatedContent = content;
                    for (const link of selectedFiles) {
                        const resolvedPath = this.resolveFullPath(link); // Resolve full path
                        
                        if (resolvedPath) {
                            let { fileName, filePath } = resolvedPath;
                            let text = await this.transcribeSingleAudioFile(filePath);
                            if (text) {
                                if (transcribeToNewNote) {
                                    const newFileLink = await this.createTranscriptionNoteWithUniqueName(text, fileName, file);
                                    if (newFileLink && this.settings.addLinkToOriginalFile) {
                                        updatedContent = this.insertTextBelowLink(updatedContent, link, `### Link to transcription for ${fileName}\n[[${newFileLink.name}]]`);
                                    }
                                } else {
                                    updatedContent = this.insertTextBelowLink(updatedContent, link, `### Transcription for ${fileName}${this.settings.tag ? `\n${this.settings.tag}` : ''}\n${text}`);
                                }
                            }
                          } else {
                            // Handle the case where resolvedPath is null
                            console.error('Failed to resolve path');
                          }

                    }
                    await this.modifyFileContent(file, updatedContent);
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
        const result = await this.getActiveFileContent();
        if (!result) return;
        const { file, content } = result;
        const resolvedPath = this.resolveFullPath(link);

        if (resolvedPath) {
          let { fileName, filePath } = resolvedPath;
          // Use fileName and filePath here
          const text = await this.transcribeSingleAudioFile(filePath);
          if (!text) return;
          //console.log(link)
          let updatedContent = content;
          if (transcribeToNewNote) {
              const newFileLink = await this.createTranscriptionNoteWithUniqueName(text, fileName, file);
              if (newFileLink && this.settings.addLinkToOriginalFile) {
                  updatedContent = this.insertTextBelowLink(updatedContent, fileName, `### Link to transcription for ${fileName}\n[[${newFileLink.name}]]`);
              }
          } else {
              updatedContent = this.insertTextBelowLink(updatedContent, fileName, `### Transcription for ${fileName}${this.settings.tag ? `\n${this.settings.tag}` : ''}\n${text}`);
              new Notice(`Transcription added to active note for file: ${fileName}`);
          }
          await this.modifyFileContent(file, updatedContent);
        } else {
          // Handle the case where resolvedPath is null
          console.error('Failed to resolve path');
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
            const text = await this.transcribeAudio(audioBuffer, audioFile.name);

            if(this.settings.postProcess){
                return await this.postProcessText(text);
            } else {
                return text;
            }
            
        } catch (error) {
            new Notice(`An error occurred during transcription for file: ${link}`);
            console.error(`Error during transcription for file: ${link}`, error);
            return null;
        }
    }


    async postProcessText(text: string): Promise<string> {
        const notice = new Notice("Post-Processing...",0)
        const apiKey = this.settings.apiKey;
        const instructions = "You assist in cleaning up transcribed audio files. Please make this readable, adding paragraphs and editing punctuation as needed. " + this.settings.postProcessInstructions;

    
        const payload = {
            model: this.settings.postProcessModel,
            messages: [
                { role: "system", content: instructions },
                { role: "user", content: text }
            ]
        };
    
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });
    
        if (!response.ok) {
            throw new Error(`Error: ${response.status} ${response.statusText}`);
        }
    
        const data = await response.json();
        notice.hide()
        return data.choices[0].message.content;
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
            const notice = new Notice(`Transcribing ${fileName}...`, 0);
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
            notice.hide();
            if (!response.ok) {
                const errorText = await response.text();
                console.error(errorText);
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
            let content = `### Transcription for ${audioFileName}${this.settings.tag ? `\n${this.settings.tag}` : ''}\n${text}`;
    
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
    
    async getActiveFileContent(): Promise<{ file: TFile, content: string } | null> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file found!');
            return null;
        }
        const content = await this.app.vault.read(activeFile);
        return { file: activeFile, content };
    }
    async modifyFileContent(file: TFile, content: string) {
        await this.app.vault.modify(file, content);
    }
    
    resolveFullPath(link: string): { fileName: string; filePath: string } | null {
        // Check if the link is already a full path
        if(this.fileExists(link)){ 
            //If valid path
            const extractedName = link.split('/').pop() || link;
            const extractedPath = link
            return { fileName: extractedName, filePath: extractedPath };
        } else {

            //Not a valid path so we have to find it.
            const files = this.app.vault.getFiles();
            const matchedFile = files.find(file => file.name === link);
            let extractedPath
            if(!matchedFile){
                console.error('Could not extract path');
                extractedPath = '';
            } else {
                extractedPath = matchedFile.path;
            }
            return { fileName: link, filePath: extractedPath };

          }

    }

    fileExists(filePath: string) {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        return file !== null;
    }

    async loadSettings() {
        this.settings = Object.assign({
            apiKey: '',
            transcribeToNewNote: false,
            addLinkToOriginalFile: true,
            tag: '#transcription',
            postProcess: false,
            postProcessModel: "gpt-4o"
        }, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
    
    onunload() {
       // console.log('Unloading Audio to Text plugin');
    }
}

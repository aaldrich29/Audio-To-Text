import AudioToTextPlugin from './AudioToTextPlugin';
import { App, PluginSettingTab, Setting } from 'obsidian';

export class AudioToTextSettingTab extends PluginSettingTab {
    private plugin: AudioToTextPlugin;

    constructor(app: App, plugin: AudioToTextPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
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
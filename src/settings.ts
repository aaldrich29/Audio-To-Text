import AudioToTextPlugin from 'main';
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
            .setName('Context menu: transcribe to new note')
            .setDesc('Transcribe audio to a new note instead of the current note when you right-click an audio file link and choose transcribe.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.transcribeToNewNote)
                .onChange(async (value) => {
                    this.plugin.settings.transcribeToNewNote = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Add link to original file')
            .setDesc('Add a link to the new transcription file in the original file.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.addLinkToOriginalFile)
                .onChange(async (value) => {
                    this.plugin.settings.addLinkToOriginalFile = value;
                    await this.plugin.saveSettings();
                }));
        new Setting(containerEl)
            .setName('Embed audio link')
            .setDesc('Embed a link to the audio file at the top of the transcription note.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.embedAudioLink) // Added this line
                .onChange(async (value) => {
                    this.plugin.settings.embedAudioLink = value;
                    await this.plugin.saveSettings();
                }));
        new Setting(containerEl)
            .setName('Add tag to transcription')
            .setDesc('Add a tag near the title of the transcription.')
            .addText(text => text
                .setPlaceholder('#transcription')
                .setValue(this.plugin.settings.tag || '')
                .onChange(async (value) => {
                    this.plugin.settings.tag = value;
                    await this.plugin.saveSettings();
                }))
        new Setting(containerEl)
        .setName('Post-process with GPT')
        .setDesc('Run the transcibed text through GPT-4o to clean it up.')
        .addToggle(toggle => toggle
            .setValue(this.plugin.settings.postProcess) // Added this line
            .onChange(async (value) => {
                this.plugin.settings.postProcess = value;
                await this.plugin.saveSettings();
            }));
        new Setting(containerEl)
        .setName('Post-process model')
        .setDesc('Send your transcribed audio through GPT to add paragraphs and other cleanup.')
        .addDropdown(dropdown => {
            dropdown.addOption('gpt-3.5-turbo',"GPT 3.5 Turbo (Cheap)");
            dropdown.addOption('gpt-4o',"GPT 4o (Best)");
            dropdown.setValue(this.plugin.settings.postProcessModel);
            dropdown.onChange(async (value) => {
                this.plugin.settings.postProcessModel = value;
                await this.plugin.saveSettings();
              });
            });
        new Setting(containerEl)
        .setName('Custom post-processing instructions')
        .setDesc('Add additional instructions like custom spellings for post-processing.')
        .addText(text => text
            .setPlaceholder('Please make sure my name is spelled correctly, it starts with M as in Mancy.')
            .setValue(this.plugin.settings.postProcessInstructions || '')
            .onChange(async (value) => {
                this.plugin.settings.postProcessInstructions = value;
                await this.plugin.saveSettings();
            }));
                
    }
}

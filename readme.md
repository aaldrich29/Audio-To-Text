# Audio to Text

Audio to Text is a plugin for Obsidian that transcribes audio files into text using the OpenAI Whisper API. This plugin supports various audio file formats and provides flexible options for transcribing audio to new notes or appending to existing notes. Works extremely well with Obsidian's built in audio recorder.

## Features

- Transcribe audio files directly within Obsidian.
- Support for multiple audio file formats: `mp3`, `webm`, `wav`, `ogg`, `m4a`.
- Transcribe audio to a new note or append to the current note.
- Interactive selection dialog for multiple audio files.
- Context menu integration for quick transcription.
- Transcribe multiple audio files in the same note.
- Link to new transcription files from the original note.

https://github.com/aaldrich29/Audio-To-Text/assets/3700687/f28f1923-7c1e-4e53-8307-fd8d0cb69b4f



## Installation

1. Download the latest release from the [GitHub releases page](https://github.com/aaldrich29/Audio-To-Text/releases).
2. Extract the contents to your Obsidian vault's plugins directory:
<your-vault>/.obsidian/plugins/audio-to-text

3. Enable the plugin in Obsidian:
- Go to `Settings` > `Community plugins` > `Manage plugins`.
- Find `Audio to Text` and enable it.

## Usage

### Setting Up

1. Go to `Settings` > `Audio to Text Settings`.
2. Enter your OpenAI API key.

### Transcribing Audio Files

#### Command Palette

1. Open the command palette (Ctrl+P or Cmd+P).
2. Run the command `Add Transcription to New Notes` to transcribe audio files linked in the current note.
- If there is only one audio file link, it will be transcribed directly.
- If there are multiple audio files, an interactive selection dialog will appear.

#### Adding Transcription to Active Note

1. Open the command palette (Ctrl+P or Cmd+P).
2. Run the command `Add Transcription to Active Note` to transcribe audio files and append the transcription to the current note.
- If there is only one audio file link, it will be transcribed directly.
- If there are multiple audio files, an interactive selection dialog will appear.

#### Context Menu

1. Right-click on an audio file link in your note.
2. Select `Transcribe Audio File` to transcribe the selected audio file.
- The transcription will either be added to a new note or the current note based on the plugin settings.


https://github.com/aaldrich29/Audio-To-Text/assets/3700687/49b5f112-4431-4b41-beab-9fde969ab260


### Settings

1. Go to `Settings` > `Audio to Text Settings`.
2. Configure the following options:
- **OpenAI API Key**: Enter your OpenAI API key.
- **Transcribe to New Note**: Toggle whether to transcribe audio to a new note or append to the current note.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

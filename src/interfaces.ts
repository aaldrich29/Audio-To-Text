import { App } from 'obsidian';

export interface AudioToTextSettings {
    apiKey: string;
    transcribeToNewNote: boolean;
    addLinkToOriginalFile: boolean;
    embedAudioLink: boolean;
}

export interface AudioFileSelectionModalProps {
    app: App;
    audioFiles: string[];
    onSelect: (selectedFiles: string[]) => void;
}
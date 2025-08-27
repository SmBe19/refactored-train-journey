import { ChangeDetectionStrategy, Component, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { FileParserService } from '../services/file-parser.service';

interface UiFile {
  fileName: string;
  text: string;
}

@Component({
  selector: 'app-file-drop',
  // standalone by default (do not set standalone: true)
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'file-drop',
    role: 'region',
    'aria-label': 'Load train line files and a topography file',
  },
  template: `
    <div class="file-drop__row">
      <label class="file-drop__label" for="trainLineInput">Train line files</label>
      <input
        id="trainLineInput"
        class="file-drop__input"
        type="file"
        multiple
        accept=".txt,.train,.yml,.yaml,.md"
        (change)="onTrainFilesChange($event)"
        aria-describedby="trainLineHelp"
      />
      <div id="trainLineHelp" class="file-drop__help">
        Select one or more train line files (with YAML frontmatter and body).
      </div>
      @if (trainFiles().length > 0) {
        <ul class="file-drop__list" role="list" aria-label="Selected train line files">
          @for (f of trainFiles(); track f.fileName) {
            <li class="file-drop__item">{{ f.fileName }}</li>
          }
        </ul>
      }
    </div>

    <div class="file-drop__row">
      <label class="file-drop__label" for="topographyInput">Topography file</label>
      <input
        id="topographyInput"
        class="file-drop__input"
        type="file"
        accept=".txt,.topo"
        (change)="onTopographyChange($event)"
        aria-describedby="topographyHelp"
      />
      <div id="topographyHelp" class="file-drop__help">
        Select the topography file (list of stops, one per line).
      </div>
      @if (topographyFile()) {
        <div class="file-drop__single">{{ topographyFile()!.fileName }}</div>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; border: 1px dashed #bdbdbd; border-radius: 8px; padding: .75rem; margin-bottom: 1rem; }
      .file-drop__row { margin-bottom: .75rem; }
      .file-drop__label { display: block; font-weight: 600; margin-bottom: .25rem; }
      .file-drop__input { display: block; }
      .file-drop__help { font-size: .85rem; color: #555; margin-top: .25rem; }
      .file-drop__list { margin: .25rem 0 0; padding-left: 1rem; }
      .file-drop__item { list-style: disc; }
      .file-drop__single { margin-top: .25rem; }
    `,
  ],
})
export class FileDropComponent {
  private readonly parser = inject(FileParserService);

  protected readonly trainFiles: WritableSignal<UiFile[]> = signal<UiFile[]>([]);
  protected readonly topographyFile: WritableSignal<UiFile | null> = signal<UiFile | null>(null);

  private updateService(): void {
    this.parser.setInputs({
      trainLineFiles: this.trainFiles().map((f) => ({ fileName: f.fileName, text: f.text })),
      topographyFile: this.topographyFile() ? { fileName: this.topographyFile()!.fileName, text: this.topographyFile()!.text } : undefined,
    });
  }

  async onTrainFilesChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    const readPromises = files.map(async (file) => ({ fileName: file.name, text: await file.text() }));
    const loaded = await Promise.all(readPromises);
    this.trainFiles.set(loaded);
    this.updateService();
  }

  async onTopographyChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) {
      this.topographyFile.set(null);
      this.updateService();
      return;
    }
    const text = await file.text();
    this.topographyFile.set({ fileName: file.name, text });
    this.updateService();
  }
}

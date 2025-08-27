import { ChangeDetectionStrategy, Component, WritableSignal, inject, signal } from '@angular/core';
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
    'aria-label': 'Load train line files and a topology file',
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
        Select one or more train line files (with YAML frontmatter and body). You can also drag and drop files onto the drop zone below.
      </div>
      <div
        class="drop-zone"
        [class.drop-zone--active]="dragActiveTrain()"
        tabindex="0"
        role="group"
        aria-label="Drop train line files here"
        (dragover)="onDragOver($event)"
        (dragenter)="onDragEnter($event, 'train')"
        (dragleave)="onDragLeave($event, 'train')"
        (drop)="onDropTrainLines($event)"
      >
        <p class="drop-zone__text">Drop train line files here</p>
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
      <label class="file-drop__label" for="topologyInput">Topology file</label>
      <input
        id="topologyInput"
        class="file-drop__input"
        type="file"
        accept=".txt,.topo"
        (change)="onTopologyChange($event)"
        aria-describedby="topologyHelp"
      />
      <div id="topologyHelp" class="file-drop__help">
        Select the topology file (list of stops, one per line). You can also drag and drop it onto the drop zone below.
      </div>
      <div
        class="drop-zone"
        [class.drop-zone--active]="dragActiveTopo()"
        tabindex="0"
        role="group"
        aria-label="Drop topology file here"
        (dragover)="onDragOver($event)"
        (dragenter)="onDragEnter($event, 'topo')"
        (dragleave)="onDragLeave($event, 'topo')"
        (drop)="onDropTopology($event)"
      >
        <p class="drop-zone__text">Drop topology file here</p>
      </div>
      @if (topologyFile()) {
        <div class="file-drop__single">{{ topologyFile()!.fileName }}</div>
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
      .drop-zone { margin-top: .5rem; border: 2px dashed #9e9e9e; border-radius: 6px; padding: .75rem; text-align: center; background: #fafafa; }
      .drop-zone--active { border-color: #1976d2; background: #e3f2fd; }
      .drop-zone__text { margin: 0; color: #555; }
    `,
  ],
})
export class FileDropComponent {
  private readonly parser = inject(FileParserService);

  protected readonly trainFiles: WritableSignal<UiFile[]> = signal<UiFile[]>([]);
  protected readonly topologyFile: WritableSignal<UiFile | null> = signal<UiFile | null>(null);

  // local UI state for drag highlight
  protected readonly dragActiveTrain = signal(false);
  protected readonly dragActiveTopo = signal(false);

  private updateService(): void {
    this.parser.setInputs({
      trainLineFiles: this.trainFiles().map((f) => ({ fileName: f.fileName, text: f.text })),
      topologyFile: this.topologyFile() ? { fileName: this.topologyFile()!.fileName, text: this.topologyFile()!.text } : undefined,
    });
  }

  async onTrainFilesChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    await this.readAndSetTrainFiles(files);
  }

  async onTopologyChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) {
      this.topologyFile.set(null);
      this.updateService();
      return;
    }
    await this.readAndSetTopology(file);
  }

  onDragOver(ev: DragEvent): void {
    ev.preventDefault();
  }

  onDragEnter(ev: DragEvent, kind: 'train' | 'topo'): void {
    ev.preventDefault();
    if (kind === 'train') this.dragActiveTrain.set(true);
    else this.dragActiveTopo.set(true);
  }

  onDragLeave(ev: DragEvent, kind: 'train' | 'topo'): void {
    ev.preventDefault();
    if (kind === 'train') this.dragActiveTrain.set(false);
    else this.dragActiveTopo.set(false);
  }

  async onDropTrainLines(ev: DragEvent): Promise<void> {
    ev.preventDefault();
    this.dragActiveTrain.set(false);
    const dt = ev.dataTransfer;
    if (!dt) return;
    const files = Array.from(dt.files ?? []);
    await this.readAndSetTrainFiles(files);
  }

  async onDropTopology(ev: DragEvent): Promise<void> {
    ev.preventDefault();
    this.dragActiveTopo.set(false);
    const dt = ev.dataTransfer;
    if (!dt) return;
    const file = (dt.files && dt.files[0]) ?? null;
    if (!file) return;
    await this.readAndSetTopology(file);
  }

  private async readAndSetTrainFiles(files: File[]): Promise<void> {
    const readPromises = files.map(async (file) => ({ fileName: file.name, text: await file.text() }));
    const loaded = await Promise.all(readPromises);
    this.trainFiles.set(loaded);
    this.updateService();
  }

  private async readAndSetTopology(file: File): Promise<void> {
    const text = await file.text();
    this.topologyFile.set({ fileName: file.name, text });
    this.updateService();
  }
}

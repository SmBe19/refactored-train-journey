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
        Select one or more train line files (with YAML frontmatter and body). You can also drag and drop files onto the drop zone below or add a pasted entry.
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

      <div class="file-drop__actions">
        <button type="button" class="btn" (click)="onAddPastedTrain()">Add pasted train line</button>
      </div>

      @if (trainFiles().length > 0) {
        <ul class="file-drop__list" role="list" aria-label="Selected or pasted train line files">
          @for (f of trainFiles(); track f.fileName; let i = $index) {
            <li class="file-drop__item">
              <div class="file-drop__file-head">
                <span class="file-drop__name">{{ f.fileName }}</span>
                <button type="button" class="link" (click)="onRemoveTrain(i)" aria-label="Remove {{ f.fileName }}">Remove</button>
              </div>
              <textarea
                class="file-drop__textarea"
                [value]="f.text"
                (input)="onTrainTextInput(i, $event)"
                rows="6"
                aria-label="Edit contents of {{ f.fileName }}"
              ></textarea>
            </li>
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
        Select the topology file (list of stops, one per line). You can also drag and drop it below or paste/edit directly.
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

      <div class="file-drop__topo">
        <div class="file-drop__file-head">
          <span class="file-drop__name">{{ topologyFile()?.fileName ?? 'pasted-topology.txt' }}</span>
          <button type="button" class="link" (click)="onClearTopology()" aria-label="Clear topology">Clear</button>
        </div>
        <textarea
          class="file-drop__textarea"
          [value]="topologyFile()?.text ?? ''"
          (input)="onTopologyTextInput($event)"
          rows="6"
          aria-label="Edit topology contents"
        ></textarea>
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; border: 1px dashed #bdbdbd; border-radius: 8px; padding: .75rem; margin-bottom: 1rem; }
      .file-drop__row { margin-bottom: .75rem; }
      .file-drop__label { display: block; font-weight: 600; margin-bottom: .25rem; }
      .file-drop__input { display: block; }
      .file-drop__help { font-size: .85rem; color: #555; margin-top: .25rem; }
      .file-drop__actions { margin-top: .5rem; }
      .btn { padding: .25rem .5rem; border: 1px solid #1976d2; background: #e3f2fd; border-radius: 4px; color: #0d47a1; cursor: pointer; }
      .btn:hover { background: #bbdefb; }
      .link { background: none; border: none; color: #1976d2; cursor: pointer; text-decoration: underline; padding: 0; }
      .file-drop__list { margin: .5rem 0 0; padding: 0; list-style: none; }
      .file-drop__item { margin-bottom: .5rem; }
      .file-drop__file-head { display: flex; align-items: center; gap: .5rem; margin-bottom: .25rem; }
      .file-drop__name { font-weight: 600; }
      .file-drop__single { margin-top: .25rem; }
      .file-drop__textarea { width: 100%; box-sizing: border-box; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; }
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

  onAddPastedTrain(): void {
    const count = this.trainFiles().length + 1;
    const newFile: UiFile = { fileName: `pasted-train-${count}.txt`, text: '' };
    this.trainFiles.update((arr) => [...arr, newFile]);
    this.updateService();
  }

  onRemoveTrain(index: number): void {
    this.trainFiles.update((arr) => arr.filter((_, i) => i !== index));
    this.updateService();
  }

  onTrainTextChange(index: number, value: string): void {
    this.trainFiles.update((arr) => arr.map((f, i) => (i === index ? { ...f, text: value } : f)));
    this.updateService();
  }

  onTrainTextInput(index: number, event: Event): void {
    const value = (event.target as HTMLTextAreaElement | null)?.value ?? '';
    this.onTrainTextChange(index, value);
  }

  onTopologyTextChange(value: string): void {
    const fileName = this.topologyFile()?.fileName ?? 'pasted-topology.txt';
    this.topologyFile.set({ fileName, text: value });
    this.updateService();
  }

  onTopologyTextInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement | null)?.value ?? '';
    this.onTopologyTextChange(value);
  }

  onClearTopology(): void {
    this.topologyFile.set({ fileName: 'pasted-topology.txt', text: '' });
    this.updateService();
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

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
    <div class="file-drop__toggle">
      <button type="button" class="btn" (click)="toggleControls()" [attr.aria-expanded]="showControls()">
        {{ showControls() ? 'Hide upload controls' : 'Show upload controls' }}
      </button>
    </div>
    <div class="file-drop__row" [hidden]="!showControls()">
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
        <button type="button" class="btn" (click)="onAddPastedTrain()">Add train line</button>
        <button type="button" class="btn" (click)="onLoadSamples()" aria-label="Load sample files">Load sample files</button>
      </div>
    </div>

    @if (trainFiles().length > 0) {
      <ul class="file-drop__list" role="list" aria-label="Selected or pasted train line files">
        @for (f of trainFiles(); track f.fileName; let i = $index) {
          <li class="file-drop__item">
            <div class="file-drop__file-head">
              <input
                type="text"
                class="file-drop__name-input"
                [value]="f.fileName"
                (input)="onTrainNameInput(i, $event)"
                aria-label="Rename file {{ f.fileName }}"
              />
              <button type="button" class="link" (click)="toggleTrainCollapsed(i)" [attr.aria-expanded]="!isTrainCollapsed(i)">
                {{ isTrainCollapsed(i) ? 'Expand' : 'Collapse' }}
              </button>
              <button type="button" class="link" (click)="onRemoveTrain(i)" aria-label="Remove {{ f.fileName }}">Remove</button>
            </div>
            @if (!isTrainCollapsed(i)) {
              <textarea
                class="file-drop__textarea"
                [value]="f.text"
                (input)="onTrainTextInput(i, $event)"
                rows="6"
                aria-label="Edit contents of {{ f.fileName }}"
              ></textarea>
            }
          </li>
        }
      </ul>
    }

    <div class="file-drop__row" [hidden]="!showControls()">
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
    </div>

    <div class="file-drop__topo">
      <div class="file-drop__file-head">
        <input
          type="text"
          class="file-drop__name-input"
          [value]="topologyFile()?.fileName ?? 'topology.txt'"
          (input)="onTopologyNameInput($event)"
          aria-label="Rename topology file"
        />
        <button type="button" class="link" (click)="toggleTopoCollapsed()" [attr.aria-expanded]="!topoCollapsed()">
          {{ topoCollapsed() ? 'Expand' : 'Collapse' }}
        </button>
        <button type="button" class="link" (click)="onClearTopology()" aria-label="Clear topology">Clear</button>
      </div>
      @if (!topoCollapsed()) {
        <textarea
          class="file-drop__textarea"
          [value]="topologyFile()?.text ?? ''"
          (input)="onTopologyTextInput($event)"
          rows="6"
          aria-label="Edit topology contents"
        ></textarea>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; border: 1px dashed #757575; border-radius: 8px; padding: .75rem; margin-bottom: 1rem; }
      .file-drop__row { margin-bottom: .75rem; }
      .file-drop__label { display: block; font-weight: 700; margin-bottom: .25rem; color: #111; }
      .file-drop__input { display: block; }
      .file-drop__help { font-size: .9rem; color: #333; margin-top: .25rem; }
      .file-drop__actions { margin-top: .5rem; display: flex; align-items: center; gap: .5rem; }
      .btn {
        padding: .25rem .5rem;
        border: 1px solid #0d47a1;
        background: #1976d2;
        border-radius: 4px;
        color: #fff;
        cursor: pointer;
      }
      .btn:hover { background: #1565c0; }
      .btn:focus-visible { outline: 3px solid #ffab00; outline-offset: 2px; }
      .link { background: none; border: none; color: #0d47a1; cursor: pointer; text-decoration: underline; padding: 0; }
      .link:focus-visible { outline: 3px solid #ffab00; outline-offset: 2px; }
      .file-drop__list { margin: .5rem 0 0; padding: 0; list-style: none; }
      .file-drop__item { margin-bottom: .5rem; }
      .file-drop__file-head { display: flex; align-items: center; gap: .5rem; margin-bottom: .25rem; }
      .file-drop__name { font-weight: 700; color: #111; }
      .file-drop__name-input { font-weight: 700; color: #111; border: 1px solid #ccc; border-radius: 4px; padding: .15rem .35rem; min-width: 140px; }
      .file-drop__name-input:focus-visible { outline: 3px solid #ffab00; outline-offset: 2px; }
      .file-drop__toggle { display: flex; justify-content: flex-start; margin-bottom: .5rem; }
      .file-drop__type { font-size: .75rem; color: #0d47a1; background: #e3f2fd; border: 1px solid #90caf9; padding: 0 .25rem; border-radius: 3px; }
      .file-drop__single { margin-top: .25rem; }
      .file-drop__textarea { width: 100%; box-sizing: border-box; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; }
      .drop-zone { margin-top: .5rem; border: 2px dashed #616161; border-radius: 6px; padding: .75rem; text-align: center; background: #fafafa; }
      .drop-zone--active { border-color: #0d47a1; background: #e3f2fd; }
      .drop-zone:focus-visible { outline: 3px solid #ffab00; outline-offset: 2px; }
      .drop-zone__text { margin: 0; color: #333; }
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

  // UI: collapse controls and individual files
  protected readonly showControls = signal(false); // collapsed by default
  private readonly collapsedTrains = signal<Set<number>>(new Set());
  protected readonly topoCollapsed = signal<boolean>(true);

  protected toggleControls(): void {
    this.showControls.update((v) => !v);
  }

  protected isTrainCollapsed(index: number): boolean {
    return this.collapsedTrains().has(index);
  }

  protected toggleTrainCollapsed(index: number): void {
    this.collapsedTrains.update((s) => {
      const next = new Set(s);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  protected toggleTopoCollapsed(): void {
    this.topoCollapsed.update((v) => !v);
  }

  private static readonly STORE_KEY = 'train-graph-viewer:v1';
  private static readonly SAMPLE_LINES = ['/samples/local-a.train', '/samples/express-b.train'] as const;
  private static readonly SAMPLE_TOPO = '/samples/topology.txt' as const;

  constructor() {
    // Hydrate from localStorage if present
    try {
      const raw = localStorage.getItem(FileDropComponent.STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { trainFiles?: UiFile[]; topologyFile?: UiFile | null };
        if (Array.isArray(parsed.trainFiles)) {
          // validate shape minimally and strip legacy 'pasted-' prefix from names
          this.trainFiles.set(
            parsed.trainFiles.map((f) => {
              const name = String((f as any).fileName ?? 'train.txt');
              const cleanName = name.replace(/^pasted-/, '');
              return { fileName: cleanName, text: String((f as any).text ?? '') };
            })
          );
        }
        if (parsed.topologyFile && typeof parsed.topologyFile.fileName === 'string' && typeof parsed.topologyFile.text === 'string') {
          const topoName = parsed.topologyFile.fileName.replace(/^pasted-/, '');
          this.topologyFile.set({ fileName: topoName, text: parsed.topologyFile.text });
        }
      }
    } catch {
      // ignore storage errors
    }
    // Push hydrated state to the service
    this.updateService();
  }

  private persist(): void {
    try {
      const payload = JSON.stringify({ trainFiles: this.trainFiles(), topologyFile: this.topologyFile() });
      localStorage.setItem(FileDropComponent.STORE_KEY, payload);
    } catch {
      // Swallow storage quota or serialization errors
    }
  }

  private updateService(): void {
    this.parser.setInputs({
      trainLineFiles: this.trainFiles().map((f) => ({ fileName: f.fileName, text: f.text })),
      topologyFile: this.topologyFile() ? { fileName: this.topologyFile()!.fileName, text: this.topologyFile()!.text } : undefined,
    });
    this.persist();
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
    const newFile: UiFile = { fileName: `train-${count}.txt`, text: '' };
    this.trainFiles.update((arr) => [...arr, newFile]);
    this.updateService();
  }

  async onLoadSamples(): Promise<void> {
    // Fetch sample train line files and topology from public/samples and set into UI + service
    try {
      const trainFetches = FileDropComponent.SAMPLE_LINES.map(async (path) => {
        const res = await fetch(path, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to load ${path}`);
        const text = await res.text();
        const fileName = path.split('/').pop() ?? 'train.txt';
        return { fileName, text } satisfies UiFile;
      });
      const topoRes = await fetch(FileDropComponent.SAMPLE_TOPO, { cache: 'no-store' });
      if (!topoRes.ok) throw new Error('Failed to load topology sample');
      const topoText = await topoRes.text();

      const loadedTrains = await Promise.all(trainFetches);
      this.trainFiles.set(loadedTrains);
      this.topologyFile.set({ fileName: 'topology.txt', text: topoText });
      this.updateService();
    } catch {
      // ignore fetch errors for now
    }
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

  onTrainNameChange(index: number, value: string): void {
    const nextName = value.trim() || `train-${index + 1}.txt`;
    this.trainFiles.update((arr) => arr.map((f, i) => (i === index ? { ...f, fileName: nextName } : f)));
    this.updateService();
  }

  onTrainNameInput(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.onTrainNameChange(index, value);
  }

  onTopologyTextChange(value: string): void {
    const fileName = this.topologyFile()?.fileName ?? 'topology.txt';
    this.topologyFile.set({ fileName, text: value });
    this.updateService();
  }

  onTopologyTextInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement | null)?.value ?? '';
    this.onTopologyTextChange(value);
  }

  onTopologyNameChange(value: string): void {
    const name = value.trim() || 'topology.txt';
    const current = this.topologyFile();
    this.topologyFile.set({ fileName: name, text: current?.text ?? '' });
    this.updateService();
  }

  onTopologyNameInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.onTopologyNameChange(value);
  }

  onClearTopology(): void {
    this.topologyFile.set({ fileName: 'topology.txt', text: '' });
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

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

@Component({
  selector: 'app-help-examples',
  // standalone by default (do not set standalone: true)
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'help-examples',
    role: 'region',
    'aria-label': 'File format help and examples',
  },
  template: `
    <div class="help-examples__head">
      <button
        type="button"
        class="help-examples__toggle"
        [attr.aria-expanded]="open()"
        (click)="toggle()"
      >
        {{ open() ? 'Hide' : 'Show' }} file format help
      </button>
      <a class="help-examples__link" href="https://github.com/SmBe19/refactored-train-journey" target="_blank" rel="noopener noreferrer">Open README</a>
    </div>

    @if (open()) {
      <div class="help-examples__content">
        <p class="help-examples__intro">
          Train line files contain a YAML frontmatter with metadata and a body listing stops and segment travel times. The topology file lists stop names, one per line. You can optionally repeat each run using <code>repeat_runs</code>, spaced by the line <code>period</code>.
        </p>

        <section class="help-examples__section" aria-labelledby="trainExampleTitle">
          <h4 id="trainExampleTitle" class="help-examples__title">Minimal Train Line example</h4>
          <div class="help-examples__actions">
            <button type="button" class="btn" (click)="copy(trainExample)">Copy</button>
          </div>
          <pre class="help-examples__code"><code>{{ trainExample }}</code></pre>
        </section>

        <section class="help-examples__section" aria-labelledby="topoExampleTitle">
          <h4 id="topoExampleTitle" class="help-examples__title">Minimal Topology example</h4>
          <div class="help-examples__actions">
            <button type="button" class="btn" (click)="copy(topoExample)">Copy</button>
          </div>
          <pre class="help-examples__code"><code>{{ topoExample }}</code></pre>
        </section>

        <p class="help-examples__more">
          See the README for full format details, optional fields like <code>custom_stop_times</code>, <code>repeat_runs</code>, and <code>base_color</code>, and more examples.
        </p>
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; border: 1px solid #e0e0e0; border-radius: 8px; padding: .75rem; margin: .5rem 0 1rem; background: #fafafa; }
      .help-examples__head { display: flex; align-items: center; gap: .75rem; }
      .help-examples__toggle { padding: .25rem .5rem; border: 1px solid #616161; background: #fff; border-radius: 4px; cursor: pointer; }
      .help-examples__toggle:hover { background: #f5f5f5; }
      .help-examples__link { font-size: .9rem; color: #1976d2; }
      .help-examples__content { margin-top: .5rem; }
      .help-examples__title { margin: .5rem 0 .25rem; font-size: .95rem; }
      .help-examples__actions { margin: .25rem 0; }
      .btn { padding: .25rem .5rem; border: 1px solid #1976d2; background: #e3f2fd; border-radius: 4px; color: #0d47a1; cursor: pointer; }
      .btn:hover { background: #bbdefb; }
      .help-examples__code { margin: 0; white-space: pre-wrap; background: #272822; color: #f8f8f2; padding: .5rem; border-radius: 6px; overflow: auto; }
      .help-examples__intro, .help-examples__more { color: #424242; }
    `,
  ],
})
export class HelpExamplesComponent {
  protected readonly open = signal(false);

  protected readonly trainExample: string = `---
name: Local A
default_stop_time: 00:00:30
period: 01:00:00
runs:
  - 06:00
  - 06:30
repeat_runs: 1  # repeats each run once more at start+period
base_color: 1F77B4
custom_stop_times:
  Meadow: 00:00:30
  Meadow#2: 00:01:00
---
Central
02:00
East Side
02:30
Meadow
01:45
Hilltop
01:45
Meadow
02:30
East Side
02:00
Central`;

  protected readonly topoExample: string = `# Topology: one stop per line
Central
East Side
Meadow
Hilltop`;

  toggle(): void {
    this.open.update((v) => !v);
  }

  async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore clipboard errors (permissions / insecure origin)
    }
  }
}

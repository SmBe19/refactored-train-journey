import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FileParserService } from '../services/file-parser.service';

@Component({
  selector: 'app-error-list',
  // standalone by default (do not set standalone: true)
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'error-list',
    role: 'region',
    'aria-live': 'polite',
    'aria-label': 'Parsing and validation messages',
  },
  template: `
    @if (errors().length === 0) {
      <p class="error-list__empty" aria-live="polite">No errors</p>
    } @else {
      <ul class="error-list__items" role="list">
        @for (e of errors(); track $index) {
          <li class="error-list__item">
            <span class="error-list__file">{{ e.file }}</span>
            @if (e.line !== undefined) {
              <span class="error-list__line">:{{ e.line }}</span>
            }
            <span class="error-list__sep"> — </span>
            <span class="error-list__message">{{ e.message }}</span>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      :host { display: block; border: 1px solid #e0e0e0; border-radius: 6px; padding: .5rem .75rem; }
      .error-list__empty { color: #2e7d32; }
      .error-list__items { margin: 0; padding: 0; list-style: none; }
      .error-list__item { padding: .25rem 0; }
      .error-list__file { font-weight: 600; }
      .error-list__line { color: #555; }
      .error-list__sep { color: #999; }
      .error-list__message { }
    `,
  ],
})
export class ErrorListComponent {
  private readonly files = inject(FileParserService);
  protected readonly errors = computed(() => this.files.allErrors());
}

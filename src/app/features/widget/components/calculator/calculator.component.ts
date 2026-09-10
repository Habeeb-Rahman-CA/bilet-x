import { Component, HostListener, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type Operator = '+' | '−' | '×' | '÷';

interface CalcButton {
  label: string;
  ariaLabel?: string;
  action: () => void;
  variant: 'digit' | 'operator' | 'action' | 'equals';
  spanTwo?: boolean;
  activeOp?: Operator;
}

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex h-full flex-col space-y-2">
      <!-- Display card: matches the system's note-textarea / settings-card style -->
      <div class="shrink-0 rounded-xl border border-neutral-800 bg-neutral-900/90 p-3">
        <div
          class="flex h-3 items-center justify-end font-mono text-[9px] font-semibold tracking-wider text-neutral-500 uppercase"
        >
          <span *ngIf="expressionLabel(); else readyLabel" [title]="expressionLabel()">
            {{ expressionLabel() }}
          </span>
          <ng-template #readyLabel>
            <span class="flex items-center space-x-1.5">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              <span class="text-emerald-400">Ready</span>
            </span>
          </ng-template>
        </div>
        <div
          class="mt-1 text-right font-mono text-[22px] leading-none font-semibold text-neutral-100 tabular-nums"
          [title]="display()"
        >
          {{ display() }}
        </div>
      </div>

      <!-- Button grid — same button vocabulary as settings toggles -->
      <div class="grid flex-1 grid-cols-4 gap-1.5 font-mono">
        <button
          *ngFor="let b of buttons; trackBy: trackByLabel"
          type="button"
          (click)="b.action()"
          [attr.aria-label]="b.ariaLabel || b.label"
          class="flex items-center justify-center rounded-lg border border-transparent text-[13px] transition-all duration-200 ease-out"
          [ngClass]="{
            'col-span-2': b.spanTwo,
            'bg-neutral-800 text-neutral-100 hover:border-neutral-600 hover:text-white':
              b.variant === 'digit',
            'bg-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-white':
              b.variant === 'action',
            'bg-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white':
              b.variant === 'operator' && b.activeOp !== pendingOp(),
            'bg-white text-black hover:border-neutral-300 hover:text-black':
              (b.variant === 'operator' && b.activeOp === pendingOp()) ||
              b.variant === 'equals'
          }"
        >
          {{ b.label }}
        </button>
      </div>
    </div>
  `,
})
export class CalculatorComponent {
  public readonly display = signal<string>('0');
  public readonly pendingOp = signal<Operator | null>(null);
  private readonly previousValue = signal<number | null>(null);
  private readonly justEvaluated = signal<boolean>(false);
  private readonly hasError = signal<boolean>(false);

  public readonly expressionLabel = computed(() => {
    const prev = this.previousValue();
    const op = this.pendingOp();
    if (prev === null || op === null) return '';
    return `${this.formatNumber(prev)} ${op}`;
  });

  public readonly buttons: CalcButton[] = [
    { label: 'C', ariaLabel: 'Clear', variant: 'action', action: () => this.clear() },
    { label: '⌫', ariaLabel: 'Backspace', variant: 'action', action: () => this.backspace() },
    { label: '%', ariaLabel: 'Percent', variant: 'action', action: () => this.percent() },
    { label: '÷', variant: 'operator', activeOp: '÷', action: () => this.setOperator('÷') },

    { label: '7', variant: 'digit', action: () => this.inputDigit('7') },
    { label: '8', variant: 'digit', action: () => this.inputDigit('8') },
    { label: '9', variant: 'digit', action: () => this.inputDigit('9') },
    { label: '×', variant: 'operator', activeOp: '×', action: () => this.setOperator('×') },

    { label: '4', variant: 'digit', action: () => this.inputDigit('4') },
    { label: '5', variant: 'digit', action: () => this.inputDigit('5') },
    { label: '6', variant: 'digit', action: () => this.inputDigit('6') },
    { label: '−', variant: 'operator', activeOp: '−', action: () => this.setOperator('−') },

    { label: '1', variant: 'digit', action: () => this.inputDigit('1') },
    { label: '2', variant: 'digit', action: () => this.inputDigit('2') },
    { label: '3', variant: 'digit', action: () => this.inputDigit('3') },
    { label: '+', variant: 'operator', activeOp: '+', action: () => this.setOperator('+') },

    { label: '±', ariaLabel: 'Negate', variant: 'action', action: () => this.toggleSign() },
    { label: '0', variant: 'digit', action: () => this.inputDigit('0') },
    { label: '.', variant: 'digit', action: () => this.inputDecimal() },
    { label: '=', variant: 'equals', action: () => this.evaluate() },
  ];

  @HostListener('window:keydown', ['$event'])
  public handleKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }

    const key = event.key;
    if (/^[0-9]$/.test(key)) {
      event.preventDefault();
      this.inputDigit(key);
    } else if (key === '.' || key === ',') {
      event.preventDefault();
      this.inputDecimal();
    } else if (key === '+') {
      event.preventDefault();
      this.setOperator('+');
    } else if (key === '-') {
      event.preventDefault();
      this.setOperator('−');
    } else if (key === '*' || key === 'x' || key === 'X') {
      event.preventDefault();
      this.setOperator('×');
    } else if (key === '/') {
      event.preventDefault();
      this.setOperator('÷');
    } else if (key === '=' || key === 'Enter') {
      event.preventDefault();
      this.evaluate();
    } else if (key === 'Backspace') {
      event.preventDefault();
      this.backspace();
    } else if (key === 'Escape' || key === 'Delete') {
      event.preventDefault();
      this.clear();
    } else if (key === '%') {
      event.preventDefault();
      this.percent();
    }
  }

  private inputDigit(d: string): void {
    if (this.hasError()) this.clear();
    if (this.justEvaluated() || this.display() === '0') {
      this.display.set(d);
      this.justEvaluated.set(false);
      return;
    }
    if (this.display().replace('-', '').replace('.', '').length >= 12) return;
    this.display.set(this.display() + d);
  }

  private inputDecimal(): void {
    if (this.hasError()) this.clear();
    if (this.justEvaluated()) {
      this.display.set('0.');
      this.justEvaluated.set(false);
      return;
    }
    if (!this.display().includes('.')) {
      this.display.set(this.display() + '.');
    }
  }

  private setOperator(op: Operator): void {
    if (this.hasError()) return;
    const current = this.parseDisplay();

    if (this.previousValue() !== null && this.pendingOp() !== null && !this.justEvaluated()) {
      const result = this.compute(this.previousValue()!, current, this.pendingOp()!);
      if (result === null) return;
      this.previousValue.set(result);
      this.display.set(this.formatNumber(result));
    } else {
      this.previousValue.set(current);
    }

    this.pendingOp.set(op);
    this.justEvaluated.set(true);
  }

  private evaluate(): void {
    if (this.hasError()) return;
    const prev = this.previousValue();
    const op = this.pendingOp();
    if (prev === null || op === null) return;

    const current = this.parseDisplay();
    const result = this.compute(prev, current, op);
    if (result === null) return;

    this.display.set(this.formatNumber(result));
    this.previousValue.set(null);
    this.pendingOp.set(null);
    this.justEvaluated.set(true);
  }

  private clear(): void {
    this.display.set('0');
    this.previousValue.set(null);
    this.pendingOp.set(null);
    this.justEvaluated.set(false);
    this.hasError.set(false);
  }

  private backspace(): void {
    if (this.hasError()) {
      this.clear();
      return;
    }
    if (this.justEvaluated()) return;
    const s = this.display();
    if (s.length <= 1 || (s.length === 2 && s.startsWith('-'))) {
      this.display.set('0');
    } else {
      this.display.set(s.slice(0, -1));
    }
  }

  private toggleSign(): void {
    if (this.hasError() || this.display() === '0') return;
    this.display.set(
      this.display().startsWith('-') ? this.display().slice(1) : '-' + this.display()
    );
  }

  private percent(): void {
    if (this.hasError()) return;
    const value = this.parseDisplay() / 100;
    this.display.set(this.formatNumber(value));
    this.justEvaluated.set(true);
  }

  private compute(a: number, b: number, op: Operator): number | null {
    let result: number;
    switch (op) {
      case '+':
        result = a + b;
        break;
      case '−':
        result = a - b;
        break;
      case '×':
        result = a * b;
        break;
      case '÷':
        if (b === 0) {
          this.showError();
          return null;
        }
        result = a / b;
        break;
    }
    if (!Number.isFinite(result)) {
      this.showError();
      return null;
    }
    return result;
  }

  private showError(): void {
    this.display.set('Error');
    this.previousValue.set(null);
    this.pendingOp.set(null);
    this.hasError.set(true);
  }

  private parseDisplay(): number {
    const n = parseFloat(this.display());
    return Number.isFinite(n) ? n : 0;
  }

  private formatNumber(n: number): string {
    if (!Number.isFinite(n)) return 'Error';
    const trimmed = parseFloat(n.toPrecision(12));
    let s = trimmed.toString();
    if (s.length > 12) {
      s = trimmed.toExponential(6);
    }
    return s;
  }

  public trackByLabel(_: number, b: CalcButton): string {
    return b.label;
  }
}

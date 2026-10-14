export type Action = 'left' | 'right' | 'up' | 'down' | 'fire' | 'jump' | 'backflip' | 'fine';

const KEYMAP: Record<string, Action> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'fire',
  Enter: 'jump',
  NumpadEnter: 'jump',
  Backspace: 'backflip',
  ShiftLeft: 'fine',
  ShiftRight: 'fine',
};

/** Estado de teclado + botões de toque unificados em "ações". */
export class Input {
  private down = new Set<Action>();
  private pressed = new Set<Action>();
  private released = new Set<Action>();
  private keys: string[] = [];

  constructor() {
    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (a) {
        e.preventDefault();
        if (!e.repeat) this.press(a);
      }
      if (!e.repeat) this.keys.push(e.code);
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.release(a);
    });
    window.addEventListener('blur', () => {
      for (const a of this.down) this.released.add(a);
      this.down.clear();
    });
  }

  press(a: Action): void {
    if (!this.down.has(a)) this.pressed.add(a);
    this.down.add(a);
  }
  release(a: Action): void {
    if (this.down.has(a)) this.released.add(a);
    this.down.delete(a);
  }

  isDown(a: Action): boolean {
    return this.down.has(a);
  }
  wasPressed(a: Action): boolean {
    return this.pressed.has(a);
  }
  wasReleased(a: Action): boolean {
    return this.released.has(a);
  }
  /** códigos de tecla (KeyboardEvent.code) apertados neste frame */
  takeKeys(): string[] {
    const k = this.keys;
    this.keys = [];
    return k;
  }
  endFrame(): void {
    this.pressed.clear();
    this.released.clear();
  }
}

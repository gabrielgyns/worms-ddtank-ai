import { ACHIEVEMENTS, RARITY_NAME, type Achievement, type Rarity } from '../progress/achievements';
import { ACHIEVEMENTS_PER_CHEST, progress } from '../progress/progress';
import { COSMETICS, cosmetic } from '../domain/cosmetics';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

export function rewardText(a: Achievement): string {
  if (a.reward.coins) return `+${a.reward.coins} 🪙`;
  return '🎁 item';
}

/** Tela "Conquistas": todas, por raridade, com o que já foi desbloqueado. */
export class AchievementsUi {
  constructor(private show: (id: string | null) => void) {
    $('#achievements-btn').addEventListener('click', () => this.open());
    progress().on(() => this.chip());
    this.chip();
  }

  private chip(): void {
    const n = Object.keys(progress().state.unlocked).length;
    $('#achievements-btn').textContent = `🏆 ${n}/${ACHIEVEMENTS.length}`;
  }

  open(): void {
    this.render();
    this.show('achievements');
  }

  private render(reveal = ''): void {
    const p = progress();
    const order: Rarity[] = ['facil', 'media', 'dificil', 'lendaria'];
    const n = Object.keys(p.state.unlocked).length;
    const next = ACHIEVEMENTS_PER_CHEST - (n % ACHIEVEMENTS_PER_CHEST);
    const chest = `<div class="chest">
        <span class="chest-icon">${p.chestsAvailable > 0 ? '🎁' : '📦'}</span>
        <span class="txt"><b>${p.chestsAvailable > 0 ? `${p.chestsAvailable} baú${p.chestsAvailable > 1 ? 's' : ''} para abrir!` : 'Baú de conquista'}</b>
        <small>A cada ${ACHIEVEMENTS_PER_CHEST} conquistas: um item que você ainda não tem + 100 🪙. ${p.chestsAvailable > 0 ? '' : `Faltam ${next}.`}</small></span>
        ${p.chestsAvailable > 0 ? '<button id="open-chest">Abrir</button>' : ''}
      </div>${reveal}`;
    $('#achievements-body').innerHTML = chest + order
      .map((r) => {
        const items = ACHIEVEMENTS.filter((a) => a.rarity === r)
          .map((a) => {
            const done = p.isUnlocked(a.id);
            return `<li class="ach ${done ? 'done' : ''}">
              <span class="medal">${done ? '🏆' : '🔒'}</span>
              <span class="txt"><b>${a.name}</b><small>${a.desc}</small></span>
              <span class="rw">${rewardText(a)}</span></li>`;
          })
          .join('');
        return `<span class="lbl rarity-${r}">${RARITY_NAME[r]}</span><ul class="achs">${items}</ul>`;
      })
      .join('');
    $('#open-chest')?.addEventListener('click', () => {
      const shopItems = COSMETICS.filter((c) => c.price !== null).map((c) => c.id);
      const r = p.openChest(shopItems);
      if (!r) return;
      const name = r.item ? (cosmetic(r.item)?.name ?? r.item) : null;
      this.render(`<p class="notice chest-reveal">🎉 ${name ? `<b>${name}</b> + ` : ''}${r.coins} 🪙${name ? ' — vista no Visual!' : ''}</p>`);
    });
  }
}

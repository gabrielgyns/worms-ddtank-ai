import { ACHIEVEMENTS, RARITY_NAME, type Achievement, type Rarity } from '../progress/achievements';
import { progress } from '../progress/progress';

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
    const p = progress();
    const order: Rarity[] = ['facil', 'media', 'dificil', 'lendaria'];
    $('#achievements-body').innerHTML = order
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
    this.show('achievements');
  }
}

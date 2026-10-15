import { MISSIONS, type Mission } from '../domain/missions';
import { WEAPONS } from '../domain/weapons';
import { loadMissionStars, MISSION_REWARD, missionUnlocked, totalMissionStars } from '../progress/missions';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

export function starText(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

function ammoText(m: Mission): string {
  return Object.entries(m.ammo)
    .map(([id, n]) => {
      const w = WEAPONS.find((x) => x.id === id);
      return w ? `${w.name} ×${n}` : '';
    })
    .join(' · ');
}

/** Lista de missões: cada uma abre quando a anterior é cumprida. */
export class MissionsUi {
  constructor(
    private show: (id: string | null) => void,
    private onPlay: (m: Mission) => void,
  ) {
    $('#missions-btn').addEventListener('click', () => this.open());
  }

  open(): void {
    const stars = loadMissionStars();
    const body = $('#missions-body');
    body.innerHTML = '';
    const head = document.createElement('p');
    head.className = 'hint';
    head.textContent = `${totalMissionStars(stars)} de ${MISSIONS.length * 3} ★ — menos tiros, mais estrelas. +${MISSION_REWARD} 🪙 na primeira vez.`;
    body.append(head);
    const list = document.createElement('ul');
    list.className = 'achs missions';
    MISSIONS.forEach((m, i) => {
      const open = missionUnlocked(i, stars);
      const got = stars[m.id] ?? 0;
      const li = document.createElement('li');
      li.className = `ach mission${open ? ' done' : ''}`;
      li.innerHTML = `<span class="medal"></span><span class="txt"><b></b><small></small><small class="ammo"></small></span><span class="rw"></span>`;
      li.querySelector('.medal')!.textContent = open ? String(i + 1) : '🔒';
      li.querySelector('b')!.textContent = m.name;
      li.querySelector('small')!.textContent = open ? m.goal : 'Cumpra a missão anterior para abrir.';
      li.querySelector('.ammo')!.textContent = open ? ammoText(m) : '';
      li.querySelector('.rw')!.textContent = starText(got);
      if (open) {
        li.tabIndex = 0;
        li.setAttribute('role', 'button');
        const go = (): void => this.onPlay(m);
        li.addEventListener('click', go);
        li.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && go());
      }
      list.append(li);
    });
    body.append(list);
    this.show('missions');
  }
}

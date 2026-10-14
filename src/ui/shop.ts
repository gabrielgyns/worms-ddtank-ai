import { SLOT_NAME } from '../domain/cosmetics';
import { progress } from '../progress/progress';
import { dailyShop, type Offer } from '../progress/shop';
import { animatePreview, myLook } from './closet';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

/** Tela "Loja": vitrine do dia, prévia vestida, compra com Bolotins. */
export class ShopUi {
  private selected: Offer | null = null;
  private notice = '';

  constructor(private show: (id: string | null) => void) {
    $('#shop-btn').addEventListener('click', () => this.open());
  }

  open(): void {
    this.selected = null;
    this.notice = '';
    this.render();
    this.show('shop');
  }

  private render(): void {
    const p = progress();
    const offers = dailyShop();
    const sel = this.selected ?? offers[0];
    const owned = p.owns(sel.item.id);
    const body = $('#shop-body');
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const hours = Math.max(1, Math.round((midnight.getTime() - Date.now()) / 3600000));
    body.innerHTML = `
      <div class="shop-top"><span class="chip coin">🪙 ${p.state.coins}</span><span class="hint">Nova vitrine em ${hours}h</span></div>
      <canvas id="shop-preview" class="preview"></canvas>
      <div class="shop-sel">
        <b>${sel.item.name}</b><small>${SLOT_NAME[sel.item.slot]}</small>
        ${
          owned
            ? `<button id="shop-wear">Vestir</button>`
            : `<button id="shop-buy" ${p.state.coins < sel.price ? 'disabled' : ''}>Comprar por ${sel.price} 🪙</button>`
        }
      </div>
      ${this.notice ? `<p class="notice">${this.notice}</p>` : ''}
      <ul class="offers">
        ${offers
          .map(
            (o) => `<li><button data-id="${o.item.id}" class="${o.item.id === sel.item.id ? 'on' : ''}">
              <span>${o.item.name}</span>
              <em>${p.owns(o.item.id) ? 'seu ✔' : `${o.sale ? `<s>${o.item.price}</s> ` : ''}${o.price} 🪙`}</em>
              ${o.sale ? '<i>promo</i>' : ''}
            </button></li>`,
          )
          .join('')}
      </ul>`;
    animatePreview(body.querySelector('#shop-preview')!, { ...myLook(), [sel.item.slot]: sel.item.id }, $('#shop'));
    body.querySelectorAll<HTMLButtonElement>('[data-id]').forEach((b) =>
      b.addEventListener('click', () => {
        this.selected = offers.find((o) => o.item.id === b.dataset.id) ?? null;
        this.notice = '';
        this.render();
      }),
    );
    body.querySelector('#shop-buy')?.addEventListener('click', () => {
      if (p.buy(sel.item.id, sel.price)) {
        p.equip(sel.item.slot, sel.item.id);
        this.notice = `${sel.item.name} é seu! Já está vestindo.`;
      } else this.notice = 'Bolotins insuficientes. Jogue mais um pouco!';
      this.selected = sel;
      this.render();
    });
    body.querySelector('#shop-wear')?.addEventListener('click', () => {
      p.equip(sel.item.slot, sel.item.id);
      this.notice = 'Vestido!';
      this.selected = sel;
      this.render();
    });
  }
}

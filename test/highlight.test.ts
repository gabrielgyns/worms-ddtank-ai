import { describe, expect, it } from 'vitest';
import { AiController } from '../src/domain/ai';
import { isEmptyInput, type Command } from '../src/domain/commands';
import { HighlightRecorder, highlightCommands } from '../src/domain/highlight';
import { Match } from '../src/domain/match';
import { cpuTeam } from './helpers';
import { THEMES } from '../src/domain/theme';

const setup = { teams: [cpuTeam('A'), cpuTeam('B')], unitsPerTeam: 2, theme: THEMES.prado, seed: 7, turnTime: 30 };

describe('melhor lance', () => {
  it('foto + comandos da vez reproduzem o lance exatamente', () => {
    const m = new Match(setup);
    m.start();
    const rec = new HighlightRecorder(m);
    const ais = [new AiController('dificil'), new AiController('dificil')];
    const log: Command[] = [];
    for (let i = 0; i < 60 * 60 * 6 && m.phase !== 'over'; i++) {
      const team = m.activeTeam;
      const input = team ? ais[team.id].decide(m) : {};
      if (!isEmptyInput(input)) log.push({ tick: m.tick, input });
      m.step(input);
      rec.afterStep();
    }
    const h = rec.best;
    expect(h).not.toBeNull();
    expect(h!.damage).toBeGreaterThan(0);
    expect(h!.endTick).toBeGreaterThan(h!.startTick);

    const replay = new Match(setup);
    replay.start();
    replay.restore(h!.snap);
    const cmds = highlightCommands(h!, log);
    let idx = 0;
    while (replay.tick < h!.endTick) {
      const c = cmds[idx];
      if (c && c.tick === replay.tick) idx++;
      replay.step(c && c.tick === replay.tick ? c.input : {});
    }
    expect(replay.checksum()).toBe(h!.endSum);
  });
});

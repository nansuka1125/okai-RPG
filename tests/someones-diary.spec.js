// @ts-check
const { test, expect } = require('@playwright/test');

async function openGame(page) {
  await page.goto('/chapter1.html');
  await page.waitForFunction(() => (
    typeof RPG !== 'undefined' &&
    typeof uiControl !== 'undefined' &&
    typeof explorationSystem !== 'undefined' &&
    typeof battleSystem !== 'undefined' &&
    typeof innSystem !== 'undefined' &&
    typeof Cinematics !== 'undefined'
  ));

  await page.evaluate(() => {
    explorationSystem.cancelActiveTypewriter();
    uiControl.hideFloatingArrow();
    uiControl.disableTapOverlay();

    const freshState = JSON.parse(JSON.stringify(RPG.DefaultState));
    Object.keys(RPG.State).forEach(key => delete RPG.State[key]);
    Object.assign(RPG.State, freshState);
    Object.assign(RPG.State.flags, {
      hasIntroFinished: true,
      metThiefBoy: true,
      thiefDiscoveryStatus: 2,
      giantLarvaDefeated: true,
    });
    Object.assign(RPG.State, {
      mode: 'base',
      dialogueQueue: [],
      isWaitingForInput: false,
      isAtInn: false,
      isInDungeon: true,
      explorationArea: 'forest',
      location: '森の深層',
      currentDistance: 9,
    });
    RPG.State.inventory.someonesDiary = 1;
    RPG.State.larvaCorpseStage = 3;

    const log = document.getElementById('logContainer');
    if (log) log.innerHTML = '';
    const actions = document.getElementById('action-buttons');
    if (actions) {
      actions.innerHTML = '';
      actions.style.display = 'none';
    }
  });
}

async function drainDialogue(page, maxWaitMs = 7000) {
  await page.evaluate(() => {
    RPG.State.debug.isSkipping = true;
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < maxWaitMs) {
    const state = await page.evaluate(() => ({
      mode: RPG.State.mode,
      waiting: RPG.State.isWaitingForInput === true,
      typewriting: explorationSystem.hasActiveTypewriter(),
    }));

    if (state.mode !== 'event') {
      await page.evaluate(() => {
        RPG.State.debug.isSkipping = false;
      });
      return state.mode;
    }

    if (state.waiting || state.typewriting) {
      await page.evaluate(() => uiControl.handlePlayerInput());
    }
    await page.waitForTimeout(25);
  }

  throw new Error('dialogue did not finish before timeout');
}

async function tap(page, times = 1) {
  for (let i = 0; i < times; i++) {
    await page.evaluate(() => uiControl.handlePlayerInput());
  }
}

test.describe('someone\'s diary - reading is available as soon as it is obtained', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
    await page.evaluate(() => {
      RPG.State.flags.someonesDiaryFirstReadDone = false;
    });
  });

  test('40. first read (with no inn stay or unlock of any kind) shows the body followed by the confirmed conversation, in order', async ({ page }) => {
    await page.evaluate(() => explorationSystem.useItem('someonesDiary'));
    await drainDialogue(page);

    const lines = await page.evaluate(() => (
      Array.from(document.querySelectorAll('#logContainer .log-entry')).map(el => el.textContent)
    ));
    const expectedOrder = [
      '新しい日記帳だが、1ページしか書いてない。',
      'ボスはかっこいい。はやくボスにほめられたい。',
      'ボスはフライドチキンが好き。けどフライドチキンを盗んできてもな。',
      'カイン「なんだこれ」',
      'オーエン「フライドチキンが好きなボスがいるんじゃない？」',
      'カイン「…それはわかるが」',
      'カイン（それしかわからない）',
    ];
    let cursor = -1;
    for (const expected of expectedOrder) {
      const idx = lines.indexOf(expected, cursor + 1);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  test('41. completing the first-read queue sets someonesDiaryFirstReadDone', async ({ page }) => {
    await page.evaluate(() => explorationSystem.useItem('someonesDiary'));
    await drainDialogue(page);

    const firstReadDone = await page.evaluate(() => RPG.State.flags.someonesDiaryFirstReadDone);
    expect(firstReadDone).toBe(true);
  });

  test('42. interrupting the first-read queue keeps someonesDiaryFirstReadDone false, and it replays in full next time', async ({ page }) => {
    await page.evaluate(() => explorationSystem.useItem('someonesDiary'));
    await tap(page, 2); // partway through the body, well before the closing action line

    await page.evaluate(() => {
      // Simulate leaving mid-read without finishing the queue.
      RPG.State.mode = 'base';
      RPG.State.dialogueQueue = [];
      RPG.State.isWaitingForInput = false;
    });

    const midInterruptFlag = await page.evaluate(() => RPG.State.flags.someonesDiaryFirstReadDone);
    expect(midInterruptFlag).toBe(false);

    await page.evaluate(() => explorationSystem.useItem('someonesDiary'));
    await drainDialogue(page);
    const lines = await page.evaluate(() => (
      Array.from(document.querySelectorAll('#logContainer .log-entry')).map(el => el.textContent)
    ));
    expect(lines).toContain('カイン「なんだこれ」');
  });

  test('43. once firstReadDone is true, only the 3-line body is shown, no conversation', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.flags.someonesDiaryFirstReadDone = true;
    });
    await page.evaluate(() => explorationSystem.useItem('someonesDiary'));
    await drainDialogue(page);

    const lines = await page.evaluate(() => (
      Array.from(document.querySelectorAll('#logContainer .log-entry')).map(el => el.textContent)
    ));
    expect(lines).toEqual([
      '新しい日記帳だが、1ページしか書いてない。',
      'ボスはかっこいい。はやくボスにほめられたい。',
      'ボスはフライドチキンが好き。けどフライドチキンを盗んできてもな。',
    ]);
  });

  test('44. the diary is never consumed no matter how many times it is read', async ({ page }) => {
    await page.evaluate(() => explorationSystem.useItem('someonesDiary'));
    await drainDialogue(page);
    await page.evaluate(() => explorationSystem.useItem('someonesDiary'));
    await drainDialogue(page);

    const count = await page.evaluate(() => RPG.State.inventory.someonesDiary);
    expect(count).toBe(1);
  });

  test('45. move, talk, and openModal are all blocked while reading', async ({ page }) => {
    await page.evaluate(() => explorationSystem.useItem('someonesDiary'));

    const result = await page.evaluate(() => {
      const distanceBefore = RPG.State.currentDistance;
      const modeBefore = RPG.State.mode;

      explorationSystem.move(1, { skipTravelCue: true });
      const distanceAfterMove = RPG.State.currentDistance;

      explorationSystem.talk();
      const modeAfterTalk = RPG.State.mode;

      uiControl.openModal();
      const modalDisplay = document.getElementById('itemModal')?.style.display;

      return { distanceBefore, distanceAfterMove, modeBefore, modeAfterTalk, modalDisplay };
    });

    expect(result.modeBefore).toBe('event');
    expect(result.distanceAfterMove).toBe(result.distanceBefore);
    expect(result.modeAfterTalk).toBe('event');
    expect(result.modalDisplay).not.toBe('flex');
  });

  test('46. mode returns to base and buttons re-enable once the queue finishes', async ({ page }) => {
    await page.evaluate(() => explorationSystem.useItem('someonesDiary'));
    const finalMode = await drainDialogue(page);

    const anyDisabled = await page.evaluate(() => (
      Array.from(document.querySelectorAll('button')).some(btn => btn.disabled)
    ));
    expect(finalMode).toBe('base');
    expect(anyDisabled).toBe(false);
  });
});

test.describe('someone\'s diary - save/load round trip (new-format saves only)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
  });

  test('48. firstReadDone survives save/load and reading afterward shows the repeat (body-only) version', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.flags.someonesDiaryFirstReadDone = true;
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('diary_firstread_save', JSON.stringify(snapshot));
      RPG.State.flags.someonesDiaryFirstReadDone = false;
      uiControl.loadFromStorage('diary_firstread_save', 'テスト記録');
    });

    const flagAfterLoad = await page.evaluate(() => RPG.State.flags.someonesDiaryFirstReadDone);
    expect(flagAfterLoad).toBe(true);

    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.isInDungeon = true;
      RPG.State.location = '森の深層';
      explorationSystem.useItem('someonesDiary');
    });
    await drainDialogue(page);

    const lines = await page.evaluate(() => (
      Array.from(document.querySelectorAll('#logContainer .log-entry')).map(el => el.textContent)
    ));
    expect(lines).not.toContain('カイン「なんだこれ」');
    expect(lines).toContain('ボスはかっこいい。はやくボスにほめられたい。');
  });
});

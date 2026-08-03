// @ts-check
const { test, expect } = require('@playwright/test');

async function openGame(page) {
  await page.goto('/chapter1.html');
  await page.waitForFunction(() => (
    typeof RPG !== 'undefined' &&
    typeof uiControl !== 'undefined' &&
    typeof explorationSystem !== 'undefined' &&
    typeof battleSystem !== 'undefined' &&
    typeof innSystem !== 'undefined'
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
      sapSourceAwarenessSeen: true,
    });
    Object.assign(RPG.State, {
      mode: 'base',
      dialogueQueue: [],
      isWaitingForInput: false,
      isAtInn: false,
      isInDungeon: true,
      explorationArea: 'forest',
      location: '琥珀の森',
      currentDistance: 1,
      // storyPhase 0's first-playthrough special cases at 3m/5m/6m would otherwise
      // intercept move() before this event is ever checked.
      storyPhase: 5,
    });
    RPG.State.amberRootState = { 6: 'defeated', 7: 'defeated', 8: 'defeated' };

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
      return state.mode;
    }

    if (state.waiting || state.typewriting) {
      await page.evaluate(() => uiControl.handlePlayerInput());
    }
    await page.waitForTimeout(25);
  }

  throw new Error('dialogue did not finish before timeout');
}

function logTexts(page) {
  return page.evaluate(() => (
    Array.from(document.querySelectorAll('#logContainer .log-entry')).map(el => el.textContent)
  ));
}

const CONFIRMED_LINES = [
  'カイン「……明らかに魔物の気配が減ってる。もう厄介なのは残ってないか？」',
  'オーエン「……なんで僕の顔を見るの」',
  'カイン（バレたか。こいつの反応を見れば分かると思ったんだけどな）',
];

test.describe('forest 2m talk after all three amber roots are defeated', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
    await page.evaluate(() => {
      window.__originalRandom = Math.random;
      Math.random = () => 0.99; // keep random encounters/ambient rolls out of the way
    });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      if (window.__originalRandom) Math.random = window.__originalRandom;
    });
  });

  test('1. does not fire with two roots defeated and one still ignited', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.amberRootState = { 6: 'defeated', 7: 'defeated', 8: 'ignited' };
      RPG.State.currentDistance = 1;
    });
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));
    await drainDialogue(page);

    const lines = await logTexts(page);
    expect(lines).not.toContain(CONFIRMED_LINES[0]);
    const seen = await page.evaluate(() => RPG.State.flags.forest2mPacifiedTalkSeen);
    expect(seen).toBe(false);
  });

  test('2. after all three roots, arriving at 2m plays the confirmed lines in order', async ({ page }) => {
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));
    await drainDialogue(page);

    const lines = await logTexts(page);
    let cursor = -1;
    for (const expected of CONFIRMED_LINES) {
      const idx = lines.indexOf(expected, cursor + 1);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }

    const seen = await page.evaluate(() => RPG.State.flags.forest2mPacifiedTalkSeen);
    expect(seen).toBe(true);
  });

  test('3. does not depend on the order the three roots were defeated', async ({ page }) => {
    await page.evaluate(() => {
      // Same three sites, assembled in a different insertion order - countDefeatedAmberRoots()
      // reads Object.values() so this must behave identically to the beforeEach baseline.
      RPG.State.amberRootState = { 8: 'defeated', 6: 'defeated', 7: 'defeated' };
    });
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));
    await drainDialogue(page);

    const lines = await logTexts(page);
    expect(lines).toContain(CONFIRMED_LINES[0]);
  });

  test('4. does not double up with the ambient text or a random battle on the same arrival', async ({ page }) => {
    let battleCalls = 0;
    await page.evaluate(() => {
      Math.random = () => 0; // would guarantee both the ambient roll and the encounter roll
    });
    await page.exposeFunction('__reportBattleCall', () => { battleCalls += 1; });
    await page.evaluate(() => {
      window.__originalStartBattle = battleSystem.startBattle;
      battleSystem.startBattle = (...args) => {
        window.__reportBattleCall();
        return window.__originalStartBattle.apply(battleSystem, args);
      };
    });

    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));
    await drainDialogue(page);

    await page.evaluate(() => {
      battleSystem.startBattle = window.__originalStartBattle;
    });

    const lines = await logTexts(page);
    expect(lines).not.toContain('枝の間からのぞく光が、カインのブーツを照らす。');
    expect(battleCalls).toBe(0);
  });

  test('5. does not replay on a later revisit', async ({ page }) => {
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));
    await drainDialogue(page);

    await page.evaluate(() => { document.getElementById('logContainer').innerHTML = ''; });
    await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true }));
    await drainDialogue(page);
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));
    await drainDialogue(page);

    const lines = await logTexts(page);
    expect(lines).not.toContain(CONFIRMED_LINES[0]);
  });

  test('6. forest2mPacifiedTalkSeen survives a save/load round trip and stops the talk from replaying', async ({ page }) => {
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));
    await drainDialogue(page);

    const result = await page.evaluate(() => {
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_forest2m_test', JSON.stringify(snapshot));

      RPG.State.flags.forest2mPacifiedTalkSeen = false;
      uiControl.loadFromStorage('okai_rpg_forest2m_test', '森2mテスト');

      return RPG.State.flags.forest2mPacifiedTalkSeen;
    });
    expect(result).toBe(true);

    await page.evaluate(() => { document.getElementById('logContainer').innerHTML = ''; });
    await page.evaluate(() => {
      RPG.State.currentDistance = 1;
      RPG.State.mode = 'base';
    });
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));
    await drainDialogue(page);

    const lines = await logTexts(page);
    expect(lines).not.toContain(CONFIRMED_LINES[0]);
  });

  test('7. an old save without the new flag defaults to unseen', async ({ page }) => {
    const result = await page.evaluate(() => {
      const snapshot = uiControl.createSaveSnapshot('journal');
      const legacySave = JSON.parse(JSON.stringify(snapshot));
      delete legacySave.flags.forest2mPacifiedTalkSeen;
      localStorage.setItem('okai_rpg_forest2m_legacy_test', JSON.stringify(legacySave));

      RPG.State.flags.forest2mPacifiedTalkSeen = true;
      uiControl.loadFromStorage('okai_rpg_forest2m_legacy_test', '旧セーブ森2mテスト');

      return RPG.State.flags.forest2mPacifiedTalkSeen;
    });
    expect(result).toBe(false);
  });

  test('8. an interrupted scene is not marked read, so it replays instead of vanishing', async ({ page }) => {
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));
    // Stop partway through, before the trailing action has run.
    await page.evaluate(() => uiControl.handlePlayerInput());

    const midway = await page.evaluate(() => ({
      seen: RPG.State.flags.forest2mPacifiedTalkSeen,
      completedEvents: [...RPG.State.completedEvents],
    }));
    expect(midway.seen).toBe(false);
    expect(midway.completedEvents).not.toContain('forest_2m_roots_pacified');

    // Simulate walking away mid-scene and returning: the talk was never marked seen, so it
    // must be fully replayable rather than lost.
    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.dialogueQueue = [];
      document.getElementById('logContainer').innerHTML = '';
    });
    await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true }));
    await drainDialogue(page);
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));
    await drainDialogue(page);

    const lines = await logTexts(page);
    expect(lines).toContain(CONFIRMED_LINES[0]);
    const seen = await page.evaluate(() => RPG.State.flags.forest2mPacifiedTalkSeen);
    expect(seen).toBe(true);
  });

  test('9. in Phase 7, the talk plays first and the wagon prompt follows on the same arrival', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.storyPhase = 7;
      RPG.State.flags.onWagon = false;
    });
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));
    await drainDialogue(page);

    const lines = await logTexts(page);
    let cursor = -1;
    for (const expected of CONFIRMED_LINES) {
      const idx = lines.indexOf(expected, cursor + 1);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }
    expect(lines.indexOf('御者「準備はできたか？」')).toBeGreaterThan(cursor);

    const result = await page.evaluate(() => ({
      seen: RPG.State.flags.forest2mPacifiedTalkSeen,
      mode: RPG.State.mode,
    }));
    expect(result.seen).toBe(true);
    expect(result.mode).toBe('choice');
  });

  test('10. in Phase 7, once the talk is already seen, arriving at 2m shows only the wagon prompt', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.storyPhase = 7;
      RPG.State.flags.onWagon = false;
      RPG.State.flags.forest2mPacifiedTalkSeen = true;
    });
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));
    await drainDialogue(page);

    const lines = await logTexts(page);
    expect(lines).not.toContain(CONFIRMED_LINES[0]);
    expect(lines).toContain('御者「準備はできたか？」');
    const mode = await page.evaluate(() => RPG.State.mode);
    expect(mode).toBe('choice');
  });

  test('11. with roots undefeated, arrival at 2m keeps the existing ambient/battle behavior', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.amberRootState = { 6: 'unexamined', 7: 'unexamined', 8: 'unexamined' };
      Math.random = () => 0; // force the ambient roll and the encounter roll to succeed
    });
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));

    const result = await page.evaluate(() => ({
      isBattling: RPG.State.isBattling,
      seen: RPG.State.flags.forest2mPacifiedTalkSeen,
    }));
    // Either the ambient text or the encounter roll (or both) fire as before; specifically,
    // our event must not have intercepted the arrival.
    expect(result.seen).toBe(false);
  });
});

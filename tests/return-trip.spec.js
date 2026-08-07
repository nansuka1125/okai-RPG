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
      thiefDiscoveryStatus: 2,
      giantLarvaDefeated: true,
      phase6PostDeliverySleepDone: false,
    });
    Object.assign(RPG.State, {
      mode: 'base',
      dialogueQueue: [],
      isWaitingForInput: false,
      isAtInn: false,
      isInDungeon: true,
      explorationArea: 'forest',
      location: '森の深層',
      currentDistance: 10,
      // storyPhase 5 matches reality after the giant_larva victory event (thief_rescue_victory
      // advances it there). storyPhase 0's first-playthrough special cases at 5m/6m/3m would
      // otherwise intercept move() before the return-trip events are ever checked.
      storyPhase: 5,
    });
    RPG.State.inventory.silverCoin = 3;
    RPG.State.silverCoins = 3;
    RPG.State.larvaCorpseStage = 3; // third coin already recovered, so 10m does not hold Cain back

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

// Walks 10m -> 9m -> 8m -> 7m -> 6m -> 5m one step at a time, draining any dialogue
// triggered at each stop before taking the next step.
async function walkDownToFiveMeters(page) {
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true }));
    await drainDialogue(page);
  }
}

test.describe('return trip - full sequence', () => {
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

  test('62-63. all four return-trip events fire once each, in order, and do not repeat on a second pass', async ({ page }) => {
    await walkDownToFiveMeters(page);

    const afterFirstWalk = await page.evaluate(() => [...RPG.State.completedEvents]);
    expect(afterFirstWalk).toEqual(
      expect.arrayContaining(['return_trip_9m_rain', 'return_trip_8m_rummage', 'return_trip_7m_sweets', 'return_trip_5m_walking'])
    );
    const order = ['return_trip_9m_rain', 'return_trip_8m_rummage', 'return_trip_7m_sweets', 'return_trip_5m_walking']
      .map(id => afterFirstWalk.indexOf(id));
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
    expect(order[2]).toBeLessThan(order[3]);

    // Walk back up to 10m (no events expected either way) and back down again.
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));
      await drainDialogue(page);
    }
    await walkDownToFiveMeters(page);

    const lines = await logTexts(page);
    const countOf = text => lines.filter(t => t === text).length;
    expect(countOf('雨は、さっきより強くなっている。')).toBe(1);
    expect(countOf('オーエンは革袋の中を漁っている……。')).toBe(1);
    expect(countOf('オーエン「甘いものが入ってる。やった」')).toBe(1);
    expect(countOf('オーエン「ねえ、これ何？」')).toBe(1);
  });

  test('64. 9m shows both confirmed lines', async ({ page }) => {
    await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true }));
    await drainDialogue(page);

    const lines = await logTexts(page);
    expect(lines).toContain('雨は、さっきより強くなっている。');
    expect(lines).toContain('カインは肩口を押さえ、足を引きずるように森を戻った。');
  });

  test('65. 8m shows the confirmed rummaging line', async ({ page }) => {
    await page.evaluate(() => { RPG.State.currentDistance = 9; });
    await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true }));
    await drainDialogue(page);

    const lines = await logTexts(page);
    expect(lines).toContain('オーエンは革袋の中を漁っている……。');
  });

  test('66. 7m shows all 6 confirmed lines in order', async ({ page }) => {
    await page.evaluate(() => { RPG.State.currentDistance = 8; });
    await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true }));
    await drainDialogue(page);

    const lines = await logTexts(page);
    const expectedOrder = [
      '雨が木々を叩いている。',
      'オーエン「甘いものが入ってる。やった」',
      'オーエンは包みを開き、中身を口へ放り込んだ。',
      'カイン「虫の腹の中にあったもの、食うのか？」',
      'オーエン「おまえだって虫の腹の中の草食べてるだろ」',
      'カイン「……たしかに」',
    ];
    let cursor = -1;
    for (const expected of expectedOrder) {
      const idx = lines.indexOf(expected, cursor + 1);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  test('67. 5m shows all 14 confirmed conversation lines plus the closing line', async ({ page }) => {
    await page.evaluate(() => { RPG.State.currentDistance = 6; });
    await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true }));
    await drainDialogue(page);

    const lines = await logTexts(page);
    const expectedOrder = [
      'オーエン「ねえ、これ何？」',
      'カイン「どれだ？」',
      'オーエン「これ」',
      'オーエンが口を開けた。ぐちゃぐちゃだ。',
      'カイン「口の中を見せるな。…わからない。どんな味のものだった？」',
      'オーエン「……」',
      'オーエンは指先についた欠片を見た。',
      '次の瞬間、その指がカインの口に押し込まれた。',
      'カイン「……！？」',
      '冷たい指の味がした。',
      'かすかに、レモンの風味がしたような気もする。',
      'カイン「……分からない」',
      'オーエン「……ふうん」',
      'オーエンはカインの口から指を引き抜くと、その指を舐めた。',
      '宿屋までの道が、ひどく長く感じられた。',
    ];
    let cursor = -1;
    for (const expected of expectedOrder) {
      const idx = lines.indexOf(expected, cursor + 1);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  test('68. the old 5m narration text no longer exists anywhere in EVENT_DATA', async ({ page }) => {
    const hasStaleText = await page.evaluate(() => (
      JSON.stringify(RPG.Assets.EVENT_DATA).includes('我が物顔で') ||
      JSON.stringify(RPG.Assets.EVENT_DATA).includes('見失いそう')
    ));
    expect(hasStaleText).toBe(false);
  });

  test('69. without giantLarvaDefeated, none of the return-trip events fire even with 3 silver coins', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = false;
      RPG.State.larvaCorpseStage = 0;
    });
    await walkDownToFiveMeters(page);

    const lines = await logTexts(page);
    expect(lines).not.toContain('雨は、さっきより強くなっている。');
    expect(lines).not.toContain('オーエンは革袋の中を漁っている……。');
    expect(lines).not.toContain('オーエン「甘いものが入ってる。やった」');
    expect(lines).not.toContain('オーエン「ねえ、これ何？」');
  });

  test('70. random encounters never fire during the peaceful return, even when the roll would always hit', async ({ page }) => {
    const result = await page.evaluate(async () => {
      Math.random = () => 0.0;
      const originalStartBattle = battleSystem.startBattle;
      let callCount = 0;
      battleSystem.startBattle = (...args) => {
        callCount++;
        return originalStartBattle.apply(battleSystem, args);
      };
      try {
        for (let i = 0; i < 5; i++) {
          explorationSystem.move(-1, { skipTravelCue: true });
          // Drain any triggered dialogue synchronously via repeated taps (no real timers needed
          // here since Math.random=0 never rolls a battle, so events are the only branch taken).
          for (let tap = 0; tap < 20 && RPG.State.mode === 'event'; tap++) {
            if (RPG.State.isWaitingForInput) uiControl.handlePlayerInput();
          }
        }
        return callCount;
      } finally {
        battleSystem.startBattle = originalStartBattle;
      }
    });
    // Some dialogue may still be mid-flight (event mode) from the synchronous tap loop above;
    // that is fine - the assertion only cares whether startBattle was ever invoked.
    await drainDialogue(page);
    expect(result).toBe(0);
  });

  test('71. the first 5m visit wins over the ordinary owenFlavor5m pool', async ({ page }) => {
    await page.evaluate(() => { RPG.State.currentDistance = 6; });
    await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true }));
    await drainDialogue(page);

    const result = await page.evaluate(() => {
      const pool = (RPG.Assets.GAME_TEXT.events.owenFlavor5m || []).map(e => e.text);
      const lines = Array.from(document.querySelectorAll('#logContainer .log-entry')).map(el => el.textContent);
      return {
        hasConfirmedLine: lines.includes('オーエン「ねえ、これ何？」'),
        hasFlavorPoolLine: lines.some(line => pool.includes(line)),
      };
    });
    expect(result).toEqual({ hasConfirmedLine: true, hasFlavorPoolLine: false });
  });

  test('72-73. poison never ticks during the peaceful return, and the poisoned state itself is preserved', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.isPoisoned = true;
      RPG.State.currentHP = 2;
      RPG.State.maxHP = 140;
      RPG.State.poisonDamageRemaining = 40;
    });

    const originalResolveDefeat = await page.evaluate(() => {
      window.__resolveDefeatCalls = 0;
      const original = battleSystem.resolveDefeat;
      battleSystem.resolveDefeat = () => {
        window.__resolveDefeatCalls++;
      };
      return true;
    });
    expect(originalResolveDefeat).toBe(true);

    try {
      await walkDownToFiveMeters(page);
    } finally {
      await page.evaluate(() => {
        // restore is not required for correctness here since each test gets a fresh page,
        // but keep the override scoped to this test's evaluate calls only.
      });
    }

    const result = await page.evaluate(() => ({
      currentHP: RPG.State.currentHP,
      isPoisoned: RPG.State.isPoisoned,
      resolveDefeatCalls: window.__resolveDefeatCalls,
    }));
    expect(result).toEqual({ currentHP: 2, isPoisoned: true, resolveDefeatCalls: 0 });
  });

  test('74. silver delivery ends the peaceful return and poison suppression, but not the rain', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.silverDelivered = true;
      RPG.State.flags.phase6PostDeliverySleepDone = false;
      const peaceful = explorationSystem.isPeacefulReturnActive();
      const rain = explorationSystem.isRainActive();

      RPG.State.currentDistance = 9;
      RPG.State.isPoisoned = true;
      RPG.State.currentHP = 50;
      RPG.State.maxHP = 100;
      RPG.State.poisonDamageRemaining = 30;
      const hpBefore = RPG.State.currentHP;
      explorationSystem.move(-1, { skipTravelCue: true });
      const hpAfter = RPG.State.currentHP;

      return { peaceful, rain, hpBefore, hpAfter };
    });
    expect(result.peaceful).toBe(false);
    expect(result.rain).toBe(true);
    expect(result.hpAfter).toBeLessThan(result.hpBefore);
  });

  test('during the rainy peaceful return, 調べる/アイテム grey out while 進む/戻る stay usable; delivering the silver re-enables them', async ({ page }) => {
    const duringReturn = await page.evaluate(() => {
      RPG.State.currentDistance = 9; // off the 10m ceiling, so 進む isn't disabled for an unrelated reason
      uiControl.updateUI();
      return {
        peaceful: explorationSystem.isPeacefulReturnActive(),
        rain: explorationSystem.isRainActive(),
        talk: { text: document.getElementById('btnTalk')?.textContent, disabled: document.getElementById('btnTalk')?.disabled },
        item: { text: document.getElementById('btnItem')?.textContent, disabled: document.getElementById('btnItem')?.disabled },
        forwardDisabled: document.getElementById('btnMoveForward')?.disabled,
        backDisabled: document.getElementById('btnMoveBack')?.disabled,
      };
    });
    expect(duringReturn.peaceful).toBe(true);
    expect(duringReturn.rain).toBe(true);
    expect(duringReturn.talk).toEqual({ text: '調べる', disabled: true });
    expect(duringReturn.item).toEqual({ text: 'アイテム', disabled: true });
    expect(duringReturn.forwardDisabled).toBe(false);
    expect(duringReturn.backDisabled).toBe(false);

    const afterDelivery = await page.evaluate(() => {
      RPG.State.flags.silverDelivered = true;
      uiControl.updateUI();
      return {
        rain: explorationSystem.isRainActive(),
        talk: { text: document.getElementById('btnTalk')?.textContent, disabled: document.getElementById('btnTalk')?.disabled },
        item: { text: document.getElementById('btnItem')?.textContent, disabled: document.getElementById('btnItem')?.disabled },
      };
    });
    // Rain alone (without the still-active peaceful return) no longer greys out these buttons.
    expect(afterDelivery.rain).toBe(true);
    expect(afterDelivery.talk).toEqual({ text: '調べる', disabled: false });
    expect(afterDelivery.item).toEqual({ text: 'アイテム', disabled: false });
  });

  test('75. debug.isSkipping does not jam the walk', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.debug.isSkipping = true;
    });
    await walkDownToFiveMeters(page);

    const result = await page.evaluate(() => ({
      distance: RPG.State.currentDistance,
      mode: RPG.State.mode,
    }));
    expect(result).toEqual({ distance: 5, mode: 'base' });
  });

  test('76. the full walk continues normally from 5m back to the inn front (Owen-defeat equivalence is covered by larva-aftermath.spec.js test 10)', async ({ page }) => {
    await walkDownToFiveMeters(page);
    // 5m -> 0m is 5 steps; a 6th move(-1) while already at 0m is what actually triggers the
    // dungeon-exit branch in move().
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true }));
      await drainDialogue(page);
    }

    const result = await page.evaluate(() => ({
      isInDungeon: RPG.State.isInDungeon,
      location: RPG.State.location,
    }));
    expect(result).toEqual({ isInDungeon: false, location: '宿屋前' });
  });
});

test.describe('return trip - save/load round trip (new-format saves only)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
    await page.evaluate(() => {
      window.__originalRandom = Math.random;
      Math.random = () => 0.99;
    });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      if (window.__originalRandom) Math.random = window.__originalRandom;
    });
  });

  test('77. after 9m/8m are done, saving and loading keeps 7m/5m pending and does not replay 9m/8m', async ({ page }) => {
    // Events fire on arrival at a distance, so currentDistance must start at 10 (not be
    // assigned 9 directly) for the first move(-1) to actually arrive at 9m and fire it.
    await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true })); // 10 -> 9m, fires 9m
    await drainDialogue(page);
    await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true })); // 9 -> 8m, fires 8m
    await drainDialogue(page);

    const savedCompleted = await page.evaluate(() => {
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('return_trip_partial_save', JSON.stringify(snapshot));
      return [...RPG.State.completedEvents];
    });
    expect(savedCompleted).toEqual(
      expect.arrayContaining(['return_trip_9m_rain', 'return_trip_8m_rummage'])
    );
    expect(savedCompleted).not.toContain('return_trip_7m_sweets');
    expect(savedCompleted).not.toContain('return_trip_5m_walking');

    await page.evaluate(() => {
      RPG.State.completedEvents = [];
      RPG.State.currentDistance = 0;
      uiControl.loadFromStorage('return_trip_partial_save', 'テスト記録');
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';
    });

    // Revisit 9m and 8m: already completed, must not refire.
    await page.evaluate(() => { RPG.State.mode = 'base'; RPG.State.currentDistance = 7; });
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true })); // -> 8m, no event
    await drainDialogue(page);
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true })); // -> 9m, no event
    await drainDialogue(page);

    const revisitLines = await logTexts(page);
    expect(revisitLines).not.toContain('雨は、さっきより強くなっている。');
    expect(revisitLines).not.toContain('オーエンは革袋の中を漁っている……。');

    // Continue down through 8 -> 7 -> 6 -> 5: 7m and 5m are still pending and must fire.
    await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true })); // -> 8m
    await drainDialogue(page);
    await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true })); // -> 7m
    await drainDialogue(page);
    await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true })); // -> 6m
    await drainDialogue(page);
    await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true })); // -> 5m
    await drainDialogue(page);

    const finalCompleted = await page.evaluate(() => [...RPG.State.completedEvents]);
    expect(finalCompleted).toEqual(
      expect.arrayContaining([
        'return_trip_9m_rain',
        'return_trip_8m_rummage',
        'return_trip_7m_sweets',
        'return_trip_5m_walking',
      ])
    );
  });
});

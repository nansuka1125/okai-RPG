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
      thiefDiscoveryStatus: 1,
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
    });

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

test.describe('giant_larva aftermath - post-victory event', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
  });

  test('1-2. post-victory event grants exactly 2 silver coins, not 3', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.inventory.silverCoin = 0;
      RPG.State.silverCoins = 0;
      const victoryEvent = RPG.Assets.EVENT_DATA.find(e => e.id === 'thief_rescue_victory');
      victoryEvent.action(RPG.State);
    });
    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      silverCoin: RPG.State.inventory.silverCoin,
      silverCoins: RPG.State.silverCoins,
    }));
    expect(result).toEqual({ silverCoin: 2, silverCoins: 2 });
  });

  test('3. no "見覚えのある" text appears anywhere in the event log', async ({ page }) => {
    await page.evaluate(() => {
      const victoryEvent = RPG.Assets.EVENT_DATA.find(e => e.id === 'thief_rescue_victory');
      victoryEvent.action(RPG.State);
    });
    await drainDialogue(page);

    const hasStaleText = await page.evaluate(() => (
      Array.from(document.querySelectorAll('#logContainer .log-entry'))
        .some(el => (el.textContent || '').includes('見覚えのある'))
    ));
    expect(hasStaleText).toBe(false);
  });

  test('4. "きらり。" is displayed', async ({ page }) => {
    await page.evaluate(() => {
      const victoryEvent = RPG.Assets.EVENT_DATA.find(e => e.id === 'thief_rescue_victory');
      victoryEvent.action(RPG.State);
    });
    await drainDialogue(page);

    const hasSparkle = await page.evaluate(() => (
      Array.from(document.querySelectorAll('#logContainer .log-entry'))
        .some(el => (el.textContent || '').trim() === 'きらり。')
    ));
    expect(hasSparkle).toBe(true);
  });

  test('5. herb increases by exactly 1', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.inventory.herb = 0;
      const victoryEvent = RPG.Assets.EVENT_DATA.find(e => e.id === 'thief_rescue_victory');
      victoryEvent.action(RPG.State);
    });
    await drainDialogue(page);

    const herb = await page.evaluate(() => RPG.State.inventory.herb);
    expect(herb).toBe(1);
  });

  test('6. giant_larva no longer has a normal drop table entry', async ({ page }) => {
    const drop = await page.evaluate(() => (
      RPG.Assets.ENEMIES.find(e => e.id === 'giant_larva').drop
    ));
    expect(drop).toBeUndefined();
  });

  test('7. executeStandardVictory grants herb only once (no double grant from removed drop roll)', async ({ page }) => {
    await page.evaluate(() => {
      const originalRandom = Math.random;
      Math.random = () => 0.0;
      try {
        RPG.State.inventory.herb = 0;
        RPG.State.currentEnemy = { id: 'giant_larva', name: '泥這う大幼蟲', gold: 0, xp: 130 };
        RPG.State.defeatCounts.giant_larva = { cain: 0, owen: 0 };
        RPG.State.lastBlowBy = 'Cain';
        battleSystem.executeStandardVictory('giant_larva');
      } finally {
        Math.random = originalRandom;
      }
    });
    await drainDialogue(page);
    const herb = await page.evaluate(() => RPG.State.inventory.herb);
    expect(herb).toBe(1);
  });

  test('8. progression flags update correctly', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.storyPhase = 0;
      const victoryEvent = RPG.Assets.EVENT_DATA.find(e => e.id === 'thief_rescue_victory');
      victoryEvent.action(RPG.State);
    });
    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      thiefDiscoveryStatus: RPG.State.flags.thiefDiscoveryStatus,
      thiefTrackActive: RPG.State.flags.thiefTrackActive,
      readyForThiefBoy: RPG.State.flags.readyForThiefBoy,
      hasSleptAfterThief: RPG.State.flags.hasSleptAfterThief,
      storyPhaseAtLeast5: RPG.State.storyPhase >= 5,
    }));
    expect(result).toEqual({
      thiefDiscoveryStatus: 2,
      thiefTrackActive: false,
      readyForThiefBoy: false,
      hasSleptAfterThief: false,
      storyPhaseAtLeast5: true,
    });
  });

  test('9. control returns to base mode after the queue finishes', async ({ page }) => {
    await page.evaluate(() => {
      const victoryEvent = RPG.Assets.EVENT_DATA.find(e => e.id === 'thief_rescue_victory');
      victoryEvent.action(RPG.State);
    });
    const finalMode = await drainDialogue(page);

    const result = await page.evaluate(() => ({
      mode: RPG.State.mode,
      isBattling: RPG.State.isBattling,
      currentEnemy: RPG.State.currentEnemy,
    }));
    expect(finalMode).toBe('base');
    expect(result).toEqual({ mode: 'base', isBattling: false, currentEnemy: null });
  });

  test('10. Owen never intervenes against giant_larva (no separate Owen-kill route)', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.currentEnemy = { id: 'giant_larva', name: '泥這う大幼蟲', hp: 10 };
      RPG.State.hasOwenIntervened = false;
      RPG.State.battleTurn = 1;
      let called = false;
      battleSystem.processOwenAction(() => {
        called = true;
      });
      return {
        called,
        hasOwenIntervened: RPG.State.hasOwenIntervened,
      };
    });
    expect(result).toEqual({ called: true, hasOwenIntervened: false });
  });
});

test.describe('giant_larva aftermath - 10m talk button label', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
    });
  });

  test('the 10m examine button reads the plain "調べる" label at every pending corpse stage', async ({ page }) => {
    const labels = await page.evaluate(() => {
      const results = [];
      [0, 1, 2].forEach(stage => {
        RPG.State.larvaCorpseStage = stage;
        uiControl.updateUI();
        results.push(document.getElementById('btnTalk').textContent);
      });
      return results;
    });
    expect(labels).toEqual(['調べる', '調べる', '調べる']);
  });
});

test.describe('giant_larva aftermath - corpse inspection stage 1 (third silver coin)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
      RPG.State.larvaCorpseStage = 0;
      RPG.State.inventory.silverCoin = 2;
      RPG.State.silverCoins = 2;
    });
  });

  test('11. talk() at 10m starts the corpse event instead of the locked hut text', async ({ page }) => {
    await page.evaluate(() => {
      explorationSystem.talk();
    });
    const hasHutText = await page.evaluate(() => (
      Array.from(document.querySelectorAll('#logContainer .log-entry'))
        .some(el => (el.textContent || '').includes('鍵'))
    ));
    const firstLine = await page.evaluate(() => (
      document.querySelector('#logContainer .log-entry')?.textContent
    ));
    expect(hasHutText).toBe(false);
    expect(firstLine).toBe('大幼蟲が飲み込んだらしい物が、泥と体液にまみれて散らばっている。');
  });

  test('12-13. move(-1) is blocked repeatedly without stacking duplicate log lines', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true }));
    }
    const result = await page.evaluate(() => {
      const entries = Array.from(document.querySelectorAll('#logContainer .log-entry'))
        .map(el => el.textContent);
      const blockLine = 'カイン（さっき光ったものが気になるな…一応見ておくか）';
      return {
        distance: RPG.State.currentDistance,
        blockLineCount: entries.filter(t => t === blockLine).length,
      };
    });
    expect(result.distance).toBe(10);
    expect(result.blockLineCount).toBe(1);
  });

  test('14. the coin-grant line updates silverCoin and larvaCorpseStage before Owen speaks', async ({ page }) => {
    await page.evaluate(() => explorationSystem.talk());
    // Advance past: [0]大幼蟲が...,[1]カイン「荷馬車の残骸...,[2]カインは落ちていた枝で...,
    // [3]錆びた金具...,[4]その下で...,[5]カイン「……あった」 -> lands on [6]《🪙銀貨を手に入れた！》
    await tap(page, 6);

    const midState = await page.evaluate(() => ({
      currentLine: document.querySelector('#logContainer .log-current')?.textContent,
      larvaCorpseStage: RPG.State.larvaCorpseStage,
      silverCoin: RPG.State.inventory.silverCoin,
    }));
    expect(midState.currentLine).toBe('《🪙銀貨を手に入れた！》');
    expect(midState.larvaCorpseStage).toBe(1);
    expect(midState.silverCoin).toBe(3);
  });

  test('15. re-opening the corpse after the coin line (mid-interruption) does not grant a second coin', async ({ page }) => {
    await page.evaluate(() => explorationSystem.talk());
    await tap(page, 6); // land on the coin-grant line; its action has already fired

    // Simulate leaving the scene mid-dialogue and re-entering the examine flow.
    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.dialogueQueue = [];
      explorationSystem.talk();
    });

    const result = await page.evaluate(() => ({
      firstLine: document.querySelector('#logContainer .log-current')?.textContent,
      silverCoin: RPG.State.inventory.silverCoin,
    }));
    expect(result.firstLine).toBe('カイン（他に何かないかな）');
    expect(result.silverCoin).toBe(3);
  });

  test('16-17. completing the first inspection sets stage 1 and coin count to 3, without duplication on re-inspect', async ({ page }) => {
    await page.evaluate(() => explorationSystem.talk());
    await drainDialogue(page);

    const afterFirst = await page.evaluate(() => ({
      silverCoin: RPG.State.inventory.silverCoin,
      larvaCorpseStage: RPG.State.larvaCorpseStage,
    }));
    expect(afterFirst).toEqual({ silverCoin: 3, larvaCorpseStage: 1 });

    // Re-inspecting (now stage 1) must not re-grant the coin.
    await page.evaluate(() => explorationSystem.talk());
    const secondLine = await page.evaluate(() => (
      document.querySelector('#logContainer .log-current')?.textContent
    ));
    expect(secondLine).toBe('カイン（他に何かないかな）');
    const coinAfterReinspect = await page.evaluate(() => RPG.State.inventory.silverCoin);
    expect(coinAfterReinspect).toBe(3);
  });

  test('18. after obtaining the third coin, move(-1) reaches 9m', async ({ page }) => {
    await page.evaluate(() => explorationSystem.talk());
    await drainDialogue(page);
    await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true }));

    const distance = await page.evaluate(() => RPG.State.currentDistance);
    expect(distance).toBe(9);
  });

  test('19. stage 1 talk() at 10m starts the second inspection', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.larvaCorpseStage = 1;
      RPG.State.inventory.silverCoin = 3;
      explorationSystem.talk();
    });
    const firstLine = await page.evaluate(() => (
      document.querySelector('#logContainer .log-entry')?.textContent
    ));
    expect(firstLine).toBe('カイン（他に何かないかな）');
  });
});

test.describe('giant_larva aftermath - corpse inspection stage 2 (Owen grabs the wound)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
      RPG.State.larvaCorpseStage = 1;
      RPG.State.inventory.silverCoin = 3;
      RPG.State.silverCoins = 3;
    });
  });

  test('20. all 4 confirmed lines are shown in order', async ({ page }) => {
    await page.evaluate(() => explorationSystem.talk());
    await drainDialogue(page);

    const lines = await page.evaluate(() => (
      Array.from(document.querySelectorAll('#logContainer .log-entry')).map(el => el.textContent)
    ));
    const expectedOrder = [
      'カイン（他に何かないかな）',
      'オーエン「……痛くないの？それ」',
      'オーエンは肩口の傷を掴んだ！',
      'カイン「ぐあ…ｯ！？」',
      'オーエン「あはは、変な声出た」',
    ];
    let cursor = -1;
    for (const expected of expectedOrder) {
      const idx = lines.indexOf(expected, cursor + 1);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  test('21-23. HP, poison state, and poison budget are unchanged by the second inspection', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.currentHP = 42;
      RPG.State.maxHP = 140;
      RPG.State.isPoisoned = true;
      RPG.State.poisonDamageRemaining = 17;
    });
    await page.evaluate(() => explorationSystem.talk());
    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      currentHP: RPG.State.currentHP,
      isPoisoned: RPG.State.isPoisoned,
      poisonDamageRemaining: RPG.State.poisonDamageRemaining,
    }));
    expect(result).toEqual({ currentHP: 42, isPoisoned: true, poisonDamageRemaining: 17 });
  });

  test('22b. even at 1 HP, the second inspection never triggers defeat', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.currentHP = 1;
    });
    await page.evaluate(() => explorationSystem.talk());
    const finalMode = await drainDialogue(page);

    const result = await page.evaluate(() => ({
      currentHP: RPG.State.currentHP,
      mode: RPG.State.mode,
    }));
    expect(finalMode).toBe('base');
    expect(result).toEqual({ currentHP: 1, mode: 'base' });
  });

  test('24. completing the second inspection sets stage 2 and unlocks the third', async ({ page }) => {
    await page.evaluate(() => explorationSystem.talk());
    await drainDialogue(page);

    const stage = await page.evaluate(() => RPG.State.larvaCorpseStage);
    expect(stage).toBe(2);

    await page.evaluate(() => explorationSystem.talk());
    const thirdFirstLine = await page.evaluate(() => (
      document.querySelector('#logContainer .log-current')?.textContent
    ));
    expect(thirdFirstLine).toBe('カイン「ん…これは？」');
  });
});

test.describe('giant_larva aftermath - corpse inspection stage 3 (the diary)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
      RPG.State.larvaCorpseStage = 2;
      RPG.State.inventory.silverCoin = 3;
      RPG.State.silverCoins = 3;
    });
  });

  test('25. the diary-grant line updates inventory and stage together, before the closing line', async ({ page }) => {
    await page.evaluate(() => explorationSystem.talk());
    // [0]カイン「ん…これは？」 -> tap once lands on [1]《📓誰かの日記を手に入れた！》
    await tap(page, 1);

    const midState = await page.evaluate(() => ({
      currentLine: document.querySelector('#logContainer .log-current')?.textContent,
      larvaCorpseStage: RPG.State.larvaCorpseStage,
      diaryCount: RPG.State.inventory.someonesDiary,
    }));
    expect(midState.currentLine).toBe('《📓誰かの日記を手に入れた！》');
    expect(midState.larvaCorpseStage).toBe(3);
    expect(midState.diaryCount).toBe(1);
  });

  test('26. stage 3 talk() no longer starts the corpse event and does not duplicate the diary', async ({ page }) => {
    await page.evaluate(() => explorationSystem.talk());
    await drainDialogue(page);

    await page.evaluate(() => explorationSystem.talk());
    const line = await page.evaluate(() => (
      document.querySelector('#logContainer .log-current')?.textContent
    ));
    expect(line).not.toBe('カイン「ん…これは？」');

    const diaryCount = await page.evaluate(() => RPG.State.inventory.someonesDiary);
    expect(diaryCount).toBe(1);
  });

  test('27. all 3 confirmed lines are shown', async ({ page }) => {
    await page.evaluate(() => explorationSystem.talk());
    await drainDialogue(page);

    const lines = await page.evaluate(() => (
      Array.from(document.querySelectorAll('#logContainer .log-entry')).map(el => el.textContent)
    ));
    expect(lines).toContain('カイン「ん…これは？」');
    expect(lines).toContain('《📓誰かの日記を手に入れた！》');
    expect(lines).toContain('カイン（もう何もないな。宿屋に戻ろう）');
  });

  test('28. after stage 3, move(-1) reaches 9m normally', async ({ page }) => {
    await page.evaluate(() => explorationSystem.talk());
    await drainDialogue(page);
    await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true }));

    const distance = await page.evaluate(() => RPG.State.currentDistance);
    expect(distance).toBe(9);
  });
});

test.describe('giant_larva aftermath - save/load round trip (new-format saves only)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
  });

  test('29. stage 0 survives save and load unchanged', async ({ page }) => {
    const stage = await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
      RPG.State.larvaCorpseStage = 0;
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('larva_stage0_save', JSON.stringify(snapshot));
      RPG.State.larvaCorpseStage = 2;
      uiControl.loadFromStorage('larva_stage0_save', 'テスト記録');
      return RPG.State.larvaCorpseStage;
    });
    expect(stage).toBe(0);
  });

  test('30. stage 1 (with 3 silver coins) survives save and load', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
      RPG.State.larvaCorpseStage = 1;
      RPG.State.inventory.silverCoin = 3;
      RPG.State.silverCoins = 3;
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('larva_stage1_save', JSON.stringify(snapshot));
      RPG.State.larvaCorpseStage = 0;
      RPG.State.inventory.silverCoin = 0;
      uiControl.loadFromStorage('larva_stage1_save', 'テスト記録');
      return {
        stage: RPG.State.larvaCorpseStage,
        silverCoin: RPG.State.inventory.silverCoin,
      };
    });
    expect(result).toEqual({ stage: 1, silverCoin: 3 });
  });

  test('31. stage 2 survives save and load', async ({ page }) => {
    const stage = await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
      RPG.State.larvaCorpseStage = 2;
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('larva_stage2_save', JSON.stringify(snapshot));
      RPG.State.larvaCorpseStage = 0;
      uiControl.loadFromStorage('larva_stage2_save', 'テスト記録');
      return RPG.State.larvaCorpseStage;
    });
    expect(stage).toBe(2);
  });

  test('32. stage 3 with the diary in inventory survives save and load', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
      RPG.State.larvaCorpseStage = 3;
      RPG.State.inventory.someonesDiary = 1;
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('larva_stage3_save', JSON.stringify(snapshot));
      RPG.State.larvaCorpseStage = 0;
      RPG.State.inventory.someonesDiary = 0;
      uiControl.loadFromStorage('larva_stage3_save', 'テスト記録');
      return {
        stage: RPG.State.larvaCorpseStage,
        diaryCount: RPG.State.inventory.someonesDiary,
      };
    });
    expect(result).toEqual({ stage: 3, diaryCount: 1 });
  });

  test('33. after loading stage 1, re-running the corresponding inspection does not duplicate the coin', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
      RPG.State.larvaCorpseStage = 1;
      RPG.State.inventory.silverCoin = 3;
      RPG.State.silverCoins = 3;
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('larva_stage1_reload_save', JSON.stringify(snapshot));
      uiControl.loadFromStorage('larva_stage1_reload_save', 'テスト記録');

      RPG.State.mode = 'base';
      RPG.State.isInDungeon = true;
      RPG.State.location = '森の深層';
      RPG.State.currentDistance = 10;
      explorationSystem.talk();
      return {
        firstLine: document.querySelector('#logContainer .log-current')?.textContent,
        silverCoin: RPG.State.inventory.silverCoin,
      };
    });
    expect(result.firstLine).toBe('カイン（他に何かないかな）');
    expect(result.silverCoin).toBe(3);
  });
});

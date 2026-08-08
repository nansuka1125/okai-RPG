// @ts-check
const { test, expect } = require('@playwright/test');

async function advanceUntilInteractive(page, maxTaps = 100) {
  await page.evaluate(() => {
    window.RPG.State.debug.isSkipping = true;
  });
  for (let i = 0; i < maxTaps; i++) {
    const state = await page.evaluate(() => ({
      mode: window.RPG.State.mode,
      debtPending: window.RPG.State.flags.introDebtTalkPending,
    }));
    if (state.mode === 'base' && state.debtPending) {
      await page.evaluate(() => innSystem.talk());
    } else if (state.mode === 'choice') {
      await page.click('#btnChoiceA');
    } else if (state.mode === 'event') {
      await page.evaluate(() => uiControl.handlePlayerInput());
    } else {
      await page.evaluate(() => {
        window.RPG.State.debug.isSkipping = false;
      });
      return;
    }
    await page.waitForTimeout(50);
  }
  throw new Error('game did not become interactive');
}

async function drainDialogue(page, maxTaps = 200) {
  await page.evaluate(() => {
    window.RPG.State.debug.isSkipping = true;
  });
  for (let i = 0; i < maxTaps; i++) {
    const mode = await page.evaluate(() => window.RPG.State.mode);
    if (mode !== 'event') {
      await page.evaluate(() => {
        window.RPG.State.debug.isSkipping = false;
      });
      return mode;
    }
    await page.evaluate(() => uiControl.handlePlayerInput());
    await page.waitForTimeout(50);
  }
  throw new Error('dialogue did not finish');
}

// Sets a baseline that keeps every higher-priority observe() route (amber merchant,
// phase4 fortune, phase6 herb garden) inactive, so tests exercise only the innkeeper
// consult / rat-bounty logic under test.
async function setCleanInnBaseline(page, overrides = {}) {
  await page.evaluate((ov) => {
    Object.assign(RPG.State, {
      mode: 'base',
      isAtInn: true,
      storyPhase: 2,
      silverCoins: 0,
      ...ov.state,
    });
    Object.assign(RPG.State.flags, {
      hasFoundFirstCoin: false,
      amberMerchantRecognized: false,
      treeDefeated: false,
      borrowedMiningKnifeReceived: false,
      firstAmberAppraisalDone: false,
      amberKnifeReturnAttemptDone: false,
      phase4TheftDiscovered: false,
      herbGardenFortuneConsultUnlocked: false,
      innRatEvent: false,
      innRatEvent2: false,
      innRatEvent2StayCount: 0,
      innRepairConsultSeen: false,
      ratBounty10Received: false,
      ratBounty20Received: false,
      ratEvent2BattleFought: false,
      repairConsultBattleFought: false,
      innRepairInspectionUnlocked: false,
      innRepairHoleInspected: false,
      innRepairDroppingsInspected: false,
      innRepairPillarInspected: false,
      innRepairInspectionReported: false,
      innRepairTimberSearchUnlocked: false,
      innRepairTimberObtained: false,
      innRepairTimberDelivered: false,
      innRepairHelpStarted: false,
      innRepairOilsReceived: false,
      innRepairCompleted: false,
      phase6PostDeliverySleepDone: false,
      chapter1Cleared: false,
      onWagon: false,
      ...ov.flags,
    });
    RPG.State.inventory.unknownAmber = 0;
    RPG.State.inventory.silverCoin = 0;
    RPG.State.inventory.amberTreeTimber = 0;
    RPG.State.inventory.shinyOil = 0;
    RPG.State.inventory.hardOil = 0;
    RPG.State.inventory.glossyOil = 0;
    RPG.State.defeatCounts.rat = ov.defeatCountsRat || { cain: 0, owen: 0 };
    // Clear any battle residue left over from a previous test/section so a fresh
    // observe() call isn't silently blocked by a stale isBattling/currentEnemy state.
    RPG.State.isBattling = false;
    RPG.State.currentEnemy = null;
    RPG.State.battleState = null;
    RPG.State.hasOwenIntervened = false;
    uiControl.updateUI();
  }, overrides);
}

test.describe('宿の修繕・導入部分 (innkeeper repair consult + rat-20 bounty)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await page.goto('/chapter1.html');
    await page.waitForFunction(() => (
      typeof uiControl !== 'undefined' &&
      typeof innSystem !== 'undefined' &&
      typeof explorationSystem !== 'undefined'
    ));
    await advanceUntilInteractive(page);
  });

  test('0a. the first inn rat event remains available from phase 1 through phase 7', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State.flags, {
        hasFoundFirstCoin: true,
        innRatEvent: false,
        chapter1Cleared: false,
        onWagon: false,
      });
      RPG.State.silverCoins = 1;
      RPG.State.inventory.silverCoin = 1;

      return [1, 2, 4, 6, 7].map(phase => {
        RPG.State.storyPhase = phase;
        return innSystem.canTriggerInnRatEvent1();
      });
    });

    expect(result).toEqual([true, true, true, true, true]);
  });

  test('0b. the first inn rat event stays blocked outside its intended state window', async ({ page }) => {
    const result = await page.evaluate(() => {
      const canTrigger = overrides => {
        Object.assign(RPG.State, {
          storyPhase: 2,
          silverCoins: 1,
          ...overrides.state,
        });
        Object.assign(RPG.State.flags, {
          hasFoundFirstCoin: true,
          innRatEvent: false,
          chapter1Cleared: false,
          onWagon: false,
          ...overrides.flags,
        });
        RPG.State.inventory.silverCoin = overrides.inventoryCoin ?? 1;
        return innSystem.canTriggerInnRatEvent1();
      };

      return {
        beforeFirstCoin: canTrigger({
          state: { silverCoins: 0 },
          flags: { hasFoundFirstCoin: false },
          inventoryCoin: 0,
        }),
        phaseZero: canTrigger({ state: { storyPhase: 0 } }),
        phaseEight: canTrigger({ state: { storyPhase: 8 } }),
        alreadyOccurred: canTrigger({ flags: { innRatEvent: true } }),
        chapterCleared: canTrigger({ flags: { chapter1Cleared: true } }),
        onWagon: canTrigger({ flags: { onWagon: true } }),
      };
    });

    expect(result).toEqual({
      beforeFirstCoin: false,
      phaseZero: false,
      phaseEight: false,
      alreadyOccurred: false,
      chapterCleared: false,
      onWagon: false,
    });
  });

  test('0c. the amber merchant keeps priority, then the first rat event starts on the next observe', async ({ page }) => {
    await setCleanInnBaseline(page, {
      state: { storyPhase: 2, silverCoins: 1 },
      flags: {
        hasFoundFirstCoin: true,
        amberMerchantRecognized: false,
        innRatEvent: false,
      },
    });

    const afterMerchant = await page.evaluate(() => {
      RPG.State.inventory.silverCoin = 1;
      innSystem.observe();
      return {
        recognized: RPG.State.flags.amberMerchantRecognized,
        ratStarted: RPG.State.flags.innRatEvent,
      };
    });
    expect(afterMerchant).toEqual({ recognized: true, ratStarted: false });
    await drainDialogue(page);

    const result = await page.evaluate(() => {
      const originalStartBattle = battleSystem.startBattle;
      let startedWith = null;
      battleSystem.startBattle = enemyId => {
        startedWith = enemyId;
        RPG.State.mode = 'battle';
      };

      try {
        innSystem.observe();
        for (let i = 0; i < 10 && RPG.State.mode === 'event'; i++) {
          uiControl.handlePlayerInput();
        }
        return {
          ratStarted: RPG.State.flags.innRatEvent,
          startedWith,
        };
      } finally {
        battleSystem.startBattle = originalStartBattle;
      }
    });

    expect(result).toEqual({ ratStarted: true, startedWith: 'normal_rat' });
  });

  test('0d. a phase-7 retreat can still start the first rat event only once', async ({ page }) => {
    await setCleanInnBaseline(page, {
      state: { storyPhase: 7, silverCoins: 0 },
      flags: {
        hasFoundFirstCoin: true,
        amberMerchantRecognized: true,
        innRatEvent: false,
        chapter1Cleared: false,
        onWagon: false,
      },
    });

    const result = await page.evaluate(() => {
      const originalStartBattle = battleSystem.startBattle;
      const startedWith = [];
      battleSystem.startBattle = enemyId => {
        startedWith.push(enemyId);
        RPG.State.mode = 'base';
      };

      try {
        innSystem.observe();
        for (let i = 0; i < 10 && RPG.State.mode === 'event'; i++) {
          uiControl.handlePlayerInput();
        }
        innSystem.observe();
        return {
          ratStarted: RPG.State.flags.innRatEvent,
          startedWith,
        };
      } finally {
        battleSystem.startBattle = originalStartBattle;
      }
    });

    expect(result).toEqual({ ratStarted: true, startedWith: ['normal_rat'] });
  });

  test('0e. the playable rat-event chain still reaches the innkeeper repair consult', async ({ page }) => {
    await setCleanInnBaseline(page, {
      state: { storyPhase: 2, silverCoins: 0 },
      flags: {
        hasFoundFirstCoin: true,
        amberMerchantRecognized: true,
        innRatEvent: false,
        innRatEvent2: false,
        chapter1Cleared: false,
        onWagon: false,
      },
    });

    const firstRat = await page.evaluate(() => {
      const originalStartBattle = battleSystem.startBattle;
      let startedWith = null;
      battleSystem.startBattle = enemyId => {
        startedWith = enemyId;
        RPG.State.mode = 'base';
      };
      try {
        innSystem.observe();
        for (let i = 0; i < 10 && RPG.State.mode === 'event'; i++) {
          uiControl.handlePlayerInput();
        }
        return {
          occurred: RPG.State.flags.innRatEvent,
          startedWith,
        };
      } finally {
        battleSystem.startBattle = originalStartBattle;
      }
    });
    expect(firstRat).toEqual({ occurred: true, startedWith: 'normal_rat' });

    await page.evaluate(() => {
      innSystem.refreshHerbGardenHarvestsAfterStay();
      RPG.State.currentEnemy = {
        ...RPG.Assets.ENEMIES.find(enemy => enemy.id === 'eye_eating_crow'),
      };
      RPG.State.isBattling = true;
      RPG.State.mode = 'battle';
      RPG.State.lastBlowBy = 'Cain';
      battleSystem.endBattle(true);
    });
    await drainDialogue(page);

    const secondRat = await page.evaluate(() => {
      const originalStartBattle = battleSystem.startBattle;
      let startedWith = null;
      battleSystem.startBattle = enemyId => {
        startedWith = enemyId;
        RPG.State.mode = 'base';
      };
      try {
        innSystem.observe();
        for (let i = 0; i < 20 && RPG.State.mode === 'event'; i++) {
          uiControl.handlePlayerInput();
        }
        return {
          occurred: RPG.State.flags.innRatEvent2,
          active: RPG.State.flags.innRatEvent2BattleActive,
          startedWith,
        };
      } finally {
        battleSystem.startBattle = originalStartBattle;
      }
    });
    expect(secondRat).toEqual({ occurred: true, active: true, startedWith: 'rat' });

    await page.evaluate(() => {
      RPG.State.currentEnemy = {
        ...RPG.Assets.ENEMIES.find(enemy => enemy.id === 'rat'),
      };
      RPG.State.isBattling = true;
      RPG.State.mode = 'battle';
      RPG.State.lastBlowBy = 'Cain';
      battleSystem.endBattle(true);
    });
    await drainDialogue(page);

    await page.evaluate(() => {
      RPG.State.currentEnemy = {
        ...RPG.Assets.ENEMIES.find(enemy => enemy.id === 'eye_eating_crow'),
      };
      RPG.State.isBattling = true;
      RPG.State.mode = 'battle';
      RPG.State.lastBlowBy = 'Cain';
      battleSystem.endBattle(true);
    });
    await drainDialogue(page);

    const result = await page.evaluate(() => {
      RPG.State.isAtInn = true;
      RPG.State.mode = 'base';
      uiControl.updateUI();
      return {
        firstRat: RPG.State.flags.innRatEvent,
        secondRat: RPG.State.flags.innRatEvent2,
        stayCount: RPG.State.flags.innRatEvent2StayCount,
        firstWildBattle: RPG.State.flags.ratEvent2BattleFought,
        secondWildBattle: RPG.State.flags.repairConsultBattleFought,
        secondRatBattleActive: RPG.State.flags.innRatEvent2BattleActive,
        consultAvailable: innSystem.shouldPlayInnkeeperRepairConsult(),
        label: document.getElementById('btnInnObserve')?.textContent,
      };
    });

    expect(result).toEqual({
      firstRat: true,
      secondRat: true,
      stayCount: 1,
      firstWildBattle: true,
      secondWildBattle: true,
      secondRatBattleActive: false,
      consultAvailable: true,
      label: '店主の相談',
    });
  });

  test('1. the innkeeper consult stays hidden after only the first inn rat battle', async ({ page }) => {
    await setCleanInnBaseline(page, { flags: { innRatEvent: true, innRatEvent2: false } });
    const label = await page.locator('#btnInnObserve').textContent();
    expect(label).not.toBe('店主の相談');
  });

  test('1b. inn rat event 2 (チューチュー❗️) needs a stay AND an ordinary battle win, not just one of them', async ({ page }) => {
    const labels = await page.evaluate(async () => {
      const read = () => {
        uiControl.updateUI();
        return document.getElementById('btnInnObserve')?.textContent;
      };

      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      Object.assign(RPG.State.flags, {
        innRatEvent: true,
        innRatEvent2: false,
        innRatEvent2StayCount: 0,
        ratEvent2BattleFought: false,
      });
      const beforeEither = read();

      RPG.State.flags.innRatEvent2StayCount = 1;
      const stayOnly = read();

      RPG.State.flags.innRatEvent2StayCount = 0;
      RPG.State.flags.ratEvent2BattleFought = true;
      const battleOnly = read();

      RPG.State.flags.innRatEvent2StayCount = 1;
      const both = read();

      return { beforeEither, stayOnly, battleOnly, both };
    });

    expect(labels.beforeEither).not.toBe('チューチュー❗️');
    expect(labels.stayOnly).not.toBe('チューチュー❗️');
    expect(labels.battleOnly).not.toBe('チューチュー❗️');
    expect(labels.both).toBe('チューチュー❗️');
  });

  test('2. after both inn rat battles and one ordinary battle win, observe becomes the innkeeper consult', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: { innRatEvent: true, innRatEvent2: true, repairConsultBattleFought: true },
    });
    const label = await page.locator('#btnInnObserve').textContent();
    expect(label).toBe('店主の相談');
  });

  test('2b. both inn rat battles done but no ordinary battle won yet keeps the consult hidden', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: { innRatEvent: true, innRatEvent2: true, repairConsultBattleFought: false },
    });
    const label = await page.locator('#btnInnObserve').textContent();
    expect(label).not.toBe('店主の相談');
  });

  test('2c. winning the scripted inn rat battle 1 (normal_rat) does not itself satisfy its own ordinary-battle gate', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: { innRatEvent: true, innRatEvent2: false, ratEvent2BattleFought: false },
    });
    await page.evaluate(() => {
      RPG.State.currentEnemy = { ...RPG.Assets.ENEMIES.find(e => e.id === 'normal_rat') };
      RPG.State.lastBlowBy = 'Cain';
      RPG.State.isBattling = true;
      battleSystem.endBattle(true);
    });
    await drainDialogue(page);
    const flag = await page.evaluate(() => RPG.State.flags.ratEvent2BattleFought);
    expect(flag).toBe(false);
  });

  test('2d. winning a genuinely separate ordinary battle after inn rat battle 1 does satisfy the gate', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: { innRatEvent: true, innRatEvent2: false, ratEvent2BattleFought: false },
    });
    await page.evaluate(() => {
      RPG.State.currentEnemy = { ...RPG.Assets.ENEMIES.find(e => e.id === 'eye_eating_crow') };
      RPG.State.lastBlowBy = 'Cain';
      RPG.State.isBattling = true;
      battleSystem.endBattle(true);
    });
    await drainDialogue(page);
    const flag = await page.evaluate(() => RPG.State.flags.ratEvent2BattleFought);
    expect(flag).toBe(true);
  });

  test('2e. winning the scripted inn rat battle 2 (rat, event-2-active) does not itself satisfy its own ordinary-battle gate', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: {
        innRatEvent: true, innRatEvent2: true, innRatEvent2BattleActive: true,
        innRepairConsultSeen: false, repairConsultBattleFought: false,
      },
    });
    await page.evaluate(() => {
      RPG.State.currentEnemy = { ...RPG.Assets.ENEMIES.find(e => e.id === 'rat') };
      RPG.State.lastBlowBy = 'Cain';
      RPG.State.isBattling = true;
      battleSystem.endBattle(true);
    });
    await drainDialogue(page);
    const flag = await page.evaluate(() => RPG.State.flags.repairConsultBattleFought);
    expect(flag).toBe(false);
  });

  test('2f. winning a later, genuinely separate wild rat battle (event-2 no longer active) does satisfy the consult gate', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: {
        innRatEvent: true, innRatEvent2: true, innRatEvent2BattleActive: false,
        innRepairConsultSeen: false, repairConsultBattleFought: false,
      },
    });
    await page.evaluate(() => {
      RPG.State.currentEnemy = { ...RPG.Assets.ENEMIES.find(e => e.id === 'rat') };
      RPG.State.lastBlowBy = 'Cain';
      RPG.State.isBattling = true;
      battleSystem.endBattle(true);
    });
    await drainDialogue(page);
    const flag = await page.evaluate(() => RPG.State.flags.repairConsultBattleFought);
    expect(flag).toBe(true);
  });

  test('3. choosing the innkeeper consult plays the specified dialogue once', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: { innRatEvent: true, innRatEvent2: true, repairConsultBattleFought: true },
    });

    await page.evaluate(() => innSystem.observe());
    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      seen: RPG.State.flags.innRepairConsultSeen,
      mode: RPG.State.mode,
      logHasFirstLine: document.getElementById('logContainer')?.textContent.includes('店主「ちょっと相談があるんだが」'),
      logHasLastLine: document.getElementById('logContainer')?.textContent.includes('魔界のネズミをもっと減らそう'),
    }));
    expect(result).toEqual({ seen: true, mode: 'base', logHasFirstLine: true, logHasLastLine: true });

    // A second observe() call must not replay the consult (it already fell through to normal observe).
    await page.evaluate(() => innSystem.observe());
    await drainDialogue(page);
    const occurrences = await page.evaluate(() => {
      const text = document.getElementById('logContainer')?.textContent || '';
      return text.split('店主「ちょっと相談があるんだが」').length - 1;
    });
    expect(occurrences).toBe(1);
  });

  test('4. after the dialogue ends, the observe label returns to normal', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: { innRatEvent: true, innRatEvent2: true, repairConsultBattleFought: true },
    });
    await page.evaluate(() => innSystem.observe());
    await drainDialogue(page);

    const label = await page.locator('#btnInnObserve').textContent();
    expect(label).not.toBe('店主の相談');
  });

  test('5. the consult-seen state survives a save/reload', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.innRepairConsultSeen = true;
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_repair_consult_test', JSON.stringify(snapshot));

      RPG.State.flags.innRepairConsultSeen = false;
      uiControl.loadFromStorage('okai_rpg_repair_consult_test', 'テスト');

      return RPG.State.flags.innRepairConsultSeen;
    });
    expect(result).toBe(true);
  });

  test('6. the innkeeper consult stays hidden during the phase4 fortune route', async ({ page }) => {
    await setCleanInnBaseline(page, {
      state: { storyPhase: 4 },
      flags: {
        innRatEvent: true,
        innRatEvent2: true,
        repairConsultBattleFought: true,
        phase4TheftDiscovered: true,
        thiefDiscoveryStatus: 0,
      },
    });
    const label = await page.locator('#btnInnObserve').textContent();
    expect(label).not.toBe('店主の相談');
  });

  test('7. the innkeeper consult reappears once the priority route resolves', async ({ page }) => {
    await setCleanInnBaseline(page, {
      state: { storyPhase: 4 },
      flags: {
        innRatEvent: true,
        innRatEvent2: true,
        repairConsultBattleFought: true,
        phase4TheftDiscovered: true,
        thiefDiscoveryStatus: 1, // fortune route no longer active (requires === 0)
      },
    });
    const label = await page.locator('#btnInnObserve').textContent();
    expect(label).toBe('店主の相談');
  });

  test('8. rat kill counts are preserved regardless of consult state', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: { innRatEvent: false, innRatEvent2: false },
      defeatCountsRat: { cain: 12, owen: 9 },
    });
    const before = await page.evaluate(() => ({ ...RPG.State.defeatCounts.rat }));
    await page.evaluate(() => uiControl.updateUI());
    const after = await page.evaluate(() => ({ ...RPG.State.defeatCounts.rat }));
    expect(after).toEqual(before);
    expect(after.cain + after.owen).toBe(21);
  });

  test('9. reaching 20 cumulative rat kills alone does not unlock the repair next stage', async ({ page }) => {
    await setCleanInnBaseline(page, { defeatCountsRat: { cain: 20, owen: 0 } });
    const result = await page.evaluate(() => RPG.State.flags.ratBounty20Received);
    expect(result).toBe(false);
  });

  test('10. claiming the rat-20 reward to completion unlocks the repair next stage', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: { ratBounty10Received: true }, // so claimNotebookRewards() picks the rat-20 branch
      defeatCountsRat: { cain: 20, owen: 0 },
    });

    await page.evaluate(() => innSystem.claimNotebookRewards());
    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      ratBounty20Received: RPG.State.flags.ratBounty20Received,
      logHasLine: document.getElementById('logContainer')?.textContent.includes('おかげさまで、宿屋の周りには魔界のネズミが出なくなりました'),
      logHasItemLine: document.getElementById('logContainer')?.textContent.includes('🩹傷薬もどきを3個受け取った！'),
      fakeWoundMedicine: RPG.State.inventory.fakeWoundMedicine,
      mode: RPG.State.mode,
    }));
    expect(result).toEqual({
      ratBounty20Received: true, logHasLine: true, logHasItemLine: true, fakeWoundMedicine: 3, mode: 'base',
    });
  });

  test('11. the repair-unlock state holds even when the consult is seen after the reward', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: { ratBounty10Received: true },
      defeatCountsRat: { cain: 20, owen: 0 },
    });
    await page.evaluate(() => innSystem.claimNotebookRewards());
    await drainDialogue(page);
    const unlockedBeforeConsult = await page.evaluate(() => RPG.State.flags.ratBounty20Received);
    expect(unlockedBeforeConsult).toBe(true);

    await page.evaluate(() => {
      RPG.State.flags.innRatEvent = true;
      RPG.State.flags.innRatEvent2 = true;
      RPG.State.flags.repairConsultBattleFought = true;
    });
    await page.evaluate(() => innSystem.observe());
    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      consultSeen: RPG.State.flags.innRepairConsultSeen,
      unlocked: RPG.State.flags.ratBounty20Received,
    }));
    expect(result).toEqual({ consultSeen: true, unlocked: true });
  });

  test('12. no new repair command or cleaning event is introduced by this change', async ({ page }) => {
    const result = await page.evaluate(() => ({
      hasCleanupButton: !!document.getElementById('btnInnCleanup'),
      innUiButtonCount: document.querySelectorAll('#innUI button').length,
      hasCleanupFn: typeof innSystem.playInnRepairCleanup === 'function',
    }));
    expect(result).toEqual({ hasCleanupButton: false, innUiButtonCount: 6, hasCleanupFn: false });
  });

  test('13. regression - rat-10 reward, stay, defeat return, fortune route, and both inn rat battles still work', async ({ page }) => {
    // Rat-10 reward still claimable independently of the new rat-20 tier.
    await setCleanInnBaseline(page, { defeatCountsRat: { cain: 6, owen: 4 } });
    await page.evaluate(() => innSystem.claimNotebookRewards());
    await drainDialogue(page);
    const rat10 = await page.evaluate(() => ({
      herb: RPG.State.inventory.herb,
      received: RPG.State.flags.ratBounty10Received,
    }));
    expect(rat10.received).toBe(true);
    expect(rat10.herb).toBeGreaterThanOrEqual(3);

    // First and second inn rat battle triggers still flip their flags via observe().
    // startBattle() is stubbed so this only verifies the dispatch/flag wiring, not the
    // full battle engine (which schedules its own async turn timers we don't want
    // dangling into the next section of this test).
    const battleTriggerResult = await page.evaluate(() => {
      const originalStartBattle = battleSystem.startBattle;
      const startedWith = [];
      battleSystem.startBattle = (enemyId) => { startedWith.push(enemyId); };

      Object.assign(RPG.State, { mode: 'base', storyPhase: 1, silverCoins: 1 });
      Object.assign(RPG.State.flags, {
        hasFoundFirstCoin: true,
        amberMerchantRecognized: true,
        innRatEvent: false,
        innRatEvent2: false,
        innRatEvent2StayCount: 0,
      });
      RPG.State.inventory.silverCoin = 1;
      RPG.State.isBattling = false;
      RPG.State.currentEnemy = null;

      innSystem.observe(); // queues the first-rat dialogue, ending in the action below
      // Plain-text entries advance on tap; the trailing action-only entry runs without one.
      for (let i = 0; i < 10 && RPG.State.mode === 'event'; i++) uiControl.handlePlayerInput();

      const afterFirst = { innRatEvent: RPG.State.flags.innRatEvent, startedWith: [...startedWith] };

      RPG.State.mode = 'base';
      RPG.State.isBattling = false;
      RPG.State.currentEnemy = null;
      RPG.State.flags.innRatEvent2StayCount = 1;
      RPG.State.flags.ratEvent2BattleFought = true;

      innSystem.observe();
      for (let i = 0; i < 10 && RPG.State.mode === 'event'; i++) uiControl.handlePlayerInput();

      const afterSecond = {
        innRatEvent2: RPG.State.flags.innRatEvent2,
        innRatEvent2BattleActive: RPG.State.flags.innRatEvent2BattleActive,
        startedWith: [...startedWith],
      };

      battleSystem.startBattle = originalStartBattle;
      RPG.State.isBattling = false;
      RPG.State.currentEnemy = null;
      RPG.State.mode = 'base';

      return { afterFirst, afterSecond };
    });

    expect(battleTriggerResult.afterFirst.innRatEvent).toBe(true);
    expect(battleTriggerResult.afterFirst.startedWith).toContain('normal_rat');
    expect(battleTriggerResult.afterSecond.innRatEvent2).toBe(true);
    expect(battleTriggerResult.afterSecond.innRatEvent2BattleActive).toBe(true);
    expect(battleTriggerResult.afterSecond.startedWith).toContain('rat');

    // Phase4 fortune route still takes priority over everything else.
    await setCleanInnBaseline(page, {
      state: { storyPhase: 4 },
      flags: {
        innRatEvent: true,
        innRatEvent2: true,
        phase4TheftDiscovered: true,
        thiefDiscoveryStatus: 0,
        phase4FortuneConsultDone: false,
      },
    });
    const fortuneLabel = await page.locator('#btnInnObserve').textContent();
    expect(fortuneLabel).not.toBe('店主の相談');
    expect(fortuneLabel).not.toBe('様子を見る');
  });

  // --- 被害点検 (damage inspection) ---

  test('14. rat-20 bounty is not claimable at 19 rat kills', async ({ page }) => {
    await setCleanInnBaseline(page, { defeatCountsRat: { cain: 10, owen: 9 } });
    const result = await page.evaluate(() => innSystem.getRatBounty20Reward());
    expect(result).toBeNull();
  });

  test('15. the rat-20 bounty grants exactly 3 fakeWoundMedicine', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: { ratBounty10Received: true }, // force claimNotebookRewards() onto the rat-20 branch
      defeatCountsRat: { cain: 20, owen: 0 },
    });
    await page.evaluate(() => { RPG.State.inventory.fakeWoundMedicine = 0; });
    await page.evaluate(() => innSystem.claimNotebookRewards());
    await drainDialogue(page);
    const result = await page.evaluate(() => RPG.State.inventory.fakeWoundMedicine);
    expect(result).toBe(3);
  });

  test('16. the rat-20 bounty cannot be claimed twice', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: { ratBounty10Received: true },
      defeatCountsRat: { cain: 20, owen: 0 },
    });
    await page.evaluate(() => { RPG.State.inventory.fakeWoundMedicine = 0; });
    await page.evaluate(() => innSystem.claimNotebookRewards());
    await drainDialogue(page);
    const firstAmount = await page.evaluate(() => RPG.State.inventory.fakeWoundMedicine);

    await page.evaluate(() => innSystem.claimNotebookRewards());
    await drainDialogue(page);
    const secondAmount = await page.evaluate(() => RPG.State.inventory.fakeWoundMedicine);

    expect(firstAmount).toBe(3);
    expect(secondAmount).toBe(3);
  });

  test('17. reaching 20 rat kills alone does not unlock the inspection', async ({ page }) => {
    await setCleanInnBaseline(page, { defeatCountsRat: { cain: 20, owen: 0 } });
    const result = await page.evaluate(() => RPG.State.flags.innRepairInspectionUnlocked);
    expect(result).toBe(false);
  });

  test('17b. consult + bounty done but the second silver coin not yet mined keeps the inspection locked', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: {
        innRatEvent: true, innRatEvent2: true, repairConsultBattleFought: true,
        ratBounty10Received: true, amberTreeCoinMined: false,
      },
      defeatCountsRat: { cain: 20, owen: 0 },
    });
    await page.evaluate(() => innSystem.observe()); // plays the consult
    await drainDialogue(page);
    await page.evaluate(() => innSystem.claimNotebookRewards()); // claims the rat-20 bounty
    await drainDialogue(page);
    const result = await page.evaluate(() => RPG.State.flags.innRepairInspectionUnlocked);
    expect(result).toBe(false);
  });

  test('17c. mining the second silver coin last unlocks the inspection once the consult and bounty are already done', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: {
        innRatEvent: true, innRatEvent2: true, repairConsultBattleFought: true,
        ratBounty10Received: true, amberTreeCoinMined: false,
        treeDefeated: true, borrowedMiningKnifeReceived: true,
      },
      defeatCountsRat: { cain: 20, owen: 0 },
    });
    await page.evaluate(() => innSystem.observe()); // plays the consult
    await drainDialogue(page);
    await page.evaluate(() => innSystem.claimNotebookRewards()); // claims the rat-20 bounty
    await drainDialogue(page);
    const beforeMining = await page.evaluate(() => RPG.State.flags.innRepairInspectionUnlocked);
    expect(beforeMining).toBe(false);

    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base', isAtInn: false, isInDungeon: true, explorationArea: 'forest', currentDistance: 8,
      });
      RPG.State.inventory.borrowedMiningKnife = 1;
      uiControl.updateUI();
      explorationSystem.talk();
    });
    await drainDialogue(page);

    const afterMining = await page.evaluate(() => ({
      unlocked: RPG.State.flags.innRepairInspectionUnlocked,
      mined: RPG.State.flags.amberTreeCoinMined,
    }));
    expect(afterMining).toEqual({ unlocked: true, mined: true });
  });

  test('18. consult done + rat-20 bounty claimed unlocks the inspection', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: {
        innRatEvent: true, innRatEvent2: true, repairConsultBattleFought: true,
        ratBounty10Received: true, amberTreeCoinMined: true,
      },
      defeatCountsRat: { cain: 20, owen: 0 },
    });

    await page.evaluate(() => innSystem.observe()); // plays the consult
    await drainDialogue(page);
    const afterConsult = await page.evaluate(() => RPG.State.flags.innRepairInspectionUnlocked);
    expect(afterConsult).toBe(false);

    await page.evaluate(() => innSystem.claimNotebookRewards()); // claims the rat-20 bounty
    await drainDialogue(page);
    const afterReward = await page.evaluate(() => RPG.State.flags.innRepairInspectionUnlocked);
    expect(afterReward).toBe(true);
  });

  test('19. reversing the achievement order (reward before consult) still unlocks the inspection', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: {
        innRatEvent: true, innRatEvent2: true, repairConsultBattleFought: true,
        ratBounty10Received: true, amberTreeCoinMined: true,
      },
      defeatCountsRat: { cain: 20, owen: 0 },
    });

    await page.evaluate(() => innSystem.claimNotebookRewards());
    await drainDialogue(page);
    const afterReward = await page.evaluate(() => RPG.State.flags.innRepairInspectionUnlocked);
    expect(afterReward).toBe(false);

    await page.evaluate(() => innSystem.observe());
    await drainDialogue(page);
    const afterConsult = await page.evaluate(() => RPG.State.flags.innRepairInspectionUnlocked);
    expect(afterConsult).toBe(true);
  });

  test('20. unlocking the inspection produces no extra dialogue beyond the triggering event', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: {
        innRatEvent: true, innRatEvent2: true, repairConsultBattleFought: true,
        ratBounty10Received: true, amberTreeCoinMined: true,
      },
      defeatCountsRat: { cain: 20, owen: 0 },
    });
    await page.evaluate(() => innSystem.claimNotebookRewards());
    await drainDialogue(page);
    await page.evaluate(() => { document.getElementById('logContainer').innerHTML = ''; });

    await page.evaluate(() => innSystem.observe()); // this call both plays the consult and unlocks inspection
    await drainDialogue(page);
    const logText = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
    expect(logText).toContain('店主「ちょっと相談があるんだが」');
    expect(logText).not.toContain('解禁');
    expect(logText).not.toContain('点検');
  });

  test('21. the inn front shows 外壁の大穴 when unlocked and uninspected', async ({ page }) => {
    const label = await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: false, isInDungeon: false });
      Object.assign(RPG.State.flags, { innRepairInspectionUnlocked: true, innRepairHoleInspected: false });
      uiControl.updateUI();
      return document.getElementById('btnTalk')?.textContent;
    });
    expect(label).toBe('外壁の大穴');
  });

  test('22. the forest entrance shows ネズミの糞 when unlocked and uninspected', async ({ page }) => {
    const label = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base', isAtInn: false, isInDungeon: true, explorationArea: 'forest', currentDistance: 0,
      });
      Object.assign(RPG.State.flags, {
        innRepairInspectionUnlocked: true, innRepairDroppingsInspected: false, amberMerchantMovedToForest: false,
      });
      uiControl.updateUI();
      return document.getElementById('btnTalk')?.textContent;
    });
    expect(label).toBe('ネズミの糞');
  });

  test('23. rat droppings take priority over the amber merchant while uninspected', async ({ page }) => {
    const label = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base', isAtInn: false, isInDungeon: true, explorationArea: 'forest', currentDistance: 0,
      });
      Object.assign(RPG.State.flags, {
        innRepairInspectionUnlocked: true, innRepairDroppingsInspected: false, amberMerchantMovedToForest: true,
      });
      uiControl.updateUI();
      return document.getElementById('btnTalk')?.textContent;
    });
    expect(label).toBe('ネズミの糞');
  });

  test('24. after the droppings inspection, the forest entrance label returns to 琥珀商', async ({ page }) => {
    const before = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base', isAtInn: false, isInDungeon: true, explorationArea: 'forest', currentDistance: 0,
      });
      Object.assign(RPG.State.flags, {
        innRepairInspectionUnlocked: true, innRepairDroppingsInspected: false, amberMerchantMovedToForest: true,
      });
      uiControl.updateUI();
      const label = document.getElementById('btnTalk')?.textContent;
      explorationSystem.talk();
      return { label, mode: RPG.State.mode };
    });
    expect(before.label).toBe('ネズミの糞');
    expect(before.mode).toBe('event');

    await drainDialogue(page);

    const after = await page.evaluate(() => ({
      inspected: RPG.State.flags.innRepairDroppingsInspected,
      label: document.getElementById('btnTalk')?.textContent,
      mode: RPG.State.mode,
    }));
    expect(after).toEqual({ inspected: true, label: '琥珀商', mode: 'base' });
  });

  test('25. the inn shows 齧られた柱 when unlocked and the pillar is uninspected', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: { innRepairInspectionUnlocked: true, innRepairPillarInspected: false },
    });
    const label = await page.locator('#btnInnObserve').textContent();
    expect(label).toBe('齧られた柱');
  });

  test('26. all three inspections can be completed in any order', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Pillar first (inn).
      Object.assign(RPG.State, { mode: 'base', isAtInn: true, isInDungeon: false });
      Object.assign(RPG.State.flags, {
        innRepairInspectionUnlocked: true,
        innRepairHoleInspected: false,
        innRepairDroppingsInspected: false,
        innRepairPillarInspected: false,
        hasFoundFirstCoin: false, amberMerchantRecognized: false, treeDefeated: false,
        firstAmberAppraisalDone: false, phase4TheftDiscovered: false, herbGardenFortuneConsultUnlocked: false,
        innRatEvent: true, innRatEvent2: true, innRepairConsultSeen: true, repairConsultBattleFought: true,
      });
      uiControl.updateUI();
      innSystem.observe();
      for (let i = 0; i < 20 && RPG.State.mode === 'event'; i++) uiControl.handlePlayerInput();
      const pillarDone = RPG.State.flags.innRepairPillarInspected;

      // Hole second (inn front).
      RPG.State.mode = 'base';
      RPG.State.isAtInn = false;
      RPG.State.isInDungeon = false;
      uiControl.updateUI();
      explorationSystem.talk();
      for (let i = 0; i < 20 && RPG.State.mode === 'event'; i++) uiControl.handlePlayerInput();
      const holeDone = RPG.State.flags.innRepairHoleInspected;

      // Droppings third (forest entrance).
      RPG.State.mode = 'base';
      RPG.State.isInDungeon = true;
      RPG.State.explorationArea = 'forest';
      RPG.State.currentDistance = 0;
      uiControl.updateUI();
      explorationSystem.talk();
      for (let i = 0; i < 20 && RPG.State.mode === 'event'; i++) uiControl.handlePlayerInput();
      const droppingsDone = RPG.State.flags.innRepairDroppingsInspected;

      return { pillarDone, holeDone, droppingsDone, allDone: innSystem.hasCompletedInnRepairInspection() };
    });
    expect(result).toEqual({ pillarDone: true, holeDone: true, droppingsDone: true, allDone: true });
  });

  test('27. each inspection only fires once', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true, isInDungeon: false });
      Object.assign(RPG.State.flags, {
        innRepairInspectionUnlocked: true, innRepairPillarInspected: false,
        hasFoundFirstCoin: false, amberMerchantRecognized: false, treeDefeated: false,
        firstAmberAppraisalDone: false, phase4TheftDiscovered: false, herbGardenFortuneConsultUnlocked: false,
        innRatEvent: true, innRatEvent2: true, innRepairConsultSeen: true, repairConsultBattleFought: true,
      });
      uiControl.updateUI();
      innSystem.observe();
      for (let i = 0; i < 20 && RPG.State.mode === 'event'; i++) uiControl.handlePlayerInput();
      const firstLog = document.getElementById('logContainer')?.textContent || '';
      const occurrencesFirst = firstLog.split('入口近くの柱にはネズミの歯形').length - 1;

      RPG.State.mode = 'base';
      uiControl.updateUI();
      const labelAfter = document.getElementById('btnInnObserve')?.textContent;
      innSystem.observe(); // should not replay the pillar scene
      for (let i = 0; i < 20 && RPG.State.mode === 'event'; i++) uiControl.handlePlayerInput();
      const secondLog = document.getElementById('logContainer')?.textContent || '';
      const occurrencesSecond = secondLog.split('入口近くの柱にはネズミの歯形').length - 1;

      return { occurrencesFirst, labelAfter, occurrencesSecond };
    });
    expect(result.occurrencesFirst).toBe(1);
    expect(result.labelAfter).not.toBe('齧られた柱');
    expect(result.occurrencesSecond).toBe(1);
  });

  test('28. progress after one or two completed inspections survives save/reload', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.innRepairInspectionUnlocked = true;
      RPG.State.flags.innRepairHoleInspected = true;
      RPG.State.flags.innRepairDroppingsInspected = false;
      RPG.State.flags.innRepairPillarInspected = false;
      const snapshot1 = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_inspect_test_1', JSON.stringify(snapshot1));

      RPG.State.flags.innRepairDroppingsInspected = true;
      const snapshot2 = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_inspect_test_2', JSON.stringify(snapshot2));

      RPG.State.flags.innRepairHoleInspected = false;
      RPG.State.flags.innRepairDroppingsInspected = false;
      uiControl.loadFromStorage('okai_rpg_inspect_test_1', 'テスト1');
      const afterLoad1 = {
        hole: RPG.State.flags.innRepairHoleInspected,
        droppings: RPG.State.flags.innRepairDroppingsInspected,
        pillar: RPG.State.flags.innRepairPillarInspected,
      };

      RPG.State.flags.innRepairHoleInspected = false;
      RPG.State.flags.innRepairDroppingsInspected = false;
      uiControl.loadFromStorage('okai_rpg_inspect_test_2', 'テスト2');
      const afterLoad2 = {
        hole: RPG.State.flags.innRepairHoleInspected,
        droppings: RPG.State.flags.innRepairDroppingsInspected,
        pillar: RPG.State.flags.innRepairPillarInspected,
      };

      return { afterLoad1, afterLoad2 };
    });
    expect(result.afterLoad1).toEqual({ hole: true, droppings: false, pillar: false });
    expect(result.afterLoad2).toEqual({ hole: true, droppings: true, pillar: false });
  });

  test('29. after all three inspections, the inn shows 報告する', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: {
        innRepairInspectionUnlocked: true,
        innRepairHoleInspected: true,
        innRepairDroppingsInspected: true,
        innRepairPillarInspected: true,
        innRepairInspectionReported: false,
      },
    });
    const label = await page.locator('#btnInnObserve').textContent();
    expect(label).toBe('報告する');
  });

  test('30. existing high-priority inn events still take precedence over 齧られた柱/報告する', async ({ page }) => {
    await setCleanInnBaseline(page, {
      state: { storyPhase: 4 },
      flags: {
        innRepairInspectionUnlocked: true,
        innRepairHoleInspected: true, innRepairDroppingsInspected: true, innRepairPillarInspected: true,
        innRepairInspectionReported: false,
        phase4TheftDiscovered: true, thiefDiscoveryStatus: 0,
      },
    });
    const label = await page.locator('#btnInnObserve').textContent();
    expect(label).not.toBe('報告する');
    expect(label).not.toBe('齧られた柱');
  });

  test('31. once the priority route resolves, 報告する reappears', async ({ page }) => {
    await setCleanInnBaseline(page, {
      state: { storyPhase: 4 },
      flags: {
        innRepairInspectionUnlocked: true,
        innRepairHoleInspected: true, innRepairDroppingsInspected: true, innRepairPillarInspected: true,
        innRepairInspectionReported: false,
        phase4TheftDiscovered: true, thiefDiscoveryStatus: 1, // fortune route resolved
      },
    });
    const label = await page.locator('#btnInnObserve').textContent();
    expect(label).toBe('報告する');
  });

  test('32. after reporting, the inn observe label returns to normal', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: {
        innRepairInspectionUnlocked: true,
        innRepairHoleInspected: true, innRepairDroppingsInspected: true, innRepairPillarInspected: true,
        innRepairInspectionReported: false,
      },
    });
    await page.evaluate(() => innSystem.observe());
    await drainDialogue(page);
    const label = await page.locator('#btnInnObserve').textContent();
    expect(label).not.toBe('報告する');
    expect(label).not.toBe('齧られた柱');
  });

  test('33. reporting sets the timber-search-unlocked flag and re-locks the inspection stage', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: {
        innRepairInspectionUnlocked: true,
        innRepairHoleInspected: true, innRepairDroppingsInspected: true, innRepairPillarInspected: true,
        innRepairInspectionReported: false, innRepairTimberSearchUnlocked: false,
      },
    });
    await page.evaluate(() => innSystem.observe());
    await drainDialogue(page);
    const result = await page.evaluate(() => ({
      reported: RPG.State.flags.innRepairInspectionReported,
      timberUnlocked: RPG.State.flags.innRepairTimberSearchUnlocked,
      inspectionUnlocked: RPG.State.flags.innRepairInspectionUnlocked,
    }));
    expect(result).toEqual({ reported: true, timberUnlocked: true, inspectionUnlocked: false });
  });

  // --- 木材取得 (amber tree timber retrieval) ---

  test('34. after the report, forest 8m examine triggers the timber-retrieval event (label shows 倒れた琥珀樹, then reverts to 調べる)', async ({ page }) => {
    const before = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base', isAtInn: false, isInDungeon: true, explorationArea: 'forest', currentDistance: 8,
      });
      Object.assign(RPG.State.flags, {
        innRepairInspectionReported: true,
        innRepairTimberSearchUnlocked: true,
        innRepairTimberObtained: false,
        treeDefeated: true, amberTreeCoinMined: true,
      });
      RPG.State.inventory.amberTreeTimber = 0;
      uiControl.updateUI();
      const btnTalk = document.getElementById('btnTalk');
      return { text: btnTalk?.textContent, disabled: btnTalk?.disabled };
    });
    expect(before).toEqual({ text: '倒れた琥珀樹', disabled: false });

    await page.evaluate(() => explorationSystem.talk());
    await drainDialogue(page);

    const after = await page.evaluate(() => ({
      obtained: RPG.State.flags.innRepairTimberObtained,
      timber: RPG.State.inventory.amberTreeTimber,
      mode: RPG.State.mode,
      label: document.getElementById('btnTalk')?.textContent,
    }));
    expect(after).toEqual({ obtained: true, timber: 1, mode: 'base', label: '調べる' });
  });

  test('35. the timber event does not trigger before the repair report is completed', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base', isAtInn: false, isInDungeon: true, explorationArea: 'forest', currentDistance: 8,
      });
      Object.assign(RPG.State.flags, {
        innRepairInspectionReported: false,
        innRepairTimberSearchUnlocked: false,
        innRepairTimberObtained: false,
        treeDefeated: true, amberTreeCoinMined: true,
      });
      uiControl.updateUI();
      explorationSystem.talk();
      return {
        mode: RPG.State.mode,
        obtained: RPG.State.flags.innRepairTimberObtained,
        logHasLine: document.getElementById('logContainer')?.textContent.includes('大きな琥珀樹が倒れている'),
      };
    });
    expect(result).toEqual({ mode: 'base', obtained: false, logHasLine: false });
  });

  test('36. an unfinished silver-coin mining event still takes priority over the timber event at 8m', async ({ page }) => {
    const beforeLabel = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base', isAtInn: false, isInDungeon: true, explorationArea: 'forest', currentDistance: 8,
      });
      Object.assign(RPG.State.flags, {
        innRepairInspectionReported: true,
        innRepairTimberSearchUnlocked: true,
        innRepairTimberObtained: false,
        treeDefeated: true, amberTreeCoinMined: false,
      });
      RPG.State.inventory.borrowedMiningKnife = 1;
      RPG.State.inventory.amberTreeTimber = 0;
      uiControl.updateUI();
      return document.getElementById('btnTalk')?.textContent;
    });
    expect(beforeLabel).toBe('埋まった銀貨を掘る');

    await page.evaluate(() => explorationSystem.talk());
    await drainDialogue(page);

    const afterMining = await page.evaluate(() => ({
      amberTreeCoinMined: RPG.State.flags.amberTreeCoinMined,
      timberObtained: RPG.State.flags.innRepairTimberObtained,
      logHasMiningLine: document.getElementById('logContainer')?.textContent.includes('🪙銀貨を手に入れた'),
      logHasTimberLine: document.getElementById('logContainer')?.textContent.includes('大きな琥珀樹が倒れている'),
    }));
    expect(afterMining).toEqual({
      amberTreeCoinMined: true, timberObtained: false, logHasMiningLine: true, logHasTimberLine: false,
    });

    await page.evaluate(() => explorationSystem.talk());
    await drainDialogue(page);

    const afterTimber = await page.evaluate(() => ({
      timberObtained: RPG.State.flags.innRepairTimberObtained,
      timber: RPG.State.inventory.amberTreeTimber,
      logHasTimberLine: document.getElementById('logContainer')?.textContent.includes('大きな琥珀樹が倒れている'),
    }));
    expect(afterTimber).toEqual({ timberObtained: true, timber: 1, logHasTimberLine: true });
  });

  test('36b. the timber event does not fire on the former highway, which reuses currentDistance 8', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base', isAtInn: false, isInDungeon: true, location: 'かつての街道', currentDistance: 8,
      });
      Object.assign(RPG.State.flags, {
        innRepairInspectionReported: true,
        innRepairTimberSearchUnlocked: true,
        innRepairTimberObtained: false,
        treeDefeated: true, amberTreeCoinMined: true,
      });
      RPG.State.inventory.amberTreeTimber = 0;
      uiControl.updateUI();
      explorationSystem.talk();
      return {
        mode: RPG.State.mode,
        obtained: RPG.State.flags.innRepairTimberObtained,
        timber: RPG.State.inventory.amberTreeTimber,
        logHasTimberLine: document.getElementById('logContainer')?.textContent.includes('大きな琥珀樹が倒れている'),
      };
    });
    expect(result).toEqual({ mode: 'base', obtained: false, timber: 0, logHasTimberLine: false });
  });

  test('37. the timber event plays the specified lines in order', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base', isAtInn: false, isInDungeon: true, explorationArea: 'forest', currentDistance: 8,
      });
      Object.assign(RPG.State.flags, {
        innRepairInspectionReported: true, innRepairTimberSearchUnlocked: true, innRepairTimberObtained: false,
        treeDefeated: true, amberTreeCoinMined: true,
      });
      RPG.State.inventory.amberTreeTimber = 0;
      uiControl.updateUI();
      explorationSystem.talk();
    });
    await drainDialogue(page);

    const logText = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
    const anchors = [
      '大きな琥珀樹が倒れている。',
      'カイン「しまった。ナタを借りて来るべきだった」',
      'オーエン「……ナタ？」',
      'カイン「宿屋を直したい」',
      'オーエン「安全なところなんて、どこにもないのに」',
      'オーエンはため息をつき、片手を振り上げた。',
      'ズババババッ！！！',
      '琥珀樹は、何かの力に切り裂かれた。',
      '《🪵琥珀樹の木材》を手に入れた！',
      'オーエン「これは何かに使えない？」',
      'オーエン「看板とか」',
      'カイン（冗談なのか、判断に迷うな）',
      '宿屋に戻ろう。',
    ];
    let lastIndex = -1;
    for (const line of anchors) {
      const index = logText.indexOf(line);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  test('38. exactly one amber-tree timber is granted, using its proper item name', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base', isAtInn: false, isInDungeon: true, explorationArea: 'forest', currentDistance: 8,
      });
      Object.assign(RPG.State.flags, {
        innRepairInspectionReported: true, innRepairTimberSearchUnlocked: true, innRepairTimberObtained: false,
        treeDefeated: true, amberTreeCoinMined: true,
      });
      RPG.State.inventory.amberTreeTimber = 0;
      uiControl.updateUI();
      explorationSystem.talk();
    });
    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      timber: RPG.State.inventory.amberTreeTimber,
      itemName: RPG.Assets.CONFIG.ITEM_NAME.amberTreeTimber,
    }));
    expect(result.timber).toBe(1);
    expect(result.itemName).toContain('琥珀樹の木材');
    expect(result.itemName).not.toContain('頑丈な木材');
  });

  test('39. the timber event does not replay or double-grant the item', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base', isAtInn: false, isInDungeon: true, explorationArea: 'forest', currentDistance: 8,
      });
      Object.assign(RPG.State.flags, {
        innRepairInspectionReported: true, innRepairTimberSearchUnlocked: true, innRepairTimberObtained: false,
        treeDefeated: true, amberTreeCoinMined: true,
      });
      RPG.State.inventory.amberTreeTimber = 0;
      uiControl.updateUI();
      explorationSystem.talk();
      // Rapid re-click while the event is already playing must be a no-op.
      explorationSystem.talk();
    });
    await drainDialogue(page);

    const afterFirst = await page.evaluate(() => RPG.State.inventory.amberTreeTimber);
    expect(afterFirst).toBe(1);

    await page.evaluate(() => explorationSystem.talk());
    await drainDialogue(page);

    const result = await page.evaluate(() => {
      const text = document.getElementById('logContainer')?.textContent || '';
      return {
        timber: RPG.State.inventory.amberTreeTimber,
        occurrences: text.split('大きな琥珀樹が倒れている。').length - 1,
      };
    });
    expect(result.timber).toBe(1);
    expect(result.occurrences).toBe(1);
  });

  test('40. after obtaining the timber, forest 8m examine returns to the normal inspection', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base', isAtInn: false, isInDungeon: true, explorationArea: 'forest', currentDistance: 8,
      });
      Object.assign(RPG.State.flags, {
        innRepairInspectionReported: true, innRepairTimberSearchUnlocked: true, innRepairTimberObtained: true,
        treeDefeated: true, amberTreeCoinMined: true,
      });
      uiControl.updateUI();
    });
    const result = await page.evaluate(() => {
      document.getElementById('logContainer').innerHTML = '';
      explorationSystem.talk();
      return {
        mode: RPG.State.mode,
        label: document.getElementById('btnTalk')?.textContent,
        logText: document.getElementById('logContainer')?.textContent || '',
      };
    });
    expect(result.mode).toBe('base');
    expect(result.label).toBe('調べる');
    expect(result.logText).not.toContain('大きな琥珀樹が倒れている');
  });

  test('41. pre-obtain timber-search state survives a save/reload', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.innRepairInspectionReported = true;
      RPG.State.flags.innRepairTimberSearchUnlocked = true;
      RPG.State.flags.innRepairTimberObtained = false;
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_timber_test_1', JSON.stringify(snapshot));

      RPG.State.flags.innRepairTimberObtained = true; // corrupt in-memory state before reload
      uiControl.loadFromStorage('okai_rpg_timber_test_1', 'テスト');

      return {
        reported: RPG.State.flags.innRepairInspectionReported,
        searchUnlocked: RPG.State.flags.innRepairTimberSearchUnlocked,
        obtained: RPG.State.flags.innRepairTimberObtained,
      };
    });
    expect(result).toEqual({ reported: true, searchUnlocked: true, obtained: false });
  });

  test('42. the obtained-timber state survives a save/reload', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.innRepairTimberObtained = true;
      RPG.State.inventory.amberTreeTimber = 1;
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_timber_test_2', JSON.stringify(snapshot));

      RPG.State.flags.innRepairTimberObtained = false;
      RPG.State.inventory.amberTreeTimber = 0;
      uiControl.loadFromStorage('okai_rpg_timber_test_2', 'テスト');

      return {
        obtained: RPG.State.flags.innRepairTimberObtained,
        timber: RPG.State.inventory.amberTreeTimber,
      };
    });
    expect(result).toEqual({ obtained: true, timber: 1 });
  });

  test('43. no new inn command or dialogue is introduced by the timber event', async ({ page }) => {
    const staticResult = await page.evaluate(() => ({
      innUiButtonCount: document.querySelectorAll('#innUI button').length,
      hasProcessFn: (
        typeof innSystem.processTimber === 'function' ||
        typeof innSystem.playTimberDelivery === 'function'
      ),
    }));
    expect(staticResult).toEqual({ innUiButtonCount: 6, hasProcessFn: false });

    await setCleanInnBaseline(page, {
      flags: {
        innRepairInspectionReported: true, innRepairTimberSearchUnlocked: true, innRepairTimberObtained: true,
      },
    });
    const label = await page.locator('#btnInnObserve').textContent();
    expect(label).not.toBe('報告する');
    expect(label).not.toBe('齧られた柱');
  });

  test('44. loading a save without any inn-repair-inspection or timber flags does not error', async ({ page }) => {
    const result = await page.evaluate(() => {
      const legacySave = JSON.parse(JSON.stringify(RPG.State));
      delete legacySave.flags.innRepairInspectionUnlocked;
      delete legacySave.flags.innRepairHoleInspected;
      delete legacySave.flags.innRepairDroppingsInspected;
      delete legacySave.flags.innRepairPillarInspected;
      delete legacySave.flags.innRepairInspectionReported;
      delete legacySave.flags.innRepairTimberSearchUnlocked;
      delete legacySave.flags.innRepairTimberObtained;
      delete legacySave.inventory.amberTreeTimber;
      localStorage.setItem('okai_rpg_inspect_legacy_test', JSON.stringify(legacySave));

      let errored = false;
      try {
        uiControl.loadFromStorage('okai_rpg_inspect_legacy_test', 'テスト');
      } catch (e) {
        errored = true;
      }

      return {
        errored,
        unlocked: RPG.State.flags.innRepairInspectionUnlocked,
        hole: RPG.State.flags.innRepairHoleInspected,
        droppings: RPG.State.flags.innRepairDroppingsInspected,
        pillar: RPG.State.flags.innRepairPillarInspected,
        reported: RPG.State.flags.innRepairInspectionReported,
        timberSearchUnlocked: RPG.State.flags.innRepairTimberSearchUnlocked,
        timberObtained: RPG.State.flags.innRepairTimberObtained,
        timberCount: RPG.State.inventory.amberTreeTimber,
      };
    });
    expect(result).toEqual({
      errored: false, unlocked: false, hole: false, droppings: false, pillar: false,
      reported: false, timberSearchUnlocked: false, timberObtained: false, timberCount: 0,
    });
  });

  test('45. the innkeeper receives the timber but grants no oils (oils now come from the daughter)', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: {
        innRepairInspectionReported: true,
        innRepairTimberSearchUnlocked: true,
        innRepairTimberObtained: true,
        innRepairTimberDelivered: false,
      },
    });
    await page.evaluate(() => {
      RPG.State.inventory.amberTreeTimber = 1;
      uiControl.updateUI();
    });

    await expect(page.locator('#btnInnObserve')).toHaveText('木材を渡す');
    await page.evaluate(() => innSystem.observe());
    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      timber: RPG.State.inventory.amberTreeTimber,
      shinyOil: RPG.State.inventory.shinyOil,
      hardOil: RPG.State.inventory.hardOil,
      glossyOil: RPG.State.inventory.glossyOil,
      delivered: RPG.State.flags.innRepairTimberDelivered,
      amberRewardReceived: RPG.State.flags.innRepairAmberRewardReceived,
      unknownAmber: RPG.State.inventory.unknownAmber,
      queuedAmberResults: RPG.State.unappraisedAmberResults,
      memo: uiControl.getJourneyMemo(),
      label: document.getElementById('btnInnObserve')?.textContent,
      logText: document.getElementById('logContainer')?.textContent || '',
    }));

    expect(result.timber).toBe(0);
    expect(result.shinyOil).toBe(0);
    expect(result.hardOil).toBe(0);
    expect(result.glossyOil).toBe(0);
    expect(result.delivered).toBe(true);
    expect(result.amberRewardReceived).toBe(true);
    expect(result.unknownAmber).toBe(1);
    expect(result.queuedAmberResults).toEqual(['milkAmber']);
    expect(result.memo).toBe('宿を直すための木材を店主へ渡した。');
    expect(result.label).toBe('様子を見る');
    expect(result.logText).toContain('これなら板に加工できる。ありがとう、助かったよ');
    expect(result.logText).toContain('店主「そうだ。物置にあったやつだが、これやるよ」');
    expect(result.logText).toContain('🔸？琥珀を1個受け取った！');
    expect(result.logText).not.toContain('油を手に入れた');
  });

  test('46. timber delivery cannot replay or double-consume the timber', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: {
        innRepairInspectionReported: true,
        innRepairTimberObtained: true,
        innRepairTimberDelivered: true,
      },
    });
    await page.evaluate(() => {
      RPG.State.inventory.amberTreeTimber = 1;
      uiControl.updateUI();
      innSystem.observe();
    });
    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      canDeliver: innSystem.canDeliverInnRepairTimber(),
      timber: RPG.State.inventory.amberTreeTimber,
      logHasDelivery: (document.getElementById('logContainer')?.textContent || '')
        .includes('これなら板に加工できる'),
    }));
    expect(result).toEqual({
      canDeliver: false,
      timber: 1,
      logHasDelivery: false,
    });
  });

  test('47. the fortune-teller route keeps priority over timber delivery', async ({ page }) => {
    await setCleanInnBaseline(page, {
      state: { storyPhase: 4 },
      flags: {
        phase4TheftDiscovered: true,
        phase4FortuneConsultDone: false,
        innRepairInspectionReported: true,
        innRepairTimberObtained: true,
        innRepairTimberDelivered: false,
      },
    });
    await page.evaluate(() => {
      RPG.State.inventory.amberTreeTimber = 1;
      uiControl.updateUI();
    });

    await expect(page.locator('#btnInnObserve')).toHaveText('占い師に相談');
    await page.evaluate(() => innSystem.observe());
    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      timber: RPG.State.inventory.amberTreeTimber,
      delivered: RPG.State.flags.innRepairTimberDelivered,
      fortuneDone: RPG.State.flags.phase4FortuneConsultDone,
    }));
    expect(result).toEqual({ timber: 1, delivered: false, fortuneDone: true });
  });

  test('48. old saves receive safe defaults for timber delivery, the back-half flags, and all three oils', async ({ page }) => {
    const result = await page.evaluate(() => {
      const legacySave = JSON.parse(JSON.stringify(RPG.State));
      delete legacySave.flags.innRepairTimberDelivered;
      delete legacySave.flags.innRepairHelpStarted;
      delete legacySave.flags.innRepairOilsReceived;
      delete legacySave.flags.innRepairCompleted;
      delete legacySave.inventory.shinyOil;
      delete legacySave.inventory.hardOil;
      delete legacySave.inventory.glossyOil;
      localStorage.setItem('okai_rpg_timber_delivery_legacy_test', JSON.stringify(legacySave));

      uiControl.loadFromStorage('okai_rpg_timber_delivery_legacy_test', 'テスト');
      return {
        delivered: RPG.State.flags.innRepairTimberDelivered,
        helpStarted: RPG.State.flags.innRepairHelpStarted,
        oilsReceived: RPG.State.flags.innRepairOilsReceived,
        completed: RPG.State.flags.innRepairCompleted,
        shinyOil: RPG.State.inventory.shinyOil,
        hardOil: RPG.State.inventory.hardOil,
        glossyOil: RPG.State.inventory.glossyOil,
      };
    });
    expect(result).toEqual({
      delivered: false,
      helpStarted: false,
      oilsReceived: false,
      completed: false,
      shinyOil: 0,
      hardOil: 0,
      glossyOil: 0,
    });
  });

  test('49. completed timber delivery survives save/reload (without granting any oil)', async ({ page }) => {
    await setCleanInnBaseline(page, {
      flags: {
        innRepairInspectionReported: true,
        innRepairTimberObtained: true,
        innRepairTimberDelivered: false,
      },
    });
    await page.evaluate(() => {
      RPG.State.inventory.amberTreeTimber = 1;
      uiControl.updateUI();
      innSystem.observe();
    });
    await drainDialogue(page);

    const result = await page.evaluate(() => {
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_timber_delivery_completed_test', JSON.stringify(snapshot));

      RPG.State.flags.innRepairTimberDelivered = false;
      RPG.State.inventory.amberTreeTimber = 1;
      uiControl.loadFromStorage('okai_rpg_timber_delivery_completed_test', 'テスト');

      return {
        delivered: RPG.State.flags.innRepairTimberDelivered,
        timber: RPG.State.inventory.amberTreeTimber,
        shinyOil: RPG.State.inventory.shinyOil,
        hardOil: RPG.State.inventory.hardOil,
        glossyOil: RPG.State.inventory.glossyOil,
        memo: uiControl.getJourneyMemo(),
      };
    });
    expect(result).toEqual({
      delivered: true,
      timber: 0,
      shinyOil: 0,
      hardOil: 0,
      glossyOil: 0,
      memo: '宿を直すための木材を店主へ渡した。',
    });
  });
});

// --- Inn repair thread, back half: help intro -> daughter's oils -> resume/complete ---

// Reaches a state where the timber has already been delivered and the post-delivery sleep
// is done (the two prerequisites for the back half), then layers overrides on top. Also
// neutralizes every higher-priority observe()/talk() route so back-half tests only exercise
// what's under test.
async function setRepairBackHalfBaseline(page, overrides = {}) {
  await page.evaluate((ov) => {
    Object.assign(RPG.State, {
      mode: 'base',
      isAtInn: false,
      isInDungeon: false,
      explorationArea: null,
      location: '宿屋前',
      currentDistance: 0,
      storyPhase: 6,
      talkPhaseReached: {},
      dialogueQueue: [],
      isWaitingForInput: false,
      ...ov.state,
    });
    Object.assign(RPG.State.flags, {
      hasIntroFinished: true,
      introDebtTalkPending: false,
      innRepairInspectionUnlocked: false,
      innRepairHoleInspected: true,
      innRepairDroppingsInspected: true,
      innRepairPillarInspected: true,
      innRepairInspectionReported: true,
      innRepairTimberSearchUnlocked: true,
      innRepairTimberObtained: true,
      innRepairTimberDelivered: true,
      innRepairHelpStarted: false,
      innRepairOilsReceived: false,
      innRepairCompleted: false,
      silverDelivered: true,
      phase6PostDeliverySleepDone: true,
      chapter1Cleared: false,
      onWagon: false,
      // Left false by default so priority tests can check these are not silently consumed;
      // tests that don't care about Phase6 ordering can override them to true.
      phase6WagonMapTalkDone: false,
      wagonInfoHeard: false,
      phase6RoomTalkDone: false,
      wagonHorseEncouraged: false,
      scentPouchQuestStarted: false,
      phase7DepartureNightSeen: false,
      ...ov.flags,
    });
    RPG.State.inventory.amberTreeTimber = 0;
    RPG.State.inventory.shinyOil = typeof ov.shinyOil === 'number' ? ov.shinyOil : 0;
    RPG.State.inventory.hardOil = typeof ov.hardOil === 'number' ? ov.hardOil : 0;
    RPG.State.inventory.glossyOil = typeof ov.glossyOil === 'number' ? ov.glossyOil : 0;
    RPG.State.isBattling = false;
    RPG.State.currentEnemy = null;
    RPG.State.battleState = null;
    RPG.State.hasOwenIntervened = false;
    uiControl.updateUI();
  }, overrides);
}

async function clickDaughterOilChoice(page, buttonId = 'btnInnRepairOilGlossy') {
  await page.click(`#${buttonId}`);
}

test.describe('宿の修繕・後半 (help intro + daughter\'s oils + resume/complete)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await page.goto('/chapter1.html');
    await page.waitForFunction(() => (
      typeof uiControl !== 'undefined' &&
      typeof innSystem !== 'undefined' &&
      typeof explorationSystem !== 'undefined'
    ));
    await advanceUntilInteractive(page);
  });

  test.describe('解禁条件 (宿屋前【修理を手伝う】)', () => {
    test('does not appear before phase6PostDeliverySleepDone, even with the timber delivered', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        flags: { phase6PostDeliverySleepDone: false },
      });
      await expect(page.locator('#btnTalk')).toHaveText('調べる');
    });

    test('appears at the inn front once both prerequisites are met', async ({ page }) => {
      await setRepairBackHalfBaseline(page);
      await expect(page.locator('#btnTalk')).toHaveText('修理を手伝う');
    });

    test('does not appear without the timber delivered', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        flags: { innRepairTimberDelivered: false },
      });
      await expect(page.locator('#btnTalk')).toHaveText('調べる');
    });

    test('the inn-front 【調べる】/btnTalk label never reads 修理を手伝う in the forest, herb garden, or highway', async ({ page }) => {
      // These scenes route through explorationSystem.talk()'s dungeon branches (this.isInHerbGarden(),
      // the forest dist checks, etc.), which are entirely separate code paths from the
      // `!RPG.State.isInDungeon` inn-front block the repair branches live in - so the button
      // literally cannot show the repair label there, regardless of the repair flags.
      await setRepairBackHalfBaseline(page);

      for (const scene of [
        { explorationArea: 'forest', location: '琥珀の森', currentDistance: 5 },
        { explorationArea: 'herbGarden', location: '薬草園', currentDistance: 3 },
        { explorationArea: 'highway', location: 'かつての街道', currentDistance: 3 },
      ]) {
        await page.evaluate((s) => {
          Object.assign(RPG.State, { isAtInn: false, isInDungeon: true, ...s });
          uiControl.updateUI();
        }, scene);
        const label = await page.locator('#btnTalk').textContent();
        expect(label).not.toBe('修理を手伝う');
      }
    });

    test('battle mode blocks talk()/observe() entirely, so the repair thread cannot advance mid-battle', async ({ page }) => {
      await setRepairBackHalfBaseline(page);
      await page.evaluate(() => {
        RPG.State.isBattling = true;
        RPG.State.currentEnemy = { id: 'rat', name: '魔界のネズミ' };
        RPG.State.mode = 'battle';
        uiControl.updateUI();
      });
      const before = await page.evaluate(() => RPG.State.flags.innRepairHelpStarted);
      await page.evaluate(() => explorationSystem.talk());
      const after = await page.evaluate(() => RPG.State.flags.innRepairHelpStarted);
      expect(before).toBe(false);
      expect(after).toBe(false); // talk()'s mode !== 'base' guard rejected the call
    });

    test('inn-interior talk (innSystem.talk, not the inn-front explorationSystem.talk) is unaffected when the repair thread has not been started', async ({ page }) => {
      await setRepairBackHalfBaseline(page, { state: { isAtInn: true, location: '宿屋《琥珀亭》' } });
      const canPlayOilEvent = await page.evaluate(() => innSystem.shouldPlayDaughterOilEvent());
      expect(canPlayOilEvent).toBe(false);
    });

    test('does not appear after innRepairCompleted', async ({ page }) => {
      await setRepairBackHalfBaseline(page, { flags: { innRepairCompleted: true } });
      await expect(page.locator('#btnTalk')).toHaveText('調べる');
    });

    test('the outer-wall hole inspection still takes priority when uninspected', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        flags: { innRepairInspectionUnlocked: true, innRepairHoleInspected: false },
      });
      await expect(page.locator('#btnTalk')).toHaveText('外壁の大穴');
    });

    test('does not appear after chapter1Cleared', async ({ page }) => {
      await setRepairBackHalfBaseline(page, { flags: { chapter1Cleared: true } });
      const canShow = await page.evaluate(() => innSystem.canShowInnRepairHelpCommand());
      expect(canShow).toBe(false);
    });

    test('does not appear while onWagon', async ({ page }) => {
      await setRepairBackHalfBaseline(page, { flags: { onWagon: true } });
      const canShow = await page.evaluate(() => innSystem.canShowInnRepairHelpCommand());
      expect(canShow).toBe(false);
    });
  });

  test.describe('修理開始', () => {
    test('the first 【修理を手伝う】 plays the intro once and sets innRepairHelpStarted', async ({ page }) => {
      await setRepairBackHalfBaseline(page);
      await page.evaluate(() => explorationSystem.talk());
      await drainDialogue(page);

      const result = await page.evaluate(() => ({
        helpStarted: RPG.State.flags.innRepairHelpStarted,
        logText: document.getElementById('logContainer')?.textContent || '',
      }));
      expect(result.helpStarted).toBe(true);
      expect(result.logText).toContain('店主「やっと雨が上がったな」');
      expect(result.logText).toContain('カイン「テカテカ油だな。分かった！」');
    });

    test('innRepairHelpStarted survives save/reload', async ({ page }) => {
      await setRepairBackHalfBaseline(page, { flags: { innRepairHelpStarted: true } });
      const result = await page.evaluate(() => {
        const snapshot = uiControl.createSaveSnapshot('journal');
        localStorage.setItem('okai_rpg_repair_help_started_test', JSON.stringify(snapshot));
        RPG.State.flags.innRepairHelpStarted = false;
        uiControl.loadFromStorage('okai_rpg_repair_help_started_test', 'テスト');
        return RPG.State.flags.innRepairHelpStarted;
      });
      expect(result).toBe(true);
    });

    test('re-selecting while awaiting oils does not replay the intro, and shows the one-line reminder', async ({ page }) => {
      await setRepairBackHalfBaseline(page, { flags: { innRepairHelpStarted: true } });
      await page.evaluate(() => explorationSystem.talk());

      const result = await page.evaluate(() => ({
        mode: RPG.State.mode,
        logText: document.getElementById('logContainer')?.textContent || '',
      }));
      expect(result.mode).toBe('base'); // no event queue started, single addLog only
      expect(result.logText).toContain('カイン（先に、娘さんからテカテカ油をもらってこよう）');
      expect(result.logText).not.toContain('店主「やっと雨が上がったな」');
    });
  });

  test.describe('娘の油イベント', () => {
    test('does not fire before 修理開始', async ({ page }) => {
      await setRepairBackHalfBaseline(page, { state: { isAtInn: true, location: '宿屋《琥珀亭》' } });
      await page.evaluate(() => innSystem.talk());
      await drainDialogue(page);
      const logText = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
      expect(logText).not.toContain('カウンターには娘がいる。');
    });

    test('takes priority over unfinished Phase6 required conversation', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        state: { isAtInn: true, location: '宿屋《琥珀亭》' },
        flags: { innRepairHelpStarted: true },
      });
      await page.evaluate(() => innSystem.talk());
      await drainDialogue(page);

      const result = await page.evaluate(() => ({
        logText: document.getElementById('logContainer')?.textContent || '',
        wagonMapTalkDone: RPG.State.flags.phase6WagonMapTalkDone,
      }));
      expect(result.logText).toContain('カウンターには娘がいる。');
      expect(result.logText).not.toContain('店主｢それで、あとどのくらい泊まりたいんだ？」');
      // Not consumed - stays available for the next 話す.
      expect(result.wagonMapTalkDone).toBe(false);
    });

    test('after the oil event completes, the unfinished Phase6 required conversation plays normally next', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        state: { isAtInn: true, location: '宿屋《琥珀亭》' },
        flags: { innRepairHelpStarted: true },
      });
      await page.evaluate(() => innSystem.talk());
      await drainDialogue(page); // reaches the choice screen
      await clickDaughterOilChoice(page);
      await drainDialogue(page); // finishes the outro + grant

      await page.evaluate(() => innSystem.talk());
      await drainDialogue(page);

      const result = await page.evaluate(() => ({
        logText: document.getElementById('logContainer')?.textContent || '',
        wagonMapTalkDone: RPG.State.flags.phase6WagonMapTalkDone,
      }));
      expect(result.logText).toContain('店主｢それで、あとどのくらい泊まりたいんだ？」');
      expect(result.wagonMapTalkDone).toBe(true);
    });

    test('takes priority over the Phase7 send-off, which plays normally afterward, undamaged', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        state: { isAtInn: true, location: '宿屋《琥珀亭》', storyPhase: 7 },
        flags: {
          innRepairHelpStarted: true,
          // Phase6 required conversations already resolved, as they would be by Phase7.
          phase6WagonMapTalkDone: true,
          wagonInfoHeard: true,
          phase6RoomTalkDone: true,
        },
      });
      await page.evaluate(() => innSystem.talk());
      await drainDialogue(page);
      let logText = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
      expect(logText).toContain('カウンターには娘がいる。');
      expect(logText).not.toContain('もう出発されるのですか');

      await clickDaughterOilChoice(page);
      await drainDialogue(page);

      // The Phase7 send-off sequence resumes exactly where it should: entry 1 first (the
      // highway history), proving talkPhaseReached[7] was never touched by the oil event.
      await page.evaluate(() => innSystem.talk());
      await drainDialogue(page);
      logText = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
      expect(logText).toContain('森の向こうには昔、街道があったんだ');

      // Entry 2, the send-off line itself, follows on the next 話す, undamaged.
      await page.evaluate(() => innSystem.talk());
      await drainDialogue(page);
      logText = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
      expect(logText).toContain('もう出発されるのですか？');
    });

    test('any of the three choices converges on the same outro and grant', async ({ page }) => {
      for (const buttonId of ['btnInnRepairOilHard', 'btnInnRepairOilShiny', 'btnInnRepairOilGlossy']) {
        await setRepairBackHalfBaseline(page, {
          state: { isAtInn: true, location: '宿屋《琥珀亭》' },
          flags: { innRepairHelpStarted: true },
        });
        await page.evaluate(() => innSystem.talk());
        await drainDialogue(page);
        await clickDaughterOilChoice(page, buttonId);
        await drainDialogue(page);

        const result = await page.evaluate(() => ({
          glossyOil: RPG.State.inventory.glossyOil,
          shinyOil: RPG.State.inventory.shinyOil,
          hardOil: RPG.State.inventory.hardOil,
          oilsReceived: RPG.State.flags.innRepairOilsReceived,
          logText: document.getElementById('logContainer')?.textContent || '',
        }));
        expect(result).toMatchObject({ glossyOil: 1, shinyOil: 1, hardOil: 1, oilsReceived: true });
        expect(result.logText).toContain('カイン（さすがに違うと思いたい）');
      }
    });

    test('interrupting mid-event grants nothing and leaves innRepairOilsReceived false', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        state: { isAtInn: true, location: '宿屋《琥珀亭》' },
        flags: { innRepairHelpStarted: true },
      });
      await page.evaluate(() => innSystem.talk());
      await drainDialogue(page); // reach the choice screen
      await clickDaughterOilChoice(page);
      // Interrupt partway through the outro instead of draining it fully.
      await page.evaluate(() => uiControl.handlePlayerInput());
      await page.waitForTimeout(50);

      const mid = await page.evaluate(() => ({
        oilsReceived: RPG.State.flags.innRepairOilsReceived,
        glossyOil: RPG.State.inventory.glossyOil,
        shinyOil: RPG.State.inventory.shinyOil,
        hardOil: RPG.State.inventory.hardOil,
      }));
      expect(mid).toEqual({ oilsReceived: false, glossyOil: 0, shinyOil: 0, hardOil: 0 });

      // Reset to base and reopen: the full intro+choice+outro plays again from scratch.
      await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.dialogueQueue = [];
        const container = document.getElementById('action-buttons');
        if (container) { container.innerHTML = ''; container.style.display = 'none'; }
      });
      await page.evaluate(() => innSystem.talk());
      await drainDialogue(page);
      const restarted = await page.evaluate(() => (
        document.getElementById('logContainer')?.textContent || ''
      ).includes('カウンターには娘がいる。'));
      expect(restarted).toBe(true);
    });

    test('only finishing the event grants the three oils, exactly once each', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        state: { isAtInn: true, location: '宿屋《琥珀亭》' },
        flags: { innRepairHelpStarted: true },
        shinyOil: 3, // pre-existing stock, e.g. from the bounty notebook
      });
      await page.evaluate(() => innSystem.talk());
      await drainDialogue(page);
      await clickDaughterOilChoice(page);
      await drainDialogue(page);

      const result = await page.evaluate(() => ({
        glossyOil: RPG.State.inventory.glossyOil,
        shinyOil: RPG.State.inventory.shinyOil,
        hardOil: RPG.State.inventory.hardOil,
      }));
      expect(result).toEqual({ glossyOil: 1, shinyOil: 4, hardOil: 1 });
    });

    test('cannot be triggered twice - talk() returns to normal behavior after receipt', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        state: { isAtInn: true, location: '宿屋《琥珀亭》' },
        flags: { innRepairHelpStarted: true, innRepairOilsReceived: true, glossyOil: 1 },
      });
      const canPlay = await page.evaluate(() => innSystem.shouldPlayDaughterOilEvent());
      expect(canPlay).toBe(false);

      await page.evaluate(() => innSystem.talk());
      await drainDialogue(page);
      const logText = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
      expect(logText).not.toContain('カウンターには娘がいる。');
    });

    test('innRepairOilsReceived and the item name survive save/reload', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        flags: { innRepairHelpStarted: true, innRepairOilsReceived: true },
        glossyOil: 1, shinyOil: 1, hardOil: 1,
      });
      const result = await page.evaluate(() => {
        const snapshot = uiControl.createSaveSnapshot('journal');
        localStorage.setItem('okai_rpg_repair_oils_received_test', JSON.stringify(snapshot));
        RPG.State.flags.innRepairOilsReceived = false;
        RPG.State.inventory.glossyOil = 0;
        uiControl.loadFromStorage('okai_rpg_repair_oils_received_test', 'テスト');
        return {
          oilsReceived: RPG.State.flags.innRepairOilsReceived,
          glossyOil: RPG.State.inventory.glossyOil,
          glossyOilName: RPG.Assets.CONFIG.ITEM_NAME.glossyOil,
        };
      });
      expect(result).toEqual({ oilsReceived: true, glossyOil: 1, glossyOilName: '《テカテカ油》' });
    });

    test('the inn talk command label stays 話す throughout the oil event', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        state: { isAtInn: true, location: '宿屋《琥珀亭》' },
        flags: { innRepairHelpStarted: true },
      });
      const label = await page.locator('#btnInnTalk').textContent();
      expect(label).toBe('話す');
    });
  });

  test.describe('退出ボタン', () => {
    test('reads 宿屋前に戻る only while oils are received and the repair is not yet complete', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        state: { isAtInn: true, location: '宿屋《琥珀亭》' },
        flags: { innRepairHelpStarted: true, innRepairOilsReceived: false },
      });
      await expect(page.locator('#btnInnExit')).toHaveText('外に出る');

      await page.evaluate(() => {
        RPG.State.flags.innRepairOilsReceived = true;
        RPG.State.inventory.glossyOil = 1;
        uiControl.updateUI();
      });
      await expect(page.locator('#btnInnExit')).toHaveText('宿屋前に戻る');

      await page.evaluate(() => {
        RPG.State.flags.innRepairCompleted = true;
        uiControl.updateUI();
      });
      await expect(page.locator('#btnInnExit')).toHaveText('外に出る');
    });

    test('always calls the existing exitInn() regardless of label', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        state: { isAtInn: true, location: '宿屋《琥珀亭》' },
        flags: { innRepairHelpStarted: true, innRepairOilsReceived: true },
        glossyOil: 1,
      });
      await page.click('#btnInnExit');
      const result = await page.evaluate(() => ({
        isAtInn: RPG.State.isAtInn,
        location: RPG.State.location,
      }));
      expect(result).toEqual({ isAtInn: false, location: '宿屋前' });
    });
  });

  test.describe('修理完了', () => {
    test('does not resume without the oils received', async ({ page }) => {
      await setRepairBackHalfBaseline(page, { flags: { innRepairHelpStarted: true } });
      await expect(page.locator('#btnTalk')).toHaveText('修理を手伝う');
      await page.evaluate(() => explorationSystem.talk());
      const logText = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
      expect(logText).toContain('先に、娘さんからテカテカ油をもらってこよう');
      expect(logText).not.toContain('板材に《テカテカ油》を塗った');
    });

    test('can only resume while glossyOil > 0', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        flags: { innRepairHelpStarted: true, innRepairOilsReceived: true },
        glossyOil: 0,
      });
      const canResume = await page.evaluate(() => innSystem.canResumeInnRepairHelp());
      expect(canResume).toBe(false);
    });

    test('interrupting the finish event leaves glossyOil unspent and innRepairCompleted false', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        flags: { innRepairHelpStarted: true, innRepairOilsReceived: true },
        glossyOil: 1, shinyOil: 1, hardOil: 1,
      });
      await page.evaluate(() => explorationSystem.talk());
      // Interrupt partway through instead of draining to completion.
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => uiControl.handlePlayerInput());
        await page.waitForTimeout(30);
      }

      const mid = await page.evaluate(() => ({
        glossyOil: RPG.State.inventory.glossyOil,
        completed: RPG.State.flags.innRepairCompleted,
      }));
      expect(mid).toEqual({ glossyOil: 1, completed: false });

      // Can still be resumed from scratch afterward.
      const canResumeStill = await page.evaluate(() => innSystem.canResumeInnRepairHelp());
      expect(canResumeStill).toBe(true);
    });

    test('only finishing the event consumes glossyOil and sets innRepairCompleted, together, and grants no amber reward (moved to timber delivery)', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        flags: { innRepairHelpStarted: true, innRepairOilsReceived: true },
        glossyOil: 1, shinyOil: 1, hardOil: 1,
      });
      await page.evaluate(() => explorationSystem.talk());
      await drainDialogue(page);

      const result = await page.evaluate(() => ({
        glossyOil: RPG.State.inventory.glossyOil,
        shinyOil: RPG.State.inventory.shinyOil,
        hardOil: RPG.State.inventory.hardOil,
        completed: RPG.State.flags.innRepairCompleted,
        amberRewardReceived: RPG.State.flags.innRepairAmberRewardReceived,
        unknownAmber: RPG.State.inventory.unknownAmber,
        queuedAmberResults: RPG.State.unappraisedAmberResults,
        logText: document.getElementById('logContainer')?.textContent || '',
      }));
      expect(result.glossyOil).toBe(0);
      expect(result.shinyOil).toBe(1);
      expect(result.hardOil).toBe(1);
      expect(result.completed).toBe(true);
      expect(result.amberRewardReceived).toBe(false);
      expect(result.unknownAmber).toBe(0);
      expect(result.queuedAmberResults).toEqual([]);
      expect(result.logText).toContain('宿屋の修理が終わった！');
      expect(result.logText).toContain('釘を手に入れた！（店主が）');
      expect(result.logText).not.toContain('店主「そうだ。物置にあったやつだが、これやるよ」');
      expect(result.logText).not.toContain('🔸？琥珀を1個受け取った！');
    });

    test('the nail is not added as an inventory item', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        flags: { innRepairHelpStarted: true, innRepairOilsReceived: true },
        glossyOil: 1,
      });
      await page.evaluate(() => explorationSystem.talk());
      await drainDialogue(page);

      const inventoryKeys = await page.evaluate(() => Object.keys(RPG.State.inventory));
      const hasNailLikeKey = inventoryKeys.some(key => /nail|kugi/i.test(key));
      expect(hasNailLikeKey).toBe(false);
    });

    test('innRepairCompleted is set exactly once and the event does not replay', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        flags: { innRepairHelpStarted: true, innRepairOilsReceived: true },
        glossyOil: 1,
      });
      await page.evaluate(() => explorationSystem.talk());
      await drainDialogue(page);
      expect(await page.evaluate(() => RPG.State.flags.innRepairCompleted)).toBe(true);

      // Command disappears, so a second talk() at the inn front falls through to the default.
      await expect(page.locator('#btnTalk')).toHaveText('調べる');
      await page.evaluate(() => explorationSystem.talk());
      const logText = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
      expect(logText).not.toContain('宿屋の修理が終わった！　宿屋の修理が終わった！');
      // The amber reward now comes from timber delivery, not from completion, so replaying
      // (or even just reaching) completion here must not have granted it.
      expect(await page.evaluate(() => ({
        unknownAmber: RPG.State.inventory.unknownAmber,
        queuedAmberResults: RPG.State.unappraisedAmberResults,
      }))).toEqual({ unknownAmber: 0, queuedAmberResults: [] });
    });

    test('repeated player-input taps during the finish event do not double-consume or double-complete', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        flags: { innRepairHelpStarted: true, innRepairOilsReceived: true },
        glossyOil: 1,
      });
      await page.evaluate(() => explorationSystem.talk());
      // Hammer input far past when the queue would have finished.
      for (let i = 0; i < 80; i++) {
        await page.evaluate(() => uiControl.handlePlayerInput());
      }
      await page.waitForTimeout(200);

      const result = await page.evaluate(() => ({
        glossyOil: RPG.State.inventory.glossyOil,
        completed: RPG.State.flags.innRepairCompleted,
      }));
      expect(result).toEqual({ glossyOil: 0, completed: true });
    });

    test('innRepairCompleted survives save/reload', async ({ page }) => {
      await setRepairBackHalfBaseline(page, { flags: { innRepairCompleted: true } });
      const result = await page.evaluate(() => {
        const snapshot = uiControl.createSaveSnapshot('journal');
        localStorage.setItem('okai_rpg_repair_completed_test', JSON.stringify(snapshot));
        RPG.State.flags.innRepairCompleted = false;
        uiControl.loadFromStorage('okai_rpg_repair_completed_test', 'テスト');
        return RPG.State.flags.innRepairCompleted;
      });
      expect(result).toBe(true);
    });
  });

  test.describe('Phase7 での継続', () => {
    test('help started in Phase6 can receive the oils in Phase7', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        state: { isAtInn: true, location: '宿屋《琥珀亭》', storyPhase: 7 },
        flags: {
          innRepairHelpStarted: true,
          phase6WagonMapTalkDone: true,
          wagonInfoHeard: true,
          phase6RoomTalkDone: true,
        },
      });
      await page.evaluate(() => innSystem.talk());
      await drainDialogue(page);
      await clickDaughterOilChoice(page);
      await drainDialogue(page);
      const oilsReceived = await page.evaluate(() => RPG.State.flags.innRepairOilsReceived);
      expect(oilsReceived).toBe(true);
    });

    test('oils received in Phase6 can be used to complete the repair in Phase7', async ({ page }) => {
      await setRepairBackHalfBaseline(page, {
        state: { storyPhase: 7 },
        flags: { innRepairHelpStarted: true, innRepairOilsReceived: true },
        glossyOil: 1,
      });
      await expect(page.locator('#btnTalk')).toHaveText('修理を手伝う');
      await page.evaluate(() => explorationSystem.talk());
      await drainDialogue(page);
      const completed = await page.evaluate(() => RPG.State.flags.innRepairCompleted);
      expect(completed).toBe(true);
    });

    test('【修理を手伝う】 can be started for the first time in Phase7', async ({ page }) => {
      await setRepairBackHalfBaseline(page, { state: { storyPhase: 7 } });
      await expect(page.locator('#btnTalk')).toHaveText('修理を手伝う');
      await page.evaluate(() => explorationSystem.talk());
      await drainDialogue(page);
      const helpStarted = await page.evaluate(() => RPG.State.flags.innRepairHelpStarted);
      expect(helpStarted).toBe(true);
    });

    test('a highway-defeat retreat back to the Phase7 inn front can still resume from an in-progress state', async ({ page }) => {
      // Simulates the state shape after battle.js's resolveHighwayDefeat() sends the
      // player back to the inn front mid-Phase7, without touching battle.js itself.
      await setRepairBackHalfBaseline(page, {
        state: { storyPhase: 7, isAtInn: false, isInDungeon: false, location: '宿屋前' },
        flags: { innRepairHelpStarted: true, innRepairOilsReceived: true },
        glossyOil: 1,
      });
      await expect(page.locator('#btnTalk')).toHaveText('修理を手伝う');
    });
  });
});

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

async function drainDialogue(page, maxTaps = 100) {
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

test.describe('Chapter 1 amber system', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await page.goto('/chapter1.html');
    await page.waitForFunction(() => (
      typeof uiControl !== 'undefined' &&
      typeof explorationSystem !== 'undefined' &&
      typeof innSystem !== 'undefined'
    ));
    await advanceUntilInteractive(page);
  });

  test('amber-tree victory leaves the second coin embedded', async ({ page }) => {
    const result = await page.evaluate(() => {
      const beforeCoins = RPG.State.silverCoins;
      const event = RPG.Assets.EVENT_DATA.find(entry => entry.id === 'amber_tree_victory');
      event.action(RPG.State);
      return {
        beforeCoins,
        afterCoins: RPG.State.silverCoins,
        treeDefeated: RPG.State.flags.treeDefeated,
        coinMined: RPG.State.flags.amberTreeCoinMined,
        postTreeBattles: RPG.State.postTreeBattles,
      };
    });

    expect(result.afterCoins).toBe(result.beforeCoins);
    expect(result.treeDefeated).toBe(true);
    expect(result.coinMined).toBe(false);
    expect(result.postTreeBattles).toBeNull();
  });

  test('amber-tree inspect restores both choices and preserves the leave dialogue', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'forest',
        currentDistance: 8,
        location: '琥珀の森',
      });
      Object.assign(RPG.State.flags, {
        forest8mInspectCount: 0,
        hasTreeEventOccurred: false,
        treeDefeated: false,
        isTreeRematch: false,
      });
      RPG.State.inventory.silverCoin = 1;

      // Reproduce the shared-button state left by the one-option prologue menu.
      document.getElementById('btnChoiceB').style.display = 'none';
      window.__amberTreeBattleStarted = null;
      battleSystem.startBattle = enemyId => {
        window.__amberTreeBattleStarted = enemyId;
        RPG.State.mode = 'base';
        uiControl.updateUI();
      };

      explorationSystem.talk();
    });
    await drainDialogue(page);

    await page.evaluate(() => explorationSystem.talk());
    const choiceMode = await drainDialogue(page);
    expect(choiceMode).toBe('choice');

    const choices = await page.evaluate(() => {
      const take = document.getElementById('btnChoiceA');
      const leave = document.getElementById('btnChoiceB');
      return {
        takeText: take.textContent,
        takeDisplay: getComputedStyle(take).display,
        leaveText: leave.textContent,
        leaveDisplay: getComputedStyle(leave).display,
      };
    });
    expect(choices).toEqual({
      takeText: '銀貨を取る',
      takeDisplay: 'flex',
      leaveText: 'やめておく',
      leaveDisplay: 'flex',
    });

    await page.click('#btnChoiceB');
    await drainDialogue(page);
    const result = await page.evaluate(() => ({
      playerTookCoin: RPG.State.playerTookCoin,
      battleStarted: window.__amberTreeBattleStarted,
      log: document.getElementById('logContainer')?.textContent || '',
    }));

    expect(result.playerTookCoin).toBe(false);
    expect(result.battleStarted).toBe('hungry_amber_tree');
    expect(result.log).toContain('カイン「…いや、やめておこう」');
    expect(result.log).toContain('そう言うとオーエンは無造作に、琥珀に埋まっている銀貨に手を伸ばした。');
    expect(result.log).toContain('カインの剣が、琥珀の触手を弾き飛ばした。');
  });

  test('the borrowed knife mines the second coin and first unknown amber at 8m', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'forest',
        currentDistance: 8,
        location: '琥珀の森',
        silverCoins: 1,
      });
      Object.assign(RPG.State.flags, {
        treeDefeated: true,
        borrowedMiningKnifeReceived: true,
        amberTreeCoinMined: false,
      });
      RPG.State.inventory.silverCoin = 1;
      RPG.State.inventory.borrowedMiningKnife = 1;
      RPG.State.inventory.unknownAmber = 0;
      explorationSystem.talk();
    });

    await drainDialogue(page);
    const result = await page.evaluate(() => ({
      coins: RPG.State.silverCoins,
      inventoryCoins: RPG.State.inventory.silverCoin,
      unknownAmber: RPG.State.inventory.unknownAmber,
      coinMined: RPG.State.flags.amberTreeCoinMined,
      postTreeBattles: RPG.State.postTreeBattles,
    }));

    expect(result).toEqual({
      coins: 2,
      inventoryCoins: 2,
      unknownAmber: 1,
      coinMined: true,
      postTreeBattles: 0,
    });
  });

  test('the inn first recognizes the amber merchant on observe after the first coin', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: true,
        silverCoins: 0,
        storyPhase: 0,
      });
      RPG.State.inventory.silverCoin = 0;
      RPG.State.flags.hasFoundFirstCoin = false;
      RPG.State.flags.amberMerchantRecognized = false;
      RPG.State.observePhaseReached = {};
      innSystem.observe();
    });
    await drainDialogue(page);

    let result = await page.evaluate(() => ({
      recognized: RPG.State.flags.amberMerchantRecognized,
      log: document.getElementById('logContainer')?.textContent || '',
    }));
    expect(result.recognized).toBe(false);
    expect(result.log).not.toContain('琥珀採り「これはどうだ？」');

    await page.evaluate(() => {
      RPG.State.silverCoins = 1;
      RPG.State.inventory.silverCoin = 1;
      RPG.State.flags.hasFoundFirstCoin = true;
      innSystem.observe();
    });
    await drainDialogue(page);

    result = await page.evaluate(() => ({
      recognized: RPG.State.flags.amberMerchantRecognized,
      log: document.getElementById('logContainer')?.textContent || '',
    }));
    expect(result.recognized).toBe(true);
    expect(result.log).toContain('テーブルの上で、男たちが琥珀のかけらを並べている。');
  });

  test('the first appraisal is guaranteed sparkling without opening merchant commands', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.inventory.unknownAmber = 1;
      RPG.State.flags.treeDefeated = true;
      RPG.State.flags.amberMerchantRecognized = true;
      RPG.State.flags.borrowedMiningKnifeReceived = true;
      RPG.State.flags.firstAmberAppraisalDone = false;
      innSystem.interactWithAmberMerchant();
    });

    const endingMode = await drainDialogue(page);
    const result = await page.evaluate(() => ({
      mode: RPG.State.mode,
      unknownAmber: RPG.State.inventory.unknownAmber,
      sparkling: RPG.State.amberStorage.sparkling,
      firstDone: RPG.State.flags.firstAmberAppraisalDone,
      menuButtons: document.querySelectorAll('#action-buttons button').length,
      exchangePreviewShown: document.getElementById('logContainer')?.textContent.includes('交換一覧') === true,
    }));

    expect(endingMode).toBe('base');
    expect(result.unknownAmber).toBe(0);
    expect(result.sparkling).toBe(1);
    expect(result.firstDone).toBe(true);
    expect(result.menuButtons).toBe(0);
    expect(result.exchangePreviewShown).toBe(true);
  });

  test('merchant recognition, knife loan, return attempt, and overnight move stay ordered', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.isAtInn = true;
      RPG.State.silverCoins = 1;
      RPG.State.inventory.silverCoin = 1;
      RPG.State.flags.hasFoundFirstCoin = true;
      RPG.State.flags.treeDefeated = true;
      RPG.State.flags.amberMerchantRecognized = false;
      RPG.State.flags.borrowedMiningKnifeReceived = false;
      innSystem.observe();
    });
    await drainDialogue(page);

    let result = await page.evaluate(() => ({
      recognized: RPG.State.flags.amberMerchantRecognized,
      knife: RPG.State.inventory.borrowedMiningKnife,
      observeLabel: document.getElementById('btnInnObserve')?.textContent,
    }));
    expect(result).toEqual({ recognized: true, knife: 0, observeLabel: '様子を見る' });

    await page.evaluate(() => innSystem.observe());
    await drainDialogue(page);
    result = await page.evaluate(() => ({
      received: RPG.State.flags.borrowedMiningKnifeReceived,
      knife: RPG.State.inventory.borrowedMiningKnife,
      observeLabel: document.getElementById('btnInnObserve')?.textContent,
    }));
    expect(result).toEqual({ received: true, knife: 1, observeLabel: '様子を見る' });

    await page.evaluate(() => {
      RPG.State.inventory.unknownAmber = 1;
      innSystem.observe();
    });
    await drainDialogue(page);
    result = await page.evaluate(() => ({
      firstDone: RPG.State.flags.firstAmberAppraisalDone,
      observeLabel: document.getElementById('btnInnObserve')?.textContent,
    }));
    expect(result).toEqual({ firstDone: true, observeLabel: 'ナイフを返す' });

    await page.evaluate(() => innSystem.observe());
    await drainDialogue(page);
    result = await page.evaluate(() => ({
      returnDone: RPG.State.flags.amberKnifeReturnAttemptDone,
      movePending: RPG.State.flags.amberMerchantMovePending,
      knife: RPG.State.inventory.borrowedMiningKnife,
    }));
    expect(result).toEqual({ returnDone: true, movePending: true, knife: 1 });

    result = await page.evaluate(() => {
      RPG.State.mode = 'base';
      innSystem.interactWithAmberMerchant();
      return {
        mode: RPG.State.mode,
        menuButtons: document.querySelectorAll('#action-buttons button').length,
      };
    });
    expect(result).toEqual({ mode: 'base', menuButtons: 0 });

    result = await page.evaluate(() => {
      innSystem.refreshHerbGardenHarvestsAfterStay();
      return {
        movePending: RPG.State.flags.amberMerchantMovePending,
        moved: RPG.State.flags.amberMerchantMovedToForest,
        knife: RPG.State.inventory.borrowedMiningKnife,
      };
    });
    expect(result).toEqual({ movePending: false, moved: true, knife: 1 });

    await page.evaluate(() => {
      RPG.State.mode = 'base';
      innSystem.interactWithAmberMerchant();
    });
    await expect.poll(() => page.evaluate(() => RPG.State.mode)).toBe('choice');
    await expect(page.locator('#action-buttons button')).toHaveCount(5);
  });

  test('pending knife loan keeps priority over the unlocked second rat label', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: true,
      });
      Object.assign(RPG.State.flags, {
        innRatEvent: true,
        innRatEvent2: false,
        innRatEvent2StayCount: 1,
        treeDefeated: true,
        amberMerchantRecognized: true,
        borrowedMiningKnifeReceived: false,
        firstAmberAppraisalDone: false,
      });
      RPG.State.inventory.unknownAmber = 0;
      uiControl.updateUI();
      return {
        observeLabel: document.getElementById('btnInnObserve')?.textContent,
        usesMerchantRoute: innSystem.shouldUseAmberMerchantObserveRoute(),
        ratUnlocked: innSystem.canTriggerInnRatEvent2(),
      };
    });

    expect(result).toEqual({
      observeLabel: '様子を見る',
      usesMerchantRoute: true,
      ratUnlocked: true,
    });

    await page.evaluate(() => innSystem.observe());
    await drainDialogue(page);
    const ending = await page.evaluate(() => ({
      knifeReceived: RPG.State.flags.borrowedMiningKnifeReceived,
      ratTriggered: RPG.State.flags.innRatEvent2,
      observeLabel: document.getElementById('btnInnObserve')?.textContent,
    }));
    expect(ending).toEqual({
      knifeReceived: true,
      ratTriggered: false,
      observeLabel: 'チューチュー❗️',
    });
  });

  test('one completed stay unlocks the second inn rat event', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State.flags, {
        innRatEvent: true,
        innRatEvent2: false,
        innRatEvent2StayCount: 0,
      });

      innSystem.refreshHerbGardenHarvestsAfterStay();
      const afterFirstStay = {
        stayCount: RPG.State.flags.innRatEvent2StayCount,
        ratUnlocked: innSystem.canTriggerInnRatEvent2(),
      };

      innSystem.refreshHerbGardenHarvestsAfterStay();
      return {
        afterFirstStay,
        cappedStayCount: RPG.State.flags.innRatEvent2StayCount,
      };
    });

    expect(result).toEqual({
      afterFirstStay: {
        stayCount: 1,
        ratUnlocked: true,
      },
      cappedStayCount: 1,
    });
  });

  test('Owen skips both inn rat event battles', async ({ page }) => {
    const result = await page.evaluate(() => {
      const originalShouldIntervene = RPG.Assets.OWEN_BEHAVIOR.shouldIntervene;
      const originalDecideAction = RPG.Assets.OWEN_BEHAVIOR.decideAction;
      RPG.Assets.OWEN_BEHAVIOR.shouldIntervene = () => true;
      RPG.Assets.OWEN_BEHAVIOR.decideAction = () => 'kill';

      let firstCallbackRan = false;
      RPG.State.currentEnemy = { id: 'normal_rat', name: '普通のネズミ', hp: 1 };
      RPG.State.hasOwenIntervened = false;
      battleSystem.processOwenAction(() => {
        firstCallbackRan = true;
      });
      const firstIntervened = RPG.State.hasOwenIntervened;

      let secondCallbackRan = false;
      RPG.State.currentEnemy = { id: 'rat', name: '魔界のネズミ', hp: 40 };
      RPG.State.flags.innRatEvent2BattleActive = true;
      RPG.State.hasOwenIntervened = false;
      battleSystem.processOwenAction(() => {
        secondCallbackRan = true;
      });
      const secondIntervened = RPG.State.hasOwenIntervened;

      RPG.Assets.OWEN_BEHAVIOR.shouldIntervene = originalShouldIntervene;
      RPG.Assets.OWEN_BEHAVIOR.decideAction = originalDecideAction;
      return {
        firstCallbackRan,
        firstIntervened,
        secondCallbackRan,
        secondIntervened,
      };
    });

    expect(result).toEqual({
      firstCallbackRan: true,
      firstIntervened: false,
      secondCallbackRan: true,
      secondIntervened: false,
    });
  });

  test('three junk appraisals turn the borrowed knife into the mining knife', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.inventory.unknownAmber = 3;
      RPG.State.inventory.borrowedMiningKnife = 1;
      RPG.State.flags.firstAmberAppraisalDone = true;
      RPG.State.flags.miningKnifeAwarded = false;
      RPG.State.junkAmberDelivered = 0;
      Math.random = () => 0.75;
      innSystem.appraiseAmber(3);
    });

    await drainDialogue(page);
    const result = await page.evaluate(() => ({
      junk: RPG.State.amberStorage.junk,
      delivered: RPG.State.junkAmberDelivered,
      borrowedKnife: RPG.State.inventory.borrowedMiningKnife,
      miningKnife: RPG.State.inventory.miningKnife,
      awarded: RPG.State.flags.miningKnifeAwarded,
    }));

    expect(result).toEqual({
      junk: 3,
      delivered: 3,
      borrowedKnife: 0,
      miningKnife: 1,
      awarded: true,
    });
  });

  test('rare amber exchange and trade-in use the shared price table', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.amberStorage.sparkling = 3;
      RPG.State.flags.firstAmberAppraisalDone = true;
      RPG.State.flags.amberKnifeReturnAttemptDone = true;
      RPG.State.flags.amberMerchantMovedToForest = true;
      innSystem.showAmberExchangeMenu();
    });
    await page.click('#btnAmberAction1');

    let result = await page.evaluate(() => ({
      sparkling: RPG.State.amberStorage.sparkling,
      sweet: RPG.State.inventory.sweetAmber,
    }));
    expect(result).toEqual({ sparkling: 0, sweet: 1 });

    await page.evaluate(() => innSystem.showAmberTradeInMenu());
    await page.click('#btnAmberAction0');
    result = await page.evaluate(() => ({
      sparkling: RPG.State.amberStorage.sparkling,
      sweet: RPG.State.inventory.sweetAmber,
    }));
    expect(result).toEqual({ sparkling: 1, sweet: 0 });
  });

  test('the exchange catalog stays scrollable on a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.amberStorage.sparkling = 10;
      RPG.State.flags.firstAmberAppraisalDone = true;
      RPG.State.flags.amberKnifeReturnAttemptDone = true;
      RPG.State.flags.amberMerchantMovedToForest = true;
      innSystem.showAmberExchangeMenu();
    });

    const dimensions = await page.locator('#action-buttons').evaluate(element => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    expect(dimensions.clientHeight).toBeLessThanOrEqual(dimensions.viewportHeight * 0.52 + 1);
    expect(dimensions.scrollHeight).toBeGreaterThanOrEqual(dimensions.clientHeight);

    const backButton = page.locator('#action-buttons button').last();
    await backButton.scrollIntoViewIfNeeded();
    await expect(backButton).toBeInViewport();
  });

  test('current amber progress survives a journal snapshot and reload', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.inventory.unknownAmber = 2;
      RPG.State.inventory.borrowedMiningKnife = 1;
      RPG.State.amberStorage.sparkling = 4;
      RPG.State.amberStorage.insect = 1;
      RPG.State.flags.amberTreeCoinMined = true;
      RPG.State.flags.firstAmberAppraisalDone = true;
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_amber_test', JSON.stringify(snapshot));

      RPG.State.inventory.unknownAmber = 0;
      RPG.State.inventory.borrowedMiningKnife = 0;
      RPG.State.amberStorage.sparkling = 0;
      RPG.State.amberStorage.insect = 0;
      RPG.State.flags.amberTreeCoinMined = false;
      RPG.State.flags.firstAmberAppraisalDone = false;
      uiControl.loadFromStorage('okai_rpg_amber_test', '琥珀テスト');

      return {
        unknownAmber: RPG.State.inventory.unknownAmber,
        knife: RPG.State.inventory.borrowedMiningKnife,
        sparkling: RPG.State.amberStorage.sparkling,
        insect: RPG.State.amberStorage.insect,
        coinMined: RPG.State.flags.amberTreeCoinMined,
        firstAppraisal: RPG.State.flags.firstAmberAppraisalDone,
      };
    });

    expect(result).toEqual({
      unknownAmber: 2,
      knife: 1,
      sparkling: 4,
      insect: 1,
      coinMined: true,
      firstAppraisal: true,
    });
  });

  test('hardened parts absorb normal damage, criticals bypass them, and Owen drops amber', async ({ page }) => {
    const result = await page.evaluate(() => {
      const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'amber_rat');
      RPG.State.currentEnemy = { ...template, hp: template.maxHp, armorHp: template.armorMax };
      battleSystem.applyCainDamage(10, false);
      const afterNormal = {
        hp: RPG.State.currentEnemy.hp,
        armorHp: RPG.State.currentEnemy.armorHp,
      };

      battleSystem.applyCainDamage(15, true);
      const afterCritical = {
        hp: RPG.State.currentEnemy.hp,
        armorHp: RPG.State.currentEnemy.armorHp,
      };

      RPG.State.mode = 'battle';
      RPG.State.isBattling = true;
      RPG.State.lastBlowBy = 'Owen';
      RPG.State.currentEnemy.hp = 0;
      RPG.State.inventory.unknownAmber = 0;
      RPG.State.defeatCounts.amber_rat = { cain: 0, owen: 0 };
      battleSystem.endBattle(false);

      return {
        afterNormal,
        afterCritical,
        unknownAmber: RPG.State.inventory.unknownAmber,
        owenDefeats: RPG.State.defeatCounts.amber_rat.owen,
      };
    });

    expect(result.afterNormal).toEqual({ hp: 40, armorHp: 10 });
    expect(result.afterCritical).toEqual({ hp: 25, armorHp: 10 });
    expect(result.unknownAmber).toBe(1);
    expect(result.owenDefeats).toBe(1);
  });

  test('amberized beasts stay locked until the thief-boy encounter', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'forest',
        location: '琥珀の森',
      });
      RPG.State.flags.amberTreeCoinMined = true;
      RPG.State.flags.metThiefBoy = false;
      const rat = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'rat');
      const originalRandom = Math.random;
      Math.random = () => 0;
      const beforeThief = battleSystem.maybeUseAmberizedVariant(rat).id;
      RPG.State.flags.metThiefBoy = true;
      const afterThief = battleSystem.maybeUseAmberizedVariant(rat).id;
      Math.random = originalRandom;
      return { beforeThief, afterThief };
    });

    expect(result).toEqual({ beforeThief: 'rat', afterThief: 'amber_rat' });
  });
});

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

  test('the special unknown amber is appraised before the normal first appraisal', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.inventory.specialUnknownAmber = 1;
      RPG.State.inventory.unknownAmber = 1;
      RPG.State.inventory.vampireAmber = 0;
      RPG.State.flags.treeDefeated = true;
      RPG.State.flags.amberMerchantRecognized = true;
      RPG.State.flags.borrowedMiningKnifeReceived = true;
      RPG.State.flags.firstAmberAppraisalDone = false;
      RPG.State.flags.vampireAmberAppraisalSeen = false;
      innSystem.interactWithAmberMerchant();
    });

    await drainDialogue(page);
    let result = await page.evaluate(() => ({
      specialUnknownAmber: RPG.State.inventory.specialUnknownAmber,
      unknownAmber: RPG.State.inventory.unknownAmber,
      vampireAmber: RPG.State.inventory.vampireAmber,
      sparkling: RPG.State.amberStorage.sparkling,
      firstDone: RPG.State.flags.firstAmberAppraisalDone,
      vampireSeen: RPG.State.flags.vampireAmberAppraisalSeen,
      log: document.getElementById('logContainer')?.textContent || '',
    }));

    expect(result.specialUnknownAmber).toBe(0);
    expect(result.unknownAmber).toBe(1);
    expect(result.vampireAmber).toBe(1);
    expect(result.sparkling).toBe(0);
    expect(result.firstDone).toBe(false);
    expect(result.vampireSeen).toBe(true);
    expect(result.log).toContain('《吸血琥珀》と鑑定された。');
    expect(result.log).toContain(
      '自分のHPを少し吸う代わりに、攻撃力を大きく高めるレア琥珀。宿屋の娘がなぜこれを……？'
    );

    await page.evaluate(() => innSystem.interactWithAmberMerchant());
    await drainDialogue(page);
    result = await page.evaluate(() => ({
      unknownAmber: RPG.State.inventory.unknownAmber,
      vampireAmber: RPG.State.inventory.vampireAmber,
      sparkling: RPG.State.amberStorage.sparkling,
      firstDone: RPG.State.flags.firstAmberAppraisalDone,
    }));
    expect(result).toEqual({
      unknownAmber: 0,
      vampireAmber: 1,
      sparkling: 1,
      firstDone: true,
    });
  });

  test('special appraisal bypasses the unchanged normal random draw', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.inventory.specialUnknownAmber = 1;
      RPG.State.inventory.unknownAmber = 2;
      RPG.State.inventory.vampireAmber = 0;
      RPG.State.flags.firstAmberAppraisalDone = true;
      RPG.State.flags.vampireAmberAppraisalSeen = false;
      RPG.State.flags.miningKnifeAwarded = true;
      RPG.State.amberStorage.junk = 0;
      RPG.State.junkAmberDelivered = 3;

      const originalRandom = Math.random;
      let randomCalls = 0;
      Math.random = () => {
        randomCalls++;
        return 0.75;
      };
      innSystem.appraiseAmber(3);
      Math.random = originalRandom;

      return {
        randomCalls,
        specialUnknownAmber: RPG.State.inventory.specialUnknownAmber,
        unknownAmber: RPG.State.inventory.unknownAmber,
        vampireAmber: RPG.State.inventory.vampireAmber,
        junk: RPG.State.amberStorage.junk,
        weights: {
          sparkling: RPG.Assets.AMBER_APPRAISAL.sparkling.weight,
          junk: RPG.Assets.AMBER_APPRAISAL.junk.weight,
          insect: RPG.Assets.AMBER_APPRAISAL.insect.weight,
        },
      };
    });

    expect(result).toEqual({
      randomCalls: 2,
      specialUnknownAmber: 0,
      unknownAmber: 0,
      vampireAmber: 1,
      junk: 2,
      weights: { sparkling: 70, junk: 15, insect: 15 },
    });
    await drainDialogue(page);
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
        ratEvent2BattleFought: true,
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

  test('one completed stay alone does not unlock the second inn rat event; a battle win also is required', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State.flags, {
        innRatEvent: true,
        innRatEvent2: false,
        innRatEvent2StayCount: 0,
        ratEvent2BattleFought: false,
      });

      innSystem.refreshHerbGardenHarvestsAfterStay();
      const afterFirstStay = {
        stayCount: RPG.State.flags.innRatEvent2StayCount,
        ratUnlocked: innSystem.canTriggerInnRatEvent2(),
      };

      innSystem.refreshHerbGardenHarvestsAfterStay();
      const cappedStayCount = RPG.State.flags.innRatEvent2StayCount;

      RPG.State.flags.ratEvent2BattleFought = true;
      const afterBattleWin = innSystem.canTriggerInnRatEvent2();

      return { afterFirstStay, cappedStayCount, afterBattleWin };
    });

    expect(result).toEqual({
      afterFirstStay: {
        stayCount: 1,
        ratUnlocked: false,
      },
      cappedStayCount: 1,
      afterBattleWin: true,
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

  test('vampire amber is socketable but absent from exchange and trade-in', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.inventory.glowingBrooch = 1;
      RPG.State.inventory.vampireAmber = 1;
      RPG.State.equippedRareAmberId = null;
      RPG.State.amberStorage.sparkling = 999;

      innSystem.showAmberExchangeMenu();
      const exchangeMenu = document.getElementById('action-buttons')?.textContent || '';
      innSystem.showAmberTradeInMenu();
      const tradeInMenu = document.getElementById('action-buttons')?.textContent || '';
      RPG.State.mode = 'base';

      const before = {
        currentHP: RPG.State.currentHP,
        maxHP: RPG.State.maxHP,
        attack: RPG.State.attack,
      };
      const equipped = uiControl.equipRareAmber('vampireAmber');
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_vampire_amber_test', JSON.stringify(snapshot));

      RPG.State.inventory.vampireAmber = 4;
      RPG.State.equippedRareAmberId = null;
      uiControl.loadFromStorage('okai_rpg_vampire_amber_test', '吸血琥珀テスト');
      const equippedAfterLoad = RPG.State.equippedRareAmberId;
      const inventoryAfterLoad = RPG.State.inventory.vampireAmber;
      const detached = uiControl.detachRareAmber({ log: false, refreshModal: false });

      return {
        name: RPG.Assets.CONFIG.ITEM_NAME.vampireAmber,
        description: RPG.Assets.CONFIG.ITEM_DESC.vampireAmber,
        exchangeMenu,
        tradeInMenu,
        equipped,
        equippedAfterLoad,
        inventoryAfterLoad,
        detached,
        equippedAfterDetach: RPG.State.equippedRareAmberId,
        inventoryAfterDetach: RPG.State.inventory.vampireAmber,
        before,
        after: {
          currentHP: RPG.State.currentHP,
          maxHP: RPG.State.maxHP,
          attack: RPG.State.attack,
        },
      };
    });

    expect(result.name).toBe('🔸《吸血琥珀》');
    expect(result.description).toBe(
      '自分のHPを少し吸う代わりに、攻撃力を大きく高めるレア琥珀。宿屋の娘がなぜこれを……？'
    );
    expect(result.exchangeMenu).not.toContain('吸血琥珀');
    expect(result.tradeInMenu).not.toContain('吸血琥珀');
    expect(result.equipped).toBe(true);
    expect(result.equippedAfterLoad).toBe('vampireAmber');
    expect(result.inventoryAfterLoad).toBe(0);
    expect(result.detached).toBe(true);
    expect(result.equippedAfterDetach).toBeNull();
    expect(result.inventoryAfterDetach).toBe(1);
    expect(result.after).toEqual(result.before);
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
        currentDistance: 5,
        location: '琥珀の森',
      });
      RPG.State.flags.amberTreeCoinMined = true;
      RPG.State.flags.metThiefBoy = false;
      const originalRandom = Math.random;
      Math.random = () => 0;
      const beforeThief = battleSystem.rollAmberVariantEncounter();
      RPG.State.flags.metThiefBoy = true;
      const afterThief = battleSystem.rollAmberVariantEncounter();
      Math.random = originalRandom;
      return { beforeThief, afterThief: afterThief && afterThief.id };
    });

    expect(result).toEqual({ beforeThief: null, afterThief: 'amber_rat' });
  });

  test('the glowing brooch equips one owned rare amber from its inventory detail', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.inventory.glowingBrooch = 1;
      RPG.State.inventory.hatedAmber = 1;
      RPG.State.inventory.sweetAmber = 1;
      RPG.State.equippedRareAmberId = null;
      uiControl.openModal();
      uiControl.selectItem('glowingBrooch', 1);
    });

    await expect(page.locator('#itemDetailArea')).toContainText('装着中：なし');
    await page.getByRole('button', { name: '琥珀を装着する' }).click();
    await expect(page.locator('#itemList .item-row')).toHaveCount(2);
    await expect(page.locator('#itemList')).toContainText('通常の魔物と遭遇しにくくなる');

    await page.locator('#itemList .item-row', { hasText: '嫌われ琥珀' }).click();

    const result = await page.evaluate(() => ({
      equipped: RPG.State.equippedRareAmberId,
      hated: RPG.State.inventory.hatedAmber,
      sweet: RPG.State.inventory.sweetAmber,
      detail: document.getElementById('itemDetailArea')?.textContent || '',
      log: document.getElementById('logContainer')?.textContent || '',
    }));
    expect(result.equipped).toBe('hatedAmber');
    expect(result.hated).toBe(0);
    expect(result.sweet).toBe(1);
    expect(result.detail).toContain('装着中：🔸《嫌われ琥珀》');
    expect(result.detail).toContain('琥珀を交換する');
    expect(result.detail).toContain('琥珀を外す');
    expect(result.log).toContain('《嫌われ琥珀》を光るブローチに装着した。');
  });

  test('rare amber exchange returns the old amber and detach returns the new one', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.inventory.glowingBrooch = 1;
      RPG.State.inventory.hatedAmber = 0;
      RPG.State.inventory.sweetAmber = 1;
      RPG.State.equippedRareAmberId = 'hatedAmber';
      uiControl.openModal();
      uiControl.selectItem('glowingBrooch', 1);
    });

    await page.getByRole('button', { name: '琥珀を交換する' }).click();
    await page.locator('#itemList .item-row', { hasText: '甘そうな琥珀' }).click();

    let result = await page.evaluate(() => ({
      equipped: RPG.State.equippedRareAmberId,
      hated: RPG.State.inventory.hatedAmber,
      sweet: RPG.State.inventory.sweetAmber,
      log: document.getElementById('logContainer')?.textContent || '',
    }));
    expect(result.equipped).toBe('sweetAmber');
    expect(result.hated).toBe(1);
    expect(result.sweet).toBe(0);
    expect(result.log).toContain(
      '《嫌われ琥珀》を外し、《甘そうな琥珀》を光るブローチに装着した。'
    );

    await page.getByRole('button', { name: '琥珀を外す' }).click();
    result = await page.evaluate(() => ({
      equipped: RPG.State.equippedRareAmberId,
      hated: RPG.State.inventory.hatedAmber,
      sweet: RPG.State.inventory.sweetAmber,
      detail: document.getElementById('itemDetailArea')?.textContent || '',
    }));
    expect(result).toEqual({
      equipped: null,
      hated: 1,
      sweet: 1,
      detail: expect.stringContaining('装着中：なし'),
    });
  });

  test('invalid equip requests never change the brooch or inventory', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.equippedRareAmberId = null;
      RPG.State.inventory.glowingBrooch = 0;
      RPG.State.inventory.hatedAmber = 1;
      const withoutBrooch = uiControl.equipRareAmber('hatedAmber');
      RPG.State.equippedRareAmberId = 'hatedAmber';
      const detachWithoutBrooch = uiControl.detachRareAmber({
        log: false,
        refreshModal: false,
      });
      RPG.State.equippedRareAmberId = null;

      RPG.State.inventory.glowingBrooch = 1;
      const invalidId = uiControl.equipRareAmber('notRareAmber');

      RPG.State.inventory.hatedAmber = 0;
      const withoutAmber = uiControl.equipRareAmber('hatedAmber');

      return {
        withoutBrooch,
        detachWithoutBrooch,
        invalidId,
        withoutAmber,
        equipped: RPG.State.equippedRareAmberId,
        hated: RPG.State.inventory.hatedAmber,
      };
    });
    expect(result).toEqual({
      withoutBrooch: false,
      detachWithoutBrooch: false,
      invalidId: false,
      withoutAmber: false,
      equipped: null,
      hated: 0,
    });
  });

  test('an equipped rare amber is excluded from trade-in until detached', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.inventory.glowingBrooch = 1;
      RPG.State.inventory.sweetAmber = 0;
      RPG.State.equippedRareAmberId = 'sweetAmber';
      RPG.State.amberStorage.sparkling = 0;

      innSystem.showAmberTradeInMenu();
      const whileEquipped = document.getElementById('action-buttons')?.textContent || '';

      uiControl.detachRareAmber({ log: false, refreshModal: false });
      innSystem.showAmberTradeInMenu();
      const afterDetach = document.getElementById('action-buttons')?.textContent || '';

      return {
        whileEquipped,
        afterDetach,
        equipped: RPG.State.equippedRareAmberId,
        sweet: RPG.State.inventory.sweetAmber,
      };
    });
    expect(result.whileEquipped).not.toContain('甘そうな琥珀');
    expect(result.afterDetach).toContain('甘そうな琥珀');
    expect(result.equipped).toBeNull();
    expect(result.sweet).toBe(1);
  });

  test('rare amber equipment survives saves and old saves default to empty', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.inventory.glowingBrooch = 1;
      RPG.State.inventory.hatedAmber = 0;
      RPG.State.equippedRareAmberId = 'hatedAmber';
      const equippedSave = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_rare_amber_equipped_test', JSON.stringify(equippedSave));

      RPG.State.inventory.hatedAmber = 1;
      RPG.State.equippedRareAmberId = null;
      uiControl.loadFromStorage('okai_rpg_rare_amber_equipped_test', '装着テスト');
      const equippedAfterLoad = {
        equipped: RPG.State.equippedRareAmberId,
        hated: RPG.State.inventory.hatedAmber,
      };

      const legacySave = JSON.parse(JSON.stringify(equippedSave));
      delete legacySave.equippedRareAmberId;
      legacySave.inventory.hatedAmber = 1;
      localStorage.setItem('okai_rpg_rare_amber_legacy_test', JSON.stringify(legacySave));
      uiControl.loadFromStorage('okai_rpg_rare_amber_legacy_test', '旧セーブテスト');

      return {
        equippedAfterLoad,
        legacyEquipped: RPG.State.equippedRareAmberId,
        legacyHated: RPG.State.inventory.hatedAmber,
      };
    });
    expect(result).toEqual({
      equippedAfterLoad: { equipped: 'hatedAmber', hated: 0 },
      legacyEquipped: null,
      legacyHated: 1,
    });
  });

  test('phase 6 brooch conversion auto-detaches amber and does not re-equip it', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: true,
        storyPhase: 6,
        equippedRareAmberId: 'hatedAmber',
      });
      Object.assign(RPG.State.flags, {
        herbGardenOwenJewelChecked: true,
        herbGardenFortuneConsultUnlocked: true,
        herbGardenBroochGranted: false,
        herbGardenFortuneFollowupDone: false,
        herbGardenBroochReturned: false,
      });
      Object.assign(RPG.State.inventory, {
        glowingBrooch: 1,
        lightRabbitBrooch: 0,
        hatedAmber: 0,
      });
      innSystem.showPhase6HerbGardenBroochChoices();
    });

    await page.click('#btnChoiceA');
    await drainDialogue(page);

    let result = await page.evaluate(() => ({
      equipped: RPG.State.equippedRareAmberId,
      glowingBrooch: RPG.State.inventory.glowingBrooch,
      lightRabbitBrooch: RPG.State.inventory.lightRabbitBrooch,
      hated: RPG.State.inventory.hatedAmber,
      log: document.getElementById('logContainer')?.textContent || '',
    }));
    expect(result.equipped).toBeNull();
    expect(result.glowingBrooch).toBe(0);
    expect(result.lightRabbitBrooch).toBe(1);
    expect(result.hated).toBe(1);
    expect(result.log).toContain('《嫌われ琥珀》を光るブローチから外した。');

    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.flags.herbGardenFortuneFollowupDone = true;
      RPG.State.flags.scentPouchQuestStarted = true;
      RPG.State.inventory.mintFlower = 1;
      RPG.State.inventory.boneMeal = 1;
      innSystem.observe();
    });
    await drainDialogue(page);

    result = await page.evaluate(() => ({
      equipped: RPG.State.equippedRareAmberId,
      glowingBrooch: RPG.State.inventory.glowingBrooch,
      lightRabbitBrooch: RPG.State.inventory.lightRabbitBrooch,
      hated: RPG.State.inventory.hatedAmber,
    }));
    expect(result).toEqual({
      equipped: null,
      glowingBrooch: 1,
      lightRabbitBrooch: 0,
      hated: 1,
    });
  });

  test('all nine rare amber candidates remain scrollable on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.inventory.glowingBrooch = 1;
      RPG.State.equippedRareAmberId = null;
      RPG.Assets.RARE_AMBER_CATALOG.forEach(item => {
        RPG.State.inventory[item.id] = 1;
      });
      uiControl.openModal();
      uiControl.selectItem('glowingBrooch', 1);
    });

    await page.getByRole('button', { name: '琥珀を装着する' }).click();
    const rows = page.locator('#itemList .item-row');
    await expect(rows).toHaveCount(9);
    await expect(page.locator('#itemList')).toContainText('🔸《吸血琥珀》');
    await expect(page.locator('#itemList')).toContainText(
      '自分のHPを少し吸う代わりに、攻撃力を大きく高めるレア琥珀。宿屋の娘がなぜこれを……？'
    );

    const dimensions = await page.locator('#itemList').evaluate(element => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    expect(dimensions.clientHeight).toBeLessThanOrEqual(dimensions.viewportHeight * 0.4 + 1);
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);

    const lastRow = rows.last();
    await lastRow.scrollIntoViewIfNeeded();
    await expect(lastRow).toBeInViewport();
  });

  test('equipping rare amber does not activate any gameplay effect yet', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.inventory.glowingBrooch = 1;
      RPG.State.inventory.hatedAmber = 1;
      RPG.State.equippedRareAmberId = null;
      const before = {
        battleRate: RPG.Config.BATTLE_RATE,
        currentHP: RPG.State.currentHP,
        maxHP: RPG.State.maxHP,
        attack: RPG.State.attack,
        exp: RPG.State.exp,
      };

      uiControl.equipRareAmber('hatedAmber');

      return {
        before,
        after: {
          battleRate: RPG.Config.BATTLE_RATE,
          currentHP: RPG.State.currentHP,
          maxHP: RPG.State.maxHP,
          attack: RPG.State.attack,
          exp: RPG.State.exp,
        },
      };
    });
    expect(result.after).toEqual(result.before);
  });

  test('old saves default vampire amber state to unowned and unseen', async ({ page }) => {
    const result = await page.evaluate(() => {
      const legacySave = uiControl.createSaveSnapshot('journal');
      delete legacySave.inventory.vampireAmber;
      delete legacySave.flags.vampireAmberAppraisalSeen;
      delete legacySave.flags.vampireAmberPendingTalkStages;
      delete legacySave.flags.pendingBattleCountEvents;
      localStorage.setItem('okai_rpg_vampire_amber_legacy_test', JSON.stringify(legacySave));

      RPG.State.inventory.vampireAmber = 4;
      RPG.State.flags.vampireAmberAppraisalSeen = true;
      RPG.State.flags.vampireAmberPendingTalkStages = [1, 2];
      RPG.State.flags.pendingBattleCountEvents = [{ enemyId: 'rat', count: 1 }];
      uiControl.loadFromStorage('okai_rpg_vampire_amber_legacy_test', '旧吸血琥珀テスト');

      return {
        vampireAmber: RPG.State.inventory.vampireAmber,
        vampireSeen: RPG.State.flags.vampireAmberAppraisalSeen,
        pendingVampireTalks: RPG.State.flags.vampireAmberPendingTalkStages,
        pendingCountEvents: RPG.State.flags.pendingBattleCountEvents,
      };
    });

    expect(result).toEqual({
      vampireAmber: 0,
      vampireSeen: false,
      pendingVampireTalks: [],
      pendingCountEvents: [],
    });
  });

  test.describe('vampire amber combat effect', () => {
    async function setupChainState(page, overrides = {}) {
      return page.evaluate((ov) => {
        Object.assign(RPG.State, {
          mode: 'base',
          isBattling: false,
          currentEnemy: null,
          battleState: null,
          maxHP: ov.maxHP ?? 140,
          currentHP: ov.currentHP ?? (ov.maxHP ?? 140),
          attack: ov.attack ?? 18,
          equippedRareAmberId: ov.equipped === false ? null : 'vampireAmber',
        });
        RPG.State.inventory.glowingBrooch = 1;
        // Mirror the real equip model (equipRareAmber subtracts 1 from inventory on equip),
        // so a later detach's +1 lands back on exactly 1, not 2.
        RPG.State.inventory.vampireAmber = ov.equipped === false ? 1 : 0;
        Object.assign(RPG.State.flags, {
          vampireAmberChainBattleCount: ov.chainCount ?? 0,
          vampireAmberStage1TalkSeen: ov.stage1Seen ?? true,
          vampireAmberStage2TalkSeen: ov.stage2Seen ?? true,
          vampireAmberPendingTalkStages: ov.pendingTalkStages ?? [],
          pendingBattleCountEvents: ov.pendingCountEvents ?? [],
        });
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
      }, overrides);
    }

    // Starts a synthetic (non-catalog) battle via the real beginBattle()/
    // applyVampireAmberBattleStart() code path, then immediately neutralizes the
    // scheduled preemptive/runBattleLoop setTimeout so no actual turn ever executes -
    // battleState itself is left untouched so its multiplier can still be inspected.
    async function beginDummyBattle(page, templateOverrides = {}) {
      return page.evaluate((tpl) => {
        battleSystem.beginBattle({
          id: 'test_dummy', name: 'テスト用ダミー', maxHp: 999, atk: 1, xp: 0, ...tpl,
        });
        RPG.State.isBattling = false;
        RPG.State.currentEnemy = null;
      }, templateOverrides);
    }

    async function completeDummyVictory(page, enemyId = 'test_dummy') {
      return page.evaluate((id) => {
        RPG.State.currentEnemy = {
          id, name: id, hp: 0, xp: 0, gold: 0,
        };
        if (!RPG.State.defeatCounts[id]) {
          RPG.State.defeatCounts[id] = { cain: 0, owen: 0 };
        }
        RPG.State.lastBlowBy = 'Cain';
        battleSystem.executeStandardVictory(id);
      }, enemyId);
    }

    test('drain fires only on chain battles 1, 4, and 6, with the correct amounts', async ({ page }) => {
      const results = {};
      for (const chainCount of [0, 1, 2, 3, 4, 5]) {
        await setupChainState(page, { chainCount, maxHP: 100, currentHP: 100 });
        await beginDummyBattle(page);
        results[chainCount + 1] = await page.evaluate(() => ({
          currentHP: RPG.State.currentHP,
          logHasDrainLine: (document.getElementById('logContainer')?.textContent || '')
            .includes('《吸血琥珀》がカインの血を吸った！'),
        }));
      }
      expect(results[1]).toEqual({ currentHP: 90, logHasDrainLine: true }); // ceil(100*0.10)
      expect(results[2]).toEqual({ currentHP: 100, logHasDrainLine: false });
      expect(results[3]).toEqual({ currentHP: 100, logHasDrainLine: false });
      expect(results[4]).toEqual({ currentHP: 85, logHasDrainLine: true }); // ceil(100*0.15)
      expect(results[5]).toEqual({ currentHP: 100, logHasDrainLine: false });
      expect(results[6]).toEqual({ currentHP: 80, logHasDrainLine: true }); // ceil(100*0.20)
    });

    test('drain never reduces HP below 1, but still fires the effect and advances state', async ({ page }) => {
      await setupChainState(page, { chainCount: 0, maxHP: 100, currentHP: 1 });
      await beginDummyBattle(page);
      const result = await page.evaluate(() => ({
        currentHP: RPG.State.currentHP,
        logHasDrainLine: (document.getElementById('logContainer')?.textContent || '')
          .includes('《吸血琥珀》がカインの血を吸った！'),
        multiplier: RPG.State.battleState?.vampireAmberDamageMultiplier,
      }));
      expect(result).toEqual({ currentHP: 1, logHasDrainLine: true, multiplier: 1.5 });
    });

    test('the battle-start log and damage multiplier are 1.5x for battles 1-5 and 2x for battle 6', async ({ page }) => {
      const results = {};
      for (const chainCount of [0, 1, 2, 3, 4, 5]) {
        await setupChainState(page, { chainCount });
        await beginDummyBattle(page);
        results[chainCount + 1] = await page.evaluate(() => ({
          multiplier: RPG.State.battleState?.vampireAmberDamageMultiplier,
          multiplierLines: [...document.querySelectorAll('#logContainer .log-entry')]
            .map(element => element.textContent)
            .filter(text => text.includes('《吸血琥珀》の力で、カインの攻撃力が')),
        }));
      }
      for (const battleNumber of [1, 2, 3, 4, 5]) {
        expect(results[battleNumber]).toEqual({
          multiplier: 1.5,
          multiplierLines: ['《吸血琥珀》の力で、カインの攻撃力が1.5倍になった！'],
        });
      }
      expect(results[6]).toEqual({
        multiplier: 2,
        multiplierLines: ['《吸血琥珀》の力で、カインの攻撃力が2倍になった！'],
      });
    });

    test('glowing_cat_rabbit is fully excluded: no drain, no multiplier, regardless of chain count', async ({ page }) => {
      await setupChainState(page, { chainCount: 0, maxHP: 100, currentHP: 100 });
      await beginDummyBattle(page, { id: 'glowing_cat_rabbit', name: '光る猫うさぎ', rabbitLevel: 5 });
      const result = await page.evaluate(() => ({
        currentHP: RPG.State.currentHP,
        multiplier: RPG.State.battleState?.vampireAmberDamageMultiplier,
        chainCount: RPG.State.flags.vampireAmberChainBattleCount,
        logHasDrainLine: (document.getElementById('logContainer')?.textContent || '')
          .includes('《吸血琥珀》がカインの血を吸った！'),
        logHasMultiplierLine: (document.getElementById('logContainer')?.textContent || '')
          .includes('《吸血琥珀》の力で'),
      }));
      expect(result).toEqual({
        currentHP: 100,
        multiplier: undefined,
        chainCount: 0,
        logHasDrainLine: false,
        logHasMultiplierLine: false,
      });
    });

    test('an unequipped vampire amber produces no multiplier log or talk reservation', async ({ page }) => {
      await setupChainState(page, {
        equipped: false, chainCount: 0, stage1Seen: false, stage2Seen: false,
      });
      await beginDummyBattle(page);
      const result = await page.evaluate(() => ({
        multiplier: RPG.State.battleState?.vampireAmberDamageMultiplier,
        pending: RPG.State.flags.vampireAmberPendingTalkStages,
        logHasMultiplierLine: (document.getElementById('logContainer')?.textContent || '')
          .includes('《吸血琥珀》の力で'),
      }));
      expect(result).toEqual({
        multiplier: undefined, pending: [], logHasMultiplierLine: false,
      });
    });

    test('applyCainDamage applies the multiplier exactly once and composes correctly with a critical hit', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.currentEnemy = { id: 'dummy', name: 'ダミー', hp: 9999, armorHp: 0 };
        RPG.State.battleState = { vampireAmberDamageMultiplier: 1.5 };
        battleSystem.applyCainDamage(20, false);
        const plainHit = 9999 - RPG.State.currentEnemy.hp;

        RPG.State.currentEnemy = { id: 'dummy2', name: 'ダミー2', hp: 9999, armorHp: 0 };
        RPG.State.battleState = { vampireAmberDamageMultiplier: 2 };
        const critDamage = Math.floor(20 * 1.5); // mirrors processCainAction's own crit step
        battleSystem.applyCainDamage(critDamage, true);
        const critHit = 9999 - RPG.State.currentEnemy.hp;

        RPG.State.currentEnemy = { id: 'dummy3', name: 'ダミー3', hp: 9999, armorHp: 0 };
        RPG.State.battleState = null;
        battleSystem.applyCainDamage(20, false);
        const noAmberHit = 9999 - RPG.State.currentEnemy.hp;

        return { plainHit, critHit, noAmberHit };
      });
      expect(result.plainHit).toBe(30); // floor(20*1.5)
      expect(result.critHit).toBe(60); // floor(floor(20*1.5) * 2), applied exactly once
      expect(result.noAmberHit).toBe(20); // unaffected when not equipped
    });

    test('the multiplier does not affect enemy-dealt damage', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.battleState = { vampireAmberDamageMultiplier: 2 };
        RPG.State.maxHP = 100;
        RPG.State.currentHP = 100;
        RPG.State.inventory.gratefulTalisman = 0;
        battleSystem.applyEnemyDirectDamage(10);
        return RPG.State.currentHP;
      });
      expect(result).toBe(90);
    });

    test('a normal victory (executeStandardVictory) advances the chain by one', async ({ page }) => {
      await setupChainState(page, { chainCount: 2 });
      const result = await page.evaluate(() => {
        RPG.State.currentEnemy = {
          id: 'test_dummy', name: 'テスト用ダミー', hp: 0, xp: 0, gold: 0,
        };
        RPG.State.defeatCounts.test_dummy = { cain: 0, owen: 0 };
        RPG.State.lastBlowBy = 'Cain';
        battleSystem.executeStandardVictory('test_dummy');
        return RPG.State.flags.vampireAmberChainBattleCount;
      });
      expect(result).toBe(3);
    });

    test('an Owen kill (endBattle with playerWin=false) advances the chain by one', async ({ page }) => {
      await setupChainState(page, { chainCount: 2 });
      const result = await page.evaluate(() => {
        RPG.State.currentEnemy = {
          id: 'test_dummy', name: 'テスト用ダミー', hp: 0, xp: 0, gold: 0,
        };
        RPG.State.defeatCounts.test_dummy = { cain: 0, owen: 0 };
        RPG.State.lastBlowBy = 'Owen';
        battleSystem.endBattle(false);
        return RPG.State.flags.vampireAmberChainBattleCount;
      });
      expect(result).toBe(3);
    });

    test('an Owen kill also plays a reserved vampire-amber talk after the battle', async ({ page }) => {
      await setupChainState(page, { chainCount: 0, stage1Seen: false, stage2Seen: true });
      await beginDummyBattle(page);
      await page.evaluate(() => {
        RPG.State.currentEnemy = {
          id: 'test_dummy', name: 'テスト用ダミー', hp: 0, xp: 0, gold: 0,
        };
        RPG.State.defeatCounts.test_dummy = { cain: 0, owen: 0 };
        RPG.State.lastBlowBy = 'Owen';
        battleSystem.endBattle(false);
      });
      await drainDialogue(page);
      const result = await page.evaluate(() => ({
        seen: RPG.State.flags.vampireAmberStage1TalkSeen,
        pending: RPG.State.flags.vampireAmberPendingTalkStages,
        logHasLine: (document.getElementById('logContainer')?.textContent || '')
          .includes('オーエン「おまえ、そういうの好きなの？」'),
      }));
      expect(result).toEqual({ seen: true, pending: [], logHasLine: true });
    });

    test('a weasel scare-off (endWeaselEscapeBattle) advances the chain by one', async ({ page }) => {
      await setupChainState(page, { chainCount: 2 });
      const result = await page.evaluate(() => {
        RPG.State.currentEnemy = { id: 'weasel', name: '魔界のイタチ' };
        battleSystem.endWeaselEscapeBattle();
        return RPG.State.flags.vampireAmberChainBattleCount;
      });
      expect(result).toBe(3);
    });

    test('completing the 6th battle by victory forces the amber off, logs the system line, and resets the chain', async ({ page }) => {
      await setupChainState(page, { chainCount: 5 });
      const result = await page.evaluate(() => {
        RPG.State.currentEnemy = {
          id: 'test_dummy', name: 'テスト用ダミー', hp: 0, xp: 0, gold: 0,
        };
        RPG.State.defeatCounts.test_dummy = { cain: 0, owen: 0 };
        RPG.State.lastBlowBy = 'Cain';
        battleSystem.executeStandardVictory('test_dummy');
        return {
          equipped: RPG.State.equippedRareAmberId,
          vampireAmberCount: RPG.State.inventory.vampireAmber,
          chainCount: RPG.State.flags.vampireAmberChainBattleCount,
          logHasLine: (document.getElementById('logContainer')?.textContent || '')
            .includes('オーエンが《吸血琥珀》を乱暴にもぎ取った！'),
        };
      });
      expect(result).toEqual({
        equipped: null, vampireAmberCount: 1, chainCount: 0, logHasLine: true,
      });
    });

    test('completing the 6th battle via weasel scare-off also forces the amber off exactly once', async ({ page }) => {
      await setupChainState(page, { chainCount: 5 });
      const result = await page.evaluate(() => {
        RPG.State.currentEnemy = { id: 'weasel', name: '魔界のイタチ' };
        battleSystem.endWeaselEscapeBattle();
        return {
          equipped: RPG.State.equippedRareAmberId,
          vampireAmberCount: RPG.State.inventory.vampireAmber,
          chainCount: RPG.State.flags.vampireAmberChainBattleCount,
          logOccurrences: (document.getElementById('logContainer')?.textContent || '')
            .split('オーエンが《吸血琥珀》を乱暴にもぎ取った！').length - 1,
        };
      });
      expect(result).toEqual({
        equipped: null, vampireAmberCount: 1, chainCount: 0, logOccurrences: 1,
      });
    });

    test('a normal defeat on battles 1-5 resets the chain but does not remove the amber', async ({ page }) => {
      await setupChainState(page, { chainCount: 2 });
      const result = await page.evaluate(() => {
        battleSystem.finalizeStandardDefeat('test_dummy');
        return {
          equipped: RPG.State.equippedRareAmberId,
          vampireAmberCount: RPG.State.inventory.vampireAmber,
          chainCount: RPG.State.flags.vampireAmberChainBattleCount,
        };
      });
      expect(result).toEqual({ equipped: 'vampireAmber', vampireAmberCount: 0, chainCount: 0 });
    });

    test('a defeat on the 6th battle also forces the amber off, without the conscious-only system line, and the bedside line appears instead', async ({ page }) => {
      // The real defeat cinematic runs on several real-time delays unrelated to debug.isSkipping
      // (its textless steps aren't tap-driven), so rather than waiting for it to fully play out,
      // inspect the queued state directly - by the time finalizeStandardDefeat() returns, the
      // synchronous part of showDefeatSequence() has run and paused on its first delayed step,
      // leaving all later-pushed entries (including ours) still sitting in the queue untouched.
      await setupChainState(page, { chainCount: 5 });
      const result = await page.evaluate(() => {
        battleSystem.finalizeStandardDefeat('test_dummy');
        const queuedTexts = RPG.State.dialogueQueue.map(entry => entry.text).filter(Boolean);
        return {
          equipped: RPG.State.equippedRareAmberId,
          vampireAmberCount: RPG.State.inventory.vampireAmber,
          chainCount: RPG.State.flags.vampireAmberChainBattleCount,
          queuedTexts,
        };
      });
      // Clean up so this dangling defeat-sequence queue doesn't bleed into later tests.
      await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.dialogueQueue = [];
      });
      expect(result.equipped).toBeNull();
      expect(result.vampireAmberCount).toBe(1);
      expect(result.chainCount).toBe(0);
      expect(result.queuedTexts.some(t => t.includes('もぎ取った'))).toBe(false);
      expect(result.queuedTexts).toContain('《吸血琥珀》はブローチから外されていた。');
    });

    test('the stage-1 talk is reserved at battle start and plays only after victory', async ({ page }) => {
      await setupChainState(page, { chainCount: 0, stage1Seen: false, stage2Seen: true });
      await beginDummyBattle(page);
      const beforeVictory = await page.evaluate(() => ({
        seen: RPG.State.flags.vampireAmberStage1TalkSeen,
        pending: RPG.State.flags.vampireAmberPendingTalkStages,
        mode: RPG.State.mode,
        logHasLine: (document.getElementById('logContainer')?.textContent || '')
          .includes('オーエン「おまえ、そういうの好きなの？」'),
      }));
      expect(beforeVictory).toEqual({
        seen: false, pending: [1], mode: 'battle', logHasLine: false,
      });

      await completeDummyVictory(page);
      await drainDialogue(page);
      const afterVictory = await page.evaluate(() => ({
        seen: RPG.State.flags.vampireAmberStage1TalkSeen,
        pending: RPG.State.flags.vampireAmberPendingTalkStages,
        mode: RPG.State.mode,
        lines: [...document.querySelectorAll('#logContainer .log-entry')]
          .map(element => element.textContent)
          .filter(text => (
            text.includes('そういうの好きなの') ||
            text === 'カイン「何がだ」' ||
            text.includes('血を吸われるの') ||
            text.includes('必要な時以外は')
          )),
      }));
      expect(afterVictory).toEqual({
        seen: true,
        pending: [],
        mode: 'base',
        lines: [
          'オーエン「おまえ、そういうの好きなの？」',
          'カイン「何がだ」',
          'オーエン「血を吸われるの」',
          'カイン「好きじゃない。必要な時以外はなるべく使いたくないな」',
        ],
      });
    });

    test('the stage-1 talk does not replay once already seen', async ({ page }) => {
      await setupChainState(page, { chainCount: 0, stage1Seen: true, stage2Seen: true });
      await beginDummyBattle(page);
      const result = await page.evaluate(() => ({
        mode: RPG.State.mode,
        pending: RPG.State.flags.vampireAmberPendingTalkStages,
        logHasLine: (document.getElementById('logContainer')?.textContent || '').includes('好きじゃない'),
      }));
      expect(result).toEqual({ mode: 'battle', pending: [], logHasLine: false });
    });

    test('the stage-2 talk is reserved at battle start and plays only after victory', async ({ page }) => {
      await setupChainState(page, { chainCount: 3, stage1Seen: true, stage2Seen: false });
      await beginDummyBattle(page);
      const beforeVictory = await page.evaluate(() => ({
        seen: RPG.State.flags.vampireAmberStage2TalkSeen,
        pending: RPG.State.flags.vampireAmberPendingTalkStages,
        mode: RPG.State.mode,
        logHasLine: (document.getElementById('logContainer')?.textContent || '')
          .includes('オーエン「……もうやめたら？」'),
      }));
      expect(beforeVictory).toEqual({
        seen: false, pending: [2], mode: 'battle', logHasLine: false,
      });

      await completeDummyVictory(page);
      await drainDialogue(page);
      const afterVictory = await page.evaluate(() => ({
        seen: RPG.State.flags.vampireAmberStage2TalkSeen,
        pending: RPG.State.flags.vampireAmberPendingTalkStages,
        mode: RPG.State.mode,
        lines: [...document.querySelectorAll('#logContainer .log-entry')]
          .map(element => element.textContent)
          .filter(text => text.includes('クラクラしてきた') || text.includes('もうやめたら')),
      }));
      expect(afterVictory).toEqual({
        seen: true,
        pending: [],
        mode: 'base',
        lines: [
          'カイン（まずい、クラクラしてきた）',
          'オーエン「……もうやめたら？」',
        ],
      });
    });

    test('the stage-2 talk does not replay once already seen', async ({ page }) => {
      await setupChainState(page, { chainCount: 3, stage1Seen: true, stage2Seen: true });
      await beginDummyBattle(page);
      const result = await page.evaluate(() => ({
        mode: RPG.State.mode,
        pending: RPG.State.flags.vampireAmberPendingTalkStages,
        logHasLine: (document.getElementById('logContainer')?.textContent || '').includes('もうやめたら'),
      }));
      expect(result).toEqual({ mode: 'battle', pending: [], logHasLine: false });
    });

    test('a defeat keeps the reserved stage talk unread until the next vampire-amber victory', async ({ page }) => {
      await setupChainState(page, { chainCount: 0, stage1Seen: false, stage2Seen: true });
      await beginDummyBattle(page);
      const afterDefeat = await page.evaluate(() => {
        battleSystem.finalizeStandardDefeat('test_dummy');
        const captured = {
          seen: RPG.State.flags.vampireAmberStage1TalkSeen,
          pending: [...RPG.State.flags.vampireAmberPendingTalkStages],
          chainCount: RPG.State.flags.vampireAmberChainBattleCount,
        };
        RPG.State.mode = 'base';
        RPG.State.dialogueQueue = [];
        return captured;
      });
      expect(afterDefeat).toEqual({ seen: false, pending: [1], chainCount: 0 });

      await page.evaluate(() => {
        RPG.State.currentHP = RPG.State.maxHP;
      });
      await beginDummyBattle(page);
      await completeDummyVictory(page);
      await drainDialogue(page);
      const afterNextVictory = await page.evaluate(() => ({
        seen: RPG.State.flags.vampireAmberStage1TalkSeen,
        pending: RPG.State.flags.vampireAmberPendingTalkStages,
        logHasLine: (document.getElementById('logContainer')?.textContent || '')
          .includes('カイン「好きじゃない。必要な時以外はなるべく使いたくないな」'),
      }));
      expect(afterNextVictory).toEqual({ seen: true, pending: [], logHasLine: true });
    });

    test('a weasel escape keeps the reserved talk unread until a later normal victory', async ({ page }) => {
      await setupChainState(page, { chainCount: 0, stage1Seen: false, stage2Seen: true });
      await beginDummyBattle(page, { id: 'weasel', name: '魔界のイタチ' });
      await page.evaluate(() => {
        battleSystem.endWeaselEscapeBattle();
      });

      const afterEscape = await page.evaluate(() => ({
        seen: RPG.State.flags.vampireAmberStage1TalkSeen,
        pending: RPG.State.flags.vampireAmberPendingTalkStages,
        mode: RPG.State.mode,
        logHasLine: (document.getElementById('logContainer')?.textContent || '')
          .includes('オーエン「おまえ、そういうの好きなの？」'),
      }));
      expect(afterEscape).toEqual({
        seen: false,
        pending: [1],
        mode: 'base',
        logHasLine: false,
      });

      await setupChainState(page, {
        chainCount: 1,
        stage1Seen: false,
        stage2Seen: true,
        pendingTalkStages: [1],
      });
      await beginDummyBattle(page);
      await completeDummyVictory(page);
      await drainDialogue(page);

      const afterNextVictory = await page.evaluate(() => ({
        seen: RPG.State.flags.vampireAmberStage1TalkSeen,
        pending: RPG.State.flags.vampireAmberPendingTalkStages,
        logHasLine: (document.getElementById('logContainer')?.textContent || '')
          .includes('カイン「好きじゃない。必要な時以外はなるべく使いたくないな」'),
      }));
      expect(afterNextVictory).toEqual({ seen: true, pending: [], logHasLine: true });
    });

    test('a boss aftermath keeps the vampire talk pending instead of being overwritten', async ({ page }) => {
      await setupChainState(page, { chainCount: 0, stage1Seen: false, stage2Seen: true });
      await beginDummyBattle(page, { id: 'hungry_amber_tree', name: '飢えた琥珀樹' });
      await completeDummyVictory(page, 'hungry_amber_tree');
      const result = await page.evaluate(() => {
        const captured = {
          seen: RPG.State.flags.vampireAmberStage1TalkSeen,
          pending: [...RPG.State.flags.vampireAmberPendingTalkStages],
          logHasVampireTalk: (document.getElementById('logContainer')?.textContent || '')
            .includes('オーエン「おまえ、そういうの好きなの？」'),
          logHasBossAftermath: (document.getElementById('logContainer')?.textContent || '')
            .includes('―― 勝利！ ――'),
        };
        RPG.State.mode = 'base';
        RPG.State.dialogueQueue = [];
        return captured;
      });
      expect(result).toEqual({
        seen: false,
        pending: [1],
        logHasVampireTalk: false,
        logHasBossAftermath: true,
      });
    });

    test('a rat-count talk colliding with vampire talk is deferred to the next rat victory', async ({ page }) => {
      await setupChainState(page, { chainCount: 0, stage1Seen: false, stage2Seen: true });
      await page.evaluate(() => {
        RPG.State.defeatCounts.rat = { cain: 0, owen: 0 };
      });
      await beginDummyBattle(page, { id: 'rat', name: '魔界のネズミ' });
      await completeDummyVictory(page, 'rat');
      await drainDialogue(page);

      const firstVictory = await page.evaluate(() => ({
        pendingCountEvents: RPG.State.flags.pendingBattleCountEvents,
        logText: document.getElementById('logContainer')?.textContent || '',
      }));
      expect(firstVictory.pendingCountEvents).toEqual([{ enemyId: 'rat', count: 1 }]);
      expect(firstVictory.logText).toContain('オーエン「おまえ、そういうの好きなの？」');
      expect(firstVictory.logText).not.toContain('カイン「デカいネズミだったな…犬くらいあるぞ」');

      await page.evaluate(() => {
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
      });
      await beginDummyBattle(page, { id: 'rat', name: '魔界のネズミ' });
      await completeDummyVictory(page, 'rat');
      await drainDialogue(page);

      const secondVictory = await page.evaluate(() => ({
        pendingCountEvents: RPG.State.flags.pendingBattleCountEvents,
        logText: document.getElementById('logContainer')?.textContent || '',
      }));
      expect(secondVictory.pendingCountEvents).toEqual([]);
      expect(secondVictory.logText).toContain('カイン「デカいネズミだったな…犬くらいあるぞ」');
      expect(secondVictory.logText).not.toContain('オーエン「おまえ、そういうの好きなの？」');
    });

    test('a weasel-count talk colliding with vampire talk is deferred to the next weasel victory', async ({ page }) => {
      await setupChainState(page, { chainCount: 0, stage1Seen: false, stage2Seen: true });
      await page.evaluate(() => {
        RPG.State.defeatCounts.weasel = { cain: 2, owen: 0 };
      });
      await beginDummyBattle(page, { id: 'weasel', name: '魔界のイタチ' });
      await completeDummyVictory(page, 'weasel');
      await drainDialogue(page);

      const thirdVictory = await page.evaluate(() => ({
        pendingCountEvents: RPG.State.flags.pendingBattleCountEvents,
        logText: document.getElementById('logContainer')?.textContent || '',
      }));
      expect(thirdVictory.pendingCountEvents).toEqual([{ enemyId: 'weasel', count: 3 }]);
      expect(thirdVictory.logText).toContain('カイン「好きじゃない。必要な時以外はなるべく使いたくないな」');
      expect(thirdVictory.logText).not.toContain('カイン「悔しいな…次こそは見切ってみせる！」');

      await page.evaluate(() => {
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
      });
      await beginDummyBattle(page, { id: 'weasel', name: '魔界のイタチ' });
      await completeDummyVictory(page, 'weasel');
      await drainDialogue(page);

      const fourthVictory = await page.evaluate(() => ({
        pendingCountEvents: RPG.State.flags.pendingBattleCountEvents,
        logText: document.getElementById('logContainer')?.textContent || '',
      }));
      expect(fourthVictory.pendingCountEvents).toEqual([]);
      expect(fourthVictory.logText).toContain('カイン「悔しいな…次こそは見切ってみせる！」');
      expect(fourthVictory.logText).not.toContain('カイン「好きじゃない。必要な時以外はなるべく使いたくないな」');
    });

    test('manually detaching or swapping to a different amber resets the chain', async ({ page }) => {
      await setupChainState(page, { chainCount: 3 });
      const detachResult = await page.evaluate(() => {
        uiControl.detachRareAmber({ log: false });
        return RPG.State.flags.vampireAmberChainBattleCount;
      });
      expect(detachResult).toBe(0);

      await setupChainState(page, { chainCount: 4 });
      const swapResult = await page.evaluate(() => {
        RPG.State.inventory.hatedAmber = 1;
        uiControl.equipRareAmber('hatedAmber');
        return {
          chainCount: RPG.State.flags.vampireAmberChainBattleCount,
          equipped: RPG.State.equippedRareAmberId,
        };
      });
      expect(swapResult).toEqual({ chainCount: 0, equipped: 'hatedAmber' });
    });

    test('entering the inn resets the chain but keeps the amber equipped', async ({ page }) => {
      await setupChainState(page, { chainCount: 3 });
      const result = await page.evaluate(() => {
        Object.assign(RPG.State, { isAtInn: false, isInDungeon: true, mode: 'base' });
        innSystem.enterInn(false, { skipEntryEvents: true });
        return {
          chainCount: RPG.State.flags.vampireAmberChainBattleCount,
          equipped: RPG.State.equippedRareAmberId,
        };
      });
      expect(result).toEqual({ chainCount: 0, equipped: 'vampireAmber' });
    });

    test('the dynamic description appears mid-chain and disappears once the chain resets', async ({ page }) => {
      await setupChainState(page, { chainCount: 0 });
      const beforeAnyBattle = await page.evaluate(() => {
        uiControl.selectItem('vampireAmber', 1);
        return document.getElementById('itemDetailArea')?.innerHTML || '';
      });
      expect(beforeAnyBattle).not.toContain('いつもより赤く濁っている');

      await setupChainState(page, { chainCount: 2 });
      const midChainViaInventory = await page.evaluate(() => {
        uiControl.selectItem('vampireAmber', 1);
        return document.getElementById('itemDetailArea')?.innerHTML || '';
      });
      expect(midChainViaInventory).toContain('いつもより赤く濁っている。微かに脈打っている。');

      const midChainViaBrooch = await page.evaluate(() => {
        uiControl.refreshGlowingBroochDetail();
        return document.getElementById('itemDetailArea')?.innerHTML || '';
      });
      expect(midChainViaBrooch).toContain('いつもより赤く濁っている。微かに脈打っている。');

      const afterReset = await page.evaluate(() => {
        uiControl.detachRareAmber({ log: false, refreshModal: false });
        RPG.State.equippedRareAmberId = 'vampireAmber'; // re-equip without going through the chain
        uiControl.selectItem('vampireAmber', 1);
        return document.getElementById('itemDetailArea')?.innerHTML || '';
      });
      expect(afterReset).not.toContain('いつもより赤く濁っている');
    });

    test('a fresh game: chain count and one-time talk flags survive a normal save/load round trip', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.equippedRareAmberId = 'vampireAmber';
        RPG.State.inventory.glowingBrooch = 1;
        RPG.State.inventory.vampireAmber = 0;
        RPG.State.flags.vampireAmberChainBattleCount = 4;
        RPG.State.flags.vampireAmberStage1TalkSeen = true;
        RPG.State.flags.vampireAmberStage2TalkSeen = true;
        RPG.State.flags.vampireAmberPendingTalkStages = [2];
        RPG.State.flags.pendingBattleCountEvents = [{ enemyId: 'rat', count: 1 }];
        const snapshot = uiControl.createSaveSnapshot('journal');
        localStorage.setItem('okai_rpg_vampire_amber_chain_test', JSON.stringify(snapshot));

        RPG.State.flags.vampireAmberChainBattleCount = 0;
        RPG.State.flags.vampireAmberStage1TalkSeen = false;
        RPG.State.flags.vampireAmberStage2TalkSeen = false;
        RPG.State.flags.vampireAmberPendingTalkStages = [];
        RPG.State.flags.pendingBattleCountEvents = [];
        uiControl.loadFromStorage('okai_rpg_vampire_amber_chain_test', 'テスト');

        return {
          chainCount: RPG.State.flags.vampireAmberChainBattleCount,
          stage1Seen: RPG.State.flags.vampireAmberStage1TalkSeen,
          stage2Seen: RPG.State.flags.vampireAmberStage2TalkSeen,
          pendingVampireTalks: RPG.State.flags.vampireAmberPendingTalkStages,
          pendingCountEvents: RPG.State.flags.pendingBattleCountEvents,
        };
      });
      expect(result).toEqual({
        chainCount: 4,
        stage1Seen: true,
        stage2Seen: true,
        pendingVampireTalks: [2],
        pendingCountEvents: [{ enemyId: 'rat', count: 1 }],
      });
    });
  });

  test.describe('vampire amber / matamatabi conflict', () => {
    async function setupAccidentState(page, overrides = {}) {
      return page.evaluate((ov) => {
        Object.assign(RPG.State, {
          mode: 'base',
          isBattling: true,
          currentEnemy: { id: 'test_dummy', name: 'テスト用ダミー', hp: 0, xp: 50, gold: 5 },
          battleState: { playerTookDamage: true },
          equippedRareAmberId: 'vampireAmber',
          deathCount: ov.deathCount ?? 0,
          exp: 0,
        });
        RPG.State.inventory.glowingBrooch = 1;
        RPG.State.inventory.vampireAmber = 0;
        RPG.State.inventory.matamatabiBranch = 1;
        RPG.State.defeatCounts.test_dummy = { cain: 0, owen: 0 };
        Object.assign(RPG.State.flags, {
          matamatabiActive: false,
          vampireAmberChainBattleCount: ov.chainCount ?? 2,
        });
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
      }, overrides);
    }

    test('using the matamatabi branch from inventory while vampireAmber is equipped is blocked', async ({ page }) => {
      await setupAccidentState(page);
      const result = await page.evaluate(() => {
        explorationSystem.useItem('matamatabiBranch');
        return {
          branchCount: RPG.State.inventory.matamatabiBranch,
          matamatabiActive: RPG.State.flags.matamatabiActive,
          equipped: RPG.State.equippedRareAmberId,
          chainCount: RPG.State.flags.vampireAmberChainBattleCount,
          logHasLine: (document.getElementById('logContainer')?.textContent || '')
            .includes('カイン（先に吸血琥珀を外そう）'),
        };
      });
      expect(result).toEqual({
        branchCount: 1, matamatabiActive: false, equipped: 'vampireAmber', chainCount: 2, logHasLine: true,
      });
    });

    test('equipping vampireAmber while matamatabi is active is blocked (swap case)', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.inventory.glowingBrooch = 1;
        RPG.State.inventory.vampireAmber = 1;
        RPG.State.inventory.hatedAmber = 1;
        RPG.State.equippedRareAmberId = 'hatedAmber';
        RPG.State.flags.matamatabiActive = true;
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
        const equipped = uiControl.equipRareAmber('vampireAmber');
        return {
          equipped,
          equippedId: RPG.State.equippedRareAmberId,
          vampireAmberCount: RPG.State.inventory.vampireAmber,
          matamatabiActive: RPG.State.flags.matamatabiActive,
          logHasLine: (document.getElementById('logContainer')?.textContent || '')
            .includes('カイン「今これをつけたら、さすがに血が足りない」'),
        };
      });
      expect(result).toEqual({
        equipped: false, equippedId: 'hatedAmber', vampireAmberCount: 1, matamatabiActive: true, logHasLine: true,
      });
    });

    test('equipping vampireAmber while matamatabi is active is blocked (fresh equip case)', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.inventory.glowingBrooch = 1;
        RPG.State.inventory.vampireAmber = 1;
        RPG.State.equippedRareAmberId = null;
        RPG.State.flags.matamatabiActive = true;
        const equipped = uiControl.equipRareAmber('vampireAmber');
        return {
          equipped,
          equippedId: RPG.State.equippedRareAmberId,
          vampireAmberCount: RPG.State.inventory.vampireAmber,
        };
      });
      expect(result).toEqual({ equipped: false, equippedId: null, vampireAmberCount: 1 });
    });

    test('matamatabi activating on a normal victory while vampireAmber is equipped triggers the accident instead', async ({ page }) => {
      await setupAccidentState(page, { chainCount: 2 });
      const result = await page.evaluate(() => {
        battleSystem.executeStandardVictory('test_dummy');
        // Tap through the 4 remaining spoken lines synchronously (the 1st was already shown
        // by the initial playDialogueLoop() call inside the accident itself). Stop there:
        // the next queued entry is a textless fade step whose action (clearing the log)
        // fires the instant it's dequeued, not after its delay - draining any further would
        // wipe the very lines we're checking for.
        for (let i = 0; i < 4 && RPG.State.mode === 'event'; i++) uiControl.handlePlayerInput();
        return {
          mode: RPG.State.mode,
          equipped: RPG.State.equippedRareAmberId,
          vampireAmberCount: RPG.State.inventory.vampireAmber,
          chainCount: RPG.State.flags.vampireAmberChainBattleCount,
          matamatabiActive: RPG.State.flags.matamatabiActive,
          isBattling: RPG.State.isBattling,
          currentEnemy: RPG.State.currentEnemy,
          deathCount: RPG.State.deathCount,
          defeatCounts: { ...RPG.State.defeatCounts.test_dummy },
          exp: RPG.State.exp,
          logText: document.getElementById('logContainer')?.textContent || '',
        };
      });
      expect(result.mode).toBe('event');
      expect(result.equipped).toBeNull();
      expect(result.vampireAmberCount).toBe(1);
      expect(result.chainCount).toBe(0);
      expect(result.matamatabiActive).toBe(false);
      expect(result.isBattling).toBe(false);
      expect(result.currentEnemy).toBeNull();
      expect(result.deathCount).toBe(0);
      expect(result.defeatCounts).toEqual({ cain: 0, owen: 0 });
      expect(result.exp).toBe(0);
      expect(result.logText).toContain('《マタマタビ》が活性化した。');
      expect(result.logText).toContain('吸血琥珀の様子がおかしい。');
      expect(result.logText).toContain('カイン「あ……っ！？」');
      expect(result.logText).toContain('ドクッ、ドクッ、ドクッ――');
      expect(result.logText).toContain('カインは、その場に倒れた。');
    });

    test('the accident fully resolves back to the inn with HP restored', async ({ page }) => {
      await setupAccidentState(page, { chainCount: 2 });
      await page.evaluate(() => {
        battleSystem.executeStandardVictory('test_dummy');
      });
      await drainDialogue(page, 150);
      const result = await page.evaluate(() => ({
        mode: RPG.State.mode,
        isAtInn: RPG.State.isAtInn,
        location: RPG.State.location,
        currentHP: RPG.State.currentHP,
        maxHP: RPG.State.maxHP,
      }));
      expect(result.mode).toBe('base');
      expect(result.isAtInn).toBe(true);
      expect(result.location).toBe('宿屋《琥珀亭》');
      expect(result.currentHP).toBe(Math.floor(result.maxHP * 0.1));
    });

    test('the accident is not a one-time event and recurs on a later trigger', async ({ page }) => {
      await setupAccidentState(page, { chainCount: 2 });
      const first = await page.evaluate(() => {
        battleSystem.executeStandardVictory('test_dummy');
        return RPG.State.mode;
      });
      expect(first).toBe('event');

      await setupAccidentState(page, { chainCount: 1 });
      const second = await page.evaluate(() => {
        battleSystem.executeStandardVictory('test_dummy');
        return {
          mode: RPG.State.mode,
          logHasLine: (document.getElementById('logContainer')?.textContent || '').includes('《マタマタビ》が活性化した。'),
        };
      });
      expect(second).toEqual({ mode: 'event', logHasLine: true });
    });

    test('an Owen kill also triggers the accident instead of a normal Owen victory', async ({ page }) => {
      await setupAccidentState(page, { chainCount: 4 });
      const result = await page.evaluate(() => {
        RPG.State.lastBlowBy = 'Owen';
        battleSystem.endBattle(false);
        return {
          equipped: RPG.State.equippedRareAmberId,
          chainCount: RPG.State.flags.vampireAmberChainBattleCount,
          matamatabiActive: RPG.State.flags.matamatabiActive,
          defeatCounts: { ...RPG.State.defeatCounts.test_dummy },
        };
      });
      expect(result).toEqual({
        equipped: null, chainCount: 0, matamatabiActive: false, defeatCounts: { cain: 0, owen: 0 },
      });
    });

    test('a death-save retreat also triggers the accident instead of the normal matamatabi activation', async ({ page }) => {
      await setupAccidentState(page, { chainCount: 3 });
      const result = await page.evaluate(() => {
        battleSystem.endBattle(false, true);
        return {
          equipped: RPG.State.equippedRareAmberId,
          chainCount: RPG.State.flags.vampireAmberChainBattleCount,
          matamatabiActive: RPG.State.flags.matamatabiActive,
        };
      });
      expect(result).toEqual({ equipped: null, chainCount: 0, matamatabiActive: false });
    });

    test('regression: matamatabi still activates normally on victory when vampireAmber is not equipped', async ({ page }) => {
      const result = await page.evaluate(() => {
        Object.assign(RPG.State, {
          mode: 'base',
          isBattling: true,
          currentEnemy: { id: 'test_dummy2', name: 'テスト用ダミー2', hp: 0, xp: 10, gold: 0 },
          battleState: { playerTookDamage: true },
          equippedRareAmberId: null,
          exp: 0,
        });
        RPG.State.inventory.matamatabiBranch = 1;
        RPG.State.defeatCounts.test_dummy2 = { cain: 0, owen: 0 };
        RPG.State.lastBlowBy = 'Cain';
        RPG.State.flags.matamatabiActive = false;
        battleSystem.executeStandardVictory('test_dummy2');
        return {
          mode: RPG.State.mode,
          defeatCounts: { ...RPG.State.defeatCounts.test_dummy2 },
        };
      });
      expect(result.mode).toBe('event');
      expect(result.defeatCounts).toEqual({ cain: 1, owen: 0 });
      // Drain into the matamatabi activation dialogue and confirm it still runs as before.
      await drainDialogue(page, 150);
      const activated = await page.evaluate(() => RPG.State.flags.matamatabiActive);
      expect(activated).toBe(true);
    });

    test('a fresh game: state after an accident survives a normal save/load round trip', async ({ page }) => {
      await setupAccidentState(page, { chainCount: 2 });
      const result = await page.evaluate(() => {
        battleSystem.executeStandardVictory('test_dummy');
        // Skip past the dialogue synchronously to reach the settled post-accident state.
        for (let i = 0; i < 20 && RPG.State.mode === 'event'; i++) uiControl.handlePlayerInput();

        const snapshot = uiControl.createSaveSnapshot('journal');
        localStorage.setItem('okai_rpg_matamatabi_accident_test', JSON.stringify(snapshot));

        RPG.State.equippedRareAmberId = 'vampireAmber';
        RPG.State.flags.vampireAmberChainBattleCount = 5;
        RPG.State.flags.matamatabiActive = true;
        uiControl.loadFromStorage('okai_rpg_matamatabi_accident_test', 'テスト');

        return {
          equipped: RPG.State.equippedRareAmberId,
          chainCount: RPG.State.flags.vampireAmberChainBattleCount,
          matamatabiActive: RPG.State.flags.matamatabiActive,
          vampireAmberCount: RPG.State.inventory.vampireAmber,
        };
      });
      expect(result).toEqual({
        equipped: null, chainCount: 0, matamatabiActive: false, vampireAmberCount: 1,
      });
    });
  });

  test.describe('independent amberized rat/weasel encounters (Decouple amberized forest encounters)', () => {
    async function setForestZone(page, overrides = {}) {
      return page.evaluate((ov) => {
        Object.assign(RPG.State, {
          mode: 'base',
          isAtInn: false,
          isInDungeon: true,
          explorationArea: 'forest',
          location: '琥珀の森',
          currentDistance: ov.currentDistance ?? 5,
        });
        RPG.State.flags.chapter1Cleared = false;
        RPG.State.flags.matamatabiActive = false;
        RPG.State.flags.metThiefBoy = ov.metThiefBoy ?? true;
        // Keep the unrelated glowing-cat-rabbit rare roll from competing with the
        // mocked Math.random sequence these tests use to drive the amber roll.
        RPG.State.flags.glowCatRabbitBadEndSeen = true;
      }, overrides);
    }

    test('amberized variants stay locked before the thief-boy event completes', async ({ page }) => {
      await setForestZone(page, { metThiefBoy: false });
      const result = await page.evaluate(() => {
        const originalRandom = Math.random;
        Math.random = () => 0; // would force a roll through if the lock were not enforced
        const roll = battleSystem.rollAmberVariantEncounter();
        Math.random = originalRandom;
        return roll;
      });
      expect(result).toBeNull();
    });

    test('amberized rat and weasel both become reachable once the thief-boy event (metThiefBoy) is complete', async ({ page }) => {
      await setForestZone(page, { metThiefBoy: true });
      const result = await page.evaluate(() => {
        const originalRandom = Math.random;
        const rollWith = (values) => {
          let i = 0;
          Math.random = () => values[Math.min(i++, values.length - 1)];
          return battleSystem.rollAmberVariantEncounter();
        };
        const rat = rollWith([0, 0]).id;
        const weasel = rollWith([0, 0.9]).id;
        Math.random = originalRandom;
        return { rat, weasel };
      });
      expect(result).toEqual({ rat: 'amber_rat', weasel: 'amber_weasel' });
    });

    test('normal rat ALL completion does not block the independent amber_rat draw', async ({ page }) => {
      await setForestZone(page, { metThiefBoy: true });
      const result = await page.evaluate(() => {
        const cleanupBattle = () => {
          RPG.State.isBattling = false;
          RPG.State.currentEnemy = null;
          RPG.State.battleState = null;
          RPG.State.mode = 'base';
        };
        Object.assign(RPG.State.flags, {
          ratBountyAllUnlocked: true,
          ratBountyAllProgress: 5,
        });
        const originalRandom = Math.random;
        let i = 0;
        const values = [0, 0];
        Math.random = () => values[Math.min(i++, values.length - 1)];
        const started = battleSystem.startBattle();
        const enemyId = RPG.State.currentEnemy?.id || null;
        Math.random = originalRandom;
        cleanupBattle();
        return { started, enemyId };
      });
      expect(result).toEqual({ started: true, enemyId: 'amber_rat' });
    });

    test('normal weasel ALL completion does not block the independent amber_weasel draw', async ({ page }) => {
      await setForestZone(page, { metThiefBoy: true });
      const result = await page.evaluate(() => {
        const cleanupBattle = () => {
          RPG.State.isBattling = false;
          RPG.State.currentEnemy = null;
          RPG.State.battleState = null;
          RPG.State.mode = 'base';
        };
        Object.assign(RPG.State.flags, {
          weaselBountyAllUnlocked: true,
          weaselBountyAllProgress: 3,
        });
        const originalRandom = Math.random;
        let i = 0;
        const values = [0, 0.9];
        Math.random = () => values[Math.min(i++, values.length - 1)];
        const started = battleSystem.startBattle();
        const enemyId = RPG.State.currentEnemy?.id || null;
        Math.random = originalRandom;
        cleanupBattle();
        return { started, enemyId };
      });
      expect(result).toEqual({ started: true, enemyId: 'amber_weasel' });
    });

    test('both amberized species stay available even while both normal species are fully suppressed', async ({ page }) => {
      await setForestZone(page, { metThiefBoy: true });
      const result = await page.evaluate(() => {
        const cleanupBattle = () => {
          RPG.State.isBattling = false;
          RPG.State.currentEnemy = null;
          RPG.State.battleState = null;
          RPG.State.mode = 'base';
        };
        Object.assign(RPG.State.flags, {
          ratBountyAllUnlocked: true,
          ratBountyAllProgress: 5,
          weaselBountyAllUnlocked: true,
          weaselBountyAllProgress: 3,
        });
        const originalRandom = Math.random;
        const rollWith = (values) => {
          let i = 0;
          Math.random = () => values[Math.min(i++, values.length - 1)];
          const started = battleSystem.startBattle();
          const enemyId = RPG.State.currentEnemy?.id || null;
          cleanupBattle();
          return { started, enemyId };
        };
        const ratResult = rollWith([0, 0]);
        const weaselResult = rollWith([0, 0.9]);
        const normalRatStarted = battleSystem.startBattle('rat', { randomEncounter: true });
        cleanupBattle();
        const normalWeaselStarted = battleSystem.startBattle('weasel', { randomEncounter: true });
        cleanupBattle();
        Math.random = originalRandom;
        return { ratResult, weaselResult, normalRatStarted, normalWeaselStarted };
      });
      expect(result).toEqual({
        ratResult: { started: true, enemyId: 'amber_rat' },
        weaselResult: { started: true, enemyId: 'amber_weasel' },
        normalRatStarted: false,
        normalWeaselStarted: false,
      });
    });

    test('battles started with an explicit enemyId (fixed, boss, and event battles) are never replaced by the amber roll', async ({ page }) => {
      await setForestZone(page, { metThiefBoy: true });
      const result = await page.evaluate(() => {
        const cleanupBattle = () => {
          RPG.State.isBattling = false;
          RPG.State.currentEnemy = null;
          RPG.State.battleState = null;
          RPG.State.mode = 'base';
        };
        const originalRandom = Math.random;
        Math.random = () => 0; // would force an amber roll if the explicit-id path ever reached it
        const ratStarted = battleSystem.startBattle('rat');
        const ratEnemy = RPG.State.currentEnemy?.id || null;
        cleanupBattle();

        const weaselStarted = battleSystem.startBattle('weasel');
        const weaselEnemy = RPG.State.currentEnemy?.id || null;
        cleanupBattle();

        Math.random = originalRandom;
        return { ratStarted, ratEnemy, weaselStarted, weaselEnemy };
      });
      expect(result).toEqual({
        ratStarted: true, ratEnemy: 'rat',
        weaselStarted: true, weaselEnemy: 'weasel',
      });
    });

    test('defeating an amberized variant only increments its own defeatCounts key', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.currentEnemy = { id: 'amber_rat', name: '琥珀化ネズミ', hp: 0, xp: 15, gold: 0 };
        RPG.State.defeatCounts.amber_rat = { cain: 0, owen: 0 };
        RPG.State.defeatCounts.rat = { cain: 0, owen: 0 };
        RPG.State.isBattling = true;
        RPG.State.mode = 'battle';
        RPG.State.lastBlowBy = 'Cain';
        RPG.State.battleState = {};
        battleSystem.executeStandardVictory('amber_rat');
        return {
          amberRat: { ...RPG.State.defeatCounts.amber_rat },
          rat: { ...RPG.State.defeatCounts.rat },
        };
      });
      expect(result).toEqual({
        amberRat: { cain: 1, owen: 0 },
        rat: { cain: 0, owen: 0 },
      });
    });

    test('defeating an amberized variant does not add to the normal species ALL progress', async ({ page }) => {
      const result = await page.evaluate(() => {
        Object.assign(RPG.State.flags, {
          ratBountyAllUnlocked: true,
          ratBountyAllProgress: 2,
        });
        RPG.State.currentEnemy = { id: 'amber_rat', name: '琥珀化ネズミ', hp: 0, xp: 15, gold: 0 };
        RPG.State.defeatCounts.amber_rat = { cain: 0, owen: 0 };
        RPG.State.defeatCounts.rat = { cain: 0, owen: 0 };
        RPG.State.isBattling = true;
        RPG.State.mode = 'battle';
        RPG.State.lastBlowBy = 'Cain';
        RPG.State.battleState = {};
        battleSystem.executeStandardVictory('amber_rat');
        return {
          ratProgress: RPG.State.flags.ratBountyAllProgress,
          ratDefeatCount: { ...RPG.State.defeatCounts.rat },
        };
      });
      expect(result).toEqual({ ratProgress: 2, ratDefeatCount: { cain: 0, owen: 0 } });
    });

    test('a Cain kill on an amberized variant still grants the guaranteed unknown amber drop', async ({ page }) => {
      const result = await page.evaluate(() => {
        const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'amber_rat');
        RPG.State.currentEnemy = { ...template, hp: 0, armorHp: 0 };
        RPG.State.defeatCounts.amber_rat = { cain: 0, owen: 0 };
        RPG.State.inventory.unknownAmber = 0;
        RPG.State.isBattling = true;
        RPG.State.mode = 'battle';
        RPG.State.lastBlowBy = 'Cain';
        RPG.State.battleState = {};
        battleSystem.executeStandardVictory('amber_rat');
        return {
          unknownAmber: RPG.State.inventory.unknownAmber,
          cainDefeats: RPG.State.defeatCounts.amber_rat.cain,
        };
      });
      expect(result).toEqual({ unknownAmber: 1, cainDefeats: 1 });
    });

    test('old saves preserve or default the thief-boy completion flag that unlocks amber variants', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.flags.metThiefBoy = true;
        const completedSave = uiControl.createSaveSnapshot('journal');
        localStorage.setItem('okai_rpg_amber_unlock_test_completed', JSON.stringify(completedSave));

        const legacySave = JSON.parse(JSON.stringify(completedSave));
        delete legacySave.flags.metThiefBoy;
        localStorage.setItem('okai_rpg_amber_unlock_test_legacy', JSON.stringify(legacySave));

        RPG.State.flags.metThiefBoy = false;
        uiControl.loadFromStorage('okai_rpg_amber_unlock_test_completed', '完了済みセーブ');
        const afterCompletedLoad = RPG.State.flags.metThiefBoy;

        RPG.State.flags.metThiefBoy = true;
        uiControl.loadFromStorage('okai_rpg_amber_unlock_test_legacy', '旧セーブ');
        const afterLegacyLoad = RPG.State.flags.metThiefBoy;

        return { afterCompletedLoad, afterLegacyLoad };
      });
      expect(result).toEqual({ afterCompletedLoad: true, afterLegacyLoad: false });
    });

    test('normal weighted random encounters are unaffected when amber variants are locked', async ({ page }) => {
      await setForestZone(page, { metThiefBoy: false });
      const result = await page.evaluate(() => {
        const cleanupBattle = () => {
          RPG.State.isBattling = false;
          RPG.State.currentEnemy = null;
          RPG.State.battleState = null;
          RPG.State.mode = 'base';
        };
        const originalRandom = Math.random;
        Math.random = () => 0; // would trigger the amber roll if the lock leaked through
        const started = battleSystem.startBattle();
        const enemyId = RPG.State.currentEnemy?.id || null;
        Math.random = originalRandom;
        cleanupBattle();
        return { started, enemyId };
      });
      expect(result.started).toBe(true);
      expect(['amber_rat', 'amber_weasel']).not.toContain(result.enemyId);
    });
  });

  test.describe('amber sap source awareness event (Add amber sap source discovery event)', () => {
    async function runVictory(page, cfg) {
      return page.evaluate((config) => {
        const enemyId = config.enemyId;
        const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === enemyId);
        Object.assign(RPG.State, {
          mode: 'battle',
          isBattling: true,
          currentEnemy: { ...template, hp: 0, ...(config.currentEnemyOverrides || {}) },
          battleState: config.battleState || {},
          equippedRareAmberId: config.equippedRareAmberId ?? null,
          lastBlowBy: config.lastBlowBy || 'Cain',
        });
        if (!RPG.State.defeatCounts) RPG.State.defeatCounts = {};
        RPG.State.defeatCounts[enemyId] = config.defeatCounts;
        if (enemyId !== 'sap' && config.sapDefeatCounts) {
          RPG.State.defeatCounts.sap = config.sapDefeatCounts;
        }
        Object.assign(RPG.State.flags, {
          treeDefeated: config.treeDefeated,
          amberTreeCoinMined: config.amberTreeCoinMined,
          sapSourceAwarenessSeen: config.sapSourceAwarenessSeen,
          matamatabiActive: false,
          vampireAmberChainBattleCount: 0,
          vampireAmberStage1TalkSeen: true,
          vampireAmberStage2TalkSeen: true,
          vampireAmberPendingTalkStages: [],
          pendingBattleCountEvents: [],
          ...(config.flagOverrides || {}),
        });
        if (typeof config.postTreeBattles !== 'undefined') {
          RPG.State.postTreeBattles = config.postTreeBattles;
        }
        battleSystem.executeStandardVictory(enemyId);
        return {
          mode: RPG.State.mode,
          sapSourceAwarenessSeen: RPG.State.flags.sapSourceAwarenessSeen,
          readyForThiefBoy: RPG.State.flags.readyForThiefBoy,
          postTreeBattles: RPG.State.postTreeBattles,
          sapDefeatCounts: { ...(RPG.State.defeatCounts.sap || {}) },
          exp: RPG.State.exp,
        };
      }, cfg);
    }

    test('does not fire when treeDefeated is false', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'sap',
        defeatCounts: { cain: 19, owen: 0 },
        treeDefeated: false,
        amberTreeCoinMined: true,
        sapSourceAwarenessSeen: false,
      });
      expect(result.sapSourceAwarenessSeen).toBe(false);
    });

    test('does not fire when amberTreeCoinMined is false', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'sap',
        defeatCounts: { cain: 19, owen: 0 },
        treeDefeated: true,
        amberTreeCoinMined: false,
        sapSourceAwarenessSeen: false,
      });
      expect(result.sapSourceAwarenessSeen).toBe(false);
    });

    test('does not fire at a cumulative sap kill count of 14', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'sap',
        defeatCounts: { cain: 13, owen: 0 },
        treeDefeated: true,
        amberTreeCoinMined: true,
        sapSourceAwarenessSeen: false,
      });
      expect(result).toMatchObject({
        sapSourceAwarenessSeen: false,
        sapDefeatCounts: { cain: 14, owen: 0 },
      });
    });

    test('fires once the combined Cain+Owen sap kill count reaches 20', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'sap',
        defeatCounts: { cain: 10, owen: 9 },
        lastBlowBy: 'Owen',
        treeDefeated: true,
        amberTreeCoinMined: true,
        sapSourceAwarenessSeen: false,
      });
      expect(result).toMatchObject({
        mode: 'event',
        sapSourceAwarenessSeen: true,
        sapDefeatCounts: { cain: 10, owen: 10 },
      });
    });

    test('does not fire when the defeated enemy is not sap', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'rat',
        defeatCounts: { cain: 0, owen: 0 },
        sapDefeatCounts: { cain: 25, owen: 0 },
        treeDefeated: true,
        amberTreeCoinMined: true,
        sapSourceAwarenessSeen: false,
      });
      expect(result.sapSourceAwarenessSeen).toBe(false);
    });

    test('fires on the next sap win even for an old save already far past 20 kills', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'sap',
        defeatCounts: { cain: 30, owen: 5 },
        treeDefeated: true,
        amberTreeCoinMined: true,
        sapSourceAwarenessSeen: false,
      });
      expect(result.sapSourceAwarenessSeen).toBe(true);
    });

    test('does not replay once already seen', async ({ page }) => {
      const first = await runVictory(page, {
        enemyId: 'sap',
        defeatCounts: { cain: 19, owen: 0 },
        treeDefeated: true,
        amberTreeCoinMined: true,
        sapSourceAwarenessSeen: false,
      });
      expect(first.sapSourceAwarenessSeen).toBe(true);

      const second = await runVictory(page, {
        enemyId: 'sap',
        defeatCounts: { cain: 20, owen: 0 },
        treeDefeated: true,
        amberTreeCoinMined: true,
        sapSourceAwarenessSeen: true,
      });
      expect(second).toMatchObject({ mode: 'base', sapSourceAwarenessSeen: true });
    });

    test('the seen flag survives a save/load round trip', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.flags.sapSourceAwarenessSeen = true;
        const snapshot = uiControl.createSaveSnapshot('journal');
        localStorage.setItem('okai_rpg_sap_source_awareness_test', JSON.stringify(snapshot));

        RPG.State.flags.sapSourceAwarenessSeen = false;
        uiControl.loadFromStorage('okai_rpg_sap_source_awareness_test', '気づきイベントテスト');

        return RPG.State.flags.sapSourceAwarenessSeen;
      });
      expect(result).toBe(true);
    });

    test('old saves missing the new flag default it safely to false', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.flags.sapSourceAwarenessSeen = true;
        const snapshot = uiControl.createSaveSnapshot('journal');
        const legacySave = JSON.parse(JSON.stringify(snapshot));
        delete legacySave.flags.sapSourceAwarenessSeen;
        localStorage.setItem('okai_rpg_sap_source_awareness_legacy_test', JSON.stringify(legacySave));

        RPG.State.flags.sapSourceAwarenessSeen = true;
        uiControl.loadFromStorage('okai_rpg_sap_source_awareness_legacy_test', '旧セーブテスト');

        return RPG.State.flags.sapSourceAwarenessSeen;
      });
      expect(result).toBe(false);
    });

    test('post_tree_fatigue takes priority in the same battle, and the awareness event is deferred (not consumed) to the next sap victory', async ({ page }) => {
      const first = await runVictory(page, {
        enemyId: 'sap',
        defeatCounts: { cain: 19, owen: 0 },
        treeDefeated: true,
        amberTreeCoinMined: true,
        sapSourceAwarenessSeen: false,
        postTreeBattles: 4,
      });
      expect(first).toMatchObject({
        readyForThiefBoy: true,
        postTreeBattles: 'DONE',
        sapSourceAwarenessSeen: false,
      });

      const second = await runVictory(page, {
        enemyId: 'sap',
        defeatCounts: { cain: 20, owen: 0 },
        treeDefeated: true,
        amberTreeCoinMined: true,
        sapSourceAwarenessSeen: false,
        postTreeBattles: 'DONE',
      });
      expect(second.sapSourceAwarenessSeen).toBe(true);
    });

    test('a competing vampire-amber talk does not cause the awareness event to be lost', async ({ page }) => {
      const first = await runVictory(page, {
        enemyId: 'sap',
        defeatCounts: { cain: 19, owen: 0 },
        treeDefeated: true,
        amberTreeCoinMined: true,
        sapSourceAwarenessSeen: false,
        battleState: { vampireAmberDamageMultiplier: 1.5 },
        flagOverrides: {
          vampireAmberPendingTalkStages: [1],
          vampireAmberStage1TalkSeen: false,
        },
      });
      expect(first.sapSourceAwarenessSeen).toBe(false);

      const second = await runVictory(page, {
        enemyId: 'sap',
        defeatCounts: { cain: 20, owen: 0 },
        treeDefeated: true,
        amberTreeCoinMined: true,
        sapSourceAwarenessSeen: false,
      });
      expect(second.sapSourceAwarenessSeen).toBe(true);
    });

    test('a vampire-amber matamatabi accident bypasses the awareness event entirely', async ({ page }) => {
      const result = await page.evaluate(() => {
        const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'sap');
        Object.assign(RPG.State, {
          mode: 'battle',
          isBattling: true,
          currentEnemy: { ...template, hp: 0 },
          battleState: { playerTookDamage: true },
          equippedRareAmberId: 'vampireAmber',
        });
        RPG.State.inventory.glowingBrooch = 1;
        RPG.State.inventory.vampireAmber = 0;
        RPG.State.inventory.matamatabiBranch = 1;
        RPG.State.defeatCounts.sap = { cain: 19, owen: 0 };
        Object.assign(RPG.State.flags, {
          matamatabiActive: false,
          treeDefeated: true,
          amberTreeCoinMined: true,
          sapSourceAwarenessSeen: false,
        });
        battleSystem.executeStandardVictory('sap');
        return {
          sapSourceAwarenessSeen: RPG.State.flags.sapSourceAwarenessSeen,
          sapDefeatCounts: { ...RPG.State.defeatCounts.sap },
        };
      });
      expect(result).toEqual({
        sapSourceAwarenessSeen: false,
        sapDefeatCounts: { cain: 19, owen: 0 },
      });
    });

    test('normal defeat-count, EXP, and drop bookkeeping still work correctly alongside the new event', async ({ page }) => {
      const result = await page.evaluate(() => {
        const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'sap');
        Object.assign(RPG.State, {
          mode: 'battle',
          isBattling: true,
          currentEnemy: { ...template, hp: 0, drop: { id: 'herb', rate: 1 } },
          battleState: {},
          equippedRareAmberId: null,
          lastBlowBy: 'Cain',
          exp: 0,
        });
        RPG.State.inventory.herb = 0;
        RPG.State.defeatCounts.sap = { cain: 19, owen: 0 };
        Object.assign(RPG.State.flags, {
          treeDefeated: true,
          amberTreeCoinMined: true,
          sapSourceAwarenessSeen: false,
          matamatabiActive: false,
          vampireAmberChainBattleCount: 0,
          vampireAmberStage1TalkSeen: true,
          vampireAmberStage2TalkSeen: true,
          vampireAmberPendingTalkStages: [],
          pendingBattleCountEvents: [],
        });
        battleSystem.executeStandardVictory('sap');
        return {
          sapSourceAwarenessSeen: RPG.State.flags.sapSourceAwarenessSeen,
          sapDefeatCounts: { ...RPG.State.defeatCounts.sap },
          exp: RPG.State.exp,
          herb: RPG.State.inventory.herb,
        };
      });
      expect(result).toEqual({
        sapSourceAwarenessSeen: true,
        sapDefeatCounts: { cain: 20, owen: 0 },
        exp: 18,
        herb: 1,
      });
    });
  });

  test.describe('amberized beast battle conversations (Add amberized beast battle conversations)', () => {
    async function runVictory(page, cfg) {
      return page.evaluate((config) => {
        const enemyId = config.enemyId;
        const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === enemyId);
        Object.assign(RPG.State, {
          mode: 'battle',
          isBattling: true,
          currentEnemy: { ...template, hp: 0, ...(config.currentEnemyOverrides || {}) },
          battleState: config.battleState || {},
          equippedRareAmberId: config.equippedRareAmberId ?? null,
          lastBlowBy: config.lastBlowBy || 'Cain',
        });
        if (!RPG.State.defeatCounts) RPG.State.defeatCounts = {};
        RPG.State.defeatCounts[enemyId] = config.defeatCounts;
        Object.entries(config.otherDefeatCounts || {}).forEach(([id, counts]) => {
          RPG.State.defeatCounts[id] = counts;
        });
        Object.assign(RPG.State.flags, {
          treeDefeated: true,
          amberTreeCoinMined: true,
          sapSourceAwarenessSeen: true,
          amberRatEquippedTalkSeen: config.amberRatEquippedTalkSeen ?? false,
          amberRatThreeKillTalkSeen: config.amberRatThreeKillTalkSeen ?? false,
          amberWeaselFirstKillTalkSeen: config.amberWeaselFirstKillTalkSeen ?? false,
          matamatabiActive: false,
          vampireAmberChainBattleCount: 0,
          vampireAmberStage1TalkSeen: true,
          vampireAmberStage2TalkSeen: true,
          vampireAmberPendingTalkStages: [],
          pendingBattleCountEvents: [],
          ...(config.flagOverrides || {}),
        });
        battleSystem.executeStandardVictory(enemyId);
        return {
          mode: RPG.State.mode,
          amberRatEquippedTalkSeen: RPG.State.flags.amberRatEquippedTalkSeen,
          amberRatThreeKillTalkSeen: RPG.State.flags.amberRatThreeKillTalkSeen,
          amberWeaselFirstKillTalkSeen: RPG.State.flags.amberWeaselFirstKillTalkSeen,
          amberRatDefeatCounts: { ...(RPG.State.defeatCounts.amber_rat || {}) },
          amberWeaselDefeatCounts: { ...(RPG.State.defeatCounts.amber_weasel || {}) },
          ratDefeatCounts: { ...(RPG.State.defeatCounts.rat || {}) },
          ratAllProgress: RPG.State.flags.ratBountyAllProgress,
        };
      }, cfg);
    }

    // --- amber_rat equipped talk ---

    test('does not fire on the first amber_rat kill without a rare amber equipped', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'amber_rat',
        defeatCounts: { cain: 0, owen: 0 },
        equippedRareAmberId: null,
      });
      expect(result.amberRatEquippedTalkSeen).toBe(false);
    });

    test('fires on the next amber_rat win once a rare amber becomes equipped', async ({ page }) => {
      const first = await runVictory(page, {
        enemyId: 'amber_rat',
        defeatCounts: { cain: 0, owen: 0 },
        equippedRareAmberId: null,
      });
      expect(first.amberRatEquippedTalkSeen).toBe(false);

      const second = await runVictory(page, {
        enemyId: 'amber_rat',
        defeatCounts: { cain: 1, owen: 0 },
        equippedRareAmberId: 'sweetAmber',
      });
      expect(second.amberRatEquippedTalkSeen).toBe(true);
    });

    test('fires on the very first amber_rat win when already equipped', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'amber_rat',
        defeatCounts: { cain: 0, owen: 0 },
        equippedRareAmberId: 'sweetAmber',
      });
      expect(result.amberRatEquippedTalkSeen).toBe(true);
    });

    test('is not limited to one specific rare amber type', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'amber_rat',
        defeatCounts: { cain: 0, owen: 0 },
        equippedRareAmberId: 'hatedAmber',
      });
      expect(result.amberRatEquippedTalkSeen).toBe(true);
    });

    test('the equipped talk does not replay once already seen', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'amber_rat',
        defeatCounts: { cain: 1, owen: 0 },
        equippedRareAmberId: 'sweetAmber',
        amberRatEquippedTalkSeen: true,
      });
      expect(result).toMatchObject({ mode: 'base', amberRatEquippedTalkSeen: true });
    });

    test('the equipped-talk seen flag survives a save/load round trip', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.flags.amberRatEquippedTalkSeen = true;
        const snapshot = uiControl.createSaveSnapshot('journal');
        localStorage.setItem('okai_rpg_amber_rat_equipped_talk_test', JSON.stringify(snapshot));

        RPG.State.flags.amberRatEquippedTalkSeen = false;
        uiControl.loadFromStorage('okai_rpg_amber_rat_equipped_talk_test', '琥珀装備会話テスト');

        return RPG.State.flags.amberRatEquippedTalkSeen;
      });
      expect(result).toBe(true);
    });

    // --- amber_rat three-kill talk ---

    test('does not fire at 2 cumulative amber_rat kills', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'amber_rat',
        defeatCounts: { cain: 1, owen: 0 },
        equippedRareAmberId: null,
        amberRatEquippedTalkSeen: true,
      });
      expect(result).toMatchObject({
        amberRatThreeKillTalkSeen: false,
        amberRatDefeatCounts: { cain: 2, owen: 0 },
      });
    });

    test('fires once cumulative amber_rat kills reach 3', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'amber_rat',
        defeatCounts: { cain: 2, owen: 0 },
        equippedRareAmberId: null,
        amberRatEquippedTalkSeen: true,
      });
      expect(result).toMatchObject({
        amberRatThreeKillTalkSeen: true,
        amberRatDefeatCounts: { cain: 3, owen: 0 },
      });
    });

    test('fires on the next amber_rat win for an old save already past 3 kills', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'amber_rat',
        defeatCounts: { cain: 10, owen: 5 },
        equippedRareAmberId: null,
        amberRatEquippedTalkSeen: true,
      });
      expect(result.amberRatThreeKillTalkSeen).toBe(true);
    });

    test('the three-kill talk does not replay once already seen', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'amber_rat',
        defeatCounts: { cain: 3, owen: 0 },
        equippedRareAmberId: null,
        amberRatEquippedTalkSeen: true,
        amberRatThreeKillTalkSeen: true,
      });
      expect(result).toMatchObject({ mode: 'base', amberRatThreeKillTalkSeen: true });
    });

    test('when both amber_rat talks qualify in the same battle, the equipped talk fires first and the three-kill talk is deferred to the next win', async ({ page }) => {
      const first = await runVictory(page, {
        enemyId: 'amber_rat',
        defeatCounts: { cain: 2, owen: 0 },
        equippedRareAmberId: 'sweetAmber',
      });
      expect(first).toMatchObject({
        amberRatEquippedTalkSeen: true,
        amberRatThreeKillTalkSeen: false,
        amberRatDefeatCounts: { cain: 3, owen: 0 },
      });

      const second = await runVictory(page, {
        enemyId: 'amber_rat',
        defeatCounts: { cain: 3, owen: 0 },
        equippedRareAmberId: 'sweetAmber',
        amberRatEquippedTalkSeen: true,
      });
      expect(second.amberRatThreeKillTalkSeen).toBe(true);
    });

    // --- amber_weasel first-kill talk ---

    test('does not fire while amber_weasel has zero cumulative kills', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'amber_rat',
        defeatCounts: { cain: 0, owen: 0 },
        otherDefeatCounts: { amber_weasel: { cain: 0, owen: 0 } },
        equippedRareAmberId: null,
      });
      expect(result.amberWeaselFirstKillTalkSeen).toBe(false);
    });

    test('fires once cumulative amber_weasel kills reach 1', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'amber_weasel',
        defeatCounts: { cain: 0, owen: 0 },
      });
      expect(result).toMatchObject({
        amberWeaselFirstKillTalkSeen: true,
        amberWeaselDefeatCounts: { cain: 1, owen: 0 },
      });
    });

    test('fires even without a rare amber equipped', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'amber_weasel',
        defeatCounts: { cain: 0, owen: 0 },
        equippedRareAmberId: null,
      });
      expect(result.amberWeaselFirstKillTalkSeen).toBe(true);
    });

    test('the amber_weasel talk does not replay once already seen', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'amber_weasel',
        defeatCounts: { cain: 1, owen: 0 },
        amberWeaselFirstKillTalkSeen: true,
      });
      expect(result).toMatchObject({ mode: 'base', amberWeaselFirstKillTalkSeen: true });
    });

    test('the amber_weasel talk seen flag survives a save/load round trip', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.flags.amberWeaselFirstKillTalkSeen = true;
        const snapshot = uiControl.createSaveSnapshot('journal');
        localStorage.setItem('okai_rpg_amber_weasel_first_kill_talk_test', JSON.stringify(snapshot));

        RPG.State.flags.amberWeaselFirstKillTalkSeen = false;
        uiControl.loadFromStorage('okai_rpg_amber_weasel_first_kill_talk_test', '琥珀化イタチ会話テスト');

        return RPG.State.flags.amberWeaselFirstKillTalkSeen;
      });
      expect(result).toBe(true);
    });

    test('fires on the next amber_weasel win for an old save already past 1 kill', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'amber_weasel',
        defeatCounts: { cain: 5, owen: 3 },
        amberWeaselFirstKillTalkSeen: false,
      });
      expect(result.amberWeaselFirstKillTalkSeen).toBe(true);
    });

    // --- competition and regression ---

    test('a competing vampire-amber talk defers the amber_rat equipped talk instead of losing it', async ({ page }) => {
      const first = await runVictory(page, {
        enemyId: 'amber_rat',
        defeatCounts: { cain: 0, owen: 0 },
        equippedRareAmberId: 'sweetAmber',
        battleState: { vampireAmberDamageMultiplier: 1.5 },
        flagOverrides: {
          vampireAmberPendingTalkStages: [1],
          vampireAmberStage1TalkSeen: false,
        },
      });
      expect(first.amberRatEquippedTalkSeen).toBe(false);

      const second = await runVictory(page, {
        enemyId: 'amber_rat',
        defeatCounts: { cain: 1, owen: 0 },
        equippedRareAmberId: 'sweetAmber',
      });
      expect(second.amberRatEquippedTalkSeen).toBe(true);
    });

    test('a vampire-amber matamatabi accident bypasses the amber_rat conversations entirely', async ({ page }) => {
      const result = await page.evaluate(() => {
        const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'amber_rat');
        Object.assign(RPG.State, {
          mode: 'battle',
          isBattling: true,
          currentEnemy: { ...template, hp: 0 },
          battleState: { playerTookDamage: true },
          equippedRareAmberId: 'vampireAmber',
        });
        RPG.State.inventory.glowingBrooch = 1;
        RPG.State.inventory.vampireAmber = 0;
        RPG.State.inventory.matamatabiBranch = 1;
        RPG.State.defeatCounts.amber_rat = { cain: 2, owen: 0 };
        Object.assign(RPG.State.flags, {
          matamatabiActive: false,
          amberRatEquippedTalkSeen: false,
          amberRatThreeKillTalkSeen: false,
        });
        battleSystem.executeStandardVictory('amber_rat');
        return {
          amberRatEquippedTalkSeen: RPG.State.flags.amberRatEquippedTalkSeen,
          amberRatThreeKillTalkSeen: RPG.State.flags.amberRatThreeKillTalkSeen,
          amberRatDefeatCounts: { ...RPG.State.defeatCounts.amber_rat },
        };
      });
      expect(result).toEqual({
        amberRatEquippedTalkSeen: false,
        amberRatThreeKillTalkSeen: false,
        amberRatDefeatCounts: { cain: 2, owen: 0 },
      });
    });

    test('an Owen kill counts toward the combined amber_rat total just like a Cain kill', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'amber_rat',
        defeatCounts: { cain: 1, owen: 1 },
        lastBlowBy: 'Owen',
        equippedRareAmberId: null,
        amberRatEquippedTalkSeen: true,
      });
      expect(result).toMatchObject({
        amberRatThreeKillTalkSeen: true,
        amberRatDefeatCounts: { cain: 1, owen: 2 },
      });
    });

    test('defeating amber_rat does not add to the normal rat defeat count or ALL progress', async ({ page }) => {
      const result = await runVictory(page, {
        enemyId: 'amber_rat',
        defeatCounts: { cain: 0, owen: 0 },
        otherDefeatCounts: { rat: { cain: 0, owen: 0 } },
        equippedRareAmberId: 'sweetAmber',
        flagOverrides: {
          ratBountyAllUnlocked: true,
          ratBountyAllProgress: 2,
        },
      });
      expect(result).toMatchObject({
        ratDefeatCounts: { cain: 0, owen: 0 },
        ratAllProgress: 2,
      });
    });

    test('old saves missing any of the three new flags default them safely to false', async ({ page }) => {
      const result = await page.evaluate(() => {
        Object.assign(RPG.State.flags, {
          amberRatEquippedTalkSeen: true,
          amberRatThreeKillTalkSeen: true,
          amberWeaselFirstKillTalkSeen: true,
        });
        const snapshot = uiControl.createSaveSnapshot('journal');
        const legacySave = JSON.parse(JSON.stringify(snapshot));
        delete legacySave.flags.amberRatEquippedTalkSeen;
        delete legacySave.flags.amberRatThreeKillTalkSeen;
        delete legacySave.flags.amberWeaselFirstKillTalkSeen;
        localStorage.setItem('okai_rpg_amberized_talks_legacy_test', JSON.stringify(legacySave));

        Object.assign(RPG.State.flags, {
          amberRatEquippedTalkSeen: true,
          amberRatThreeKillTalkSeen: true,
          amberWeaselFirstKillTalkSeen: true,
        });
        uiControl.loadFromStorage('okai_rpg_amberized_talks_legacy_test', '琥珀化会話旧セーブテスト');

        return {
          amberRatEquippedTalkSeen: RPG.State.flags.amberRatEquippedTalkSeen,
          amberRatThreeKillTalkSeen: RPG.State.flags.amberRatThreeKillTalkSeen,
          amberWeaselFirstKillTalkSeen: RPG.State.flags.amberWeaselFirstKillTalkSeen,
        };
      });
      expect(result).toEqual({
        amberRatEquippedTalkSeen: false,
        amberRatThreeKillTalkSeen: false,
        amberWeaselFirstKillTalkSeen: false,
      });
    });
  });

  test.describe('deep forest post-thief-boy amber sap tuning (Tune deep forest amber sap encounters)', () => {
    async function attemptMoveEncounter(page, cfg) {
      return page.evaluate((c) => {
        Object.assign(RPG.State, {
          mode: 'base',
          isAtInn: false,
          isInDungeon: true,
          explorationArea: 'forest',
          location: c.location ?? '琥珀の森',
          currentDistance: c.distance - 1,
          storyPhase: 2,
        });
        Object.assign(RPG.State.flags, {
          metThiefBoy: c.metThiefBoy,
          isDebugEncountersOff: false,
          onWagon: false,
          matamatabiActive: false,
          silverDelivered: true,
        });
        RPG.State.inventory.silverCoin = 0;

        const originalRandom = Math.random;
        const originalCheckEvents = explorationSystem.checkEvents;
        const originalTreeEncounter = scenarioEvents.treeEventSystem.handleEncounter;
        const originalStartBattle = battleSystem.startBattle;
        let battles = 0;

        Math.random = () => c.randomValue;
        explorationSystem.checkEvents = () => false;
        scenarioEvents.treeEventSystem.handleEncounter = () => false;
        battleSystem.startBattle = () => {
          battles += 1;
          return false;
        };

        explorationSystem.move(1, { skipTravelCue: true });

        Math.random = originalRandom;
        explorationSystem.checkEvents = originalCheckEvents;
        scenarioEvents.treeEventSystem.handleEncounter = originalTreeEncounter;
        battleSystem.startBattle = originalStartBattle;

        return battles;
      }, cfg);
    }

    // --- encounter rate zone ---

    test('the 7m-9m encounter rate is unchanged before the thief-boy encounter', async ({ page }) => {
      const belowBaseline = await attemptMoveEncounter(page, {
        distance: 8, metThiefBoy: false, randomValue: 0.5,
      });
      const aboveBaseline = await attemptMoveEncounter(page, {
        distance: 8, metThiefBoy: false, randomValue: 0.65,
      });
      expect({ belowBaseline, aboveBaseline }).toEqual({ belowBaseline: 1, aboveBaseline: 0 });
    });

    test('the 7m-9m encounter rate is raised after the thief-boy encounter', async ({ page }) => {
      const result = await attemptMoveEncounter(page, {
        distance: 8, metThiefBoy: true, randomValue: 0.65,
      });
      expect(result).toBe(1);
    });

    test('1m-6m keep the baseline encounter rate even after the thief-boy encounter', async ({ page }) => {
      const result = await attemptMoveEncounter(page, {
        distance: 5, metThiefBoy: true, randomValue: 0.65,
      });
      expect(result).toBe(0);
    });

    test('the deep-forest zone never applies on the former highway', async ({ page }) => {
      const result = await page.evaluate(() => {
        Object.assign(RPG.State, { location: 'かつての街道', currentDistance: 8 });
        RPG.State.flags.metThiefBoy = true;
        return explorationSystem.isDeepForestPostThiefBoyZone();
      });
      expect(result).toBe(false);
    });

    test('fixed battles are unaffected by the deep-forest zone and sap weight', async ({ page }) => {
      const result = await page.evaluate(() => {
        Object.assign(RPG.State, {
          mode: 'base',
          isInDungeon: true,
          explorationArea: 'forest',
          location: '琥珀の森',
          currentDistance: 8,
        });
        RPG.State.flags.metThiefBoy = true;
        RPG.State.flags.chapter1Cleared = false;
        const originalRandom = Math.random;
        Math.random = () => 0;
        battleSystem.startBattle('rat');
        const enemyId = RPG.State.currentEnemy?.id || null;
        Math.random = originalRandom;
        RPG.State.isBattling = false;
        RPG.State.currentEnemy = null;
        RPG.State.battleState = null;
        RPG.State.mode = 'base';
        return enemyId;
      });
      expect(result).toBe('rat');
    });

    // --- sap draw weight ---

    test('sap draws a much heavier share in the deep-forest zone, without excluding rat or weasel', async ({ page }) => {
      const result = await page.evaluate(() => {
        Object.assign(RPG.State, {
          mode: 'base',
          isInDungeon: true,
          explorationArea: 'forest',
          location: '琥珀の森',
          currentDistance: 8,
        });
        Object.assign(RPG.State.flags, {
          metThiefBoy: true,
          chapter1Cleared: false,
          matamatabiActive: false,
          glowCatRabbitBadEndSeen: true,
          ratBountyAllUnlocked: false,
          weaselBountyAllUnlocked: false,
        });

        const originalRandom = Math.random;
        const originalBeginBattle = battleSystem.beginBattle;
        // sap (unlike rat/weasel) queues an ambient pre-battle line before beginBattle(), so
        // intercept beginBattle() directly - it captures the chosen template either way,
        // synchronously for rat/weasel or after one extra tap for sap's queued dialogue.
        const drawWith = (value) => {
          Math.random = () => value;
          let pickedId = null;
          battleSystem.beginBattle = template => {
            pickedId = template && template.id;
          };
          battleSystem.startBattle(null, { randomEncounter: true });
          if (pickedId === null && RPG.State.mode === 'event') {
            uiControl.handlePlayerInput();
          }
          RPG.State.mode = 'base';
          RPG.State.dialogueQueue = [];
          return pickedId;
        };

        // Effective weights in this zone: rat=10, weasel=3, sap=15 (boosted from 5), total=28.
        const ratPick = drawWith(0.3);   // 0.3*28=8.4  -> within rat's [0,10)
        const weaselPick = drawWith(0.4); // 0.4*28=11.2 -> within weasel's [10,13)
        const sapPick = drawWith(0.7);    // 0.7*28=19.6 -> within sap's boosted [13,28)

        Math.random = originalRandom;
        battleSystem.beginBattle = originalBeginBattle;
        return { ratPick, weaselPick, sapPick };
      });
      expect(result).toEqual({ ratPick: 'rat', weaselPick: 'weasel', sapPick: 'sap' });
    });

    // --- sap notebook 15-tier ---

    test('the sap second tier does not unlock at 14 kills', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.defeatCounts.sap = { cain: 14, owen: 0 };
        RPG.State.flags.sapBounty20Received = false;
        return innSystem.isNotebookRewardClaimable('sap', '15');
      });
      expect(result).toBe(false);
    });

    test('the sap second tier unlocks at 15 kills and grants the hard bottle', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.defeatCounts.sap = { cain: 15, owen: 0 };
        RPG.State.flags.sapBounty20Received = false;
        RPG.State.inventory.hardBottle = 0;
        const claimable = innSystem.isNotebookRewardClaimable('sap', '15');
        innSystem.claimNotebookRewards('sap', '15');
        return {
          claimable,
          hardBottle: RPG.State.inventory.hardBottle,
          received: RPG.State.flags.sapBounty20Received,
        };
      });
      expect(result).toEqual({ claimable: true, hardBottle: 1, received: true });
    });

    test('an already-claimed old save (sapBounty20Received) is not granted the reward again', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.defeatCounts.sap = { cain: 20, owen: 0 };
        RPG.State.flags.sapBounty20Received = true;
        RPG.State.inventory.hardBottle = 0;
        innSystem.claimNotebookRewards('sap', '15');
        return {
          hardBottle: RPG.State.inventory.hardBottle,
          received: RPG.State.flags.sapBounty20Received,
        };
      });
      expect(result).toEqual({ hardBottle: 0, received: true });
    });

    // --- sap_source_awareness threshold ---

    test('sap_source_awareness does not fire at 14 cumulative sap kills', async ({ page }) => {
      const result = await page.evaluate(() => {
        Object.assign(RPG.State, {
          mode: 'battle', isBattling: true,
          currentEnemy: { ...RPG.Assets.ENEMIES.find(e => e.id === 'sap'), hp: 0 },
          battleState: {}, equippedRareAmberId: null, lastBlowBy: 'Cain',
        });
        RPG.State.defeatCounts.sap = { cain: 13, owen: 0 };
        Object.assign(RPG.State.flags, {
          treeDefeated: true, amberTreeCoinMined: true, sapSourceAwarenessSeen: false,
          matamatabiActive: false, vampireAmberChainBattleCount: 0,
          vampireAmberStage1TalkSeen: true, vampireAmberStage2TalkSeen: true,
          vampireAmberPendingTalkStages: [], pendingBattleCountEvents: [],
        });
        battleSystem.executeStandardVictory('sap');
        return {
          seen: RPG.State.flags.sapSourceAwarenessSeen,
          sapDefeatCounts: { ...RPG.State.defeatCounts.sap },
        };
      });
      expect(result).toEqual({ seen: false, sapDefeatCounts: { cain: 14, owen: 0 } });
    });

    test('sap_source_awareness fires once cumulative sap kills reach 15', async ({ page }) => {
      const result = await page.evaluate(() => {
        Object.assign(RPG.State, {
          mode: 'battle', isBattling: true,
          currentEnemy: { ...RPG.Assets.ENEMIES.find(e => e.id === 'sap'), hp: 0 },
          battleState: {}, equippedRareAmberId: null, lastBlowBy: 'Cain',
        });
        RPG.State.defeatCounts.sap = { cain: 14, owen: 0 };
        Object.assign(RPG.State.flags, {
          treeDefeated: true, amberTreeCoinMined: true, sapSourceAwarenessSeen: false,
          matamatabiActive: false, vampireAmberChainBattleCount: 0,
          vampireAmberStage1TalkSeen: true, vampireAmberStage2TalkSeen: true,
          vampireAmberPendingTalkStages: [], pendingBattleCountEvents: [],
        });
        battleSystem.executeStandardVictory('sap');
        return {
          seen: RPG.State.flags.sapSourceAwarenessSeen,
          sapDefeatCounts: { ...RPG.State.defeatCounts.sap },
        };
      });
      expect(result).toEqual({ seen: true, sapDefeatCounts: { cain: 15, owen: 0 } });
    });

    test('sap_source_awareness fires on the next sap win for an old save already past 15 kills', async ({ page }) => {
      const result = await page.evaluate(() => {
        Object.assign(RPG.State, {
          mode: 'battle', isBattling: true,
          currentEnemy: { ...RPG.Assets.ENEMIES.find(e => e.id === 'sap'), hp: 0 },
          battleState: {}, equippedRareAmberId: null, lastBlowBy: 'Cain',
        });
        RPG.State.defeatCounts.sap = { cain: 25, owen: 5 };
        Object.assign(RPG.State.flags, {
          treeDefeated: true, amberTreeCoinMined: true, sapSourceAwarenessSeen: false,
          matamatabiActive: false, vampireAmberChainBattleCount: 0,
          vampireAmberStage1TalkSeen: true, vampireAmberStage2TalkSeen: true,
          vampireAmberPendingTalkStages: [], pendingBattleCountEvents: [],
        });
        battleSystem.executeStandardVictory('sap');
        return RPG.State.flags.sapSourceAwarenessSeen;
      });
      expect(result).toBe(true);
    });

    test('post_tree_fatigue still takes priority over sap_source_awareness at the new 15-kill threshold', async ({ page }) => {
      const runVictory = async (cfg) => page.evaluate((c) => {
        Object.assign(RPG.State, {
          mode: 'battle', isBattling: true,
          currentEnemy: { ...RPG.Assets.ENEMIES.find(e => e.id === 'sap'), hp: 0 },
          battleState: {}, equippedRareAmberId: null, lastBlowBy: 'Cain',
        });
        RPG.State.defeatCounts.sap = c.defeatCounts;
        Object.assign(RPG.State.flags, {
          treeDefeated: true, amberTreeCoinMined: true,
          sapSourceAwarenessSeen: c.sapSourceAwarenessSeen,
          matamatabiActive: false, vampireAmberChainBattleCount: 0,
          vampireAmberStage1TalkSeen: true, vampireAmberStage2TalkSeen: true,
          vampireAmberPendingTalkStages: [], pendingBattleCountEvents: [],
        });
        RPG.State.postTreeBattles = c.postTreeBattles;
        battleSystem.executeStandardVictory('sap');
        return {
          readyForThiefBoy: RPG.State.flags.readyForThiefBoy,
          postTreeBattles: RPG.State.postTreeBattles,
          sapSourceAwarenessSeen: RPG.State.flags.sapSourceAwarenessSeen,
        };
      }, cfg);

      const first = await runVictory({
        defeatCounts: { cain: 14, owen: 0 }, sapSourceAwarenessSeen: false, postTreeBattles: 4,
      });
      expect(first).toMatchObject({
        readyForThiefBoy: true, postTreeBattles: 'DONE', sapSourceAwarenessSeen: false,
      });

      const second = await runVictory({
        defeatCounts: { cain: 15, owen: 0 }, sapSourceAwarenessSeen: false, postTreeBattles: 'DONE',
      });
      expect(second.sapSourceAwarenessSeen).toBe(true);
    });
  });
});

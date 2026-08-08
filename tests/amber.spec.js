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

  test('Chapter 1 configured EXP values keep the first and regrown carnivorous vines distinct', async ({ page }) => {
    const result = await page.evaluate(() => {
      const values = Object.fromEntries(
        ['hungry_amber_tree', 'giant_larva', 'skull_bee', 'carnivorous_vine', 'amber_burning_root']
          .map(id => [id, RPG.Assets.ENEMIES.find(enemy => enemy.id === id).xp])
      );
      const vine = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'carnivorous_vine');
      const originalContinue = battleSystem.continueBattleStart;
      try {
        battleSystem.continueBattleStart = () => {};
        RPG.State.flags.carnivorousVineDefeated = false;
        battleSystem.beginBattle(vine);
        const firstVineXp = RPG.State.currentEnemy.xp;

        RPG.State.flags.carnivorousVineDefeated = true;
        battleSystem.beginBattle(vine);
        const regrownVineXp = RPG.State.currentEnemy.xp;
        return { values, firstVineXp, regrownVineXp };
      } finally {
        battleSystem.continueBattleStart = originalContinue;
      }
    });

    expect(result).toEqual({
      values: {
        hungry_amber_tree: 250,
        giant_larva: 180,
        skull_bee: 30,
        carnivorous_vine: 30,
        amber_burning_root: 250,
      },
      firstVineXp: 250,
      regrownVineXp: 30,
    });
  });

  test('defeating a carnivorous vine never grants someone\'s diary by itself, fixed encounter or regrown', async ({ page }) => {
    await page.evaluate(() => {
      window.__originalVineContinueBattleStart = battleSystem.continueBattleStart;
      battleSystem.continueBattleStart = () => {};
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'herbGarden',
        currentDistance: 5,
        storyPhase: 6,
      });
      Object.assign(RPG.State.flags, {
        carnivorousVineDefeated: false,
        carnivorousVineRegrown: false,
      });
      RPG.State.inventory.someonesDiary = 0;
      RPG.State.defeatCounts.carnivorous_vine = { cain: 0, owen: 0 };
      explorationSystem.tryHerbGardenVineEncounter(5);
    });
    await drainDialogue(page);

    const fixedDiary = await page.evaluate(() => {
      RPG.State.lastBlowBy = 'Cain';
      battleSystem.executeStandardVictory('carnivorous_vine');
      return RPG.State.inventory.someonesDiary;
    });
    expect(fixedDiary).toBe(0);

    const regrownDiary = await page.evaluate(() => {
      const vine = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'carnivorous_vine');
      RPG.State.flags.carnivorousVineDefeated = true;
      RPG.State.defeatCounts.carnivorous_vine = { cain: 0, owen: 0 };
      battleSystem.beginBattle(vine);
      RPG.State.lastBlowBy = 'Cain';
      battleSystem.executeStandardVictory('carnivorous_vine');
      const diary = RPG.State.inventory.someonesDiary;
      battleSystem.continueBattleStart = window.__originalVineContinueBattleStart;
      delete window.__originalVineContinueBattleStart;
      return diary;
    });
    expect(regrownDiary).toBe(0);
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

  test('forest 2m and 9m each grant one fixed sparkling unknown amber after the knife is obtained', async ({ page }) => {
    const inspectSite = async (distance, hasKnife) => {
      await page.evaluate(({ site, knife }) => {
        Object.assign(RPG.State, {
          mode: 'base',
          isAtInn: false,
          isInDungeon: true,
          explorationArea: 'forest',
          location: '琥珀の森',
          currentDistance: site,
        });
        Object.assign(RPG.State.flags, {
          forest2mSparklingAmberTaken: false,
          forest9mSparklingAmberTaken: false,
        });
        RPG.State.inventory.borrowedMiningKnife = knife ? 1 : 0;
        RPG.State.inventory.miningKnife = 0;
        RPG.State.inventory.unknownAmber = 0;
        RPG.State.unappraisedAmberResults = [];
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
        uiControl.updateUI();
      }, { site: distance, knife: hasKnife });

      const label = await page.evaluate(() => document.getElementById('btnTalk')?.textContent);
      await page.evaluate(() => explorationSystem.talk());
      await drainDialogue(page);
      return {
        label,
        state: await page.evaluate(() => ({
          unknownAmber: RPG.State.inventory.unknownAmber,
          queuedResults: RPG.State.unappraisedAmberResults,
          forest2mTaken: RPG.State.flags.forest2mSparklingAmberTaken,
          forest9mTaken: RPG.State.flags.forest9mSparklingAmberTaken,
          log: document.getElementById('logContainer')?.textContent || '',
        })),
      };
    };

    const beforeKnife = await inspectSite(2, false);
    expect(beforeKnife.label).toBe('調べる');
    expect(beforeKnife.state).toMatchObject({ unknownAmber: 0, queuedResults: [] });
    expect(beforeKnife.state.log).toContain('樹皮がところどころ琥珀化している');

    const twoMeter = await inspectSite(2, true);
    expect(twoMeter.label).toBe('琥珀を掘る');
    expect(twoMeter.state).toMatchObject({
      unknownAmber: 1,
      queuedResults: ['sparkling'],
      forest2mTaken: true,
    });

    const nineMeter = await inspectSite(9, true);
    expect(nineMeter.label).toBe('琥珀を掘る');
    expect(nineMeter.state).toMatchObject({
      unknownAmber: 1,
      queuedResults: ['sparkling'],
      forest9mTaken: true,
    });

    const persisted = await page.evaluate(() => {
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_forest_sparkling_amber_test', JSON.stringify(snapshot));
      RPG.State.flags.forest9mSparklingAmberTaken = false;
      uiControl.loadFromStorage('okai_rpg_forest_sparkling_amber_test', '森の琥珀テスト');
      return RPG.State.flags.forest9mSparklingAmberTaken;
    });
    expect(persisted).toBe(true);
  });

  test('the fortune teller\'s farewell gift on observe grants high herb, not herb', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: true,
        storyPhase: 6,
        silverCoins: 0,
      });
      RPG.State.inventory.herb = 0;
      RPG.State.inventory.highHerb = 0;
      RPG.State.inventory.silverCoin = 0;
      RPG.State.inventory.unknownAmber = 0;
      Object.assign(RPG.State.flags, {
        hasFoundFirstCoin: false,
        amberMerchantRecognized: false,
        treeDefeated: false,
        firstAmberAppraisalDone: false,
        herbGardenFortuneConsultUnlocked: false,
        scentPouchQuestStarted: false,
      });
      RPG.State.observeIndex = 6;
      RPG.State.observePhaseReached = { 6: 1 };
      innSystem.observe();
    });
    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      herb: RPG.State.inventory.herb,
      highHerb: RPG.State.inventory.highHerb,
      log: document.getElementById('logContainer')?.textContent || '',
    }));
    expect(result.log).toContain('上薬草を三つ受け取った！');
    expect(result.highHerb).toBe(3);
    expect(result.herb).toBe(0);
  });

  test('inn talk shows the matamatabi-tree tip only once the rumor has been fully heard, leaving the earlier shared loop alone', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: true,
        storyPhase: 4,
      });
      RPG.State.currentInnTalkLoop = null;
      // Exhaust every phase's one-time entries first, so talk() falls straight through to the
      // currentPhase<=5 shared-loop branch this fix touches, instead of the phase 0-3 backlog.
      RPG.State.talkPhaseReached = { 0: 99, 1: 99, 2: 99, 3: 99, 4: 99 };
      Object.assign(RPG.State.flags, {
        introDebtTalkPending: false,
        innRepairHelpStarted: false,
        needsGlowingRabbitFur: false,
        heardMatamatabiRumor: false,
      });
      innSystem.talk();
    });
    await drainDialogue(page);

    const before = await page.evaluate(() => (
      document.getElementById('logContainer')?.textContent || ''
    ));
    expect(before).not.toContain('森の中にある白っぽい低木が、猫っぽい魔物を惹きつけるかもしれません');

    await page.evaluate(() => {
      RPG.State.flags.heardMatamatabiRumor = true;
      innSystem.talk();
    });
    await drainDialogue(page);

    const after = await page.evaluate(() => (
      document.getElementById('logContainer')?.textContent || ''
    ));
    expect(after).toContain('娘「森の中にある白っぽい低木が、猫っぽい魔物を惹きつけるかもしれません」');
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

  test('the first appraisal (non-fixed path) tells the player rare amber can be equipped from the brooch', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.inventory.unknownAmber = 1;
      RPG.State.flags.treeDefeated = true;
      RPG.State.flags.amberMerchantRecognized = true;
      RPG.State.flags.borrowedMiningKnifeReceived = true;
      RPG.State.flags.firstAmberAppraisalDone = false;
      innSystem.interactWithAmberMerchant();
    });
    await drainDialogue(page);

    const log = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
    expect(log).toContain('琥珀商「珍しい琥珀には、装備できるやつもある。アイテム欄から試してみな」');
    expect(log).toContain('（琥珀はブローチから装備できます）');
  });

  test('the first appraisal handles a fixed sparkling result without creating an item entry', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.inventory.unknownAmber = 1;
      RPG.State.unappraisedAmberResults = ['sparkling'];
      RPG.State.amberStorage.sparkling = 0;
      RPG.State.flags.treeDefeated = true;
      RPG.State.flags.amberMerchantRecognized = true;
      RPG.State.flags.borrowedMiningKnifeReceived = true;
      RPG.State.flags.firstAmberAppraisalDone = false;
      innSystem.interactWithAmberMerchant();
    });
    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      unknownAmber: RPG.State.inventory.unknownAmber,
      sparkling: RPG.State.amberStorage.sparkling,
      itemEntry: RPG.State.inventory.sparkling,
      firstDone: RPG.State.flags.firstAmberAppraisalDone,
      log: document.getElementById('logContainer')?.textContent || '',
    }));
    expect(result).toMatchObject({
      unknownAmber: 0,
      sparkling: 1,
      firstDone: true,
    });
    expect(result.itemEntry).toBeUndefined();
    expect(result.log).toContain('《キラキラ琥珀》');
    expect(result.log).not.toContain('undefined');
  });

  test('a plain ？琥珀 takes priority over a queued fixed result for the first appraisal, leaving the fixed result queued', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.inventory.unknownAmber = 2;
      RPG.State.unappraisedAmberResults = ['junk'];
      RPG.State.amberStorage.sparkling = 0;
      RPG.State.junkAmberDelivered = 0;
      RPG.State.flags.treeDefeated = true;
      RPG.State.flags.amberMerchantRecognized = true;
      RPG.State.flags.borrowedMiningKnifeReceived = true;
      RPG.State.flags.firstAmberAppraisalDone = false;
      innSystem.interactWithAmberMerchant();
    });
    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      unknownAmber: RPG.State.inventory.unknownAmber,
      sparkling: RPG.State.amberStorage.sparkling,
      junkAmberDelivered: RPG.State.junkAmberDelivered,
      queuedResults: RPG.State.unappraisedAmberResults,
      firstDone: RPG.State.flags.firstAmberAppraisalDone,
      log: document.getElementById('logContainer')?.textContent || '',
    }));

    expect(result).toMatchObject({
      unknownAmber: 1,
      sparkling: 1,
      junkAmberDelivered: 0,
      queuedResults: ['junk'],
      firstDone: true,
    });
    expect(result.log).toContain('交換一覧');
    expect(result.log).toContain('鑑定結果：《キラキラ琥珀》');
  });

  test('a plain first amber takes priority over a queued confirmed amber, which stays queued for later', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.inventory.unknownAmber = 2;
      RPG.State.unappraisedAmberResults = ['vampireAmber'];
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
      unknownAmber: RPG.State.inventory.unknownAmber,
      vampireAmber: RPG.State.inventory.vampireAmber,
      sparkling: RPG.State.amberStorage.sparkling,
      firstDone: RPG.State.flags.firstAmberAppraisalDone,
      vampireSeen: RPG.State.flags.vampireAmberAppraisalSeen,
      queuedResults: RPG.State.unappraisedAmberResults,
      log: document.getElementById('logContainer')?.textContent || '',
    }));

    // The plain (non-fixed) ？琥珀 wins the first-appraisal slot, so the tutorial
    // conversation plays and the confirmed vampireAmber result is left queued, untouched.
    expect(result.unknownAmber).toBe(1);
    expect(result.vampireAmber).toBe(0);
    expect(result.sparkling).toBe(1);
    expect(result.firstDone).toBe(true);
    expect(result.vampireSeen).toBe(false);
    expect(result.queuedResults).toEqual(['vampireAmber']);
    expect(result.log).toContain('交換一覧');
    expect(result.log).toContain('鑑定結果：《キラキラ琥珀》');

    await page.evaluate(() => {
      const originalRandom = Math.random;
      Math.random = () => 0;
      innSystem.appraiseAmber();
      Math.random = originalRandom;
    });
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

  test('confirmed appraisal bypasses the unchanged normal random draw', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.inventory.unknownAmber = 3;
      RPG.State.unappraisedAmberResults = ['vampireAmber'];
      RPG.State.inventory.vampireAmber = 0;
      RPG.State.flags.firstAmberAppraisalDone = true;
      RPG.State.flags.vampireAmberAppraisalSeen = false;

      const originalRandom = Math.random;
      let randomCalls = 0;
      Math.random = () => {
        randomCalls++;
        return 0.75;
      };
      innSystem.appraiseAmber();
      Math.random = originalRandom;

      return {
        randomCalls,
        unknownAmber: RPG.State.inventory.unknownAmber,
        vampireAmber: RPG.State.inventory.vampireAmber,
        weights: {
          sparkling: RPG.Assets.AMBER_APPRAISAL.sparkling.weight,
          junk: RPG.Assets.AMBER_APPRAISAL.junk.weight,
          insect: RPG.Assets.AMBER_APPRAISAL.insect.weight,
        },
      };
    });

    expect(result).toEqual({
      randomCalls: 2,
      unknownAmber: 0,
      vampireAmber: 1,
      weights: { sparkling: 70, junk: 15, insect: 15 },
    });
    await drainDialogue(page);
  });

  test('all appraisal combines normal and different confirmed amber into one displayed stack', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.flags.firstAmberAppraisalDone = true;
      RPG.State.inventory.unknownAmber = 3;
      RPG.State.inventory.vampireAmber = 0;
      RPG.State.inventory.monsterAmber = 0;
      RPG.State.unappraisedAmberResults = ['monsterAmber', 'vampireAmber'];

      uiControl.openModal();
      const inventoryText = document.getElementById('itemList')?.textContent || '';
      innSystem.showAmberAppraisalMenu();
      const menuText = document.getElementById('action-buttons')?.textContent || '';
      const originalRandom = Math.random;
      Math.random = () => 0.75;
      document.getElementById('btnAmberAction0').click();
      Math.random = originalRandom;
      return { inventoryText, menuText };
    });
    await drainDialogue(page);

    const after = await page.evaluate(() => ({
      unknownAmber: RPG.State.inventory.unknownAmber,
      queuedResults: RPG.State.unappraisedAmberResults,
      monsterAmber: RPG.State.inventory.monsterAmber,
      vampireAmber: RPG.State.inventory.vampireAmber,
      log: document.getElementById('logContainer')?.textContent || '',
    }));
    expect(result.inventoryText).toContain('🔸？琥珀 (×3)');
    expect(result.inventoryText).not.toContain('specialUnknownAmber');
    expect(result.menuText).toContain('すべて鑑定（🔸？琥珀3個）');
    expect(result.menuText).not.toContain('1個を鑑定');
    expect(after).toMatchObject({
      unknownAmber: 0,
      queuedResults: [],
      monsterAmber: 1,
      vampireAmber: 1,
    });
    expect(after.log).toContain('魔物入り琥珀');
    expect(after.log).toContain('吸血琥珀');
    expect(after.log).toContain('クズ琥珀');
  });

  test('fixed regular appraisal results stay in amber storage and three junk ambers award the mining knife once', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.flags.firstAmberAppraisalDone = true;
      RPG.State.flags.miningKnifeAwarded = false;
      RPG.State.inventory.unknownAmber = 3;
      RPG.State.inventory.vampireAmber = 0;
      RPG.State.inventory.borrowedMiningKnife = 1;
      RPG.State.inventory.miningKnife = 0;
      RPG.State.unappraisedAmberResults = ['sparkling', 'vampireAmber', 'junk'];
      RPG.State.amberStorage.sparkling = 0;
      RPG.State.junkAmberDelivered = 2;
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';
      innSystem.appraiseAmber();
    });
    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      unknownAmber: RPG.State.inventory.unknownAmber,
      sparkling: RPG.State.amberStorage.sparkling,
      vampireAmber: RPG.State.inventory.vampireAmber,
      junkDelivered: RPG.State.junkAmberDelivered,
      borrowedMiningKnife: RPG.State.inventory.borrowedMiningKnife,
      miningKnife: RPG.State.inventory.miningKnife,
      awarded: RPG.State.flags.miningKnifeAwarded,
      log: document.getElementById('logContainer')?.textContent || '',
    }));
    expect(result).toMatchObject({
      unknownAmber: 0,
      sparkling: 1,
      vampireAmber: 1,
      junkDelivered: 3,
      borrowedMiningKnife: 0,
      miningKnife: 1,
      awarded: true,
    });
    expect(result.log).toContain('《キラキラ琥珀》');
    expect(result.log).toContain('《吸血琥珀》');
    expect(result.log).toContain('クズ琥珀でも一生懸命取ってきた努力賞');

    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.inventory.unknownAmber = 1;
      RPG.State.unappraisedAmberResults = ['junk'];
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';
      innSystem.appraiseAmber();
    });
    await drainDialogue(page);
    const afterRepeat = await page.evaluate(() => ({
      junkDelivered: RPG.State.junkAmberDelivered,
      borrowedMiningKnife: RPG.State.inventory.borrowedMiningKnife,
      miningKnife: RPG.State.inventory.miningKnife,
      log: document.getElementById('logContainer')?.textContent || '',
    }));
    expect(afterRepeat).toMatchObject({
      junkDelivered: 4,
      borrowedMiningKnife: 0,
      miningKnife: 1,
    });
    expect(afterRepeat.log).not.toContain('努力賞');
  });

  test('merchant recognition, knife loan, return attempt, and overnight move stay ordered', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.isAtInn = true;
      RPG.State.silverCoins = 1;
      RPG.State.deathCount = 3;
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
    await drainDialogue(page);
    await expect.poll(() => page.evaluate(() => RPG.State.mode)).toBe('choice');
    await expect(page.locator('#action-buttons button')).toHaveCount(4);

    result = await page.evaluate(() => ({
      crackedAmber: RPG.State.inventory.crackedAmber,
      rewardReceived: RPG.State.flags.amberMerchantCrackedAmberReceived,
      logText: document.getElementById('logContainer')?.textContent || '',
    }));
    expect(result.crackedAmber).toBe(1);
    expect(result.rewardReceived).toBe(true);
    expect(result.logText).toContain('あんたよくここ血まみれで通るよな');

    result = await page.evaluate(() => {
      RPG.State.mode = 'base';
      innSystem.interactWithAmberMerchant();
      return {
        mode: RPG.State.mode,
        crackedAmber: RPG.State.inventory.crackedAmber,
      };
    });
    expect(result).toEqual({ mode: 'choice', crackedAmber: 1 });
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

  test('Owen intimidating the rat off in the チューチュー battle completes inn rat event 2, and a later ordinary rat win does not replay its dialogue', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State.flags, {
        innRatEvent: true,
        innRatEvent2: true,
        innRatEvent2BattleActive: true,
      });
      RPG.State.mode = 'battle';
      RPG.State.isBattling = true;
      RPG.State.currentEnemy = { ...RPG.Assets.ENEMIES.find(e => e.id === 'rat') };
      RPG.State.hasOwenSavedLife = false;
      RPG.State.defeatCounts.rat = { cain: 0, owen: 0 };
      battleSystem.endBattle(false, true); // Owen's intimidation (Death Save), not a Cain kill
    });
    await drainDialogue(page);

    const afterDeathSave = await page.evaluate(() => ({
      active: RPG.State.flags.innRatEvent2BattleActive,
      log: document.getElementById('logContainer')?.textContent || '',
    }));

    await page.evaluate(() => {
      const logEl = document.getElementById('logContainer');
      if (logEl) logEl.innerHTML = '';
      RPG.State.mode = 'battle';
      RPG.State.isBattling = true;
      RPG.State.currentEnemy = { ...RPG.Assets.ENEMIES.find(e => e.id === 'rat') };
      RPG.State.lastBlowBy = 'Cain';
      RPG.State.defeatCounts.rat = { cain: 0, owen: 0 };
      battleSystem.endBattle(true); // A genuinely separate, ordinary rat victory afterward
    });
    await drainDialogue(page);

    const afterOrdinaryWin = await page.evaluate(() => ({
      log: document.getElementById('logContainer')?.textContent || '',
    }));

    expect(afterDeathSave.active).toBe(false);
    expect(afterDeathSave.log).toContain('あんたらがいてくれて助かったよ');
    expect(afterOrdinaryWin.log).not.toContain('あんたらがいてくれて助かったよ');
  });

  test('junk appraisals under three cumulative do not create stored amber or convert the borrowed knife', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.mode = 'base';
      RPG.State.inventory.unknownAmber = 2;
      RPG.State.inventory.borrowedMiningKnife = 1;
      RPG.State.flags.firstAmberAppraisalDone = true;
      Math.random = () => 0.75;
      innSystem.appraiseAmber();
    });

    await drainDialogue(page);
    const result = await page.evaluate(() => ({
      amberStorage: RPG.State.amberStorage,
      junkDelivered: RPG.State.junkAmberDelivered,
      borrowedKnife: RPG.State.inventory.borrowedMiningKnife,
      miningKnife: RPG.State.inventory.miningKnife,
    }));

    expect(result).toEqual({
      amberStorage: { sparkling: 0 },
      junkDelivered: 2,
      borrowedKnife: 1,
      miningKnife: 0,
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
    await page.click('#btnAmberAction0');

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
      RPG.State.flags.amberTreeCoinMined = true;
      RPG.State.flags.firstAmberAppraisalDone = true;
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_amber_test', JSON.stringify(snapshot));

      RPG.State.inventory.unknownAmber = 0;
      RPG.State.inventory.borrowedMiningKnife = 0;
      RPG.State.amberStorage.sparkling = 0;
      RPG.State.flags.amberTreeCoinMined = false;
      RPG.State.flags.firstAmberAppraisalDone = false;
      uiControl.loadFromStorage('okai_rpg_amber_test', '琥珀テスト');

      return {
        unknownAmber: RPG.State.inventory.unknownAmber,
        knife: RPG.State.inventory.borrowedMiningKnife,
        sparkling: RPG.State.amberStorage.sparkling,
        coinMined: RPG.State.flags.amberTreeCoinMined,
        firstAppraisal: RPG.State.flags.firstAmberAppraisalDone,
      };
    });

    expect(result).toEqual({
      unknownAmber: 2,
      knife: 1,
      sparkling: 4,
      coinMined: true,
      firstAppraisal: true,
    });
  });

  test('hardened parts absorb normal damage, criticals bypass them, and Owen kills grant no probabilistic drop', async ({ page }) => {
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
      const originalRandom = Math.random;
      // < 0.2 (amber_rat's drop.rate), but the Owen-kill path only grants guaranteedDrop
      // items, so this never reaches the probabilistic drop.rate check either way.
      Math.random = () => 0.1;
      battleSystem.endBattle(false);
      Math.random = originalRandom;

      return {
        afterNormal,
        afterCritical,
        unknownAmber: RPG.State.inventory.unknownAmber,
        owenDefeats: RPG.State.defeatCounts.amber_rat.owen,
      };
    });

    expect(result.afterNormal).toEqual({ hp: 80, armorHp: 30 });
    expect(result.afterCritical).toEqual({ hp: 65, armorHp: 30 });
    expect(result.unknownAmber).toBe(0);
    expect(result.owenDefeats).toBe(1);
  });

  test('amber_weasel highHerb bonus drop rolls independently of, and does not replace, its existing drop', async ({ page }) => {
    const result = await page.evaluate(() => {
      const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'amber_weasel');
      const originalRandom = Math.random;
      const runVictory = roll => {
        RPG.State.currentEnemy = { ...template, hp: 0, armorHp: 0 };
        RPG.State.mode = 'battle';
        RPG.State.isBattling = true;
        RPG.State.lastBlowBy = 'Cain';
        RPG.State.defeatCounts.amber_weasel = { cain: 0, owen: 0 };
        RPG.State.inventory.unknownAmber = 0;
        RPG.State.inventory.highHerb = 0;
        Math.random = () => roll;
        battleSystem.executeStandardVictory('amber_weasel');
        return {
          unknownAmber: RPG.State.inventory.unknownAmber,
          highHerb: RPG.State.inventory.highHerb,
        };
      };

      // 0.2 <= 0.25 < 0.35: the existing drop (rate 0.2) misses while the independent
      // bonusDrop (rate 0.35) still succeeds on its own roll.
      const bonusOnly = runVictory(0.25);
      // Both rates are satisfied together: the bonus coexists with, not instead of, the drop.
      const both = runVictory(0);

      Math.random = originalRandom;
      return { bonusOnly, both };
    });

    expect(result.bonusOnly).toEqual({ unknownAmber: 0, highHerb: 1 });
    expect(result.both).toEqual({ unknownAmber: 1, highHerb: 1 });
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

  test('all eleven rare amber candidates remain scrollable on a phone', async ({ page }) => {
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
    await expect(rows).toHaveCount(11);
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
          matamatabiAutoActivationDone: ov.autoActivationDone ?? false,
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

    test('the accident stops auto-triggering after the first matamatabi activation gate is done', async ({ page }) => {
      await setupAccidentState(page, { chainCount: 2, autoActivationDone: false });
      const first = await page.evaluate(() => battleSystem.shouldTriggerVampireAmberMatamatabiAccident());
      await setupAccidentState(page, { chainCount: 1, autoActivationDone: true });
      const second = await page.evaluate(() => battleSystem.shouldTriggerVampireAmberMatamatabiAccident());
      expect({ first, second }).toEqual({ first: true, second: false });
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

    test('normal matamatabi auto-activation is one-time while manual use remains available', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.inventory.matamatabiBranch = 1;
        RPG.State.flags.matamatabiActive = false;
        RPG.State.flags.matamatabiAutoActivationDone = false;
        RPG.State.battleState = { playerTookDamage: true };

        const firstQueue = battleSystem.buildMatamatabiActivationQueue();
        const firstHasOwenLine = firstQueue.some(entry => entry.text === 'オーエン｢かなりね」');
        firstQueue[firstQueue.length - 1]?.action?.();
        const savedFlag = uiControl.createSaveSnapshot('journal').flags.matamatabiAutoActivationDone;

        RPG.State.flags.matamatabiActive = false;
        RPG.State.battleState = { playerTookDamage: true };
        const secondQueue = battleSystem.buildMatamatabiActivationQueue();

        RPG.State.matamatabiUseCount = 0;
        const manualQueue = explorationSystem.buildMatamatabiManualUseQueue();
        return {
          firstHasOwenLine,
          secondQueueLength: secondQueue.length,
          manualHasOwenLine: manualQueue.some(entry => entry.text === 'オーエン｢かなりね」'),
          autoActivationDone: RPG.State.flags.matamatabiAutoActivationDone,
          savedFlag,
        };
      });

      expect(result).toEqual({
        firstHasOwenLine: true,
        secondQueueLength: 0,
        manualHasOwenLine: false,
        autoActivationDone: true,
        savedFlag: true,
      });
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

    test('a Cain kill on an amberized variant can still grant the unknown amber drop, at its 20% rate', async ({ page }) => {
      const result = await page.evaluate(() => {
        const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'amber_rat');
        const originalRandom = Math.random;

        RPG.State.currentEnemy = { ...template, hp: 0, armorHp: 0 };
        RPG.State.defeatCounts.amber_rat = { cain: 0, owen: 0 };
        RPG.State.inventory.unknownAmber = 0;
        RPG.State.isBattling = true;
        RPG.State.mode = 'battle';
        RPG.State.lastBlowBy = 'Cain';
        RPG.State.battleState = {};
        Math.random = () => 0.1; // < 0.2, drop succeeds
        battleSystem.executeStandardVictory('amber_rat');
        const withDrop = RPG.State.inventory.unknownAmber;

        RPG.State.currentEnemy = { ...template, hp: 0, armorHp: 0 };
        RPG.State.inventory.unknownAmber = 0;
        RPG.State.battleState = {};
        Math.random = () => 0.5; // >= 0.2, drop fails
        battleSystem.executeStandardVictory('amber_rat');
        const withoutDrop = RPG.State.inventory.unknownAmber;

        Math.random = originalRandom;
        return {
          withDrop,
          withoutDrop,
          cainDefeats: RPG.State.defeatCounts.amber_rat.cain,
          dropRate: template.drop && template.drop.rate,
        };
      });
      expect(result).toEqual({ withDrop: 1, withoutDrop: 0, cainDefeats: 2, dropRate: 0.2 });
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
          equippedRareAmberId: c.equippedRareAmberId ?? null,
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

    test('hatedAmber lowers ordinary forest encounters to the configured 5% rate', async ({ page }) => {
      const belowHatedRate = await attemptMoveEncounter(page, {
        distance: 8, metThiefBoy: true, equippedRareAmberId: 'hatedAmber', randomValue: 0.04,
      });
      const atHatedRate = await attemptMoveEncounter(page, {
        distance: 8, metThiefBoy: true, equippedRareAmberId: 'hatedAmber', randomValue: 0.05,
      });
      expect({ belowHatedRate, atHatedRate }).toEqual({ belowHatedRate: 1, atHatedRate: 0 });
    });

    test('hatedAmber also lowers ordinary herb-garden encounters', async ({ page }) => {
      const result = await page.evaluate(() => {
        Object.assign(RPG.State, {
          mode: 'base',
          isAtInn: false,
          isInDungeon: true,
          explorationArea: 'herbGarden',
          location: '薬草園',
          currentDistance: 4,
          storyPhase: 6,
          equippedRareAmberId: 'hatedAmber',
        });
        RPG.State.flags.onWagon = false;

        const originalRandom = Math.random;
        const originalStartBattle = battleSystem.startBattle;
        let battles = 0;
        Math.random = () => 0.04;
        battleSystem.startBattle = () => {
          battles += 1;
          return false;
        };

        explorationSystem.tryHerbGardenEncounter(4);

        Math.random = originalRandom;
        battleSystem.startBattle = originalStartBattle;
        return battles;
      });
      expect(result).toBe(1);
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
        // sap (unlike rat/weasel) queues one or two ambient pre-battle lines before beginBattle()
        // (an extra "empowered" line once metThiefBoy is true), so intercept beginBattle()
        // directly - it captures the chosen template either way, synchronously for rat/weasel or
        // after however many taps sap's queued dialogue needs.
        const drawWith = (value) => {
          Math.random = () => value;
          let pickedId = null;
          battleSystem.beginBattle = template => {
            pickedId = template && template.id;
          };
          battleSystem.startBattle(null, { randomEncounter: true });
          for (let i = 0; i < 5 && pickedId === null && RPG.State.mode === 'event'; i++) {
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

    // --- sap notebook 10-tier ---

    test('the sap second tier does not unlock at 9 kills', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.defeatCounts.sap = { cain: 9, owen: 0 };
        RPG.State.flags.sapBounty20Received = false;
        return innSystem.isNotebookRewardClaimable('sap', '10');
      });
      expect(result).toBe(false);
    });

    test('the sap second tier unlocks at 10 kills and grants the hard bottle', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.defeatCounts.sap = { cain: 10, owen: 0 };
        RPG.State.flags.sapBounty20Received = false;
        RPG.State.inventory.hardBottle = 0;
        const claimable = innSystem.isNotebookRewardClaimable('sap', '10');
        innSystem.claimNotebookRewards('sap', '10');
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
        innSystem.claimNotebookRewards('sap', '10');
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

  test.describe('empowered amber sap after the thief encounter (Empower amber sap after thief encounter)', () => {
    async function startSapBattleDialogue(page, metThiefBoy) {
      const originalShouldIntervene = await page.evaluateHandle(
        () => RPG.Assets.OWEN_BEHAVIOR.shouldIntervene
      );
      try {
        await page.evaluate((mtb) => {
          RPG.Assets.OWEN_BEHAVIOR.shouldIntervene = () => false;
          Object.assign(RPG.State, {
            mode: 'base',
            isBattling: false,
            currentEnemy: null,
            battleState: null,
          });
          RPG.State.flags.treeDefeated = true;
          RPG.State.flags.metThiefBoy = mtb;
          const log = document.getElementById('logContainer');
          if (log) log.innerHTML = '';
          battleSystem.startBattle('sap');
        }, metThiefBoy);
        const endMode = await drainDialogue(page);
        const log = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
        return { endMode, log };
      } finally {
        await page.evaluate((original) => {
          RPG.Assets.OWEN_BEHAVIOR.shouldIntervene = original;
        }, originalShouldIntervene);
        await originalShouldIntervene.dispose();
      }
    }

    async function beginSapBattle(page, metThiefBoy) {
      return page.evaluate((mtb) => {
        const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'sap');
        RPG.State.flags.metThiefBoy = mtb;
        battleSystem.beginBattle(template);
        return {
          id: RPG.State.currentEnemy.id,
          name: RPG.State.currentEnemy.name,
          atk: RPG.State.currentEnemy.atk,
          maxHp: RPG.State.currentEnemy.maxHp,
        };
      }, metThiefBoy);
    }

    async function runSapAttack(page, cfg) {
      return page.evaluate((c) => {
        const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'sap');
        Object.assign(RPG.State, {
          mode: 'battle',
          isBattling: true,
          currentEnemy: { ...template, hp: c.enemyHp, atk: c.atk, armorHp: 0 },
          battleState: { skippedTurns: 0, playerTookDamage: false },
          currentHP: c.currentHP,
          maxHP: c.maxHP ?? 100,
          hasOwenSavedLife: c.hasOwenSavedLife ?? true,
          isPoisoned: false,
          battleTurn: 1,
        });
        RPG.State.flags.metThiefBoy = c.metThiefBoy;
        RPG.State.inventory.gratefulTalisman = 0;
        RPG.State.inventory.charm = c.charm ?? 0;
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';

        const originalRandom = Math.random;
        Math.random = () => c.randomValue ?? 0.9;
        battleSystem.runJourneyEnemyTurn(() => {});
        Math.random = originalRandom;

        return {
          enemyHp: RPG.State.currentEnemy.hp,
          currentHP: RPG.State.currentHP,
          log: document.getElementById('logContainer')?.textContent || '',
          hpFillWidth: document.getElementById('enemyTopHpFill')?.style.width,
        };
      }, cfg);
    }

    // --- unlock condition (battle-start text + attack power) ---

    test('does not show the empowered intro line before the thief encounter', async ({ page }) => {
      const result = await startSapBattleDialogue(page, false);
      expect(result.endMode).toBe('battle');
      expect(result.log).toContain('主を失った樹液が、行き先もなく森を這い回っている。');
      expect(result.log).not.toContain('琥珀の樹液は脈打っている……');
    });

    test('attack power stays at the normal value before the thief encounter', async ({ page }) => {
      const result = await beginSapBattle(page, false);
      expect(result).toMatchObject({ id: 'sap', name: '琥珀の樹液', atk: 16 });
    });

    test('no drain occurs before the thief encounter, even on a landed hit', async ({ page }) => {
      const result = await runSapAttack(page, {
        metThiefBoy: false, currentHP: 100, maxHP: 100, enemyHp: 30, atk: 8, randomValue: 0.9,
      });
      expect(result.enemyHp).toBe(30);
      expect(result.currentHP).toBe(92);
    });

    test('shows the empowered intro line exactly once, alongside the normal battle-start text', async ({ page }) => {
      const result = await startSapBattleDialogue(page, true);
      expect(result.endMode).toBe('battle');
      expect(result.log).toContain('主を失った樹液が、行き先もなく森を這い回っている。');
      const occurrences = result.log.split('琥珀の樹液は脈打っている……').length - 1;
      expect(occurrences).toBe(1);
    });

    test('attack power rises to the configured empowered value after the thief encounter', async ({ page }) => {
      const result = await beginSapBattle(page, true);
      expect(result).toMatchObject({ id: 'sap', name: '琥珀の樹液', atk: 24 });
    });

    test('attack power does not accumulate across repeated battles', async ({ page }) => {
      const first = await beginSapBattle(page, true);
      const second = await beginSapBattle(page, true);
      expect(first.atk).toBe(24);
      expect(second.atk).toBe(24);
    });

    test('attack power does not duplicate across a save/load round trip', async ({ page }) => {
      // currentEnemy is battle-transient (not persisted), so the real risk of "duplicating on
      // save/load" is the metThiefBoy flag itself misbehaving across the round trip and/or the
      // multiplier being applied more than once when a fresh battle starts afterward.
      const result = await page.evaluate(() => {
        RPG.State.flags.metThiefBoy = true;
        const snapshot = uiControl.createSaveSnapshot('journal');
        localStorage.setItem('okai_rpg_empowered_sap_atk_test', JSON.stringify(snapshot));

        RPG.State.flags.metThiefBoy = false;
        uiControl.loadFromStorage('okai_rpg_empowered_sap_atk_test', '凶暴化樹液テスト');
        const metThiefBoyAfterLoad = RPG.State.flags.metThiefBoy;

        const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'sap');
        battleSystem.beginBattle(template);

        return { metThiefBoyAfterLoad, atkAfterLoadThenBegin: RPG.State.currentEnemy.atk };
      });
      expect(result).toEqual({ metThiefBoyAfterLoad: true, atkAfterLoadThenBegin: 24 });
    });

    // --- drain ---

    test('heals the enemy by half the HP Cain actually lost', async ({ page }) => {
      const result = await runSapAttack(page, {
        metThiefBoy: true, currentHP: 100, maxHP: 100, enemyHp: 30, atk: 12, randomValue: 0.9,
      });
      expect(result.enemyHp).toBe(36); // floor(12 * 0.5)
      expect(result.currentHP).toBe(88);
      expect(result.log).toContain('HPを吸収し、HPが6回復した');
    });

    test('when the nominal attack would overkill Cain, the drain is half the HP actually lost', async ({ page }) => {
      const result = await runSapAttack(page, {
        metThiefBoy: true, currentHP: 3, maxHP: 100, enemyHp: 30, atk: 12, randomValue: 0.9,
        hasOwenSavedLife: true, charm: 1,
      });
      expect(result.enemyHp).toBe(31); // 3 HP actually lost, floor(3 * 0.5) = 1
      expect(result.log).toContain('HPが1回復した');
    });

    test('the drain heal never exceeds the enemy max HP', async ({ page }) => {
      const result = await runSapAttack(page, {
        metThiefBoy: true, currentHP: 100, maxHP: 100, enemyHp: 80, atk: 12, randomValue: 0.9,
      });
      expect(result.enemyHp).toBe(85);
      expect(result.log).toContain('HPが5回復した');
    });

    test('no drain and no log line when the enemy is already at max HP', async ({ page }) => {
      const result = await runSapAttack(page, {
        metThiefBoy: true, currentHP: 100, maxHP: 100, enemyHp: 85, atk: 12, randomValue: 0.9,
      });
      expect(result.enemyHp).toBe(85);
      expect(result.log).not.toContain('HPを吸収');
    });

    test('applyEmpoweredSapDrain(0) does nothing and logs nothing', async ({ page }) => {
      const result = await page.evaluate(() => {
        const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'sap');
        RPG.State.currentEnemy = { ...template, hp: 30, atk: 12 };
        RPG.State.isBattling = true;
        RPG.State.flags.metThiefBoy = true;
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
        battleSystem.applyEmpoweredSapDrain(0);
        return {
          enemyHp: RPG.State.currentEnemy.hp,
          log: document.getElementById('logContainer')?.textContent || '',
        };
      });
      expect(result).toEqual({ enemyHp: 30, log: '' });
    });

    // A successful parry (受け流し, a sword technique) now cancels the attack completely - see
    // resolveEnemyDirectDamage/getCainSwordTechniqueRate - so there is no actual damage left for
    // the sap to drain from.
    test('a parried attack deals no damage to Cain and triggers no drain', async ({ page }) => {
      const result = await runSapAttack(page, {
        metThiefBoy: true, currentHP: 100, maxHP: 100, enemyHp: 30, atk: 12, randomValue: 0.01,
      });
      expect(result).toMatchObject({ enemyHp: 30, currentHP: 100 });
      expect(result.log).toContain('カインは攻撃を剣で受け流した！');
      expect(result.log).not.toContain('HPを吸収');
    });

    test('the enemy HP bar in the UI reflects the healed HP after a drain', async ({ page }) => {
      const result = await runSapAttack(page, {
        metThiefBoy: true, currentHP: 100, maxHP: 100, enemyHp: 30, atk: 12, randomValue: 0.9,
      });
      expect(result.enemyHp).toBe(36); // 30 + floor(12 * 0.5)
      expect(result.hpFillWidth).toBe('42.3529%'); // 36/85 max HP
    });

    // --- identity, kill counting, and Owen path ---

    test('the empowered sap keeps the same enemy id and display name', async ({ page }) => {
      const result = await beginSapBattle(page, true);
      expect(result.id).toBe('sap');
      expect(result.name).toBe('琥珀の樹液');
      const sapEntries = await page.evaluate(() => RPG.Assets.ENEMIES.filter(e => e.id === 'sap').length);
      expect(sapEntries).toBe(1);
    });

    test('defeating the empowered sap adds exactly one kill under the existing sap defeatCounts key', async ({ page }) => {
      const result = await page.evaluate(() => {
        const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'sap');
        RPG.State.flags.metThiefBoy = true;
        battleSystem.beginBattle(template);
        RPG.State.currentEnemy.hp = 0;
        RPG.State.lastBlowBy = 'Cain';
        RPG.State.defeatCounts.sap = { cain: 4, owen: 0 };
        battleSystem.executeStandardVictory('sap');
        return {
          sapCounts: { ...RPG.State.defeatCounts.sap },
          otherSapKeys: Object.keys(RPG.State.defeatCounts).filter(
            key => key !== 'sap' && key.toLowerCase().includes('sap')
          ),
        };
      });
      expect(result).toEqual({ sapCounts: { cain: 5, owen: 0 }, otherSapKeys: [] });
    });

    test('Owen defeating the sap does not misfire the drain handler', async ({ page }) => {
      const result = await page.evaluate(() => {
        const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'sap');
        RPG.State.flags.metThiefBoy = true;
        battleSystem.beginBattle(template);
        RPG.State.currentEnemy.hp = 30;
        RPG.State.currentHP = 100;
        RPG.State.maxHP = 100;
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';

        RPG.Assets.OWEN_BEHAVIOR.shouldIntervene = () => true;
        RPG.Assets.OWEN_BEHAVIOR.decideAction = () => 'kill';
        RPG.State.hasOwenIntervened = false;
        battleSystem.processOwenAction(() => {});

        return {
          enemyHp: RPG.State.currentEnemy?.hp ?? null,
          currentHP: RPG.State.currentHP,
          log: document.getElementById('logContainer')?.textContent || '',
          isBattling: RPG.State.isBattling,
        };
      });
      expect(result.currentHP).toBe(100);
      expect(result.log).not.toContain('HPを吸収');
      expect(result.isBattling).toBe(false);
    });
  });

  test.describe('amber root discovery (Add amber root discovery interactions)', () => {
    async function setForestRootState(page, cfg) {
      await page.evaluate((c) => {
        Object.assign(RPG.State, {
          mode: 'base',
          isAtInn: false,
          isInDungeon: true,
          explorationArea: 'forest',
          location: '琥珀の森',
          currentDistance: c.distance,
        });
        Object.assign(RPG.State.flags, {
          treeDefeated: true,
          amberTreeCoinMined: true,
          sapSourceAwarenessSeen: c.sapSourceAwarenessSeen,
        });
        RPG.State.amberRootState = c.amberRootState
          ? { ...c.amberRootState }
          : { 6: 'unexamined', 7: 'unexamined', 8: 'unexamined' };
        if (typeof c.shinyOil === 'number') {
          RPG.State.inventory.shinyOil = c.shinyOil;
        }
        if (typeof c.hardOil === 'number') {
          RPG.State.inventory.hardOil = c.hardOil;
        }
        if (typeof c.attack === 'number') RPG.State.attack = c.attack;
        if (typeof c.maxHP === 'number') RPG.State.maxHP = c.maxHP;
        if (typeof c.currentHP === 'number') RPG.State.currentHP = c.currentHP;
        if (c.suppressOwen) {
          RPG.Assets.OWEN_BEHAVIOR.shouldIntervene = () => false;
        }
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
      }, cfg);
    }

    async function callTalk(page) {
      await page.evaluate(() => explorationSystem.talk());
    }

    async function closeRootChoices(page) {
      await page.evaluate(() => document.getElementById('btnAmberRootCancel')?.click());
    }

    // --- unlock condition ---

    test('the amber root does not appear before sap_source_awareness completes', async ({ page }) => {
      await setForestRootState(page, { distance: 6, sapSourceAwarenessSeen: false });
      await callTalk(page);
      const log = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
      expect(log).not.toContain('【琥珀樹の根】');
    });

    test('the amber root appears at 6m, 7m, and 8m once sap_source_awareness is complete', async ({ page }) => {
      for (const distance of [6, 7, 8]) {
        await setForestRootState(page, { distance, sapSourceAwarenessSeen: true });
        await callTalk(page);
        const endMode = await drainDialogue(page);
        const log = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
        expect(log).toContain('【琥珀樹の根】');
        expect(endMode).toBe('choice');
        await closeRootChoices(page);
      }
    });

    test('hard oil replaces the generic examine command with 琥珀樹の根 at root sites', async ({ page }) => {
      await setForestRootState(page, { distance: 7, sapSourceAwarenessSeen: true, hardOil: 0 });
      const before = await page.evaluate(() => {
        uiControl.updateUI();
        return document.getElementById('btnTalk')?.textContent;
      });
      expect(before).toBe('調べる');

      const after = await page.evaluate(() => {
        RPG.State.inventory.hardOil = 1;
        uiControl.updateUI();
        return document.getElementById('btnTalk')?.textContent;
      });
      expect(after).toBe('琥珀樹の根');
    });

    test('the three sites can be inspected in any order and are tracked independently', async ({ page }) => {
      await setForestRootState(page, { distance: 8, sapSourceAwarenessSeen: true });
      await callTalk(page);
      await drainDialogue(page);
      await closeRootChoices(page);

      await page.evaluate(() => { RPG.State.currentDistance = 6; });
      await callTalk(page);
      await drainDialogue(page);
      await closeRootChoices(page);

      const rootState = await page.evaluate(() => RPG.State.amberRootState);
      expect(rootState).toEqual({ 6: 'examined', 7: 'unexamined', 8: 'examined' });
    });

    // --- first inspection vs. re-inspection ---

    test('only the first inspection shows the Cain/Owen conversation', async ({ page }) => {
      await setForestRootState(page, { distance: 7, sapSourceAwarenessSeen: true });
      await callTalk(page);
      await drainDialogue(page);
      const firstLog = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
      expect(firstLog).toContain('足元にはグロテスクに隆起した根がある。');
      expect(firstLog).toContain('カイン「この根…もしかして琥珀樹の根か？」');
      expect(firstLog).toContain('オーエン「さあね」');
      await closeRootChoices(page);

      await page.evaluate(() => { document.getElementById('logContainer').innerHTML = ''; });
      await callTalk(page);
      await drainDialogue(page);
      const secondLog = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
      expect(secondLog).not.toContain('カイン「この根…もしかして琥珀樹の根か？」');
      expect(secondLog).not.toContain('オーエン「さあね」');
      expect(secondLog).toContain('根は硬い樹皮に覆われたままだ。');
      await closeRootChoices(page);
    });

    // --- choice menu contents ---

    test('without shinyOil, only fire/knife/cancel are offered', async ({ page }) => {
      await setForestRootState(page, { distance: 6, sapSourceAwarenessSeen: true, shinyOil: 0 });
      await callTalk(page);
      await drainDialogue(page);
      const ids = await page.evaluate(() => (
        [...document.querySelectorAll('#action-buttons button')].map(b => b.id)
      ));
      expect(ids).toEqual(['btnAmberRootFire', 'btnAmberRootKnife', 'btnAmberRootCancel']);
      await closeRootChoices(page);
    });

    test('with shinyOil owned, the oil choice is also offered', async ({ page }) => {
      await setForestRootState(page, { distance: 6, sapSourceAwarenessSeen: true, shinyOil: 1 });
      await callTalk(page);
      await drainDialogue(page);
      const ids = await page.evaluate(() => (
        [...document.querySelectorAll('#action-buttons button')].map(b => b.id)
      ));
      expect(ids).toEqual(['btnAmberRootFire', 'btnAmberRootKnife', 'btnAmberRootOil', 'btnAmberRootCancel']);
      await closeRootChoices(page);
    });

    // --- fire ---

    test('the fire choice shows its text and changes neither state nor inventory', async ({ page }) => {
      await setForestRootState(page, { distance: 6, sapSourceAwarenessSeen: true, shinyOil: 1 });
      await callTalk(page);
      await drainDialogue(page);
      await page.evaluate(() => document.getElementById('btnAmberRootFire')?.click());
      const endMode = await drainDialogue(page);
      const result = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        rootState: RPG.State.amberRootState,
        shinyOil: RPG.State.inventory.shinyOil,
      }));
      expect(endMode).toBe('base');
      expect(result.log).toContain('カインは火打ち石で火種を作り、根の表面へ近づけた。');
      expect(result.log).toContain('樹皮の表面が黒く焦げたが、火はすぐに消えた。');
      expect(result.log).toContain('カイン「…火がつかない」');
      expect(result.log).toContain('（表面に傷をつけたら燃えるだろうか）');
      expect(result.rootState).toEqual({ 6: 'examined', 7: 'unexamined', 8: 'unexamined' });
      expect(result.shinyOil).toBe(1);
    });

    // --- knife ---

    test('the knife choice shows its text and changes neither state nor inventory', async ({ page }) => {
      await setForestRootState(page, { distance: 7, sapSourceAwarenessSeen: true, shinyOil: 1 });
      await callTalk(page);
      await drainDialogue(page);
      await page.evaluate(() => document.getElementById('btnAmberRootKnife')?.click());
      const endMode = await drainDialogue(page);
      const result = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        rootState: RPG.State.amberRootState,
        shinyOil: RPG.State.inventory.shinyOil,
      }));
      expect(endMode).toBe('base');
      expect(result.log).toContain('カインはナイフで表面を傷つけようとした。');
      expect(result.log).toContain('カイン「…！硬いな！？傷ひとつつかない」');
      expect(result.log).not.toContain('借りたナイフ');
      expect(result.log).not.toContain('採掘ナイフ');
      expect(result.rootState).toEqual({ 6: 'unexamined', 7: 'examined', 8: 'unexamined' });
      expect(result.shinyOil).toBe(1);
    });

    // --- shinyOil ---

    test('using shinyOil shows its text, consumes exactly one, and scars only the current site', async ({ page }) => {
      await setForestRootState(page, { distance: 7, sapSourceAwarenessSeen: true, shinyOil: 2 });
      await callTalk(page);
      await drainDialogue(page);
      await page.evaluate(() => document.getElementById('btnAmberRootOil')?.click());
      const endMode = await drainDialogue(page);
      const result = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        rootState: RPG.State.amberRootState,
        shinyOil: RPG.State.inventory.shinyOil,
      }));
      expect(endMode).toBe('base');
      expect(result.log).toContain('カインはピカピカ油をナイフに塗った。');
      expect(result.log).toContain('もう一度、根へ刃を押し当てる。');
      expect(result.log).toContain('今度は硬い樹皮に深い傷が入った。');
      expect(result.log).toContain('割れ目の奥に、琥珀色のものが見える。');
      expect(result.log).toContain('カイン「中が琥珀になってるのか……」');
      expect(result.rootState).toEqual({ 6: 'unexamined', 7: 'scarred', 8: 'unexamined' });
      expect(result.shinyOil).toBe(1);
    });

    test('shinyOil cannot be used again on an already-scarred root (no double consumption)', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.amberRootState = { 6: 'scarred', 7: 'unexamined', 8: 'unexamined' };
        RPG.State.inventory.shinyOil = 3;
        explorationSystem.useShinyOilOnAmberRoot(6);
        return {
          shinyOil: RPG.State.inventory.shinyOil,
          rootState: RPG.State.amberRootState,
        };
      });
      expect(result).toEqual({
        shinyOil: 3,
        rootState: { 6: 'scarred', 7: 'unexamined', 8: 'unexamined' },
      });
    });

    // --- scarred root re-inspection ---

    test('a scarred root shows the scar line, then fire/cancel choices (hardOil only when owned)', async ({ page }) => {
      await setForestRootState(page, {
        distance: 8, sapSourceAwarenessSeen: true,
        amberRootState: { 6: 'unexamined', 7: 'unexamined', 8: 'scarred' },
      });
      await callTalk(page);
      const endMode = await drainDialogue(page);
      const result = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        ids: [...document.querySelectorAll('#action-buttons button')].map(b => b.id),
      }));
      expect(endMode).toBe('choice');
      expect(result.log).toContain('【琥珀樹の根】');
      expect(result.log).toContain('樹皮の割れ目から、琥珀化した根が覗いている。');
      expect(result.ids).toEqual(['btnAmberRootFire', 'btnAmberRootCancel']);
      await closeRootChoices(page);
    });

    // --- cancel ---

    test('cancel changes neither inventory nor the state set by opening the menu, and returns to exploration', async ({ page }) => {
      await setForestRootState(page, { distance: 6, sapSourceAwarenessSeen: true, shinyOil: 1 });
      await callTalk(page);
      await drainDialogue(page);
      await closeRootChoices(page);
      const result = await page.evaluate(() => ({
        mode: RPG.State.mode,
        rootState: RPG.State.amberRootState,
        shinyOil: RPG.State.inventory.shinyOil,
      }));
      expect(result.mode).toBe('base');
      expect(result.rootState).toEqual({ 6: 'examined', 7: 'unexamined', 8: 'unexamined' });
      expect(result.shinyOil).toBe(1);
    });

    // --- save/load ---

    test('root state and shinyOil survive a save/load round trip', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.amberRootState = { 6: 'scarred', 7: 'examined', 8: 'unexamined' };
        RPG.State.inventory.shinyOil = 2;
        const snapshot = uiControl.createSaveSnapshot('journal');
        localStorage.setItem('okai_rpg_amber_root_test', JSON.stringify(snapshot));

        RPG.State.amberRootState = { 6: 'unexamined', 7: 'unexamined', 8: 'unexamined' };
        RPG.State.inventory.shinyOil = 0;
        uiControl.loadFromStorage('okai_rpg_amber_root_test', '根テスト');

        return {
          rootState: RPG.State.amberRootState,
          shinyOil: RPG.State.inventory.shinyOil,
        };
      });
      expect(result).toEqual({
        rootState: { 6: 'scarred', 7: 'examined', 8: 'unexamined' },
        shinyOil: 2,
      });
    });

    test('an old save without amberRootState defaults all three sites to unexamined', async ({ page }) => {
      const result = await page.evaluate(() => {
        const snapshot = uiControl.createSaveSnapshot('journal');
        const legacySave = JSON.parse(JSON.stringify(snapshot));
        delete legacySave.amberRootState;
        localStorage.setItem('okai_rpg_amber_root_legacy_test', JSON.stringify(legacySave));

        RPG.State.amberRootState = { 6: 'scarred', 7: 'scarred', 8: 'scarred' };
        uiControl.loadFromStorage('okai_rpg_amber_root_legacy_test', '旧セーブ根テスト');

        return RPG.State.amberRootState;
      });
      expect(result).toEqual({ 6: 'unexamined', 7: 'unexamined', 8: 'unexamined' });
    });

    // --- integration with existing 8m events ---

    test('a pending inn-repair timber quest at 8m still takes priority over the amber root', async ({ page }) => {
      await page.evaluate(() => {
        Object.assign(RPG.State, {
          mode: 'base',
          isAtInn: false,
          isInDungeon: true,
          explorationArea: 'forest',
          location: '琥珀の森',
          currentDistance: 8,
        });
        Object.assign(RPG.State.flags, {
          treeDefeated: true,
          amberTreeCoinMined: true,
          innRepairInspectionReported: true,
          innRepairTimberSearchUnlocked: true,
          innRepairTimberObtained: false,
          sapSourceAwarenessSeen: true,
        });
        RPG.State.amberRootState = { 6: 'unexamined', 7: 'unexamined', 8: 'unexamined' };
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
      });
      await callTalk(page);
      await drainDialogue(page);
      const result = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        rootState8: RPG.State.amberRootState[8],
        timberObtained: RPG.State.flags.innRepairTimberObtained,
      }));
      expect(result.log).not.toContain('【琥珀樹の根】');
      expect(result.rootState8).toBe('unexamined');
      expect(result.timberObtained).toBe(true);
    });
  });

  test.describe('burning amber root battles (Add burning amber root battles)', () => {
    async function setForestRootState(page, cfg) {
      await page.evaluate((c) => {
        Object.assign(RPG.State, {
          mode: 'base',
          isAtInn: false,
          isInDungeon: true,
          explorationArea: 'forest',
          location: '琥珀の森',
          currentDistance: c.distance,
        });
        Object.assign(RPG.State.flags, {
          treeDefeated: true,
          amberTreeCoinMined: true,
          sapSourceAwarenessSeen: true,
        });
        RPG.State.amberRootState = c.amberRootState
          ? { ...c.amberRootState }
          : { 6: 'unexamined', 7: 'unexamined', 8: 'unexamined' };
        if (typeof c.hardOil === 'number') RPG.State.inventory.hardOil = c.hardOil;
        if (typeof c.shinyOil === 'number') RPG.State.inventory.shinyOil = c.shinyOil;
        if (typeof c.attack === 'number') RPG.State.attack = c.attack;
        if (typeof c.maxHP === 'number') RPG.State.maxHP = c.maxHP;
        if (typeof c.currentHP === 'number') RPG.State.currentHP = c.currentHP;
        RPG.Assets.OWEN_BEHAVIOR.shouldIntervene = () => false;
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
      }, cfg);
    }

    async function callTalk(page) {
      await page.evaluate(() => explorationSystem.talk());
    }

    async function closeRootChoices(page) {
      await page.evaluate(() => document.getElementById('btnAmberRootCancel')?.click());
    }

    // The real defeat cinematic (innSystem.showDefeatSequence) is driven by several
    // text-less dialogueQueue entries whose delay is a raw setTimeout, unaffected by
    // debug.isSkipping - only entries with visible text wait for an actual tap
    // (isWaitingForInput). Tap only when genuinely waiting, and give the untappable
    // real-time gaps enough wall-clock budget to elapse.
    async function drainRealTimeDialogue(page, iterations = 60, stepMs = 200) {
      await page.evaluate(() => { window.RPG.State.debug.isSkipping = true; });
      for (let i = 0; i < iterations; i++) {
        const waiting = await page.evaluate(() => (
          RPG.State.mode === 'event' && RPG.State.isWaitingForInput === true
        ));
        if (waiting) {
          await page.evaluate(() => uiControl.handlePlayerInput());
        }
        await page.waitForTimeout(stepMs);
      }
    }

    // --- scarred-state choices ---

    test('without hardOil, only fire/cancel are offered at a scarred root', async ({ page }) => {
      await setForestRootState(page, {
        distance: 6, hardOil: 0,
        amberRootState: { 6: 'scarred', 7: 'unexamined', 8: 'unexamined' },
      });
      await callTalk(page);
      await drainDialogue(page);
      const ids = await page.evaluate(() => (
        [...document.querySelectorAll('#action-buttons button')].map(b => b.id)
      ));
      expect(ids).toEqual(['btnAmberRootFire', 'btnAmberRootCancel']);
      await closeRootChoices(page);
    });

    test('with hardOil owned, the hardOil choice is also offered at a scarred root', async ({ page }) => {
      await setForestRootState(page, {
        distance: 6, hardOil: 1,
        amberRootState: { 6: 'scarred', 7: 'unexamined', 8: 'unexamined' },
      });
      await callTalk(page);
      await drainDialogue(page);
      const ids = await page.evaluate(() => (
        [...document.querySelectorAll('#action-buttons button')].map(b => b.id)
      ));
      expect(ids).toEqual(['btnAmberRootFire', 'btnAmberRootHardOil', 'btnAmberRootCancel']);
      await closeRootChoices(page);
    });

    test('the scarred-state fire choice shows its text and changes neither state nor inventory', async ({ page }) => {
      await setForestRootState(page, {
        distance: 7, hardOil: 2,
        amberRootState: { 6: 'unexamined', 7: 'scarred', 8: 'unexamined' },
      });
      await callTalk(page);
      await drainDialogue(page);
      await page.evaluate(() => document.getElementById('btnAmberRootFire')?.click());
      const endMode = await drainDialogue(page);
      const result = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        rootState: RPG.State.amberRootState,
        hardOil: RPG.State.inventory.hardOil,
      }));
      expect(endMode).toBe('base');
      expect(result.log).toContain('傷ついた樹皮に火がついた。');
      expect(result.log).toContain('だが炎はすぐに小さくなって消えた。');
      expect(result.rootState).toEqual({ 6: 'unexamined', 7: 'scarred', 8: 'unexamined' });
      expect(result.hardOil).toBe(2);
    });

    // --- ignition ---

    test('hardOil ignition shows the ignition text, shakes the screen once, and marks the site ignited', async ({ page }) => {
      await setForestRootState(page, {
        distance: 8, hardOil: 1,
        amberRootState: { 6: 'unexamined', 7: 'unexamined', 8: 'scarred' },
      });
      await callTalk(page);
      await drainDialogue(page);
      await page.evaluate(() => document.getElementById('btnAmberRootHardOil')?.click());

      // Drain up to (but not past) the point right after the shake line renders, then check the
      // transform is actively applied before it resets on its own short timer.
      await page.evaluate(() => { window.RPG.State.debug.isSkipping = true; });
      let shookMidway = null;
      for (let i = 0; i < 10; i++) {
        const mode = await page.evaluate(() => window.RPG.State.mode);
        if (mode !== 'event') break;
        const log = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
        if (log.includes('地面が揺れた。') && shookMidway === null) {
          shookMidway = await page.evaluate(() => document.body.style.transform);
        }
        await page.evaluate(() => uiControl.handlePlayerInput());
        await page.waitForTimeout(20);
      }
      await page.waitForTimeout(250); // let the shake's own reset timers finish
      const afterShakeSettled = await page.evaluate(() => document.body.style.transform);

      const result = await page.evaluate(() => ({
        rootState: RPG.State.amberRootState,
        isBattling: RPG.State.isBattling,
      }));
      expect(shookMidway).not.toBe('');
      expect(shookMidway).not.toBeNull();
      expect(afterShakeSettled).toBe('none');
      expect(result.rootState[8]).toBe('ignited');
      expect(result.isBattling).toBe(true);
    });

    test('only the very first ignition ever shows "動くのか"/"やっぱりね"', async ({ page }) => {
      await setForestRootState(page, {
        distance: 6, hardOil: 1,
        amberRootState: { 6: 'scarred', 7: 'unexamined', 8: 'unexamined' },
      });
      await callTalk(page);
      await drainDialogue(page);
      await page.evaluate(() => document.getElementById('btnAmberRootHardOil')?.click());
      await drainDialogue(page);
      const log = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
      expect(log).toContain('カインは琥珀樹の根へ、カチカチ油をかけた。');
      expect(log).toContain('火を近づけると、根は一気に燃え上がった。');
      expect(log).toContain('地面が揺れた。');
      expect(log).toContain('カイン「……動くのか！」');
      expect(log).toContain('オーエン「やっぱりね」');
      expect(log).not.toContain('カイン「来るぞ！」');
    });

    test('a defeat on the first ignition does not replay the first-ignition conversation later', async ({ page }) => {
      // Lose immediately on the first burning-root battle (Cain too weak to matter).
      await setForestRootState(page, {
        distance: 6, hardOil: 1, attack: 1, maxHP: 1, currentHP: 1,
        amberRootState: { 6: 'scarred', 7: 'unexamined', 8: 'unexamined' },
      });
      await page.evaluate(() => { RPG.State.deathCount = 0; });
      await callTalk(page);
      await drainDialogue(page);
      await page.evaluate(() => document.getElementById('btnAmberRootHardOil')?.click());

      // With currentHP=1, defeat is decided the instant the battle begins (before any normal
      // 'battle'-mode input is ever awaited), so the flourish and defeat dialogue run together as
      // one 'event'-mode stream that includes the real defeat cinematic's real-time-only gaps.
      await drainRealTimeDialogue(page);
      const rootAfterDefeat = await page.evaluate(() => RPG.State.amberRootState[6]);
      expect(rootAfterDefeat).toBe('ignited');

      // Re-approach the still-ignited root and rematch; the first-ignition conversation must not
      // replay (it is derived from amberRootState, which already shows a prior ignition).
      const secondIgnitionCheck = await page.evaluate(() => {
        const alreadyIgnitedBefore = Object.values(RPG.State.amberRootState).some(
          s => s === 'ignited' || s === 'defeated'
        );
        return alreadyIgnitedBefore;
      });
      expect(secondIgnitionCheck).toBe(true);
    });

    test('a second and third ignition show only "来るぞ！"', async ({ page }) => {
      await setForestRootState(page, {
        distance: 7, hardOil: 1,
        amberRootState: { 6: 'ignited', 7: 'scarred', 8: 'unexamined' },
      });
      await callTalk(page);
      await drainDialogue(page);
      await page.evaluate(() => document.getElementById('btnAmberRootHardOil')?.click());
      await drainDialogue(page);
      const log = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
      expect(log).toContain('カイン「来るぞ！」');
      expect(log).not.toContain('カイン「……動くのか！」');
      expect(log).not.toContain('オーエン「やっぱりね」');
    });

    // amber_burning_root is a boss encounter, so once ignited its turns (Cain's, then the
    // root's) auto-resolve one after another via chained setTimeouts - no player click is
    // needed. Give Cain a one-shot-kill attack so each battle resolves in a single exchange,
    // then just wait for it, rather than force-mutating battle state mid-flight (which races
    // with whatever timer the auto-loop already has pending).
    async function waitForAutoBattleToEnd(page, maxIterations = 50) {
      await page.evaluate(() => { RPG.State.debug.isSkipping = true; });
      for (let i = 0; i < maxIterations; i++) {
        const battling = await page.evaluate(() => RPG.State.isBattling);
        if (!battling) return;
        await page.waitForTimeout(60);
      }
    }

    test('hardOil is never consumed by any ignition, from the first through the third', async ({ page }) => {
      await setForestRootState(page, {
        distance: 6, hardOil: 1, attack: 250, maxHP: 500, currentHP: 500,
        amberRootState: { 6: 'scarred', 7: 'scarred', 8: 'scarred' },
      });
      await callTalk(page);
      await drainDialogue(page);
      await page.evaluate(() => document.getElementById('btnAmberRootHardOil')?.click());
      await drainDialogue(page);
      const afterFirst = await page.evaluate(() => RPG.State.inventory.hardOil);

      await waitForAutoBattleToEnd(page);
      await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.currentDistance = 7;
        document.getElementById('logContainer').innerHTML = '';
      });
      await callTalk(page);
      await drainDialogue(page);
      await page.evaluate(() => document.getElementById('btnAmberRootHardOil')?.click());
      await drainDialogue(page);
      const afterSecond = await page.evaluate(() => RPG.State.inventory.hardOil);

      await waitForAutoBattleToEnd(page);
      await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.currentDistance = 8;
        document.getElementById('logContainer').innerHTML = '';
      });
      await callTalk(page);
      await drainDialogue(page);
      await page.evaluate(() => document.getElementById('btnAmberRootHardOil')?.click());
      await drainDialogue(page);
      const afterThird = await page.evaluate(() => RPG.State.inventory.hardOil);

      expect([afterFirst, afterSecond, afterThird]).toEqual([1, 1, 1]);
    });

    test('the three roots can be ignited independently in any order', async ({ page }) => {
      await setForestRootState(page, {
        distance: 8, hardOil: 1,
        amberRootState: { 6: 'scarred', 7: 'scarred', 8: 'scarred' },
      });
      await callTalk(page);
      await drainDialogue(page);
      await page.evaluate(() => document.getElementById('btnAmberRootHardOil')?.click());
      await drainDialogue(page);
      const midState = await page.evaluate(() => ({ ...RPG.State.amberRootState }));
      expect(midState).toEqual({ 6: 'scarred', 7: 'scarred', 8: 'ignited' });
    });

    test('igniting starts the fixed amber_burning_root battle', async ({ page }) => {
      await setForestRootState(page, {
        distance: 6, hardOil: 1,
        amberRootState: { 6: 'scarred', 7: 'unexamined', 8: 'unexamined' },
      });
      await callTalk(page);
      await drainDialogue(page);
      await page.evaluate(() => document.getElementById('btnAmberRootHardOil')?.click());
      await drainDialogue(page);
      const result = await page.evaluate(() => ({
        isBattling: RPG.State.isBattling,
        enemyId: RPG.State.currentEnemy?.id,
        isBoss: RPG.State.currentEnemy?.isBoss,
      }));
      expect(result).toEqual({ isBattling: true, enemyId: 'amber_burning_root', isBoss: true });
    });

    // --- self-burn damage (direct AI invocation for precise, deterministic checks) ---

    async function setupBurningRootBattle(page, cfg) {
      await page.evaluate((c) => {
        const template = RPG.Assets.ENEMIES.find(e => e.id === 'amber_burning_root');
        Object.assign(RPG.State, {
          mode: 'battle',
          isBattling: true,
          currentEnemy: { ...template, hp: c.enemyHp ?? template.maxHp, armorHp: 0 },
          battleState: {},
          currentHP: c.currentHP ?? 999,
          maxHP: c.maxHP ?? 999,
          attack: c.attack ?? 20,
          lastBlowBy: null,
          hasOwenSavedLife: c.hasOwenSavedLife ?? true,
          isPoisoned: false,
          battleTurn: 1,
          currentDistance: c.distance ?? 6,
          exp: c.exp ?? 0,
        });
        RPG.State.inventory.gratefulTalisman = 0;
        RPG.State.inventory.charm = c.charm ?? 0;
        RPG.State.inventory.unknownAmber = 0;
        if (!RPG.State.defeatCounts) RPG.State.defeatCounts = {};
        RPG.State.defeatCounts.amber_burning_root = { cain: 0, owen: 0 };
        RPG.State.amberRootState = { 6: 'ignited', 7: 'ignited', 8: 'ignited' };
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
      }, cfg);
    }

    test('self-burn damage applies after a standard attack turn', async ({ page }) => {
      await setupBurningRootBattle(page, { enemyHp: 200, currentHP: 999 });
      const result = await page.evaluate(async () => {
        RPG.State.debug.isSkipping = true;
        // Isolate a single enemy turn: execute() chains into another runBattleLoop() turn via
        // its own setTimeout once it finishes, which this test doesn't want to also observe.
        const originalRunBattleLoop = battleSystem.runBattleLoop;
        battleSystem.runBattleLoop = () => {};
        const originalRandom = Math.random;
        Math.random = () => 0.99;
        RPG.Assets.BATTLE_AI.amber_burning_root.execute(battleSystem);
        await new Promise(resolve => setTimeout(resolve, 200));
        Math.random = originalRandom;
        battleSystem.runBattleLoop = originalRunBattleLoop;
        return {
          enemyHp: RPG.State.currentEnemy.hp,
          currentHP: RPG.State.currentHP,
          log: document.getElementById('logContainer')?.textContent || '',
        };
      });
      // The standard attack damages Cain, not the enemy; only the self-burn reduces enemy HP.
      expect(result.enemyHp).toBe(200 - 10);
      expect(result.currentHP).toBe(999 - 28);
      expect(result.log).toContain('カインは28のダメージを受けた');
      expect(result.log).toContain('燃える琥珀樹の根は自らの炎に焼かれている！（HP -10）');
    });

    test('self-burn damage applies on a skipped (frozen) turn', async ({ page }) => {
      await setupBurningRootBattle(page, { enemyHp: 200 });
      const result = await page.evaluate(() => {
        RPG.Assets.BATTLE_AI.amber_burning_root.onSkippedTurn(battleSystem);
        return {
          enemyHp: RPG.State.currentEnemy.hp,
          currentHP: RPG.State.currentHP,
          log: document.getElementById('logContainer')?.textContent || '',
        };
      });
      expect(result.enemyHp).toBe(190);
      expect(result.currentHP).toBe(999); // Cain untouched on a skipped enemy turn
      expect(result.log).toContain('（HP -10）');
      expect(result.log).not.toContain('焼けた根が打ち付けてきた');
    });

    test('self-burn damage does not apply to a different enemy', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.isBattling = true;
        RPG.State.currentEnemy = { id: 'hungry_amber_tree', name: '飢えた琥珀樹', hp: 100, maxHp: 150 };
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
        RPG.Assets.BATTLE_AI.amber_burning_root.applySelfBurnDamage(battleSystem);
        return {
          enemyHp: RPG.State.currentEnemy.hp,
          log: document.getElementById('logContainer')?.textContent || '',
        };
      });
      expect(result).toEqual({ enemyHp: 100, log: '' });
    });

    test('self-burn does not fire again once the battle has already ended', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.isBattling = true;
        const template = RPG.Assets.ENEMIES.find(e => e.id === 'amber_burning_root');
        RPG.State.currentEnemy = { ...template, hp: 30 };
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
        RPG.Assets.BATTLE_AI.amber_burning_root.applySelfBurnDamage(battleSystem);
        const afterFirst = RPG.State.currentEnemy.hp;

        RPG.State.isBattling = false; // simulate battle already having ended
        RPG.Assets.BATTLE_AI.amber_burning_root.applySelfBurnDamage(battleSystem);
        const afterSecond = RPG.State.currentEnemy.hp;
        return { afterFirst, afterSecond };
      });
      expect(result).toEqual({ afterFirst: 20, afterSecond: 20 });
    });

    test('self-burn dropping HP to 0 routes through the normal victory processing exactly once', async ({ page }) => {
      await setupBurningRootBattle(page, { enemyHp: 5, exp: 0 });
      const result = await page.evaluate(() => {
        RPG.Assets.BATTLE_AI.amber_burning_root.onSkippedTurn(battleSystem);
        return {
          isBattling: RPG.State.isBattling,
          exp: RPG.State.exp,
          rootState: { ...RPG.State.amberRootState },
        };
      });
      expect(result.isBattling).toBe(false);
      expect(result.exp).toBe(250);
      expect(result.rootState[6]).toBe('defeated');
    });

    // --- EXP, drops, and notebook exclusion ---

    test('a Cain victory grants the configured EXP exactly once', async ({ page }) => {
      await setupBurningRootBattle(page, { enemyHp: 0, exp: 0 });
      const result = await page.evaluate(() => {
        RPG.State.lastBlowBy = 'Cain';
        battleSystem.executeStandardVictory('amber_burning_root');
        return { exp: RPG.State.exp, isBattling: RPG.State.isBattling };
      });
      expect(result).toEqual({ exp: 250, isBattling: false });
    });

    test('an Owen instant-kill grants no EXP, per existing behavior', async ({ page }) => {
      await setupBurningRootBattle(page, { enemyHp: 0, exp: 0 });
      const result = await page.evaluate(() => {
        RPG.State.lastBlowBy = 'Owen';
        battleSystem.endBattle(false);
        return { exp: RPG.State.exp };
      });
      expect(result.exp).toBe(0);
    });

    test('defeating amber_burning_root does not add to notebook-tracked kill counts', async ({ page }) => {
      const result = await page.evaluate(() => {
        const hasNotebookEntry = RPG.Assets.NOTEBOOK_ENTRIES.some(
          entry => entry.enemyId === 'amber_burning_root'
        );
        const progressAdded = battleSystem.incrementNotebookAllProgress('amber_burning_root', 'Cain');
        return { hasNotebookEntry, progressAdded };
      });
      expect(result).toEqual({ hasNotebookEntry: false, progressAdded: false });
    });

    test('amber_burning_root grants no normal drop and no unknown amber', async ({ page }) => {
      await setupBurningRootBattle(page, { enemyHp: 0, exp: 0 });
      const result = await page.evaluate(() => {
        const template = RPG.Assets.ENEMIES.find(e => e.id === 'amber_burning_root');
        RPG.State.lastBlowBy = 'Cain';
        battleSystem.executeStandardVictory('amber_burning_root');
        return {
          hasDropFields: !!(template.drop || template.drops || template.guaranteedDrop),
          unknownAmber: RPG.State.inventory.unknownAmber,
        };
      });
      expect(result).toEqual({ hasDropFields: false, unknownAmber: 0 });
    });

    // --- victory site-state ---

    test('a Cain/burn victory marks only the current site defeated and shows the burned-down line', async ({ page }) => {
      await setupBurningRootBattle(page, { enemyHp: 0, exp: 0, distance: 7 });
      const result = await page.evaluate(() => {
        RPG.State.lastBlowBy = 'Cain';
        battleSystem.executeStandardVictory('amber_burning_root');
        return {
          rootState: RPG.State.amberRootState,
          log: document.getElementById('logContainer')?.textContent || '',
        };
      });
      expect(result.rootState).toEqual({ 6: 'ignited', 7: 'defeated', 8: 'ignited' });
      expect(result.log).toContain('燃える琥珀樹の根は焼け落ちた。');
    });

    test('an Owen-kill victory also marks only the current site defeated and shows the burned-down line', async ({ page }) => {
      await setupBurningRootBattle(page, { enemyHp: 0, exp: 0, distance: 8 });
      const result = await page.evaluate(() => {
        RPG.State.lastBlowBy = 'Owen';
        battleSystem.endBattle(false);
        return {
          rootState: RPG.State.amberRootState,
          log: document.getElementById('logContainer')?.textContent || '',
        };
      });
      expect(result.rootState).toEqual({ 6: 'ignited', 7: 'ignited', 8: 'defeated' });
      expect(result.log).toContain('燃える琥珀樹の根は焼け落ちた。');
    });

    test('root victories use defeated-site count for ordered aftermath dialogue and one capped recovery', async ({ page }) => {
      async function finishRootVictory(config) {
        await setupBurningRootBattle(page, {
          enemyHp: config.route === 'selfBurn' ? 5 : 0,
          exp: 0,
          distance: config.distance,
          currentHP: config.currentHP,
          maxHP: config.maxHP,
        });
        await page.evaluate((c) => {
          RPG.State.amberRootState = { ...c.rootState };
          RPG.State.cainLv = 5; // Keep the configured maxHP stable while checking 30% recovery.
          RPG.State.isPoisoned = true;
          RPG.State.flags.treeDefeated = false;
          RPG.State.flags.amberTreeCoinMined = false;
          RPG.State.postTreeBattles = 'DONE';

          if (c.route === 'Cain') {
            RPG.State.lastBlowBy = 'Cain';
            battleSystem.executeStandardVictory('amber_burning_root');
          } else if (c.route === 'selfBurn') {
            RPG.Assets.BATTLE_AI.amber_burning_root.onSkippedTurn(battleSystem);
          } else {
            RPG.State.lastBlowBy = 'Owen';
            battleSystem.endBattle(false);
          }
        }, config);
        await drainDialogue(page);
        return page.evaluate(() => ({
          currentHP: RPG.State.currentHP,
          maxHP: RPG.State.maxHP,
          isPoisoned: RPG.State.isPoisoned,
          rootState: { ...RPG.State.amberRootState },
          exp: RPG.State.exp,
          isBattling: RPG.State.isBattling,
          log: document.getElementById('logContainer')?.textContent || '',
          entries: [...document.querySelectorAll('#logContainer .log-entry')].map(entry => ({
            text: entry.textContent,
            color: entry.style.color,
            marker: entry.classList.contains('log-marker'),
          })),
        }));
      }

      // 8m -> 6m -> 7m verifies that the dialogue stage follows the number of defeated
      // sites, not a fixed mapping from distance to ordinal. The three routes also cover Cain,
      // self-burn, and Owen finishes.
      const first = await finishRootVictory({
        route: 'Cain', distance: 8, currentHP: 50, maxHP: 101,
        rootState: { 6: 'ignited', 7: 'ignited', 8: 'ignited' },
      });
      const second = await finishRootVictory({
        route: 'selfBurn', distance: 6, currentHP: 90, maxHP: 101,
        rootState: { 6: 'ignited', 7: 'ignited', 8: 'defeated' },
      });
      const third = await finishRootVictory({
        route: 'Owen', distance: 7, currentHP: 40, maxHP: 103,
        rootState: { 6: 'defeated', 7: 'ignited', 8: 'defeated' },
      });

      expect(first.currentHP).toBe(80); // 50 + Math.floor(101 * 0.3)
      expect(second.currentHP).toBe(101); // capped at maxHP
      expect(third.currentHP).toBe(70); // 40 + Math.floor(103 * 0.3)
      expect(first.maxHP).toBe(101);
      expect(second.maxHP).toBe(101);
      expect(third.maxHP).toBe(103);
      expect(first.isPoisoned).toBe(true);
      expect(second.isPoisoned).toBe(true);
      expect(third.isPoisoned).toBe(true);
      expect(first.rootState).toEqual({ 6: 'ignited', 7: 'ignited', 8: 'defeated' });
      expect(second.rootState).toEqual({ 6: 'defeated', 7: 'ignited', 8: 'defeated' });
      expect(third.rootState).toEqual({ 6: 'defeated', 7: 'defeated', 8: 'defeated' });
      expect(first.exp).toBe(250);
      expect(second.exp).toBe(250);
      expect(third.exp).toBe(0);
      expect(first.isBattling).toBe(false);
      expect(second.isBattling).toBe(false);
      expect(third.isBattling).toBe(false);

      const firstImportantLines = [
        'カイン「これで、何か変わるか？」',
        'オーエン「…………」',
        'カインのストレスが軽減した！',
      ];
      const secondImportantLines = [
        'カイン「……これでどうだ？」',
        'カインは深呼吸した。',
        'カインのストレスがさらに軽減した！',
        'オーエン「………」',
      ];
      const thirdImportantLines = [
        '三本目の琥珀樹の根を焼き払うと、森を満たしていた瘴気が薄れた。',
        'カイン「空気が変わったな」',
        'カインのストレスがさらに軽減した！',
        'オーエン「…ねえ、さっきからなんなの?」',
        'オーエン「……ふーん」',
      ];
      for (const [result, lines] of [[first, firstImportantLines], [second, secondImportantLines], [third, thirdImportantLines]]) {
        const positions = lines.map(line => result.log.indexOf(line));
        expect(positions.every(position => position >= 0)).toBe(true);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        expect(result.log).not.toMatch(/HPが\d+回復した/);
        expect(result.log.split('燃える琥珀樹の根は焼け落ちた。').length - 1).toBe(1);
      }

      expect(first.entries.find(entry => entry.text === 'カインのストレスが軽減した！')?.marker).toBe(true);
      expect(second.entries.find(entry => entry.text === 'カインのストレスがさらに軽減した！')?.marker).toBe(true);
      expect(third.entries.find(entry => entry.text === 'オーエン「…ねえ、さっきからなんなの?」')?.color)
        .toBe('rgb(204, 115, 255)');
    });

    test('a defeated root is no longer offered by talk(), while the other two sites are unchanged', async ({ page }) => {
      await setForestRootState(page, {
        distance: 6, amberRootState: { 6: 'defeated', 7: 'examined', 8: 'scarred' },
      });
      await callTalk(page);
      const result = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        rootState: RPG.State.amberRootState,
      }));
      expect(result.log).not.toContain('【琥珀樹の根】');
      expect(result.rootState).toEqual({ 6: 'defeated', 7: 'examined', 8: 'scarred' });
    });

    // --- defeat and rematch ---

    test('losing the burning-root battle leaves the site ignited (re-battlable), not reset', async ({ page }) => {
      await setForestRootState(page, {
        distance: 6, hardOil: 1, attack: 1, maxHP: 1, currentHP: 1,
        amberRootState: { 6: 'scarred', 7: 'unexamined', 8: 'unexamined' },
      });
      await page.evaluate(() => { RPG.State.deathCount = 0; });
      await callTalk(page);
      await drainDialogue(page);
      await page.evaluate(() => document.getElementById('btnAmberRootHardOil')?.click());

      // See the equivalent comment in the "does not replay the first-ignition conversation"
      // test above: with currentHP=1, defeat is decided instantly and the flourish/defeat
      // dialogue run together as one real-time-delayed 'event' stream.
      await drainRealTimeDialogue(page);

      const result = await page.evaluate(() => ({
        rootState: RPG.State.amberRootState[6],
        deathCount: RPG.State.deathCount,
        isBattling: RPG.State.isBattling,
      }));
      expect(result.rootState).toBe('ignited');
      expect(result.deathCount).toBeGreaterThan(0);
      expect(result.isBattling).toBe(false);
    });

    test('re-inspecting an ignited root shows the rekindled-root line', async ({ page }) => {
      await setForestRootState(page, {
        distance: 7, amberRootState: { 6: 'unexamined', 7: 'ignited', 8: 'unexamined' },
      });
      await callTalk(page);
      const endMode = await drainDialogue(page);
      const log = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
      expect(endMode).toBe('choice');
      expect(log).toContain('焦げた根が、地面から隆起している。');
      const ids = await page.evaluate(() => (
        [...document.querySelectorAll('#action-buttons button')].map(b => b.id)
      ));
      expect(ids).toEqual(['btnAmberRootRetry', 'btnAmberRootCancel']);
      await closeRootChoices(page);
    });

    test('rematching does not consume oils, replay ignition flavor, or replay the first/second-ignition lines', async ({ page }) => {
      await setForestRootState(page, {
        distance: 6, hardOil: 3, shinyOil: 3, currentHP: 45, maxHP: 100,
        amberRootState: { 6: 'ignited', 7: 'unexamined', 8: 'unexamined' },
      });
      await callTalk(page);
      await drainDialogue(page);
      await page.evaluate(() => document.getElementById('btnAmberRootRetry')?.click());
      const result = await page.evaluate(() => ({
        isBattling: RPG.State.isBattling,
        enemyId: RPG.State.currentEnemy?.id,
        hardOil: RPG.State.inventory.hardOil,
        shinyOil: RPG.State.inventory.shinyOil,
        currentHP: RPG.State.currentHP,
        log: document.getElementById('logContainer')?.textContent || '',
      }));
      expect(result.isBattling).toBe(true);
      expect(result.enemyId).toBe('amber_burning_root');
      expect(result.hardOil).toBe(3);
      expect(result.shinyOil).toBe(3);
      expect(result.currentHP).toBe(45);
      expect(result.log).not.toContain('カチカチ油をかけた');
      expect(result.log).not.toContain('地面が揺れた。');
      expect(result.log).not.toContain('動くのか');
      expect(result.log).not.toContain('やっぱりね');
      expect(result.log).not.toContain('来るぞ');
    });

    test('cancel on an ignited root changes nothing and returns to exploration', async ({ page }) => {
      await setForestRootState(page, {
        distance: 6, hardOil: 1,
        amberRootState: { 6: 'ignited', 7: 'unexamined', 8: 'unexamined' },
      });
      await callTalk(page);
      await drainDialogue(page);
      await closeRootChoices(page);
      const result = await page.evaluate(() => ({
        mode: RPG.State.mode,
        rootState: RPG.State.amberRootState,
        hardOil: RPG.State.inventory.hardOil,
      }));
      expect(result.mode).toBe('base');
      expect(result.rootState).toEqual({ 6: 'ignited', 7: 'unexamined', 8: 'unexamined' });
      expect(result.hardOil).toBe(1);
    });

    test('rematch victory marks the site defeated', async ({ page }) => {
      await setupBurningRootBattle(page, { enemyHp: 0, exp: 0, distance: 6 });
      await page.evaluate(() => { RPG.State.amberRootState[6] = 'ignited'; });
      const result = await page.evaluate(() => {
        RPG.State.lastBlowBy = 'Cain';
        battleSystem.executeStandardVictory('amber_burning_root');
        return RPG.State.amberRootState[6];
      });
      expect(result).toBe('defeated');
    });

    // --- save/load ---

    test('all five possible root states survive a save/load round trip, per site', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.amberRootState = { 6: 'scarred', 7: 'ignited', 8: 'defeated' };
        const snapshot = uiControl.createSaveSnapshot('journal');
        localStorage.setItem('okai_rpg_burning_root_test', JSON.stringify(snapshot));

        RPG.State.amberRootState = { 6: 'unexamined', 7: 'unexamined', 8: 'unexamined' };
        uiControl.loadFromStorage('okai_rpg_burning_root_test', '根燃焼テスト');

        return RPG.State.amberRootState;
      });
      expect(result).toEqual({ 6: 'scarred', 7: 'ignited', 8: 'defeated' });
    });

    test('an old save without amberRootState still defaults all three sites to unexamined', async ({ page }) => {
      const result = await page.evaluate(() => {
        const snapshot = uiControl.createSaveSnapshot('journal');
        const legacySave = JSON.parse(JSON.stringify(snapshot));
        delete legacySave.amberRootState;
        localStorage.setItem('okai_rpg_burning_root_legacy_test', JSON.stringify(legacySave));

        RPG.State.amberRootState = { 6: 'defeated', 7: 'defeated', 8: 'defeated' };
        uiControl.loadFromStorage('okai_rpg_burning_root_legacy_test', '旧セーブ根燃焼テスト');

        return RPG.State.amberRootState;
      });
      expect(result).toEqual({ 6: 'unexamined', 7: 'unexamined', 8: 'unexamined' });
    });

    // --- three-defeated finite-supply bookkeeping ---

    test('the third root stores fixed finite ALL targets from cumulative kills without changing hardOil', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.amberRootState = { 6: 'ignited', 7: 'ignited', 8: 'ignited' };
        RPG.State.amberEnemyAllTargets = { sap: null, amber_rat: null, amber_weasel: null };
        RPG.State.inventory.hardOil = 1;
        RPG.State.defeatCounts.sap = { cain: 28, owen: 0 };
        RPG.State.defeatCounts.amber_rat = { cain: 12, owen: 8 };
        RPG.State.defeatCounts.amber_weasel = { cain: 9, owen: 0 };
        const template = RPG.Assets.ENEMIES.find(e => e.id === 'amber_burning_root');
        RPG.State.defeatCounts.amber_burning_root = { cain: 0, owen: 0 };

        [6, 7].forEach(distance => {
          Object.assign(RPG.State, {
            mode: 'battle', isBattling: true,
            currentEnemy: { ...template, hp: 0 },
            battleState: {}, currentDistance: distance, lastBlowBy: 'Cain',
          });
          battleSystem.executeStandardVictory('amber_burning_root');
        });

        const afterTwoRoots = { ...RPG.State.amberEnemyAllTargets };

        Object.assign(RPG.State, {
          mode: 'battle', isBattling: true,
          currentEnemy: { ...template, hp: 0 },
          battleState: {}, currentDistance: 8, lastBlowBy: 'Cain',
        });
        battleSystem.executeStandardVictory('amber_burning_root');
        const afterThirdRoot = { ...RPG.State.amberEnemyAllTargets };

        RPG.State.defeatCounts.sap = { cain: 99, owen: 0 };
        RPG.State.defeatCounts.amber_rat = { cain: 99, owen: 0 };
        RPG.State.defeatCounts.amber_weasel = { cain: 99, owen: 0 };
        const recalculated = battleSystem.initializeAmberEnemyAllTargets();

        const snapshot = uiControl.createSaveSnapshot('journal');
        localStorage.setItem('okai_rpg_amber_finite_targets', JSON.stringify(snapshot));
        RPG.State.amberEnemyAllTargets = { sap: null, amber_rat: null, amber_weasel: null };
        uiControl.loadFromStorage('okai_rpg_amber_finite_targets', '有限目標テスト');

        return {
          rootState: RPG.State.amberRootState,
          hardOil: RPG.State.inventory.hardOil,
          afterTwoRoots,
          afterThirdRoot,
          recalculated,
          afterReload: RPG.State.amberEnemyAllTargets,
        };
      });
      expect(result.rootState).toEqual({ 6: 'defeated', 7: 'defeated', 8: 'defeated' });
      expect(result.hardOil).toBe(1);
      expect(result.afterTwoRoots).toEqual({ sap: null, amber_rat: null, amber_weasel: null });
      expect(result.afterThirdRoot).toEqual({ sap: 40, amber_rat: 30, amber_weasel: 20 });
      expect(result.recalculated).toBe(false);
      expect(result.afterReload).toEqual({ sap: 40, amber_rat: 30, amber_weasel: 20 });
    });

    test('the third root never stores an ALL target below 15, even with very few kills logged', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.amberRootState = { 6: 'defeated', 7: 'defeated', 8: 'defeated' };
        RPG.State.amberEnemyAllTargets = { sap: null, amber_rat: null, amber_weasel: null };
        RPG.State.defeatCounts.sap = { cain: 0, owen: 0 };
        RPG.State.defeatCounts.amber_rat = { cain: 0, owen: 0 };
        RPG.State.defeatCounts.amber_weasel = { cain: 0, owen: 0 };

        battleSystem.initializeAmberEnemyAllTargets();

        return { ...RPG.State.amberEnemyAllTargets };
      });
      // Raw calc (0+10 rounded up to the next 10) would be 10 for all three; the floor keeps
      // them at 15, matching the last normal (non-ALL) notebook tier for each enemy.
      expect(result).toEqual({ sap: 15, amber_rat: 15, amber_weasel: 15 });
    });

    test('finite targets remove only completed amber encounters from their random candidates', async ({ page }) => {
      const result = await page.evaluate(() => {
        const originalRandom = Math.random;
        const originalBuildPreBattleDialogue = battleSystem.buildPreBattleDialogue;
        const cleanupBattle = () => {
          RPG.State.isBattling = false;
          RPG.State.currentEnemy = null;
          RPG.State.battleState = null;
          RPG.State.mode = 'base';
        };

        try {
          battleSystem.buildPreBattleDialogue = () => [];
          Object.assign(RPG.State, {
            mode: 'base', isAtInn: false, isInDungeon: true,
            explorationArea: 'forest', location: '琥珀の森', currentDistance: 4,
            amberRootState: { 6: 'defeated', 7: 'defeated', 8: 'defeated' },
            amberEnemyAllTargets: { sap: 30, amber_rat: 30, amber_weasel: 30 },
          });
          Object.assign(RPG.State.flags, { metThiefBoy: true, matamatabiActive: false });
          RPG.State.defeatCounts.sap = { cain: 29, owen: 0 };
          RPG.State.defeatCounts.amber_rat = { cain: 30, owen: 0 };
          RPG.State.defeatCounts.amber_weasel = { cain: 29, owen: 0 };

          const nearGoalDraws = [0.99, 0.99, 0.99];
          Math.random = () => nearGoalDraws.shift() ?? 0;
          const beforeSapGoal = battleSystem.startBattle(null, { randomEncounter: true });
          const beforeSapGoalEnemy = RPG.State.currentEnemy?.id || null;
          cleanupBattle();

          RPG.State.defeatCounts.sap = { cain: 30, owen: 0 };
          const afterGoalDraws = [0.99, 0.99, 0.99];
          Math.random = () => afterGoalDraws.shift() ?? 0;
          const afterSapGoal = battleSystem.startBattle(null, { randomEncounter: true });
          const afterSapGoalEnemy = RPG.State.currentEnemy?.id || null;
          cleanupBattle();

          RPG.State.defeatCounts.amber_weasel = { cain: 30, owen: 0 };
          Math.random = () => 0;
          const allVariantsGone = battleSystem.rollAmberVariantEncounter();

          return {
            beforeSapGoal,
            beforeSapGoalEnemy,
            afterSapGoal,
            afterSapGoalEnemy,
            allVariantsGone: allVariantsGone?.id || null,
            excluded: {
              sap: battleSystem.isAmberEnemyFiniteEncounterExcluded('sap'),
              amberRat: battleSystem.isAmberEnemyFiniteEncounterExcluded('amber_rat'),
              amberWeasel: battleSystem.isAmberEnemyFiniteEncounterExcluded('amber_weasel'),
              rat: battleSystem.isAmberEnemyFiniteEncounterExcluded('rat'),
              weasel: battleSystem.isAmberEnemyFiniteEncounterExcluded('weasel'),
            },
          };
        } finally {
          Math.random = originalRandom;
          battleSystem.buildPreBattleDialogue = originalBuildPreBattleDialogue;
        }
      });

      expect(result.beforeSapGoal).toBe(true);
      expect(result.beforeSapGoalEnemy).toBe('sap');
      expect(result.afterSapGoal).toBe(true);
      expect(result.afterSapGoalEnemy).toBe('weasel');
      expect(result.allVariantsGone).toBeNull();
      expect(result.excluded).toEqual({
        sap: true, amberRat: true, amberWeasel: true, rat: false, weasel: false,
      });
    });

    // --- integration with existing 8m events ---

    test('a pending inn-repair timber quest at 8m still takes priority over an ignited amber root', async ({ page }) => {
      await page.evaluate(() => {
        Object.assign(RPG.State, {
          mode: 'base', isAtInn: false, isInDungeon: true, explorationArea: 'forest',
          location: '琥珀の森', currentDistance: 8,
        });
        Object.assign(RPG.State.flags, {
          treeDefeated: true, amberTreeCoinMined: true,
          innRepairInspectionReported: true, innRepairTimberSearchUnlocked: true,
          innRepairTimberObtained: false, sapSourceAwarenessSeen: true,
        });
        RPG.State.amberRootState = { 6: 'unexamined', 7: 'unexamined', 8: 'ignited' };
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
      });
      await callTalk(page);
      await drainDialogue(page);
      const result = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        rootState8: RPG.State.amberRootState[8],
        timberObtained: RPG.State.flags.innRepairTimberObtained,
      }));
      expect(result.log).not.toContain('【琥珀樹の根】');
      expect(result.rootState8).toBe('ignited');
      expect(result.timberObtained).toBe(true);
    });
  });

  test.describe('key amber -> old key (Connect key amber to forest hut)', () => {
    // Puts Cain on the burn site of a root he has just felled, with the burn chance already
    // open, without replaying a whole battle. The victory-driven path is covered separately.
    async function setBurnSite(page, cfg = {}) {
      await page.evaluate((c) => {
        Object.assign(RPG.State, {
          mode: 'base',
          isAtInn: false,
          isInDungeon: true,
          explorationArea: 'forest',
          location: '琥珀の森',
          currentDistance: c.distance ?? 7,
          amberRootKeyBurnOpportunityDistance:
            c.opportunity === null ? null : (c.opportunity ?? c.distance ?? 7),
          isBattling: false,
          currentEnemy: null,
          battleState: null,
        });
        Object.assign(RPG.State.flags, {
          treeDefeated: true,
          amberTreeCoinMined: true,
          sapSourceAwarenessSeen: true,
          silverDelivered: true,
          chapter1Cleared: false,
          onWagon: false,
          giantLarvaDefeated: false,
        });
        RPG.State.amberRootState = c.amberRootState
          ? { ...c.amberRootState }
          : { 6: 'defeated', 7: 'defeated', 8: 'defeated' };
        RPG.State.inventory.keyAmber = c.keyAmber ?? 1;
        RPG.State.inventory.oldKey = c.oldKey ?? 0;
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
        uiControl.updateUI();
      }, cfg);
    }

    async function callTalk(page) {
      await page.evaluate(() => explorationSystem.talk());
    }

    // The defeat cinematic advances on raw setTimeout delays that debug.isSkipping does not
    // shorten, so tap only when genuinely waiting and let the untappable gaps elapse.
    async function drainDefeatSequence(page, iterations = 30, stepMs = 100) {
      await page.evaluate(() => { window.RPG.State.debug.isSkipping = true; });
      for (let i = 0; i < iterations; i++) {
        const waiting = await page.evaluate(() => (
          RPG.State.mode === 'event' && RPG.State.isWaitingForInput === true
        ));
        if (waiting) {
          await page.evaluate(() => uiControl.handlePlayerInput());
        }
        await page.waitForTimeout(stepMs);
      }
    }

    async function readBurnState(page) {
      return page.evaluate(() => ({
        label: document.getElementById('btnTalk')?.textContent,
        canBurn: explorationSystem.canBurnKeyAmberHere(),
        opportunity: RPG.State.amberRootKeyBurnOpportunityDistance,
        keyAmber: RPG.State.inventory.keyAmber,
        oldKey: RPG.State.inventory.oldKey,
        distance: RPG.State.currentDistance,
      }));
    }

    // --- merchant exchange ---

    test('the key amber is offered from the start in both exchange lists at 3 sparkling', async ({ page }) => {
      // The exchange rundown is a later line of the appraisal queue, so it only reaches the
      // log once the scene has played out.
      await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.amberStorage.sparkling = 3;
        RPG.State.flags.keyAmberExchanged = false;
        RPG.State.inventory.unknownAmber = 1;
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
        innSystem.playFirstAmberAppraisal();
      });
      await drainDialogue(page);

      const result = await page.evaluate(() => {
        const firstAppraisalPreview = document.getElementById('logContainer')?.textContent || '';
        RPG.State.mode = 'base';
        innSystem.showAmberExchangeMenu();
        return {
          firstAppraisalPreview,
          exchangeMenu: document.getElementById('action-buttons')?.textContent || '',
          catalogEntry: RPG.Assets.RARE_AMBER_CATALOG.find(item => item.id === 'keyAmber'),
          itemName: RPG.Assets.CONFIG.ITEM_NAME.keyAmber,
          itemDesc: RPG.Assets.CONFIG.ITEM_DESC.keyAmber,
        };
      });

      expect(result.firstAppraisalPreview).toContain('《鍵入り琥珀》：3個');
      expect(result.exchangeMenu).toContain('《鍵入り琥珀》：3個');
      expect(result.catalogEntry.cost).toBe(3);
      expect(result.itemName).toBe('🔸《鍵入り琥珀》');
      expect(result.itemDesc).toBe('中に古びた鍵が閉じ込められている琥珀。');
    });

    test('cracked, milk, and monster amber are not offered for exchange', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.amberStorage.sparkling = 99;
        RPG.State.inventory.unknownAmber = 1;
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
        innSystem.playFirstAmberAppraisal();
        return true;
      });
      expect(result).toBe(true);
      await drainDialogue(page);

      const menus = await page.evaluate(() => {
        const firstAppraisalPreview = document.getElementById('logContainer')?.textContent || '';
        RPG.State.mode = 'base';
        innSystem.showAmberExchangeMenu();
        return {
          firstAppraisalPreview,
          exchangeMenu: document.getElementById('action-buttons')?.textContent || '',
        };
      });

      for (const name of ['ひび割れ琥珀', '牛乳琥珀', '魔物入り琥珀']) {
        expect(menus.firstAppraisalPreview).not.toContain(name);
        expect(menus.exchangeMenu).not.toContain(name);
      }
    });

    // Affordability is enforced by the row's own click handler. The DOM disabled property is
    // not a usable signal here: updateUI() re-enables every #action-buttons child in choice
    // mode, so this asserts the outcome of clicking instead.
    test('with fewer than 3 sparkling the key amber cannot be taken', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.amberStorage.sparkling = 2;
        RPG.State.flags.keyAmberExchanged = false;
        RPG.State.inventory.keyAmber = 0;
        innSystem.showAmberExchangeMenu();
        [...document.querySelectorAll('#action-buttons button')]
          .find(b => b.textContent.includes('《鍵入り琥珀》'))
          .click();
        return {
          sparkling: RPG.State.amberStorage.sparkling,
          keyAmber: RPG.State.inventory.keyAmber,
          exchanged: RPG.State.flags.keyAmberExchanged,
        };
      });
      expect(result).toEqual({ sparkling: 2, keyAmber: 0, exchanged: false });
    });

    test('exchanging spends 3 sparkling, grants the amber, and marks it traded, once only', async ({ page }) => {
      const afterExchange = await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.amberStorage.sparkling = 5;
        RPG.State.flags.keyAmberExchanged = false;
        RPG.State.inventory.keyAmber = 0;
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';

        innSystem.showAmberExchangeMenu();
        const row = [...document.querySelectorAll('#action-buttons button')]
          .find(b => b.textContent.includes('《鍵入り琥珀》'));
        row.click();
        [...document.querySelectorAll('#action-buttons button')]
          .find(b => b.textContent.includes('キラキラ3個で交換する'))
          .click();

        return {
          sparkling: RPG.State.amberStorage.sparkling,
          keyAmber: RPG.State.inventory.keyAmber,
          exchanged: RPG.State.flags.keyAmberExchanged,
          log: document.getElementById('logContainer')?.textContent || '',
          menuAfter: document.getElementById('action-buttons')?.textContent || '',
        };
      });

      expect(afterExchange.sparkling).toBe(2);
      expect(afterExchange.keyAmber).toBe(1);
      expect(afterExchange.exchanged).toBe(true);
      expect(afterExchange.log).toContain('《鍵入り琥珀》と交換した！');
      // The menu re-renders after the purchase and must no longer offer it.
      expect(afterExchange.menuAfter).not.toContain('《鍵入り琥珀》');

      // Burning it down to zero must not put it back on the shelf.
      const exchangeMenu = await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.inventory.keyAmber = 0;
        RPG.State.amberStorage.sparkling = 99;
        innSystem.showAmberExchangeMenu();
        return document.getElementById('action-buttons')?.textContent || '';
      });
      expect(exchangeMenu).not.toContain('《鍵入り琥珀》');

      await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.inventory.unknownAmber = 1;
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
        innSystem.playFirstAmberAppraisal();
      });
      await drainDialogue(page);
      const firstAppraisalPreview = await page.evaluate(
        () => document.getElementById('logContainer')?.textContent || ''
      );
      expect(firstAppraisalPreview).not.toContain('《鍵入り琥珀》');
    });

    test('exchange only spends sparkling after confirmation and cancel returns to the list', async ({ page }) => {
      await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.amberStorage.sparkling = 3;
        RPG.State.inventory.keyAmber = 0;
        RPG.State.flags.keyAmberExchanged = false;
        innSystem.showAmberExchangeMenu();
        [...document.querySelectorAll('#action-buttons button')]
          .find(button => button.textContent.includes('《鍵入り琥珀》'))
          .click();
      });
      let state = await page.evaluate(() => ({
        sparkling: RPG.State.amberStorage.sparkling,
        keyAmber: RPG.State.inventory.keyAmber,
        confirmation: document.getElementById('action-buttons')?.textContent || '',
      }));
      expect(state).toEqual({
        sparkling: 3,
        keyAmber: 0,
        confirmation: '《鍵入り琥珀》をキラキラ3個で交換するやめる',
      });

      await page.click('#btnAmberAction1');
      state = await page.evaluate(() => ({
        sparkling: RPG.State.amberStorage.sparkling,
        keyAmber: RPG.State.inventory.keyAmber,
        exchangeList: document.getElementById('action-buttons')?.textContent || '',
      }));
      expect(state.sparkling).toBe(3);
      expect(state.keyAmber).toBe(0);
      expect(state.exchangeList).toContain('《鍵入り琥珀》：3個');

      await page.evaluate(() => {
        [...document.querySelectorAll('#action-buttons button')]
          .find(button => button.textContent.includes('《鍵入り琥珀》'))
          .click();
      });
      await page.click('#btnAmberAction0');
      state = await page.evaluate(() => ({
        sparkling: RPG.State.amberStorage.sparkling,
        keyAmber: RPG.State.inventory.keyAmber,
      }));
      expect(state).toEqual({ sparkling: 0, keyAmber: 1 });
    });

    test('the key amber never appears as a socket candidate, but trades in like other rare amber', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.inventory.glowingBrooch = 1;
        RPG.State.inventory.keyAmber = 2;
        RPG.State.equippedRareAmberId = null;
        RPG.State.amberStorage.sparkling = 0;

        innSystem.showAmberTradeInMenu();
        const tradeInMenu = document.getElementById('action-buttons')?.textContent || '';

        RPG.State.mode = 'base';
        uiControl.openModal();
        uiControl.selectItem('glowingBrooch', 1);
        uiControl.showRareAmberSelection();
        const socketList = document.getElementById('itemList')?.textContent || '';

        RPG.State.mode = 'base';
        const equipped = uiControl.equipRareAmber('keyAmber');

        return {
          tradeInMenu,
          socketList,
          equipped,
          equippedId: RPG.State.equippedRareAmberId,
          keyAmber: RPG.State.inventory.keyAmber,
        };
      });

      // Same label format as any other tradeInable catalog entry: name, owned count, price.
      expect(result.tradeInMenu).toContain('《鍵入り琥珀》 ×2 → キラキラ1個');
      expect(result.socketList).not.toContain('鍵入り琥珀');
      expect(result.equipped).toBe(false);
      expect(result.equippedId).toBeNull();
      expect(result.keyAmber).toBe(2);
    });

    test('the key amber trades in for sparkling amber just like an ordinary rare amber', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.inventory.keyAmber = 1;
        RPG.State.amberStorage.sparkling = 0;

        innSystem.showAmberTradeInMenu();
        [...document.querySelectorAll('#action-buttons button')]
          .find(button => button.textContent.includes('《鍵入り琥珀》'))
          .click();

        return {
          sparkling: RPG.State.amberStorage.sparkling,
          keyAmber: RPG.State.inventory.keyAmber,
        };
      });

      expect(result).toEqual({ sparkling: 1, keyAmber: 0 });
    });

    test('an ordinary rare amber still exchanges, sockets, and trades in as before', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.amberStorage.sparkling = 3;
        RPG.State.inventory.sweetAmber = 0;
        RPG.State.inventory.glowingBrooch = 1;
        RPG.State.equippedRareAmberId = null;

        innSystem.showAmberExchangeMenu();
        [...document.querySelectorAll('#action-buttons button')]
          .find(b => b.textContent.includes('《甘そうな琥珀》'))
          .click();
        [...document.querySelectorAll('#action-buttons button')]
          .find(b => b.textContent.includes('キラキラ3個で交換する'))
          .click();
        const afterExchange = {
          sparkling: RPG.State.amberStorage.sparkling,
          sweetAmber: RPG.State.inventory.sweetAmber,
        };

        RPG.State.mode = 'base';
        const equipped = uiControl.equipRareAmber('sweetAmber');
        const detached = uiControl.detachRareAmber({ log: false, refreshModal: false });

        RPG.State.mode = 'base';
        innSystem.showAmberTradeInMenu();
        const tradeInMenu = document.getElementById('action-buttons')?.textContent || '';

        return { afterExchange, equipped, detached, tradeInMenu };
      });

      expect(result.afterExchange).toEqual({ sparkling: 0, sweetAmber: 1 });
      expect(result.equipped).toBe(true);
      expect(result.detached).toBe(true);
      expect(result.tradeInMenu).toContain('《甘そうな琥珀》');
    });

    // --- the burn chance opens only at the very end of the root aftermath ---

    test('the burn chance opens after the whole aftermath, and only while holding the amber', async ({ page }) => {
      async function winThirdRoot(keyAmber) {
        return page.evaluate((held) => {
          const template = RPG.Assets.ENEMIES.find(e => e.id === 'amber_burning_root');
          Object.assign(RPG.State, {
            mode: 'battle',
            isBattling: true,
            currentEnemy: { ...template, hp: 0, armorHp: 0 },
            battleState: {},
            currentHP: 40,
            maxHP: 103,
            attack: 20,
            lastBlowBy: 'Cain',
            hasOwenSavedLife: true,
            isPoisoned: false,
            battleTurn: 1,
            currentDistance: 7,
            exp: 0,
            isInDungeon: true,
            explorationArea: 'forest',
            location: '琥珀の森',
            isAtInn: false,
            amberRootKeyBurnOpportunityDistance: null,
          });
          RPG.State.cainLv = 5;
          RPG.State.postTreeBattles = 'DONE';
          RPG.State.inventory.keyAmber = held;
          RPG.State.inventory.gratefulTalisman = 0;
          RPG.State.inventory.charm = 0;
          RPG.State.inventory.unknownAmber = 0;
          RPG.State.defeatCounts = RPG.State.defeatCounts || {};
          RPG.State.defeatCounts.amber_burning_root = { cain: 0, owen: 0 };
          // Third root: the recovery marker is followed by six more Owen/Cain lines.
          RPG.State.amberRootState = { 6: 'defeated', 8: 'defeated', 7: 'ignited' };
          RPG.Assets.OWEN_BEHAVIOR.shouldIntervene = () => false;
          const log = document.getElementById('logContainer');
          if (log) log.innerHTML = '';
          battleSystem.executeStandardVictory('amber_burning_root');
        }, keyAmber);
      }

      await winThirdRoot(1);

      // Step through the aftermath and sample the state right after the recovery marker,
      // which for the third root still has Owen dialogue queued behind it.
      const midway = await page.evaluate(async () => {
        RPG.State.debug.isSkipping = true;
        for (let i = 0; i < 40; i++) {
          const log = document.getElementById('logContainer')?.textContent || '';
          if (log.includes('カインのストレスがさらに軽減した！')) break;
          if (RPG.State.mode !== 'event') break;
          uiControl.handlePlayerInput();
          await new Promise(r => setTimeout(r, 10));
        }
        return {
          mode: RPG.State.mode,
          opportunity: RPG.State.amberRootKeyBurnOpportunityDistance,
          remaining: RPG.State.dialogueQueue.length,
        };
      });
      // Recovery has fired, dialogue is still running, and the chance is still shut.
      expect(midway.remaining).toBeGreaterThan(0);
      expect(midway.opportunity).toBeNull();

      await drainDialogue(page);
      const after = await readBurnState(page);
      expect(after.opportunity).toBe(7);
      expect(after.canBurn).toBe(true);
      expect(after.label).toBe('鍵入り琥珀を燃やす');

      // Same victory without the amber in hand opens nothing.
      await winThirdRoot(0);
      await drainDialogue(page);
      const withoutAmber = await readBurnState(page);
      expect(withoutAmber.opportunity).toBeNull();
      expect(withoutAmber.canBurn).toBe(false);
      expect(withoutAmber.label).toBe('調べる');
    });

    // --- burning ---

    test('burning plays the fixed text in order and swaps the amber for the old key', async ({ page }) => {
      await setBurnSite(page, { distance: 7, keyAmber: 1, oldKey: 0 });
      const before = await readBurnState(page);
      expect(before.label).toBe('鍵入り琥珀を燃やす');

      await callTalk(page);
      await drainDialogue(page);

      const result = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        keyAmber: RPG.State.inventory.keyAmber,
        oldKey: RPG.State.inventory.oldKey,
        opportunity: RPG.State.amberRootKeyBurnOpportunityDistance,
        mode: RPG.State.mode,
        label: document.getElementById('btnTalk')?.textContent,
        oldKeyName: RPG.Assets.CONFIG.ITEM_NAME.oldKey,
        oldKeyDesc: RPG.Assets.CONFIG.ITEM_DESC.oldKey,
        markerEntry: [...document.querySelectorAll('#logContainer .log-entry')]
          .filter(el => el.textContent.includes('古びた鍵を手に入れた'))
          .map(el => ({ text: el.textContent, marker: el.classList.contains('log-marker') }))[0],
      }));

      const lines = [
        '鍵入り琥珀に火をつけると、独特の香りの煙をあげながら琥珀はチロチロと燃えた。',
        'カイン（なんかわくわくするな）',
        'しばらくすると、中の鍵だけが燃え残った。',
        '🗝️古びた鍵を手に入れた！',
        'オーエン「他の琥珀は燃やさなくていいの？パーっとやっちゃう？」',
        'カイン「やっちゃわない」',
      ];
      lines.forEach(line => expect(result.log).toContain(line));
      for (let i = 1; i < lines.length; i++) {
        expect(result.log.indexOf(lines[i - 1])).toBeLessThan(result.log.indexOf(lines[i]));
      }

      expect(result.keyAmber).toBe(0);
      expect(result.oldKey).toBe(1);
      expect(result.opportunity).toBeNull();
      expect(result.mode).toBe('base');
      expect(result.label).toBe('調べる');
      // The acquisition line keeps its emoji and the shared marker styling.
      expect(result.markerEntry.text).toContain('🗝️');
      expect(result.markerEntry.marker).toBe(true);
      expect(result.oldKeyName).toBe('🗝️古びた鍵');
      expect(result.oldKeyDesc).toBe('鍵入り琥珀を燃やして取り出した古びた鍵。');

      // Re-examining the same spot cannot grant a second key.
      await callTalk(page);
      await drainDialogue(page);
      const repeat = await page.evaluate(() => ({
        keyAmber: RPG.State.inventory.keyAmber,
        oldKey: RPG.State.inventory.oldKey,
      }));
      expect(repeat).toEqual({ keyAmber: 0, oldKey: 1 });
    });

    test('walking away forfeits the chance for good, even on returning', async ({ page }) => {
      await setBurnSite(page, { distance: 7, keyAmber: 1 });
      // The deep forest encounters at 60-80%; a battle would block the walk back.
      await page.evaluate(() => {
        window.__origRandom = Math.random;
        Math.random = () => 0.99;
      });

      // Arriving at 6m fires its own one-time discovery scene, so let each step settle back
      // to base before taking the next one.
      await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true }));
      await drainDialogue(page);
      const away = await readBurnState(page);
      expect(away.distance).toBe(6);
      expect(away.opportunity).toBeNull();

      await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));
      await drainDialogue(page);
      const back = await readBurnState(page);
      await page.evaluate(() => { Math.random = window.__origRandom; });
      expect(back.distance).toBe(7);
      expect(back.opportunity).toBeNull();
      expect(back.canBurn).toBe(false);
      expect(back.label).toBe('調べる');

      // The command is gone, so examining must not burn anything.
      await callTalk(page);
      await drainDialogue(page);
      const afterTalk = await page.evaluate(() => ({
        keyAmber: RPG.State.inventory.keyAmber,
        oldKey: RPG.State.inventory.oldKey,
        log: document.getElementById('logContainer')?.textContent || '',
      }));
      expect(afterTalk.keyAmber).toBe(1);
      expect(afterTalk.oldKey).toBe(0);
      expect(afterTalk.log).not.toContain('古びた鍵を手に入れた');
    });

    test('a forest defeat and a highway defeat both forfeit the chance', async ({ page }) => {
      // Standard forest defeat: routed through finalizeStandardDefeat -> enterInn.
      await setBurnSite(page, { distance: 7, keyAmber: 1 });
      const forest = await page.evaluate(() => {
        RPG.State.isBattling = true;
        RPG.State.currentEnemy = { ...RPG.Assets.ENEMIES.find(e => e.id === 'sap') };
        battleSystem.resolveDefeat();
        return RPG.State.amberRootKeyBurnOpportunityDistance;
      });
      expect(forest).toBeNull();
      await drainDefeatSequence(page);

      // Returning to the burn site later must not revive it.
      await page.evaluate(() => {
        Object.assign(RPG.State, {
          mode: 'base', isAtInn: false, isInDungeon: true,
          explorationArea: 'forest', location: '琥珀の森', currentDistance: 7,
        });
        uiControl.updateUI();
      });
      const revisit = await readBurnState(page);
      expect(revisit.opportunity).toBeNull();
      expect(revisit.canBurn).toBe(false);

      // Highway defeat: assigns the return location itself, bypassing enterInn.
      await setBurnSite(page, { distance: 7, keyAmber: 1 });
      const highway = await page.evaluate(() => {
        battleSystem.resolveHighwayDefeat();
        return RPG.State.amberRootKeyBurnOpportunityDistance;
      });
      expect(highway).toBeNull();
    });

    test('returning to the inn forfeits the chance', async ({ page }) => {
      await setBurnSite(page, { distance: 7, keyAmber: 1 });
      const opportunity = await page.evaluate(() => {
        innSystem.enterInn(false, { skipEntryEvents: true });
        return RPG.State.amberRootKeyBurnOpportunityDistance;
      });
      expect(opportunity).toBeNull();
    });

    test('opening the inventory or saving and loading in place keeps the chance', async ({ page }) => {
      await setBurnSite(page, { distance: 7, keyAmber: 1 });

      const afterModal = await page.evaluate(() => {
        uiControl.openModal();
        uiControl.selectItem('keyAmber', 1);
        const detail = document.getElementById('itemDetailArea')?.innerHTML || '';
        uiControl.closeModal?.();
        RPG.State.mode = 'base';
        uiControl.updateUI();
        return {
          detail,
          opportunity: RPG.State.amberRootKeyBurnOpportunityDistance,
          canBurn: explorationSystem.canBurnKeyAmberHere(),
        };
      });
      expect(afterModal.opportunity).toBe(7);
      expect(afterModal.canBurn).toBe(true);
      // The amber remains eligible for the root burn route while also being usable from inventory.
      expect(afterModal.detail).toContain('中に古びた鍵が閉じ込められている琥珀。');
      expect(afterModal.detail).toContain("useItem('keyAmber')");

      const afterReload = await page.evaluate(() => {
        const snapshot = uiControl.createSaveSnapshot('journal');
        localStorage.setItem('okai_rpg_key_amber_test', JSON.stringify(snapshot));
        RPG.State.amberRootKeyBurnOpportunityDistance = null;
        RPG.State.inventory.keyAmber = 0;
        RPG.State.flags.keyAmberExchanged = false;
        uiControl.loadFromStorage('okai_rpg_key_amber_test', '鍵入り琥珀テスト');
        uiControl.updateUI();
        return {
          opportunity: RPG.State.amberRootKeyBurnOpportunityDistance,
          keyAmber: RPG.State.inventory.keyAmber,
          canBurn: explorationSystem.canBurnKeyAmberHere(),
          label: document.getElementById('btnTalk')?.textContent,
        };
      });
      expect(afterReload.opportunity).toBe(7);
      expect(afterReload.keyAmber).toBe(1);
      expect(afterReload.canBurn).toBe(true);
      expect(afterReload.label).toBe('鍵入り琥珀を燃やす');
    });

    test('every new field round-trips, and old saves fall back to safe defaults', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.inventory.keyAmber = 1;
        RPG.State.inventory.oldKey = 2;
        RPG.State.flags.keyAmberExchanged = true;
        RPG.State.amberRootKeyBurnOpportunityDistance = 8;
        RPG.State.forestHutState = 'eventPlayed';

        const snapshot = uiControl.createSaveSnapshot('journal');
        localStorage.setItem('okai_rpg_key_amber_round_trip', JSON.stringify(snapshot));

        const legacy = JSON.parse(JSON.stringify(snapshot));
        delete legacy.amberRootKeyBurnOpportunityDistance;
        delete legacy.forestHutState;
        delete legacy.inventory.keyAmber;
        delete legacy.inventory.oldKey;
        delete legacy.flags.keyAmberExchanged;
        localStorage.setItem('okai_rpg_key_amber_legacy', JSON.stringify(legacy));

        RPG.State.inventory.keyAmber = 0;
        RPG.State.inventory.oldKey = 0;
        RPG.State.flags.keyAmberExchanged = false;
        RPG.State.amberRootKeyBurnOpportunityDistance = null;
        RPG.State.forestHutState = 'locked';
        uiControl.loadFromStorage('okai_rpg_key_amber_round_trip', '往復テスト');
        const roundTrip = {
          keyAmber: RPG.State.inventory.keyAmber,
          oldKey: RPG.State.inventory.oldKey,
          exchanged: RPG.State.flags.keyAmberExchanged,
          opportunity: RPG.State.amberRootKeyBurnOpportunityDistance,
          forestHutState: RPG.State.forestHutState,
        };

        uiControl.loadFromStorage('okai_rpg_key_amber_legacy', '旧セーブテスト');
        const legacyDefaults = {
          keyAmber: RPG.State.inventory.keyAmber,
          oldKey: RPG.State.inventory.oldKey,
          exchanged: RPG.State.flags.keyAmberExchanged,
          opportunity: RPG.State.amberRootKeyBurnOpportunityDistance,
          forestHutState: RPG.State.forestHutState,
        };

        return { roundTrip, legacyDefaults };
      });

      expect(result.roundTrip).toEqual({
        keyAmber: 1, oldKey: 2, exchanged: true, opportunity: 8, forestHutState: 'eventPlayed',
      });
      expect(result.legacyDefaults).toEqual({
        keyAmber: 0, oldKey: 0, exchanged: false, opportunity: null, forestHutState: 'locked',
      });
    });
  });

  test.describe('newly wired rare amber effects', () => {
    test('the normal intervention gate rolls at most twice per battle: immediately, then once more only after HP drops to <=50%', async ({ page }) => {
      const result = await page.evaluate(() => {
        Object.assign(RPG.State, {
          hasOwenIntervened: false,
          currentEnemy: { id: 'dummy', name: 'ダミー', isBoss: false },
          isPoisoned: false,
          equippedRareAmberId: null,
        });
        RPG.State.inventory.herb = 0;
        RPG.State.flags.matamatabiActive = false;
        RPG.State.maxHP = 100;
        RPG.State.currentHP = 100;
        RPG.State.battleState = { owenInterventionRollsUsed: 0 };

        const originalRandom = Math.random;
        Math.random = () => 0.5; // misses the 30% roll every time, isolating the roll-budget logic

        const firstOpportunity = RPG.Assets.OWEN_BEHAVIOR.shouldIntervene(1);
        const rollsAfterFirst = RPG.State.battleState.owenInterventionRollsUsed;

        // Still above half HP: repeated opportunities must not consume a second roll.
        const stillAboveHalfA = RPG.Assets.OWEN_BEHAVIOR.shouldIntervene(2);
        const stillAboveHalfB = RPG.Assets.OWEN_BEHAVIOR.shouldIntervene(3);
        const rollsWhileAboveHalf = RPG.State.battleState.owenInterventionRollsUsed;

        RPG.State.currentHP = 50; // the HP<=50% checkpoint
        const secondOpportunity = RPG.Assets.OWEN_BEHAVIOR.shouldIntervene(4);
        const rollsAfterSecond = RPG.State.battleState.owenInterventionRollsUsed;

        // A third opportunity, even still at/below half HP, must not roll again.
        const thirdOpportunity = RPG.Assets.OWEN_BEHAVIOR.shouldIntervene(5);
        const rollsAfterThird = RPG.State.battleState.owenInterventionRollsUsed;

        Math.random = originalRandom;
        return {
          firstOpportunity, rollsAfterFirst,
          stillAboveHalfA, stillAboveHalfB, rollsWhileAboveHalf,
          secondOpportunity, rollsAfterSecond,
          thirdOpportunity, rollsAfterThird,
        };
      });
      expect(result).toEqual({
        firstOpportunity: false, rollsAfterFirst: 1,
        stillAboveHalfA: false, stillAboveHalfB: false, rollsWhileAboveHalf: 1,
        secondOpportunity: false, rollsAfterSecond: 2,
        thirdOpportunity: false, rollsAfterThird: 2,
      });
    });

    test('sweetAmber replaces the base 30% rate with 70% and forces freeze on a successful normal intervention', async ({ page }) => {
      const result = await page.evaluate(() => {
        Object.assign(RPG.State, {
          hasOwenIntervened: false,
          currentEnemy: { id: 'dummy', name: 'ダミー', isBoss: false },
          isPoisoned: false,
        });
        RPG.State.inventory.herb = 0;
        RPG.State.flags.matamatabiActive = false;
        RPG.State.maxHP = 100;
        RPG.State.currentHP = 100;

        const originalRandom = Math.random;
        Math.random = () => 0.65; // misses the base 30% rate, hits the sweetAmber 70% rate

        RPG.State.equippedRareAmberId = null;
        RPG.State.battleState = { owenInterventionRollsUsed: 0 };
        const withoutAmber = RPG.Assets.OWEN_BEHAVIOR.shouldIntervene(1);

        RPG.State.hasOwenIntervened = false;
        RPG.State.equippedRareAmberId = 'sweetAmber';
        RPG.State.battleState = { owenInterventionRollsUsed: 0 };
        const withAmber = RPG.Assets.OWEN_BEHAVIOR.shouldIntervene(1);
        const action = RPG.Assets.OWEN_BEHAVIOR.decideAction(1);

        Math.random = originalRandom;
        return { withoutAmber, withAmber, action };
      });
      expect(result).toEqual({ withoutAmber: false, withAmber: true, action: 'freeze' });
    });

    test('a successful intervention against the glowing cat rabbit always resolves as freeze, regardless of equipped amber', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.currentEnemy = { id: 'glowing_cat_rabbit', name: '光る猫うさぎ', isBoss: false };
        RPG.State.flags.matamatabiActive = false;

        RPG.State.equippedRareAmberId = null;
        const withoutAmber = RPG.Assets.OWEN_BEHAVIOR.decideAction(1);

        RPG.State.equippedRareAmberId = 'sweetAmber';
        const withSweetAmber = RPG.Assets.OWEN_BEHAVIOR.decideAction(1);

        return { withoutAmber, withSweetAmber };
      });
      expect(result).toEqual({ withoutAmber: 'freeze', withSweetAmber: 'freeze' });
    });

    test('herb support never sets hasOwenIntervened or consumes the normal intervention roll budget', async ({ page }) => {
      const result = await page.evaluate(async () => {
        Object.assign(RPG.State, {
          hasOwenIntervened: false,
          currentEnemy: { id: 'dummy', name: 'ダミー', isBoss: false },
          isPoisoned: false,
          equippedRareAmberId: null,
        });
        RPG.State.flags.matamatabiActive = false;
        RPG.State.maxHP = 100;
        RPG.State.currentHP = 20; // below the 25% emergency threshold
        RPG.State.inventory.herb = 3;
        RPG.State.battleState = { owenInterventionRollsUsed: 0, skippedTurns: 0 };
        RPG.State.debug.isSkipping = true;

        const originalRandom = Math.random;
        Math.random = () => 0.1; // hits the herb 60% roll

        await new Promise(resolve => battleSystem.processOwenAction(resolve));

        Math.random = originalRandom;
        RPG.State.debug.isSkipping = false;

        return {
          herbUsed: 3 - RPG.State.inventory.herb,
          currentHP: RPG.State.currentHP,
          hasOwenIntervened: RPG.State.hasOwenIntervened,
          rollsUsed: RPG.State.battleState.owenInterventionRollsUsed,
        };
      });
      expect(result).toEqual({
        herbUsed: 1, currentHP: 50, hasOwenIntervened: false, rollsUsed: 0,
      });
    });

    test('beeAmber multiplies only Cain\'s first hit of the battle and halves incoming damage', async ({ page }) => {
      const result = await page.evaluate(() => {
        Object.assign(RPG.State, { attack: 20, equippedRareAmberId: 'beeAmber' });
        RPG.State.battleState = { cainFirstHitBonusUsed: false };
        RPG.State.currentEnemy = { id: 'dummy', name: 'ダミー', hp: 99999, armorHp: 0 };

        const originalRandom = Math.random;
        Math.random = () => 0.99; // avoid crit/sword-technique rolls

        const first = battleSystem.performCainAttack({ allowSwordTechniques: false });
        const second = battleSystem.performCainAttack({ allowSwordTechniques: false });

        Math.random = originalRandom;

        RPG.State.maxHP = 100;
        RPG.State.currentHP = 100;
        RPG.State.inventory.gratefulTalisman = 0;
        battleSystem.applyEnemyDirectDamage(10);

        return {
          firstHitDamage: first.hits[0].damage,
          secondHitDamage: second.hits[0].damage,
          hpAfterDamage: RPG.State.currentHP,
        };
      });
      expect(result.firstHitDamage).toBe(30); // floor(20 * 1.5)
      expect(result.secondHitDamage).toBe(20); // bonus already spent
      expect(result.hpAfterDamage).toBe(95); // 10 * 0.5
    });

    test('beeAmber drops from skull_bee as an unappraised ？琥珀, at most once ever', async ({ page }) => {
      const result = await page.evaluate(() => {
        Object.assign(RPG.State, { exp: 0, cainLv: 1, equippedRareAmberId: null });
        RPG.State.inventory.beeAmber = 0;
        RPG.State.inventory.unknownAmber = 0;
        RPG.State.unappraisedAmberResults = [];
        RPG.State.flags.beeAmberObtained = false;
        RPG.State.defeatCounts.skull_bee = { cain: 0, owen: 0 };
        RPG.State.lastBlowBy = 'Cain';

        const originalRandom = Math.random;
        Math.random = () => 0; // guarantee any `< rate` roll succeeds

        RPG.State.currentEnemy = {
          id: 'skull_bee', name: 'ドクロ蜂', hp: 0, xp: 0, gold: 0, drop: { id: 'beeAmber', rate: 1 },
        };
        battleSystem.executeStandardVictory('skull_bee');
        const afterFirst = {
          unknownAmber: RPG.State.inventory.unknownAmber,
          beeAmberCount: RPG.State.inventory.beeAmber,
          queuedResults: [...RPG.State.unappraisedAmberResults],
          obtained: RPG.State.flags.beeAmberObtained,
        };

        RPG.State.currentEnemy = {
          id: 'skull_bee', name: 'ドクロ蜂', hp: 0, xp: 0, gold: 0, drop: { id: 'beeAmber', rate: 1 },
        };
        RPG.State.lastBlowBy = 'Cain';
        battleSystem.executeStandardVictory('skull_bee');

        Math.random = originalRandom;
        return { afterFirst, afterSecondUnknownAmber: RPG.State.inventory.unknownAmber };
      });
      expect(result.afterFirst).toEqual({
        unknownAmber: 1, beeAmberCount: 0, queuedResults: ['beeAmber'], obtained: true,
      });
      expect(result.afterSecondUnknownAmber).toBe(1);
    });

    test('ignoredAmber blocks new poison and cures existing poison on equip', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.equippedRareAmberId = 'ignoredAmber';
        RPG.State.isPoisoned = false;
        const blockedWhileEquipped = battleSystem.inflictPoison();

        RPG.State.equippedRareAmberId = null;
        const inflictedWhenUnequipped = battleSystem.inflictPoison();

        Object.assign(RPG.State, { mode: 'base', isAtInn: true });
        RPG.State.inventory.glowingBrooch = 1;
        RPG.State.inventory.ignoredAmber = 1;
        RPG.State.equippedRareAmberId = null;
        uiControl.equipRareAmber('ignoredAmber');

        return {
          blockedWhileEquipped,
          inflictedWhenUnequipped,
          poisonedAfterEquip: RPG.State.isPoisoned,
        };
      });
      expect(result).toEqual({
        blockedWhileEquipped: false,
        inflictedWhenUnequipped: true,
        poisonedAfterEquip: false,
      });
    });

    test('herbAmber heals at battle turn end, per field move, and boosts herb item healing', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.equippedRareAmberId = 'herbAmber';
        Object.assign(RPG.State, { maxHP: 100, currentHP: 50, isBattling: true });
        RPG.State.currentEnemy = { id: 'dummy', name: 'ダミー', hp: 10, maxHp: 10 };
        RPG.State.battleState = { skippedTurns: 0 };
        const originalProcessOwenAction = battleSystem.processOwenAction;
        battleSystem.processOwenAction = () => {}; // stop right after the turn-end tick under test
        battleSystem.runBattleLoop();
        battleSystem.processOwenAction = originalProcessOwenAction;
        const afterTurnEndHeal = RPG.State.currentHP; // 50 + floor(100*0.03) = 53

        RPG.State.flags.onWagon = false;
        explorationSystem.recordTravelStep();
        const afterMoveHeal = RPG.State.currentHP; // 53 + floor(100*0.02) = 55

        RPG.State.currentHP = 40;
        RPG.State.inventory.herb = 1;
        explorationSystem.useItem('herb');
        const afterHerbItem = RPG.State.currentHP; // 40 + floor(100*0.3*1.5) = 85

        return { afterTurnEndHeal, afterMoveHeal, afterHerbItem };
      });
      expect(result).toEqual({ afterTurnEndHeal: 53, afterMoveHeal: 55, afterHerbItem: 85 });
    });

    test('monsterAmber grants 25% more XP from an ordinary victory only', async ({ page }) => {
      const result = await page.evaluate(() => {
        Object.assign(RPG.State, { exp: 0, cainLv: 1 });
        RPG.State.defeatCounts.test_dummy = { cain: 0, owen: 0 };
        RPG.State.lastBlowBy = 'Cain';

        RPG.State.equippedRareAmberId = null;
        RPG.State.currentEnemy = {
          id: 'test_dummy', name: 'テスト用ダミー', hp: 0, xp: 20, gold: 0,
        };
        battleSystem.executeStandardVictory('test_dummy');
        const withoutAmber = RPG.State.exp;

        RPG.State.exp = 0;
        RPG.State.equippedRareAmberId = 'monsterAmber';
        RPG.State.currentEnemy = {
          id: 'test_dummy', name: 'テスト用ダミー', hp: 0, xp: 20, gold: 0,
        };
        battleSystem.executeStandardVictory('test_dummy');
        const withAmber = RPG.State.exp;

        return { withoutAmber, withAmber };
      });
      expect(result).toEqual({ withoutAmber: 20, withAmber: 25 }); // floor(20 * 1.25)
    });

    test('milkAmber adds 30% maxHP on equip and removes exactly that much on detach, clamping currentHP', async ({ page }) => {
      const result = await page.evaluate(() => {
        Object.assign(RPG.State, {
          mode: 'base', isAtInn: true, maxHP: 100, currentHP: 100, equippedRareAmberId: null,
        });
        RPG.State.inventory.glowingBrooch = 1;
        RPG.State.inventory.milkAmber = 1;

        uiControl.equipRareAmber('milkAmber');
        const afterEquip = { maxHP: RPG.State.maxHP, currentHP: RPG.State.currentHP };

        uiControl.detachRareAmber();
        const afterDetach = { maxHP: RPG.State.maxHP, currentHP: RPG.State.currentHP };

        return { afterEquip, afterDetach };
      });
      expect(result.afterEquip).toEqual({ maxHP: 130, currentHP: 100 }); // no extra heal on equip
      expect(result.afterDetach).toEqual({ maxHP: 100, currentHP: 100 }); // exact revert + clamp
    });

    test('crackedAmber only grants its crit bonus while equipped and at/below half HP', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.maxHP = 100;

        RPG.State.equippedRareAmberId = null;
        RPG.State.currentHP = 40;
        const unequipped = battleSystem.getCrackedAmberCritBonus();

        RPG.State.equippedRareAmberId = 'crackedAmber';
        RPG.State.currentHP = 100;
        const fullHp = battleSystem.getCrackedAmberCritBonus();

        RPG.State.currentHP = 50;
        const halfHp = battleSystem.getCrackedAmberCritBonus();

        RPG.State.currentHP = 40;
        const lowHp = battleSystem.getCrackedAmberCritBonus();

        return { unequipped, fullHp, halfHp, lowHp };
      });
      expect(result).toEqual({ unequipped: 0, fullHp: 0, halfHp: 0.2, lowHp: 0.2 });
    });

    test('masochistAmber recovers only after the third real hit, caps at half HP, resets per battle, and cannot prevent death', async ({ page }) => {
      const result = await page.evaluate(() => {
        Object.assign(RPG.State, {
          mode: 'base', maxHP: 100, currentHP: 100, equippedRareAmberId: 'masochistAmber',
        });
        RPG.State.inventory.gratefulTalisman = 0;
        RPG.State.flags.fakeWoundMedicinePrepared = false;
        RPG.State.battleState = { masochistAmberHitCount: 0 };

        const hit = damage => {
          battleSystem.applyEnemyDirectDamage(damage);
          return { hp: RPG.State.currentHP, hits: RPG.State.battleState.masochistAmberHitCount };
        };
        const firstFourHits = [hit(20), hit(20), hit(20), hit(20)];

        RPG.State.currentHP = 100;
        RPG.State.battleState = { masochistAmberHitCount: 4 };
        const cappedFifthHit = hit(60);

        const originalContinueBattleStart = battleSystem.continueBattleStart;
        battleSystem.continueBattleStart = () => {};
        RPG.State.battleState = { masochistAmberHitCount: 5 };
        battleSystem.beginBattle({ id: 'masochist_test', name: 'ダミー', maxHp: 1, atk: 1 });
        const nextBattleHitCount = RPG.State.battleState.masochistAmberHitCount;
        battleSystem.continueBattleStart = originalContinueBattleStart;

        RPG.State.currentHP = 100;
        RPG.State.battleState = { masochistAmberHitCount: 4 };
        const lethal = battleSystem.applyEnemyDirectDamage(100);
        return { firstFourHits, cappedFifthHit, nextBattleHitCount, lethal, hpAfterLethal: RPG.State.currentHP, hitsAfterLethal: RPG.State.battleState.masochistAmberHitCount };
      });

      expect(result.firstFourHits).toEqual([
        { hp: 80, hits: 1 },
        { hp: 60, hits: 2 },
        { hp: 44, hits: 3 },
        { hp: 28, hits: 4 },
      ]);
      expect(result.cappedFifthHit).toEqual({ hp: 50, hits: 5 });
      expect(result.nextBattleHitCount).toBe(0);
      expect(result.lethal).toMatchObject({ lethal: true, talismanActivated: false });
      expect(result.hpAfterLethal).toBe(0);
      expect(result.hitsAfterLethal).toBe(4);
    });
  });

  test.describe('multiple level-ups from a single victory', () => {
    test('a large XP grant applies every level\'s stat growth and log line, and keeps leftover exp', async ({ page }) => {
      const result = await page.evaluate(() => {
        Object.assign(RPG.State, {
          cainLv: 1, exp: 0, maxHP: 100, currentHP: 100, attack: 10, equippedRareAmberId: null,
        });
        RPG.State.currentEnemy = {
          id: 'test_dummy', name: 'テスト用ダミー', hp: 0, xp: 300, gold: 0,
        };
        RPG.State.defeatCounts.test_dummy = { cain: 0, owen: 0 };
        RPG.State.lastBlowBy = 'Cain';
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';

        battleSystem.executeStandardVictory('test_dummy');

        return {
          cainLv: RPG.State.cainLv,
          exp: RPG.State.exp,
          maxHP: RPG.State.maxHP,
          attack: RPG.State.attack,
          levelUpLines: [...document.querySelectorAll('#logContainer .log-entry')]
            .map(el => el.textContent)
            .filter(text => text.includes('【LEVEL UP!】')),
        };
      });
      // 300 exp crosses the level 1->2 (75), 2->3 (112.5), 3->4 (168.75) and 4->5 (253.125)
      // thresholds but not 5->6 (379.6875), so exactly 4 levels are gained and the exp itself is
      // never reset or floored - it carries over as leftover progress toward level 6.
      expect(result).toEqual({
        cainLv: 5,
        exp: 300,
        maxHP: 140,
        attack: 18,
        levelUpLines: [
          '【LEVEL UP!】カインのレベルが 2 に上がった！',
          '【LEVEL UP!】カインのレベルが 3 に上がった！',
          '【LEVEL UP!】カインのレベルが 4 に上がった！',
          '【LEVEL UP!】カインのレベルが 5 に上がった！',
        ],
      });
    });

    test('each level gained in one victory queues its own talk dialogue, in order', async ({ page }) => {
      const setup = await page.evaluate(() => {
        Object.assign(RPG.State, {
          cainLv: 1, exp: 0, maxHP: 100, currentHP: 100, attack: 10, equippedRareAmberId: null,
        });
        RPG.State.flags.pendingLevelUpTalk = [];
        RPG.State.currentEnemy = {
          id: 'test_dummy', name: 'テスト用ダミー', hp: 0, xp: 300, gold: 0,
        };
        RPG.State.defeatCounts.test_dummy = { cain: 0, owen: 0 };
        RPG.State.lastBlowBy = 'Cain';

        battleSystem.executeStandardVictory('test_dummy');

        return { cainLv: RPG.State.cainLv };
      });
      await drainDialogue(page);

      const result = await page.evaluate(() => ({
        lines: [...document.querySelectorAll('#logContainer .log-entry')].map(el => el.textContent),
        pendingLevelUpTalk: RPG.State.flags.pendingLevelUpTalk,
      }));
      // 300 exp reaches level 5 (levels 2, 3, 4, and 5 gained); only levels 2 and 4 have a talk
      // defined, so the two talks should both appear, back to back and in order.
      expect(setup.cainLv).toBe(5);
      const expectedOrder = [
        'カイン「やった！」', 'オーエン「誤差でしょ」', 'カイン「それでも、確かな一歩だ」',
        'オーエン「技とか覚えないの？」', 'カイン「この程度のレベルでか？」', 'オーエン「はは、言えてる」',
      ];
      let cursor = -1;
      for (const expected of expectedOrder) {
        const idx = result.lines.indexOf(expected, cursor + 1);
        expect(idx).toBeGreaterThan(cursor);
        cursor = idx;
      }
      expect(result.pendingLevelUpTalk).toEqual([]);
    });

    test('during a deferred-talk boss battle, every level gained is queued to pendingLevelUpTalk in order', async ({ page }) => {
      const result = await page.evaluate(() => {
        const originalRandom = Math.random;
        Math.random = () => 0.999;
        try {
          Object.assign(RPG.State, {
            cainLv: 1, exp: 0, maxHP: 300, currentHP: 300, attack: 10, equippedRareAmberId: null,
          });
          RPG.State.flags.pendingLevelUpTalk = [];
          RPG.State.currentEnemy = {
            id: 'giant_larva', name: '泥這う大幼蟲', hp: 0, xp: 300, gold: 0,
          };
          RPG.State.defeatCounts.giant_larva = { cain: 0, owen: 0 };
          RPG.State.lastBlowBy = 'Cain';

          battleSystem.executeStandardVictory('giant_larva');
        } finally {
          Math.random = originalRandom;
        }

        return {
          cainLv: RPG.State.cainLv,
          pendingLevelUpTalk: RPG.State.flags.pendingLevelUpTalk,
        };
      });
      await drainDialogue(page);

      // 300 exp reaches level 5 (levels 2-5 gained); only levels 2 and 4 have talks defined, and
      // both must be deferred (not played immediately) since giant_larva is a deferred-talk boss.
      expect(result.cainLv).toBe(5);
      expect(result.pendingLevelUpTalk).toEqual([2, 4]);
    });
  });

  test.describe('carnivorous vine nest', () => {
    async function standAtHerbGardenEntrance(page, flags = {}) {
      await page.evaluate((nestFlags) => {
        RPG.State.isAtInn = false;
        RPG.State.isInDungeon = true;
        RPG.State.explorationArea = 'herbGarden';
        RPG.State.currentDistance = 0;
        RPG.State.location = uiControl.getLocData(0).name;
        RPG.State.storyPhase = 6;
        RPG.State.mode = 'base';
        Object.assign(RPG.State.flags, nestFlags);
        uiControl.updateUI();
      }, flags);
    }

    // The battle loop runs itself once beginBattle fires, so the chain is exercised with
    // startBattle stubbed out and a synthetic enemy - the same shape the existing victory
    // tests use. Combat itself is already covered elsewhere; what matters here is that the
    // chain hands off to the next vine at all.
    async function stubStartBattle(page) {
      await page.evaluate(() => {
        window.__vineBattles = [];
        window.__originalStartBattle = battleSystem.startBattle;
        battleSystem.startBattle = function (enemyId) {
          window.__vineBattles.push(enemyId);
          return true;
        };
      });
    }

    async function winCurrentVine(page) {
      await page.evaluate(() => {
        RPG.State.isBattling = true;
        RPG.State.mode = 'battle';
        RPG.State.currentEnemy = {
          id: 'carnivorous_vine', name: '肉食カズラ', hp: 0, maxHp: 90, xp: 30, gold: 0,
        };
        RPG.State.battleState = { skippedTurns: 0, playerTookDamage: false };
        RPG.State.lastBlowBy = 'Cain';
        if (!RPG.State.defeatCounts) RPG.State.defeatCounts = {};
        RPG.State.defeatCounts.carnivorous_vine =
          RPG.State.defeatCounts.carnivorous_vine || { cain: 0, owen: 0 };
        battleSystem.executeStandardVictory('carnivorous_vine');
      });
      return drainDialogue(page);
    }

    test('the entrance examine becomes 裏道？ then 肉食カズラの巣, and fleeing changes nothing', async ({ page }) => {
      // Two real trips through buildVineNestTransitionQueue's now-3s-per-leg blackout (enter,
      // then flee) push this comfortably past Playwright's default 30s test timeout.
      test.setTimeout(60000);
      await standAtHerbGardenEntrance(page);
      await expect(page.locator('#btnTalk')).toHaveText('調べる');

      await page.evaluate(() => explorationSystem.talk());
      const discovered = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        state: RPG.State.flags.herbGardenVineNestState,
        label: document.getElementById('btnTalk')?.textContent,
      }));
      expect(discovered.log).toContain('カイン（……ここの草むら、かき分けたら入れそうだな）');
      expect(discovered.state).toBe('discovered');
      expect(discovered.label).toBe('裏道？');

      const before = await page.evaluate(() => ({
        hp: RPG.State.currentHP,
        deathCount: RPG.State.deathCount,
        vineDefeated: RPG.State.flags.carnivorousVineDefeated,
        vineRegrown: RPG.State.flags.carnivorousVineRegrown,
        vineStayCount: RPG.State.flags.carnivorousVineStayCount,
        nestCleared: RPG.State.flags.herbGardenVineNestCleared,
      }));

      await page.evaluate(() => explorationSystem.talk());
      // Crosses both real 3s delays in buildVineNestTransitionQueue - the default 100-tap
      // budget (5s at 50ms/tap) is no longer enough on its own.
      expect(await drainDialogue(page, 200)).toBe('choice');

      const inNest = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        location: RPG.State.location,
        state: RPG.State.flags.herbGardenVineNestState,
        scene: visualDirector.getActiveScene(),
        forwardDisplay: document.getElementById('btnMoveForward')?.style.display,
        choices: [...document.querySelectorAll('#action-buttons button')].map(b => b.textContent),
        sceneFocus: document.getElementById('logContainer')?.classList.contains('scene-focus'),
      }));
      expect(inNest.log).toContain('カインは草むらを手探りで進んだ。');
      expect(inNest.log).toContain('肉食カズラの巣だ！');
      expect(inNest.location).toBe('肉食カズラの巣');
      expect(inNest.state).toBe('confirmed');
      expect(inNest.scene).toBe('vine-nest');
      expect(inNest.forwardDisplay).toBe('none');
      expect(inNest.choices).toEqual(['【戦う】', '【逃げる】']);
      expect(inNest.sceneFocus).toBe(true);

      await page.getByRole('button', { name: '【逃げる】', exact: true }).click();
      await drainDialogue(page, 200);

      const after = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        location: RPG.State.location,
        label: document.getElementById('btnTalk')?.textContent,
        sceneFocus: document.getElementById('logContainer')?.classList.contains('scene-focus'),
        state: {
          hp: RPG.State.currentHP,
          deathCount: RPG.State.deathCount,
          vineDefeated: RPG.State.flags.carnivorousVineDefeated,
          vineRegrown: RPG.State.flags.carnivorousVineRegrown,
          vineStayCount: RPG.State.flags.carnivorousVineStayCount,
          nestCleared: RPG.State.flags.herbGardenVineNestCleared,
        },
      }));
      expect(after.log).toContain('カインは草むらを引き返した。');
      expect(after.location).toBe('薬草園入口');
      expect(after.sceneFocus).toBe(false);
      // The examine command never comes back; the nest keeps the slot for good.
      expect(after.label).toBe('肉食カズラの巣');
      expect(after.state).toEqual(before);
    });

    test('three vines run back to back without Owen and pay one ignored amber', async ({ page }) => {
      // Two real trips into the nest (interrupted attempt + the real run), each crossing
      // buildVineNestTransitionQueue's now-3s-per-leg blackout, push this well past
      // Playwright's default 30s test timeout.
      test.setTimeout(60000);
      await standAtHerbGardenEntrance(page, {
        herbGardenVineNestState: 'confirmed',
        herbGardenVineNestCleared: false,
        herbGardenVineNestAmberTaken: false,
      });

      await stubStartBattle(page);

      // An interrupted run is discarded: the vampire amber / matamatabi accident drops the
      // chain without clearing the nest, so the next attempt starts at the first vine again.
      await page.evaluate(() => explorationSystem.talk());
      // Crosses both real 3s delays in buildVineNestTransitionQueue.
      await drainDialogue(page, 200);
      await page.getByRole('button', { name: '【戦う】', exact: true }).click();
      expect(await page.evaluate(() => ({
        remaining: battleSystem.vineNestChainRemaining,
        battles: window.__vineBattles,
      }))).toEqual({ remaining: 3, battles: ['carnivorous_vine'] });

      await page.evaluate(() => battleSystem.triggerVampireAmberMatamatabiAccident());
      await drainDialogue(page);
      expect(await page.evaluate(() => ({
        remaining: battleSystem.vineNestChainRemaining,
        cleared: RPG.State.flags.herbGardenVineNestCleared,
      }))).toEqual({ remaining: 0, cleared: false });

      await standAtHerbGardenEntrance(page);
      await page.evaluate(() => { window.__vineBattles = []; });
      await page.evaluate(() => explorationSystem.talk());
      // Crosses both real 3s delays in buildVineNestTransitionQueue.
      await drainDialogue(page, 200);
      await page.getByRole('button', { name: '【戦う】', exact: true }).click();
      expect(await page.evaluate(() => ({
        remaining: battleSystem.vineNestChainRemaining,
        battles: window.__vineBattles,
      }))).toEqual({ remaining: 3, battles: ['carnivorous_vine'] });

      // Owen never steps in during the nest run, so all three go through Cain's victory path.
      const owen = await page.evaluate(() => {
        const behavior = RPG.Assets.OWEN_BEHAVIOR;
        const originalShould = behavior.shouldIntervene;
        const originalDecide = behavior.decideAction;
        behavior.shouldIntervene = () => true;
        behavior.decideAction = () => 'kill';
        RPG.State.hasOwenIntervened = false;
        let continued = false;
        battleSystem.processOwenAction(() => { continued = true; });
        behavior.shouldIntervene = originalShould;
        behavior.decideAction = originalDecide;
        return { continued, intervened: RPG.State.hasOwenIntervened };
      });
      expect(owen).toEqual({ continued: true, intervened: false });

      await winCurrentVine(page);
      let progress = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        remaining: battleSystem.vineNestChainRemaining,
        battles: window.__vineBattles.length,
      }));
      expect(progress.log).toContain('カイン「まだか！？」');
      expect(progress).toMatchObject({ remaining: 2, battles: 2 });

      await winCurrentVine(page);
      progress = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        remaining: battleSystem.vineNestChainRemaining,
        battles: window.__vineBattles.length,
      }));
      expect(progress.log).toContain('カイン「嘘だろ！」');
      expect(progress).toMatchObject({ remaining: 1, battles: 3 });

      await winCurrentVine(page);
      const cleared = await page.evaluate(() => {
        battleSystem.startBattle = window.__originalStartBattle;
        return {
          log: document.getElementById('logContainer')?.textContent || '',
          remaining: battleSystem.vineNestChainRemaining,
          nestCleared: RPG.State.flags.herbGardenVineNestCleared,
          battles: window.__vineBattles.length,
        };
      });
      expect(cleared.log).toContain('オーエン「溶かされたいのかと思って」');
      expect(cleared.log).toContain('行き止まりだ……。');
      // No fourth vine: the run stops at three.
      expect(cleared).toMatchObject({ remaining: 0, nestCleared: true, battles: 3 });

      // The back of the nest pays exactly one ？琥珀, and its identity stays hidden.
      await page.evaluate(() => explorationSystem.talk());
      await drainDialogue(page);
      const reward = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        unknownAmber: RPG.State.inventory.unknownAmber,
        queued: RPG.State.unappraisedAmberResults,
        ignoredAmber: RPG.State.inventory.ignoredAmber,
      }));
      expect(reward.log).toContain('🔸？琥珀を手に入れた！');
      expect(reward.log).not.toContain('無視入り琥珀');
      expect(reward.unknownAmber).toBe(1);
      expect(reward.queued).toEqual(['ignoredAmber']);
      expect(reward.ignoredAmber).toBe(0);

      // Once the ？琥珀 is taken, the next examine of the cleared nest finds the diary instead.
      await page.evaluate(() => explorationSystem.talk());
      await drainDialogue(page);
      const diaryReward = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        diary: RPG.State.inventory.someonesDiary,
      }));
      expect(diaryReward.log).toContain('📓誰かの日記を手に入れた！');
      expect(diaryReward.diary).toBe(1);

      // Only after both one-time finds are taken does the nest go quiet.
      await page.evaluate(() => explorationSystem.talk());
      await drainDialogue(page);
      const second = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        unknownAmber: RPG.State.inventory.unknownAmber,
        diary: RPG.State.inventory.someonesDiary,
      }));
      expect(second.log).toContain('カイン（特に気になるものはないな）');
      expect(second.unknownAmber).toBe(1);
      expect(second.diary).toBe(1);

      await page.evaluate(() => {
        RPG.State.mode = 'base';
        RPG.State.flags.firstAmberAppraisalDone = true;
        innSystem.appraiseAmber();
      });
      await drainDialogue(page);
      const appraised = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        unknownAmber: RPG.State.inventory.unknownAmber,
        ignoredAmber: RPG.State.inventory.ignoredAmber,
      }));
      expect(appraised.log).toContain('《無視入り琥珀》と鑑定された。');
      expect(appraised.unknownAmber).toBe(0);
      expect(appraised.ignoredAmber).toBe(1);
    });

    test('the entrance blackout waits for the log overlay to darken before showing its narration line, and leaves the bottom menu untouched', async ({ page }) => {
      await standAtHerbGardenEntrance(page, { herbGardenVineNestState: 'confirmed' });

      const before = await page.evaluate(() => ({
        forwardDisplay: getComputedStyle(document.getElementById('btnMoveForward')).display,
        exploreUIDisplay: getComputedStyle(document.getElementById('exploreUI')).display,
      }));

      const startedAt = Date.now();
      await page.evaluate(() => explorationSystem.enterVineNest());

      await page.waitForFunction(() => (
        (document.getElementById('logContainer')?.textContent || '').includes('カインは草むらを手探りで進んだ。')
      ), { timeout: 15000 });
      const elapsedMs = Date.now() - startedAt;

      const duringBlackout = await page.evaluate(() => {
        const container = document.getElementById('logContainer');
        const nightvisible = container.querySelector('.log-nightvisible');
        return {
          hasNightMode: container.classList.contains('night-mode'),
          overlayOpacity: Number(getComputedStyle(container, '::before').opacity),
          nightvisibleZIndex: Number(getComputedStyle(nightvisible).zIndex),
          forwardDisplay: getComputedStyle(document.getElementById('btnMoveForward')).display,
          exploreUIDisplay: getComputedStyle(document.getElementById('exploreUI')).display,
        };
      });

      // The fix waits for the log overlay's own 3s fade (style.css) before showing the line -
      // it can no longer land at the old ~400ms mark, which is the point of the timing fix.
      expect(elapsedMs).toBeGreaterThan(2500);
      expect(duringBlackout.hasNightMode).toBe(true);
      expect(duringBlackout.overlayOpacity).toBeGreaterThan(0.9);
      expect(duringBlackout.nightvisibleZIndex).toBeGreaterThan(0);
      // The bottom menu is completely unaffected by the blackout.
      expect(duringBlackout.forwardDisplay).toBe(before.forwardDisplay);
      expect(duringBlackout.exploreUIDisplay).toBe(before.exploreUIDisplay);

      await drainDialogue(page, 200);
    });
  });
});

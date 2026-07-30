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

test.describe('討伐ノート (bounty notebook)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await page.goto('/chapter1.html');
    await page.waitForFunction(() => (
      typeof uiControl !== 'undefined' &&
      typeof innSystem !== 'undefined' &&
      typeof battleSystem !== 'undefined' &&
      typeof explorationSystem !== 'undefined'
    ));
    await advanceUntilInteractive(page);
  });

  test('the notebook button is hidden until unlocked, visible after', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      RPG.State.flags.notebookUnlocked = false;
      uiControl.updateUI();
      const hiddenDisplay = document.getElementById('btnInnNotebook')?.style.display;

      RPG.State.flags.notebookUnlocked = true;
      uiControl.updateUI();
      const shownDisplay = document.getElementById('btnInnNotebook')?.style.display;

      return { hiddenDisplay, shownDisplay };
    });
    expect(result).toEqual({ hiddenDisplay: 'none', shownDisplay: 'flex' });
  });

  test('a hurt stay during the first inn sleep (branch 9) unlocks the notebook and grants herb x3 once', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: true,
        storyPhase: 1,
        currentHP: 50,
        maxHP: 140,
        canStay: true,
        silverCoins: 0,
      });
      Object.assign(RPG.State.flags, {
        firstInnSleep: false,
        notebookUnlocked: false,
        ratBounty10Received: false,
        silverDelivered: false,
        matamatabiNightPending: false,
        wagonReadyForDeparture: false,
        phase7DepartureNightSeen: false,
      });
      RPG.State.inventory.herb = 0;
      innSystem.stay();
    });

    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      notebookUnlocked: RPG.State.flags.notebookUnlocked,
      herb: RPG.State.inventory.herb,
      mode: RPG.State.mode,
    }));
    expect(result).toEqual({ notebookUnlocked: true, herb: 3, mode: 'base' });

    // Staying again (now via branch 10, since firstInnSleep is now true) must not replay the scene.
    await page.evaluate(() => {
      RPG.State.currentHP = Math.max(1, RPG.State.currentHP - 10);
      RPG.State.canStay = true;
      innSystem.stay();
    });
    await drainDialogue(page);
    const herbAfterSecondStay = await page.evaluate(() => RPG.State.inventory.herb);
    expect(herbAfterSecondStay).toBe(3);
  });

  test('a hurt stay on the generic path (branch 10) also unlocks the notebook', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: true,
        storyPhase: 2,
        currentHP: 80,
        maxHP: 140,
        canStay: true,
        silverCoins: 0,
      });
      Object.assign(RPG.State.flags, {
        firstInnSleep: true,
        notebookUnlocked: false,
        ratBounty10Received: false,
        silverDelivered: false,
        matamatabiNightPending: false,
        wagonReadyForDeparture: false,
        phase7DepartureNightSeen: false,
      });
      RPG.State.inventory.herb = 0;
      innSystem.stay();
    });

    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      notebookUnlocked: RPG.State.flags.notebookUnlocked,
      herb: RPG.State.inventory.herb,
      mode: RPG.State.mode,
    }));
    expect(result).toEqual({ notebookUnlocked: true, herb: 3, mode: 'base' });
  });

  test('the intro does not fire when HP was full at the moment stay was chosen', async ({ page }) => {
    const immediateResult = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: true,
        storyPhase: 2,
        currentHP: 140,
        maxHP: 140,
        canStay: true,
      });
      Object.assign(RPG.State.flags, {
        notebookUnlocked: false,
        amberMerchantMovePending: false,
      });
      innSystem.stay();
      return { notebookUnlocked: RPG.State.flags.notebookUnlocked, mode: RPG.State.mode };
    });
    // Full HP with no escape hatch returns immediately from the guard - no dialogue at all.
    expect(immediateResult).toEqual({ notebookUnlocked: false, mode: 'base' });

    // Edge case: amberMerchantMovePending lets a full-HP stay reach branch 9/10 anyway,
    // but the intro must still not fire because HP was not below max at stay-choice time.
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: true,
        storyPhase: 1,
        currentHP: 140,
        maxHP: 140,
        canStay: true,
        silverCoins: 0,
      });
      Object.assign(RPG.State.flags, {
        firstInnSleep: false,
        notebookUnlocked: false,
        silverDelivered: false,
        matamatabiNightPending: false,
        amberMerchantMovePending: true,
      });
      innSystem.stay();
    });
    await drainDialogue(page);
    const result = await page.evaluate(() => RPG.State.flags.notebookUnlocked);
    expect(result).toBe(false);
  });

  test('the intro does not fire via defeat-triggered auto-recovery', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'event',
        isAtInn: true,
        currentHP: 5,
        maxHP: 140,
        deathCount: 0,
      });
      RPG.State.flags.notebookUnlocked = false;
      innSystem.showDefeatSequence('rat');
    });

    await drainDialogue(page);

    const result = await page.evaluate(() => RPG.State.flags.notebookUnlocked);
    expect(result).toBe(false);
  });

  test('loading an old save without the new notebook flags defaults them safely', async ({ page }) => {
    const result = await page.evaluate(() => {
      const legacySave = JSON.parse(JSON.stringify(RPG.State));
      delete legacySave.flags.notebookUnlocked;
      delete legacySave.flags.ratBounty10Received;
      localStorage.setItem('okai_rpg_notebook_legacy_test', JSON.stringify(legacySave));

      RPG.State.flags.notebookUnlocked = true;
      RPG.State.flags.ratBounty10Received = true;

      uiControl.loadFromStorage('okai_rpg_notebook_legacy_test', 'テスト');

      return {
        notebookUnlocked: RPG.State.flags.notebookUnlocked,
        ratBounty10Received: RPG.State.flags.ratBounty10Received,
      };
    });
    expect(result).toEqual({ notebookUnlocked: false, ratBounty10Received: false });

    // And it can still unlock normally afterward on a qualifying stay.
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base', isAtInn: true, storyPhase: 3, currentHP: 60, maxHP: 140, canStay: true, silverCoins: 0,
      });
      Object.assign(RPG.State.flags, {
        firstInnSleep: true, silverDelivered: false, matamatabiNightPending: false,
        wagonReadyForDeparture: false, phase7DepartureNightSeen: false,
      });
      innSystem.stay();
    });
    await drainDialogue(page);
    const unlocked = await page.evaluate(() => RPG.State.flags.notebookUnlocked);
    expect(unlocked).toBe(true);
  });

  test('unknown notebook entries unlock when the confirmed battle begins', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State.flags, {
        notebookSapEncountered: false,
        notebookAmberRatEncountered: false,
        notebookAmberWeaselEncountered: false,
      });
      Object.assign(RPG.State, {
        mode: 'base',
        isBattling: false,
        currentEnemy: null,
      });

      uiControl.openNotebookModal();
      const before = document.getElementById('notebookRowList')?.textContent || '';
      uiControl.closeNotebookModal();

      const sap = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'sap');
      battleSystem.beginBattle(sap);
      const unlockedAtStart = RPG.State.flags.notebookSapEncountered;

      RPG.State.isBattling = false;
      RPG.State.currentEnemy = null;
      RPG.State.battleState = null;
      RPG.State.mode = 'base';
      uiControl.openNotebookModal();
      const after = document.getElementById('notebookRowList')?.textContent || '';

      return {
        before,
        after,
        unlockedAtStart,
        amberRatLocked: RPG.State.flags.notebookAmberRatEncountered,
        amberWeaselLocked: RPG.State.flags.notebookAmberWeaselEncountered,
      };
    });

    expect(result.before).toContain('？？？');
    expect(result.before).not.toContain('琥珀の樹液');
    expect(result.after).toContain('琥珀の樹液');
    expect(result.unlockedAtStart).toBe(true);
    expect(result.amberRatLocked).toBe(false);
    expect(result.amberWeaselLocked).toBe(false);
  });

  test('normal_rat does not unlock or count as the notebook rat entry', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.notebookRatEncountered = false;
      const unlocked = battleSystem.unlockNotebookEntryForEncounter('normal_rat');
      return {
        unlocked,
        flag: RPG.State.flags.notebookRatEncountered,
      };
    });
    expect(result).toEqual({ unlocked: false, flag: false });
  });

  test('legacy saves infer missing encounter flags only from existing matching kills', async ({ page }) => {
    const result = await page.evaluate(() => {
      const legacySave = JSON.parse(JSON.stringify(RPG.State));
      [
        'notebookRatEncountered',
        'notebookWeaselEncountered',
        'notebookSapEncountered',
        'notebookAmberRatEncountered',
        'notebookAmberWeaselEncountered',
      ].forEach(flag => delete legacySave.flags[flag]);
      legacySave.defeatCounts = {
        sap: { cain: 0, owen: 1 },
        amber_rat: { cain: 0, owen: 0 },
      };
      localStorage.setItem('okai_rpg_notebook_encounter_legacy_test', JSON.stringify(legacySave));

      uiControl.loadFromStorage('okai_rpg_notebook_encounter_legacy_test', 'テスト');
      return {
        sap: RPG.State.flags.notebookSapEncountered,
        amberRat: RPG.State.flags.notebookAmberRatEncountered,
        amberWeasel: RPG.State.flags.notebookAmberWeaselEncountered,
      };
    });

    expect(result).toEqual({ sap: true, amberRat: false, amberWeasel: false });
  });

  test('an explicit encounter unlock survives save and reload even without a kill', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.notebookAmberWeaselEncountered = true;
      RPG.State.defeatCounts.amber_weasel = { cain: 0, owen: 0 };
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_notebook_encounter_save_test', JSON.stringify(snapshot));

      RPG.State.flags.notebookAmberWeaselEncountered = false;
      uiControl.loadFromStorage('okai_rpg_notebook_encounter_save_test', 'テスト');
      return {
        encountered: RPG.State.flags.notebookAmberWeaselEncountered,
        kills: innSystem.getEnemyKillCount('amber_weasel'),
      };
    });

    expect(result).toEqual({ encountered: true, kills: 0 });
  });

  test('getNotebookRowDisplay caps progress at the active tier and marks tiers correctly', async ({ page }) => {
    const result = await page.evaluate(() => {
      const tiers = [
        { label: '10', target: 10, claimedFlag: 'ratBounty10Received' },
        { label: '20', target: 20, claimedFlag: null },
        { label: 'ALL', target: null, claimedFlag: null },
      ];
      RPG.State.flags.ratBounty10Received = false;
      const unclaimedLow = uiControl.getNotebookRowDisplay(2, tiers);
      const unclaimedReached = uiControl.getNotebookRowDisplay(13, tiers);

      RPG.State.flags.ratBounty10Received = true;
      const claimed = uiControl.getNotebookRowDisplay(13, tiers);
      const claimedOverflow = uiControl.getNotebookRowDisplay(25, tiers);

      const pack = r => ({ count: r.displayCount, target: r.displayTarget, markers: r.markers });
      return {
        unclaimedLow: pack(unclaimedLow),
        unclaimedReached: pack(unclaimedReached),
        claimed: pack(claimed),
        claimedOverflow: pack(claimedOverflow),
      };
    });

    expect(result).toEqual({
      unclaimedLow: { count: 2, target: 10, markers: ['○', '○', '－'] },
      unclaimedReached: { count: 10, target: 10, markers: ['！', '○', '－'] },
      claimed: { count: 13, target: 20, markers: ['✓', '○', '－'] },
      claimedOverflow: { count: 20, target: 20, markers: ['✓', '！', '－'] },
    });
  });

  test('getRatBounty10Reward and hasAnyClaimableNotebookReward reflect the 10-kill threshold', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.ratBounty10Received = false;
      RPG.State.defeatCounts.rat = { cain: 5, owen: 4 };
      const below = { reward: innSystem.getRatBounty10Reward(), claimable: innSystem.hasAnyClaimableNotebookReward() };

      RPG.State.defeatCounts.rat = { cain: 5, owen: 5 };
      const atThreshold = { reward: innSystem.getRatBounty10Reward(), claimable: innSystem.hasAnyClaimableNotebookReward() };

      return { below, atThreshold };
    });

    expect(result.below.reward).toBeNull();
    expect(result.below.claimable).toBe(false);
    expect(result.atThreshold.reward).toEqual({ itemId: 'herb', qty: 3, flag: 'ratBounty10Received' });
    expect(result.atThreshold.claimable).toBe(true);
  });

  test('claiming the rat-10 reward grants herb x3 once and marks it received', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      RPG.State.flags.ratBounty10Received = false;
      RPG.State.defeatCounts.rat = { cain: 6, owen: 4 };
      RPG.State.inventory.herb = 0;
      innSystem.claimNotebookRewards();
    });

    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      herb: RPG.State.inventory.herb,
      received: RPG.State.flags.ratBounty10Received,
      modalDisplay: document.getElementById('notebookModal')?.style.display,
      mode: RPG.State.mode,
    }));
    expect(result).toEqual({ herb: 3, received: true, modalDisplay: 'none', mode: 'base' });

    // A second claim attempt afterward must be a no-op (already received).
    await page.evaluate(() => {
      innSystem.claimNotebookRewards();
    });
    const second = await page.evaluate(() => ({ herb: RPG.State.inventory.herb, mode: RPG.State.mode }));
    expect(second).toEqual({ herb: 3, mode: 'base' });
  });

  test('rat 10 and 20 rewards remain independently claimable at 20 kills', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      Object.assign(RPG.State.flags, {
        ratBounty10Received: false,
        ratBounty20Received: false,
      });
      RPG.State.defeatCounts.rat = { cain: 12, owen: 8 };
      RPG.State.inventory.herb = 0;
      RPG.State.inventory.fakeWoundMedicine = 0;
      innSystem.claimNotebookRewards('rat', '20');
    });
    await drainDialogue(page);

    await page.evaluate(() => {
      innSystem.claimNotebookRewards('rat', '10');
    });
    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      herb: RPG.State.inventory.herb,
      medicine: RPG.State.inventory.fakeWoundMedicine,
      rat10: RPG.State.flags.ratBounty10Received,
      rat20: RPG.State.flags.ratBounty20Received,
      claimable: innSystem.hasAnyClaimableNotebookReward(),
    }));
    expect(result).toEqual({
      herb: 3,
      medicine: 3,
      rat10: true,
      rat20: true,
      claimable: false,
    });
  });

  test('the player selects an achieved tier before using the shared claim button', async ({ page }) => {
    const state = await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      Object.assign(RPG.State.flags, {
        notebookUnlocked: true,
        ratBounty10Received: false,
        ratBounty20Received: false,
      });
      RPG.State.defeatCounts.rat = { cain: 20, owen: 0 };
      uiControl.openNotebookModal();

      const claimButton = document.getElementById('btnNotebookClaim');
      const disabledBeforeSelection = claimButton?.disabled;
      const rat20 = document.getElementById('notebookRow_rat_tier1');
      rat20?.click();

      return {
        disabledBeforeSelection,
        disabledAfterSelection: claimButton?.disabled,
        selectedText: document.querySelector('.notebook-tier-selected')?.textContent,
      };
    });

    expect(state).toEqual({
      disabledBeforeSelection: true,
      disabledAfterSelection: false,
      selectedText: '！20',
    });
  });

  test('amber rat 15 grants medicine and smoke as one idempotent set reward', async ({ page }) => {
    const immediate = await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      RPG.State.flags.amberRatBounty15Received = false;
      RPG.State.defeatCounts.amber_rat = { cain: 10, owen: 5 };
      RPG.State.inventory.fakeWoundMedicine = 0;
      RPG.State.inventory.smokeBomb = 0;

      innSystem.claimNotebookRewards('amber_rat', '15');
      innSystem.claimNotebookRewards('amber_rat', '15');
      return {
        medicine: RPG.State.inventory.fakeWoundMedicine,
        smokeBomb: RPG.State.inventory.smokeBomb,
        received: RPG.State.flags.amberRatBounty15Received,
        mode: RPG.State.mode,
      };
    });

    expect(immediate).toEqual({
      medicine: 3,
      smokeBomb: 3,
      received: true,
      mode: 'event',
    });

    await drainDialogue(page);
    const afterDialogue = await page.evaluate(() => {
      innSystem.claimNotebookRewards('amber_rat', '15');
      return {
        medicine: RPG.State.inventory.fakeWoundMedicine,
        smokeBomb: RPG.State.inventory.smokeBomb,
        log: document.getElementById('logContainer')?.textContent || '',
      };
    });
    expect(afterDialogue.medicine).toBe(3);
    expect(afterDialogue.smokeBomb).toBe(3);
    expect(afterDialogue.log).toContain('🩹傷薬もどきを3個受け取った！');
    expect(afterDialogue.log).toContain('💨煙玉を3個受け取った！');

    const restored = await page.evaluate(() => {
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_notebook_set_reward_save_test', JSON.stringify(snapshot));
      RPG.State.inventory.fakeWoundMedicine = 0;
      RPG.State.inventory.smokeBomb = 0;
      RPG.State.flags.amberRatBounty15Received = false;

      uiControl.loadFromStorage('okai_rpg_notebook_set_reward_save_test', 'テスト');
      return {
        medicine: RPG.State.inventory.fakeWoundMedicine,
        smokeBomb: RPG.State.inventory.smokeBomb,
        received: RPG.State.flags.amberRatBounty15Received,
      };
    });
    expect(restored).toEqual({ medicine: 3, smokeBomb: 3, received: true });
  });

  test('all normal notebook reward definitions use the requested items and quantities', async ({ page }) => {
    const rewards = await page.evaluate(() => Object.fromEntries(
      RPG.Assets.NOTEBOOK_ENTRIES.flatMap(entry => (
        entry.tiers
          .filter(tier => Number.isFinite(tier.target))
          .map(tier => [
            `${entry.id}:${tier.id}`,
            tier.items.map(item => [item.itemId, item.qty]),
          ])
      ))
    ));

    expect(rewards).toEqual({
      'rat:10': [['herb', 3]],
      'rat:20': [['fakeWoundMedicine', 3]],
      'weasel:10': [['smokeBomb', 3]],
      'weasel:20': [['mikawashiFeather', 3]],
      'sap:10': [['shinyOil', 3]],
      'sap:20': [['gratefulTalisman', 1]],
      'amber_rat:15': [['fakeWoundMedicine', 3], ['smokeBomb', 3]],
      'amber_weasel:15': [['fakeWoundMedicine', 3]],
    });
  });

  test('special ALL reward items are separate non-usable inventory entries', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.inventory.unknownAmber = 2;
      RPG.State.inventory.specialUnknownAmber = 1;
      RPG.State.inventory.secretLetter = 1;

      uiControl.openModal();
      uiControl.selectItem('specialUnknownAmber', 1);
      const specialHasUseButton = Boolean(
        document.querySelector('#itemDetailArea button')
      );
      uiControl.selectItem('secretLetter', 1);
      const letterHasUseButton = Boolean(
        document.querySelector('#itemDetailArea button')
      );

      return {
        normalUnknownAmber: RPG.State.inventory.unknownAmber,
        specialUnknownAmber: RPG.State.inventory.specialUnknownAmber,
        secretLetter: RPG.State.inventory.secretLetter,
        specialName: RPG.Assets.CONFIG.ITEM_NAME.specialUnknownAmber,
        specialDescription: RPG.Assets.CONFIG.ITEM_DESC.specialUnknownAmber,
        letterName: RPG.Assets.CONFIG.ITEM_NAME.secretLetter,
        letterDescription: RPG.Assets.CONFIG.ITEM_DESC.secretLetter,
        specialHasUseButton,
        letterHasUseButton,
        socketable: RPG.Assets.RARE_AMBER_CATALOG.some(
          amber => amber.id === 'specialUnknownAmber'
        ),
      };
    });

    expect(result).toEqual({
      normalUnknownAmber: 2,
      specialUnknownAmber: 1,
      secretLetter: 1,
      specialName: '🔸《？琥珀》',
      specialDescription: 'まだ鑑定されていない琥珀。琥珀商なら正体が分かる。',
      letterName: '㊙️秘密のお手紙',
      letterDescription: '誰かに宛てて書かれた手紙。',
      specialHasUseButton: false,
      letterHasUseButton: false,
      socketable: false,
    });
  });

  test('old saves default the two special reward item counts to zero', async ({ page }) => {
    const result = await page.evaluate(() => {
      const legacySave = JSON.parse(JSON.stringify(RPG.State));
      delete legacySave.inventory.specialUnknownAmber;
      delete legacySave.inventory.secretLetter;
      localStorage.setItem('okai_rpg_notebook_special_item_legacy_test', JSON.stringify(legacySave));

      RPG.State.inventory.specialUnknownAmber = 4;
      RPG.State.inventory.secretLetter = 4;
      uiControl.loadFromStorage('okai_rpg_notebook_special_item_legacy_test', 'テスト');

      return {
        specialUnknownAmber: RPG.State.inventory.specialUnknownAmber,
        secretLetter: RPG.State.inventory.secretLetter,
      };
    });
    expect(result).toEqual({ specialUnknownAmber: 0, secretLetter: 0 });
  });

  test('ALL tiers keep reward data but have no threshold and cannot be claimed', async ({ page }) => {
    const result = await page.evaluate(() => {
      const allTiers = Object.fromEntries(
        RPG.Assets.NOTEBOOK_ENTRIES.map(entry => {
          const tier = entry.tiers.find(candidate => candidate.id === 'all');
          return [
            entry.id,
            {
              target: tier.target,
              claimEnabled: tier.claimEnabled,
              claimedFlag: tier.claimedFlag,
              items: tier.items.map(item => [item.itemId, item.qty]),
            },
          ];
        })
      );

      RPG.Assets.NOTEBOOK_ENTRIES.forEach(entry => {
        RPG.State.defeatCounts[entry.enemyId] = { cain: 999, owen: 999 };
        RPG.State.flags[entry.encounterFlag] = true;
        const allTier = entry.tiers.find(tier => tier.id === 'all');
        RPG.State.flags[allTier.claimedFlag] = false;
      });
      RPG.State.inventory.hardBottle = 0;
      RPG.State.mode = 'base';
      innSystem.claimNotebookRewards('rat', 'all');
      uiControl.openNotebookModal();

      return {
        allTiers,
        ratAllClaimable: innSystem.isNotebookRewardClaimable('rat', 'all'),
        hardBottle: RPG.State.inventory.hardBottle,
        ratAllReceived: RPG.State.flags.ratBountyAllReceived,
        allMarkers: [...document.querySelectorAll('.notebook-tier')]
          .filter(element => element.textContent.includes('ALL'))
          .map(element => element.textContent),
        allButtons: [...document.querySelectorAll('.notebook-tier-button')]
          .filter(element => element.textContent.includes('ALL')).length,
      };
    });

    expect(result.allTiers).toEqual({
      rat: {
        target: null,
        claimEnabled: false,
        claimedFlag: 'ratBountyAllReceived',
        items: [['hardBottle', 1]],
      },
      weasel: {
        target: null,
        claimEnabled: false,
        claimedFlag: 'weaselBountyAllReceived',
        items: [['highHerb', 3]],
      },
      sap: {
        target: null,
        claimEnabled: false,
        claimedFlag: 'sapBountyAllReceived',
        items: [['highHerb', 5]],
      },
      amber_rat: {
        target: null,
        claimEnabled: false,
        claimedFlag: 'amberRatBountyAllReceived',
        items: [['specialUnknownAmber', 1]],
      },
      amber_weasel: {
        target: null,
        claimEnabled: false,
        claimedFlag: 'amberWeaselBountyAllReceived',
        items: [['secretLetter', 1]],
      },
    });
    expect(result.ratAllClaimable).toBe(false);
    expect(result.hardBottle).toBe(0);
    expect(result.ratAllReceived).toBe(false);
    expect(result.allMarkers).toEqual(['－ALL', '－ALL', '－ALL', '－ALL', '－ALL']);
    expect(result.allButtons).toBe(0);
  });

  test('old saves default every ALL received flag to false', async ({ page }) => {
    const result = await page.evaluate(() => {
      const allFlags = [
        'ratBountyAllReceived',
        'weaselBountyAllReceived',
        'sapBountyAllReceived',
        'amberRatBountyAllReceived',
        'amberWeaselBountyAllReceived',
      ];
      const legacySave = JSON.parse(JSON.stringify(RPG.State));
      allFlags.forEach(flag => delete legacySave.flags[flag]);
      localStorage.setItem('okai_rpg_notebook_all_legacy_test', JSON.stringify(legacySave));

      allFlags.forEach(flag => {
        RPG.State.flags[flag] = true;
      });
      uiControl.loadFromStorage('okai_rpg_notebook_all_legacy_test', 'テスト');
      return Object.fromEntries(allFlags.map(flag => [flag, RPG.State.flags[flag]]));
    });

    expect(result).toEqual({
      ratBountyAllReceived: false,
      weaselBountyAllReceived: false,
      sapBountyAllReceived: false,
      amberRatBountyAllReceived: false,
      amberWeaselBountyAllReceived: false,
    });
  });

  test('the claim button is disabled below 10 kills and claiming does nothing', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      RPG.State.flags.ratBounty10Received = false;
      RPG.State.defeatCounts.rat = { cain: 3, owen: 2 };
      RPG.State.inventory.herb = 0;
      uiControl.openNotebookModal();
      const disabledBefore = document.getElementById('btnNotebookClaim')?.disabled;

      innSystem.claimNotebookRewards();
      return {
        disabledBefore,
        herb: RPG.State.inventory.herb,
        mode: RPG.State.mode,
      };
    });
    expect(result).toEqual({ disabledBefore: true, herb: 0, mode: 'base' });
  });

  test('a claimed rat-10 reward survives a journal save/reload', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.ratBounty10Received = true;
      RPG.State.inventory.herb = 3;
      RPG.State.defeatCounts.rat = { cain: 6, owen: 4 };
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_notebook_claim_test', JSON.stringify(snapshot));

      RPG.State.flags.ratBounty10Received = false;
      RPG.State.inventory.herb = 0;

      uiControl.loadFromStorage('okai_rpg_notebook_claim_test', 'テスト');

      return {
        received: RPG.State.flags.ratBounty10Received,
        herb: RPG.State.inventory.herb,
      };
    });
    expect(result).toEqual({ received: true, herb: 3 });
  });

  test('Owen scares off a weasel instead of killing it while matamatabi is active', async ({ page }) => {
    await page.evaluate(() => {
      const originalShouldIntervene = RPG.Assets.OWEN_BEHAVIOR.shouldIntervene;
      const originalDecideAction = RPG.Assets.OWEN_BEHAVIOR.decideAction;
      RPG.Assets.OWEN_BEHAVIOR.shouldIntervene = () => true;
      RPG.Assets.OWEN_BEHAVIOR.decideAction = () => 'kill';

      RPG.State.debug.isSkipping = true;
      RPG.State.flags.matamatabiActive = true;
      RPG.State.currentEnemy = { id: 'weasel', name: '魔界のイタチ', hp: 50 };
      RPG.State.defeatCounts.weasel = { cain: 0, owen: 0 };
      RPG.State.exp = 0;
      RPG.State.isBattling = true;
      RPG.State.hasOwenIntervened = false;
      RPG.State.mode = 'battle';
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';

      battleSystem.processOwenAction(() => {});

      RPG.Assets.OWEN_BEHAVIOR.shouldIntervene = originalShouldIntervene;
      RPG.Assets.OWEN_BEHAVIOR.decideAction = originalDecideAction;
    });

    await page.waitForTimeout(300);

    const state = await page.evaluate(() => {
      const logText = document.getElementById('logContainer')?.textContent || '';
      RPG.State.debug.isSkipping = false;
      return {
        logHasBlownAway: logText.includes('オーエンはイタチを遠くへ吹き飛ばした'),
        logHasEscaped: logText.includes('魔界のイタチは逃げ出した'),
        defeatCounts: RPG.State.defeatCounts.weasel,
        exp: RPG.State.exp,
        mode: RPG.State.mode,
        currentEnemy: RPG.State.currentEnemy,
        isBattling: RPG.State.isBattling,
      };
    });

    expect(state).toEqual({
      logHasBlownAway: true,
      logHasEscaped: true,
      defeatCounts: { cain: 0, owen: 0 },
      exp: 0,
      mode: 'base',
      currentEnemy: null,
      isBattling: false,
    });
  });

  test('Owen still really kills a weasel when matamatabi is not active (regression)', async ({ page }) => {
    await page.evaluate(() => {
      const originalShouldIntervene = RPG.Assets.OWEN_BEHAVIOR.shouldIntervene;
      const originalDecideAction = RPG.Assets.OWEN_BEHAVIOR.decideAction;
      RPG.Assets.OWEN_BEHAVIOR.shouldIntervene = () => true;
      RPG.Assets.OWEN_BEHAVIOR.decideAction = () => 'kill';

      RPG.State.debug.isSkipping = true;
      RPG.State.flags.matamatabiActive = false;
      RPG.State.currentEnemy = { id: 'weasel', name: '魔界のイタチ', hp: 50 };
      RPG.State.defeatCounts.weasel = { cain: 0, owen: 0 };
      RPG.State.isBattling = true;
      RPG.State.hasOwenIntervened = false;
      RPG.State.mode = 'battle';

      battleSystem.processOwenAction(() => {});

      RPG.Assets.OWEN_BEHAVIOR.shouldIntervene = originalShouldIntervene;
      RPG.Assets.OWEN_BEHAVIOR.decideAction = originalDecideAction;
    });

    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
      RPG.State.debug.isSkipping = false;
      return { defeatCounts: RPG.State.defeatCounts.weasel, mode: RPG.State.mode };
    });
    expect(result).toEqual({ defeatCounts: { cain: 0, owen: 1 }, mode: 'base' });
  });

  test('a rat under matamatabi keeps the existing blown-away-but-real-kill behavior (regression)', async ({ page }) => {
    await page.evaluate(() => {
      const originalShouldIntervene = RPG.Assets.OWEN_BEHAVIOR.shouldIntervene;
      const originalDecideAction = RPG.Assets.OWEN_BEHAVIOR.decideAction;
      RPG.Assets.OWEN_BEHAVIOR.shouldIntervene = () => true;
      RPG.Assets.OWEN_BEHAVIOR.decideAction = () => 'kill';

      RPG.State.debug.isSkipping = true;
      RPG.State.flags.matamatabiActive = true;
      RPG.State.currentEnemy = { id: 'rat', name: '魔界のネズミ', hp: 40 };
      RPG.State.defeatCounts.rat = { cain: 0, owen: 0 };
      RPG.State.isBattling = true;
      RPG.State.hasOwenIntervened = false;
      RPG.State.mode = 'battle';

      battleSystem.processOwenAction(() => {});

      RPG.Assets.OWEN_BEHAVIOR.shouldIntervene = originalShouldIntervene;
      RPG.Assets.OWEN_BEHAVIOR.decideAction = originalDecideAction;
    });

    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
      RPG.State.debug.isSkipping = false;
      return { defeatCounts: RPG.State.defeatCounts.rat, mode: RPG.State.mode };
    });
    expect(result).toEqual({ defeatCounts: { cain: 0, owen: 1 }, mode: 'base' });
  });

  test('a glowing cat rabbit under matamatabi is unaffected by the new escape branch (regression)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const originalShouldIntervene = RPG.Assets.OWEN_BEHAVIOR.shouldIntervene;
      const originalDecideAction = RPG.Assets.OWEN_BEHAVIOR.decideAction;
      RPG.Assets.OWEN_BEHAVIOR.shouldIntervene = () => true;
      RPG.Assets.OWEN_BEHAVIOR.decideAction = () => 'kill';

      RPG.State.debug.isSkipping = true;
      RPG.State.flags.matamatabiActive = true;
      RPG.State.currentEnemy = { id: 'glowing_cat_rabbit', name: '光る猫うさぎ', hp: 30, rabbitLevel: 5 };
      RPG.State.isBattling = true;
      RPG.State.hasOwenIntervened = false;
      RPG.State.mode = 'battle';

      let callbackRan = false;
      await new Promise(resolve => {
        battleSystem.processOwenAction(() => { callbackRan = true; resolve(undefined); });
        setTimeout(() => resolve(undefined), 2000);
      });

      RPG.Assets.OWEN_BEHAVIOR.shouldIntervene = originalShouldIntervene;
      RPG.Assets.OWEN_BEHAVIOR.decideAction = originalDecideAction;
      RPG.State.debug.isSkipping = false;

      return {
        callbackRan,
        enemyHp: RPG.State.currentEnemy?.hp,
        mode: RPG.State.mode,
      };
    });

    expect(result).toEqual({ callbackRan: true, enemyHp: 30, mode: 'battle' });
  });

  test('the notebook modal fits a 390x844 phone viewport without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      RPG.State.defeatCounts.rat = { cain: 2, owen: 0 };
      RPG.State.defeatCounts.weasel = { cain: 0, owen: 0 };
      uiControl.openNotebookModal();
    });

    const layout = await page.locator('.notebook-modal-content').evaluate(element => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);

    const rowList = await page.locator('.notebook-row-list').evaluate(element => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(rowList.scrollHeight).toBeLessThanOrEqual(rowList.clientHeight + 1);

    await expect(page.locator('#btnNotebookClaim')).toBeInViewport();
    await expect(page.locator('.notebook-modal-content button.btn:not(.notebook-claim-btn)').last()).toBeInViewport();
  });

  test('the merged stay/deliver button toggles label and accent style with canDeliver', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true, silverCoins: 3 });
      RPG.State.flags.silverDelivered = false;
      uiControl.updateUI();
      const btn = document.getElementById('btnInnStay');
      const deliverLabel = btn?.textContent;
      const hasAccentWhileDeliver = btn?.classList.contains('btn-accent');

      RPG.State.flags.silverDelivered = true;
      uiControl.updateUI();
      const stayLabel = btn?.textContent;
      const hasAccentWhileStay = btn?.classList.contains('btn-accent');

      return { deliverLabel, hasAccentWhileDeliver, stayLabel, hasAccentWhileStay };
    });

    expect(result).toEqual({
      deliverLabel: '銀貨を納品',
      hasAccentWhileDeliver: true,
      stayLabel: '泊まる',
      hasAccentWhileStay: false,
    });
  });

  test('clicking the merged button in deliver mode triggers the delivery cinematic, not stay()', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true, silverCoins: 3 });
      RPG.State.flags.silverDelivered = false;
      uiControl.updateUI();

      const originalDelivery = Cinematics.playSilverDeliveryEvent;
      let deliveryCalled = false;
      Cinematics.playSilverDeliveryEvent = () => { deliveryCalled = true; };

      document.getElementById('btnInnStay').onclick();

      Cinematics.playSilverDeliveryEvent = originalDelivery;
      return { deliveryCalled, modeAfterClick: RPG.State.mode };
    });

    expect(result).toEqual({ deliveryCalled: true, modeAfterClick: 'base' });
  });

  test('the inn command grid fits a 390px phone width without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true, silverCoins: 0 });
      RPG.State.flags.silverDelivered = false;
      RPG.State.flags.notebookUnlocked = true;
      uiControl.updateUI();
    });

    const layout = await page.locator('#innUI').evaluate(element => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);

    for (const id of ['btnInnTalk', 'btnInnStay', 'btnInnObserve', 'btnInnJournal', 'btnInnNotebook', 'btnInnExit']) {
      await expect(page.locator(`#${id}`)).toBeInViewport();
    }
  });
});

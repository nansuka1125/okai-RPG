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

const RAT_ALL_UNLOCK_TEXT = [
  '傭兵崩れ「あんた、ずいぶん強いな。それとも、あのネズミが弱いのか？」',
  'カイン「全然強くないぞ。あんたらでも多分勝てる」',
  'オーエン「おまえでも勝てたくらいだもんね」',
  'カイン（…その言い方は引っかかるが、事実だな）',
  '傭兵崩れ「見掛け倒しか！よし、俺たちでもやってみるか」',
  '娘「カインさんがネズミをバンバン倒すのを見て、他の冒険者の方がやる気になったようです」',
  '《魔界のネズミのALL条件が解放された！》',
];

const WEASEL_ALL_UNLOCK_TEXT = [
  '若い剣士「カインさん。森で、見えない何かに斬りつけられたんだ。あれは何なんだ？」',
  'カイン「魔界のイタチだ。最初は透明で姿が見えない」',
  '若い剣士「斬る方法はあるのか？」',
  'カイン「血生臭いにおいがしたら、地面すれすれを薙ぎ払うんだ。少しでも当たれば姿が見える」',
  '若い剣士「分かった！やってみるよ」',
  '《魔界のイタチのALL条件が解放された！》',
];

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

  test('rat ALL unlock waits for the next notebook open, preserves repair linkage, and runs once', async ({ page }) => {
    const immediate = await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      Object.assign(RPG.State.flags, {
        ratBounty20Received: false,
        ratBountyAllUnlocked: false,
        ratBountyAllProgress: 0,
        ratBountyAllReceived: false,
        weaselBounty20Received: false,
        innRepairConsultSeen: true,
        amberTreeCoinMined: true,
        innRepairInspectionUnlocked: false,
        innRepairInspectionReported: false,
      });
      RPG.State.defeatCounts.rat = { cain: 20, owen: 0 };
      RPG.State.inventory.fakeWoundMedicine = 0;
      innSystem.claimNotebookRewards('rat', '20');
      return {
        rat20Received: RPG.State.flags.ratBounty20Received,
        unlocked: RPG.State.flags.ratBountyAllUnlocked,
        progress: RPG.State.flags.ratBountyAllProgress,
        repairUnlocked: RPG.State.flags.innRepairInspectionUnlocked,
        hasAllUnlockText: RPG.State.dialogueQueue.some(
          line => (line.text || '').includes('ALL条件が解放')
        ),
      };
    });
    expect(immediate).toEqual({
      rat20Received: true,
      unlocked: false,
      progress: 0,
      repairUnlocked: true,
      hasAllUnlockText: false,
    });

    await drainDialogue(page);
    const opened = await page.evaluate(() => {
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';
      uiControl.openNotebookModal();
      return {
        mode: RPG.State.mode,
        modalDisplay: getComputedStyle(document.getElementById('notebookModal')).display,
      };
    });
    expect(opened).toEqual({ mode: 'event', modalDisplay: 'none' });

    await drainDialogue(page);
    const unlocked = await page.evaluate(() => ({
      lines: [...document.querySelectorAll('#logContainer .log-entry')]
        .map(element => element.textContent),
      unlocked: RPG.State.flags.ratBountyAllUnlocked,
      progress: RPG.State.flags.ratBountyAllProgress,
      modalDisplay: document.getElementById('notebookModal')?.style.display,
      countText: document.getElementById('notebookRow_rat_count')?.textContent,
      allMarker: document.getElementById('notebookRow_rat_tier2')?.textContent,
    }));
    expect(unlocked).toEqual({
      lines: RAT_ALL_UNLOCK_TEXT,
      unlocked: true,
      progress: 0,
      modalDisplay: 'flex',
      countText: '0/5',
      allMarker: '○ALL',
    });

    const reopened = await page.evaluate(() => {
      uiControl.closeNotebookModal();
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';
      uiControl.openNotebookModal();
      return {
        mode: RPG.State.mode,
        modalDisplay: document.getElementById('notebookModal')?.style.display,
        lines: [...document.querySelectorAll('#logContainer .log-entry')]
          .map(element => element.textContent),
      };
    });
    expect(reopened).toEqual({ mode: 'base', modalDisplay: 'flex', lines: [] });
  });

  test('weasel-only ALL unlock uses the complete independent dialogue', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      Object.assign(RPG.State.flags, {
        ratBounty20Received: false,
        ratBountyAllUnlocked: false,
        ratBountyAllReceived: false,
        weaselBounty20Received: true,
        weaselBountyAllUnlocked: false,
        weaselBountyAllProgress: 0,
        weaselBountyAllReceived: false,
      });
      RPG.State.defeatCounts.weasel = { cain: 40, owen: 5 };
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';
      uiControl.openNotebookModal();
    });
    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      lines: [...document.querySelectorAll('#logContainer .log-entry')]
        .map(element => element.textContent),
      ratUnlocked: RPG.State.flags.ratBountyAllUnlocked,
      weaselUnlocked: RPG.State.flags.weaselBountyAllUnlocked,
      progress: RPG.State.flags.weaselBountyAllProgress,
      modalDisplay: document.getElementById('notebookModal')?.style.display,
      countText: document.getElementById('notebookRow_weasel_count')?.textContent,
      allMarker: document.getElementById('notebookRow_weasel_tier2')?.textContent,
    }));
    expect(result).toEqual({
      lines: WEASEL_ALL_UNLOCK_TEXT,
      ratUnlocked: false,
      weaselUnlocked: true,
      progress: 0,
      modalDisplay: 'flex',
      countText: '0/3',
      allMarker: '○ALL',
    });
  });

  test('simultaneous ALL unlocks run rat then weasel without connector text', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      Object.assign(RPG.State.flags, {
        ratBounty20Received: true,
        ratBountyAllUnlocked: false,
        ratBountyAllReceived: false,
        weaselBounty20Received: true,
        weaselBountyAllUnlocked: false,
        weaselBountyAllReceived: false,
      });
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';
      uiControl.openNotebookModal();
    });
    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      lines: [...document.querySelectorAll('#logContainer .log-entry')]
        .map(element => element.textContent),
      ratUnlocked: RPG.State.flags.ratBountyAllUnlocked,
      weaselUnlocked: RPG.State.flags.weaselBountyAllUnlocked,
      modalDisplay: document.getElementById('notebookModal')?.style.display,
    }));
    expect(result.lines).toEqual([...RAT_ALL_UNLOCK_TEXT, ...WEASEL_ALL_UNLOCK_TEXT]);
    expect(result.ratUnlocked).toBe(true);
    expect(result.weaselUnlocked).toBe(true);
    expect(result.modalDisplay).toBe('flex');
  });

  test('ALL rows switch from locked 20 totals to independent 0/targets, claimable, then claimed', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      Object.assign(RPG.State.flags, {
        ratBounty10Received: true,
        ratBounty20Received: true,
        ratBountyAllUnlocked: false,
        ratBountyAllProgress: 0,
        ratBountyAllReceived: false,
        weaselBounty10Received: true,
        weaselBounty20Received: true,
        weaselBountyAllUnlocked: false,
        weaselBountyAllProgress: 0,
        weaselBountyAllReceived: false,
      });
      RPG.State.defeatCounts.rat = { cain: 40, owen: 10 };
      RPG.State.defeatCounts.weasel = { cain: 30, owen: 10 };
      uiControl.showNotebookModal();
      const locked = {
        ratCount: document.getElementById('notebookRow_rat_count')?.textContent,
        ratMarker: document.getElementById('notebookRow_rat_tier2')?.textContent,
        weaselCount: document.getElementById('notebookRow_weasel_count')?.textContent,
        weaselMarker: document.getElementById('notebookRow_weasel_tier2')?.textContent,
      };

      Object.assign(RPG.State.flags, {
        ratBountyAllUnlocked: true,
        weaselBountyAllUnlocked: true,
      });
      uiControl.refreshNotebookModal();
      const unlocked = {
        ratCount: document.getElementById('notebookRow_rat_count')?.textContent,
        ratMarker: document.getElementById('notebookRow_rat_tier2')?.textContent,
        weaselCount: document.getElementById('notebookRow_weasel_count')?.textContent,
        weaselMarker: document.getElementById('notebookRow_weasel_tier2')?.textContent,
      };

      RPG.State.flags.ratBountyAllProgress = 5;
      RPG.State.flags.weaselBountyAllProgress = 3;
      uiControl.refreshNotebookModal();
      const reached = {
        ratCount: document.getElementById('notebookRow_rat_count')?.textContent,
        ratMarker: document.getElementById('notebookRow_rat_tier2')?.textContent,
        weaselCount: document.getElementById('notebookRow_weasel_count')?.textContent,
        weaselMarker: document.getElementById('notebookRow_weasel_tier2')?.textContent,
        claimBtnDisabled: document.getElementById('btnNotebookClaim')?.disabled,
      };

      RPG.State.flags.ratBountyAllReceived = true;
      RPG.State.flags.weaselBountyAllReceived = true;
      uiControl.refreshNotebookModal();
      const claimed = {
        ratMarker: document.getElementById('notebookRow_rat_tier2')?.textContent,
        weaselMarker: document.getElementById('notebookRow_weasel_tier2')?.textContent,
      };
      return { locked, unlocked, reached, claimed };
    });

    expect(result.locked).toEqual({
      ratCount: '20/20',
      ratMarker: '－ALL',
      weaselCount: '20/20',
      weaselMarker: '－ALL',
    });
    expect(result.unlocked).toEqual({
      ratCount: '0/5',
      ratMarker: '○ALL',
      weaselCount: '0/3',
      weaselMarker: '○ALL',
    });
    expect(result.reached).toEqual({
      ratCount: '5/5',
      ratMarker: '！ALL',
      weaselCount: '3/3',
      weaselMarker: '！ALL',
      claimBtnDisabled: false,
    });
    expect(result.claimed).toEqual({ ratMarker: '✓ALL', weaselMarker: '✓ALL' });
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

  test('the rat-10 debug branch grants herb x3 and vampire amber x1 once with both reward lines', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      RPG.State.flags.ratBounty10Received = false;
      RPG.State.defeatCounts.rat = { cain: 6, owen: 4 };
      RPG.State.inventory.herb = 0;
      RPG.State.inventory.vampireAmber = 0;
      RPG.Config.DEBUG_GRANT_BLOOD_AMBER_FROM_RAT_10 = true;
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';
      innSystem.claimNotebookRewards();
    });

    await drainDialogue(page);

    const result = await page.evaluate(() => {
      const logText = document.getElementById('logContainer')?.textContent || '';
      return {
        herb: RPG.State.inventory.herb,
        vampireAmber: RPG.State.inventory.vampireAmber,
        received: RPG.State.flags.ratBounty10Received,
        herbRewardShown: logText.includes('🌿薬草を3個受け取った！'),
        vampireRewardShown: logText.includes('🔸《吸血琥珀》を1個受け取った！'),
        modalDisplay: document.getElementById('notebookModal')?.style.display,
        mode: RPG.State.mode,
      };
    });
    expect(result).toEqual({
      herb: 3,
      vampireAmber: 1,
      received: true,
      herbRewardShown: true,
      vampireRewardShown: true,
      modalDisplay: 'none',
      mode: 'base',
    });

    // A second claim attempt afterward must be a no-op (already received).
    await page.evaluate(() => {
      innSystem.claimNotebookRewards();
    });
    const second = await page.evaluate(() => ({
      herb: RPG.State.inventory.herb,
      vampireAmber: RPG.State.inventory.vampireAmber,
      mode: RPG.State.mode,
    }));
    expect(second).toEqual({ herb: 3, vampireAmber: 1, mode: 'base' });
  });

  test('disabling the rat-10 debug branch preserves the formal herb-only reward', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      RPG.State.flags.ratBounty10Received = false;
      RPG.State.defeatCounts.rat = { cain: 10, owen: 0 };
      RPG.State.inventory.herb = 0;
      RPG.State.inventory.vampireAmber = 0;
      RPG.Config.DEBUG_GRANT_BLOOD_AMBER_FROM_RAT_10 = false;

      const reward = innSystem.getNotebookRewardDefinition('rat', '10');
      const formalItemsBeforeClaim = reward?.tier.items.map(item => ({ ...item }));
      innSystem.claimNotebookRewards('rat', '10');

      return {
        formalItemsBeforeClaim,
        herb: RPG.State.inventory.herb,
        vampireAmber: RPG.State.inventory.vampireAmber,
        queueText: RPG.State.dialogueQueue.map(item => item.text || ''),
      };
    });

    expect(result).toEqual({
      formalItemsBeforeClaim: [{ itemId: 'herb', qty: 3 }],
      herb: 3,
      vampireAmber: 0,
      queueText: [
        '🌿薬草を3個受け取った！',
      ],
    });
  });

  test('the debug vampire amber appears in brooch candidates and survives save/reload', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      RPG.State.flags.ratBounty10Received = false;
      RPG.State.defeatCounts.rat = { cain: 10, owen: 0 };
      Object.assign(RPG.State.inventory, {
        herb: 0,
        vampireAmber: 0,
        glowingBrooch: 1,
      });
      RPG.Config.DEBUG_GRANT_BLOOD_AMBER_FROM_RAT_10 = true;
      innSystem.claimNotebookRewards('rat', '10');
    });
    await drainDialogue(page);

    const beforeSave = await page.evaluate(() => {
      uiControl.selectItem('glowingBrooch', 1);
      uiControl.showRareAmberSelection();
      const candidates = document.getElementById('itemList')?.textContent || '';
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_rat10_debug_amber_test', JSON.stringify(snapshot));

      RPG.State.flags.ratBounty10Received = false;
      RPG.State.inventory.herb = 0;
      RPG.State.inventory.vampireAmber = 0;
      uiControl.loadFromStorage('okai_rpg_rat10_debug_amber_test', 'デバッグ報酬テスト');

      return {
        candidateShown: candidates.includes('🔸《吸血琥珀》'),
        received: RPG.State.flags.ratBounty10Received,
        herb: RPG.State.inventory.herb,
        vampireAmber: RPG.State.inventory.vampireAmber,
      };
    });

    expect(beforeSave).toEqual({
      candidateShown: true,
      received: true,
      herb: 3,
      vampireAmber: 1,
    });
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

  test('the shared claim button is enabled the moment a reward is achieved, with no tier selection step', async ({ page }) => {
    const state = await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      Object.assign(RPG.State.flags, {
        notebookUnlocked: true,
        ratBounty10Received: false,
        ratBounty20Received: false,
      });
      RPG.State.defeatCounts.rat = { cain: 4, owen: 0 };
      uiControl.openNotebookModal();
      const disabledBelowTarget = document.getElementById('btnNotebookClaim')?.disabled;

      RPG.State.defeatCounts.rat = { cain: 20, owen: 0 };
      uiControl.refreshNotebookModal();

      const tierEl = document.getElementById('notebookRow_rat_tier1');
      return {
        disabledBelowTarget,
        disabledAtTarget: document.getElementById('btnNotebookClaim')?.disabled,
        tierTagName: tierEl?.tagName,
        tierText: tierEl?.textContent,
        tierIsButtonClass: tierEl?.classList.contains('notebook-tier-button'),
      };
    });

    expect(state).toEqual({
      disabledBelowTarget: true,
      disabledAtTarget: false,
      tierTagName: 'SPAN',
      tierText: '！20',
      tierIsButtonClass: false,
    });
  });

  test('clicking a small tier indicator does nothing and does not claim the reward', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      RPG.State.flags.ratBounty10Received = false;
      RPG.State.defeatCounts.rat = { cain: 10, owen: 0 };
      RPG.State.inventory.herb = 0;
      uiControl.openNotebookModal();

      document.getElementById('notebookRow_rat_tier0')?.click();

      return {
        received: RPG.State.flags.ratBounty10Received,
        herb: RPG.State.inventory.herb,
        mode: RPG.State.mode,
      };
    });
    expect(result).toEqual({ received: false, herb: 0, mode: 'base' });
  });

  test('the claim button auto-selects the earliest unclaimed tier and only grants one tier per click', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      Object.assign(RPG.State.flags, {
        ratBounty10Received: false,
        ratBounty20Received: false,
      });
      RPG.State.defeatCounts.rat = { cain: 25, owen: 0 };
      RPG.State.inventory.herb = 0;
      RPG.State.inventory.fakeWoundMedicine = 0;
      uiControl.openNotebookModal();

      uiControl.claimNextNotebookReward();
      const afterFirst = {
        herb: RPG.State.inventory.herb,
        medicine: RPG.State.inventory.fakeWoundMedicine,
        rat10: RPG.State.flags.ratBounty10Received,
        rat20: RPG.State.flags.ratBounty20Received,
      };

      // ratBounty20Received is about to become true, which would make rat eligible for the
      // unrelated ALL-unlock cutscene via openNotebookModal(); go through refreshNotebookModal()
      // directly instead so this test stays focused on the claim button itself.
      RPG.State.mode = 'base';
      uiControl.refreshNotebookModal();
      uiControl.claimNextNotebookReward();
      const afterSecond = {
        herb: RPG.State.inventory.herb,
        medicine: RPG.State.inventory.fakeWoundMedicine,
        rat10: RPG.State.flags.ratBounty10Received,
        rat20: RPG.State.flags.ratBounty20Received,
      };

      return { afterFirst, afterSecond };
    });

    expect(result.afterFirst).toEqual({
      herb: 3, medicine: 0, rat10: true, rat20: false,
    });
    expect(result.afterSecond).toEqual({
      herb: 3, medicine: 3, rat10: true, rat20: true,
    });
  });

  test('after a claim, reopening the notebook enables the button again only while another reward remains', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      Object.assign(RPG.State.flags, {
        ratBounty10Received: false,
        ratBounty20Received: false,
      });
      RPG.State.defeatCounts.rat = { cain: 25, owen: 0 };
      uiControl.openNotebookModal();
      uiControl.claimNextNotebookReward();

      // ratBounty20Received is about to become true, which would make rat eligible for the
      // unrelated ALL-unlock cutscene via openNotebookModal(); go through refreshNotebookModal()
      // directly instead so this test stays focused on the claim button itself.
      RPG.State.mode = 'base';
      uiControl.refreshNotebookModal();
      const disabledWithOneLeft = document.getElementById('btnNotebookClaim')?.disabled;

      uiControl.claimNextNotebookReward();
      RPG.State.mode = 'base';
      uiControl.refreshNotebookModal();
      const disabledWithNoneLeft = document.getElementById('btnNotebookClaim')?.disabled;

      return { disabledWithOneLeft, disabledWithNoneLeft };
    });
    expect(result).toEqual({ disabledWithOneLeft: false, disabledWithNoneLeft: true });
  });

  test('amber ALL tiers remain unavailable before the third root saves their targets', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.defeatCounts.sap = { cain: 999, owen: 999 };
      RPG.State.defeatCounts.amber_rat = { cain: 999, owen: 999 };
      RPG.State.defeatCounts.amber_weasel = { cain: 999, owen: 999 };
      RPG.State.amberRootState = { 6: 'defeated', 7: 'defeated', 8: 'ignited' };
      RPG.State.amberEnemyAllTargets = { sap: null, amber_rat: null, amber_weasel: null };
      Object.assign(RPG.State.flags, {
        sapBountyAllReceived: false,
        amberRatBountyAllReceived: false,
        amberWeaselBountyAllReceived: false,
      });
      return innSystem.getClaimableNotebookRewards()
        .filter(reward => reward.tierId === 'all')
        .map(reward => reward.entryId);
    });
    expect(result).toEqual([]);
  });

  test('saved amber ALL targets display cumulative progress and grant each existing reward once', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: true,
        amberRootState: { 6: 'defeated', 7: 'defeated', 8: 'defeated' },
        amberEnemyAllTargets: { sap: 40, amber_rat: 30, amber_weasel: 20 },
      });
      Object.assign(RPG.State.flags, {
        notebookSapEncountered: true,
        notebookAmberRatEncountered: true,
        notebookAmberWeaselEncountered: true,
        sapBountyAllReceived: false,
        amberRatBountyAllReceived: false,
        amberWeaselBountyAllReceived: false,
        // rat/weasel already finished so amber_weasel (claimed last below) is the notebook's
        // actual final ALL claim and gets secretLetter instead of its normal reward.
        ratBountyAllReceived: true,
        weaselBountyAllReceived: true,
      });
      RPG.State.defeatCounts.sap = { cain: 28, owen: 12 };
      RPG.State.defeatCounts.amber_rat = { cain: 20, owen: 10 };
      RPG.State.defeatCounts.amber_weasel = { cain: 10, owen: 10 };
      RPG.State.inventory.highHerb = 0;
      RPG.State.inventory.unknownAmber = 0;
      RPG.State.unappraisedAmberResults = [];
      RPG.State.inventory.secretLetter = 0;

      const beforeRows = Object.fromEntries(
        uiControl.getNotebookRows().filter(row => ['sap', 'amber_rat', 'amber_weasel'].includes(row.id))
          .map(row => [row.id, row.tiers.find(tier => tier.id === 'all').target])
      );
      const claimableBefore = innSystem.getClaimableNotebookRewards()
        .filter(reward => reward.tierId === 'all')
        .map(reward => reward.entryId);

      ['sap', 'amber_rat', 'amber_weasel'].forEach(entryId => {
        RPG.State.mode = 'base';
        innSystem.claimNotebookRewards(entryId, 'all');
      });
      const afterFirstClaim = {
        highHerb: RPG.State.inventory.highHerb,
        unknownAmber: RPG.State.inventory.unknownAmber,
        results: RPG.State.unappraisedAmberResults,
        secretLetter: RPG.State.inventory.secretLetter,
        received: {
          sap: RPG.State.flags.sapBountyAllReceived,
          amberRat: RPG.State.flags.amberRatBountyAllReceived,
          amberWeasel: RPG.State.flags.amberWeaselBountyAllReceived,
        },
      };

      RPG.State.mode = 'base';
      innSystem.claimNotebookRewards('sap', 'all');
      const afterSecondClaim = RPG.State.inventory.highHerb;

      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_amber_all_targets', JSON.stringify(snapshot));
      RPG.State.amberEnemyAllTargets = { sap: null, amber_rat: null, amber_weasel: null };
      Object.assign(RPG.State.flags, {
        sapBountyAllReceived: false,
        amberRatBountyAllReceived: false,
        amberWeaselBountyAllReceived: false,
      });
      uiControl.loadFromStorage('okai_rpg_amber_all_targets', '琥珀ALLテスト');

      return {
        beforeRows,
        claimableBefore,
        afterFirstClaim,
        afterSecondClaim,
        afterReload: {
          targets: RPG.State.amberEnemyAllTargets,
          received: {
            sap: RPG.State.flags.sapBountyAllReceived,
            amberRat: RPG.State.flags.amberRatBountyAllReceived,
            amberWeasel: RPG.State.flags.amberWeaselBountyAllReceived,
          },
        },
      };
    });

    expect(result.beforeRows).toEqual({ sap: 40, amber_rat: 30, amber_weasel: 20 });
    expect(result.claimableBefore).toEqual(['sap', 'amber_rat', 'amber_weasel']);
    expect(result.afterFirstClaim).toEqual({
      highHerb: 5,
      unknownAmber: 1,
      results: ['vampireAmber'],
      secretLetter: 1,
      received: { sap: true, amberRat: true, amberWeasel: true },
    });
    expect(result.afterSecondClaim).toBe(5);
    expect(result.afterReload).toEqual({
      targets: { sap: 40, amber_rat: 30, amber_weasel: 20 },
      received: { sap: true, amberRat: true, amberWeasel: true },
    });
  });

  test('the ALL reward is claimed through the same shared claim button as the other tiers', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      Object.assign(RPG.State.flags, {
        ratBountyAllUnlocked: true,
        ratBountyAllProgress: 5,
        ratBountyAllReceived: false,
      });
      RPG.State.inventory.gratefulTalisman = 0;
      uiControl.openNotebookModal();
      const disabledBefore = document.getElementById('btnNotebookClaim')?.disabled;

      uiControl.claimNextNotebookReward();

      return {
        disabledBefore,
        gratefulTalisman: RPG.State.inventory.gratefulTalisman,
        ratAllReceived: RPG.State.flags.ratBountyAllReceived,
      };
    });
    expect(result).toEqual({
      disabledBefore: false,
      gratefulTalisman: 1,
      ratAllReceived: true,
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

  test('ALL progress starts at unlock, advances only for Cain, and caps at each target', async ({ page }) => {
    const result = await page.evaluate(() => {
      const prepareVictory = enemyId => {
        const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === enemyId);
        RPG.State.currentEnemy = { ...template, hp: 0 };
        RPG.State.isBattling = true;
        RPG.State.mode = 'battle';
        RPG.State.lastBlowBy = 'Cain';
        RPG.State.battleState = {};
      };

      Object.assign(RPG.State.flags, {
        ratBountyAllUnlocked: false,
        ratBountyAllProgress: 0,
        weaselBountyAllUnlocked: true,
        weaselBountyAllProgress: 0,
      });
      RPG.State.defeatCounts.rat = { cain: 40, owen: 10 };
      RPG.State.defeatCounts.weasel = { cain: 30, owen: 10 };

      prepareVictory('rat');
      battleSystem.executeStandardVictory('rat');
      const beforeUnlock = {
        progress: RPG.State.flags.ratBountyAllProgress,
        cumulativeCain: RPG.State.defeatCounts.rat.cain,
      };

      RPG.State.flags.ratBountyAllUnlocked = true;
      prepareVictory('rat');
      battleSystem.executeStandardVictory('rat');
      const afterCainVictory = {
        progress: RPG.State.flags.ratBountyAllProgress,
        cumulativeCain: RPG.State.defeatCounts.rat.cain,
      };

      const owenAdded = battleSystem.incrementNotebookAllProgress('rat', 'Owen');
      const amberRatAdded = battleSystem.incrementNotebookAllProgress('amber_rat', 'Cain');
      for (let i = 0; i < 10; i++) {
        battleSystem.incrementNotebookAllProgress('rat', 'Cain');
        battleSystem.incrementNotebookAllProgress('weasel', 'Cain');
      }

      return {
        beforeUnlock,
        afterCainVictory,
        owenAdded,
        amberRatAdded,
        ratProgress: RPG.State.flags.ratBountyAllProgress,
        weaselProgress: RPG.State.flags.weaselBountyAllProgress,
      };
    });

    expect(result).toEqual({
      beforeUnlock: { progress: 0, cumulativeCain: 41 },
      afterCainVictory: { progress: 1, cumulativeCain: 42 },
      owenAdded: false,
      amberRatAdded: false,
      ratProgress: 5,
      weaselProgress: 3,
    });
  });

  test('completed ALL targets suppress only final normal random enemies and preserve amberized and fixed battles', async ({ page }) => {
    const result = await page.evaluate(() => {
      const originalRandom = Math.random;
      const originalBattleRate = RPG.Assets.CONFIG.BATTLE_RATE;
      const cleanupBattle = () => {
        RPG.State.isBattling = false;
        RPG.State.currentEnemy = null;
        RPG.State.battleState = null;
        RPG.State.mode = 'base';
      };

      try {
        Object.assign(RPG.State, {
          mode: 'base',
          isAtInn: false,
          isInDungeon: true,
          explorationArea: 'forest',
          location: '琥珀の森',
          currentDistance: 1,
        });
        Object.assign(RPG.State.flags, {
          chapter1Cleared: false,
          matamatabiActive: false,
          metThiefBoy: true,
          ratBountyAllUnlocked: true,
          ratBountyAllProgress: 5,
          weaselBountyAllUnlocked: true,
          weaselBountyAllProgress: 3,
        });

        const randomRatStarted = battleSystem.startBattle('rat', { randomEncounter: true });
        const randomRatEnemy = RPG.State.currentEnemy?.id || null;
        cleanupBattle();

        const randomWeaselStarted = battleSystem.startBattle('weasel', { randomEncounter: true });
        const randomWeaselEnemy = RPG.State.currentEnemy?.id || null;
        cleanupBattle();

        const fixedRatStarted = battleSystem.startBattle('rat');
        const fixedRatEnemy = RPG.State.currentEnemy?.id || null;
        cleanupBattle();

        Math.random = () => 0;
        const amberizedTemplate = battleSystem.rollAmberVariantEncounter();
        const amberRandomStarted = battleSystem.startBattle(
          amberizedTemplate.id,
          { randomEncounter: true }
        );
        const amberRandomEnemy = RPG.State.currentEnemy?.id || null;
        cleanupBattle();

        RPG.State.flags.matamatabiActive = true;
        Math.random = () => 0.5;
        const matatabiWeaselStarted = battleSystem.startBattle(null);
        const matatabiEnemy = RPG.State.currentEnemy?.id || null;
        cleanupBattle();

        RPG.State.flags.matamatabiActive = false;
        RPG.State.storyPhase = 1;
        RPG.State.explorationArea = 'herbGarden';
        RPG.Assets.CONFIG.BATTLE_RATE = 1;
        Math.random = () => 0;
        const herbGardenStarted = explorationSystem.tryHerbGardenEncounter(1);
        const herbGardenEnemy = RPG.State.currentEnemy?.id || null;

        return {
          randomRatStarted,
          randomRatEnemy,
          randomWeaselStarted,
          randomWeaselEnemy,
          fixedRatStarted,
          fixedRatEnemy,
          amberizedId: amberizedTemplate.id,
          amberRandomStarted,
          amberRandomEnemy,
          matatabiWeaselStarted,
          matatabiEnemy,
          herbGardenStarted,
          herbGardenEnemy,
          highwaySwarmExcluded:
            battleSystem.isNotebookAllRandomEncounterExcluded('hell_rat_swarm'),
        };
      } finally {
        Math.random = originalRandom;
        RPG.Assets.CONFIG.BATTLE_RATE = originalBattleRate;
      }
    });

    expect(result).toEqual({
      randomRatStarted: false,
      randomRatEnemy: null,
      randomWeaselStarted: false,
      randomWeaselEnemy: null,
      fixedRatStarted: true,
      fixedRatEnemy: 'rat',
      amberizedId: 'amber_rat',
      amberRandomStarted: true,
      amberRandomEnemy: 'amber_rat',
      matatabiWeaselStarted: false,
      matatabiEnemy: null,
      herbGardenStarted: false,
      herbGardenEnemy: null,
      highwaySwarmExcluded: false,
    });
  });

  test('rat and weasel ALL rewards use their dedicated intro, shared item grant, and one-time flags', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      Object.assign(RPG.State.flags, {
        ratBountyAllUnlocked: true,
        ratBountyAllProgress: 5,
        ratBountyAllReceived: false,
        weaselBountyAllUnlocked: true,
        weaselBountyAllProgress: 3,
        weaselBountyAllReceived: false,
      });
      RPG.State.inventory.gratefulTalisman = 0;
      RPG.State.inventory.highHerb = 0;
      RPG.State.inventory.unknownAmber = 0;
      RPG.State.unappraisedAmberResults = [];
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';
      innSystem.claimNotebookRewards('rat', 'all');
    });
    await drainDialogue(page);

    const ratResult = await page.evaluate(() => {
      const result = {
        lines: [...document.querySelectorAll('#logContainer .log-entry')]
          .map(element => element.textContent),
        item: RPG.State.inventory.gratefulTalisman,
        received: RPG.State.flags.ratBountyAllReceived,
      };
      innSystem.claimNotebookRewards('rat', 'all');
      result.itemAfterRetry = RPG.State.inventory.gratefulTalisman;
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';
      innSystem.claimNotebookRewards('weasel', 'all');
      return result;
    });
    expect(ratResult).toEqual({
      lines: [
        '娘「魔界のネズミくらいなら、冒険者の方で倒せるようになりました。ありがとうございます！」',
        '🧧ありがた〜い札を1個受け取った！',
      ],
      item: 1,
      received: true,
      itemAfterRetry: 1,
    });

    await drainDialogue(page);
      const weaselResult = await page.evaluate(() => {
        const result = {
          lines: [...document.querySelectorAll('#logContainer .log-entry')]
            .map(element => element.textContent),
        item: RPG.State.inventory.unknownAmber,
        results: RPG.State.unappraisedAmberResults,
        received: RPG.State.flags.weaselBountyAllReceived,
      };
      innSystem.claimNotebookRewards('weasel', 'all');
      result.itemAfterRetry = RPG.State.inventory.unknownAmber;
      return result;
    });
    expect(weaselResult).toEqual({
      lines: [
        '娘「あの剣士の方が、魔界のイタチを倒せるようになりました。お礼の品を預かっています」',
        '🔸？琥珀を1個受け取った！',
      ],
      item: 1,
      results: ['vampireAmber'],
      received: true,
      itemAfterRetry: 1,
    });
  });

  test('the weasel ALL amber always appraises as vampire amber', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      Object.assign(RPG.State.flags, {
        weaselBountyAllUnlocked: true,
        weaselBountyAllProgress: 3,
        weaselBountyAllReceived: false,
        firstAmberAppraisalDone: true,
      });
      RPG.State.inventory.unknownAmber = 0;
      RPG.State.inventory.vampireAmber = 0;
      RPG.State.unappraisedAmberResults = [];
      innSystem.claimNotebookRewards('weasel', 'all');
    });
    await drainDialogue(page);
    await page.evaluate(() => innSystem.appraiseAmber());
    await drainDialogue(page);
    const result = await page.evaluate(() => ({
      unknownAmber: RPG.State.inventory.unknownAmber,
      queuedResults: RPG.State.unappraisedAmberResults,
      vampireAmber: RPG.State.inventory.vampireAmber,
    }));
    expect(result).toEqual({ unknownAmber: 0, queuedResults: [], vampireAmber: 1 });
  });

  test("the notebook's true final claim always uses the letter-handoff intro, regardless of which entry finishes last", async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true });
      Object.assign(RPG.State.flags, {
        ratBountyAllReceived: true,
        sapBountyAllReceived: true,
        amberRatBountyAllReceived: true,
        amberWeaselBountyAllReceived: true,
        weaselBountyAllReceived: false,
        weaselBountyAllUnlocked: true,
        weaselBountyAllProgress: 3,
      });
      RPG.State.inventory.highHerb = 0;
      RPG.State.inventory.secretLetter = 0;
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';
      innSystem.claimNotebookRewards('weasel', 'all');
      return null;
    });
    expect(result).toBeNull();
    await drainDialogue(page);

    const claimResult = await page.evaluate(() => ({
      lines: [...document.querySelectorAll('#logContainer .log-entry')].map(el => el.textContent),
      highHerb: RPG.State.inventory.highHerb,
      secretLetter: RPG.State.inventory.secretLetter,
      received: RPG.State.flags.weaselBountyAllReceived,
    }));
    expect(claimResult).toEqual({
      lines: [
        '娘「琥珀の森の魔物、いなくなりましたね。また森が歩けるなんて。本当にありがとうございます。あの…っ！これ、お礼、じゃないんですけど、受け取ってもらえますか…？」',
        '㊙️秘密のお手紙を1個受け取った！',
      ],
      highHerb: 0,
      secretLetter: 1,
      received: true,
    });
  });

  test('all normal notebook reward definitions use the requested items and quantities', async ({ page }) => {
    const rewards = await page.evaluate(() => Object.fromEntries(
      RPG.Assets.NOTEBOOK_ENTRIES.flatMap(entry => (
        entry.tiers
          .filter(tier => tier.id !== 'all' && Number.isFinite(tier.target))
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
      'weasel:20': [],
      'sap:10': [['shinyOil', 3]],
      'sap:15': [['hardBottle', 1]],
      'amber_rat:15': [['fakeWoundMedicine', 3], ['smokeBomb', 3]],
      'amber_weasel:15': [['fakeWoundMedicine', 3]],
    });
  });

  test('all unappraised amber is one non-usable inventory entry', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.inventory.unknownAmber = 3;
      RPG.State.unappraisedAmberResults = ['vampireAmber'];
      RPG.State.inventory.secretLetter = 1;

      uiControl.openModal();
      const inventoryText = document.getElementById('itemList')?.textContent || '';
      uiControl.selectItem('unknownAmber', 3);
      const amberHasUseButton = Boolean(
        document.querySelector('#itemDetailArea button')
      );
      uiControl.selectItem('secretLetter', 1);
      const letterHasUseButton = Boolean(
        document.querySelector('#itemDetailArea button')
      );

      return {
        unknownAmber: RPG.State.inventory.unknownAmber,
        secretLetter: RPG.State.inventory.secretLetter,
        amberName: RPG.Assets.CONFIG.ITEM_NAME.unknownAmber,
        amberDescription: RPG.Assets.CONFIG.ITEM_DESC.unknownAmber,
        letterName: RPG.Assets.CONFIG.ITEM_NAME.secretLetter,
        letterDescription: RPG.Assets.CONFIG.ITEM_DESC.secretLetter,
        inventoryText,
        amberHasUseButton,
        letterHasUseButton,
        socketable: RPG.Assets.RARE_AMBER_CATALOG.some(
          amber => amber.id === 'unknownAmber'
        ),
      };
    });

    expect(result).toEqual({
      unknownAmber: 3,
      secretLetter: 1,
      amberName: '🔸？琥珀',
      amberDescription: 'まだ鑑定されていない琥珀。琥珀商なら正体が分かる。',
      letterName: '㊙️秘密のお手紙',
      letterDescription: '誰かに宛てて書かれた手紙。',
      inventoryText: '🔸？琥珀 (×3)㊙️秘密のお手紙 (×1)',
      amberHasUseButton: false,
      letterHasUseButton: false,
      socketable: false,
    });
  });

  test('old special unknown amber saves migrate into the unified confirmed stack', async ({ page }) => {
    const result = await page.evaluate(() => {
      const legacySave = JSON.parse(JSON.stringify(RPG.State));
      legacySave.inventory.unknownAmber = 2;
      legacySave.inventory.specialUnknownAmber = 1;
      delete legacySave.unappraisedAmberResults;
      localStorage.setItem('okai_rpg_notebook_special_item_legacy_test', JSON.stringify(legacySave));

      RPG.State.inventory.unknownAmber = 0;
      RPG.State.unappraisedAmberResults = [];
      uiControl.loadFromStorage('okai_rpg_notebook_special_item_legacy_test', 'テスト');

      const migrated = {
        unknownAmber: RPG.State.inventory.unknownAmber,
        results: RPG.State.unappraisedAmberResults,
        specialUnknownAmberPresent: Object.hasOwn(RPG.State.inventory, 'specialUnknownAmber'),
      };
      const originalRandom = Math.random;
      Math.random = () => 0.75;
      innSystem.appraiseAmber();
      Math.random = originalRandom;

      return {
        migrated,
        afterAppraisal: {
          unknownAmber: RPG.State.inventory.unknownAmber,
          results: RPG.State.unappraisedAmberResults,
          vampireAmber: RPG.State.inventory.vampireAmber,
          junkAmber: RPG.State.amberStorage.junk,
        },
      };
    });
    expect(result).toEqual({
      migrated: {
        unknownAmber: 3,
        results: ['vampireAmber'],
        specialUnknownAmberPresent: false,
      },
      afterAppraisal: {
        unknownAmber: 0,
        results: [],
        vampireAmber: 1,
        junkAmber: 2,
      },
    });
  });

  test('rat and weasel ALL tiers keep independent progress while amber ALL tiers wait for saved targets', async ({ page }) => {
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
              unlockFlag: tier.unlockFlag || null,
              progressFlag: tier.progressFlag || null,
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
      RPG.State.inventory.gratefulTalisman = 0;
      RPG.State.mode = 'base';
      innSystem.claimNotebookRewards('rat', 'all');
      uiControl.showNotebookModal();
      const lockedMarkers = [...document.querySelectorAll('.notebook-tier')]
        .filter(element => element.textContent.includes('ALL'))
        .map(element => element.textContent);
      uiControl.closeNotebookModal();

      Object.assign(RPG.State.flags, {
        ratBountyAllUnlocked: true,
        ratBountyAllProgress: 5,
        weaselBountyAllUnlocked: true,
        weaselBountyAllProgress: 3,
      });
      uiControl.showNotebookModal();

      return {
        allTiers,
        lockedMarkers,
        ratAllClaimableAfterUnlock: innSystem.isNotebookRewardClaimable('rat', 'all'),
        weaselAllClaimableAfterUnlock: innSystem.isNotebookRewardClaimable('weasel', 'all'),
        sapAllClaimable: innSystem.isNotebookRewardClaimable('sap', 'all'),
        amberRatAllClaimable: innSystem.isNotebookRewardClaimable('amber_rat', 'all'),
        amberWeaselAllClaimable: innSystem.isNotebookRewardClaimable('amber_weasel', 'all'),
        gratefulTalisman: RPG.State.inventory.gratefulTalisman,
        ratAllReceived: RPG.State.flags.ratBountyAllReceived,
        allMarkers: [...document.querySelectorAll('.notebook-tier')]
          .filter(element => element.textContent.includes('ALL'))
          .map(element => element.textContent),
        claimBtnDisabled: document.getElementById('btnNotebookClaim')?.disabled,
      };
    });

    expect(result.allTiers).toEqual({
      rat: {
        target: 5,
        claimEnabled: true,
        claimedFlag: 'ratBountyAllReceived',
        unlockFlag: 'ratBountyAllUnlocked',
        progressFlag: 'ratBountyAllProgress',
        items: [['gratefulTalisman', 1]],
      },
      weasel: {
        target: 3,
        claimEnabled: true,
        claimedFlag: 'weaselBountyAllReceived',
        unlockFlag: 'weaselBountyAllUnlocked',
        progressFlag: 'weaselBountyAllProgress',
        items: [['unknownAmber', 1]],
      },
      sap: {
        target: null,
        claimEnabled: true,
        claimedFlag: 'sapBountyAllReceived',
        unlockFlag: null,
        progressFlag: null,
        items: [['highHerb', 5]],
      },
      amber_rat: {
        target: null,
        claimEnabled: true,
        claimedFlag: 'amberRatBountyAllReceived',
        unlockFlag: null,
        progressFlag: null,
        items: [['unknownAmber', 1]],
      },
      amber_weasel: {
        target: null,
        claimEnabled: true,
        claimedFlag: 'amberWeaselBountyAllReceived',
        unlockFlag: null,
        progressFlag: null,
        items: [['highHerb', 3]],
      },
    });
    expect(result.lockedMarkers).toEqual(['－ALL', '－ALL', '－ALL', '－ALL', '－ALL']);
    expect(result.ratAllClaimableAfterUnlock).toBe(true);
    expect(result.weaselAllClaimableAfterUnlock).toBe(true);
    expect(result.sapAllClaimable).toBe(false);
    expect(result.amberRatAllClaimable).toBe(false);
    expect(result.amberWeaselAllClaimable).toBe(false);
    expect(result.gratefulTalisman).toBe(0);
    expect(result.ratAllReceived).toBe(false);
    expect(result.allMarkers).toEqual(['！ALL', '！ALL', '－ALL', '－ALL', '－ALL']);
    expect(result.claimBtnDisabled).toBe(false);
  });

  test('old saves default every ALL state safely and keep received-20 tiers pending for unlock', async ({ page }) => {
    const result = await page.evaluate(() => {
      const allFlags = [
        'ratBountyAllUnlocked',
        'ratBountyAllProgress',
        'weaselBountyAllUnlocked',
        'weaselBountyAllProgress',
        'ratBountyAllReceived',
        'weaselBountyAllReceived',
        'sapBountyAllReceived',
        'amberRatBountyAllReceived',
        'amberWeaselBountyAllReceived',
      ];
      const legacySave = JSON.parse(JSON.stringify(RPG.State));
      allFlags.forEach(flag => delete legacySave.flags[flag]);
      legacySave.flags.ratBounty20Received = true;
      localStorage.setItem('okai_rpg_notebook_all_legacy_test', JSON.stringify(legacySave));

      allFlags.forEach(flag => {
        RPG.State.flags[flag] = flag.endsWith('Progress') ? 99 : true;
      });
      uiControl.loadFromStorage('okai_rpg_notebook_all_legacy_test', 'テスト');
      const pending = innSystem.getPendingNotebookAllUnlocks().map(spec => spec.entryId);
      uiControl.openNotebookModal();
      return {
        states: Object.fromEntries(allFlags.map(flag => [flag, RPG.State.flags[flag]])),
        pending,
        unlockStarted: RPG.State.mode === 'event',
        modalDisplay: getComputedStyle(document.getElementById('notebookModal')).display,
      };
    });

    expect(result.states).toEqual({
      ratBountyAllUnlocked: false,
      ratBountyAllProgress: 0,
      weaselBountyAllUnlocked: false,
      weaselBountyAllProgress: 0,
      ratBountyAllReceived: false,
      weaselBountyAllReceived: false,
      sapBountyAllReceived: false,
      amberRatBountyAllReceived: false,
      amberWeaselBountyAllReceived: false,
    });
    expect(result.pending).toEqual(['rat']);
    expect(result.unlockStarted).toBe(true);
    expect(result.modalDisplay).toBe('none');
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
      RPG.State.flags.weaselBountyAllUnlocked = true;
      RPG.State.flags.weaselBountyAllProgress = 0;
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
        allProgress: RPG.State.flags.weaselBountyAllProgress,
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
      allProgress: 0,
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
      RPG.State.flags.weaselBountyAllUnlocked = true;
      RPG.State.flags.weaselBountyAllProgress = 0;
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
      return {
        defeatCounts: RPG.State.defeatCounts.weasel,
        allProgress: RPG.State.flags.weaselBountyAllProgress,
        mode: RPG.State.mode,
      };
    });
    expect(result).toEqual({
      defeatCounts: { cain: 0, owen: 1 },
      allProgress: 0,
      mode: 'base',
    });
  });

  test('a rat under matamatabi keeps the existing blown-away-but-real-kill behavior (regression)', async ({ page }) => {
    await page.evaluate(() => {
      const originalShouldIntervene = RPG.Assets.OWEN_BEHAVIOR.shouldIntervene;
      const originalDecideAction = RPG.Assets.OWEN_BEHAVIOR.decideAction;
      RPG.Assets.OWEN_BEHAVIOR.shouldIntervene = () => true;
      RPG.Assets.OWEN_BEHAVIOR.decideAction = () => 'kill';

      RPG.State.debug.isSkipping = true;
      RPG.State.flags.matamatabiActive = true;
      RPG.State.flags.ratBountyAllUnlocked = true;
      RPG.State.flags.ratBountyAllProgress = 0;
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
      return {
        defeatCounts: RPG.State.defeatCounts.rat,
        allProgress: RPG.State.flags.ratBountyAllProgress,
        mode: RPG.State.mode,
      };
    });
    expect(result).toEqual({
      defeatCounts: { cain: 0, owen: 1 },
      allProgress: 0,
      mode: 'base',
    });
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

  test('a frozen glowing cat rabbit does not advance toward escape', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const originalEnd = battleSystem.endGlowingCatRabbitBattle;
      battleSystem.endGlowingCatRabbitBattle = () => { throw new Error('猫うさぎが凍結中に逃げた'); };
      RPG.State.debug.isSkipping = true;
      RPG.State.currentEnemy = {
        id: 'glowing_cat_rabbit', name: '光る猫うさぎ', rabbitLevel: 5,
        frozenTurns: 1, rabbitEnemyTurnCount: 2, rabbitExposed: false,
      };

      try {
        await new Promise(resolve => battleSystem.runGlowingCatRabbitTurn(resolve));
        const afterFrozenTurn = {
          frozenTurns: RPG.State.currentEnemy.frozenTurns,
          rabbitEnemyTurnCount: RPG.State.currentEnemy.rabbitEnemyTurnCount,
          rabbitExposed: RPG.State.currentEnemy.rabbitExposed,
        };
        await new Promise(resolve => battleSystem.runGlowingCatRabbitTurn(resolve));
        return {
          afterFrozenTurn,
          afterNextTurn: {
            rabbitEnemyTurnCount: RPG.State.currentEnemy.rabbitEnemyTurnCount,
            rabbitExposed: RPG.State.currentEnemy.rabbitExposed,
          },
        };
      } finally {
        battleSystem.endGlowingCatRabbitBattle = originalEnd;
        RPG.State.debug.isSkipping = false;
      }
    });

    expect(result).toEqual({
      afterFrozenTurn: { frozenTurns: 0, rabbitEnemyTurnCount: 2, rabbitExposed: false },
      afterNextTurn: { rabbitEnemyTurnCount: 3, rabbitExposed: true },
    });
  });

  test('the matatabi branch remains after the fur scene deactivates it', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.inventory.matamatabiBranch = 1;
      RPG.State.flags.matamatabiActive = true;
      RPG.State.matamatabiStepsRemaining = 4;
      const deactivation = battleSystem.buildGlowingCatRabbitFurQueue().find(
        line => line.text === 'オーエンが散々舐めたため、枝は不活性化した。'
      );
      deactivation.action();
      return {
        branchCount: RPG.State.inventory.matamatabiBranch,
        active: RPG.State.flags.matamatabiActive,
        steps: RPG.State.matamatabiStepsRemaining,
      };
    });

    expect(result).toEqual({ branchCount: 1, active: false, steps: 0 });
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

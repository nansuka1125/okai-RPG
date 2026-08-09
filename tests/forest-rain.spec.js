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
    });
    Object.assign(RPG.State, {
      mode: 'base',
      dialogueQueue: [],
      isWaitingForInput: false,
      isAtInn: false,
      isInDungeon: true,
      explorationArea: 'forest',
      location: '森の深層',
      currentDistance: 6,
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

function logTexts(page) {
  return page.evaluate(() => (
    Array.from(document.querySelectorAll('#logContainer .log-entry')).map(el => el.textContent)
  ));
}

async function drainDialogue(page, maxTaps = 30) {
  await page.evaluate(() => { RPG.State.debug.isSkipping = true; });
  for (let i = 0; i < maxTaps; i++) {
    const mode = await page.evaluate(() => RPG.State.mode);
    if (mode !== 'event') {
      await page.evaluate(() => { RPG.State.debug.isSkipping = false; });
      return mode;
    }
    await page.evaluate(() => uiControl.handlePlayerInput());
    await page.waitForTimeout(30);
  }
  throw new Error('dialogue did not finish');
}

test.describe('forest rain - 7m onset', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
    await page.evaluate(() => {
      const originalRandom = Math.random;
      window.__originalRandom = originalRandom;
      Math.random = () => 0.99; // avoid interfering random battles/ambient rolls
    });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      if (window.__originalRandom) Math.random = window.__originalRandom;
    });
  });

  test('49. first arrival at 7m after the fortune lead shows the rain-start line once', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.flags.thiefDiscoveryStatus = 1;
      RPG.State.flags.hasSleptAfterThief = true;
      RPG.State.flags.giantLarvaDefeated = false;
      RPG.State.flags.phase6PostDeliverySleepDone = false;
      RPG.State.currentDistance = 6;
    });
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));

    const lines = await logTexts(page);
    const completed = await page.evaluate(() => RPG.State.completedEvents.includes('forest_7m_rain_start'));
    expect(lines).toContain('雨が降り始めた……');
    expect(completed).toBe(true);
  });

  test('50. revisiting 7m does not repeat the rain-start line', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.flags.thiefDiscoveryStatus = 1;
      RPG.State.flags.hasSleptAfterThief = true;
      RPG.State.currentDistance = 6;
    });
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true })); // -> 7m, first time
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true })); // -> 8m
    await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true })); // -> 7m again

    const lines = await logTexts(page);
    const rainStartCount = lines.filter(t => t === '雨が降り始めた……').length;
    expect(rainStartCount).toBe(1);
  });

  test('51. without the fortune lead (thiefDiscoveryStatus 0), the rain-start line never appears', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.flags.thiefDiscoveryStatus = 0;
      RPG.State.currentDistance = 6;
    });
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));

    const lines = await logTexts(page);
    expect(lines).not.toContain('雨が降り始めた……');
  });

  test('52. after the boss is defeated, the 7m rain-start event no longer fires (condition excludes it)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const event = RPG.Assets.EVENT_DATA.find(e => e.id === 'forest_7m_rain_start');
      RPG.State.flags.thiefDiscoveryStatus = 2;
      RPG.State.flags.giantLarvaDefeated = true;
      RPG.State.flags.phase6PostDeliverySleepDone = false;
      RPG.State.currentDistance = 7;
      return event.condition(RPG.State);
    });
    expect(result).toBe(false);
  });
});

test.describe('forest rain - isRainActive() semantics', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
  });

  test('53. defeating the boss does not stop the rain (isRainActive stays true)', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.thiefDiscoveryStatus = 2;
      RPG.State.flags.giantLarvaDefeated = true;
      RPG.State.flags.phase6PostDeliverySleepDone = false;
      return explorationSystem.isRainActive();
    });
    expect(result).toBe(true);
  });

  test('54. the post-delivery sleep flag is what ends the rain', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.thiefDiscoveryStatus = 2;
      RPG.State.flags.giantLarvaDefeated = true;
      RPG.State.flags.phase6PostDeliverySleepDone = true;
      return explorationSystem.isRainActive();
    });
    expect(result).toBe(false);
  });

  test('60. silver delivery alone does not stop the rain', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.thiefDiscoveryStatus = 1;
      RPG.State.flags.hasSleptAfterThief = true;
      RPG.State.flags.silverDelivered = true;
      RPG.State.flags.phase6PostDeliverySleepDone = false;
      return explorationSystem.isRainActive();
    });
    expect(result).toBe(true);
  });

  test('61. only the next-morning sleep flag stops the rain after delivery', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.thiefDiscoveryStatus = 1;
      RPG.State.flags.silverDelivered = true;
      RPG.State.flags.phase6PostDeliverySleepDone = true;
      return explorationSystem.isRainActive();
    });
    expect(result).toBe(false);
  });

  test('on the fur-delivery day itself, rain and the 9m/10m rescue events stay locked', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.thiefDiscoveryStatus = 1;
      RPG.State.flags.hasSleptAfterThief = false; // delivered today, has not slept since
      RPG.State.flags.giantLarvaDefeated = false;
      const nineM = RPG.Assets.EVENT_DATA.find(e => e.id === 'thief_rescue_9m_scream');
      const tenM = RPG.Assets.EVENT_DATA.find(e => e.id === 'thief_rescue_10m_battle');
      return {
        rainActive: explorationSystem.isRainActive(),
        nineMUnlocked: nineM.condition({ ...RPG.State, currentDistance: 9 }),
        tenMUnlocked: tenM.condition({ ...RPG.State, currentDistance: 10 }),
      };
    });
    expect(result).toEqual({ rainActive: false, nineMUnlocked: false, tenMUnlocked: false });
  });

  test('a night completed after the fur delivery unlocks rain and the 9m/10m rescue the next morning', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.thiefDiscoveryStatus = 1;
      RPG.State.flags.hasSleptAfterThief = false;
      RPG.State.flags.giantLarvaDefeated = false;

      // Matamatabi's night takes priority over an ordinary stay while pending; confirm it is
      // actually the one that starts (not silently skipped) before checking the shared morning
      // completion point both paths funnel into.
      RPG.State.flags.matamatabiNightPending = true;
      RPG.State.flags.matamatabiNightSeen = false;
      RPG.State.flags.silverDelivered = false;
      RPG.State.mode = 'base';
      innSystem.stay();
      // matamatabiNightSeen and mode='event' are both set synchronously at the top of
      // playMatamatabiNight(), before its dialogue queue starts playing.
      const matamatabiNightStarted =
        RPG.State.flags.matamatabiNightSeen === true && RPG.State.mode === 'event';

      // refreshHerbGardenHarvestsAfterStay() is the single morning-completion point both the
      // matamatabi night and an ordinary stay call once their scene finishes.
      innSystem.refreshHerbGardenHarvestsAfterStay();

      const nineM = RPG.Assets.EVENT_DATA.find(e => e.id === 'thief_rescue_9m_scream');
      const tenM = RPG.Assets.EVENT_DATA.find(e => e.id === 'thief_rescue_10m_battle');
      return {
        matamatabiNightStarted,
        hasSleptAfterThief: RPG.State.flags.hasSleptAfterThief,
        rainActive: explorationSystem.isRainActive(),
        nineMUnlocked: nineM.condition({ ...RPG.State, currentDistance: 9 }),
        tenMUnlocked: tenM.condition({ ...RPG.State, currentDistance: 10 }),
      };
    });
    expect(result).toEqual({
      matamatabiNightStarted: true,
      hasSleptAfterThief: true,
      rainActive: true,
      nineMUnlocked: true,
      tenMUnlocked: true,
    });
  });
});

test.describe('matamatabi branch re-acquisition at 4m', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
    await page.evaluate(() => {
      RPG.State.currentDistance = 4;
      RPG.State.inventory.matamatabiBranch = 0;
      RPG.State.flags.matamatabiActive = false;
      RPG.State.flags.giantLarvaDefeated = false;
      RPG.State.flags.phase6PostDeliverySleepDone = false;
      RPG.State.flags.matamatabiBranchFoundAgain = false;
    });
  });

  test('stays locked before the boss is defeated, and again before the post-delivery sleep, then unlocks once and re-locks after use', async ({ page }) => {
    const result = await page.evaluate(() => {
      const beforeBoss = explorationSystem.canReacquireMatamatabiBranch();

      RPG.State.flags.giantLarvaDefeated = true;
      const bossOnlyPreSleep = explorationSystem.canReacquireMatamatabiBranch();

      RPG.State.flags.phase6PostDeliverySleepDone = true;
      const unlockedAfterSleep = explorationSystem.canReacquireMatamatabiBranch();

      RPG.State.flags.matamatabiBranchFoundAgain = true;
      const lockedAfterFirstReacquisition = explorationSystem.canReacquireMatamatabiBranch();

      return { beforeBoss, bossOnlyPreSleep, unlockedAfterSleep, lockedAfterFirstReacquisition };
    });
    expect(result).toEqual({
      beforeBoss: false,
      bossOnlyPreSleep: false,
      unlockedAfterSleep: true,
      lockedAfterFirstReacquisition: false,
    });
  });

  test('picking up the branch again at 4m does not activate matamatabi; using it from inventory does', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
      RPG.State.flags.phase6PostDeliverySleepDone = true;
      RPG.State.mode = 'base';
    });

    await page.evaluate(() => explorationSystem.talk());
    await drainDialogue(page);

    const afterPickup = await page.evaluate(() => ({
      branchCount: RPG.State.inventory.matamatabiBranch,
      foundAgain: RPG.State.flags.matamatabiBranchFoundAgain,
      matamatabiActive: RPG.State.flags.matamatabiActive,
    }));

    await page.evaluate(() => {
      RPG.State.mode = 'base';
      explorationSystem.useItem('matamatabiBranch');
    });
    await drainDialogue(page);

    const afterUse = await page.evaluate(() => ({
      branchCount: RPG.State.inventory.matamatabiBranch,
      matamatabiActive: RPG.State.flags.matamatabiActive,
    }));

    expect(afterPickup).toEqual({ branchCount: 1, foundAgain: true, matamatabiActive: false });
    expect(afterUse).toEqual({ branchCount: 1, matamatabiActive: true });
  });
});

test.describe('matamatabi night reservation is fur-gated, not activation-gated', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
  });

  test('the branch auto-activating no longer reserves the matamatabi night by itself', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.inventory.matamatabiBranch = 1;
      RPG.State.flags.matamatabiActive = false;
      RPG.State.flags.matamatabiAutoActivationDone = false;
      RPG.State.flags.matamatabiNightPending = false;
      RPG.State.battleState = { playerTookDamage: true };

      const queue = battleSystem.buildMatamatabiActivationQueue();
      queue[queue.length - 1]?.action?.();

      return {
        matamatabiActive: RPG.State.flags.matamatabiActive,
        autoActivationDone: RPG.State.flags.matamatabiAutoActivationDone,
        nightPending: RPG.State.flags.matamatabiNightPending,
      };
    });
    expect(result).toEqual({ matamatabiActive: true, autoActivationDone: true, nightPending: false });
  });

  test('manually reusing the branch from inventory no longer reserves the matamatabi night by itself', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.inventory.matamatabiBranch = 1;
      RPG.State.flags.matamatabiActive = false;
      RPG.State.flags.matamatabiNightPending = false;
      RPG.State.matamatabiUseCount = 1;

      const queue = explorationSystem.buildMatamatabiManualUseQueue();
      queue.find(entry => entry.action)?.action?.();

      return {
        matamatabiActive: RPG.State.flags.matamatabiActive,
        nightPending: RPG.State.flags.matamatabiNightPending,
      };
    });
    expect(result).toEqual({ matamatabiActive: true, nightPending: false });
  });

  test('the glowing cat rabbit only drops its fur while matamatabi is active, even with the encounter counter maxed', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.needsGlowingRabbitFur = true;
      RPG.State.inventory.glowingCatRabbitFur = 0;
      RPG.State.flags.phase4MatamatabiRabbitEncounters = 3;
      const enemy = { id: 'glowing_cat_rabbit' };

      RPG.State.flags.matamatabiActive = false;
      const withoutMatamatabi = battleSystem.shouldAwardGlowingCatRabbitFur(enemy);

      RPG.State.flags.matamatabiActive = true;
      const withMatamatabi = battleSystem.shouldAwardGlowingCatRabbitFur(enemy);

      return { withoutMatamatabi, withMatamatabi };
    });
    expect(result).toEqual({ withoutMatamatabi: false, withMatamatabi: true });
  });

  test('a first Lv5 encounter in Phase4 still queues its one-time followup conversation', async ({ page }) => {
    const result = await page.evaluate(() => {
      const originalPlayDialogueLoop = explorationSystem.playDialogueLoop;
      explorationSystem.playDialogueLoop = () => {};
      try {
        Object.assign(RPG.State, {
          mode: 'base',
          storyPhase: 4,
          isBattling: true,
          battleState: { playerTookDamage: false },
          currentEnemy: { id: 'glowing_cat_rabbit', name: '光る猫うさぎ', rabbitLevel: 5, xp: 0, gold: 0 },
          equippedRareAmberId: null,
        });
        RPG.State.flags.glowCatRabbitTalkLv5Done = false;
        RPG.State.flags.needsGlowingRabbitFur = false;
        RPG.State.flags.matamatabiActive = false;
        RPG.State.inventory.glowingCatRabbitFur = 0;
        RPG.State.inventory.matamatabiBranch = 0;

        battleSystem.endGlowingCatRabbitBattle(false);

        return {
          queued: RPG.State.dialogueQueue.some(line => line.text === 'カイン「なんだったんだあれは…」'),
          talkLv5Done: RPG.State.flags.glowCatRabbitTalkLv5Done,
        };
      } finally {
        explorationSystem.playDialogueLoop = originalPlayDialogueLoop;
      }
    });

    expect(result).toEqual({ queued: true, talkLv5Done: true });
  });

  test('obtaining the fur reserves the matamatabi night even when Owen licks the branch clean in the same scene', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isBattling: true,
        battleState: { playerTookDamage: false },
        currentEnemy: { id: 'glowing_cat_rabbit', name: '光る猫うさぎ', rabbitLevel: 5, xp: 0, gold: 0 },
        equippedRareAmberId: null,
      });
      RPG.State.inventory.matamatabiBranch = 1;
      RPG.State.flags.matamatabiActive = true;
      RPG.State.flags.needsGlowingRabbitFur = true;
      RPG.State.inventory.glowingCatRabbitFur = 0;
      RPG.State.flags.phase4MatamatabiRabbitEncounters = 1; // guarantees the drop this encounter
      RPG.State.flags.matamatabiNightPending = false;
      battleSystem.endGlowingCatRabbitBattle(false);
    });
    await drainDialogue(page, 60);

    const result = await page.evaluate(() => ({
      fur: RPG.State.inventory.glowingCatRabbitFur,
      branch: RPG.State.inventory.matamatabiBranch,
      matamatabiActive: RPG.State.flags.matamatabiActive,
      nightPending: RPG.State.flags.matamatabiNightPending,
    }));
    // Owen "licks the branch clean" in this same scene (deactivating it), yet the night
    // reservation set at the moment of fur pickup must survive that deactivation.
    expect(result).toEqual({ fur: 1, branch: 0, matamatabiActive: false, nightPending: true });
  });

  test('a Lv10 followup conversation plays alongside the fur scene in the same battle, instead of being discarded', async ({ page }) => {
    const queuedTexts = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isBattling: true,
        battleState: { playerTookDamage: false },
        currentEnemy: { id: 'glowing_cat_rabbit', name: '光る猫うさぎ', rabbitLevel: 10, xp: 0, gold: 0 },
        equippedRareAmberId: null,
      });
      RPG.State.inventory.matamatabiBranch = 1;
      RPG.State.flags.matamatabiActive = true;
      RPG.State.flags.needsGlowingRabbitFur = true;
      RPG.State.inventory.glowingCatRabbitFur = 0;
      RPG.State.flags.phase4MatamatabiRabbitEncounters = 1; // guarantees the drop this encounter
      RPG.State.flags.matamatabiNightPending = false;
      RPG.State.flags.glowCatRabbitTalkLv10Done = false;
      battleSystem.endGlowingCatRabbitBattle(false);
      return RPG.State.dialogueQueue.map(line => line.text);
    });

    // Both the fur scene (ending on the branch-deactivation line) and the Lv10 followup
    // (opening on "またいたな…") must be present, fur scene first.
    const deactivationIndex = queuedTexts.indexOf('オーエンが全て舐めとったため、枝は不活性化した。');
    const followupIndex = queuedTexts.indexOf('カイン「またいたな…」');
    expect(deactivationIndex).toBeGreaterThanOrEqual(0);
    expect(followupIndex).toBeGreaterThan(deactivationIndex);

    await drainDialogue(page, 60);

    const result = await page.evaluate(() => ({
      fur: RPG.State.inventory.glowingCatRabbitFur,
      branch: RPG.State.inventory.matamatabiBranch,
      matamatabiActive: RPG.State.flags.matamatabiActive,
      nightPending: RPG.State.flags.matamatabiNightPending,
      talkLv10Done: RPG.State.flags.glowCatRabbitTalkLv10Done,
    }));
    expect(result).toEqual({
      fur: 1,
      branch: 0,
      matamatabiActive: false,
      nightPending: true,
      talkLv10Done: true,
    });
  });
});

test.describe('glowing cat rabbit Lv20 reward: 💊夜の薬', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
  });

  test('defeating a Lv20 glowing cat rabbit grants nightMedicine once; escaping grants nothing', async ({ page }) => {
    const setupBattle = () => page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isBattling: true,
        battleState: { playerTookDamage: false },
        currentEnemy: { id: 'glowing_cat_rabbit', name: '光る猫うさぎ', rabbitLevel: 20, xp: 0, gold: 0 },
        equippedRareAmberId: null,
      });
      RPG.State.inventory.matamatabiBranch = 0;
      RPG.State.flags.matamatabiActive = false;
      RPG.State.flags.needsGlowingRabbitFur = false;
    });
    const readState = () => page.evaluate(() => ({
      nightMedicine: RPG.State.inventory.nightMedicine,
      received: RPG.State.flags.glowCatRabbitRewardLv20Received,
    }));

    await page.evaluate(() => {
      RPG.State.inventory.nightMedicine = 0;
      RPG.State.flags.glowCatRabbitRewardLv20Received = false;
    });

    await setupBattle();
    await page.evaluate(() => battleSystem.endGlowingCatRabbitBattle(true)); // escape: no reward
    await drainDialogue(page, 100);
    expect(await readState()).toEqual({ nightMedicine: 0, received: false });

    await setupBattle();
    await page.evaluate(() => battleSystem.endGlowingCatRabbitBattle(false)); // defeat: reward once
    await drainDialogue(page, 100);
    expect(await readState()).toEqual({ nightMedicine: 1, received: true });

    await setupBattle();
    await page.evaluate(() => battleSystem.endGlowingCatRabbitBattle(false)); // second defeat: no duplicate
    await drainDialogue(page, 100);
    expect(await readState()).toEqual({ nightMedicine: 1, received: true });
  });

  test('canStartNightMedicineNight(): false while a priority night event is pending, true on a plain night', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        storyPhase: 4,
        currentHP: 10,
        maxHP: 140,
        canStay: true,
      });
      RPG.State.silverCoins = 0;
      RPG.State.inventory.silverCoin = 0;
      RPG.State.flags.silverDelivered = false;
      RPG.State.flags.matamatabiNightPending = true;
      RPG.State.flags.matamatabiNightSeen = false;
      RPG.State.flags.amberMerchantMovePending = false;
      RPG.State.flags.thiefDiscoveryStatus = 0;
      RPG.State.flags.innRepairInspectionUnlocked = false;
      const withMatamatabiPending = innSystem.canStartNightMedicineNight();

      RPG.State.flags.matamatabiNightPending = false;
      const plainNight = innSystem.canStartNightMedicineNight();

      return { withMatamatabiPending, plainNight };
    });
    expect(result).toEqual({ withMatamatabiPending: false, plainNight: true });
  });

  test('the inn interior command panel has no item button, which is why nightMedicine can only ever be used from the inn front', async ({ page }) => {
    const hasItemButtonInInnUI = await page.evaluate(() => (
      document.querySelector('#innUI #btnItem') !== null
    ));
    expect(hasItemButtonInInnUI).toBe(false);
  });

  test('using nightMedicine away from the inn front (e.g. the forest) shows the flavor line and does not consume it', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'forest',
      });
      RPG.State.inventory.nightMedicine = 1;
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';
      explorationSystem.useItem('nightMedicine');
      return {
        nightMedicine: RPG.State.inventory.nightMedicine,
        mode: RPG.State.mode,
        log: document.getElementById('logContainer')?.textContent || '',
      };
    });
    expect(result.nightMedicine).toBe(1);
    expect(result.mode).toBe('base');
    expect(result.log).toContain('カイン（寝る前に飲もう）');
  });

  test('using nightMedicine inside the inn interior also shows the flavor line (there is no item command there in practice, but the guard still holds)', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', isAtInn: true, isInDungeon: false });
      RPG.State.inventory.nightMedicine = 1;
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';
      explorationSystem.useItem('nightMedicine');
      return {
        nightMedicine: RPG.State.inventory.nightMedicine,
        mode: RPG.State.mode,
        log: document.getElementById('logContainer')?.textContent || '',
      };
    });
    expect(result.nightMedicine).toBe(1);
    expect(result.mode).toBe('base');
    expect(result.log).toContain('カイン（寝る前に飲もう）');
  });

  test('using nightMedicine at the inn front while a priority night event is pending does not consume it or open the confirmation', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base', isAtInn: false, isInDungeon: false, storyPhase: 4, canStay: true,
      });
      RPG.State.flags.silverDelivered = false;
      RPG.State.flags.matamatabiNightPending = true;
      RPG.State.flags.matamatabiNightSeen = false;
      RPG.State.flags.amberMerchantMovePending = false;
      RPG.State.flags.thiefDiscoveryStatus = 0;
      RPG.State.inventory.nightMedicine = 1;
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';
      explorationSystem.useItem('nightMedicine');
      return {
        nightMedicine: RPG.State.inventory.nightMedicine,
        mode: RPG.State.mode,
        log: document.getElementById('logContainer')?.textContent || '',
      };
    });
    expect(result.nightMedicine).toBe(1);
    expect(result.mode).toBe('base');
    expect(result.log).toContain('カイン（…今夜はやめておこう）');
  });

  test('answering いいえ to the confirmation leaves the medicine unconsumed and returns to base mode', async ({ page }) => {
    const setup = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base', isAtInn: false, isInDungeon: false, storyPhase: 4, canStay: true,
        currentHP: 10, maxHP: 140,
      });
      RPG.State.silverCoins = 0;
      RPG.State.inventory.silverCoin = 0;
      RPG.State.flags.silverDelivered = false;
      RPG.State.flags.matamatabiNightPending = false;
      RPG.State.flags.amberMerchantMovePending = false;
      RPG.State.flags.thiefDiscoveryStatus = 0;
      RPG.State.flags.innRepairInspectionUnlocked = false;
      RPG.State.inventory.nightMedicine = 1;
      explorationSystem.useItem('nightMedicine');
      return {
        buttons: [...document.querySelectorAll('#action-buttons button')].map(b => b.textContent),
        modeAtChoice: RPG.State.mode,
      };
    });
    expect(setup.buttons).toEqual(['【はい】', '【いいえ】']);
    expect(setup.modeAtChoice).toBe('choice');

    await page.getByRole('button', { name: '【いいえ】', exact: true }).click();
    const after = await page.evaluate(() => ({
      nightMedicine: RPG.State.inventory.nightMedicine,
      mode: RPG.State.mode,
    }));
    expect(after).toEqual({ nightMedicine: 1, mode: 'base' });
  });

  test('regression: full HP at the inn front still reaches the confirmation dialog', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base', isAtInn: false, isInDungeon: false, storyPhase: 4, canStay: true,
        currentHP: 140, maxHP: 140,
      });
      RPG.State.silverCoins = 0;
      RPG.State.inventory.silverCoin = 0;
      RPG.State.flags.silverDelivered = false;
      RPG.State.flags.matamatabiNightPending = false;
      RPG.State.flags.amberMerchantMovePending = false;
      RPG.State.flags.thiefDiscoveryStatus = 0;
      RPG.State.flags.innRepairInspectionUnlocked = false;
      RPG.State.inventory.nightMedicine = 1;
      explorationSystem.useItem('nightMedicine');
      return {
        buttons: [...document.querySelectorAll('#action-buttons button')].map(b => b.textContent),
        nightMedicine: RPG.State.inventory.nightMedicine,
      };
    });
    expect(result.buttons).toEqual(['【はい】', '【いいえ】']);
    expect(result.nightMedicine).toBe(1);
  });

  test('regression: the fixed-room era without a pending forest-pacified night still reaches the confirmation dialog', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base', isAtInn: false, isInDungeon: false, storyPhase: 6, canStay: true,
        currentHP: 10, maxHP: 140,
      });
      RPG.State.flags.silverDelivered = true;
      RPG.State.flags.phase6PostDeliverySleepDone = true;
      RPG.State.flags.forest2mPacifiedTalkSeen = false;
      RPG.State.flags.forestPacifiedNightSeen = false;
      RPG.State.flags.wagonReadyForDeparture = false;
      RPG.State.flags.matamatabiNightPending = false;
      RPG.State.flags.innRepairInspectionUnlocked = false;
      RPG.State.inventory.nightMedicine = 1;
      explorationSystem.useItem('nightMedicine');
      return {
        buttons: [...document.querySelectorAll('#action-buttons button')].map(b => b.textContent),
        nightMedicine: RPG.State.inventory.nightMedicine,
      };
    });
    expect(result.buttons).toEqual(['【はい】', '【いいえ】']);
    expect(result.nightMedicine).toBe(1);
  });

  test('regression: Phase7 ordinary fixed-room stays still reach the confirmation dialog', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base', isAtInn: false, isInDungeon: false, storyPhase: 7, canStay: true,
        currentHP: 10, maxHP: 140,
      });
      RPG.State.flags.phase7DepartureNightSeen = true;
      RPG.State.flags.matamatabiNightPending = false;
      RPG.State.flags.innRepairInspectionUnlocked = false;
      RPG.State.inventory.nightMedicine = 1;
      explorationSystem.useItem('nightMedicine');
      return {
        buttons: [...document.querySelectorAll('#action-buttons button')].map(b => b.textContent),
        nightMedicine: RPG.State.inventory.nightMedicine,
      };
    });
    expect(result.buttons).toEqual(['【はい】', '【いいえ】']);
    expect(result.nightMedicine).toBe(1);
  });

  test('regression: pending automatic morning training 3 protects the night', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base', isAtInn: false, isInDungeon: false, storyPhase: 6, canStay: true,
        currentHP: 10, maxHP: 140,
      });
      RPG.State.flags.silverDelivered = true;
      RPG.State.flags.phase6PostDeliverySleepDone = true;
      RPG.State.flags.morningTraining2Done = true;
      RPG.State.flags.morningTraining3Done = false;
      RPG.State.flags.morningTraining3Pending = true;
      RPG.State.flags.forest2mPacifiedTalkSeen = false;
      RPG.State.flags.forestPacifiedNightSeen = false;
      RPG.State.flags.matamatabiNightPending = false;
      RPG.State.flags.innRepairInspectionUnlocked = false;
      RPG.State.inventory.nightMedicine = 1;
      explorationSystem.useItem('nightMedicine');
      return {
        nightMedicine: RPG.State.inventory.nightMedicine,
        mode: RPG.State.mode,
        log: document.getElementById('logContainer')?.textContent || '',
      };
    });
    expect(result).toEqual(expect.objectContaining({ nightMedicine: 1, mode: 'base' }));
    expect(result.log).toContain('カイン（…今夜はやめておこう）');
  });

  test('using nightMedicine at the inn front on a plain night opens the confirmation, then はい plays the full scene through to the flavor-only ending, with no evasion state and the aftermath queued', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: false,
        isInDungeon: false,
        storyPhase: 4,
        canStay: true,
        currentHP: 10,
        maxHP: 140,
        isPoisoned: true,
      });
      RPG.State.poisonDamageRemaining = 20;
      RPG.State.silverCoins = 0;
      RPG.State.inventory.silverCoin = 0;
      RPG.State.flags.silverDelivered = false;
      RPG.State.flags.matamatabiNightPending = false;
      RPG.State.flags.amberMerchantMovePending = false;
      RPG.State.flags.thiefDiscoveryStatus = 0;
      RPG.State.flags.innRepairInspectionUnlocked = false;
      RPG.State.flags.nightMedicineAftermathPending = false;
      RPG.State.flags.nightMedicineAftermathSeen = false;
      RPG.State.flags.morningTraining2Done = true;
      RPG.State.flags.morningTraining3Done = false;
      RPG.State.flags.morningTraining3Pending = false;
      RPG.State.inventory.nightMedicine = 1;
      explorationSystem.useItem('nightMedicine');
    });

    const beforeConfirm = await page.evaluate(() => ({
      buttons: [...document.querySelectorAll('#action-buttons button')].map(b => b.textContent),
      nightMedicine: RPG.State.inventory.nightMedicine,
    }));
    expect(beforeConfirm.buttons).toEqual(['【はい】', '【いいえ】']);
    expect(beforeConfirm.nightMedicine).toBe(1);

    await page.getByRole('button', { name: '【はい】', exact: true }).click();
    await drainDialogue(page, 350);

    const result = await page.evaluate(() => ({
      nightMedicine: RPG.State.inventory.nightMedicine,
      currentHP: RPG.State.currentHP,
      isPoisoned: RPG.State.isPoisoned,
      poisonDamageRemaining: RPG.State.poisonDamageRemaining,
      matamatabiActive: RPG.State.flags.matamatabiActive,
      canStay: RPG.State.canStay,
      isAtInn: RPG.State.isAtInn,
      aftermathPending: RPG.State.flags.nightMedicineAftermathPending,
      aftermathSeen: RPG.State.flags.nightMedicineAftermathSeen,
      morningTraining3Pending: RPG.State.flags.morningTraining3Pending,
      evasionRemaining: RPG.State.nightMedicineEvasionBattlesRemaining,
      mode: RPG.State.mode,
      log: document.getElementById('logContainer')?.textContent || '',
    }));

    expect(result).toMatchObject({
      nightMedicine: 0,
      currentHP: 140,
      isPoisoned: false,
      poisonDamageRemaining: 0,
      matamatabiActive: false,
      canStay: false,
      isAtInn: true,
      aftermathPending: true,
      aftermathSeen: false,
      morningTraining3Pending: true,
      evasionRemaining: undefined,
      mode: 'base',
    });
    expect(result.log).toContain('カインは💊夜の薬を飲んだ！');
    expect(result.log).toContain('朝になった！');
    expect(result.log).toContain('カインはベッドで目を覚ました。');
    expect(result.log).toContain('カインの感覚が鋭敏になった！');
    expect(result.log).not.toContain('回避が一時的に大幅アップ');
    expect(result.log).not.toContain('―― 宿屋《琥珀亭》 ――');
  });

  test('the inn-front aftermath does not fire immediately after the medicine night, only once the player actually exits to 宿屋前', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: false,
        isInDungeon: false,
        storyPhase: 4,
        canStay: true,
        currentHP: 10,
        maxHP: 140,
      });
      RPG.State.silverCoins = 0;
      RPG.State.inventory.silverCoin = 0;
      RPG.State.flags.silverDelivered = false;
      RPG.State.flags.matamatabiNightPending = false;
      RPG.State.flags.amberMerchantMovePending = false;
      RPG.State.flags.thiefDiscoveryStatus = 0;
      RPG.State.flags.innRepairInspectionUnlocked = false;
      RPG.State.flags.nightMedicineAftermathPending = false;
      RPG.State.flags.nightMedicineAftermathSeen = false;
      RPG.State.inventory.nightMedicine = 1;
      explorationSystem.useItem('nightMedicine');
    });
    await page.getByRole('button', { name: '【はい】', exact: true }).click();
    await drainDialogue(page, 350);

    const rightAfter = await page.evaluate(() => ({
      isAtInn: RPG.State.isAtInn,
      log: document.getElementById('logContainer')?.textContent || '',
    }));
    expect(rightAfter.isAtInn).toBe(true);
    expect(rightAfter.log).not.toContain('機嫌が良くなった');

    await page.evaluate(() => {
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';
      innSystem.exitInn();
    });
    await drainDialogue(page, 100);

    const afterExit = await page.evaluate(() => ({
      aftermathSeen: RPG.State.flags.nightMedicineAftermathSeen,
      aftermathPending: RPG.State.flags.nightMedicineAftermathPending,
      log: document.getElementById('logContainer')?.textContent || '',
    }));
    expect(afterExit.aftermathSeen).toBe(true);
    expect(afterExit.aftermathPending).toBe(false);
    expect(afterExit.log).toContain('私、誰にも言いませんから！');
    expect(afterExit.log).toContain('《オーエンは機嫌が良くなった！》');
  });
});

test.describe('forest rain - 8m mud flavor', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
    await page.evaluate(() => {
      window.__originalRandom = Math.random;
      Math.random = () => 0.99;
      RPG.State.flags.thiefDiscoveryStatus = 1;
      RPG.State.flags.hasSleptAfterThief = true;
      RPG.State.flags.giantLarvaDefeated = false;
    });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      if (window.__originalRandom) Math.random = window.__originalRandom;
    });
  });

  test('55-56. every arrival at 8m in the rain shows the mud line and skips the normal ambient roll', async ({ page }) => {
    // Math.random stays at the beforeEach's 0.99 (never wins a random encounter or the old
    // AMBIENT_TEXTS[8] roll); the mud branch itself is unconditional, so its presence and the
    // absence of the old text together prove the branch fully preempts the fallback, regardless
    // of what Math.random would have rolled.
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        RPG.State.currentDistance = 7;
      });
      await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));
    }

    const lines = await logTexts(page);
    const mudCount = lines.filter(t => t === '足元がぬかるんでいる。').length;
    const staleAmbientCount = lines.filter(t => t === '泥ではない。粘りつく樹液が、靴底に嫌な重さを与える。').length;
    expect(mudCount).toBe(3);
    expect(staleAmbientCount).toBe(0);
  });

  test('57. no rain flavor leaks into 9m or 10m', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.currentDistance = 8;
    });
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true })); // -> 9m
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true })); // -> 10m

    const lines = await logTexts(page);
    expect(lines).not.toContain('足元がぬかるんでいる。');
    expect(lines).not.toContain('雨が降り始めた……');
  });

  test('58. once the boss is defeated, 8m still shows the mud flavor while the rain continues', async ({ page }) => {
    // Bugfix regression: the 8m branch used to require giantLarvaDefeated !== true, which
    // silently stopped the rain from being visible at 8m for the rest of the confirmed
    // isRainActive() window (post-boss, post-delivery, pre-sleep). The branch is now gated on
    // isRainActive() alone, matching the confirmed spec that rain continues past both events.
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
      RPG.State.currentDistance = 7;
    });
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));

    const lines = await logTexts(page);
    expect(lines).toContain('足元がぬかるんでいる。');
  });

  test('62. re-entering the forest after delivering the coins but before sleeping still shows the 8m mud flavor', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
      RPG.State.flags.silverDelivered = true;
      RPG.State.flags.phase6PostDeliverySleepDone = false;
      RPG.State.inventory.silverCoin = 0; // already delivered, so isPeacefulReturnActive() is false here
      RPG.State.currentDistance = 7;
    });
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));

    const lines = await logTexts(page);
    expect(lines).toContain('足元がぬかるんでいる。');
  });

  test('63. once phase6PostDeliverySleepDone is true, the 8m mud flavor no longer appears', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
      RPG.State.flags.silverDelivered = true;
      RPG.State.flags.phase6PostDeliverySleepDone = true;
      RPG.State.inventory.silverCoin = 0;
      RPG.State.currentDistance = 7;
    });
    await page.evaluate(() => explorationSystem.move(1, { skipTravelCue: true }));

    const lines = await logTexts(page);
    expect(lines).not.toContain('足元がぬかるんでいる。');
  });

  test('64. the post-boss 8m return-trip event takes priority and the mud flavor does not also appear on that same move', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
      RPG.State.flags.silverDelivered = false;
      RPG.State.flags.phase6PostDeliverySleepDone = false;
      RPG.State.inventory.silverCoin = 3; // isPeacefulReturnActive() true: the return-trip event applies
      RPG.State.silverCoins = 3;
      RPG.State.currentDistance = 9;
    });
    await page.evaluate(() => explorationSystem.move(-1, { skipTravelCue: true })); // -> 8m, first arrival

    const lines = await logTexts(page);
    expect(lines).toContain('オーエンは革袋の中を漁っている……。');
    expect(lines).not.toContain('足元がぬかるんでいる。');
  });

  test('59. rain does not alter combat hit/dodge/damage values', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.thiefDiscoveryStatus = 1;
      RPG.State.flags.giantLarvaDefeated = false;
      const withoutRain = { ...RPG.Config.CAIN_COMBAT };

      RPG.State.currentDistance = 7;
      // isRainActive() being true must not perturb any battle configuration table.
      const rainActive = explorationSystem.isRainActive();
      const withRain = { ...RPG.Config.CAIN_COMBAT };

      return { rainActive, withoutRain, withRain };
    });
    expect(result.rainActive).toBe(true);
    expect(result.withRain).toEqual(result.withoutRain);
  });
});

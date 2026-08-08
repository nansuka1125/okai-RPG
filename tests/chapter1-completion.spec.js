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
      introDebtTalkPending: false,
      introDebtNegotiationDone: true,
    });
    Object.assign(RPG.State, {
      mode: 'base',
      dialogueQueue: [],
      isWaitingForInput: false,
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

// Same loop as drainDialogue, but stops the moment the log contains the given text instead of
// waiting for the whole queue to finish - used to inspect the ending dialogue's opening lines
// before Cinematics.playChapter1Clear()'s own scene transition clears the log again.
async function drainDialogueUntilLogContains(page, text, maxWaitMs = 9000) {
  await page.evaluate(() => {
    RPG.State.debug.isSkipping = true;
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < maxWaitMs) {
    const state = await page.evaluate((needle) => ({
      mode: RPG.State.mode,
      waiting: RPG.State.isWaitingForInput === true,
      typewriting: explorationSystem.hasActiveTypewriter(),
      hasText: (document.getElementById('logContainer')?.textContent || '').includes(needle),
    }), text);

    if (state.hasText || state.mode !== 'event') return state;

    if (state.waiting || state.typewriting) {
      await page.evaluate(() => uiControl.handlePlayerInput());
    }
    await page.waitForTimeout(25);
  }

  throw new Error(`log never contained "${text}" before timeout`);
}

test.describe('Chapter 1 completion route', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
  });

  test('1. new state starts with chapter1Cleared false', async ({ page }) => {
    const result = await page.evaluate(() => ({
      live: RPG.State.flags.chapter1Cleared,
      defaults: RPG.DefaultState.flags.chapter1Cleared,
    }));
    expect(result).toEqual({ live: false, defaults: false });
  });

  test('2. an old save without chapter1Cleared loads with false', async ({ page }) => {
    const result = await page.evaluate(() => {
      const oldSave = JSON.parse(JSON.stringify(RPG.DefaultState));
      delete oldSave.flags.chapter1Cleared;
      localStorage.setItem('chapter1_old_save', JSON.stringify(oldSave));
      RPG.State.flags.chapter1Cleared = true;
      uiControl.loadFromStorage('chapter1_old_save', '旧記録');
      return RPG.State.flags.chapter1Cleared;
    });
    expect(result).toBe(false);
  });

  test('3. chapter1Cleared true survives snapshot save and load', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.chapter1Cleared = true;
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('chapter1_clear_save', JSON.stringify(snapshot));
      RPG.State.flags.chapter1Cleared = false;
      uiControl.loadFromStorage('chapter1_clear_save', 'クリア記録');
      return {
        cleared: RPG.State.flags.chapter1Cleared,
        titleButtons: document.querySelectorAll('#btnChapter1Title').length,
      };
    });
    expect(result).toEqual({ cleared: true, titleButtons: 1 });
  });

  test('4. Phase 8 wagon travel suppresses every vulnerable forest random roll', async ({ page }) => {
    const battles = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        storyPhase: 8,
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'forest',
      });
      Object.assign(RPG.State.flags, {
        onWagon: true,
        isDebugEncountersOff: false,
        silverDelivered: true,
      });

      const originalRandom = Math.random;
      const originalStartBattle = battleSystem.startBattle;
      const originalCheckEvents = explorationSystem.checkEvents;
      const originalTreeEncounter = scenarioEvents.treeEventSystem.handleEncounter;
      let battleCount = 0;

      try {
        Math.random = () => 0;
        battleSystem.startBattle = () => {
          battleCount += 1;
        };
        explorationSystem.checkEvents = () => false;
        scenarioEvents.treeEventSystem.handleEncounter = () => false;

        [3, 4, 5, 8, 9].forEach(destination => {
          RPG.State.mode = 'base';
          RPG.State.currentDistance = destination - 1;
          RPG.State.location = uiControl.getLocData(destination - 1).name;
          explorationSystem.move(1, { skipTravelCue: true });
        });
      } finally {
        Math.random = originalRandom;
        battleSystem.startBattle = originalStartBattle;
        explorationSystem.checkEvents = originalCheckEvents;
        scenarioEvents.treeEventSystem.handleEncounter = originalTreeEncounter;
      }
      return battleCount;
    });
    expect(battles).toBe(0);
  });

  test('5. normal forest travel still performs random encounters', async ({ page }) => {
    const battles = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        storyPhase: 5,
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'forest',
        currentDistance: 1,
        location: uiControl.getLocData(1).name,
      });
      Object.assign(RPG.State.flags, {
        onWagon: false,
        isDebugEncountersOff: false,
        silverDelivered: true,
      });

      const originalRandom = Math.random;
      const originalStartBattle = battleSystem.startBattle;
      const originalCheckEvents = explorationSystem.checkEvents;
      const originalTreeEncounter = scenarioEvents.treeEventSystem.handleEncounter;
      let battleCount = 0;

      try {
        Math.random = () => 0;
        battleSystem.startBattle = () => {
          battleCount += 1;
        };
        explorationSystem.checkEvents = () => false;
        scenarioEvents.treeEventSystem.handleEncounter = () => false;
        explorationSystem.move(1, { skipTravelCue: true });
      } finally {
        Math.random = originalRandom;
        battleSystem.startBattle = originalStartBattle;
        explorationSystem.checkEvents = originalCheckEvents;
        scenarioEvents.treeEventSystem.handleEncounter = originalTreeEncounter;
      }
      return battleCount;
    });
    expect(battles).toBe(1);
  });

  test('6. a highway defeat retreats to the inn front with battle state cleared', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'battle',
        storyPhase: 9,
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'highway',
        location: 'かつての街道',
        currentDistance: 8,
        currentHP: 0,
        isPoisoned: true,
        poisonDamageRemaining: 40,
        isBattling: true,
        currentEnemy: { id: 'hell_rat_swarm', name: '魔界ネズミの群れ' },
        battleState: { highwayFixedDistance: 8 },
      });
      RPG.State.flags.onWagon = true;
      RPG.State.flags.chapter1Cleared = false;
      battleSystem.resolveDefeat();
      return {
        location: RPG.State.location,
        distance: RPG.State.currentDistance,
        area: RPG.State.explorationArea,
        atInn: RPG.State.isAtInn,
        inDungeon: RPG.State.isInDungeon,
        phase: RPG.State.storyPhase,
        onWagon: RPG.State.flags.onWagon,
        cleared: RPG.State.flags.chapter1Cleared,
        wagonJourneyCompleted: RPG.State.completedEvents.includes(
          'phase8_wagon_journey_completed'
        ),
        hp: RPG.State.currentHP,
        poisoned: RPG.State.isPoisoned,
        isBattling: RPG.State.isBattling,
        log: document.getElementById('logContainer')?.textContent || '',
      };
    });

    expect(result).toMatchObject({
      location: '宿屋前',
      distance: 0,
      area: null,
      atInn: false,
      inDungeon: false,
      phase: 7,
      onWagon: false,
      cleared: false,
      wagonJourneyCompleted: true,
      hp: 140,
      poisoned: false,
      isBattling: false,
    });
    expect(result.log).toContain('カインは傷つき、倒れた');
    expect(result.log).toContain('荷馬車は琥珀亭まで引き返した。');
  });

  test('7. a highway defeat does not increase deathCount', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'battle',
        storyPhase: 9,
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'highway',
        location: 'かつての街道',
        currentDistance: 6,
        currentHP: 0,
        deathCount: 2,
        isBattling: true,
        currentEnemy: { id: 'eye_eating_crow', name: '目玉喰らいのカラス' },
        battleState: { highwayFixedDistance: 6 },
      });
      RPG.State.flags.onWagon = true;
      battleSystem.resolveDefeat();
      return {
        deathCount: RPG.State.deathCount,
        phase: RPG.State.storyPhase,
        onWagon: RPG.State.flags.onWagon,
      };
    });
    expect(result).toEqual({ deathCount: 2, phase: 7, onWagon: false });
  });

  test('8. highway defeat preserves prior wins, events, and scent-pouch progress', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'battle',
        storyPhase: 9,
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'highway',
        location: 'かつての街道',
        currentDistance: 4,
        currentHP: 0,
        isBattling: true,
        currentEnemy: { id: 'eye_eating_crow', name: '目玉喰らいのカラス' },
        battleState: { highwayFixedDistance: 4 },
        highwayBattleCount: { 2: 2, 4: 1, 6: 1 },
        completedEvents: [
          'phase8_wagon_journey_completed',
          'highway_1m_entry',
          'highway_2m_rats_intro',
          'highway_2m_rats_interlude',
          'highway_3m_ambient',
          'highway_4m_crows_intro',
        ],
      });
      Object.assign(RPG.State.flags, {
        onWagon: true,
        scentPouchCrafted: true,
        scentPouchHandedToDriver: true,
        phase7DepartureNightSeen: true,
        phase7DepartureMorningTalkPending: false,
      });
      RPG.State.inventory.scentPouch = 0;
      battleSystem.resolveDefeat();
      return {
        counts: RPG.State.highwayBattleCount,
        completedEvents: RPG.State.completedEvents,
        crafted: RPG.State.flags.scentPouchCrafted,
        handed: RPG.State.flags.scentPouchHandedToDriver,
        scentPouch: RPG.State.inventory.scentPouch,
        nightSeen: RPG.State.flags.phase7DepartureNightSeen,
        morningPending: RPG.State.flags.phase7DepartureMorningTalkPending,
      };
    });
    expect(result).toEqual({
      counts: { 2: 2, 4: 1, 6: 1 },
      completedEvents: [
        'phase8_wagon_journey_completed',
        'highway_1m_entry',
        'highway_2m_rats_intro',
        'highway_2m_rats_interlude',
        'highway_3m_ambient',
        'highway_4m_crows_intro',
      ],
      crafted: true,
      handed: true,
      scentPouch: 0,
      nightSeen: true,
      morningPending: false,
    });
  });

  test('9. the failed ordinal of a fixed battle can be started again', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        storyPhase: 9,
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'highway',
        location: 'かつての街道',
        currentDistance: 4,
        highwayBattleCount: { 2: 2, 4: 1 },
      });
      RPG.State.flags.onWagon = true;

      const retryEvent = RPG.Assets.EVENT_DATA.find(
        event => event.id === 'highway_4m_crows_interlude'
      );
      const originalStart = battleSystem.startHighwayFixedBattle;
      let started = null;
      try {
        battleSystem.startHighwayFixedBattle = (distance, enemyId) => {
          started = { distance, enemyId };
        };
        const available = retryEvent.condition(RPG.State);
        retryEvent.action(RPG.State);
        RPG.State.dialogueQueue[RPG.State.dialogueQueue.length - 1].action();
        return { available, started };
      } finally {
        battleSystem.startHighwayFixedBattle = originalStart;
      }
    });
    expect(result).toEqual({
      available: true,
      started: { distance: 4, enemyId: 'eye_eating_crow' },
    });
  });

  test('10. final boss defeat leaves the 10m arrival available for a retry', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'battle',
        storyPhase: 9,
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'highway',
        location: 'かつての街道',
        currentDistance: 10,
        currentHP: 0,
        isBattling: true,
        currentEnemy: { id: 'amber_husk_giant_larva', name: '琥珀骸の巨虫' },
        battleState: { highwayFixedDistance: 10 },
        highwayBattleCount: { 2: 2, 4: 2, 6: 1, 8: 1 },
      });
      RPG.State.flags.onWagon = true;
      battleSystem.resolveDefeat();

      Object.assign(RPG.State, {
        mode: 'base',
        storyPhase: 9,
        isInDungeon: true,
        explorationArea: 'highway',
        location: 'かつての街道',
        currentDistance: 10,
      });
      RPG.State.flags.onWagon = true;
      const bossEvent = RPG.Assets.EVENT_DATA.find(
        event => event.id === 'highway_10m_boss_arrival'
      );
      return {
        retryAvailable: bossEvent.condition(RPG.State),
        bossWins: RPG.State.highwayBattleCount[10] || 0,
      };
    });
    expect(result).toEqual({ retryAvailable: true, bossWins: 0 });
  });

  test('11. final boss defeat never sets chapter1Cleared', async ({ page }) => {
    const cleared = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'battle',
        storyPhase: 9,
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'highway',
        location: 'かつての街道',
        currentDistance: 10,
        currentHP: 0,
        isBattling: true,
        currentEnemy: { id: 'amber_husk_giant_larva', name: '琥珀骸の巨虫' },
        battleState: { highwayFixedDistance: 10 },
      });
      Object.assign(RPG.State.flags, {
        onWagon: true,
        chapter1Cleared: false,
      });
      battleSystem.resolveDefeat();
      return RPG.State.flags.chapter1Cleared;
    });
    expect(cleared).toBe(false);
  });

  test('retreat state can enter the inn normally', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'battle',
        storyPhase: 9,
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'highway',
        location: 'かつての街道',
        currentDistance: 6,
        currentHP: 0,
        isBattling: true,
        currentEnemy: { id: 'eye_eating_crow', name: '目玉喰らいのカラス' },
        battleState: { highwayFixedDistance: 6 },
      });
      RPG.State.flags.onWagon = true;
      battleSystem.resolveDefeat();
    });
    await drainDialogue(page);

    const result = await page.evaluate(() => {
      innSystem.enterInn(false);
      return {
        atInn: RPG.State.isAtInn,
        inDungeon: RPG.State.isInDungeon,
        area: RPG.State.explorationArea,
        location: RPG.State.location,
        phase: RPG.State.storyPhase,
      };
    });

    expect(result).toEqual({
      atInn: true,
      inDungeon: false,
      area: null,
      location: '宿屋《琥珀亭》',
      phase: 7,
    });
  });

  test('retreat state can fight in the forest and gain experience', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        storyPhase: 7,
        isAtInn: false,
        isInDungeon: false,
        explorationArea: null,
        location: '宿屋前',
        currentDistance: 0,
      });
      Object.assign(RPG.State.flags, {
        onWagon: false,
        forestFirstEnter: true,
      });
      explorationSystem.enterDungeon();

      const expBefore = RPG.State.exp;
      battleSystem.startBattle('rat');
      RPG.State.currentEnemy.hp = 0;
      RPG.State.lastBlowBy = 'Cain';
      battleSystem.endBattle(true);

      return {
        area: RPG.State.explorationArea,
        expBefore,
        expAfter: RPG.State.exp,
        ratWins: RPG.State.defeatCounts.rat.cain,
      };
    });

    expect(result.area).toBe('forest');
    expect(result.expAfter).toBeGreaterThan(result.expBefore);
    expect(result.ratWins).toBe(1);
  });

  test('forest 2m can reboard and re-enter the highway after a retreat', async ({ page }) => {
    const availability = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        storyPhase: 7,
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'forest',
        location: '琥珀の森',
        currentDistance: 2,
        completedEvents: [
          'phase8_wagon_journey_completed',
          'highway_1m_entry',
          'highway_2m_rats_intro',
          'highway_2m_rats_interlude',
        ],
      });
      Object.assign(RPG.State.flags, {
        onWagon: false,
        phase7DepartureNightSeen: true,
        phase7DepartureMorningTalkPending: false,
        scentPouchCrafted: true,
        scentPouchHandedToDriver: true,
        wagonReadyForDeparture: true,
      });
      RPG.State.highwayBattleCount = { 2: 2 };
      RPG.State.inventory.scentPouch = 0;

      const wagonEvent = RPG.Assets.EVENT_DATA.find(
        event => event.id === 'finale_wagon_encounter'
      );
      const available = wagonEvent.condition(RPG.State);
      uiControl.acceptWagonRide();
      return available;
    });

    expect(availability).toBe(true);
    await drainDialogue(page);
    await expect.poll(() => page.evaluate(() => ({
      phase: RPG.State.storyPhase,
      onWagon: RPG.State.flags.onWagon,
    }))).toEqual({ phase: 8, onWagon: true });

    await page.evaluate(() => {
      RPG.State.currentDistance = 10;
      explorationSystem.transitionToHighway();
    });
    await drainDialogue(page);

    const result = await page.evaluate(() => ({
      phase: RPG.State.storyPhase,
      onWagon: RPG.State.flags.onWagon,
      area: RPG.State.explorationArea,
      location: RPG.State.location,
      distance: RPG.State.currentDistance,
      needsScentPouch: explorationSystem.needsHighwayScentPouchHandoff(),
      ratIntroAvailable: RPG.Assets.EVENT_DATA.find(
        event => event.id === 'highway_2m_rats_intro'
      ).condition({
        ...RPG.State,
        currentDistance: 2,
      }),
    }));

    expect(result).toEqual({
      phase: 9,
      onWagon: true,
      area: 'highway',
      location: 'かつての街道',
      distance: 0,
      needsScentPouch: false,
      ratIntroAvailable: false,
    });
  });

  test('completed wagon travel dialogue is skipped after reboarding', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        storyPhase: 8,
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'forest',
        location: '琥珀の森',
        currentDistance: 5,
        completedEvents: ['phase8_wagon_journey_completed'],
      });
      RPG.State.flags.onWagon = true;

      const originalCheckEvents = explorationSystem.checkEvents;
      const originalTreeEncounter = scenarioEvents.treeEventSystem.handleEncounter;
      try {
        explorationSystem.checkEvents = () => false;
        scenarioEvents.treeEventSystem.handleEncounter = () => false;
        explorationSystem.move(1, { skipTravelCue: true });
        return {
          mode: RPG.State.mode,
          distance: RPG.State.currentDistance,
          queue: RPG.State.dialogueQueue,
          log: document.getElementById('logContainer')?.textContent || '',
        };
      } finally {
        explorationSystem.checkEvents = originalCheckEvents;
        scenarioEvents.treeEventSystem.handleEncounter = originalTreeEncounter;
      }
    });

    expect(result.mode).toBe('base');
    expect(result.distance).toBe(6);
    expect(result.queue).toEqual([]);
    expect(result.log).not.toContain('この世界はどうしたらいいんだ');
  });

  test('departure night and departure morning dialogue do not replay after retreat', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        storyPhase: 7,
        isAtInn: true,
        isInDungeon: false,
        explorationArea: null,
        location: '宿屋《琥珀亭》',
        currentDistance: 0,
        canStay: true,
      });
      Object.assign(RPG.State.flags, {
        onWagon: false,
        wagonReadyForDeparture: true,
        phase7DepartureNightSeen: true,
        phase7DepartureMorningTalkPending: false,
      });

      const originalSimpleStay = innSystem.playPhase7SimpleStay;
      const originalFinaleNight = Cinematics.playChapter1FinaleNight;
      let simpleStay = false;
      let finaleNight = false;
      try {
        innSystem.playPhase7SimpleStay = () => {
          simpleStay = true;
        };
        Cinematics.playChapter1FinaleNight = () => {
          finaleNight = true;
        };
        innSystem.stay();
      } finally {
        innSystem.playPhase7SimpleStay = originalSimpleStay;
        Cinematics.playChapter1FinaleNight = originalFinaleNight;
      }

      RPG.State.mode = 'base';
      innSystem.exitInn();
      return {
        simpleStay,
        finaleNight,
        morningPending: RPG.State.flags.phase7DepartureMorningTalkPending,
        modeAfterExit: RPG.State.mode,
        log: document.getElementById('logContainer')?.textContent || '',
      };
    });

    expect(result.simpleStay).toBe(true);
    expect(result.finaleNight).toBe(false);
    expect(result.morningPending).toBe(false);
    expect(result.modeAfterExit).toBe('base');
    expect(result.log).not.toContain('おまえの好物の草は持った？');
  });

  test('12. final boss victory sets clear only after the existing victory scene finishes', async ({ page }) => {
    const immediate = await page.evaluate(() => {
      const template = RPG.Assets.ENEMIES.find(
        enemy => enemy.id === 'amber_husk_giant_larva'
      );
      Object.assign(RPG.State, {
        mode: 'battle',
        storyPhase: 9,
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'highway',
        location: 'かつての街道',
        currentDistance: 10,
        isBattling: true,
        currentEnemy: { ...template, hp: 0 },
        battleState: {
          highwayFixedDistance: 10,
          highwayFixedVictoryRecorded: false,
        },
        lastBlowBy: 'Cain',
        defeatCounts: {
          amber_husk_giant_larva: { cain: 0, owen: 0 },
        },
      });
      Object.assign(RPG.State.flags, {
        onWagon: true,
        chapter1Cleared: false,
      });
      battleSystem.executeStandardVictory('amber_husk_giant_larva');
      return {
        cleared: RPG.State.flags.chapter1Cleared,
        bossWins: RPG.State.highwayBattleCount[10],
        arrivalCompleted: RPG.State.completedEvents.includes('highway_10m_boss_arrival'),
        // The blackout's own action runs synchronously the instant the ending event starts
        // building its dialogueQueue (delay only postpones advancing to the NEXT queue entry,
        // not running the current one's action), so this is already true here - no timing
        // dependency involved.
        blackedOut: document.getElementById('logContainer')?.classList.contains('night-mode'),
      };
    });

    expect(immediate).toEqual({
      cleared: false,
      bossWins: 1,
      arrivalCompleted: true,
      blackedOut: true,
    });

    // Drain up to the ending's opening lines - still mid-scene, before playChapter1Clear()'s
    // own transition clears the log again for the "第1章クリア" card.
    await drainDialogueUntilLogContains(page, '月が明るい。');
    const duringEnding = await page.evaluate(() => ({
      sceneEnding: document.body.classList.contains('scene-ending'),
      log: document.getElementById('logContainer')?.textContent || '',
    }));
    expect(duringEnding.sceneEnding).toBe(true);
    expect(duringEnding.log).toContain('荷馬車は大きな交易路に出た。');
    expect(duringEnding.log).toContain('月が明るい。');

    await drainDialogue(page, 9000);
    await expect.poll(
      () => page.evaluate(() => RPG.State.flags.chapter1Cleared)
    ).toBe(true);
  });

  test('8m highway victory reveals and permanently grants the masochist amber on inspection', async ({ page }) => {
    await page.evaluate(() => {
      const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'hell_rat_swarm');
      Object.assign(RPG.State, {
        mode: 'battle',
        storyPhase: 9,
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'highway',
        location: 'かつての街道',
        currentDistance: 8,
        isBattling: true,
        currentEnemy: { ...template, hp: 0 },
        battleState: {
          highwayFixedDistance: 8,
          highwayFixedVictoryRecorded: false,
        },
        lastBlowBy: 'Cain',
        defeatCounts: { hell_rat_swarm: { cain: 0, owen: 0 } },
      });
      Object.assign(RPG.State.flags, {
        onWagon: true,
        highway8mMasochistAmberAvailable: false,
        highway8mMasochistAmberDiscoverySeen: false,
        highway8mMasochistAmberTaken: false,
      });
      RPG.State.inventory.masochistAmber = 0;
      battleSystem.executeStandardVictory('hell_rat_swarm');
    });

    await drainDialogue(page);
    const afterVictory = await page.evaluate(() => ({
      mode: RPG.State.mode,
      available: RPG.State.flags.highway8mMasochistAmberAvailable,
      discoverySeen: RPG.State.flags.highway8mMasochistAmberDiscoverySeen,
      talkLabel: document.getElementById('btnTalk')?.textContent || '',
      log: document.getElementById('logContainer')?.textContent || '',
    }));
    expect(afterVictory.mode).toBe('base');
    expect(afterVictory.available).toBe(true);
    expect(afterVictory.discoverySeen).toBe(true);
    expect(afterVictory.talkLabel).toBe('調べる');
    expect(afterVictory.log).toContain('隆起した石畳の隙間に、赤黒い琥珀が食い込んでいる。');

    await page.evaluate(() => explorationSystem.talk());
    await drainDialogue(page);
    const afterTake = await page.evaluate(() => ({
      count: RPG.State.inventory.masochistAmber,
      taken: RPG.State.flags.highway8mMasochistAmberTaken,
      log: document.getElementById('logContainer')?.textContent || '',
    }));
    expect(afterTake.count).toBe(1);
    expect(afterTake.taken).toBe(true);
    expect(afterTake.log).toContain('🔸被虐の琥珀を手に入れた！');

    const snapshot = await page.evaluate(() => uiControl.createSaveSnapshot('journal'));
    await page.evaluate(save => {
      localStorage.setItem('highway_8m_masochist_amber_test', JSON.stringify(save));
      RPG.State.inventory.masochistAmber = 0;
      uiControl.loadFromStorage('highway_8m_masochist_amber_test', 'テスト記録');
    }, snapshot);
    await page.waitForTimeout(50);
    await page.evaluate(() => explorationSystem.talk());
    const afterReload = await page.evaluate(() => ({
      count: RPG.State.inventory.masochistAmber,
      taken: RPG.State.flags.highway8mMasochistAmberTaken,
    }));
    expect(afterReload.count).toBe(1);
    expect(afterReload.taken).toBe(true);
  });

  test('13. clear screen shows the chapter ending and returns to the title page', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'highway',
        location: 'かつての街道',
        currentDistance: 10,
      });
      Cinematics.playChapter1Clear();
    });
    await drainDialogue(page);

    const log = page.locator('#logContainer');
    await expect(log).toContainText('第一章　銀貨と宿屋');
    await expect(log).toContainText('――終――');
    const titleButton = page.locator('#btnChapter1Title');
    await expect(titleButton).toHaveText('タイトルへ戻る');
    await expect(titleButton).toHaveCSS('width', /.+/);

    await titleButton.click();
    await expect(page).toHaveURL(/\/index\.html$/);
  });

  test('14. clear state never restores exploration or battle controls', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'highway',
        location: 'かつての街道',
        currentDistance: 10,
      });
      Cinematics.playChapter1Clear();
    });
    await drainDialogue(page);

    const result = await page.evaluate(() => {
      const distanceBefore = RPG.State.currentDistance;
      explorationSystem.move(-1, { skipTravelCue: true });
      battleSystem.startBattle('rat');
      return {
        mode: RPG.State.mode,
        distanceBefore,
        distanceAfter: RPG.State.currentDistance,
        battling: RPG.State.isBattling,
        exploreDisplay: document.getElementById('exploreUI')?.style.display,
        innDisplay: document.getElementById('innUI')?.style.display,
        choiceDisplay: document.getElementById('choiceUI')?.style.display,
        startBattleDisplay: document.getElementById('btnStartBattle')?.style.display,
        miniSaveDisplay: document.getElementById('miniSaveButton')?.style.display,
        actionButtonCount: document.querySelectorAll('#action-buttons button').length,
      };
    });

    expect(result).toEqual({
      mode: 'chapterClear',
      distanceBefore: 10,
      distanceAfter: 10,
      battling: false,
      exploreDisplay: 'none',
      innDisplay: 'none',
      choiceDisplay: 'none',
      startBattleDisplay: 'none',
      miniSaveDisplay: 'none',
      actionButtonCount: 1,
    });
  });

  test('15. normal, amber-tree, giant-larva, and third-defeat routes keep their legacy handlers', async ({ page }) => {
    const result = await page.evaluate(() => {
      const originalDefeatSequence = innSystem.showDefeatSequence;
      const originalTreeDefeat = battleSystem.playAmberTreeDefeatScene;
      const originalLarvaDefeat = Cinematics.playGiantLarvaDefeat;
      const originalBadEnd = innSystem.showBadEnd;
      const calls = {
        normal: null,
        tree: false,
        larva: false,
        badEnd: false,
      };

      try {
        innSystem.showDefeatSequence = enemyId => {
          calls.normal = enemyId;
        };
        battleSystem.playAmberTreeDefeatScene = () => {
          calls.tree = true;
        };
        Cinematics.playGiantLarvaDefeat = () => {
          calls.larva = true;
        };
        innSystem.showBadEnd = () => {
          calls.badEnd = true;
        };

        Object.assign(RPG.State, {
          storyPhase: 5,
          explorationArea: 'forest',
          location: '琥珀の森',
          isBattling: true,
          currentEnemy: { id: 'rat', name: '魔界のネズミ' },
          battleState: {},
        });
        RPG.State.flags.onWagon = false;
        battleSystem.resolveDefeat();

        Object.assign(RPG.State, {
          storyPhase: 1,
          isBattling: true,
          currentEnemy: { id: 'hungry_amber_tree', name: '飢えた琥珀樹' },
          battleState: {},
        });
        battleSystem.resolveDefeat();

        Object.assign(RPG.State, {
          storyPhase: 5,
          isBattling: true,
          currentEnemy: { id: 'giant_larva', name: '泥這う大幼蟲' },
          battleState: {},
        });
        battleSystem.resolveDefeat();

        RPG.State.deathCount = 3;
        originalDefeatSequence.call(innSystem, 'rat');
        return calls;
      } finally {
        innSystem.showDefeatSequence = originalDefeatSequence;
        battleSystem.playAmberTreeDefeatScene = originalTreeDefeat;
        Cinematics.playGiantLarvaDefeat = originalLarvaDefeat;
        innSystem.showBadEnd = originalBadEnd;
      }
    });

    expect(result).toEqual({
      normal: 'rat',
      tree: true,
      larva: true,
      badEnd: true,
    });
  });

  test('the Amber Forest bad end clears its backdrop before ??? and returns to the inn after completion', async ({ page }) => {
    const start = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'forest',
        location: '森の深層',
        currentDistance: 8,
        currentHP: 0,
        maxHP: 140,
        isPoisoned: true,
        dialogueQueue: [],
      });
      visualDirector.clearScene();
      uiControl.updateUI();

      const sceneChanges = [];
      const originalSyncScene = visualDirector.syncScene;
      visualDirector.syncScene = function () {
        sceneChanges.push({ location: RPG.State.location, scene: this.getActiveScene() });
        return originalSyncScene.apply(this, arguments);
      };
      try {
        innSystem.showBadEnd();
      } finally {
        visualDirector.syncScene = originalSyncScene;
      }

      return {
        initialScene: 'forest-deep-day',
        activeScene: visualDirector.getActiveScene(),
        location: RPG.State.location,
        locationLabel: document.getElementById('currentLocationName')?.textContent,
        sceneChanges,
      };
    });

    const clearedIndex = start.sceneChanges.findIndex(change => change.scene === 'none');
    const unknownLocationIndex = start.sceneChanges.findIndex(change => change.location === '？？？');
    expect(start.initialScene).toBe('forest-deep-day');
    expect(start.activeScene).toBe('none');
    expect(start.location).toBe('？？？');
    expect(start.locationLabel).toBe('？？？');
    expect(clearedIndex).toBeGreaterThanOrEqual(0);
    expect(unknownLocationIndex).toBeGreaterThan(clearedIndex);

    await drainDialogue(page, 10000);

    const result = await page.evaluate(() => ({
      mode: RPG.State.mode,
      isAtInn: RPG.State.isAtInn,
      isInDungeon: RPG.State.isInDungeon,
      explorationArea: RPG.State.explorationArea,
      location: RPG.State.location,
      currentDistance: RPG.State.currentDistance,
      currentHP: RPG.State.currentHP,
      maxHP: RPG.State.maxHP,
      isPoisoned: RPG.State.isPoisoned,
      activeScene: visualDirector.getActiveScene(),
      log: document.getElementById('logContainer')?.textContent || '',
    }));
    expect(result).toMatchObject({
      mode: 'base',
      isAtInn: true,
      isInDungeon: false,
      explorationArea: null,
      location: '宿屋《琥珀亭》',
      currentDistance: 0,
      currentHP: 14,
      maxHP: 140,
      isPoisoned: false,
      activeScene: 'inn-lobby',
    });
    expect(result.log).toContain('【BAD END 〜琥珀の森焼失〜】');
  });

  test('fixed encounter table keeps the requested 2/4/6/8/10m order', async ({ page }) => {
    const specs = await page.evaluate(() => (
      [2, 4, 6, 8, 10].map(distance => {
        const spec = battleSystem.getHighwayFixedBattleSpec(distance);
        return [distance, spec.enemyId, spec.requiredWins];
      })
    ));
    expect(specs).toEqual([
      [2, 'hell_rat_swarm', 2],
      [4, 'eye_eating_crow', 2],
      [6, 'eye_eating_crow', 1],
      [8, 'hell_rat_swarm', 1],
      [10, 'amber_husk_giant_larva', 1],
    ]);
  });

  test('fixed battle events are not completed before their battle is won', async ({ page }) => {
    const completed = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        storyPhase: 9,
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'highway',
        location: 'かつての街道',
        currentDistance: 2,
        highwayBattleCount: {},
        completedEvents: ['highway_1m_entry'],
      });
      RPG.State.flags.onWagon = true;
      const originalLoop = explorationSystem.playDialogueLoop;
      try {
        explorationSystem.playDialogueLoop = () => {};
        explorationSystem.checkEvents();
        return RPG.State.completedEvents.includes('highway_2m_rats_intro');
      } finally {
        explorationSystem.playDialogueLoop = originalLoop;
      }
    });
    expect(completed).toBe(false);
  });

  test('Owen victories advance the same fixed-battle counter and continuation', async ({ page }) => {
    const result = await page.evaluate(() => {
      const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'hell_rat_swarm');
      Object.assign(RPG.State, {
        mode: 'battle',
        storyPhase: 9,
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'highway',
        location: 'かつての街道',
        currentDistance: 2,
        isBattling: true,
        currentEnemy: { ...template, hp: 0 },
        battleState: {
          highwayFixedDistance: 2,
          highwayFixedVictoryRecorded: false,
        },
        lastBlowBy: 'Owen',
        defeatCounts: {
          hell_rat_swarm: { cain: 0, owen: 0 },
        },
        highwayBattleCount: {},
      });
      RPG.State.flags.onWagon = true;
      battleSystem.endBattle(false);
      return {
        wins: RPG.State.highwayBattleCount[2],
        introCompleted: RPG.State.completedEvents.includes('highway_2m_rats_intro'),
        mode: RPG.State.mode,
        owenDefeats: RPG.State.defeatCounts.hell_rat_swarm.owen,
      };
    });
    expect(result).toEqual({
      wins: 1,
      introCompleted: true,
      mode: 'event',
      owenDefeats: 1,
    });
  });

  test('Owen life-saving escape cannot skip a highway fixed battle', async ({ page }) => {
    const result = await page.evaluate(() => {
      const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'hell_rat_swarm');
      Object.assign(RPG.State, {
        mode: 'battle',
        storyPhase: 9,
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'highway',
        location: 'かつての街道',
        currentDistance: 2,
        currentHP: 1,
        isPoisoned: true,
        poisonDamageRemaining: 9,
        isBattling: true,
        currentEnemy: { ...template, hp: template.maxHp },
        battleState: {
          highwayFixedDistance: 2,
          highwayFixedVictoryRecorded: false,
        },
        deathCount: 1,
        highwayBattleCount: {},
        completedEvents: ['highway_1m_entry'],
      });
      RPG.State.flags.onWagon = true;

      battleSystem.endBattle(false, true);

      return {
        location: RPG.State.location,
        distance: RPG.State.currentDistance,
        hp: RPG.State.currentHP,
        poisoned: RPG.State.isPoisoned,
        deathCount: RPG.State.deathCount,
        wins: RPG.State.highwayBattleCount[2] || 0,
        completed: RPG.State.completedEvents.includes('highway_2m_rats_intro'),
        battling: RPG.State.isBattling,
      };
    });

    expect(result).toEqual({
      location: '宿屋前',
      distance: 0,
      hp: await page.evaluate(() => RPG.State.maxHP),
      poisoned: false,
      deathCount: 1,
      wins: 0,
      completed: false,
      battling: false,
    });
  });

  test('riding the wagon through the forest greys out 調べる/戻る/アイテム while 進む stays usable, and disembarking re-enables them', async ({ page }) => {
    const onWagon = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'forest',
        location: '琥珀の森',
        currentDistance: 4,
        storyPhase: 8,
      });
      RPG.State.flags.onWagon = true;
      uiControl.updateUI();
      return {
        talk: { text: document.getElementById('btnTalk')?.textContent, disabled: document.getElementById('btnTalk')?.disabled },
        back: { text: document.getElementById('btnMoveBack')?.textContent, disabled: document.getElementById('btnMoveBack')?.disabled },
        item: { text: document.getElementById('btnItem')?.textContent, disabled: document.getElementById('btnItem')?.disabled },
        forwardDisabled: document.getElementById('btnMoveForward')?.disabled,
      };
    });

    expect(onWagon).toEqual({
      talk: { text: '調べる', disabled: true },
      back: { text: '戻る', disabled: true },
      item: { text: 'アイテム', disabled: true },
      forwardDisabled: false,
    });

    const afterDisembark = await page.evaluate(() => {
      RPG.State.flags.onWagon = false;
      uiControl.updateUI();
      return {
        talk: { text: document.getElementById('btnTalk')?.textContent, disabled: document.getElementById('btnTalk')?.disabled },
        item: { text: document.getElementById('btnItem')?.textContent, disabled: document.getElementById('btnItem')?.disabled },
      };
    });

    expect(afterDisembark.talk).toEqual({ text: '調べる', disabled: false });
    expect(afterDisembark.item).toEqual({ text: 'アイテム', disabled: false });
  });
});

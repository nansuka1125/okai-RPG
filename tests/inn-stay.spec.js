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

// A stay's blackout is a text-less {delay: 3000} entry driven by a raw setTimeout, which
// debug.isSkipping does NOT shorten. So tap only when genuinely waiting and give the
// untappable gaps real wall-clock budget.
async function drainStay(page, maxWaitMs = 20000) {
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

  throw new Error('stay did not finish before timeout');
}

function logTexts(page) {
  return page.evaluate(() => (
    Array.from(document.querySelectorAll('#logContainer .log-entry')).map(el => el.textContent)
  ));
}

// Puts Cain at the inn, hurt enough to be allowed to sleep, with every competing night
// scene switched off unless a test opts back in.
async function setStayState(page, overrides = {}) {
  await page.evaluate((ov) => {
    Object.assign(RPG.State, {
      mode: 'base',
      isAtInn: true,
      isInDungeon: false,
      explorationArea: null,
      location: '宿屋《琥珀亭》',
      currentDistance: 0,
      currentHP: 60,
      maxHP: 140,
      canStay: true,
      silverCoins: 0,
      storyPhase: 6,
      travelStepsSinceStay: 5,
      dialogueQueue: [],
      isWaitingForInput: false,
      ...ov.state,
    });
    RPG.State.inventory.silverCoin = 0;
    Object.assign(RPG.State.flags, {
      hasIntroFinished: true,
      introDebtTalkPending: false,
      silverDelivered: true,
      phase6PostDeliverySleepDone: true,
      forest2mPacifiedTalkSeen: false,
      forestPacifiedNightSeen: false,
      matamatabiNightPending: false,
      matamatabiNightSeen: true,
      wagonReadyForDeparture: false,
      phase7DepartureNightSeen: false,
      firstInnSleep: true,
      notebookUnlocked: true,
      amberMerchantMovePending: false,
      // Morning training is part of the shared morning block; keep it out of the way unless
      // a test asks for it.
      morningTraining1Done: true,
      morningTraining2Done: true,
      morningTraining3Done: true,
      morningTraining3Pending: false,
      phase4FortuneConsultDone: false,
      ...ov.flags,
    });
    const log = document.getElementById('logContainer');
    if (log) log.innerHTML = '';
  }, overrides);
}

async function callStay(page) {
  await page.evaluate(() => innSystem.stay());
}

const PACIFIED_NIGHT_LINES = [
  'カインは窓越しに、夜の空気を吸った。',
  'カイン「だいぶ森の雰囲気がよくなった。前はザワザワして、落ち着かなかったもんな」',
  'オーエン「そう？僕は前の方がよかった。静かすぎる」',
  'カイン（…よく考えなくても、こいつがいるんだからそこまでくつろげない）',
  'カイン「…オーエンは、早く寝るタイプか？遅く寝るタイプか？俺は何時に寝ても朝は早く起きてた」',
  'オーエン「おまえのことなんて聞いてないよ。…早いとか遅いとかなんの基準なの。どうでもいい」',
  'オーエンは毛皮を敷いて、その上に丸まった。',
  'オーエン「眠たくなったら、寝る。わかった？」',
  'カイン「…わかった」',
  'カイン（なんか説得されてしまった）',
];

const LOTTERY_LEAD_INS = [
  '宿屋の店主「銀貨を払ってくれるまでは物置くらいしか空いてないぞ」',
  '宿屋の店主「…馬小屋にでも泊まるかい？」',
  '娘「あの…私の部屋でよかったら」',
];

test.describe('inn stay: fixed room after delivery + forest pacification night', () => {
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

  // --- room fixing ---

  test('1. before the delivery, the storage/stable/daughter lottery is still used', async ({ page }) => {
    await setStayState(page, {
      state: { storyPhase: 2 },
      flags: { silverDelivered: false, phase6PostDeliverySleepDone: false },
    });
    const selected = await page.evaluate(() => {
      window.__selectCalls = 0;
      window.__originalSelect = innSystem.selectInnEvent;
      innSystem.selectInnEvent = function (...args) {
        window.__selectCalls += 1;
        return window.__originalSelect.apply(innSystem, args);
      };
      innSystem.stay();
      innSystem.selectInnEvent = window.__originalSelect;
      return window.__selectCalls;
    });
    await drainStay(page);

    expect(selected).toBe(1);
    const lines = await logTexts(page);
    expect(LOTTERY_LEAD_INS.some(lead => lines.includes(lead))).toBe(true);
    expect(lines).not.toContain('カインはぐっすり眠った…');
  });

  test('2. the one-time long guest-room night still plays and sets its flag', async ({ page }) => {
    await setStayState(page, {
      flags: { phase6PostDeliverySleepDone: false },
    });
    await callStay(page);
    await drainStay(page, 40000);

    const result = await page.evaluate(() => ({
      log: document.getElementById('logContainer')?.textContent || '',
      done: RPG.State.flags.phase6PostDeliverySleepDone,
      currentHP: RPG.State.currentHP,
    }));
    expect(result.log).toContain('【質素な客室】');
    expect(result.log).toContain('オーエンが、カインの背中の上に座っている。');
    expect(result.done).toBe(true);
    expect(result.currentHP).toBe(140);
  });

  test('3. after both flags, an ordinary stay uses the fixed room and heals fully', async ({ page }) => {
    await setStayState(page);
    const sceneAtStay = await page.evaluate(() => {
      innSystem.stay();
      return typeof visualDirector !== 'undefined' ? visualDirector.innSceneOverride : null;
    });
    await drainStay(page);

    const lines = await logTexts(page);
    const expectedOrder = ['カインはぐっすり眠った…', '朝になった！', 'カイン（さあ、出発だ）'];
    let cursor = -1;
    for (const expected of expectedOrder) {
      const idx = lines.indexOf(expected, cursor + 1);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }
    expect(sceneAtStay).toBe('room');

    const result = await page.evaluate(() => ({
      currentHP: RPG.State.currentHP,
      mode: RPG.State.mode,
      travelStepsSinceStay: RPG.State.travelStepsSinceStay,
    }));
    expect(result).toEqual({ currentHP: 140, mode: 'base', travelStepsSinceStay: 0 });
  });

  test('4. the fixed-room stay never draws a lottery event or shows its dialogue', async ({ page }) => {
    await setStayState(page);
    const selectCalls = await page.evaluate(() => {
      window.__selectCalls = 0;
      window.__originalSelect = innSystem.selectInnEvent;
      innSystem.selectInnEvent = function (...args) {
        window.__selectCalls += 1;
        return window.__originalSelect.apply(innSystem, args);
      };
      innSystem.stay();
      innSystem.selectInnEvent = window.__originalSelect;
      return window.__selectCalls;
    });
    await drainStay(page);

    expect(selectCalls).toBe(0);
    const log = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
    for (const lead of LOTTERY_LEAD_INS) {
      expect(log).not.toContain(lead);
    }
    expect(log).not.toContain('物置');
    expect(log).not.toContain('馬小屋');
  });

  test('5. repeated stays keep the fixed room and never fall back to the lottery', async ({ page }) => {
    await setStayState(page);
    await callStay(page);
    await drainStay(page);

    await page.evaluate(() => {
      RPG.State.currentHP = 60;
      RPG.State.canStay = true;
      document.getElementById('logContainer').innerHTML = '';
    });
    await callStay(page);
    await drainStay(page);

    const lines = await logTexts(page);
    expect(lines).toContain('カインはぐっすり眠った…');
    for (const lead of LOTTERY_LEAD_INS) {
      expect(lines).not.toContain(lead);
    }
  });

  test('6. the fixed-room stay leaves the recorded lottery history untouched', async ({ page }) => {
    await setStayState(page, { state: { innEventViewedIds: ['storage_room'] } });
    await callStay(page);
    await drainStay(page);

    const viewed = await page.evaluate(() => [...RPG.State.innEventViewedIds]);
    expect(viewed).toEqual(['storage_room']);
  });

  // --- the stay-permission rules must not change ---

  test('7. a full-HP stay is still refused after the delivery', async ({ page }) => {
    await setStayState(page, { state: { currentHP: 140 } });
    await callStay(page);

    const result = await page.evaluate(() => ({
      log: document.getElementById('logContainer')?.textContent || '',
      mode: RPG.State.mode,
      canStay: RPG.State.canStay,
    }));
    expect(result.log).toContain('カイン「今はまだ休む必要はないな。」');
    expect(result.mode).toBe('base');
    expect(result.canStay).toBe(true);
  });

  test('7b. a full-HP stay is allowed once while awaiting the post-delivery rain sleep, then refused again once slept', async ({ page }) => {
    await setStayState(page, {
      state: { currentHP: 140 },
      flags: { thiefDiscoveryStatus: 1, hasSleptAfterThief: false },
    });
    await callStay(page);
    const firstMode = await drainStay(page);
    const afterFirstStay = await page.evaluate(() => ({
      hasSleptAfterThief: RPG.State.flags.hasSleptAfterThief,
    }));
    expect(firstMode).toBe('base');
    expect(afterFirstStay.hasSleptAfterThief).toBe(true);

    // Mirror the travel-then-return that would normally reopen canStay, then confirm the
    // one-time bypass has closed now that hasSleptAfterThief is satisfied.
    await page.evaluate(() => {
      RPG.State.canStay = true;
      RPG.State.currentHP = RPG.State.maxHP;
    });
    await callStay(page);
    const result = await page.evaluate(() => ({
      log: document.getElementById('logContainer')?.textContent || '',
      mode: RPG.State.mode,
    }));
    expect(result.log).toContain('カイン「今はまだ休む必要はないな。」');
    expect(result.mode).toBe('base');
  });

  test('8. a second stay without travelling in between is still refused', async ({ page }) => {
    await setStayState(page, { state: { canStay: false } });
    await callStay(page);

    const result = await page.evaluate(() => ({
      log: document.getElementById('logContainer')?.textContent || '',
      mode: RPG.State.mode,
    }));
    expect(result.log).toContain('宿屋の店主「悪いが、そう何度も部屋は貸せねえよ。」');
    expect(result.mode).toBe('base');
  });

  // --- the forest pacification night ---

  test('9. without the forest-2m talk, the night does not play', async ({ page }) => {
    await setStayState(page, { flags: { forest2mPacifiedTalkSeen: false } });
    await callStay(page);
    await drainStay(page);

    const result = await page.evaluate(() => ({
      log: document.getElementById('logContainer')?.textContent || '',
      seen: RPG.State.flags.forestPacifiedNightSeen,
    }));
    expect(result.log).not.toContain(PACIFIED_NIGHT_LINES[0]);
    expect(result.log).toContain('カインはぐっすり眠った…');
    expect(result.seen).toBe(false);
  });

  test('10-12. the night plays its confirmed lines in order and hands over to one shared morning', async ({ page }) => {
    await setStayState(page, { flags: { forest2mPacifiedTalkSeen: true } });
    await callStay(page);
    await drainStay(page);

    const lines = await logTexts(page);
    let cursor = -1;
    for (const expected of PACIFIED_NIGHT_LINES) {
      const idx = lines.indexOf(expected, cursor + 1);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }

    // The usual one-line stay text must not also appear.
    expect(lines).not.toContain('カインはぐっすり眠った…');

    // Exactly one shared morning, one heal, one recovery log.
    expect(lines.filter(t => t === '朝になった！')).toHaveLength(1);
    expect(lines.filter(t => t === 'カイン（さあ、出発だ）')).toHaveLength(1);
    expect(lines.filter(t => /^HPが \d+ 回復した。$/.test(t || ''))).toHaveLength(1);
    expect(lines.indexOf('朝になった！')).toBeGreaterThan(cursor);

    const result = await page.evaluate(() => ({
      seen: RPG.State.flags.forestPacifiedNightSeen,
      currentHP: RPG.State.currentHP,
      isPoisoned: RPG.State.isPoisoned,
      travelStepsSinceStay: RPG.State.travelStepsSinceStay,
      mode: RPG.State.mode,
    }));
    expect(result).toEqual({
      seen: true, currentHP: 140, isPoisoned: false, travelStepsSinceStay: 0, mode: 'base',
    });
  });

  test('13. the next stay after the night returns to the ordinary fixed-room stay', async ({ page }) => {
    await setStayState(page, { flags: { forest2mPacifiedTalkSeen: true } });
    await callStay(page);
    await drainStay(page);

    await page.evaluate(() => {
      RPG.State.currentHP = 60;
      RPG.State.canStay = true;
      document.getElementById('logContainer').innerHTML = '';
    });
    await callStay(page);
    await drainStay(page);

    const lines = await logTexts(page);
    expect(lines).not.toContain(PACIFIED_NIGHT_LINES[0]);
    expect(lines).toContain('カインはぐっすり眠った…');
  });

  test('14. the departure-eve night wins and leaves the pacification night unseen for later', async ({ page }) => {
    await setStayState(page, {
      flags: { forest2mPacifiedTalkSeen: true, wagonReadyForDeparture: true },
    });
    const finaleCalled = await page.evaluate(() => {
      const original = Cinematics.playChapter1FinaleNight;
      let called = false;
      try {
        Cinematics.playChapter1FinaleNight = () => { called = true; };
        innSystem.stay();
      } finally {
        Cinematics.playChapter1FinaleNight = original;
      }
      return called;
    });
    expect(finaleCalled).toBe(true);

    const seen = await page.evaluate(() => RPG.State.flags.forestPacifiedNightSeen);
    expect(seen).toBe(false);

    // Held over: once the departure night is behind him, the next ordinary stay plays it.
    await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', currentHP: 60, canStay: true });
      RPG.State.flags.wagonReadyForDeparture = false;
      document.getElementById('logContainer').innerHTML = '';
    });
    await callStay(page);
    await drainStay(page);

    const lines = await logTexts(page);
    expect(lines).toContain(PACIFIED_NIGHT_LINES[0]);
    const seenAfter = await page.evaluate(() => RPG.State.flags.forestPacifiedNightSeen);
    expect(seenAfter).toBe(true);
  });

  test('the wagon-departure finale sets the room scene at 朝になった！ and the lobby scene after さあ出発だ！', async ({ page }) => {
    // The finale night's own real 3s blackout delay and long typewriter dialogue aren't
    // relevant here; only the scene-setting calls wired to each queue entry are, so the
    // queue is inspected directly instead of playing the whole scene out.
    const result = await page.evaluate(() => {
      const originalLoop = explorationSystem.playDialogueLoop;
      const originalSetInnScene = visualDirector.setInnScene;
      const sceneChanges = [];
      visualDirector.setInnScene = (name) => {
        sceneChanges.push(name);
        originalSetInnScene.call(visualDirector, name);
      };
      explorationSystem.playDialogueLoop = () => {};

      Cinematics.playChapter1FinaleNight();
      const queue = RPG.State.dialogueQueue;

      sceneChanges.length = 0;
      queue.find(line => line.text === '朝になった！').action();
      const afterMorning = [...sceneChanges];

      sceneChanges.length = 0;
      queue[queue.length - 1].action();
      const afterFinal = [...sceneChanges];

      explorationSystem.playDialogueLoop = originalLoop;
      visualDirector.setInnScene = originalSetInnScene;

      return {
        afterMorning,
        afterFinal,
        storyPhase: RPG.State.storyPhase,
        mode: RPG.State.mode,
      };
    });

    expect(result.afterMorning).toEqual(['room']);
    expect(result.afterFinal).toContain('lobby');
    expect(result.storyPhase).toBe(7);
    expect(result.mode).toBe('base');
  });

  test('15. the night also plays on a Phase 7 stay', async ({ page }) => {
    await setStayState(page, {
      state: { storyPhase: 7 },
      flags: { forest2mPacifiedTalkSeen: true, phase7DepartureNightSeen: true },
    });
    await callStay(page);
    await drainStay(page);

    const lines = await logTexts(page);
    expect(lines).toContain(PACIFIED_NIGHT_LINES[0]);
    expect(lines).toContain('朝になった！');
    const seen = await page.evaluate(() => RPG.State.flags.forestPacifiedNightSeen);
    expect(seen).toBe(true);
  });

  // --- everything the generic body used to do must survive ---

  test('16. the shared post-stay bookkeeping still runs', async ({ page }) => {
    await setStayState(page, {
      state: { travelStepsSinceStay: 12 },
      flags: { herbGardenHerb1Available: false },
    });
    await callStay(page);
    await drainStay(page);

    const result = await page.evaluate(() => ({
      travelStepsSinceStay: RPG.State.travelStepsSinceStay,
      herb1: RPG.State.flags.herbGardenHerb1Available,
    }));
    expect(result).toEqual({ travelStepsSinceStay: 0, herb1: true });
  });

  test('the ordinary stay blackout covers the log with a fading overlay instead of hiding entries, and leaves the bottom menu untouched', async ({ page }) => {
    await setStayState(page);
    await page.evaluate(() => {
      uiControl.addLog('カインはぐっすり眠った…');
    });

    const before = await page.evaluate(() => ({
      stayDisplay: getComputedStyle(document.getElementById('btnInnStay')).display,
      innUIDisplay: getComputedStyle(document.getElementById('innUI')).display,
    }));

    await callStay(page);

    // The opening lines before the blackout are ordinary tap-gated dialogue, so drive taps
    // (isSkipping-style) until night-mode actually engages, the same way drainStay() does.
    await page.evaluate(() => { RPG.State.debug.isSkipping = true; });
    let hasNightMode = false;
    for (let i = 0; i < 200 && !hasNightMode; i++) {
      hasNightMode = await page.evaluate(() => (
        document.getElementById('logContainer')?.classList.contains('night-mode') === true
      ));
      if (hasNightMode) break;
      const waiting = await page.evaluate(() => (
        RPG.State.isWaitingForInput === true || explorationSystem.hasActiveTypewriter()
      ));
      if (waiting) await page.evaluate(() => uiControl.handlePlayerInput());
      await page.waitForTimeout(30);
    }
    expect(hasNightMode).toBe(true);

    const opacityEarly = await page.evaluate(() => (
      Number(getComputedStyle(document.getElementById('logContainer'), '::before').opacity)
    ));

    await page.waitForTimeout(700);

    const duringBlackout = await page.evaluate(() => {
      const container = document.getElementById('logContainer');
      const entries = [...container.querySelectorAll('.log-entry')];
      return {
        hasNightMode: container.classList.contains('night-mode'),
        overlayOpacity: Number(getComputedStyle(container, '::before').opacity),
        entryCount: entries.length,
        entryDisplays: entries.map(entry => getComputedStyle(entry).display),
        stayDisplay: getComputedStyle(document.getElementById('btnInnStay')).display,
        innUIDisplay: getComputedStyle(document.getElementById('innUI')).display,
      };
    });

    expect(duringBlackout.hasNightMode).toBe(true);
    // The overlay is actively fading in over time, not an instant display:none-style snap.
    expect(duringBlackout.overlayOpacity).toBeGreaterThan(opacityEarly);
    // The pre-existing entry stays laid out in the DOM the whole time - only covered, not hidden.
    expect(duringBlackout.entryCount).toBeGreaterThan(0);
    expect(duringBlackout.entryDisplays.every(display => display !== 'none')).toBe(true);
    // The bottom menu never changes because of the blackout.
    expect(duringBlackout.stayDisplay).toBe(before.stayDisplay);
    expect(duringBlackout.innUIDisplay).toBe(before.innUIDisplay);

    await drainStay(page);
  });

  test('17. a pending morning training still plays instead of the plain morning', async ({ page }) => {
    await setStayState(page, {
      flags: {
        phase4FortuneConsultDone: true,
        morningTraining2Done: false,
        morningTraining3Done: false,
      },
    });
    await callStay(page);
    await drainStay(page);

    const result = await page.evaluate(() => ({
      log: document.getElementById('logContainer')?.textContent || '',
      done: RPG.State.flags.morningTraining2Done,
      location: RPG.State.location,
      currentHP: RPG.State.currentHP,
    }));
    expect(result.done).toBe(true);
    expect(result.location).toBe('宿屋前');
    expect(result.currentHP).toBe(140);
    // The training scene replaces the plain morning block.
    expect(result.log).not.toContain('朝になった！');
  });

  test('18. a hurt stay without the notebook still unlocks it and grants the herbs', async ({ page }) => {
    await setStayState(page, { flags: { notebookUnlocked: false } });
    await page.evaluate(() => { RPG.State.inventory.herb = 0; });
    await callStay(page);
    await drainStay(page);

    const result = await page.evaluate(() => ({
      notebookUnlocked: RPG.State.flags.notebookUnlocked,
      herb: RPG.State.inventory.herb,
    }));
    expect(result).toEqual({ notebookUnlocked: true, herb: 3 });
  });

  test('19. the new flag round-trips and defaults to unseen on an old save', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.forestPacifiedNightSeen = true;
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_pacified_night_test', JSON.stringify(snapshot));

      const legacySave = JSON.parse(JSON.stringify(snapshot));
      delete legacySave.flags.forestPacifiedNightSeen;
      localStorage.setItem('okai_rpg_pacified_night_legacy', JSON.stringify(legacySave));

      RPG.State.flags.forestPacifiedNightSeen = false;
      uiControl.loadFromStorage('okai_rpg_pacified_night_test', '平常化夜テスト');
      const roundTrip = RPG.State.flags.forestPacifiedNightSeen;

      RPG.State.flags.forestPacifiedNightSeen = true;
      uiControl.loadFromStorage('okai_rpg_pacified_night_legacy', '旧セーブ平常化夜テスト');
      const legacyDefault = RPG.State.flags.forestPacifiedNightSeen;

      return { roundTrip, legacyDefault };
    });
    expect(result).toEqual({ roundTrip: true, legacyDefault: false });
  });
});

const PICNIC_DATE_MARKER = '【ピクニックデート】';
const PICNIC_FOREST_FIRST_LINE = 'ーーー';
const PICNIC_FOREST_LAST_LINE = '（一蓮托生という言葉が浮かんだ）';
const PICNIC_INN_FRONT_FIRST_LINE = '娘は仕事に戻っていった。';
const PICNIC_INN_FRONT_LAST_LINE = 'だが何も言わなかった。';

// v2: the date button unlocks after the player reads secretLetter, stays once, and completes the
// herb-garden handhold event.
test.describe('inn stay: picnic date button (secretLetter)', () => {
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

  async function notebookButtonState(page) {
    await page.evaluate(() => uiControl.updateUI());
    return page.evaluate(() => {
      const btn = document.getElementById('btnInnNotebook');
      return { text: btn?.textContent, disabled: Boolean(btn?.disabled), display: btn?.style.display };
    });
  }

  test('without secretLetter, the button stays the normal claimable notebook', async ({ page }) => {
    await setStayState(page, { flags: { notebookUnlocked: true } });
    const state = await notebookButtonState(page);
    expect(state).toEqual({ text: '討伐ノート', disabled: false, display: 'flex' });
  });

  test('holding the letter before any stay, the button is 討伐ノート but grayed out', async ({ page }) => {
    await setStayState(page, { flags: { herbGardenHandholdAttempted: true } });
    await page.evaluate(() => { RPG.State.inventory.secretLetter = 1; });
    const state = await notebookButtonState(page);
    expect(state).toEqual({ text: '討伐ノート', disabled: true, display: 'flex' });
  });

  test('a read letter stays locked after one stay until the herb-garden handhold flag is set', async ({ page }) => {
    await setStayState(page, { flags: { herbGardenHandholdAttempted: false } });
    await page.evaluate(() => {
      RPG.State.inventory.secretLetter = 1;
      explorationSystem.useItem('secretLetter');
    });
    await drainStay(page);
    await callStay(page);
    await drainStay(page);

    const beforeHandhold = await notebookButtonState(page);
    expect(beforeHandhold).toEqual({ text: '討伐ノート', disabled: true, display: 'flex' });

    const afterHandhold = await page.evaluate(() => {
      RPG.State.flags.herbGardenHandholdAttempted = true;
      uiControl.updateUI();
      const btn = document.getElementById('btnInnNotebook');
      return { text: btn?.textContent, disabled: Boolean(btn?.disabled), display: btn?.style.display };
    });
    expect(afterHandhold).toEqual({ text: '娘とデート', disabled: false, display: 'flex' });
  });

  test('reading the letter and staying does not start the date until the unlocked command is used', async ({ page }) => {
    await setStayState(page, { flags: { herbGardenHandholdAttempted: true } });
    await page.evaluate(() => {
      RPG.State.inventory.secretLetter = 1;
      explorationSystem.useItem('secretLetter');
    });
    await drainStay(page);
    await callStay(page);
    await drainStay(page);

    const result = await page.evaluate(() => ({
      secretLetter: RPG.State.inventory.secretLetter,
      mode: RPG.State.mode,
      log: document.getElementById('logContainer')?.textContent || '',
    }));
    expect(result.secretLetter).toBe(1);
    expect(result.mode).toBe('base');
    expect(result.log).not.toContain('【ピクニックデート】');
    expect(await notebookButtonState(page)).toEqual({ text: '娘とデート', disabled: false, display: 'flex' });
  });

  test('an unread letter stays pending after a stay, without starting the date', async ({ page }) => {
    await setStayState(page, { flags: { herbGardenHandholdAttempted: true } });
    await page.evaluate(() => { RPG.State.inventory.secretLetter = 1; });
    await callStay(page);
    await drainStay(page);

    const state = await notebookButtonState(page);
    expect(state).toEqual({ text: '討伐ノート', disabled: true, display: 'flex' });
  });

  test('clicking the date button plays the full scene and finishes at the inn front', async ({ page }) => {
    await setStayState(page, { flags: { herbGardenHandholdAttempted: true } });
    await page.evaluate(() => { RPG.State.inventory.secretLetter = 1; });
    await callStay(page);
    await drainStay(page);

    await page.evaluate(() => innSystem.playPicnicDateScene());
    await drainStay(page, 30000);

    const lines = await logTexts(page);
    const expectedOrder = [
      PICNIC_DATE_MARKER,
      PICNIC_FOREST_FIRST_LINE,
      PICNIC_FOREST_LAST_LINE,
      PICNIC_INN_FRONT_FIRST_LINE,
      PICNIC_INN_FRONT_LAST_LINE,
    ];
    let cursor = -1;
    for (const expected of expectedOrder) {
      const idx = lines.indexOf(expected, cursor + 1);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }

    const result = await page.evaluate(() => ({
      secretLetter: RPG.State.inventory.secretLetter,
      mode: RPG.State.mode,
      sceneOverride: visualDirector.sceneOverride,
      location: RPG.State.location,
      isInDungeon: RPG.State.isInDungeon,
      explorationArea: RPG.State.explorationArea,
      currentDistance: RPG.State.currentDistance,
      isAtInn: RPG.State.isAtInn,
      picnicDateStaySincePassed: RPG.State.flags.picnicDateStaySincePassed,
    }));
    expect(result).toEqual({
      secretLetter: 0,
      mode: 'base',
      sceneOverride: null,
      location: '宿屋前',
      isInDungeon: false,
      explorationArea: null,
      currentDistance: 0,
      isAtInn: false,
      picnicDateStaySincePassed: false,
    });

    const state = await notebookButtonState(page);
    expect(state).toEqual({ text: '討伐ノート', disabled: false, display: 'flex' });
  });

  test('an ordinary stay is unaffected when no letter is held', async ({ page }) => {
    await setStayState(page);
    await callStay(page);
    await drainStay(page);

    const lines = await logTexts(page);
    expect(lines).not.toContain(PICNIC_DATE_MARKER);
    expect(lines).toContain('カインはぐっすり眠った…');
  });
});

// Stable/storage midnight interlude, offered only during the inn-repair damage investigation
// window (innRepairInspectionUnlocked, before the report). Forces the ordinary lottery branch
// exactly like the "before the delivery" tests above (storyPhase 2, silverDelivered/
// phase6PostDeliverySleepDone both false), then pins the lodging via selectInnEvent the same
// way an existing test counts its calls.
test.describe('inn stay: midnight interlude (stable/storage, repair investigation window)', () => {
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

  async function setInvestigationLottery(page, lodgingId, overrides = {}) {
    await setStayState(page, {
      state: { storyPhase: 2, ...overrides.state },
      flags: {
        silverDelivered: false,
        phase6PostDeliverySleepDone: false,
        innRepairInspectionUnlocked: true,
        innRepairInspectionReported: false,
        ...overrides.flags,
      },
    });
    await page.evaluate((id) => {
      innSystem.selectInnEvent = () => RPG.Assets.INN_EVENTS.find(e => e.id === id);
    }, lodgingId);
  }

  test('the stable interlude fires once, uses the shared talk/examine/sleep layout with the dynamic door label, then returns to the same stay\'s morning', async ({ page }) => {
    await setInvestigationLottery(page, 'stable', { flags: { innStableMidnightSeen: false } });

    await callStay(page);
    const afterIntro = await drainStay(page);
    expect(afterIntro).toBe('choice');

    const intro = await page.evaluate(() => ({
      log: document.getElementById('logContainer')?.textContent || '',
      buttons: [...document.querySelectorAll('#action-buttons button')].map(b => b.textContent),
    }));
    expect(intro.log).toContain('カイン（ふわぁ…目が覚めちまったな）');
    expect(intro.log).toContain('オーエン「…ん」');
    expect(intro.buttons).toEqual(['【話す】', '【齧られた扉】', '【寝る】']);

    await page.getByRole('button', { name: '【話す】', exact: true }).click();
    await drainStay(page);
    const afterTalk = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
    expect(afterTalk).toContain('すごく眠そうだ');

    await page.getByRole('button', { name: '【齧られた扉】', exact: true }).click();
    await drainStay(page);
    const afterDoor = await page.evaluate(() => ({
      log: document.getElementById('logContainer')?.textContent || '',
      buttons: [...document.querySelectorAll('#action-buttons button')].map(b => b.textContent),
    }));
    expect(afterDoor.log).toContain('扉の端が齧られている。');
    expect(afterDoor.log).toContain('オーエン「熱心だね」');
    // The label switches to 【調べる】 once the door has been seen once.
    expect(afterDoor.buttons).toContain('【調べる】');

    await page.getByRole('button', { name: '【調べる】', exact: true }).click();
    await drainStay(page);
    const afterDoorAgain = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
    expect(afterDoorAgain).toContain('カイン（もう十分だ。寝よう）');

    const beforeSleep = await page.evaluate(() => ({
      currentHP: RPG.State.currentHP,
      travelStepsSinceStay: RPG.State.travelStepsSinceStay,
    }));

    await page.getByRole('button', { name: '【寝る】', exact: true }).click();
    const finalMode = await drainStay(page);
    expect(finalMode).toBe('base');

    const after = await page.evaluate(() => ({
      currentHP: RPG.State.currentHP,
      travelStepsSinceStay: RPG.State.travelStepsSinceStay,
      stableSeen: RPG.State.flags.innStableMidnightSeen,
    }));
    // The heal/bookkeeping node already ran before the interlude started; 寝る must not re-run it.
    expect(after.currentHP).toBe(beforeSleep.currentHP);
    expect(after.travelStepsSinceStay).toBe(beforeSleep.travelStepsSinceStay);
    expect(after.stableSeen).toBe(true);

    // A second stay, still mid-investigation, at the same lodging: must not fire again.
    await setInvestigationLottery(page, 'stable');
    await callStay(page);
    const secondMode = await drainStay(page);
    expect(secondMode).toBe('base');
    const secondLog = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
    expect(secondLog).not.toContain('ふわぁ…目が覚めちまったな');
  });

  test('does not fire when a higher-priority night event is pending (matamatabi night pre-empts the ordinary lottery entirely)', async ({ page }) => {
    await setStayState(page, {
      state: { storyPhase: 2 },
      flags: {
        silverDelivered: false,
        phase6PostDeliverySleepDone: false,
        matamatabiNightPending: true,
        matamatabiNightSeen: false,
        innRepairInspectionUnlocked: true,
        innRepairInspectionReported: false,
        innStableMidnightSeen: false,
      },
    });

    const selectCalls = await page.evaluate(() => {
      const original = innSystem.selectInnEvent;
      let calls = 0;
      innSystem.selectInnEvent = function (...args) {
        calls += 1;
        return original.apply(innSystem, args);
      };
      innSystem.stay();
      innSystem.selectInnEvent = original;
      return calls;
    });

    // The matamatabi-night branch returns from stay() long before the ordinary lottery (and
    // thus the midnight-interlude check) is ever reached.
    expect(selectCalls).toBe(0);
    const stableSeen = await page.evaluate(() => RPG.State.flags.innStableMidnightSeen);
    expect(stableSeen).toBe(false);
  });

  test('repair-investigation priority: with both midnight interludes unseen, the ordinary lottery only ever weighs stable vs storage_room', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.innRepairInspectionUnlocked = true;
      RPG.State.flags.innRepairInspectionReported = false;
      RPG.State.flags.innStableMidnightSeen = false;
      RPG.State.flags.innStorageMidnightSeen = false;

      const originalRandom = Math.random;
      Math.random = () => 0.01; // lands in storage_room's share (weight 50 of 80)
      const lowPick = innSystem.selectInnEvent().id;
      Math.random = () => 0.99; // lands in stable's share
      const highPick = innSystem.selectInnEvent().id;
      Math.random = originalRandom;
      return { lowPick, highPick };
    });
    expect(result).toEqual({ lowPick: 'storage_room', highPick: 'stable' });
  });

  test('repair-investigation priority: with only the stable interlude unseen, the lottery always picks stable', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.innRepairInspectionUnlocked = true;
      RPG.State.flags.innRepairInspectionReported = false;
      RPG.State.flags.innStableMidnightSeen = false;
      RPG.State.flags.innStorageMidnightSeen = true;

      const originalRandom = Math.random;
      Math.random = () => 0.01;
      const lowPick = innSystem.selectInnEvent().id;
      Math.random = () => 0.99;
      const highPick = innSystem.selectInnEvent().id;
      Math.random = originalRandom;
      return { lowPick, highPick };
    });
    expect(result).toEqual({ lowPick: 'stable', highPick: 'stable' });
  });

  test('repair-investigation priority: with only the storage interlude unseen, the lottery always picks storage_room', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.flags.innRepairInspectionUnlocked = true;
      RPG.State.flags.innRepairInspectionReported = false;
      RPG.State.flags.innStableMidnightSeen = true;
      RPG.State.flags.innStorageMidnightSeen = false;

      const originalRandom = Math.random;
      Math.random = () => 0.01;
      const lowPick = innSystem.selectInnEvent().id;
      Math.random = () => 0.99;
      const highPick = innSystem.selectInnEvent().id;
      Math.random = originalRandom;
      return { lowPick, highPick };
    });
    expect(result).toEqual({ lowPick: 'storage_room', highPick: 'storage_room' });
  });

  test('repair-investigation priority ends once both interludes are seen: the ordinary lottery can pick daughter_room again', async ({ page }) => {
    const pick = await page.evaluate(() => {
      RPG.State.flags.innRepairInspectionUnlocked = true;
      RPG.State.flags.innRepairInspectionReported = false;
      RPG.State.flags.innStableMidnightSeen = true;
      RPG.State.flags.innStorageMidnightSeen = true;
      RPG.State.innEventViewedIds = ['storage_room', 'stable', 'daughter_room'];

      const originalRandom = Math.random;
      // Total weight is 90 (50+30+10) once every event has been viewed; 0.95*90=85.5 falls
      // in daughter_room's slot ([80,90)), which the repair-priority override would otherwise
      // never allow through.
      Math.random = () => 0.95;
      const result = innSystem.selectInnEvent().id;
      Math.random = originalRandom;
      return result;
    });
    expect(pick).toBe('daughter_room');
  });

  test('the storage interlude yields smoke bomb, high herb, then a fixed-sparkling unknown amber in order, then goes quiet', async ({ page }) => {
    await setInvestigationLottery(page, 'storage_room', { flags: { innStorageMidnightSeen: false } });
    await page.evaluate(() => {
      RPG.State.inventory.smokeBomb = 0;
      RPG.State.inventory.highHerb = 0;
      RPG.State.inventory.unknownAmber = 0;
      RPG.State.unappraisedAmberResults = [];
    });

    await callStay(page);
    expect(await drainStay(page)).toBe('choice');

    const initialButtons = await page.evaluate(() => (
      [...document.querySelectorAll('#action-buttons button')].map(b => b.textContent)
    ));
    expect(initialButtons).toEqual(['【話す】', '【棚を見る】', '【寝る】']);

    const examine = async () => {
      await page.getByRole('button', { name: /^【棚を見る】$|^【調べる】$/, exact: true }).click();
      await drainStay(page);
    };

    await examine(); // 1st: nothing yet
    let snap = await page.evaluate(() => ({
      log: document.getElementById('logContainer')?.textContent || '',
      smokeBomb: RPG.State.inventory.smokeBomb,
      buttons: [...document.querySelectorAll('#action-buttons button')].map(b => b.textContent),
    }));
    expect(snap.log).toContain('ここにはまだネズミの被害は無さそうだ');
    expect(snap.smokeBomb).toBe(0);
    // The label switches to 【調べる】 once the shelf has been searched once.
    expect(snap.buttons).toContain('【調べる】');

    await examine(); // 2nd: smoke bomb
    snap = await page.evaluate(() => ({
      log: document.getElementById('logContainer')?.textContent || '',
      smokeBomb: RPG.State.inventory.smokeBomb,
    }));
    expect(snap.log).toContain('💨煙玉を見つけた！');
    expect(snap.smokeBomb).toBe(1);

    await examine(); // 3rd: high herb
    snap = await page.evaluate(() => ({
      log: document.getElementById('logContainer')?.textContent || '',
      highHerb: RPG.State.inventory.highHerb,
    }));
    expect(snap.log).toContain('🌿上薬草を見つけた！');
    expect(snap.highHerb).toBe(1);

    await examine(); // 4th: unknown amber, fixed to sparkling
    snap = await page.evaluate(() => ({
      log: document.getElementById('logContainer')?.textContent || '',
      unknownAmber: RPG.State.inventory.unknownAmber,
      queued: RPG.State.unappraisedAmberResults,
    }));
    expect(snap.log).toContain('🔸？琥珀を見つけた！');
    expect(snap.unknownAmber).toBe(1);
    expect(snap.queued).toEqual(['sparkling']);

    await examine(); // 5th: Owen comment, no item
    snap = await page.evaluate(() => ({
      log: document.getElementById('logContainer')?.textContent || '',
      unknownAmber: RPG.State.inventory.unknownAmber,
    }));
    expect(snap.log).toContain('本当に手癖が悪いね');
    expect(snap.unknownAmber).toBe(1);

    await examine(); // 6th+: nothing more
    snap = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
    expect(snap).toContain('カイン（もうやめよう）');
  });

  test('the interlude menu omits the item command and uses the shared grid layout', async ({ page }) => {
    await setInvestigationLottery(page, 'stable', { flags: { innStableMidnightSeen: false } });

    await callStay(page);
    expect(await drainStay(page)).toBe('choice');

    const after = await page.evaluate(() => ({
      buttons: [...document.querySelectorAll('#action-buttons button')].map(b => b.textContent),
      display: document.getElementById('action-buttons')?.style.display,
      grid: document.getElementById('action-buttons')?.classList.contains('btn-grid'),
    }));
    expect(after).toEqual({
      buttons: ['【話す】', '【齧られた扉】', '【寝る】'],
      display: 'grid',
      grid: true,
    });
  });

  test('the 3 midnight-interlude buttons stay visible during dialogue (disabled, not hidden) and re-enable once it returns to the menu', async ({ page }) => {
    await setInvestigationLottery(page, 'stable', { flags: { innStableMidnightSeen: false } });

    await callStay(page);
    expect(await drainStay(page)).toBe('choice');

    const before = await page.evaluate(() => ({
      display: document.getElementById('action-buttons')?.style.display,
      buttons: [...document.querySelectorAll('#action-buttons button')].map(b => ({ text: b.textContent, disabled: b.disabled })),
    }));
    expect(before.display).toBe('grid');
    expect(before.buttons.map(b => b.text)).toEqual(['【話す】', '【齧られた扉】', '【寝る】']);
    expect(before.buttons.every(b => b.disabled === false)).toBe(true);

    await page.getByRole('button', { name: '【話す】', exact: true }).click();

    // Mid-dialogue: the same 3 buttons stay on screen (not display:none, so the footer/log
    // height does not shift), but they're locked out while mode is 'event'.
    const during = await page.evaluate(() => ({
      mode: RPG.State.mode,
      display: document.getElementById('action-buttons')?.style.display,
      buttons: [...document.querySelectorAll('#action-buttons button')].map(b => ({ text: b.textContent, disabled: b.disabled })),
    }));
    expect(during.mode).toBe('event');
    expect(during.display).toBe('grid');
    expect(during.buttons.map(b => b.text)).toEqual(['【話す】', '【齧られた扉】', '【寝る】']);
    expect(during.buttons.every(b => b.disabled === true)).toBe(true);

    expect(await drainStay(page)).toBe('choice');

    const after = await page.evaluate(() => ({
      display: document.getElementById('action-buttons')?.style.display,
      buttons: [...document.querySelectorAll('#action-buttons button')].map(b => ({ text: b.textContent, disabled: b.disabled })),
    }));
    expect(after.display).toBe('grid');
    expect(after.buttons.map(b => b.text)).toEqual(['【話す】', '【齧られた扉】', '【寝る】']);
    expect(after.buttons.every(b => b.disabled === false)).toBe(true);
  });

  test('an updateUI() call mid-dialogue during the interlude never falls back to the ordinary innUI/exploreUI', async ({ page }) => {
    await setInvestigationLottery(page, 'stable', { flags: { innStableMidnightSeen: false } });

    await callStay(page);
    expect(await drainStay(page)).toBe('choice');

    // Item-grant lines in the interlude (e.g. buildStorageShelfLines's smoke-bomb/highHerb/
    // ？琥珀 actions) call uiControl.updateUI() while RPG.State.mode is still 'event', not
    // 'choice'. Reproduce that directly instead of racing real dialogue timing.
    const result = await page.evaluate(() => {
      RPG.State.mode = 'event';
      uiControl.updateUI();
      return {
        mode: RPG.State.mode,
        innUiDisplay: document.getElementById('innUI')?.style.display,
        exploreUiDisplay: document.getElementById('exploreUI')?.style.display,
      };
    });
    expect(result).toEqual({ mode: 'event', innUiDisplay: 'none', exploreUiDisplay: 'none' });
  });
});

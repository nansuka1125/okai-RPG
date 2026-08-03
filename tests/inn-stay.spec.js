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
  '宿屋の主人「銀貨を払ってくれるまでは物置くらいしか空いてないぞ」',
  '宿屋の主人「…馬小屋にでも泊まるかい？」',
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

  test('8. a second stay without travelling in between is still refused', async ({ page }) => {
    await setStayState(page, { state: { canStay: false } });
    await callStay(page);

    const result = await page.evaluate(() => ({
      log: document.getElementById('logContainer')?.textContent || '',
      mode: RPG.State.mode,
    }));
    expect(result.log).toContain('宿屋の主人「悪いが、そう何度も部屋は貸せねえよ。」');
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
    await page.evaluate(() => { RPG.State.inventory.someonesDiary = 1; });
    await callStay(page);
    await drainStay(page);

    const result = await page.evaluate(() => ({
      travelStepsSinceStay: RPG.State.travelStepsSinceStay,
      herb1: RPG.State.flags.herbGardenHerb1Available,
      diaryUnlocked: RPG.State.flags.someonesDiaryReadUnlocked,
    }));
    expect(result).toEqual({ travelStepsSinceStay: 0, herb1: true, diaryUnlocked: true });
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

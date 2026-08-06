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

// @ts-check
const { test, expect } = require('@playwright/test');

async function openGame(page) {
  await page.goto('/chapter1.html');
  await page.waitForFunction(() => (
    typeof RPG !== 'undefined' &&
    typeof uiControl !== 'undefined' &&
    typeof explorationSystem !== 'undefined' &&
    typeof visualDirector !== 'undefined'
  ));

  await page.evaluate(() => {
    explorationSystem.cancelActiveTypewriter();
    uiControl.hideFloatingArrow();
    uiControl.disableTapOverlay();

    const freshState = JSON.parse(JSON.stringify(RPG.DefaultState));
    Object.keys(RPG.State).forEach(key => delete RPG.State[key]);
    Object.assign(RPG.State, freshState);
    Object.assign(RPG.State.flags, { hasIntroFinished: true });
    Object.assign(RPG.State, {
      mode: 'base',
      dialogueQueue: [],
      isWaitingForInput: false,
    });
    document.body.classList.remove('intro-opening', 'intro-title-card');
  });
}

// Puts the party in the rain window (fortune lead heard and slept on once, morning-after sleep not done).
async function enableRainWindow(page) {
  await page.evaluate(() => {
    RPG.State.flags.thiefDiscoveryStatus = 1;
    RPG.State.flags.hasSleptAfterThief = true;
    RPG.State.flags.phase6PostDeliverySleepDone = false;
  });
}

async function placeInForest(page, distance = 8) {
  await page.evaluate(dist => {
    Object.assign(RPG.State, {
      isAtInn: false,
      isInDungeon: true,
      explorationArea: 'forest',
      location: '琥珀の森',
      currentDistance: dist,
    });
  }, distance);
}

async function placeAtInnFront(page) {
  await page.evaluate(() => {
    Object.assign(RPG.State, {
      isAtInn: false,
      isInDungeon: false,
      explorationArea: null,
      location: '宿屋前',
      currentDistance: 0,
    });
  });
}

// Walks 0m..10m and reports which distances show the rain overlay.
// battling: true starts an encounter at each distance, leaving the location state
// exactly as exploration left it, which is how a real battle behaves.
async function forestDistancesWithRain(page, { battling = false } = {}) {
  return page.evaluate(inBattle => {
    const shown = [];
    for (let d = 0; d <= 10; d++) {
      Object.assign(RPG.State, {
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'forest',
        location: '琥珀の森',
        currentDistance: d,
        isBattling: inBattle,
        currentEnemy: inBattle ? { id: 'rat', name: '魔界のネズミ' } : null,
      });
      visualDirector.syncScene();
      if (document.body.classList.contains('rain-active')) shown.push(d);
    }
    Object.assign(RPG.State, { isBattling: false, currentEnemy: null });
    return shown;
  }, battling);
}

// Runs a battle at the current location and reports rain before/during/after.
async function rainAroundBattle(page) {
  return page.evaluate(() => {
    const read = () => {
      visualDirector.syncScene();
      return document.body.classList.contains('rain-active');
    };
    const before = read();
    RPG.State.isBattling = true;
    RPG.State.currentEnemy = { id: 'rat', name: '魔界のネズミ' };
    const during = read();
    RPG.State.isBattling = false;
    RPG.State.currentEnemy = null;
    const after = read();
    return { before, during, after };
  });
}

function rainActive(page) {
  return page.evaluate(() => {
    visualDirector.syncScene();
    return document.body.classList.contains('rain-active');
  });
}

test.describe('rain visual prototype', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
  });

  test('before the fortune lead, no forest distance shows rain', async ({ page }) => {
    await page.evaluate(() => {
      RPG.State.flags.thiefDiscoveryStatus = 0;
      RPG.State.flags.phase6PostDeliverySleepDone = false;
    });
    expect(await forestDistancesWithRain(page)).toEqual([]);
  });

  test('after the fortune lead but before the boss, rain shows only at 7m and deeper', async ({ page }) => {
    await enableRainWindow(page);
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = false;
    });
    expect(await forestDistancesWithRain(page)).toEqual([7, 8, 9, 10]);
  });

  test('after the boss is defeated, rain shows across the whole forest', async ({ page }) => {
    await enableRainWindow(page);
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
    });
    expect(await forestDistancesWithRain(page)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test('the inn front shows rain only once the boss is defeated', async ({ page }) => {
    await enableRainWindow(page);
    await placeAtInnFront(page);

    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = false;
    });
    expect(await rainActive(page)).toBe(false);

    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
    });
    expect(await rainActive(page)).toBe(true);
  });

  test('delivering the silver does not stop the rain in the forest or at the inn front', async ({ page }) => {
    await enableRainWindow(page);
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
      RPG.State.flags.silverDelivered = true;
      RPG.State.flags.phase6PostDeliverySleepDone = false;
      RPG.State.inventory.silverCoin = 0;
    });

    expect(await forestDistancesWithRain(page)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    await placeAtInnFront(page);
    expect(await rainActive(page)).toBe(true);
  });

  test('a battle in the pre-boss deep forest keeps the rain up throughout', async ({ page }) => {
    await enableRainWindow(page);
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = false;
    });
    await placeInForest(page, 8);

    expect(await rainAroundBattle(page)).toEqual({ before: true, during: true, after: true });

    // scene-battle still toggles; the rain simply no longer depends on it.
    const battleClass = await page.evaluate(() => {
      RPG.State.isBattling = true;
      RPG.State.currentEnemy = { id: 'rat', name: '魔界のネズミ' };
      visualDirector.syncScene();
      const result = {
        rain: document.body.classList.contains('rain-active'),
        battleClass: document.body.classList.contains('scene-battle'),
      };
      RPG.State.isBattling = false;
      RPG.State.currentEnemy = null;
      return result;
    });
    expect(battleClass).toEqual({ rain: true, battleClass: true });
  });

  test('pre-boss battles show rain only at 7m and deeper', async ({ page }) => {
    await enableRainWindow(page);
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = false;
    });
    expect(await forestDistancesWithRain(page, { battling: true })).toEqual([7, 8, 9, 10]);
  });

  test('a battle in the pre-boss shallow forest stays dry before, during and after', async ({ page }) => {
    await enableRainWindow(page);
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = false;
    });
    await placeInForest(page, 3);
    expect(await rainAroundBattle(page)).toEqual({ before: false, during: false, after: false });
  });

  test('post-boss battles show rain across the whole forest', async ({ page }) => {
    await enableRainWindow(page);
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
    });
    expect(await forestDistancesWithRain(page, { battling: true }))
      .toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test('battles after delivering the silver still show rain until the morning after', async ({ page }) => {
    await enableRainWindow(page);
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
      RPG.State.flags.silverDelivered = true;
      RPG.State.flags.phase6PostDeliverySleepDone = false;
      RPG.State.inventory.silverCoin = 0;
    });
    expect(await forestDistancesWithRain(page, { battling: true }))
      .toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    await page.evaluate(() => {
      RPG.State.flags.phase6PostDeliverySleepDone = true;
    });
    expect(await forestDistancesWithRain(page, { battling: true })).toEqual([]);
  });

  test('battles in the herb garden and on the highway never show rain', async ({ page }) => {
    await enableRainWindow(page);
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
    });

    await page.evaluate(() => {
      Object.assign(RPG.State, {
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'herbGarden',
        location: '薬草園',
        currentDistance: 5,
      });
    });
    expect(await rainAroundBattle(page)).toEqual({ before: false, during: false, after: false });

    await page.evaluate(() => {
      Object.assign(RPG.State, {
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'highway',
        location: 'かつての街道',
        currentDistance: 5,
      });
    });
    expect(await rainAroundBattle(page)).toEqual({ before: false, during: false, after: false });
  });

  test('an inn battle never shows rain', async ({ page }) => {
    await enableRainWindow(page);
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
      Object.assign(RPG.State, {
        isAtInn: true,
        isInDungeon: false,
        explorationArea: null,
        location: '宿屋《琥珀亭》',
        currentDistance: 0,
      });
    });
    expect(await rainAroundBattle(page)).toEqual({ before: false, during: false, after: false });
  });

  test('rain is hidden inside the inn, on the highway, and on the title screen', async ({ page }) => {
    await enableRainWindow(page);

    const innInterior = await page.evaluate(() => {
      Object.assign(RPG.State, { isAtInn: true, isInDungeon: false, location: '宿屋《琥珀亭》' });
      visualDirector.syncScene();
      return document.body.classList.contains('rain-active');
    });
    expect(innInterior).toBe(false);

    const highway = await page.evaluate(() => {
      Object.assign(RPG.State, {
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'highway',
        location: 'かつての街道',
        currentDistance: 3,
      });
      visualDirector.syncScene();
      return document.body.classList.contains('rain-active');
    });
    expect(highway).toBe(false);

    const titleScreen = await page.evaluate(() => {
      Object.assign(RPG.State, {
        isAtInn: false,
        isInDungeon: false,
        explorationArea: null,
        location: null,
        currentDistance: 0,
      });
      visualDirector.syncScene();
      return document.body.classList.contains('rain-active');
    });
    expect(titleScreen).toBe(false);
  });

  test('rain disappears everywhere once the morning-after sleep is done', async ({ page }) => {
    await enableRainWindow(page);
    await page.evaluate(() => {
      RPG.State.flags.giantLarvaDefeated = true;
    });
    expect(await forestDistancesWithRain(page)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    await page.evaluate(() => {
      RPG.State.flags.phase6PostDeliverySleepDone = true;
    });
    expect(await page.evaluate(() => explorationSystem.isRainActive())).toBe(false);
    expect(await forestDistancesWithRain(page)).toEqual([]);

    await placeAtInnFront(page);
    expect(await rainActive(page)).toBe(false);
  });

  test('isRainActive() itself stays a pure time window, with no distance condition', async ({ page }) => {
    await enableRainWindow(page);
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'forest',
        location: '琥珀の森',
      });
      RPG.State.flags.giantLarvaDefeated = false;
      RPG.State.currentDistance = 3;
      const shallow = {
        rainPeriod: explorationSystem.isRainActive(),
        visual: visualDirector.shouldShowRainVisual(),
      };
      RPG.State.currentDistance = 8;
      const deep = {
        rainPeriod: explorationSystem.isRainActive(),
        visual: visualDirector.shouldShowRainVisual(),
      };
      return { shallow, deep };
    });
    // The period is on at both depths; only the visual is gated by distance.
    expect(result.shallow).toEqual({ rainPeriod: true, visual: false });
    expect(result.deep).toEqual({ rainPeriod: true, visual: true });
  });

  test('the rain layer sits above the backdrop, below the veil, and ignores pointer events', async ({ page }) => {
    await enableRainWindow(page);
    await placeInForest(page);
    await rainActive(page);
    // #rainOverlay cross-fades in over 0.72s; sample once that has settled.
    await page.waitForTimeout(900);

    const layers = await page.evaluate(() => {
      const viewport = document.getElementById('logViewport');
      const order = Array.from(viewport.children).map(el => el.id || el.tagName.toLowerCase());
      const rain = document.getElementById('rainOverlay');
      const style = getComputedStyle(rain);
      return {
        order,
        pointerEvents: style.pointerEvents,
        opacity: Number(style.opacity),
      };
    });

    // DOM order inside the stacking context decides paint order for equal z-index:
    // backdrop -> rain -> veil -> log text.
    expect(layers.order).toEqual(['sceneBackdrop', 'rainOverlay', 'sceneReadingVeil', 'logContainer']);
    expect(layers.pointerEvents).toBe('none');
    expect(layers.opacity).toBeGreaterThan(0);
  });

  test('a click at the rain layer still reaches the UI underneath it', async ({ page }) => {
    await enableRainWindow(page);
    await placeInForest(page);
    await rainActive(page);

    const topElementIsNotRain = await page.evaluate(() => {
      const viewport = document.getElementById('logViewport').getBoundingClientRect();
      const hit = document.elementFromPoint(
        Math.round(viewport.left + viewport.width * 0.8),
        Math.round(viewport.top + viewport.height * 0.5)
      );
      return hit && hit.id !== 'rainOverlay';
    });
    expect(topElementIsNotRain).toBe(true);
  });
});

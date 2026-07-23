// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Chapter 1 location backgrounds', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await page.goto('/chapter1.html');
    await page.waitForFunction(() => (
      typeof visualDirector !== 'undefined' &&
      window.RPG &&
      window.RPG.State
    ));
  });

  test('resolves existing location state to the matching scene', async ({ page }) => {
    const scenes = await page.evaluate(() => {
      const resolve = state => {
        Object.assign(RPG.State, {
          mode: 'base',
          isAtInn: false,
          isInDungeon: false,
          explorationArea: null,
          currentDistance: 0,
          location: '',
          travelStepsSinceStay: 0,
          ...state,
        });
        RPG.State.flags.onWagon = state.onWagon === true;
        visualDirector.innSceneOverride = null;
        visualDirector.syncScene();
        return visualDirector.getActiveScene();
      };

      return {
        innFront: resolve({ location: '宿屋前' }),
        forest: resolve({ isInDungeon: true, explorationArea: 'forest', location: '琥珀の森', currentDistance: 2 }),
        deepDay: resolve({ isInDungeon: true, explorationArea: 'forest', location: '森の深層', currentDistance: 8 }),
        deepNight: resolve({ isInDungeon: true, explorationArea: 'forest', location: '森の深層', currentDistance: 8, travelStepsSinceStay: RPG.Config.NIGHT_STEP_THRESHOLD }),
        forestTen: resolve({ isInDungeon: true, explorationArea: 'forest', location: '森の深層', currentDistance: 10 }),
        wagon: resolve({ isInDungeon: true, explorationArea: 'forest', location: '琥珀の森', currentDistance: 2, onWagon: true }),
        herbEntrance: resolve({ isInDungeon: true, explorationArea: 'herbGarden', location: '薬草園入口', currentDistance: 0 }),
        herbGarden: resolve({ isInDungeon: true, explorationArea: 'herbGarden', location: '薬草園', currentDistance: 2 }),
        herbDeep: resolve({ isInDungeon: true, explorationArea: 'herbGarden', location: '薬草園の奥', currentDistance: 3 }),
        herbSix: resolve({ isInDungeon: true, explorationArea: 'herbGarden', location: '薬草園の奥', currentDistance: 6 }),
        herbDeepest: resolve({ isInDungeon: true, explorationArea: 'herbGarden', location: '薬草園の最奥', currentDistance: 7 }),
        highway: resolve({ isInDungeon: true, explorationArea: 'forest', location: 'かつての街道', currentDistance: 1 }),
      };
    });

    expect(scenes).toEqual({
      innFront: 'inn-front',
      forest: 'forest',
      deepDay: 'forest-deep-day',
      deepNight: 'forest-deep-night',
      forestTen: 'forest-10m',
      wagon: 'wagon',
      herbEntrance: 'herb-garden-entrance',
      herbGarden: 'herb-garden-deep',
      herbDeep: 'herb-garden-deep',
      herbSix: 'herb-garden-deep',
      herbDeepest: 'herb-garden',
      highway: 'former-highway',
    });
  });

  test('uses the night stable exterior override and clears stale scene classes', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        isAtInn: true,
        isInDungeon: false,
        explorationArea: null,
        location: '宿屋《琥珀亭》',
      });
      visualDirector.setInnScene('stable-back-night');
      const nightScene = visualDirector.getActiveScene();
      const hasNightClass = document.body.classList.contains('scene-inn-stable-back-night');

      visualDirector.clearInnScene();
      return {
        nightScene,
        hasNightClass,
        clearedScene: visualDirector.getActiveScene(),
        staleNightClass: document.body.classList.contains('scene-inn-stable-back-night'),
      };
    });

    expect(result).toEqual({
      nightScene: 'inn-stable-back-night',
      hasNightClass: true,
      clearedScene: 'inn-lobby',
      staleNightClass: false,
    });
  });

  test('shows the storage room as the current location only during its inn scene', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        isAtInn: true,
        isInDungeon: false,
        explorationArea: null,
        location: '宿屋《琥珀亭》',
      });

      visualDirector.setInnScene('storage');
      uiControl.updateUI();
      const storageLocation = document.getElementById('currentLocationName')?.textContent;
      const persistentLocation = RPG.State.location;

      visualDirector.clearInnScene();
      uiControl.updateUI();
      const lobbyLocation = document.getElementById('currentLocationName')?.textContent;

      return { storageLocation, persistentLocation, lobbyLocation };
    });

    expect(result).toEqual({
      storageLocation: '物置',
      persistentLocation: '宿屋《琥珀亭》',
      lobbyLocation: '宿屋《琥珀亭》',
    });
  });

  test('uses the dedicated portrait herb entrance on desktop and phones', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(RPG.State, {
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'herbGarden',
        currentDistance: 0,
        location: '薬草園入口',
      });
      visualDirector.innSceneOverride = null;
      visualDirector.syncScene();
    });

    const desktopImage = await page.locator('#sceneBackdrop').evaluate(element => getComputedStyle(element).backgroundImage);
    expect(desktopImage).toContain('amber-herb-garden-entrance-mobile.webp');

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileImage = await page.locator('#sceneBackdrop').evaluate(element => getComputedStyle(element).backgroundImage);
    expect(mobileImage).toContain('amber-herb-garden-entrance-mobile.webp');
  });
});

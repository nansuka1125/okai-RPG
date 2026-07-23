// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * The formal prologue auto-plays, then deliberately unlocks only the inn
 * talk command for the opening debt negotiation. Fast-forward both parts
 * until normal inn controls are available.
 */
async function advanceUntilInteractive(page, maxTaps = 80) {
  await page.evaluate(() => {
    window.RPG.State.debug.isSkipping = true;
  });

  for (let i = 0; i < maxTaps; i++) {
    const state = await page.evaluate(() => ({
      mode: window.RPG?.State?.mode,
      introDebtTalkPending: window.RPG?.State?.flags?.introDebtTalkPending,
    }));
    const mode = state.mode;

    if (mode === 'base' && state.introDebtTalkPending) {
      await page.evaluate(() => innSystem.talk());
      await page.waitForTimeout(60);
      continue;
    }
    if (mode === 'choice') {
      await page.click('#btnChoiceA');
      await page.waitForTimeout(60);
      continue;
    }
    if (mode !== 'event') {
      await page.evaluate(() => {
        window.RPG.State.debug.isSkipping = false;
      });
      return mode;
    }
    await page.evaluate(() => uiControl.handlePlayerInput());
    await page.waitForTimeout(60);
  }

  await page.evaluate(() => {
    window.RPG.State.debug.isSkipping = false;
  });
  return page.evaluate(() => window.RPG?.State?.mode);
}

async function advanceOpeningUntilDebtTalk(page, maxTaps = 80) {
  await page.evaluate(() => {
    window.RPG.State.debug.isSkipping = true;
  });

  for (let i = 0; i < maxTaps; i++) {
    const state = await page.evaluate(() => ({
      mode: window.RPG?.State?.mode,
      introDebtTalkPending: window.RPG?.State?.flags?.introDebtTalkPending,
    }));
    if (state.mode === 'base' && state.introDebtTalkPending) return;

    if (state.mode === 'event') {
      await page.evaluate(() => uiControl.handlePlayerInput());
    }
    await page.waitForTimeout(60);
  }

  throw new Error('opening did not reach the debt-talk command');
}

test.describe('okai-RPG smoke test', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => {
      throw new Error(`Uncaught page error: ${err.message}`);
    });
  });

  test('top page links to the Chapter 1 game entrypoint', async ({ page }) => {
    await page.goto('/');
    const startButton = page.locator('a.start-button');
    await expect(startButton).toHaveAttribute('href', 'chapter1.html');
    await expect(startButton).toContainText('ゲームを始める');
    await startButton.click();
    await expect(page).toHaveURL(/\/chapter1\.html$/);
    await expect(page.locator('#logContainer')).not.toBeEmpty();
  });

  test('top page stays compact at a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const layout = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientHeight: document.documentElement.clientHeight,
      scrollHeight: document.documentElement.scrollHeight,
    }));

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
    expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight * 1.5);
    await expect(page.locator('.start-button')).toBeInViewport();
    await expect(page.locator('.characters')).toBeInViewport();
  });

  test('loads with the expected default state', async ({ page }) => {
    await page.goto('/chapter1.html');
    const state = await page.evaluate(() => window.RPG.State);
    expect(state.cainLv).toBe(5);
    expect(state.currentHP).toBe(140);
    expect(state.maxHP).toBe(140);
    expect(state.attack).toBe(18);
    expect(state.location).toBe('宿屋《琥珀亭》');
    await expect(page.locator('#logContainer')).not.toBeEmpty();
  });

  test('can reach an interactive (non-event) mode from a fresh start', async ({ page }) => {
    await page.goto('/chapter1.html');
    const mode = await advanceUntilInteractive(page);
    expect(mode).not.toBe('event');
  });

  test('prologue unlocks the debt talk command without leaving a tap overlay', async ({ page }) => {
    await page.goto('/chapter1.html');
    await advanceOpeningUntilDebtTalk(page);

    const uiState = await page.evaluate(() => ({
      mode: window.RPG.State.mode,
      waiting: window.RPG.State.isWaitingForInput,
      overlayDisplay: document.getElementById('tap-overlay')?.style.display,
      talkDisabled: document.getElementById('btnInnTalk')?.disabled,
    }));

    expect(uiState.mode).toBe('base');
    expect(uiState.waiting).toBeFalsy();
    expect(uiState.overlayDisplay).toBe('none');
    expect(uiState.talkDisabled).toBeFalsy();

    await page.click('#btnInnTalk');
    await expect.poll(() => page.evaluate(() => window.RPG.State.mode)).toBe('event');
  });

  test('the innkeeper greeting requires silver delivery and an ordinary entrance', async ({ page }) => {
    await page.goto('/chapter1.html');
    await page.waitForFunction(() => (
      typeof innSystem !== 'undefined' &&
      typeof uiControl !== 'undefined'
    ));

    const result = await page.evaluate(() => {
      const greeting = RPG.Assets.GAME_TEXT.inn.ownerGreeting;
      const logContainer = document.getElementById('logContainer');
      const enterAndReadLog = (silverDelivered, showGreeting) => {
        if (logContainer) logContainer.innerHTML = '';
        RPG.State.flags.silverDelivered = silverDelivered;
        innSystem.enterInn(showGreeting, { skipEntryEvents: true });
        return logContainer?.textContent || '';
      };

      return {
        beforeDelivery: enterAndReadLog(false, true).includes(greeting),
        ordinaryAfterDelivery: enterAndReadLog(true, true).includes(greeting),
        defeatStyleAfterDelivery: enterAndReadLog(true, false).includes(greeting),
      };
    });

    expect(result).toEqual({
      beforeDelivery: false,
      ordinaryAfterDelivery: true,
      defeatStyleAfterDelivery: false,
    });
  });

  test('the thief discovery starts only when opening inventory, without a stay', async ({ page }) => {
    await page.goto('/chapter1.html');
    await page.waitForFunction(() => (
      typeof Cinematics !== 'undefined' &&
      typeof innSystem !== 'undefined' &&
      typeof uiControl !== 'undefined'
    ));

    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: true,
        isInDungeon: false,
        currentDistance: 0,
        location: '宿屋《琥珀亭》',
        storyPhase: 3,
      });
      Object.assign(RPG.State.flags, {
        metThiefBoy: true,
        readyForThiefBoy: false,
        thiefTrackActive: false,
        thiefDiscoveryStatus: 0,
        phase4TheftDiscovered: false,
        hasSleptAfterThief: false,
        giantLarvaDefeated: false,
      });

      innSystem.exitInn();
      const discoveredAtInnFront = RPG.State.flags.phase4TheftDiscovered;

      uiControl.closeModal();
      const discoveredOnClose = RPG.State.flags.phase4TheftDiscovered;

      uiControl.openModal();
      return {
        discoveredAtInnFront,
        discoveredOnClose,
        discoveredOnOpen: RPG.State.flags.phase4TheftDiscovered,
        storyPhase: RPG.State.storyPhase,
        mode: RPG.State.mode,
        modalDisplay: document.getElementById('itemModal')?.style.display,
      };
    });

    expect(result).toEqual({
      discoveredAtInnFront: false,
      discoveredOnClose: false,
      discoveredOnOpen: true,
      storyPhase: 4,
      mode: 'event',
      modalDisplay: 'none',
    });
  });

  test('inn: exit to exploration and back', async ({ page }) => {
    await page.goto('/chapter1.html');
    await advanceUntilInteractive(page);

    const state = await page.evaluate(() => window.RPG.State);
    test.skip(state.mode !== 'base', 'game did not settle into base mode within the tap budget');

    if (state.isAtInn) {
      await page.click('#btnInnExit');
      await expect(page.locator('#exploreUI')).toBeVisible();
      await page.click('#btnEnterInn');
      await expect(page.locator('#innUI')).toBeVisible();
    } else {
      await page.click('#btnEnterInn');
      await expect(page.locator('#innUI')).toBeVisible();
      await page.click('#btnInnExit');
      await expect(page.locator('#exploreUI')).toBeVisible();
    }
  });
});

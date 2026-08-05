// @ts-check
const { test, expect } = require('@playwright/test');

// The 甘いものを納品 button (Phase 4, 2nd "オーエンに相談") swaps a compact choice-button
// footer for the taller event-mode inn button grid. Regression test for a bug where the log
// stayed scrolled to its pre-swap position, leaving the new dialogue below the fold.
test.describe('phase 4: sweet delivery button log scroll', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/chapter1.html');
    await page.waitForFunction(() => (
      typeof RPG !== 'undefined' && typeof uiControl !== 'undefined' && typeof innSystem !== 'undefined'
    ));

    await page.evaluate(() => {
      explorationSystem.cancelActiveTypewriter();
      const freshState = JSON.parse(JSON.stringify(RPG.DefaultState));
      Object.keys(RPG.State).forEach(key => delete RPG.State[key]);
      Object.assign(RPG.State, freshState);
      Object.assign(RPG.State.flags, {
        hasIntroFinished: true,
        introDebtTalkPending: false,
        phase4TheftDiscovered: true,
        thiefDiscoveryStatus: 0,
        phase4FortuneConsultDone: true,
        phase4OwenConsultCount: 1,
        needsGlowingRabbitFur: false,
      });
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: true,
        storyPhase: 4,
        dialogueQueue: [],
        isWaitingForInput: false,
      });
      // The auto-playing prologue's beginSceneLogFocus() schedules its class-add via a 550ms
      // timer; endSceneLogFocus() is the only thing that clears that pending timer.
      uiControl.endSceneLogFocus();
      const log = document.getElementById('logContainer');
      if (log) {
        log.className = '';
        log.innerHTML = '';
        log.scrollTop = 0;
      }
      uiControl.updateUI();
    });
  });

  test('after clicking, the log ends up scrolled to its new bottom, not stuck at the pre-click position', async ({ page }) => {
    // Enough prior log content that the viewport genuinely overflows - a short log always
    // fits regardless of the bug, so it can't demonstrate the scroll-position mismatch.
    await page.evaluate(() => {
      for (let i = 0; i < 20; i++) {
        uiControl.addLog(`（過去の行 ${i}）`);
      }
    });

    await page.evaluate(() => innSystem.observe()); // starts phase4OwenConsult2
    for (let i = 0; i < 40; i++) {
      const mode = await page.evaluate(() => RPG.State.mode);
      if (mode !== 'event') break;
      await page.evaluate(() => uiControl.handlePlayerInput());
      await page.waitForTimeout(20);
    }

    const buttonText = await page.evaluate(() => document.getElementById('btnSweetDeliveryAccept')?.textContent);
    expect(buttonText).toBe('甘いものを納品');

    await page.evaluate(() => document.getElementById('btnSweetDeliveryAccept')?.click());
    for (let i = 0; i < 40; i++) {
      const mode = await page.evaluate(() => RPG.State.mode);
      if (mode !== 'event') break;
      await page.evaluate(() => uiControl.handlePlayerInput());
      await page.waitForTimeout(20);
    }
    // Let the CSS smooth-scroll animation settle.
    await page.waitForTimeout(600);

    const result = await page.evaluate(() => {
      const c = document.getElementById('logContainer');
      return {
        scrollTop: c?.scrollTop,
        maxScrollTop: (c?.scrollHeight || 0) - (c?.clientHeight || 0),
        done: RPG.State.flags.phase4SweetDeliveryDone,
      };
    });
    expect(result.done).toBe(true);
    expect(result.scrollTop).toBeGreaterThan(result.maxScrollTop - 5);
  });
});

// @ts-check
const { test, expect } = require('@playwright/test');

const makeSave = ({
  savedAt,
  memo = '旅の続きを進める。',
  location = '宿屋《琥珀亭》',
  level = 5,
  storyPhase = 1,
  equippedRareAmberId = null,
  withMeta = true,
} = {}) => {
  const save = {
    mode: 'base',
    location,
    isAtInn: location === '宿屋《琥珀亭》',
    isInDungeon: location !== '宿屋《琥珀亭》',
    storyPhase,
    cainLv: level,
    currentHP: 140,
    maxHP: 140,
    attack: 18,
    equippedRareAmberId,
    flags: {
      hasIntroFinished: true,
      introDebtTalkPending: false,
      introDebtNegotiationDone: true,
    },
    inventory: {
      glowingBrooch: equippedRareAmberId ? 1 : 0,
      hatedAmber: equippedRareAmberId === 'hatedAmber' ? 0 : 1,
    },
  };

  if (withMeta) {
    save.saveMeta = {
      format: 1,
      kind: 'journal',
      savedAt,
      memo,
      location,
    };
  }
  return save;
};

async function seedStorage(page, entries) {
  await page.goto('/');
  await page.evaluate((seedEntries) => {
    localStorage.clear();
    Object.entries(seedEntries).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
  }, entries);
  await page.reload();
}

test.describe('title continue flow', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
  });

  test('shows only the existing game-start button when no save exists', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#freshStartButton')).toBeVisible();
    await expect(page.locator('#freshStartButton')).toContainText('ゲームを始める');
    await expect(page.locator('#savedStartMenu')).toBeHidden();
  });

  test('continues the newest dated record and restores it before the prologue', async ({ page }) => {
    const older = makeSave({
      savedAt: '2026-07-28T10:00:00.000Z',
      memo: '古い旅の記録。',
      location: '宿屋《琥珀亭》',
      storyPhase: 2,
    });
    const newest = makeSave({
      savedAt: '2026-07-29T10:00:00.000Z',
      memo: '新しい旅の記録。',
      location: '琥珀の森 6m',
      level: 7,
      storyPhase: 4,
      equippedRareAmberId: 'hatedAmber',
    });
    await seedStorage(page, {
      okai_rpg_save_1: JSON.stringify(older),
      okai_rpg_suspend: JSON.stringify(newest),
    });

    await expect(page.locator('#freshStartButton')).toBeHidden();
    await expect(page.locator('#savedStartMenu')).toBeVisible();
    await expect(page.locator('#latestSaveInfo')).toContainText('新しい旅の記録。');
    await expect(page.locator('#latestSaveInfo')).toContainText('琥珀の森 6m');
    await expect(page.locator('#latestSaveInfo')).toContainText('Lv.7');

    await page.locator('#continueButton').click();
    await expect(page).toHaveURL(/chapter1\.html\?resume=suspend$/);
    await page.waitForFunction(() => window.RPG?.State?.storyPhase === 4);

    const result = await page.evaluate(() => ({
      storyPhase: RPG.State.storyPhase,
      location: RPG.State.location,
      equipped: RPG.State.equippedRareAmberId,
      introCompleted: RPG.State.completedEvents.includes('prologue_event'),
      openingClass: document.body.classList.contains('intro-opening'),
      titleClass: document.body.classList.contains('intro-title-card'),
      log: document.getElementById('logContainer')?.textContent || '',
    }));
    expect(result).toEqual({
      storyPhase: 4,
      location: '琥珀の森 6m',
      equipped: 'hatedAmber',
      introCompleted: false,
      openingClass: false,
      titleClass: false,
      log: expect.stringContaining('中断記録から旅を再開した。'),
    });
  });

  test('direct chapter test-play opens the title menu when a record exists', async ({ page }) => {
    await seedStorage(page, {
      okai_rpg_save_1: JSON.stringify(makeSave({
        savedAt: '2026-07-29T10:00:00.000Z',
        memo: 'テストプレイの続き。',
        storyPhase: 4,
      })),
    });

    await page.goto('/chapter1.html');
    await expect(page).toHaveURL(/\/index\.html$/);
    await expect(page.locator('#savedStartMenu')).toBeVisible();
    await expect(page.locator('#continueButton')).toContainText('続きから');
    await expect(page.locator('#latestSaveInfo')).toContainText('テストプレイの続き。');
  });

  test('the picker can resume an older manual page instead of the newest record', async ({ page }) => {
    await seedStorage(page, {
      okai_rpg_save_1: JSON.stringify(makeSave({
        savedAt: '2026-07-20T10:00:00.000Z',
        memo: '第一頁の旅。',
        storyPhase: 2,
      })),
      okai_rpg_save_2: JSON.stringify(makeSave({
        savedAt: '2026-07-29T10:00:00.000Z',
        memo: '第二頁の旅。',
        storyPhase: 6,
      })),
    });

    await page.locator('#openSavePickerButton').click();
    await expect(page.locator('#savePicker')).toBeVisible();
    await page.getByRole('button', { name: /第一頁/ }).click();
    await expect(page).toHaveURL(/chapter1\.html\?resume=1$/);
    await page.waitForFunction(() => window.RPG?.State?.storyPhase === 2);
    await expect(page.locator('#logContainer')).toContainText('第一頁から旅を再開した。');
  });

  test('multiple legacy saves open the picker instead of guessing which is newest', async ({ page }) => {
    await seedStorage(page, {
      okai_rpg_save_1: JSON.stringify(makeSave({
        withMeta: false,
        location: '宿屋《琥珀亭》',
        storyPhase: 2,
      })),
      okai_rpg_save_2: JSON.stringify(makeSave({
        withMeta: false,
        location: '琥珀の森 8m',
        storyPhase: 3,
      })),
    });

    await expect(page.locator('#latestSaveInfo')).toContainText('再開する記録を選んでください');
    await page.locator('#continueButton').click();
    await expect(page.locator('#savePicker')).toBeVisible();
    await expect(page.getByRole('button', { name: /第二頁/ })).toContainText('以前の記録');

    await page.getByRole('button', { name: /第二頁/ }).click();
    await page.waitForFunction(() => window.RPG?.State?.storyPhase === 3);
    expect(await page.evaluate(() => RPG.State.location)).toBe('琥珀の森 8m');
  });

  test('corrupt and missing requested records return safely to the title', async ({ page }) => {
    await seedStorage(page, {
      okai_rpg_save_1: '{not valid json',
    });

    await page.locator('#continueButton').click();
    await expect(page.locator('#savePicker')).toBeVisible();
    await expect(page.getByRole('button', { name: /第一頁/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: /第一頁/ })).toContainText('記録を読み込めない');

    await page.goto('/chapter1.html?resume=1');
    await expect(page).toHaveURL(/index\.html\?resumeError=1$/);
    await expect(page.locator('#startupError')).toContainText('記録を読み込めなかった');

    await page.evaluate(() => localStorage.removeItem('okai_rpg_save_5'));
    await page.goto('/chapter1.html?resume=5');
    await expect(page).toHaveURL(/index\.html\?resumeError=1$/);
  });

  test('an unsupported resume value follows the normal fresh-start route', async ({ page }) => {
    for (const resumeValue of ['unknown', '__proto__']) {
      await page.goto(`/chapter1.html?resume=${resumeValue}`);
      await page.waitForFunction(() => window.RPG?.State?.completedEvents?.includes('prologue_event'));

      const result = await page.evaluate(() => ({
        hasIntroFinished: RPG.State.flags.hasIntroFinished,
        prologueStarted: RPG.State.completedEvents.includes('prologue_event'),
      }));
      expect(result.prologueStarted).toBe(true);
      expect(result.hasIntroFinished).toBe(false);
    }
  });

  test('starting over confirms and deletes all five pages plus the suspend record', async ({ page }) => {
    const entries = {};
    ['suspend', '1', '2', '3', '4', '5'].forEach((slot, index) => {
      const key = slot === 'suspend' ? 'okai_rpg_suspend' : `okai_rpg_save_${slot}`;
      entries[key] = JSON.stringify(makeSave({
        savedAt: `2026-07-${String(20 + index).padStart(2, '0')}T10:00:00.000Z`,
        storyPhase: index + 1,
      }));
    });
    await seedStorage(page, entries);

    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      await dialog.dismiss();
    });
    await page.locator('#newGameButton').click();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => (
      [
        'okai_rpg_suspend',
        'okai_rpg_save_1',
        'okai_rpg_save_2',
        'okai_rpg_save_3',
        'okai_rpg_save_4',
        'okai_rpg_save_5',
      ].filter(key => localStorage.getItem(key) !== null).length
    ))).toBe(6);

    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });
    await page.locator('#newGameButton').click();
    await expect(page).toHaveURL(/\/chapter1\.html$/);
    await page.waitForFunction(() => (
      window.RPG?.State?.completedEvents?.includes('prologue_event')
    ));

    const result = await page.evaluate(() => ({
      remaining: [
        'okai_rpg_suspend',
        'okai_rpg_save_1',
        'okai_rpg_save_2',
        'okai_rpg_save_3',
        'okai_rpg_save_4',
        'okai_rpg_save_5',
      ].filter(key => localStorage.getItem(key) !== null),
      prologueStarted: RPG.State.completedEvents.includes('prologue_event'),
    }));
    expect(result).toEqual({ remaining: [], prologueStarted: true });
  });

  test('all six records remain scrollable in the picker on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 667 });
    const entries = {};
    ['suspend', '1', '2', '3', '4', '5'].forEach((slot, index) => {
      const key = slot === 'suspend' ? 'okai_rpg_suspend' : `okai_rpg_save_${slot}`;
      entries[key] = JSON.stringify(makeSave({
        savedAt: `2026-07-${String(20 + index).padStart(2, '0')}T10:00:00.000Z`,
      }));
    });
    await seedStorage(page, entries);

    await page.locator('#openSavePickerButton').click();
    const list = page.locator('#savePickerList');
    await expect(list.locator('.save-picker-row')).toHaveCount(6);
    const dimensions = await list.evaluate(element => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);

    const lastRow = list.locator('.save-picker-row').last();
    await lastRow.scrollIntoViewIfNeeded();
    await expect(lastRow).toBeInViewport();
  });
});

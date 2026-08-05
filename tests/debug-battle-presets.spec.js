// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('non-persistent debug battle presets', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
  });

  test('the URL-only entry bypasses stored records and exposes only the preset choices', async ({ page }) => {
    await page.goto('/chapter1.html?new=1');
    await page.evaluate(() => {
      localStorage.setItem('okai_rpg_save_1', JSON.stringify({ cainLv: 99, marker: 'keep' }));
      localStorage.setItem('okai_rpg_suspend', JSON.stringify({ cainLv: 88, marker: 'keep' }));
    });

    await page.goto('/chapter1.html?debugBattle=1');
    await page.waitForFunction(() => window.debugBattlePresets?.isActive() === true);

    const result = await page.evaluate(() => {
      uiControl.openSaveModal();
      return {
        actions: [...document.querySelectorAll('#action-buttons button')].map(button => button.textContent),
        presets: window.debugBattlePresets.presets.map(({ id, enemyId, level, fireproofGloves }) => ({
          id, enemyId, level, fireproofGloves,
        })),
        save1: localStorage.getItem('okai_rpg_save_1'),
        suspend: localStorage.getItem('okai_rpg_suspend'),
        canJournalSave: uiControl.canWriteJournalSave(),
        canSuspendSave: uiControl.canWriteSuspendSave(),
        miniSaveDisplay: document.getElementById('miniSaveButton')?.style.display,
        normalDebugUiPresent: ['debugParams', 'debugEncounterToggle', 'debugClearSaveToggle', 'debug-mood']
          .some(id => document.getElementById(id) !== null),
        saveModalDisplay: document.getElementById('saveModal')?.style.display,
      };
    });

    expect(result).toEqual({
      actions: [
        'Lv5《飢えた琥珀樹》',
        'Lv8《泥這う大幼蟲》',
        'Lv8《ドクロ蜂》',
        'Lv8《肉食カズラ》',
        'Lv9《燃える琥珀樹の根》',
        'Lv10《魔界のネズミ《群》》',
        'Lv10《目食いカラス》',
        'Lv10《琥珀骸の巨虫》',
        'Lv12《琥珀骸の巨虫》',
      ],
      presets: [
        { id: 'hungry_amber_tree', enemyId: 'hungry_amber_tree', level: 5, fireproofGloves: 0 },
        { id: 'giant_larva', enemyId: 'giant_larva', level: 8, fireproofGloves: 0 },
        { id: 'skull_bee', enemyId: 'skull_bee', level: 8, fireproofGloves: 1 },
        { id: 'carnivorous_vine', enemyId: 'carnivorous_vine', level: 8, fireproofGloves: 1 },
        { id: 'amber_burning_root', enemyId: 'amber_burning_root', level: 9, fireproofGloves: 1 },
        { id: 'hell_rat_swarm', enemyId: 'hell_rat_swarm', level: 10, fireproofGloves: 1 },
        { id: 'eye_eating_crow', enemyId: 'eye_eating_crow', level: 10, fireproofGloves: 1 },
        { id: 'amber_husk_giant_larva', enemyId: 'amber_husk_giant_larva', level: 10, fireproofGloves: 1 },
        { id: 'amber_husk_giant_larva_lv12', enemyId: 'amber_husk_giant_larva', level: 12, fireproofGloves: 1 },
      ],
      save1: JSON.stringify({ cainLv: 99, marker: 'keep' }),
      suspend: JSON.stringify({ cainLv: 88, marker: 'keep' }),
      canJournalSave: false,
      canSuspendSave: false,
      miniSaveDisplay: 'none',
      normalDebugUiPresent: false,
      saveModalDisplay: '',
    });
  });

  test('a preset reuses amber equipment and starts milk amber at its increased full HP', async ({ page }) => {
    await page.goto('/chapter1.html?debugBattle=1');
    await page.waitForFunction(() => window.debugBattlePresets?.isActive() === true);
    await page.locator('#debugBattlePreset_skull_bee').click();
    await page.locator('#debugBattleAmber_milkAmber').click();
    await page.locator('#debugBattleStart').click();

    const result = await page.evaluate(() => ({
      battling: RPG.State.isBattling,
      enemyId: RPG.State.currentEnemy?.id,
      level: RPG.State.cainLv,
      currentHP: RPG.State.currentHP,
      maxHP: RPG.State.maxHP,
      attack: RPG.State.attack,
      exp: RPG.State.exp,
      mood: RPG.State.mood,
      poisoned: RPG.State.isPoisoned,
      equippedAmber: RPG.State.equippedRareAmberId,
      gloves: RPG.State.inventory.fireproofGloves,
      consumables: {
        herb: RPG.State.inventory.herb,
        highHerb: RPG.State.inventory.highHerb,
        antidoteHerb: RPG.State.inventory.antidoteHerb,
      },
      selectableAmber: {
        blue: RPG.State.inventory.blueAmber,
        milk: RPG.State.inventory.milkAmber,
        herb: RPG.State.inventory.herbAmber,
        vampire: RPG.State.inventory.vampireAmber,
      },
    }));

    expect(result).toEqual({
      battling: true,
      enemyId: 'skull_bee',
      level: 8,
      currentHP: 221,
      maxHP: 221,
      attack: 24,
      exp: 0,
      mood: 50,
      poisoned: false,
      equippedAmber: 'milkAmber',
      gloves: 1,
      consumables: { herb: 3, highHerb: 3, antidoteHerb: 3 },
      selectableAmber: { blue: 1, milk: 0, herb: 1, vampire: 0 },
    });
  });

  test('victory and defeat discard mutated state before replaying the selected preset', async ({ page }) => {
    await page.goto('/chapter1.html?debugBattle=1');
    await page.waitForFunction(() => window.debugBattlePresets?.isActive() === true);
    await page.locator('#debugBattlePreset_carnivorous_vine').click();
    await page.locator('#debugBattleAmber_herbAmber').click();
    await page.locator('#debugBattleStart').click();

    await page.evaluate(() => {
      RPG.State.exp = 999;
      RPG.State.currentHP = 1;
      RPG.State.inventory.herb = 0;
      RPG.State.isPoisoned = true;
      RPG.State.currentEnemy.hp = 1;
      battleSystem.endBattle(true);
    });
    await expect(page.locator('#debugBattleReplay')).toBeVisible();

    await page.locator('#debugBattleReplay').click();
    await page.evaluate(() => {
      RPG.State.currentHP = 1;
      RPG.State.inventory.highHerb = 0;
      RPG.State.isPoisoned = true;
      RPG.State.currentEnemy.hp = 1;
      battleSystem.resolveDefeat();
    });
    await expect(page.locator('#debugBattleReplay')).toBeVisible();
    await page.locator('#debugBattleReplay').click();

    const result = await page.evaluate(() => ({
      battling: RPG.State.isBattling,
      enemy: { id: RPG.State.currentEnemy?.id, hp: RPG.State.currentEnemy?.hp, maxHp: RPG.State.currentEnemy?.maxHp },
      level: RPG.State.cainLv,
      currentHP: RPG.State.currentHP,
      maxHP: RPG.State.maxHP,
      attack: RPG.State.attack,
      exp: RPG.State.exp,
      poisoned: RPG.State.isPoisoned,
      equippedAmber: RPG.State.equippedRareAmberId,
      consumables: {
        herb: RPG.State.inventory.herb,
        highHerb: RPG.State.inventory.highHerb,
        antidoteHerb: RPG.State.inventory.antidoteHerb,
      },
      gloves: RPG.State.inventory.fireproofGloves,
    }));

    expect(result).toEqual({
      battling: true,
      enemy: { id: 'carnivorous_vine', hp: 90, maxHp: 90 },
      level: 8,
      currentHP: 170,
      maxHP: 170,
      attack: 24,
      exp: 0,
      poisoned: false,
      equippedAmber: 'herbAmber',
      consumables: { herb: 3, highHerb: 3, antidoteHerb: 3 },
      gloves: 1,
    });
  });

  test('the final-boss preset starts and restores its temporary state after victory', async ({ page }) => {
    await page.goto('/chapter1.html?debugBattle=1');
    await page.waitForFunction(() => window.debugBattlePresets?.isActive() === true);
    await page.locator('#debugBattlePreset_amber_husk_giant_larva_lv12').click();
    await page.locator('#debugBattleStart').click();

    const started = await page.evaluate(() => ({
      battling: RPG.State.isBattling,
      enemy: { id: RPG.State.currentEnemy?.id, hp: RPG.State.currentEnemy?.hp, maxHp: RPG.State.currentEnemy?.maxHp },
      level: RPG.State.cainLv,
      currentHP: RPG.State.currentHP,
      maxHP: RPG.State.maxHP,
      attack: RPG.State.attack,
      exp: RPG.State.exp,
      mood: RPG.State.mood,
      poisoned: RPG.State.isPoisoned,
      equippedAmber: RPG.State.equippedRareAmberId,
      gloves: RPG.State.inventory.fireproofGloves,
    }));
    expect(started).toEqual({
      battling: true,
      enemy: { id: 'amber_husk_giant_larva', hp: 600, maxHp: 600 },
      level: 12,
      currentHP: 210,
      maxHP: 210,
      attack: 32,
      exp: 0,
      mood: 50,
      poisoned: false,
      equippedAmber: null,
      gloves: 1,
    });

    await page.evaluate(() => {
      RPG.State.currentHP = 1;
      RPG.State.exp = 999;
      RPG.State.inventory.herb = 0;
      RPG.State.isPoisoned = true;
      RPG.State.currentEnemy.hp = 1;
      RPG.State.currentEnemy.phaseTwoTriggered = true;
      battleSystem.endBattle(true);
    });
    await expect(page.locator('#debugBattleReplay')).toBeVisible();
    await page.locator('#debugBattleReplay').click();

    const replayed = await page.evaluate(() => ({
      battling: RPG.State.isBattling,
      enemy: {
        id: RPG.State.currentEnemy?.id,
        hp: RPG.State.currentEnemy?.hp,
        maxHp: RPG.State.currentEnemy?.maxHp,
        phaseTwoTriggered: RPG.State.currentEnemy?.phaseTwoTriggered === true,
      },
      level: RPG.State.cainLv,
      currentHP: RPG.State.currentHP,
      maxHP: RPG.State.maxHP,
      attack: RPG.State.attack,
      exp: RPG.State.exp,
      poisoned: RPG.State.isPoisoned,
      consumables: {
        herb: RPG.State.inventory.herb,
        highHerb: RPG.State.inventory.highHerb,
        antidoteHerb: RPG.State.inventory.antidoteHerb,
      },
      gloves: RPG.State.inventory.fireproofGloves,
    }));
    expect(replayed).toEqual({
      battling: true,
      enemy: { id: 'amber_husk_giant_larva', hp: 600, maxHp: 600, phaseTwoTriggered: false },
      level: 12,
      currentHP: 210,
      maxHP: 210,
      attack: 32,
      exp: 0,
      poisoned: false,
      consumables: { herb: 3, highHerb: 3, antidoteHerb: 3 },
      gloves: 1,
    });
  });
});

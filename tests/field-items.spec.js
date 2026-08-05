// @ts-check
const { test, expect } = require('@playwright/test');

async function openGame(page) {
  await page.goto('/chapter1.html');
  await page.waitForFunction(() => (
    typeof RPG !== 'undefined' &&
    typeof uiControl !== 'undefined' &&
    typeof explorationSystem !== 'undefined' &&
    typeof battleSystem !== 'undefined' &&
    typeof innSystem !== 'undefined'
  ));
}

test.describe('field utility items', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (error) => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
  });

  test('shows the fixed names/descriptions and only exposes valid use buttons', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'forest',
        location: uiControl.getLocData(1).name,
        currentDistance: 1,
        currentHP: 100,
        maxHP: 140,
        smokeBombStepsRemaining: 0,
      });
      RPG.State.flags.onWagon = false;
      Object.assign(RPG.State.inventory, {
        fakeWoundMedicine: 1,
        smokeBomb: 1,
        hardBottle: 1,
        gratefulTalisman: 1,
      });

      const itemIds = [
        'fakeWoundMedicine',
        'smokeBomb',
        'hardBottle',
        'gratefulTalisman',
      ];
      const useButtons = {};
      itemIds.forEach((itemId) => {
        uiControl.selectItem(itemId, 1);
        useButtons[itemId] = Boolean(
          document.querySelector('#itemDetailArea button')
        );
      });

      return {
        names: Object.fromEntries(itemIds.map(id => [id, RPG.Assets.CONFIG.ITEM_NAME[id]])),
        descriptions: Object.fromEntries(itemIds.map(id => [id, RPG.Assets.CONFIG.ITEM_DESC[id]])),
        useButtons,
      };
    });

    expect(result.names).toEqual({
      fakeWoundMedicine: '🩹傷薬もどき',
      smokeBomb: '💨煙玉',
      hardBottle: '🫙やみくもにかたい瓶',
      gratefulTalisman: '🧧ありがた〜い札',
    });
    expect(result.descriptions).toEqual({
      fakeWoundMedicine: '使うと準備状態になり、次以降の戦闘で体力が半分以下になった時、一度だけ回復する。',
      smokeBomb: '割ると自分の気配が薄くなる煙が立つ。10歩ほど魔物に見つからずに済む。',
      hardBottle: '対魔硬質ゴリラガラス製。ゴリラの渾身の力で締められている。',
      gratefulTalisman: '『死ぬこと以外かすり傷』と書いてある。致命の一撃だけはHP1で踏みとどまれる。',
    });
    expect(result.useButtons).toEqual({
      fakeWoundMedicine: true,
      smokeBomb: true,
      hardBottle: true,
      gratefulTalisman: false,
    });
  });

  test('fake wound medicine prepares across battles and saves, then heals once below half HP', async ({ page }) => {
    const result = await page.evaluate(() => {
      const logContainer = document.getElementById('logContainer');
      if (logContainer) logContainer.innerHTML = '';
      RPG.State.inventory.fakeWoundMedicine = 2;
      RPG.State.mode = 'base';
      RPG.State.maxHP = 100;
      RPG.State.currentHP = 100;
      RPG.State.flags.fakeWoundMedicinePrepared = false;

      explorationSystem.useItem('fakeWoundMedicine');
      const afterPrepare = {
        hp: RPG.State.currentHP,
        count: RPG.State.inventory.fakeWoundMedicine,
        prepared: RPG.State.flags.fakeWoundMedicinePrepared,
        log: logContainer?.textContent || '',
      };

      explorationSystem.useItem('fakeWoundMedicine');
      const afterRepeatUse = {
        count: RPG.State.inventory.fakeWoundMedicine,
        prepared: RPG.State.flags.fakeWoundMedicinePrepared,
        log: logContainer?.textContent || '',
      };

      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_fake_wound_medicine_test', JSON.stringify(snapshot));
      RPG.State.flags.fakeWoundMedicinePrepared = false;
      uiControl.loadFromStorage('okai_rpg_fake_wound_medicine_test', '傷薬もどきテスト');
      RPG.State.currentHP = 80;
      RPG.State.battleState = {};
      battleSystem.applyEnemyDirectDamage(20); // 60 HP: still above half, so it remains prepared.
      const afterFirstBattle = {
        hp: RPG.State.currentHP,
        prepared: RPG.State.flags.fakeWoundMedicinePrepared,
      };

      RPG.State.battleState = {};
      battleSystem.applyEnemyDirectDamage(20); // 40 HP, then +40 HP.
      return {
        afterPrepare,
        afterRepeatUse,
        afterFirstBattle,
        afterTrigger: {
          hp: RPG.State.currentHP,
          count: RPG.State.inventory.fakeWoundMedicine,
          prepared: RPG.State.flags.fakeWoundMedicinePrepared,
          log: logContainer?.textContent || '',
        },
      };
    });

    expect(result.afterPrepare).toMatchObject({ hp: 100, count: 1, prepared: true });
    expect(result.afterPrepare.log).toContain('🩹傷薬もどきを準備した。');
    expect(result.afterRepeatUse).toMatchObject({ count: 1, prepared: true });
    expect(result.afterRepeatUse.log).toContain('🩹傷薬もどきは、もう準備してある。');
    expect(result.afterFirstBattle).toEqual({ hp: 60, prepared: true });
    expect(result.afterTrigger).toMatchObject({ hp: 80, count: 1, prepared: false });
    expect(result.afterTrigger.log).toContain('🩹傷薬もどきが効き、HPが40回復した。');
  });

  test('smoke bomb covers ten real moves, skips random encounters, and coexists with matatabi', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'forest',
        location: uiControl.getLocData(1).name,
        currentDistance: 1,
        storyPhase: 5,
        smokeBombStepsRemaining: 0,
      });
      Object.assign(RPG.State.flags, {
        onWagon: false,
        silverDelivered: true,
        isDebugEncountersOff: false,
        matamatabiActive: false,
      });
      RPG.State.inventory.smokeBomb = 2;

      const originalRandom = Math.random;
      const originalCheckEvents = explorationSystem.checkEvents;
      const originalTreeEncounter = scenarioEvents.treeEventSystem.handleEncounter;
      const originalStartBattle = battleSystem.startBattle;
      let battles = 0;

      Math.random = () => 0;
      explorationSystem.checkEvents = () => false;
      scenarioEvents.treeEventSystem.handleEncounter = () => false;
      battleSystem.startBattle = () => {
        battles += 1;
      };

      explorationSystem.useItem('smokeBomb');
      const afterUse = {
        steps: RPG.State.smokeBombStepsRemaining,
        status: document.getElementById('statusInfo')?.textContent || '',
      };
      explorationSystem.move(0, { skipTravelCue: true });
      const afterMoveZero = RPG.State.smokeBombStepsRemaining;

      for (let i = 0; i < 10; i++) {
        explorationSystem.move(i % 2 === 0 ? 1 : -1, { skipTravelCue: true });
      }
      const afterTen = {
        steps: RPG.State.smokeBombStepsRemaining,
        battles,
        log: document.getElementById('logContainer')?.textContent || '',
      };

      explorationSystem.move(1, { skipTravelCue: true });
      const afterEleven = { steps: RPG.State.smokeBombStepsRemaining, battles };

      Object.assign(RPG.State, {
        mode: 'base',
        currentDistance: 1,
        location: uiControl.getLocData(1).name,
        smokeBombStepsRemaining: 3,
        matamatabiStepsRemaining: 3,
      });
      RPG.State.flags.matamatabiActive = true;
      battles = 0;
      explorationSystem.move(1, { skipTravelCue: true });
      const simultaneous = {
        smoke: RPG.State.smokeBombStepsRemaining,
        matatabi: RPG.State.matamatabiStepsRemaining,
        battles,
      };

      Math.random = originalRandom;
      explorationSystem.checkEvents = originalCheckEvents;
      scenarioEvents.treeEventSystem.handleEncounter = originalTreeEncounter;
      battleSystem.startBattle = originalStartBattle;

      return { afterUse, afterMoveZero, afterTen, afterEleven, simultaneous };
    });

    expect(result.afterUse.steps).toBe(10);
    expect(result.afterUse.status).toContain('煙玉 10歩');
    expect(result.afterMoveZero).toBe(10);
    expect(result.afterTen.steps).toBe(0);
    expect(result.afterTen.battles).toBe(0);
    expect(result.afterTen.log).toContain('煙が薄れ、気配が元に戻った。');
    expect(result.afterEleven.battles).toBe(1);
    expect(result.simultaneous).toEqual({ smoke: 2, matatabi: 2, battles: 0 });
  });

  test('temporary effects clear on inn entry, defeat, and the highway transition', async ({ page }) => {
    const result = await page.evaluate(() => {
      const setEffects = () => {
        RPG.State.smokeBombStepsRemaining = 7;
      };

      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: false,
        isInDungeon: false,
        location: '宿屋前',
      });
      RPG.State.flags.readyForThiefBoy = false;
      setEffects();
      innSystem.enterInn(false, { skipEntryEvents: true });
      const afterInnEntry = {
        smoke: RPG.State.smokeBombStepsRemaining,
      };

      const originalDefeatSequence = innSystem.showDefeatSequence;
      innSystem.showDefeatSequence = () => {};
      setEffects();
      Object.assign(RPG.State, {
        isBattling: true,
        currentEnemy: { id: 'test_enemy', hp: 10 },
        battleState: {},
      });
      battleSystem.resolveDefeat();
      const afterDefeat = {
        smoke: RPG.State.smokeBombStepsRemaining,
      };
      innSystem.showDefeatSequence = originalDefeatSequence;

      setEffects();
      explorationSystem.transitionToHighway();
      const afterHighwayTransition = {
        smoke: RPG.State.smokeBombStepsRemaining,
      };

      return { afterInnEntry, afterDefeat, afterHighwayTransition };
    });

    expect(result).toEqual({
      afterInnEntry: { smoke: 0 },
      afterDefeat: { smoke: 0 },
      afterHighwayTransition: { smoke: 0 },
    });
  });

  test('grateful talisman precedes Owen and the charm, supports multiple copies, and ignores poison/bad end', async ({ page }) => {
    const result = await page.evaluate(() => {
      const makeBattleState = () => ({
        skippedTurns: 0,
        playerTookDamage: false,
        gratefulTalismanSurvivalActive: false,
      });
      Object.assign(RPG.State, {
        mode: 'battle',
        isBattling: true,
        currentHP: 5,
        maxHP: 140,
        currentEnemy: { id: 'test_enemy', name: '試験魔物', hp: 10, atk: 10, msg: '攻撃してきた！' },
        battleState: makeBattleState(),
        hasOwenSavedLife: false,
      });
      Object.assign(RPG.State.inventory, {
        gratefulTalisman: 2,
        charm: 1,
      });

      const first = battleSystem.applyEnemyDirectDamage(10);
      const firstCheck = battleSystem.checkBattleEnd();
      const firstState = {
        result: first,
        checkEnded: firstCheck,
        hp: RPG.State.currentHP,
        talismans: RPG.State.inventory.gratefulTalisman,
        charm: RPG.State.inventory.charm,
        owenSaved: RPG.State.hasOwenSavedLife,
      };

      const second = battleSystem.applyEnemyDirectDamage(10);
      const secondCheck = battleSystem.checkBattleEnd();
      const secondState = {
        result: second,
        checkEnded: secondCheck,
        hp: RPG.State.currentHP,
        talismans: RPG.State.inventory.gratefulTalisman,
        charm: RPG.State.inventory.charm,
      };

      battleSystem.applyEnemyDirectDamage(10);
      const thirdCheck = battleSystem.checkBattleEnd();
      const charmFallback = {
        checkEnded: thirdCheck,
        hp: RPG.State.currentHP,
        talismans: RPG.State.inventory.gratefulTalisman,
        charm: RPG.State.inventory.charm,
      };

      RPG.State.currentEnemy = { id: 'test_enemy', name: '試験魔物', hp: 10, atk: 10, msg: '攻撃してきた！' };
      RPG.State.battleState = makeBattleState();
      RPG.State.currentHP = 5;
      RPG.State.inventory.gratefulTalisman = 1;
      RPG.State.inventory.charm = 1;
      RPG.State.hasOwenSavedLife = false;
      RPG.State.isBattling = true;
      RPG.State.debug.isSkipping = true;
      const originalRandom = Math.random;
      Math.random = () => 1;
      battleSystem.enemyTurn();
      const beforeOwen = {
        hp: RPG.State.currentHP,
        talismans: RPG.State.inventory.gratefulTalisman,
        charm: RPG.State.inventory.charm,
        owenSaved: RPG.State.hasOwenSavedLife,
      };

      RPG.State.currentEnemy = { id: 'test_enemy', name: '試験魔物', hp: 10, atk: 10, msg: '攻撃してきた！' };
      RPG.State.battleState = makeBattleState();
      RPG.State.currentHP = 5;
      RPG.State.inventory.gratefulTalisman = 0;
      RPG.State.hasOwenSavedLife = false;
      RPG.State.isBattling = true;
      battleSystem.enemyTurn();
      const owenFallback = {
        hp: RPG.State.currentHP,
        charm: RPG.State.inventory.charm,
        owenSaved: RPG.State.hasOwenSavedLife,
      };

      RPG.State.currentEnemy = { id: 'test_enemy', hp: 10 };
      RPG.State.battleState = makeBattleState();
      RPG.State.currentHP = 2;
      RPG.State.inventory.gratefulTalisman = 1;
      RPG.State.isPoisoned = true;
      RPG.State.poisonDamageRemaining = 20;
      const poisonReachedBoundary = battleSystem.applyPoisonTick();
      const poisonState = {
        reachedBoundary: poisonReachedBoundary,
        hp: RPG.State.currentHP,
        talismans: RPG.State.inventory.gratefulTalisman,
      };

      RPG.State.currentHP = 140;
      RPG.State.inventory.gratefulTalisman = 1;
      RPG.State.currentEnemy = { id: 'glowing_cat_rabbit', hp: 9999 };
      RPG.State.battleState = makeBattleState();
      battleSystem.resolveGlowingCatRabbitLv88BadEnd();
      const badEndState = {
        hp: RPG.State.currentHP,
        talismans: RPG.State.inventory.gratefulTalisman,
      };

      Math.random = originalRandom;
      RPG.State.debug.isSkipping = false;
      return {
        firstState,
        secondState,
        charmFallback,
        beforeOwen,
        owenFallback,
        poisonState,
        badEndState,
      };
    });

    expect(result.firstState).toMatchObject({
      checkEnded: false,
      hp: 1,
      talismans: 1,
      charm: 1,
      owenSaved: false,
    });
    expect(result.secondState).toMatchObject({
      checkEnded: false,
      hp: 1,
      talismans: 0,
      charm: 1,
    });
    expect(result.charmFallback).toMatchObject({
      checkEnded: false,
      hp: 70,
      talismans: 0,
      charm: 0,
    });
    expect(result.beforeOwen).toEqual({
      hp: 1,
      talismans: 0,
      charm: 1,
      owenSaved: false,
    });
    expect(result.owenFallback).toEqual({
      hp: 1,
      charm: 1,
      owenSaved: true,
    });
    expect(result.poisonState).toEqual({
      reachedBoundary: true,
      hp: 1,
      talismans: 1,
    });
    expect(result.badEndState).toEqual({
      hp: 0,
      talismans: 1,
    });
  });

  test('smoke-bomb step counts survive saves and missing old-save fields normalize to zero', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.smokeBombStepsRemaining = 7;
      localStorage.setItem('okai_rpg_save_1', JSON.stringify(RPG.State));
      RPG.State.smokeBombStepsRemaining = 0;
      uiControl.loadGame(1);
      const restored = {
        smoke: RPG.State.smokeBombStepsRemaining,
      };

      localStorage.setItem('okai_rpg_save_1', JSON.stringify({
        currentHP: 100,
        inventory: { herb: 1 },
        flags: {},
      }));
      uiControl.loadGame(1);
      const oldSave = {
        smoke: explorationSystem.getTemporaryEffectSteps('smokeBombStepsRemaining'),
        fakeWoundMedicine: RPG.State.inventory.fakeWoundMedicine,
        smokeBomb: RPG.State.inventory.smokeBomb,
        hardBottle: RPG.State.inventory.hardBottle,
        gratefulTalisman: RPG.State.inventory.gratefulTalisman,
      };

      return { restored, oldSave };
    });

    expect(result.restored).toEqual({ smoke: 7 });
    expect(result.oldSave).toEqual({
      smoke: 0,
      fakeWoundMedicine: 0,
      smokeBomb: 0,
      hardBottle: 0,
      gratefulTalisman: 0,
    });
  });
});

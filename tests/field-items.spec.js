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
        mikawashiStepsRemaining: 0,
      });
      RPG.State.flags.onWagon = false;
      Object.assign(RPG.State.inventory, {
        fakeWoundMedicine: 1,
        smokeBomb: 1,
        hardBottle: 1,
        gratefulTalisman: 1,
        mikawashiFeather: 1,
      });

      const itemIds = [
        'fakeWoundMedicine',
        'smokeBomb',
        'hardBottle',
        'gratefulTalisman',
        'mikawashiFeather',
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
      mikawashiFeather: '🪶ミカワシ羽',
    });
    expect(result.descriptions).toEqual({
      fakeWoundMedicine: '戦闘中の怪我を誤魔化せる。HP回復。',
      smokeBomb: '割ると自分の気配が薄くなる煙が立つ。10歩ほど魔物に見つからずに済む。',
      hardBottle: '対魔硬質ゴリラガラス製。ゴリラの渾身の力で締められている。',
      gratefulTalisman: '『死ぬこと以外かすり傷』と書いてある。致命の一撃だけはHP1で踏みとどまれる。',
      mikawashiFeather: '三歩の間だけ、戦闘中の身のこなしが軽くなる羽根。ミカワシという鷲の羽らしい。',
    });
    expect(result.useButtons).toEqual({
      fakeWoundMedicine: true,
      smokeBomb: true,
      hardBottle: false,
      gratefulTalisman: false,
      mikawashiFeather: true,
    });
  });

  test('fake wound medicine heals the actual capped amount and is not wasted at full HP', async ({ page }) => {
    const result = await page.evaluate(() => {
      const logContainer = document.getElementById('logContainer');
      if (logContainer) logContainer.innerHTML = '';
      RPG.State.inventory.fakeWoundMedicine = 2;
      RPG.State.maxHP = 140;
      RPG.State.currentHP = 120;

      explorationSystem.useItem('fakeWoundMedicine');
      const afterUse = {
        hp: RPG.State.currentHP,
        count: RPG.State.inventory.fakeWoundMedicine,
        log: logContainer?.textContent || '',
      };

      explorationSystem.useItem('fakeWoundMedicine');
      return {
        afterUse,
        afterFullUse: {
          hp: RPG.State.currentHP,
          count: RPG.State.inventory.fakeWoundMedicine,
          log: logContainer?.textContent || '',
        },
      };
    });

    expect(result.afterUse.hp).toBe(140);
    expect(result.afterUse.count).toBe(1);
    expect(result.afterUse.log).toContain('🩹傷薬もどきを使い、HPが20回復した。');
    expect(result.afterFullUse.hp).toBe(140);
    expect(result.afterFullUse.count).toBe(1);
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
        mikawashiStepsRemaining: 0,
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

  test('mikawashi applies to a battle on the third step, not the fourth, and takes priority over night medicine', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'forest',
        location: uiControl.getLocData(1).name,
        currentDistance: 1,
        storyPhase: 5,
        mikawashiStepsRemaining: 0,
        smokeBombStepsRemaining: 0,
      });
      Object.assign(RPG.State.flags, {
        onWagon: false,
        silverDelivered: true,
        isDebugEncountersOff: true,
      });
      RPG.State.inventory.mikawashiFeather = 1;

      const originalRandom = Math.random;
      const originalCheckEvents = explorationSystem.checkEvents;
      const originalTreeEncounter = scenarioEvents.treeEventSystem.handleEncounter;
      const originalStartBattle = battleSystem.startBattle;
      const captured = [];

      Math.random = () => 0;
      explorationSystem.checkEvents = () => false;
      scenarioEvents.treeEventSystem.handleEncounter = () => false;
      battleSystem.startBattle = (_enemyId, options = {}) => {
        captured.push(options.mikawashiEvasionActive === true);
      };

      explorationSystem.useItem('mikawashiFeather');
      const initialStatus = document.getElementById('statusInfo')?.textContent || '';
      explorationSystem.move(1, { skipTravelCue: true });
      explorationSystem.move(-1, { skipTravelCue: true });
      RPG.State.flags.isDebugEncountersOff = false;
      explorationSystem.move(1, { skipTravelCue: true });
      const afterThird = {
        steps: RPG.State.mikawashiStepsRemaining,
        battleActive: captured[captured.length - 1],
      };
      explorationSystem.move(-1, { skipTravelCue: true });
      const afterFourth = {
        steps: RPG.State.mikawashiStepsRemaining,
        battleActive: captured[captured.length - 1],
      };

      battleSystem.startBattle = originalStartBattle;
      explorationSystem.checkEvents = originalCheckEvents;
      scenarioEvents.treeEventSystem.handleEncounter = originalTreeEncounter;

      const logContainer = document.getElementById('logContainer');
      if (logContainer) logContainer.innerHTML = '';
      RPG.State.battleState = {
        mikawashiEvasionActive: true,
        nightMedicineEvasionActive: true,
      };
      Math.random = () => 0.49;
      const dodged = battleSystem.tryEnemyAttackDodge({ allowNormalEvasion: true });
      const dodgeLog = logContainer?.textContent || '';

      RPG.State.mode = 'base';
      RPG.State.location = 'かつての街道';
      RPG.State.isInDungeon = true;
      RPG.State.isAtInn = false;
      RPG.State.flags.onWagon = true;
      RPG.State.mikawashiStepsRemaining = 0;
      const usableOnHighway = explorationSystem.canUseMikawashiFeather();

      Math.random = originalRandom;
      return { initialStatus, afterThird, afterFourth, dodged, dodgeLog, usableOnHighway };
    });

    expect(result.initialStatus).toContain('ミカワシ 3歩');
    expect(result.afterThird).toEqual({ steps: 0, battleActive: true });
    expect(result.afterFourth).toEqual({ steps: 0, battleActive: false });
    expect(result.dodged).toBe(true);
    expect(result.dodgeLog).toContain('ミカワシ羽の力で、カインは攻撃をかわした！');
    expect(result.dodgeLog).not.toContain('薬の余韻');
    expect(result.usableOnHighway).toBe(true);
  });

  test('temporary effects clear on inn entry, defeat, and the highway transition', async ({ page }) => {
    const result = await page.evaluate(() => {
      const setEffects = () => {
        RPG.State.smokeBombStepsRemaining = 7;
        RPG.State.mikawashiStepsRemaining = 2;
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
        mikawashi: RPG.State.mikawashiStepsRemaining,
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
        mikawashi: RPG.State.mikawashiStepsRemaining,
      };
      innSystem.showDefeatSequence = originalDefeatSequence;

      setEffects();
      explorationSystem.transitionToHighway();
      const afterHighwayTransition = {
        smoke: RPG.State.smokeBombStepsRemaining,
        mikawashi: RPG.State.mikawashiStepsRemaining,
      };

      return { afterInnEntry, afterDefeat, afterHighwayTransition };
    });

    expect(result).toEqual({
      afterInnEntry: { smoke: 0, mikawashi: 0 },
      afterDefeat: { smoke: 0, mikawashi: 0 },
      afterHighwayTransition: { smoke: 0, mikawashi: 0 },
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

  test('temporary step counts survive saves and missing old-save fields normalize to zero', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.smokeBombStepsRemaining = 7;
      RPG.State.mikawashiStepsRemaining = 2;
      localStorage.setItem('okai_rpg_save_1', JSON.stringify(RPG.State));
      RPG.State.smokeBombStepsRemaining = 0;
      RPG.State.mikawashiStepsRemaining = 0;
      uiControl.loadGame(1);
      const restored = {
        smoke: RPG.State.smokeBombStepsRemaining,
        mikawashi: RPG.State.mikawashiStepsRemaining,
      };

      localStorage.setItem('okai_rpg_save_1', JSON.stringify({
        currentHP: 100,
        inventory: { herb: 1 },
        flags: {},
      }));
      uiControl.loadGame(1);
      const oldSave = {
        smoke: explorationSystem.getTemporaryEffectSteps('smokeBombStepsRemaining'),
        mikawashi: explorationSystem.getTemporaryEffectSteps('mikawashiStepsRemaining'),
        fakeWoundMedicine: RPG.State.inventory.fakeWoundMedicine,
        smokeBomb: RPG.State.inventory.smokeBomb,
        hardBottle: RPG.State.inventory.hardBottle,
        gratefulTalisman: RPG.State.inventory.gratefulTalisman,
        mikawashiFeather: RPG.State.inventory.mikawashiFeather,
      };

      return { restored, oldSave };
    });

    expect(result.restored).toEqual({ smoke: 7, mikawashi: 2 });
    expect(result.oldSave).toEqual({
      smoke: 0,
      mikawashi: 0,
      fakeWoundMedicine: 0,
      smokeBomb: 0,
      hardBottle: 0,
      gratefulTalisman: 0,
      mikawashiFeather: 0,
    });
  });
});

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
      gratefulTalisman: '『死ぬこと以外かすり傷』と書いてある。使うと準備状態になり、次以降の戦闘で致命の一撃を受けた時、一度だけHP1で踏みとどまれる。',
    });
    expect(result.useButtons).toEqual({
      fakeWoundMedicine: true,
      smokeBomb: true,
      hardBottle: true,
      gratefulTalisman: true,
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

  test('shiny oil prepares one battle of increased criticals and clears after the battle', async ({ page }) => {
    const result = await page.evaluate(() => {
      const logContainer = document.getElementById('logContainer');
      if (logContainer) logContainer.innerHTML = '';
      Object.assign(RPG.State, {
        mode: 'base',
        isBattling: false,
        currentHP: 100,
        maxHP: 100,
        attack: 20,
        equippedRareAmberId: null,
      });
      RPG.State.inventory.shinyOil = 2;
      RPG.State.flags.shinyOilPrepared = false;

      uiControl.selectItem('shinyOil', RPG.State.inventory.shinyOil);
      const useButtonVisible = Boolean(document.querySelector('#itemDetailArea button'));
      explorationSystem.useItem('shinyOil');
      const afterPrepare = {
        count: RPG.State.inventory.shinyOil,
        prepared: RPG.State.flags.shinyOilPrepared,
      };

      explorationSystem.useItem('shinyOil');
      const afterRepeatUse = {
        count: RPG.State.inventory.shinyOil,
        prepared: RPG.State.flags.shinyOilPrepared,
        log: logContainer?.textContent || '',
      };

      const originalContinueBattleStart = battleSystem.continueBattleStart;
      const originalRandom = Math.random;
      battleSystem.continueBattleStart = () => {};
      Math.random = () => 0.25;
      const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'rat');
      battleSystem.beginBattle(template);
      const activeAtStart = RPG.State.battleState?.shinyOilCriticalActive === true;
      const preparationClearedAtStart = RPG.State.flags.shinyOilPrepared === false;
      const attackResult = battleSystem.performCainAttack({ allowSwordTechniques: false });
      const criticalDuringBattle = attackResult.hits.some(hit => hit.isCritical === true);

      RPG.State.currentEnemy.hp = 0;
      RPG.State.lastBlowBy = 'Cain';
      RPG.State.defeatCounts.rat = { cain: 0, owen: 0 };
      battleSystem.executeStandardVictory('rat');
      const clearedAfterBattle = RPG.State.battleState === null;

      battleSystem.beginBattle(template);
      const inactiveNextBattle = RPG.State.battleState?.shinyOilCriticalActive === false;

      Math.random = originalRandom;
      battleSystem.continueBattleStart = originalContinueBattleStart;
      return {
        useButtonVisible,
        afterPrepare,
        afterRepeatUse,
        activeAtStart,
        preparationClearedAtStart,
        criticalDuringBattle,
        clearedAfterBattle,
        inactiveNextBattle,
      };
    });

    expect(result).toMatchObject({
      useButtonVisible: true,
      afterPrepare: { count: 1, prepared: true },
      afterRepeatUse: { count: 1, prepared: true },
      activeAtStart: true,
      preparationClearedAtStart: true,
      criticalDuringBattle: true,
      clearedAfterBattle: true,
      inactiveNextBattle: true,
    });
    expect(result.afterRepeatUse.log).toContain('✨ピカピカ油は、もう準備してある。');
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

  test('prepared grateful talisman precedes Owen and the charm, is consumed on trigger, and ignores poison/bad end', async ({ page }) => {
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
      RPG.State.flags.gratefulTalismanPrepared = true;
      RPG.State.inventory.charm = 1;

      const first = battleSystem.applyEnemyDirectDamage(10);
      const firstCheck = battleSystem.checkBattleEnd();
      const firstState = {
        result: first,
        checkEnded: firstCheck,
        hp: RPG.State.currentHP,
        prepared: RPG.State.flags.gratefulTalismanPrepared,
        charm: RPG.State.inventory.charm,
        owenSaved: RPG.State.hasOwenSavedLife,
      };

      // The talisman was already consumed by the first save, so this second lethal hit in
      // the same battle falls straight to the charm - re-preparing only happens outside battle.
      const second = battleSystem.applyEnemyDirectDamage(10);
      const secondCheck = battleSystem.checkBattleEnd();
      const charmFallback = {
        result: second,
        checkEnded: secondCheck,
        hp: RPG.State.currentHP,
        prepared: RPG.State.flags.gratefulTalismanPrepared,
        charm: RPG.State.inventory.charm,
      };

      RPG.State.currentEnemy = { id: 'test_enemy', name: '試験魔物', hp: 10, atk: 10, msg: '攻撃してきた！' };
      RPG.State.battleState = makeBattleState();
      RPG.State.currentHP = 5;
      RPG.State.flags.gratefulTalismanPrepared = true;
      RPG.State.inventory.charm = 1;
      RPG.State.hasOwenSavedLife = false;
      RPG.State.isBattling = true;
      RPG.State.debug.isSkipping = true;
      const originalRandom = Math.random;
      Math.random = () => 1;
      battleSystem.enemyTurn();
      const beforeOwen = {
        hp: RPG.State.currentHP,
        prepared: RPG.State.flags.gratefulTalismanPrepared,
        charm: RPG.State.inventory.charm,
        owenSaved: RPG.State.hasOwenSavedLife,
      };

      RPG.State.currentEnemy = { id: 'test_enemy', name: '試験魔物', hp: 10, atk: 10, msg: '攻撃してきた！' };
      RPG.State.battleState = makeBattleState();
      RPG.State.currentHP = 5;
      RPG.State.flags.gratefulTalismanPrepared = false;
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
      RPG.State.flags.gratefulTalismanPrepared = true;
      RPG.State.isPoisoned = true;
      RPG.State.poisonDamageRemaining = 20;
      const poisonReachedBoundary = battleSystem.applyPoisonTick();
      const poisonState = {
        reachedBoundary: poisonReachedBoundary,
        hp: RPG.State.currentHP,
        prepared: RPG.State.flags.gratefulTalismanPrepared,
      };

      RPG.State.currentHP = 140;
      RPG.State.flags.gratefulTalismanPrepared = true;
      RPG.State.currentEnemy = { id: 'glowing_cat_rabbit', hp: 9999 };
      RPG.State.battleState = makeBattleState();
      battleSystem.resolveGlowingCatRabbitLv88BadEnd();
      const badEndState = {
        hp: RPG.State.currentHP,
        prepared: RPG.State.flags.gratefulTalismanPrepared,
      };

      Math.random = originalRandom;
      RPG.State.debug.isSkipping = false;
      return {
        firstState,
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
      prepared: false,
      charm: 1,
      owenSaved: false,
    });
    expect(result.charmFallback).toMatchObject({
      checkEnded: false,
      hp: 70,
      prepared: false,
      charm: 0,
    });
    expect(result.beforeOwen).toEqual({
      hp: 1,
      prepared: false,
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
      prepared: true,
    });
    expect(result.badEndState).toEqual({
      hp: 0,
      prepared: true,
    });
  });

  test('the Lv88 bad end clears the forest backdrop before revealing ？？？', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        isInDungeon: true,
        isAtInn: false,
        explorationArea: 'forest',
        currentDistance: 5,
        location: '琥珀の森',
        currentHP: 140,
        maxHP: 140,
        isBattling: true,
        currentEnemy: { id: 'glowing_cat_rabbit', hp: 9999 },
        battleState: {},
      });
      battleSystem.showGlowingCatRabbitLv88BadEnd();
      return {
        location: RPG.State.location,
        activeScene: typeof visualDirector !== 'undefined' ? visualDirector.getActiveScene() : null,
        hasForestClass: document.body.className.split(' ').some(c => c.startsWith('scene-forest')),
      };
    });
    expect(result).toEqual({ location: '？？？', activeScene: 'none', hasForestClass: false });
  });

  test('using the grateful talisman from inventory prepares it once and consumes one charge', async ({ page }) => {
    const result = await page.evaluate(() => {
      const logContainer = document.getElementById('logContainer');
      if (logContainer) logContainer.innerHTML = '';
      RPG.State.inventory.gratefulTalisman = 2;
      RPG.State.mode = 'base';
      RPG.State.flags.gratefulTalismanPrepared = false;

      explorationSystem.useItem('gratefulTalisman');
      const afterPrepare = {
        count: RPG.State.inventory.gratefulTalisman,
        prepared: RPG.State.flags.gratefulTalismanPrepared,
        log: logContainer?.textContent || '',
      };

      RPG.State.mode = 'base';
      explorationSystem.useItem('gratefulTalisman');
      const afterRepeatUse = {
        count: RPG.State.inventory.gratefulTalisman,
        prepared: RPG.State.flags.gratefulTalismanPrepared,
        log: logContainer?.textContent || '',
      };

      return { afterPrepare, afterRepeatUse };
    });

    expect(result.afterPrepare).toMatchObject({ count: 1, prepared: true });
    expect(result.afterPrepare.log).toContain('🧧ありがた〜い札を準備した。');
    expect(result.afterRepeatUse).toMatchObject({ count: 1, prepared: true });
    expect(result.afterRepeatUse.log).toContain('🧧ありがた〜い札は、もう準備してある。');
  });

  test('opening the hard bottle once yields three jam uses and shows the remaining count', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, { mode: 'base', cainLv: 11, dialogueQueue: [] });
      RPG.State.flags.hardBottleOpened = false;
      RPG.State.inventory.hardBottle = 1;
      RPG.State.inventory.highHerbJam = 0;

      explorationSystem.useItem('hardBottle');
      const queue = RPG.State.dialogueQueue;
      const lastLine = queue[queue.length - 1];
      const grantText = lastLine.text;
      lastLine.action();
      const afterOpen = {
        hardBottle: RPG.State.inventory.hardBottle,
        jam: RPG.State.inventory.highHerbJam,
        opened: RPG.State.flags.hardBottleOpened,
      };

      RPG.State.mode = 'base';
      RPG.State.dialogueQueue = [];
      uiControl.selectItem('highHerbJam', RPG.State.inventory.highHerbJam);
      const detailAtThree = document.getElementById('itemDetailArea')?.textContent || '';
      uiControl.selectItem('highHerbJam', 1);
      const detailAtOne = document.getElementById('itemDetailArea')?.textContent || '';

      // The bottle is gone, so the opening cannot repeat.
      explorationSystem.useItem('hardBottle');
      const afterRetry = {
        hardBottle: RPG.State.inventory.hardBottle,
        jam: RPG.State.inventory.highHerbJam,
      };

      return { grantText, afterOpen, detailAtThree, detailAtOne, afterRetry };
    });

    expect(result.grantText).toBe('🫙🌿上薬草のジャムを手に入れた！');
    expect(result.afterOpen).toEqual({ hardBottle: 0, jam: 3, opened: true });
    expect(result.detailAtThree).toContain('🫙🌿上薬草のジャム 3/3');
    expect(result.detailAtThree).toContain(
      '味は想像がつく。使うと準備状態になり、次以降の戦闘で体力が半分以下になった時、一度だけ全回復する。あと3回分ある。'
    );
    expect(result.detailAtOne).toContain('🫙🌿上薬草のジャム 1/3');
    expect(result.detailAtOne).toContain('あと1回分ある。');
    expect(result.afterRetry).toEqual({ hardBottle: 0, jam: 3 });
  });

  test('the jam prepares once, keeps the prepared state across battles, and full-heals only once', async ({ page }) => {
    const result = await page.evaluate(() => {
      const logContainer = document.getElementById('logContainer');
      if (logContainer) logContainer.innerHTML = '';
      Object.assign(RPG.State, {
        mode: 'base',
        isBattling: false,
        maxHP: 100,
        currentHP: 100,
      });
      RPG.State.inventory.highHerbJam = 3;
      RPG.State.flags.highHerbJamPrepared = false;

      explorationSystem.useItem('highHerbJam');
      const afterPrepare = {
        jam: RPG.State.inventory.highHerbJam,
        prepared: RPG.State.flags.highHerbJamPrepared,
      };

      RPG.State.mode = 'base';
      explorationSystem.useItem('highHerbJam');
      const afterRepeatUse = {
        jam: RPG.State.inventory.highHerbJam,
        prepared: RPG.State.flags.highHerbJamPrepared,
        log: logContainer?.textContent || '',
      };

      // Battle 1: damage that stops above half leaves the prepared state alone,
      // and it also survives the save/load round trip between battles.
      RPG.State.mode = 'battle';
      RPG.State.isBattling = true;
      RPG.State.battleState = {};
      battleSystem.applyEnemyDirectDamage(20);
      const afterFirstBattle = {
        hp: RPG.State.currentHP,
        prepared: RPG.State.flags.highHerbJamPrepared,
      };

      RPG.State.isBattling = false;
      RPG.State.mode = 'base';
      const snapshot = uiControl.createSaveSnapshot('journal');
      localStorage.setItem('okai_rpg_high_herb_jam_test', JSON.stringify(snapshot));
      RPG.State.flags.highHerbJamPrepared = false;
      uiControl.loadFromStorage('okai_rpg_high_herb_jam_test', '上薬草のジャムテスト');
      const afterLoad = { prepared: RPG.State.flags.highHerbJamPrepared };

      // Battle 2: the first drop to half HP or less fully heals, once.
      RPG.State.maxHP = 100;
      RPG.State.currentHP = 80;
      RPG.State.isBattling = true;
      RPG.State.battleState = {};
      battleSystem.applyEnemyDirectDamage(30);
      const afterTrigger = {
        hp: RPG.State.currentHP,
        jam: RPG.State.inventory.highHerbJam,
        prepared: RPG.State.flags.highHerbJamPrepared,
        log: logContainer?.textContent || '',
      };

      battleSystem.applyEnemyDirectDamage(60);
      const afterSecondDrop = {
        hp: RPG.State.currentHP,
        prepared: RPG.State.flags.highHerbJamPrepared,
      };

      return { afterPrepare, afterRepeatUse, afterFirstBattle, afterLoad, afterTrigger, afterSecondDrop };
    });

    expect(result.afterPrepare).toEqual({ jam: 2, prepared: true });
    expect(result.afterRepeatUse).toMatchObject({ jam: 2, prepared: true });
    expect(result.afterRepeatUse.log).toContain('🫙🌿上薬草のジャムは、もう準備してある。');
    expect(result.afterFirstBattle).toEqual({ hp: 80, prepared: true });
    expect(result.afterLoad).toEqual({ prepared: true });
    expect(result.afterTrigger).toMatchObject({ hp: 100, jam: 2, prepared: false });
    expect(result.afterTrigger.log).toContain('🫙🌿上薬草のジャムが効き、HPが全回復した！');
    expect(result.afterSecondDrop).toEqual({ hp: 40, prepared: false });
  });

  test('the prepared jam beats lethal damage to the talisman, Owen, and defeat', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'battle',
        isBattling: true,
        maxHP: 100,
        currentHP: 30,
        hasOwenSavedLife: false,
        currentEnemy: { id: 'test_enemy', name: '試験魔物', hp: 10, atk: 10, msg: '攻撃してきた！' },
        battleState: { skippedTurns: 0, playerTookDamage: false, gratefulTalismanSurvivalActive: false },
      });
      Object.assign(RPG.State.inventory, {
        highHerbJam: 2,
        charm: 1,
      });
      RPG.State.flags.highHerbJamPrepared = true;
      RPG.State.flags.gratefulTalismanPrepared = true;

      const damageResult = battleSystem.applyEnemyDirectDamage(500);
      const ended = battleSystem.checkBattleEnd();

      return {
        damageResult,
        ended,
        hp: RPG.State.currentHP,
        prepared: RPG.State.flags.highHerbJamPrepared,
        jam: RPG.State.inventory.highHerbJam,
        talismanPrepared: RPG.State.flags.gratefulTalismanPrepared,
        charm: RPG.State.inventory.charm,
        owenSaved: RPG.State.hasOwenSavedLife,
      };
    });

    expect(result.damageResult).toMatchObject({ talismanActivated: false, lethal: false });
    expect(result).toMatchObject({
      ended: false,
      hp: 100,
      prepared: false,
      jam: 2,
      talismanPrepared: true,
      charm: 1,
      owenSaved: false,
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

  test('the herb "getting used to it" line now waits for the 10th use, not the 3rd', async ({ page }) => {
    const result = await page.evaluate(() => {
      RPG.State.herbUseCount = 3;
      const atThird = explorationSystem.getItemUseDialogue('herb');

      RPG.State.herbUseCount = 10;
      const atTenth = explorationSystem.getItemUseDialogue('herb');

      return {
        atThird,
        atTenthFirstLine: atTenth?.[0]?.text,
      };
    });

    expect(result.atThird).toBeNull();
    expect(result.atTenthFirstLine).toBe('カイン「この味、だんだん癖になってきた」');
  });

  test('with the brooch already returned, herb garden 3m shows only the "no need to push it" line, without the tactical choice scene', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'herbGarden',
        currentDistance: 2,
        storyPhase: 6,
        equippedRareAmberId: null,
      });
      Object.assign(RPG.State.flags, {
        scentPouchQuestStarted: true,
        herbGardenBroochReturned: true,
        herbGardenBlockedExperienced: false,
      });
      RPG.State.inventory.lightRabbitBrooch = 0;
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';

      explorationSystem.move(1, { skipTravelCue: true });
      const modeDuring = RPG.State.mode;
      uiControl.handlePlayerInput();

      return {
        modeDuring,
        modeAfter: RPG.State.mode,
        distanceAfter: RPG.State.currentDistance,
        log: log?.textContent || '',
      };
    });

    expect(result.modeDuring).toBe('event');
    expect(result.log).toContain('カイン（今は無理に進む必要はない）');
    expect(result.log).not.toContain('どうする');
    expect(result.modeAfter).toBe('base');
    expect(result.distanceAfter).toBe(2);
  });

  test('ignoredAmber still lets Cain pass herb garden 3m normally without the brooch', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'herbGarden',
        currentDistance: 2,
        storyPhase: 6,
        equippedRareAmberId: 'ignoredAmber',
      });
      Object.assign(RPG.State.flags, {
        scentPouchQuestStarted: true,
        herbGardenBroochReturned: true,
        herbGardenBlockedExperienced: false,
      });
      RPG.State.inventory.lightRabbitBrooch = 0;
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';

      const maxDistance = explorationSystem.getHerbGardenMaxDistance();
      explorationSystem.move(1, { skipTravelCue: true });

      return {
        maxDistance,
        mode: RPG.State.mode,
        distance: RPG.State.currentDistance,
        log: log?.textContent || '',
      };
    });

    expect(result.maxDistance).toBeGreaterThan(3);
    expect(result.mode).toBe('base');
    expect(result.distance).toBe(3);
    expect(result.log).not.toContain('今は無理に進む必要はない');
  });

  test('reaching herb garden 7m via the ignoredAmber bypass plays the one-time rest scene, once only', async ({ page }) => {
    const result = await page.evaluate(() => {
      // 7m is not exempt from the normal random-encounter roll (only 3m is), so pin it off -
      // otherwise this test would be flaky.
      const originalRandom = Math.random;
      Math.random = () => 1;

      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'herbGarden',
        currentDistance: 6,
        storyPhase: 6,
        equippedRareAmberId: 'ignoredAmber',
      });
      Object.assign(RPG.State.flags, {
        herbGardenBroochReturned: true,
        herbGarden7mIgnoredAmberRestSeen: false,
      });
      RPG.State.inventory.lightRabbitBrooch = 0;
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';

      explorationSystem.move(1, { skipTravelCue: true });
      const modeDuring = RPG.State.mode;
      for (let i = 0; i < 4; i++) uiControl.handlePlayerInput();
      const firstVisit = {
        modeDuring,
        modeAfter: RPG.State.mode,
        distance: RPG.State.currentDistance,
        log: log?.textContent || '',
        seenFlag: RPG.State.flags.herbGarden7mIgnoredAmberRestSeen,
      };

      // Leave and come back: the one-time flag must block a replay.
      RPG.State.mode = 'base';
      explorationSystem.move(-1, { skipTravelCue: true });
      if (log) log.innerHTML = '';
      explorationSystem.move(1, { skipTravelCue: true });
      const secondVisit = {
        mode: RPG.State.mode,
        log: log?.textContent || '',
      };

      Math.random = originalRandom;
      return { firstVisit, secondVisit };
    });

    expect(result.firstVisit.modeDuring).toBe('event');
    expect(result.firstVisit.log).toContain('カイン（ここで…あんまり休む気になれないな）');
    expect(result.firstVisit.log).toContain('オーエン「どうしたの？」');
    expect(result.firstVisit.log).toContain('オーエンがすぐ耳元で囁いた。');
    expect(result.firstVisit.log).toContain('カイン「うわ！近い！」');
    expect(result.firstVisit.modeAfter).toBe('base');
    expect(result.firstVisit.distance).toBe(7);
    expect(result.firstVisit.seenFlag).toBe(true);

    expect(result.secondVisit.mode).toBe('base');
    expect(result.secondVisit.log).not.toContain('あんまり休む気になれないな');
  });

  test('herb garden 7m stays plain on the normal brooch route (no ignoredAmber equipped)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const originalRandom = Math.random;
      Math.random = () => 1;

      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'herbGarden',
        currentDistance: 6,
        storyPhase: 6,
        equippedRareAmberId: null,
      });
      Object.assign(RPG.State.flags, {
        herbGardenBroochReturned: false,
        herbGarden7mIgnoredAmberRestSeen: false,
      });
      RPG.State.inventory.lightRabbitBrooch = 1;
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';

      explorationSystem.move(1, { skipTravelCue: true });

      const outcome = {
        mode: RPG.State.mode,
        distance: RPG.State.currentDistance,
        log: log?.textContent || '',
      };
      Math.random = originalRandom;
      return outcome;
    });

    expect(result.mode).toBe('base');
    expect(result.distance).toBe(7);
    expect(result.log).not.toContain('あんまり休む気になれないな');
  });
});

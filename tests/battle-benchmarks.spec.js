// @ts-check
const { test, expect } = require('@playwright/test');

async function openGame(page) {
  await page.goto('/chapter1.html');
  await page.waitForFunction(() => (
    typeof RPG !== 'undefined' &&
    typeof battleSystem !== 'undefined' &&
    RPG.Assets?.BATTLE_AI?.carnivorous_vine
  ));
}

test.describe('Chapter 1 battle balance benchmarks', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
  });

  test('keeps every Chapter 1 enemy inside an explicit measurement profile', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      const profileLevels = [5, 8, 9, 10, 12];
      const profiles = Object.fromEntries(profileLevels.map(level => {
        const gained = level - RPG.DefaultState.cainLv;
        return [level, {
          maxHP: RPG.DefaultState.maxHP + gained * 10,
          attack: RPG.DefaultState.attack + gained * 2,
        }];
      }));
      const ids = [
        'rat', 'amber_rat', 'weasel', 'amber_weasel', 'sap',
        'hungry_amber_tree', 'giant_larva', 'skull_bee', 'carnivorous_vine',
        'amber_burning_root', 'hell_rat_swarm', 'eye_eating_crow',
        'amber_husk_giant_larva', 'normal_rat', 'glowing_cat_rabbit',
      ];
      const enemies = Object.fromEntries(ids.map(id => {
        const enemy = RPG.Assets.ENEMIES.find(candidate => candidate.id === id);
        return [id, {
          maxHp: enemy.maxHp,
          atk: enemy.atk,
          armorMax: enemy.armorMax || 0,
          poisonRate: enemy.poisonRate || 0,
          ambientAttackChance: enemy.ambientAttackChance || 0,
          selfBurnDamage: enemy.selfBurnDamage || 0,
          preemptive: enemy.preemptive || 0,
        }];
      }));
      return { profiles, enemies };
    });

    expect(snapshot).toEqual({
      profiles: {
        5: { maxHP: 140, attack: 18 },
        8: { maxHP: 170, attack: 24 },
        9: { maxHP: 180, attack: 26 },
        10: { maxHP: 190, attack: 28 },
        12: { maxHP: 210, attack: 32 },
      },
      enemies: {
        rat: { maxHp: 45, atk: 10, armorMax: 0, poisonRate: 0, ambientAttackChance: 0, selfBurnDamage: 0, preemptive: 0 },
        amber_rat: { maxHp: 80, atk: 18, armorMax: 40, poisonRate: 0, ambientAttackChance: 0, selfBurnDamage: 0, preemptive: 0 },
        weasel: { maxHp: 50, atk: 12, armorMax: 0, poisonRate: 0, ambientAttackChance: 0, selfBurnDamage: 0, preemptive: 1 },
        amber_weasel: { maxHp: 85, atk: 20, armorMax: 40, poisonRate: 0, ambientAttackChance: 0, selfBurnDamage: 0, preemptive: 1 },
        sap: { maxHp: 85, atk: 16, armorMax: 0, poisonRate: 0, ambientAttackChance: 0, selfBurnDamage: 0, preemptive: 0 },
        hungry_amber_tree: { maxHp: 170, atk: 19, armorMax: 50, poisonRate: 0, ambientAttackChance: 0, selfBurnDamage: 0, preemptive: 0 },
        giant_larva: { maxHp: 100, atk: 12, armorMax: 0, poisonRate: 0, ambientAttackChance: 0, selfBurnDamage: 0, preemptive: 0 },
        skull_bee: { maxHp: 90, atk: 34, armorMax: 0, poisonRate: 1, ambientAttackChance: 0.1, selfBurnDamage: 0, preemptive: 0 },
        carnivorous_vine: { maxHp: 195, atk: 40, armorMax: 0, poisonRate: 0, ambientAttackChance: 0, selfBurnDamage: 0, preemptive: 0 },
        amber_burning_root: { maxHp: 320, atk: 28, armorMax: 0, poisonRate: 0, ambientAttackChance: 0, selfBurnDamage: 10, preemptive: 0 },
        hell_rat_swarm: { maxHp: 100, atk: 24, armorMax: 0, poisonRate: 0, ambientAttackChance: 0, selfBurnDamage: 0, preemptive: 0 },
        eye_eating_crow: { maxHp: 120, atk: 28, armorMax: 0, poisonRate: 0, ambientAttackChance: 0, selfBurnDamage: 0, preemptive: 0 },
        amber_husk_giant_larva: { maxHp: 600, atk: 20, armorMax: 0, poisonRate: 0, ambientAttackChance: 0, selfBurnDamage: 0, preemptive: 0 },
        normal_rat: { maxHp: 1, atk: 1, armorMax: 0, poisonRate: 0, ambientAttackChance: 0, selfBurnDamage: 0, preemptive: 0 },
        glowing_cat_rabbit: { maxHp: 1, atk: 5, armorMax: 0, poisonRate: 0, ambientAttackChance: 0, selfBurnDamage: 0, preemptive: 0 },
      },
    });
  });

  test('a forced skull-bee sting has one name, real damage, and its poison side effect', async ({ page }) => {
    const result = await page.evaluate(() => {
      const originalRandom = Math.random;
      const originalTimeout = window.setTimeout;
      const bee = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'skull_bee');
      try {
        window.setTimeout = callback => {
          callback();
          return 0;
        };
        Math.random = (() => {
          const rolls = [0.99, 0.99, 0.99]; // no ambient, no parry, guaranteed poison
          return () => rolls.shift() ?? 0.99;
        })();
        Object.assign(RPG.State, {
          mode: 'battle',
          isBattling: true,
          cainLv: 8,
          currentHP: 170,
          maxHP: 170,
          attack: 24,
          defense: 0,
          equippedRareAmberId: null,
          isPoisoned: false,
          poisonDamageRemaining: 0,
          hasOwenSavedLife: true,
          currentEnemy: { ...bee, hp: bee.maxHp },
        });
        RPG.State.inventory.fireproofGloves = 0;
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
        battleSystem.runJourneyEnemyTurn(() => {});
        return {
          currentHP: RPG.State.currentHP,
          poisoned: RPG.State.isPoisoned,
          log: log?.textContent || '',
        };
      } finally {
        Math.random = originalRandom;
        window.setTimeout = originalTimeout;
      }
    });

    expect(result.currentHP).toBe(136); // 34 ATK, no fireproof gloves
    expect(result.poisoned).toBe(true);
    expect(result.log).toContain('ドクロ蜂が毒針で刺してきた！');
    expect(result.log).not.toContain('ドクロ蜂がドクロ蜂');
    expect(result.log).toContain('攻撃に毒が含まれていた！ (毒状態)');
  });

  test('the hungry amber tree takes one-third damage while its bark remains', async ({ page }) => {
    const result = await page.evaluate(() => {
      const tree = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'hungry_amber_tree');
      RPG.State.currentEnemy = { ...tree, hp: tree.maxHp, armorHp: tree.armorMax };
      battleSystem.applyCainDamage(18, false);
      const afterNormal = {
        hp: RPG.State.currentEnemy.hp,
        armorHp: RPG.State.currentEnemy.armorHp,
      };
      battleSystem.applyCainDamage(18, true);
      return {
        afterNormal,
        afterCritical: {
          hp: RPG.State.currentEnemy.hp,
          armorHp: RPG.State.currentEnemy.armorHp,
        },
      };
    });

    expect(result).toEqual({
      afterNormal: { hp: 164, armorHp: 32 },
      afterCritical: { hp: 146, armorHp: 32 },
    });
  });

  test('carnivorous-vine acid disables two player attacks\' sword techniques and criticals', async ({ page }) => {
    const result = await page.evaluate(() => {
      const originalRandom = Math.random;
      const originalTimeout = window.setTimeout;
      const originalUi = {
        addLog: uiControl.addLog,
        flashFullScreen: uiControl.flashFullScreen,
        updateUI: uiControl.updateUI,
      };
      const vine = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'carnivorous_vine');
      try {
        window.setTimeout = callback => {
          callback();
          return 0;
        };
        uiControl.addLog = () => {};
        uiControl.flashFullScreen = () => {};
        uiControl.updateUI = () => {};
        Object.assign(RPG.State, {
          isBattling: true,
          cainLv: 8,
          currentHP: 170,
          maxHP: 170,
          attack: 24,
          equippedRareAmberId: 'blueAmber',
          isPoisoned: false,
          battleState: { paralysisAttacksRemaining: 0 },
          currentEnemy: { ...vine, hp: vine.maxHp, vineMouthOpen: false },
        });
        Math.random = () => 0.4;
        RPG.Assets.BATTLE_AI.carnivorous_vine.execute({
          applyEnemyDirectDamage: damage => battleSystem.applyEnemyDirectDamage(damage),
          checkBattleEnd: () => false,
          runBattleLoop: () => {},
        });
        const afterAcid = {
          currentHP: RPG.State.currentHP,
          paralysisAttacksRemaining: RPG.State.battleState.paralysisAttacksRemaining,
        };
        originalUi.updateUI.call(uiControl);
        const paralysisStatus = document.getElementById('statusInfo')?.textContent || '';
        RPG.State.isPoisoned = true;
        originalUi.updateUI.call(uiControl);
        const combinedStatus = document.getElementById('statusInfo')?.textContent || '';
        RPG.State.isPoisoned = false;
        RPG.State.currentEnemy = { id: 'dummy', name: 'ダミー', hp: 999, armorHp: 0 };
        const firstAttack = battleSystem.performCainAttack();
        originalUi.updateUI.call(uiControl);
        const afterFirstAttack = {
          remaining: RPG.State.battleState.paralysisAttacksRemaining,
          status: document.getElementById('statusInfo')?.textContent || '',
        };
        const secondAttack = battleSystem.performCainAttack();
        originalUi.updateUI.call(uiControl);
        const afterSecondAttack = {
          remaining: RPG.State.battleState.paralysisAttacksRemaining,
          status: document.getElementById('statusInfo')?.textContent || '',
        };

        RPG.State.equippedRareAmberId = 'ignoredAmber';
        RPG.State.currentHP = 170;
        RPG.State.battleState.paralysisAttacksRemaining = 0;
        RPG.State.currentEnemy = { ...vine, hp: vine.maxHp, vineMouthOpen: false };
        RPG.Assets.BATTLE_AI.carnivorous_vine.execute({
          applyEnemyDirectDamage: damage => battleSystem.applyEnemyDirectDamage(damage),
          checkBattleEnd: () => false,
          runBattleLoop: () => {},
        });
        return {
          afterAcid,
          paralysisStatus,
          combinedStatus,
          firstAttack,
          afterFirstAttack,
          secondAttack,
          afterSecondAttack,
          afterIgnoredAmber: RPG.State.battleState.paralysisAttacksRemaining,
        };
      } finally {
        Math.random = originalRandom;
        window.setTimeout = originalTimeout;
        Object.assign(uiControl, originalUi);
      }
    });

    expect(result).toEqual({
      afterAcid: { currentHP: 143, paralysisAttacksRemaining: 2 },
      paralysisStatus: 'カイン Lv.8 【⚡】',
      combinedStatus: 'カイン Lv.8 【💀 / ⚡】',
      firstAttack: { technique: null, hits: [{ damage: 24, isCritical: false }] },
      afterFirstAttack: { remaining: 1, status: 'カイン Lv.8 【⚡】' },
      secondAttack: { technique: null, hits: [{ damage: 24, isCritical: false }] },
      afterSecondAttack: { remaining: 0, status: 'カイン Lv.8' },
      afterIgnoredAmber: 0,
    });
  });

  test('amber-husk giant larva enters a guaranteed, spaced neck-hunt phase after its two strong normal-attack phases', async ({ page }) => {
    const result = await page.evaluate(() => {
      const originalRandom = Math.random;
      const originalTimeout = window.setTimeout;
      const originalUi = {
        addLog: uiControl.addLog,
        flashFullScreen: uiControl.flashFullScreen,
        screenShake: uiControl.screenShake,
        updateUI: uiControl.updateUI,
      };
      const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'amber_husk_giant_larva');
      const logs = [];
      const damages = [];
      const effects = { flashes: 0, shakes: 0 };
      let halfHpScenes = 0;
      const system = {
        applyEnemyDirectDamage: damage => damages.push(damage),
        checkBattleEnd: () => false,
        resolveEnemyDirectDamage: damage => ({ damage, parried: false }),
        runBattleLoop: () => {},
        playAmberHuskHalfHpScene: callback => {
          halfHpScenes++;
          callback();
        },
      };
      try {
        window.setTimeout = callback => {
          callback();
          return 0;
        };
        uiControl.addLog = text => logs.push(text);
        uiControl.flashFullScreen = () => { effects.flashes++; };
        uiControl.screenShake = () => { effects.shakes++; };
        uiControl.updateUI = () => {};
        Object.assign(RPG.State, {
          currentHP: 50,
          battleState: { stunTurns: 0 },
          currentEnemy: {
            ...template,
            hp: 420,
            maxHp: 600,
          },
        });
        Math.random = () => 0.1;
        RPG.Assets.BATTLE_AI.amber_husk_giant_larva.execute(system);
        const phaseTwoAttack = { damages: [...damages], logs: [...logs] };
        damages.length = 0;
        logs.length = 0;
        Object.assign(RPG.State, {
          battleState: { stunTurns: 0 },
          currentEnemy: {
            ...template,
            hp: 240,
            maxHp: 600,
          },
        });
        Math.random = () => 0.1;
        RPG.Assets.BATTLE_AI.amber_husk_giant_larva.execute(system);
        const warningAtForty = { scenes: halfHpScenes, logs: [...logs] };
        logs.length = 0;
        Math.random = () => 0.1; // Guaranteed first neck hunt, then it hits.
        RPG.Assets.BATTLE_AI.amber_husk_giant_larva.execute(system);
        const hit = {
          damages: [...damages],
          logs: [...logs],
          effects: { ...effects },
          mercyUsed: RPG.State.currentEnemy.neckHuntMercyUsed,
        };

        damages.length = 0;
        logs.length = 0;
        effects.flashes = 0;
        effects.shakes = 0;
        RPG.Assets.BATTLE_AI.amber_husk_giant_larva.execute(system);
        const forcedWatching = { damages: [...damages], logs: [...logs], effects: { ...effects } };

        damages.length = 0;
        logs.length = 0;
        effects.flashes = 0;
        effects.shakes = 0;
        Math.random = (() => {
          const rolls = [0.1, 0.9]; // Neck hunt is selected, then misses.
          return () => rolls.shift() ?? 0.9;
        })();
        RPG.Assets.BATTLE_AI.amber_husk_giant_larva.execute(system);
        const miss = {
          damages: [...damages],
          logs: [...logs],
          effects: { ...effects },
          cooldown: RPG.State.currentEnemy.neckHuntCooldown,
        };
        damages.length = 0;
        logs.length = 0;
        effects.flashes = 0;
        effects.shakes = 0;
        RPG.State.currentHP = 190;
        RPG.State.currentEnemy.neckHuntCooldown = false;
        RPG.State.currentEnemy.neckHuntGuaranteed = true;
        Math.random = () => 0.1;
        RPG.Assets.BATTLE_AI.amber_husk_giant_larva.execute(system);
        const secondHit = { damages: [...damages], mercyUsed: RPG.State.currentEnemy.neckHuntMercyUsed };
        return {
          normalAttackValues: [template.baseAtk, template.phaseTwoAtk],
          neckHuntHitRate: template.neckHuntHitRate,
          evasionRate: template.evasionRate,
          phaseTwoAttack,
          warningAtForty,
          hit,
          miss,
          secondHit,
          forcedWatching,
        };
      } finally {
        Math.random = originalRandom;
        window.setTimeout = originalTimeout;
        Object.assign(uiControl, originalUi);
      }
    });

    expect(result.normalAttackValues).toEqual([20, 24]);
    expect(result.neckHuntHitRate).toBe(0.6);
    expect(result.evasionRate).toBe(0.2);
    expect(result.phaseTwoAttack.damages).toEqual([24]);
    expect(result.warningAtForty.scenes).toBe(1);
    expect(result.warningAtForty.logs).toContain('巨虫の琥珀の殻が赤黒く変色し、殺気が膨れ上がる！');
    expect(result.hit.damages).toEqual([49]);
    expect(result.hit.mercyUsed).toBe(true);
    expect(result.hit.logs).toContain('巨虫の鎌が閃いた――《首狩り》！');
    expect(result.hit.logs).toContain('《首狩り》が深く食い込んだ！');
    expect(result.hit.effects).toEqual({ flashes: 1, shakes: 1 });
    expect(result.miss.damages).toEqual([]);
    expect(result.miss.logs).toContain('巨虫の鎌が閃いた――《首狩り》！');
    expect(result.miss.logs).toContain('カインは間一髪で《首狩り》を避けた！');
    expect(result.miss.cooldown).toBe(true);
    expect(result.miss.effects).toEqual({ flashes: 0, shakes: 0 });
    expect(result.secondHit.damages).toEqual([90]);
    expect(result.secondHit.mercyUsed).toBe(true);
    expect(result.forcedWatching.damages).toEqual([]);
    expect(result.forcedWatching.logs).toEqual(['巨虫は鎌を構えたまま、カインの動きをうかがっている。']);
    expect(result.forcedWatching.effects).toEqual({ flashes: 0, shakes: 0 });
  });

  test('amber-husk giant larva can evade Cain attacks', async ({ page }) => {
    const result = await page.evaluate(() => {
      const originalRandom = Math.random;
      const originalAddLog = uiControl.addLog;
      const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'amber_husk_giant_larva');
      const logs = [];
      try {
        uiControl.addLog = text => logs.push(text);
        RPG.State.currentEnemy = { ...template, hp: template.maxHp, maxHp: template.maxHp };
        Math.random = () => 0.1;
        battleSystem.applyCainDamage(28);
        const evadedHp = RPG.State.currentEnemy.hp;
        Math.random = () => 0.9;
        battleSystem.applyCainDamage(28);
        return { evadedHp, hitHp: RPG.State.currentEnemy.hp, logs };
      } finally {
        Math.random = originalRandom;
        uiControl.addLog = originalAddLog;
      }
    });

    expect(result.evadedHp).toBe(600);
    expect(result.hitHp).toBe(572);
    expect(result.logs).toContain('琥珀骸の巨虫はカインの攻撃をかわした！');
  });

  test('carnivorous vine records every fixed-damage branch', async ({ page }) => {
    const damages = await page.evaluate(() => {
      const originalRandom = Math.random;
      const originalUi = {
        addLog: uiControl.addLog,
        flashFullScreen: uiControl.flashFullScreen,
        updateUI: uiControl.updateUI,
      };
      const damageLog = [];
      const system = {
        applyEnemyDirectDamage: damage => damageLog.push(damage),
        checkBattleEnd: () => true,
        runBattleLoop: () => {},
      };
      try {
        uiControl.addLog = () => {};
        uiControl.flashFullScreen = () => {};
        uiControl.updateUI = () => {};
        const useRoll = (enemy, roll) => {
          RPG.State.currentEnemy = enemy;
          Math.random = () => roll;
          RPG.Assets.BATTLE_AI.carnivorous_vine.execute(system);
        };
        useRoll({ atk: 40, vineMouthOpen: false }, 0.4);
        useRoll({ atk: 40, vineMouthOpen: false }, 0.8);
        useRoll({ atk: 40, vineMouthOpen: true }, 0.5);
        useRoll({ atk: 40, vineMouthOpen: true }, 0.8);
        return damageLog;
      } finally {
        Math.random = originalRandom;
        Object.assign(uiControl, originalUi);
      }
    });

    expect(damages).toEqual([27, 40, 36, 38]);
  });

  test('keeps the single carnivorous vine inside its 50-battle acceptance band', async ({ page }) => {
    const summary = await page.evaluate(() => {
      const originalRandom = Math.random;
      const originalTimeout = window.setTimeout;
      const originalUi = {
        addLog: uiControl.addLog,
        flashFullScreen: uiControl.flashFullScreen,
        updateUI: uiControl.updateUI,
        closeModal: uiControl.closeModal,
      };
      const vineTemplate = RPG.Assets.ENEMIES.find(enemy => enemy.id === 'carnivorous_vine');
      const actionTotals = { waiting: 0, acid: 0, vine: 0, preparedAcid: 0, preparedVine: 0 };
      const results = [];

      const randomFor = seed => {
        let value = seed >>> 0;
        return () => {
          value = (Math.imul(1664525, value) + 1013904223) >>> 0;
          return value / 0x100000000;
        };
      };

      try {
        window.setTimeout = callback => {
          callback();
          return 0;
        };
        uiControl.flashFullScreen = () => {};
        uiControl.updateUI = () => {};
        uiControl.closeModal = () => {};
        uiControl.addLog = text => {
          if (text === RPG.Assets.BATTLE_TEXT.carnivorous_vine.waiting) actionTotals.waiting++;
          if (text === RPG.Assets.BATTLE_TEXT.carnivorous_vine.acid) actionTotals.acid++;
          if (text === RPG.Assets.BATTLE_TEXT.carnivorous_vine.vineStrike) actionTotals.vine++;
          if (text === RPG.Assets.BATTLE_TEXT.carnivorous_vine.preparedAcid) actionTotals.preparedAcid++;
          if (text === RPG.Assets.BATTLE_TEXT.carnivorous_vine.preparedVineStrike) actionTotals.preparedVine++;
        };

        for (let seed = 1; seed <= 50; seed++) {
          Math.random = randomFor(seed);
          Object.assign(RPG.State, {
            mode: 'battle',
            isBattling: true,
            cainLv: 8,
            currentHP: 170,
            maxHP: 170,
            attack: 24,
            defense: 0,
            exp: 0,
            mood: 50,
            equippedRareAmberId: null,
            isPoisoned: false,
            poisonDamageRemaining: 0,
            hasOwenIntervened: true,
            hasOwenSavedLife: true,
            battleTurn: 1,
            battleState: { cainFirstHitBonusUsed: false },
            currentEnemy: {
              ...vineTemplate,
              hp: vineTemplate.maxHp,
              maxHp: vineTemplate.maxHp,
              vineMouthOpen: false,
              frozenTurns: 0,
            },
          });
          Object.keys(RPG.State.inventory).forEach(itemId => {
            RPG.State.inventory[itemId] = 0;
          });
          RPG.State.inventory.herb = 1;

          let cainTurns = 0;
          while (RPG.State.currentHP > 0 && RPG.State.currentEnemy.hp > 0 && cainTurns < 30) {
            // Fixed policy for every candidate: use the one normal herb before attacking at 30% HP or less.
            const reserveHerbForFirstNeckHunt = enemyId === 'amber_husk_giant_larva';
            const shouldUseHerb = reserveHerbForFirstNeckHunt
              ? RPG.State.currentEnemy.neckHuntMercyUsed === true && RPG.State.currentHP <= Math.floor(RPG.State.maxHP * 0.3)
              : RPG.State.currentHP <= Math.floor(RPG.State.maxHP * 0.3);
            if (shouldUseHerb && RPG.State.inventory.herb > 0) {
              explorationSystem.useItem('herb');
            }
            battleSystem.performCainAttack();
            cainTurns++;
            if (RPG.State.currentEnemy.hp <= 0) break;

            RPG.Assets.BATTLE_AI.carnivorous_vine.execute({
              applyEnemyDirectDamage: damage => battleSystem.applyEnemyDirectDamage(damage),
              checkBattleEnd: () => RPG.State.currentHP <= 0 || RPG.State.currentEnemy.hp <= 0,
              runBattleLoop: () => {},
            });
          }

          results.push({
            win: RPG.State.currentEnemy.hp <= 0 && RPG.State.currentHP > 0,
            currentHP: RPG.State.currentHP,
            cainTurns,
            herbUsed: RPG.State.currentEnemy.isBoss && RPG.State.inventory.herb === 0,
          });
        }

        const wins = results.filter(result => result.win);
        const sortedWinHp = wins.map(result => result.currentHP).sort((a, b) => a - b);
        return {
          trials: results.length,
          wins: wins.length,
          losses: results.length - wins.length,
          medianWinHp: sortedWinHp.length ? sortedWinHp[Math.floor(sortedWinHp.length / 2)] : null,
          averageCainTurns: Number((results.reduce((sum, result) => sum + result.cainTurns, 0) / results.length).toFixed(2)),
          herbUses: results.filter(result => result.herbUsed).length,
          actionTotals,
        };
      } finally {
        Math.random = originalRandom;
        window.setTimeout = originalTimeout;
        Object.assign(uiControl, originalUi);
      }
    });

    console.log(`carnivorous-vine benchmark: ${JSON.stringify(summary)}`);
    expect(summary.trials).toBe(50);
    expect(summary.wins + summary.losses).toBe(50);
    expect(summary.wins).toBeGreaterThanOrEqual(30);
    expect(summary.wins).toBeLessThanOrEqual(42);
    expect(summary.medianWinHp).toBeGreaterThanOrEqual(20);
    expect(summary.medianWinHp).toBeLessThanOrEqual(45);
    expect(summary.averageCainTurns).toBeGreaterThanOrEqual(7);
    expect(summary.averageCainTurns).toBeLessThanOrEqual(8);
    expect(summary.herbUses).toBeGreaterThanOrEqual(40);
  });

  test('runs 50 no-amber, no-glove Cain-only battles at every recommended level', async ({ page }) => {
    const results = await page.evaluate(() => {
      const originalRandom = Math.random;
      const originalTimeout = window.setTimeout;
      const originalCheckBattleEnd = battleSystem.checkBattleEnd;
      const originalUi = {
        addLog: uiControl.addLog,
        flashFullScreen: uiControl.flashFullScreen,
        updateUI: uiControl.updateUI,
      };
      const profiles = {
        5: { maxHP: 140, attack: 18 },
        8: { maxHP: 170, attack: 24 },
        9: { maxHP: 180, attack: 26 },
        10: { maxHP: 190, attack: 28 },
        12: { maxHP: 210, attack: 32 },
      };
      const fights = [
        ['rat', 5, 1000], ['amber_rat', 8, 1100], ['weasel', 5, 1200], ['amber_weasel', 8, 1300], ['sap', 8, 1400],
        ['hungry_amber_tree', 5, 1500], ['skull_bee', 8, 1600], ['carnivorous_vine', 8, 1700],
        ['giant_larva', 8, 2100], ['amber_burning_root', 9, 1800], ['hell_rat_swarm', 10, 1900], ['eye_eating_crow', 10, 2000],
        ['amber_husk_giant_larva', 10, 2200], ['amber_husk_giant_larva', 12, 2300],
      ];
      const randomFor = seed => {
        let value = seed >>> 0;
        return () => {
          value = (Math.imul(1664525, value) + 1013904223) >>> 0;
          return value / 0x100000000;
        };
      };

      try {
        window.setTimeout = callback => {
          callback();
          return 0;
        };
        let activeNeckHuntStats = null;
        uiControl.addLog = text => {
          if (!activeNeckHuntStats) return;
          if (text === RPG.Assets.BATTLE_TEXT.amber_husk_giant_larva.neckHunt) {
            activeNeckHuntStats.attempts++;
          }
          if (text === RPG.Assets.BATTLE_TEXT.amber_husk_giant_larva.neckHuntHit) {
            activeNeckHuntStats.hits++;
          }
        };
        uiControl.flashFullScreen = () => {};
        uiControl.updateUI = () => {};
        battleSystem.checkBattleEnd = () => (
          RPG.State.currentHP <= 0 || RPG.State.currentEnemy?.hp <= 0
        );

        const runFight = (enemyId, level, seed) => {
          const neckHunt = { attempts: 0, hits: 0 };
          activeNeckHuntStats = enemyId === 'amber_husk_giant_larva' ? neckHunt : null;
          Math.random = randomFor(seed);
          const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === enemyId);
          const profile = profiles[level];
          Object.assign(RPG.State, {
            mode: 'battle', isBattling: true, cainLv: level,
            currentHP: profile.maxHP, maxHP: profile.maxHP, attack: profile.attack, defense: 0,
            equippedRareAmberId: null, isPoisoned: false, poisonDamageRemaining: 0,
            hasOwenIntervened: true, hasOwenSavedLife: true, battleTurn: 1,
            battleState: { cainFirstHitBonusUsed: false },
            currentEnemy: {
              ...template, hp: template.maxHp, maxHp: template.maxHp,
              armorHp: template.armorMax || 0, frozenTurns: 0, vineMouthOpen: false,
            },
          });
          Object.keys(RPG.State.inventory).forEach(itemId => { RPG.State.inventory[itemId] = 0; });
          if (RPG.State.currentEnemy.isBoss) RPG.State.inventory.herb = 1;

          let cainTurns = 0;
          const isJourneyEnemy = RPG.State.currentEnemy.isBoss !== true;
          const opensWithPreemptive = isJourneyEnemy &&
            RPG.State.currentEnemy.forcePreemptive === true &&
            RPG.State.currentEnemy.preemptive &&
            Math.random() < RPG.State.currentEnemy.preemptive;
          if (opensWithPreemptive) {
            battleSystem.runJourneyEnemyTurn(() => {});
          }
          while (RPG.State.currentHP > 0 && RPG.State.currentEnemy.hp > 0 && cainTurns < 50) {
            if (RPG.State.currentHP <= Math.floor(RPG.State.maxHP * 0.3) && RPG.State.inventory.herb > 0) {
              explorationSystem.useItem('herb');
            }
            if (isJourneyEnemy) {
              battleSystem.applyPoisonTick();
              if (RPG.State.currentHP <= 0) break;
              battleSystem.runJourneyEnemyTurn(() => {});
              if (RPG.State.currentHP <= 0 || RPG.State.currentEnemy.hp <= 0) break;
              battleSystem.performCainAttack();
              cainTurns++;
            } else {
              if (battleSystem.applyPoisonTick()) break;
              const skippedTurns = RPG.State.battleState?.skippedTurns || 0;
              const stunTurns = RPG.State.battleState?.stunTurns || 0;
              if (skippedTurns > 0) {
                RPG.State.battleState.skippedTurns--;
                RPG.State.currentHP = Math.max(1, RPG.State.currentHP - Math.floor(RPG.State.maxHP * 0.1));
              } else if (stunTurns > 0) {
                RPG.State.battleState.stunTurns--;
              } else {
                battleSystem.performCainAttack();
                cainTurns++;
              }
              if (RPG.State.currentEnemy.hp <= 0) break;
              RPG.Assets.BATTLE_AI[enemyId].execute({
                applyEnemyDirectDamage: damage => battleSystem.applyEnemyDirectDamage(damage),
                checkBattleEnd: () => RPG.State.currentHP <= 0 || RPG.State.currentEnemy.hp <= 0,
                inflictPoison: () => battleSystem.inflictPoison(),
                markPlayerTookDamage: damage => battleSystem.markPlayerTookDamage(damage),
                playAmberHuskHalfHpScene: callback => callback(),
                resolveEnemyDirectDamage: (...args) => battleSystem.resolveEnemyDirectDamage(...args),
                runBattleLoop: () => {},
              });
            }
          }
          return {
            win: RPG.State.currentEnemy.hp <= 0 && RPG.State.currentHP > 0,
            remainingHP: RPG.State.currentHP,
            cainTurns,
            herbUsed: RPG.State.currentEnemy.isBoss && RPG.State.inventory.herb === 0,
            neckHunt,
          };
        };

        return fights.map(([enemyId, level, seedBase]) => {
          const outcomes = Array.from({ length: 50 }, (_, seed) => runFight(enemyId, level, seedBase + seed));
          const wins = outcomes.filter(outcome => outcome.win);
          const winHp = wins.map(outcome => outcome.remainingHP).sort((a, b) => a - b);
          return {
            enemyId,
            level,
            wins: wins.length,
            losses: outcomes.length - wins.length,
            medianWinHp: winHp.length ? winHp[Math.floor(winHp.length / 2)] : null,
            averageCainTurns: Number((outcomes.reduce((sum, outcome) => sum + outcome.cainTurns, 0) / outcomes.length).toFixed(2)),
            herbUses: outcomes.filter(outcome => outcome.herbUsed).length,
            neckHuntAttempts: outcomes.reduce((sum, outcome) => sum + outcome.neckHunt.attempts, 0),
            neckHuntHits: outcomes.reduce((sum, outcome) => sum + outcome.neckHunt.hits, 0),
          };
        });
      } finally {
        Math.random = originalRandom;
        window.setTimeout = originalTimeout;
        battleSystem.checkBattleEnd = originalCheckBattleEnd;
        Object.assign(uiControl, originalUi);
      }
    });

    console.log(`50-battle no-amber/no-glove Cain-only audit: ${JSON.stringify(results)}`);
    const acceptance = {
      rat: { wins: [50, 50], hp: [110, 125], turns: [2, 3] },
      amber_rat: { wins: [50, 50], hp: [90, 120], turns: [4, 6] },
      weasel: { wins: [50, 50], hp: [95, 110], turns: [2, 3] },
      amber_weasel: { wins: [50, 50], hp: [65, 90], turns: [4, 6] },
      sap: { wins: [50, 50], hp: [110, 135], turns: [3, 4] },
      'giant_larva-8': { wins: [50, 50], hp: [110, 135], turns: [3.5, 4.5] },
      hungry_amber_tree: { wins: [40, 47], hp: [35, 55], turns: [10, 12], herbUses: [45, 50] },
      skull_bee: { wins: [50, 50], hp: [35, 65], turns: [3, 4] },
      carnivorous_vine: { wins: [30, 42], hp: [25, 50], turns: [7, 8], herbUses: [45, 50] },
      amber_burning_root: { wins: [50, 50], hp: [0, 25], turns: [8, 9], herbUses: [45, 50] },
      hell_rat_swarm: { wins: [50, 50], hp: [100, 130], turns: [3, 4] },
      eye_eating_crow: { wins: [50, 50], hp: [90, 120], turns: [4, 5] },
      'amber_husk_giant_larva-10': { wins: [25, 32], hp: [50, 90], turns: [15, 19], herbUses: [35, 50] },
      'amber_husk_giant_larva-12': { wins: [35, 44], hp: [60, 105], turns: [14, 18], herbUses: [15, 45] },
    };

    expect(results).toHaveLength(14);
    for (const result of results) {
      const target = acceptance[`${result.enemyId}-${result.level}`] || acceptance[result.enemyId];
      expect(target).toBeTruthy();
      expect(result.wins).toBeGreaterThanOrEqual(target.wins[0]);
      expect(result.wins).toBeLessThanOrEqual(target.wins[1]);
      expect(result.medianWinHp).toBeGreaterThanOrEqual(target.hp[0]);
      expect(result.medianWinHp).toBeLessThanOrEqual(target.hp[1]);
      expect(result.averageCainTurns).toBeGreaterThanOrEqual(target.turns[0]);
      expect(result.averageCainTurns).toBeLessThanOrEqual(target.turns[1]);
      if (target.herbUses) {
        expect(result.herbUses).toBeGreaterThanOrEqual(target.herbUses[0]);
        expect(result.herbUses).toBeLessThanOrEqual(target.herbUses[1]);
      } else {
        expect(result.herbUses).toBe(0);
      }
      if (result.enemyId === 'amber_husk_giant_larva') {
        expect(result.neckHuntAttempts).toBeGreaterThan(0);
        expect(result.neckHuntHits).toBeGreaterThan(0);
      }
    }
  });
});

// @ts-check
const { test, expect } = require('@playwright/test');

async function openGame(page) {
  await page.goto('/chapter1.html');
  await page.waitForFunction(() => (
    typeof RPG !== 'undefined' &&
    typeof battleSystem !== 'undefined' &&
    RPG.Assets?.BATTLE_AI?.giant_larva
  ));
}

test.describe('giant larva balance', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await openGame(page);
  });

  test('uses poison before swallow even when Cain starts at half HP', async ({ page }) => {
    const result = await page.evaluate(() => {
      const originalTimeout = window.setTimeout;
      const calls = { poison: 0, loops: 0 };

      try {
        window.setTimeout = callback => {
          callback();
          return 0;
        };
        Object.assign(RPG.State, {
          battleTurn: 1,
          currentHP: 80,
          maxHP: 160,
          isPoisoned: false,
          currentEnemy: {
            id: 'giant_larva',
            name: '泥這う大幼蟲',
            atk: 12,
            swallowUsed: false,
            waitingUsed: false,
          },
          battleState: { skippedTurns: 0 },
        });

        RPG.Assets.BATTLE_AI.giant_larva.execute({
          inflictPoison: () => {
            calls.poison++;
            RPG.State.isPoisoned = true;
          },
          runBattleLoop: () => {
            calls.loops++;
          },
        });

        return {
          ...calls,
          turn: RPG.State.battleTurn,
          poisoned: RPG.State.isPoisoned,
          swallowUsed: RPG.State.currentEnemy.swallowUsed,
        };
      } finally {
        window.setTimeout = originalTimeout;
      }
    });

    expect(result).toEqual({
      poison: 1,
      loops: 1,
      turn: 2,
      poisoned: true,
      swallowUsed: false,
    });
  });

  test('attacks at the 65 percent low-HP wait boundary for 19 damage at the high roll', async ({ page }) => {
    const result = await page.evaluate(() => {
      const originalTimeout = window.setTimeout;
      const originalRandom = Math.random;
      const rolls = [0.65, 0.999];
      let appliedDamage = null;
      let dodgeOptions = null;

      try {
        window.setTimeout = callback => {
          callback();
          return 0;
        };
        Math.random = () => rolls.shift() ?? 0.999;
        Object.assign(RPG.State, {
          battleTurn: 2,
          currentHP: 80,
          maxHP: 160,
          currentEnemy: {
            id: 'giant_larva',
            name: '泥這う大幼蟲',
            atk: 12,
            swallowUsed: true,
            waitingUsed: true,
          },
          battleState: {
            skippedTurns: 0,
            nightMedicineEvasionActive: false,
            mikawashiEvasionActive: false,
          },
        });

        RPG.Assets.BATTLE_AI.giant_larva.execute({
          tryNightMedicineDodge: options => {
            dodgeOptions = options;
            return false;
          },
          // Delegates to the real defense/parry resolution (Add fireproof glove / parry
          // -damage-reduction feature) so this test still isolates giant_larva's own branching
          // (wait-vs-attack roll, dodge options) while exercising the real damage formula.
          resolveEnemyDirectDamage: (baseDamage, options) => battleSystem.resolveEnemyDirectDamage(baseDamage, options),
          applyEnemyDirectDamage: damage => {
            appliedDamage = damage;
          },
          checkBattleEnd: () => false,
          runBattleLoop: () => {},
        });

        return {
          appliedDamage,
          dodgeOptions,
          turn: RPG.State.battleTurn,
          remainingRolls: rolls.length,
        };
      } finally {
        window.setTimeout = originalTimeout;
        Math.random = originalRandom;
      }
    });

    expect(result).toEqual({
      appliedDamage: 19,
      dodgeOptions: { chanceCap: 0.25 },
      turn: 3,
      remainingRolls: 0,
    });
  });

  test('level 7 Cain can reach the giant-larva defeat route', async ({ page }) => {
    const result = await page.evaluate(() => {
      const originalTimeout = window.setTimeout;
      const originalRandom = Math.random;
      const originalDefeat = Cinematics.playGiantLarvaDefeat;
      let defeated = false;

      try {
        window.setTimeout = callback => {
          callback();
          return 0;
        };
        Math.random = () => 0.999;
        Cinematics.playGiantLarvaDefeat = () => {
          defeated = true;
          RPG.State.isBattling = false;
        };

        Object.assign(RPG.State, {
          cainLv: 7,
          currentHP: 160,
          maxHP: 160,
          attack: 22,
          isPoisoned: false,
          poisonDamageRemaining: 0,
          isBattling: false,
          currentEnemy: null,
          nightMedicineEvasionBattlesRemaining: 0,
        });
        Object.assign(RPG.State.inventory, {
          charm: 0,
          gratefulTalisman: 0,
        });

        battleSystem.startBattle('giant_larva');

        return {
          defeated,
          level: RPG.State.cainLv,
          maxHP: RPG.State.maxHP,
          attack: RPG.State.attack,
          bossMaxHP: RPG.State.currentEnemy?.maxHp ?? 0,
        };
      } finally {
        window.setTimeout = originalTimeout;
        Math.random = originalRandom;
        Cinematics.playGiantLarvaDefeat = originalDefeat;
      }
    });

    expect(result).toEqual({
      defeated: true,
      level: 7,
      maxHP: 160,
      attack: 22,
      bossMaxHP: 264,
    });
  });

  test('caps special evasion at 25 percent only when requested', async ({ page }) => {
    const result = await page.evaluate(() => {
      const originalRandom = Math.random;

      try {
        RPG.State.battleState = {
          nightMedicineEvasionActive: true,
          mikawashiEvasionActive: false,
        };

        Math.random = () => 0.24;
        const larvaDodge = battleSystem.tryNightMedicineDodge({ chanceCap: 0.25 });

        Math.random = () => 0.25;
        const larvaHit = battleSystem.tryNightMedicineDodge({ chanceCap: 0.25 });

        Math.random = () => 0.49;
        const normalDodge = battleSystem.tryNightMedicineDodge();

        return { larvaDodge, larvaHit, normalDodge };
      } finally {
        Math.random = originalRandom;
      }
    });

    expect(result).toEqual({
      larvaDodge: true,
      larvaHit: false,
      normalDodge: true,
    });
  });
});

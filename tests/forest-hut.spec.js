// @ts-check
const { test, expect } = require('@playwright/test');

async function advanceUntilInteractive(page, maxTaps = 100) {
  await page.evaluate(() => {
    window.RPG.State.debug.isSkipping = true;
  });
  for (let i = 0; i < maxTaps; i++) {
    const state = await page.evaluate(() => ({
      mode: window.RPG.State.mode,
      debtPending: window.RPG.State.flags.introDebtTalkPending,
    }));
    if (state.mode === 'base' && state.debtPending) {
      await page.evaluate(() => innSystem.talk());
    } else if (state.mode === 'choice') {
      await page.click('#btnChoiceA');
    } else if (state.mode === 'event') {
      await page.evaluate(() => uiControl.handlePlayerInput());
    } else {
      await page.evaluate(() => {
        window.RPG.State.debug.isSkipping = false;
      });
      return;
    }
    await page.waitForTimeout(50);
  }
  throw new Error('game did not become interactive');
}

async function drainDialogue(page, maxTaps = 100) {
  await page.evaluate(() => {
    window.RPG.State.debug.isSkipping = true;
  });
  for (let i = 0; i < maxTaps; i++) {
    const mode = await page.evaluate(() => window.RPG.State.mode);
    if (mode !== 'event') {
      await page.evaluate(() => {
        window.RPG.State.debug.isSkipping = false;
      });
      return mode;
    }
    await page.evaluate(() => uiControl.handlePlayerInput());
    await page.waitForTimeout(50);
  }
  throw new Error('dialogue did not finish');
}

test.describe('Chapter 1 forest hut + fireproof gloves + defense/parry', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      throw new Error(`Uncaught page error: ${error.message}`);
    });
    await page.goto('/chapter1.html');
    await page.waitForFunction(() => (
      typeof uiControl !== 'undefined' &&
      typeof explorationSystem !== 'undefined' &&
      typeof innSystem !== 'undefined'
    ));
    await advanceUntilInteractive(page);
  });

  async function setForestHutState(page, cfg = {}) {
    await page.evaluate((c) => {
      Object.assign(RPG.State, {
        mode: 'base',
        isAtInn: false,
        isInDungeon: true,
        explorationArea: 'forest',
        location: '琥珀の森',
        currentDistance: 10,
      });
      if (typeof c.forestHutState === 'string') RPG.State.forestHutState = c.forestHutState;
      if (typeof c.fireproofGloves === 'number') RPG.State.inventory.fireproofGloves = c.fireproofGloves;
      if (typeof c.defense === 'number') RPG.State.defense = c.defense;
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';
    }, cfg);
  }

  async function callTalk(page) {
    await page.evaluate(() => explorationSystem.talk());
  }

  test.describe('forest hut discovery (森小屋)', () => {
    test('a locked hut shows the discovery text every time, with no state change', async ({ page }) => {
      await setForestHutState(page, { forestHutState: 'locked' });
      await callTalk(page);
      await drainDialogue(page);
      const log1 = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
      expect(log1).toContain('古い小屋がある。');
      expect(log1).toContain('扉には鍵がかかっている。');

      await page.evaluate(() => { document.getElementById('logContainer').innerHTML = ''; });
      await callTalk(page);
      await drainDialogue(page);
      const log2 = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
      expect(log2).toContain('古い小屋がある。');

      const state = await page.evaluate(() => RPG.State.forestHutState);
      expect(state).toBe('locked');
    });

    test('the first examine after unlock plays the one-time snake/Owen scene and advances state', async ({ page }) => {
      await setForestHutState(page, { forestHutState: 'unlocked' });
      await callTalk(page);
      await drainDialogue(page);
      const log = await page.evaluate(() => document.getElementById('logContainer')?.textContent || '');
      expect(log).toContain('扉を開けた途端、上から蛇が落ちてきた。');
      expect(log).toContain('カインはとっさに後ずさり、オーエンの腕の中へ入った。');
      expect(log).toContain('オーエンの腕が、そのままカインの腹へ回る。');
      expect(log).toContain('オーエン「あんなのが怖いの？」');
      expect(log).toContain('カイン「驚いただけだ。怖いわけじゃない」');
      expect(log).toContain('オーエン「怯えてる匂い」');
      expect(log).toContain('カイン「……嗅ぐな」');

      const result = await page.evaluate(() => ({
        state: RPG.State.forestHutState,
        mode: RPG.State.mode,
      }));
      expect(result.state).toBe('eventPlayed');
      expect(result.mode).toBe('base');
    });

    test('the second examine grants the fireproof gloves exactly once', async ({ page }) => {
      await setForestHutState(page, { forestHutState: 'eventPlayed' });
      await callTalk(page);
      await drainDialogue(page);
      const result = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        state: RPG.State.forestHutState,
        gloves: RPG.State.inventory.fireproofGloves,
      }));
      expect(result.log).toContain('《耐火グローブ》を手に入れた！');
      expect(result.state).toBe('gloveGranted');
      expect(result.gloves).toBe(1);
    });

    test('a third+ examine grants nothing new and falls through to the generic fallback', async ({ page }) => {
      await setForestHutState(page, { forestHutState: 'gloveGranted', fireproofGloves: 1 });
      await callTalk(page);
      const result = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        gloves: RPG.State.inventory.fireproofGloves,
        state: RPG.State.forestHutState,
      }));
      expect(result.log).not.toContain('《耐火グローブ》を手に入れた！');
      expect(result.log).not.toContain('扉を開けた途端');
      expect(result.gloves).toBe(1);
      expect(result.state).toBe('gloveGranted');
    });

    test('save/load preserves forestHutState, fireproofGloves, and base defense', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.forestHutState = 'eventPlayed';
        RPG.State.inventory.fireproofGloves = 1;
        RPG.State.defense = 0;
        const snapshot = uiControl.createSaveSnapshot('journal');
        localStorage.setItem('okai_rpg_forest_hut_test', JSON.stringify(snapshot));

        RPG.State.forestHutState = 'locked';
        RPG.State.inventory.fireproofGloves = 0;
        uiControl.loadFromStorage('okai_rpg_forest_hut_test', '森小屋テスト');

        return {
          state: RPG.State.forestHutState,
          gloves: RPG.State.inventory.fireproofGloves,
          defense: RPG.State.defense,
        };
      });
      expect(result).toEqual({ state: 'eventPlayed', gloves: 1, defense: 0 });
    });

    test('an old save missing the new fields defaults to locked/0/0', async ({ page }) => {
      const result = await page.evaluate(() => {
        const snapshot = uiControl.createSaveSnapshot('journal');
        const legacySave = JSON.parse(JSON.stringify(snapshot));
        delete legacySave.forestHutState;
        delete legacySave.defense;
        if (legacySave.inventory) delete legacySave.inventory.fireproofGloves;
        localStorage.setItem('okai_rpg_forest_hut_legacy_test', JSON.stringify(legacySave));

        RPG.State.forestHutState = 'gloveGranted';
        RPG.State.inventory.fireproofGloves = 1;
        RPG.State.defense = 5;
        uiControl.loadFromStorage('okai_rpg_forest_hut_legacy_test', '旧セーブ森小屋テスト');

        return {
          state: RPG.State.forestHutState,
          gloves: RPG.State.inventory.fireproofGloves,
          defense: RPG.State.defense,
        };
      });
      expect(result).toEqual({ state: 'locked', gloves: 0, defense: 0 });
    });
  });

  test.describe('effective defense (getEffectiveDefense)', () => {
    test('base defense alone, no gloves', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.defense = 0;
        RPG.State.inventory.fireproofGloves = 0;
        return battleSystem.getEffectiveDefense();
      });
      expect(result).toBe(0);
    });

    test('gloves add the configured bonus on top of base defense, without mutating base defense', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.defense = 0;
        RPG.State.inventory.fireproofGloves = 1;
        const effective = battleSystem.getEffectiveDefense();
        return { effective, baseAfter: RPG.State.defense };
      });
      expect(result.effective).toBe(2); // FIREPROOF_GLOVES_DEFENSE_BONUS
      expect(result.baseAfter).toBe(0); // base defense itself must never be mutated by possession
    });

    test('gloves stack additively on top of a non-zero base defense', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.defense = 3;
        RPG.State.inventory.fireproofGloves = 1;
        return battleSystem.getEffectiveDefense();
      });
      expect(result).toBe(5);
    });
  });

  test.describe('resolveEnemyDirectDamage (shared attack-resolution helper)', () => {
    test('subtracts effective defense with a floor of 1, no parry', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.defense = 0;
        RPG.State.inventory.fireproofGloves = 0;
        const originalRandom = Math.random;
        Math.random = () => 0.99; // never parries
        const outcome = battleSystem.resolveEnemyDirectDamage(20, { allowParry: true });
        Math.random = originalRandom;
        return outcome;
      });
      expect(result).toEqual({ damage: 20, parried: false });
    });

    test('defense reduces damage but never below 1', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.defense = 3;
        RPG.State.inventory.fireproofGloves = 1; // effective defense 5
        const originalRandom = Math.random;
        Math.random = () => 0.99; // never parries
        const outcome = battleSystem.resolveEnemyDirectDamage(4, { allowParry: true });
        Math.random = originalRandom;
        return outcome;
      });
      expect(result).toEqual({ damage: 1, parried: false });
    });

    test('a successful normal parry reduces the defense-mitigated damage to 50%, floor 1, and logs nothing itself', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.defense = 0;
        RPG.State.inventory.fireproofGloves = 0;
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
        const originalRandom = Math.random;
        Math.random = () => 0.0; // always parries (< EVASION_RATE.normal)
        const outcome = battleSystem.resolveEnemyDirectDamage(20, { allowParry: true });
        Math.random = originalRandom;
        return {
          outcome,
          log: document.getElementById('logContainer')?.textContent || '',
        };
      });
      expect(result.outcome).toEqual({ damage: 10, parried: true });
      // resolveEnemyDirectDamage only judges and returns "parried" - logging the parry line is
      // the caller's responsibility (see the runJourneyEnemyTurn integration tests below), so
      // the attack announcement can be logged first and the parry line can follow it.
      expect(result.log).toBe('');
    });

    test('fireproof gloves reduce a successful parry to 25% instead of 50% (on top of their own defense bonus)', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.defense = 0;
        RPG.State.inventory.fireproofGloves = 1; // effective defense 2, so afterDefense = 20 - 2 = 18
        const originalRandom = Math.random;
        Math.random = () => 0.0;
        const outcome = battleSystem.resolveEnemyDirectDamage(20, { allowParry: true });
        Math.random = originalRandom;
        return outcome;
      });
      expect(result).toEqual({ damage: 4, parried: true }); // floor(18 * 0.25)
    });

    test('allowParry:false never rolls a parry, even on a guaranteed-parry random draw - used identically by boss code today and reusable for a future parryable boss attack', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.defense = 0;
        RPG.State.inventory.fireproofGloves = 0;
        const originalRandom = Math.random;
        Math.random = () => 0.0; // would guarantee a parry if allowed
        const noParry = battleSystem.resolveEnemyDirectDamage(20, { allowParry: false });
        const withParry = battleSystem.resolveEnemyDirectDamage(20, { allowParry: true });
        Math.random = originalRandom;
        return { noParry, withParry };
      });
      expect(result.noParry).toEqual({ damage: 20, parried: false });
      expect(result.withParry).toEqual({ damage: 10, parried: true });
    });
  });

  test.describe('journey-enemy integration (runJourneyEnemyTurn)', () => {
    async function setupJourneyBattle(page, cfg = {}) {
      await page.evaluate((c) => {
        Object.assign(RPG.State, {
          mode: 'battle',
          isBattling: true,
          currentEnemy: {
            id: c.enemyId || 'rat',
            name: c.enemyName || '魔界のネズミ',
            atk: c.atk ?? 20,
            hp: 40,
            maxHp: 40,
          },
          battleState: {},
          currentHP: c.currentHP ?? 999,
          maxHP: c.maxHP ?? 999,
          defense: c.defense ?? 0,
          hasOwenSavedLife: true,
          isPoisoned: false,
          battleTurn: 1,
        });
        RPG.State.inventory.fireproofGloves = c.fireproofGloves ?? 0;
        RPG.State.inventory.gratefulTalisman = 0;
        RPG.State.flags.metThiefBoy = c.metThiefBoy ?? false;
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
      }, cfg);
    }

    test('a standard hit (no parry) applies effective defense to the actual HP loss', async ({ page }) => {
      await setupJourneyBattle(page, { atk: 20, defense: 3, fireproofGloves: 1, currentHP: 999 }); // effective defense 5
      const result = await page.evaluate(async () => {
        const originalRandom = Math.random;
        Math.random = () => 0.99; // never parries
        await new Promise(resolve => {
          battleSystem.runJourneyEnemyTurn(resolve);
        });
        Math.random = originalRandom;
        return {
          currentHP: RPG.State.currentHP,
          log: document.getElementById('logContainer')?.textContent || '',
        };
      });
      expect(result.currentHP).toBe(999 - 15); // 20 - 5
      expect(result.log).toContain('カインは15のダメージ');
    });

    test('a successful normal parry logs attack, then parry, then the reduced-damage line, in that order', async ({ page }) => {
      await setupJourneyBattle(page, { atk: 20, defense: 0, fireproofGloves: 0, currentHP: 999 });
      const result = await page.evaluate(async () => {
        const originalRandom = Math.random;
        Math.random = () => 0.0; // always parries
        await new Promise(resolve => {
          battleSystem.runJourneyEnemyTurn(resolve);
        });
        Math.random = originalRandom;
        return {
          currentHP: RPG.State.currentHP,
          log: document.getElementById('logContainer')?.textContent || '',
        };
      });
      expect(result.currentHP).toBe(999 - 10); // 20 * 0.5
      expect(result.log).toContain('魔界のネズミが攻撃してきた！');
      expect(result.log).toContain('カインは攻撃を剣で受け流した！');
      expect(result.log).toContain('カインは10のダメージ');
      // A parried hit must read as a natural sequence of events: the attack is announced,
      // then the parry, then the (already-reduced) damage it actually caused - not the
      // damage number before the parry that explains why it's reduced.
      const attackIndex = result.log.indexOf('魔界のネズミが攻撃してきた！');
      const parryIndex = result.log.indexOf('カインは攻撃を剣で受け流した！');
      const damageIndex = result.log.indexOf('カインは10のダメージ');
      expect(attackIndex).toBeGreaterThanOrEqual(0);
      expect(parryIndex).toBeGreaterThan(attackIndex);
      expect(damageIndex).toBeGreaterThan(parryIndex);
    });

    test('enemyTurn (the non-journey standard-enemy dispatch) logs the same attack -> parry -> damage order', async ({ page }) => {
      await setupJourneyBattle(page, { atk: 20, defense: 0, fireproofGloves: 0, currentHP: 999 });
      const result = await page.evaluate(() => {
        const originalRandom = Math.random;
        Math.random = () => 0.0; // always parries
        battleSystem.enemyTurn();
        Math.random = originalRandom;
        return {
          currentHP: RPG.State.currentHP,
          log: document.getElementById('logContainer')?.textContent || '',
        };
      });
      expect(result.currentHP).toBe(999 - 10); // 20 * 0.5
      const attackIndex = result.log.indexOf('魔界のネズミが攻撃してきた！');
      const parryIndex = result.log.indexOf('カインは攻撃を剣で受け流した！');
      const damageIndex = result.log.indexOf('カインは10のダメージ');
      expect(attackIndex).toBeGreaterThanOrEqual(0);
      expect(parryIndex).toBeGreaterThan(attackIndex);
      expect(damageIndex).toBeGreaterThan(parryIndex);
    });

    test('fireproof gloves reduce a successful parry to 25% in a real battle turn (on top of their own defense bonus)', async ({ page }) => {
      await setupJourneyBattle(page, { atk: 20, defense: 0, fireproofGloves: 1, currentHP: 999 }); // effective defense 2
      const result = await page.evaluate(async () => {
        const originalRandom = Math.random;
        Math.random = () => 0.0;
        await new Promise(resolve => {
          battleSystem.runJourneyEnemyTurn(resolve);
        });
        Math.random = originalRandom;
        return RPG.State.currentHP;
      });
      expect(result).toBe(999 - 4); // floor((20 - 2) * 0.25)
    });

    test('mikawashi-feather full avoidance is unchanged and takes priority over the normal parry', async ({ page }) => {
      await setupJourneyBattle(page, { atk: 20, defense: 0, fireproofGloves: 1, currentHP: 999 });
      await page.evaluate(() => {
        RPG.State.battleState.mikawashiEvasionActive = true;
      });
      const result = await page.evaluate(async () => {
        const originalRandom = Math.random;
        Math.random = () => 0.0; // guarantees the mikawashi dodge chance (50%)
        await new Promise(resolve => {
          battleSystem.runJourneyEnemyTurn(resolve);
        });
        Math.random = originalRandom;
        return {
          currentHP: RPG.State.currentHP,
          log: document.getElementById('logContainer')?.textContent || '',
        };
      });
      expect(result.currentHP).toBe(999); // fully avoided, no damage at all
      expect(result.log).toContain('ミカワシ羽の力で、カインは攻撃をかわした！');
      expect(result.log).not.toContain('カインは攻撃を剣で受け流した！');
    });

    test('night-medicine full avoidance is unchanged', async ({ page }) => {
      await setupJourneyBattle(page, { atk: 20, defense: 0, fireproofGloves: 0, currentHP: 999 });
      await page.evaluate(() => {
        RPG.State.battleState.nightMedicineEvasionActive = true;
      });
      const result = await page.evaluate(async () => {
        const originalRandom = Math.random;
        Math.random = () => 0.0; // guarantees the night-medicine dodge chance (50%)
        await new Promise(resolve => {
          battleSystem.runJourneyEnemyTurn(resolve);
        });
        Math.random = originalRandom;
        return RPG.State.currentHP;
      });
      expect(result).toBe(999);
    });

    test('the amber sap absorption amount matches the actual post-mitigation HP loss', async ({ page }) => {
      await setupJourneyBattle(page, {
        enemyId: 'sap', enemyName: '琥珀の樹液', atk: 20, defense: 4, fireproofGloves: 1, // effective defense 6
        currentHP: 999, metThiefBoy: true,
      });
      const result = await page.evaluate(async () => {
        RPG.State.currentEnemy.hp = 30;
        RPG.State.currentEnemy.maxHp = 60;
        const originalRandom = Math.random;
        Math.random = () => 0.99; // never parries, never poisons
        await new Promise(resolve => {
          battleSystem.runJourneyEnemyTurn(resolve);
        });
        Math.random = originalRandom;
        return {
          currentHP: RPG.State.currentHP,
          enemyHp: RPG.State.currentEnemy.hp,
        };
      });
      const actualLoss = 999 - result.currentHP;
      expect(actualLoss).toBe(20 - 6); // atk - effective defense, no parry
      expect(result.enemyHp).toBe(30 + actualLoss);
    });
  });

  test.describe('non-direct-attack damage is unaffected by defense/parry', () => {
    test('poison ticks are untouched by defense', async ({ page }) => {
      const result = await page.evaluate(() => {
        Object.assign(RPG.State, {
          isBattling: true,
          isPoisoned: true,
          currentHP: 100,
          maxHP: 150,
          defense: 10,
          poisonDamageRemaining: 0,
        });
        RPG.State.inventory.fireproofGloves = 1;
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
        battleSystem.applyPoisonTick();
        return {
          currentHP: RPG.State.currentHP,
          log: document.getElementById('logContainer')?.textContent || '',
        };
      });
      // Pure maxHP-fraction tick damage (existing formula), unaffected by defense/gloves.
      expect(result.currentHP).toBe(100 - Math.max(1, Math.floor(150 / 15)));
      expect(result.log).toContain('毒が身体を蝕む');
    });
  });

  test.describe('boss AI reuses the same shared helper (no parry today, structurally ready for later)', () => {
    test('amber_burning_root now has effective defense applied via the shared helper', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const template = RPG.Assets.ENEMIES.find(e => e.id === 'amber_burning_root');
        Object.assign(RPG.State, {
          mode: 'battle',
          isBattling: true,
          currentEnemy: { ...template, hp: template.maxHp, armorHp: 0 },
          battleState: {},
          currentHP: 999,
          maxHP: 999,
          defense: 4,
          lastBlowBy: null,
          isPoisoned: false,
          battleTurn: 1,
        });
        RPG.State.inventory.fireproofGloves = 1; // effective defense 6
        RPG.State.debug.isSkipping = true;
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
        const originalRandom = Math.random;
        Math.random = () => 0.0; // would guarantee a parry if this boss allowed one
        RPG.Assets.BATTLE_AI.amber_burning_root.execute(battleSystem);
        await new Promise(resolve => setTimeout(resolve, 150));
        Math.random = originalRandom;
        return {
          currentHP: RPG.State.currentHP,
          log: document.getElementById('logContainer')?.textContent || '',
        };
      });
      // atk 22 - effective defense 6 = 16, and no parry line should ever appear for a boss.
      expect(result.currentHP).toBe(999 - 16);
      expect(result.log).toContain('カインは16のダメージを受けた');
      expect(result.log).not.toContain('カインは攻撃を剣で受け流した！');
    });
  });
});

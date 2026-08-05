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
        location: c.location || '森小屋前',
        currentDistance: 10,
      });
      if (typeof c.forestHutState === 'string') RPG.State.forestHutState = c.forestHutState;
      if (typeof c.fireproofGloves === 'number') RPG.State.inventory.fireproofGloves = c.fireproofGloves;
      if (typeof c.defense === 'number') RPG.State.defense = c.defense;
      RPG.State.forestHutDiscovered = typeof c.forestHutDiscovered === 'boolean'
        ? c.forestHutDiscovered
        : true;
      RPG.State.keyAmberUseCount = typeof c.keyAmberUseCount === 'number' ? c.keyAmberUseCount : 0;
      RPG.State.inventory.oldKey = typeof c.oldKey === 'number' ? c.oldKey : 0;
      RPG.State.inventory.keyAmber = typeof c.keyAmber === 'number' ? c.keyAmber : 0;
      const log = document.getElementById('logContainer');
      if (log) log.innerHTML = '';
    }, cfg);
  }

  async function callTalk(page) {
    await page.evaluate(() => explorationSystem.talk());
  }

  test.describe('forest hut discovery (森小屋)', () => {
    test('the first ordinary 10m examine discovers the hut, then 森小屋 enters its front scene', async ({ page }) => {
      await setForestHutState(page, {
        location: '琥珀の森',
        forestHutState: 'locked',
        forestHutDiscovered: false,
      });
      await callTalk(page);
      await drainDialogue(page);

      const discovered = await page.evaluate(() => {
        uiControl.updateUI();
        return {
          discovered: RPG.State.forestHutDiscovered,
          location: RPG.State.location,
          label: document.getElementById('btnTalk')?.textContent,
        };
      });
      expect(discovered).toEqual({ discovered: true, location: '琥珀の森', label: '森小屋' });

      await callTalk(page);
      const front = await page.evaluate(() => ({
        distance: RPG.State.currentDistance,
        location: RPG.State.location,
        scene: visualDirector.getActiveScene(),
        background: getComputedStyle(document.getElementById('sceneBackdrop')).backgroundImage,
        log: document.getElementById('logContainer')?.textContent || '',
      }));
      expect(front.distance).toBe(10);
      expect(front.location).toBe('森小屋前');
      expect(front.scene).toBe('forest-hut-front');
      expect(front.background).toContain('amber-forest-hut-front.png');
      expect(front.log).not.toContain('扉を開けた途端、上から蛇が落ちてきた。');
    });

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
      expect(log).toContain('中に入った途端、上から蛇が落ちてきた。');
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
      expect(result.log).toContain('部屋の隅に、何か落ちている。');
      expect(result.log).toContain('《🥊耐火グローブを手に入れた！》');
      expect(result.log).toContain('カインは無言でそれを手に嵌めた。');
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
      expect(result.log).not.toContain('《🥊耐火グローブを手に入れた！》');
      expect(result.log).not.toContain('扉を開けた途端');
      expect(result.gloves).toBe(1);
      expect(result.state).toBe('gloveGranted');
    });

    test('save/load preserves forestHutState, hut discovery, key amber use count, fireproofGloves, and base defense', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.forestHutState = 'eventPlayed';
        RPG.State.inventory.fireproofGloves = 1;
        RPG.State.defense = 0;
        RPG.State.forestHutDiscovered = true;
        RPG.State.keyAmberUseCount = 2;
        const snapshot = uiControl.createSaveSnapshot('journal');
        localStorage.setItem('okai_rpg_forest_hut_test', JSON.stringify(snapshot));

        RPG.State.forestHutState = 'locked';
        RPG.State.inventory.fireproofGloves = 0;
        RPG.State.forestHutDiscovered = false;
        RPG.State.keyAmberUseCount = 0;
        uiControl.loadFromStorage('okai_rpg_forest_hut_test', '森小屋テスト');

        return {
          state: RPG.State.forestHutState,
          gloves: RPG.State.inventory.fireproofGloves,
          defense: RPG.State.defense,
          discovered: RPG.State.forestHutDiscovered,
          keyAmberUseCount: RPG.State.keyAmberUseCount,
        };
      });
      expect(result).toEqual({ state: 'eventPlayed', gloves: 1, defense: 0, discovered: true, keyAmberUseCount: 2 });
    });

    test('an old save missing the new fields defaults to locked/0/0', async ({ page }) => {
      const result = await page.evaluate(() => {
        const snapshot = uiControl.createSaveSnapshot('journal');
        const legacySave = JSON.parse(JSON.stringify(snapshot));
        delete legacySave.forestHutState;
        delete legacySave.forestHutDiscovered;
        delete legacySave.keyAmberUseCount;
        delete legacySave.defense;
        if (legacySave.inventory) delete legacySave.inventory.fireproofGloves;
        localStorage.setItem('okai_rpg_forest_hut_legacy_test', JSON.stringify(legacySave));

        RPG.State.forestHutState = 'gloveGranted';
        RPG.State.inventory.fireproofGloves = 1;
        RPG.State.defense = 5;
        RPG.State.forestHutDiscovered = true;
        RPG.State.keyAmberUseCount = 3;
        uiControl.loadFromStorage('okai_rpg_forest_hut_legacy_test', '旧セーブ森小屋テスト');

        return {
          state: RPG.State.forestHutState,
          gloves: RPG.State.inventory.fireproofGloves,
          defense: RPG.State.defense,
          discovered: RPG.State.forestHutDiscovered,
          keyAmberUseCount: RPG.State.keyAmberUseCount,
        };
      });
      expect(result).toEqual({ state: 'locked', gloves: 0, defense: 0, discovered: false, keyAmberUseCount: 0 });
    });
  });

  test.describe('unlocking with the old key (Connect key amber to forest hut)', () => {
    test('without the key the locked hut behaves exactly as before', async ({ page }) => {
      await setForestHutState(page, { forestHutState: 'locked', oldKey: 0 });
      await callTalk(page);
      await drainDialogue(page);

      const result = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        state: RPG.State.forestHutState,
        oldKey: RPG.State.inventory.oldKey,
      }));
      expect(result.log).toContain('古い小屋がある。');
      expect(result.log).toContain('扉には鍵がかかっている。');
      expect(result.log).not.toContain('扉を開けた途端、上から蛇が落ちてきた。');
      expect(result.state).toBe('locked');
      expect(result.oldKey).toBe(0);
    });

    test('the old key confirmation opens the hut and connects to the existing snake scene', async ({ page }) => {
      await setForestHutState(page, { forestHutState: 'locked', oldKey: 1, keyAmber: 1 });
      await callTalk(page);
      const prompt = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        mode: RPG.State.mode,
        choices: [...document.querySelectorAll('#action-buttons button')].map(button => button.textContent),
      }));
      expect(prompt.log).toContain('カイン（🗝️古びた鍵を使ってみるか？）');
      expect(prompt.mode).toBe('choice');
      expect(prompt.choices).toEqual(['【開ける】', '【…嫌な予感がする】']);
      await page.getByRole('button', { name: '【開ける】', exact: true }).click();
      await drainDialogue(page);

      const result = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        state: RPG.State.forestHutState,
        oldKey: RPG.State.inventory.oldKey,
        mode: RPG.State.mode,
        scene: visualDirector.getActiveScene(),
      }));

      // One examine consumes the key and runs straight into the existing snake scene.
      expect(result.oldKey).toBe(0);
      expect(result.log).not.toContain('扉には鍵がかかっている。');
      expect(result.log).toContain('中に入った途端、上から蛇が落ちてきた。');
      expect(result.log).toContain('カインはとっさに後ずさり、オーエンの腕の中へ入った。');
      expect(result.log).toContain('オーエン「あんなのが怖いの？」');
      expect(result.log).toContain('カイン「……嗅ぐな」');
      expect(result.state).toBe('eventPlayed');
      expect(result.mode).toBe('base');
      expect(result.scene).toBe('forest-hut-interior');
    });

    test('the old key confirmation can be cancelled without consuming or unlocking', async ({ page }) => {
      await setForestHutState(page, { forestHutState: 'locked', oldKey: 1 });
      await callTalk(page);
      await page.getByRole('button', { name: '【…嫌な予感がする】', exact: true }).click();
      await drainDialogue(page);
      const result = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        oldKey: RPG.State.inventory.oldKey,
        state: RPG.State.forestHutState,
        location: RPG.State.location,
      }));
      expect(result.log).toContain('カイン（…今はやめておこう）');
      expect(result).toMatchObject({ oldKey: 1, state: 'locked', location: '森小屋前' });
    });

    test('key amber alone only plays the keyhole reaction and leaves the hut locked', async ({ page }) => {
      await setForestHutState(page, { forestHutState: 'locked', oldKey: 0, keyAmber: 1 });
      await callTalk(page);
      await drainDialogue(page);
      const result = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        keyAmber: RPG.State.inventory.keyAmber,
        oldKey: RPG.State.inventory.oldKey,
        state: RPG.State.forestHutState,
      }));
      expect(result.log).toContain('カイン（この鍵入り琥珀で開かないかな）');
      expect(result.log).toContain('カインは琥珀を鍵穴に押し当ててみた。');
      expect(result.log).toContain('オーエン「…何してるの？」');
      expect(result.log).toContain('カイン「さすがに無理か」');
      expect(result).toMatchObject({ keyAmber: 1, oldKey: 0, state: 'locked' });
    });

    test('key amber is reusable from inventory with persisted first, second, and later dialogue', async ({ page }) => {
      await setForestHutState(page, { keyAmber: 1 });
      const detail = await page.evaluate(() => {
        uiControl.openModal();
        uiControl.selectItem('keyAmber', 1);
        const html = document.getElementById('itemDetailArea')?.innerHTML || '';
        uiControl.closeModal();
        return html;
      });
      expect(detail).toContain("useItem('keyAmber')");

      async function useKeyAmber() {
        await page.evaluate(() => {
          RPG.State.mode = 'base';
          document.getElementById('logContainer').innerHTML = '';
          explorationSystem.useItem('keyAmber');
        });
        await drainDialogue(page);
        return page.evaluate(() => ({
          log: document.getElementById('logContainer')?.textContent || '',
          keyAmber: RPG.State.inventory.keyAmber,
          useCount: RPG.State.keyAmberUseCount,
        }));
      }

      const first = await useKeyAmber();
      expect(first.log).toContain('カイン「ひらけごまー！」');
      expect(first.log).toContain('オーエン「……」');
      expect(first.log).toContain('特に何も起きなかった！');
      expect(first).toMatchObject({ keyAmber: 1, useCount: 1 });

      await page.evaluate(() => {
        const snapshot = uiControl.createSaveSnapshot('journal');
        localStorage.setItem('okai_rpg_key_amber_use_test', JSON.stringify(snapshot));
        RPG.State.keyAmberUseCount = 0;
        uiControl.loadFromStorage('okai_rpg_key_amber_use_test', '鍵入り琥珀使用テスト');
      });

      const second = await useKeyAmber();
      expect(second.log).toContain('オーエン「もうやらないの？」');
      expect(second.log).toContain('カイン「もうやらない」');
      expect(second).toMatchObject({ keyAmber: 1, useCount: 2 });

      const later = await useKeyAmber();
      expect(later.log).toContain('カイン（もうやらないってば）');
      expect(later).toMatchObject({ keyAmber: 1, useCount: 3 });
    });

    test('the examine after unlocking still grants the gloves exactly once', async ({ page }) => {
      await setForestHutState(page, { forestHutState: 'locked', oldKey: 1, fireproofGloves: 0 });
      await callTalk(page);
      await page.getByRole('button', { name: '【開ける】', exact: true }).click();
      await drainDialogue(page);

      await page.evaluate(() => { document.getElementById('logContainer').innerHTML = ''; });
      await callTalk(page);
      await drainDialogue(page);
      const afterGloves = await page.evaluate(() => ({
        log: document.getElementById('logContainer')?.textContent || '',
        state: RPG.State.forestHutState,
        gloves: RPG.State.inventory.fireproofGloves,
      }));
      expect(afterGloves.log).toContain('《🥊耐火グローブを手に入れた！》');
      expect(afterGloves.state).toBe('gloveGranted');
      expect(afterGloves.gloves).toBe(1);

      // A further examine grants nothing more.
      await callTalk(page);
      await drainDialogue(page);
      const afterRepeat = await page.evaluate(() => ({
        state: RPG.State.forestHutState,
        gloves: RPG.State.inventory.fireproofGloves,
      }));
      expect(afterRepeat).toEqual({ state: 'gloveGranted', gloves: 1 });
    });

    test('an unlocked hut never re-consumes a key the player still carries', async ({ page }) => {
      await setForestHutState(page, { forestHutState: 'eventPlayed', oldKey: 1, fireproofGloves: 0 });
      await callTalk(page);
      await drainDialogue(page);
      const result = await page.evaluate(() => ({
        oldKey: RPG.State.inventory.oldKey,
        gloves: RPG.State.inventory.fireproofGloves,
        state: RPG.State.forestHutState,
      }));
      expect(result).toEqual({ oldKey: 1, gloves: 1, state: 'gloveGranted' });
    });

    test('the old key survives a save/load round trip and defaults to 0 for old saves', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.inventory.oldKey = 3;
        RPG.State.forestHutState = 'unlocked';
        const snapshot = uiControl.createSaveSnapshot('journal');
        localStorage.setItem('okai_rpg_old_key_test', JSON.stringify(snapshot));

        const legacySave = JSON.parse(JSON.stringify(snapshot));
        delete legacySave.forestHutState;
        if (legacySave.inventory) delete legacySave.inventory.oldKey;
        localStorage.setItem('okai_rpg_old_key_legacy_test', JSON.stringify(legacySave));

        RPG.State.inventory.oldKey = 0;
        RPG.State.forestHutState = 'gloveGranted';
        uiControl.loadFromStorage('okai_rpg_old_key_test', '古びた鍵テスト');
        const roundTrip = {
          oldKey: RPG.State.inventory.oldKey,
          state: RPG.State.forestHutState,
        };

        uiControl.loadFromStorage('okai_rpg_old_key_legacy_test', '旧セーブ古びた鍵テスト');
        const legacyDefaults = {
          oldKey: RPG.State.inventory.oldKey,
          state: RPG.State.forestHutState,
        };

        return { roundTrip, legacyDefaults };
      });

      expect(result.roundTrip).toEqual({ oldKey: 3, state: 'unlocked' });
      expect(result.legacyDefaults).toEqual({ oldKey: 0, state: 'locked' });
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

    test('a successful parry completely cancels a direct attack and logs nothing itself', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.defense = 0;
        RPG.State.inventory.fireproofGloves = 0;
        const log = document.getElementById('logContainer');
        if (log) log.innerHTML = '';
        const originalRandom = Math.random;
        Math.random = () => 0.0; // always parries
        const outcome = battleSystem.resolveEnemyDirectDamage(20, { allowParry: true });
        Math.random = originalRandom;
        return {
          outcome,
          log: document.getElementById('logContainer')?.textContent || '',
        };
      });
      expect(result.outcome).toEqual({ damage: 0, parried: true });
      // resolveEnemyDirectDamage only judges and returns "parried"; its callers own the attack,
      // parry, and optional counterattack presentation.
      expect(result.log).toBe('');
    });

    test('fireproof gloves no longer alter a successful parry damage result', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.defense = 0;
        RPG.State.inventory.fireproofGloves = 1;
        const originalRandom = Math.random;
        Math.random = () => 0.0;
        const outcome = battleSystem.resolveEnemyDirectDamage(20, { allowParry: true });
        Math.random = originalRandom;
        return outcome;
      });
      expect(result).toEqual({ damage: 0, parried: true });
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
      expect(result.withParry).toEqual({ damage: 0, parried: true });
    });

    test('Blue Amber adds its configured sword-technique rate to attack and parry rolls', async ({ page }) => {
      const result = await page.evaluate(() => {
        RPG.State.equippedRareAmberId = null;
        const withoutBlue = battleSystem.getCainSwordTechniqueRate();
        const originalRandom = Math.random;
        Math.random = () => 0.25;
        const withoutBlueParry = battleSystem.resolveEnemyDirectDamage(20, { allowParry: true });

        RPG.State.equippedRareAmberId = 'blueAmber';
        const withBlue = battleSystem.getCainSwordTechniqueRate();
        const withBlueParry = battleSystem.resolveEnemyDirectDamage(20, { allowParry: true });

        RPG.State.attack = 10;
        RPG.State.battleState = null;
        RPG.State.equippedRareAmberId = null;
        RPG.State.currentEnemy = { id: 'dummy', name: 'ダミー', hp: 100, armorHp: 0 };
        const withoutBlueAttack = battleSystem.performCainAttack();

        RPG.State.equippedRareAmberId = 'blueAmber';
        RPG.State.currentEnemy = { id: 'dummy', name: 'ダミー', hp: 100, armorHp: 0 };
        const withBlueAttack = battleSystem.performCainAttack();
        Math.random = originalRandom;
        RPG.State.equippedRareAmberId = null;
        return { withoutBlue, withBlue, withoutBlueParry, withBlueParry, withoutBlueAttack, withBlueAttack };
      });
      expect(result.withoutBlue).toBeCloseTo(0.2);
      expect(result.withBlue).toBeCloseTo(0.4);
      expect(result.withoutBlueParry).toEqual({ damage: 20, parried: false });
      expect(result.withBlueParry).toEqual({ damage: 0, parried: true });
      expect(result.withoutBlueAttack).toEqual({ technique: null, hits: [{ damage: 10, isCritical: false }] });
      expect(result.withBlueAttack).toEqual({ technique: 'strongAttack', hits: [{ damage: 18, isCritical: false }] });
    });

    test('strong attack and rapid attack use their configured multipliers, with rapid hits resolved separately', async ({ page }) => {
      const result = await page.evaluate(() => {
        const combat = RPG.Config.CAIN_COMBAT;
        const originalCombat = { ...combat };
        const originalRandom = Math.random;
        RPG.State.attack = 10;
        RPG.State.battleState = null;

        Object.assign(combat, { SWORD_TECHNIQUE_RATE: 1, STRONG_ATTACK_RATE: 1 });
        RPG.State.currentEnemy = { id: 'dummy', name: 'ダミー', hp: 100, armorHp: 0 };
        Math.random = () => 0;
        const strong = battleSystem.performCainAttack();
        const afterStrong = RPG.State.currentEnemy.hp;

        Object.assign(combat, { STRONG_ATTACK_RATE: 0 });
        RPG.State.currentEnemy = { id: 'dummy', name: 'ダミー', hp: 100, armorHp: 10, armorLabel: '硬化部分', armorBreakText: '砕けた！' };
        const rapid = battleSystem.performCainAttack();
        const afterRapid = { hp: RPG.State.currentEnemy.hp, armorHp: RPG.State.currentEnemy.armorHp };

        Math.random = originalRandom;
        Object.assign(combat, originalCombat);
        return { strong, afterStrong, rapid, afterRapid };
      });
      expect(result.strong).toEqual({ technique: 'strongAttack', hits: [{ damage: 18, isCritical: false }] });
      expect(result.afterStrong).toBe(82);
      expect(result.rapid).toEqual({
        technique: 'rapidAttack',
        hits: [{ damage: 7, isCritical: false }, { damage: 7, isCritical: false }],
      });
      expect(result.afterRapid).toEqual({ hp: 96, armorHp: 0 });
    });

    test('a Fireproof Gloves counterattack can critically hit but never selects a sword technique', async ({ page }) => {
      const result = await page.evaluate(() => {
        const combat = RPG.Config.CAIN_COMBAT;
        const originalCombat = { ...combat };
        const originalRandom = Math.random;
        Object.assign(combat, { SWORD_TECHNIQUE_RATE: 1, CRITICAL_RATE: 1 });
        Object.assign(RPG.State, {
          attack: 20,
          battleState: null,
          currentEnemy: { id: 'dummy', name: 'ダミー', hp: 100, armorHp: 0 },
        });
        RPG.State.inventory.fireproofGloves = 1;
        Math.random = () => 0;
        const counter = battleSystem.performFireproofGlovesCounterattack();
        Math.random = originalRandom;
        Object.assign(combat, originalCombat);
        RPG.State.inventory.fireproofGloves = 0;
        return { counter, enemyHp: RPG.State.currentEnemy.hp };
      });
      expect(result).toEqual({
        counter: { technique: null, hits: [{ damage: 30, isCritical: true }] },
        enemyHp: 70,
      });
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
            poison: c.poison ?? false,
            poisonRate: c.poisonRate ?? 0,
          },
          battleState: {},
          currentHP: c.currentHP ?? 999,
          maxHP: c.maxHP ?? 999,
          defense: c.defense ?? 0,
          attack: c.attack ?? 20,
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

    test('a successful parry cancels a direct hit and its attached poison', async ({ page }) => {
      await setupJourneyBattle(page, { atk: 20, defense: 0, fireproofGloves: 0, currentHP: 999, poison: true, poisonRate: 1 });
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
      expect(result.currentHP).toBe(999);
      expect(result.log).toContain('魔界のネズミが攻撃してきた！');
      expect(result.log).toContain('カインは攻撃を剣で受け流した！');
      expect(result.log).not.toContain('ダメージ');
      expect(result.log).not.toContain('毒状態');
    });

    test('enemyTurn also treats a parried standard attack as zero damage', async ({ page }) => {
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
      expect(result.currentHP).toBe(999);
      expect(result.log).toContain('カインは攻撃を剣で受け流した！');
      expect(result.log).not.toContain('ダメージ');
    });

    test('Fireproof Gloves counterattack deals one normal-attack multiplier after a parry', async ({ page }) => {
      await setupJourneyBattle(page, { atk: 20, attack: 20, defense: 0, fireproofGloves: 1, currentHP: 999 });
      const result = await page.evaluate(async () => {
        const originalRandom = Math.random;
        const originalCriticalRate = RPG.Config.CAIN_COMBAT.CRITICAL_RATE;
        RPG.Config.CAIN_COMBAT.CRITICAL_RATE = 0;
        Math.random = () => 0.0;
        await new Promise(resolve => {
          battleSystem.runJourneyEnemyTurn(resolve);
        });
        Math.random = originalRandom;
        RPG.Config.CAIN_COMBAT.CRITICAL_RATE = originalCriticalRate;
        return {
          currentHP: RPG.State.currentHP,
          enemyHP: RPG.State.currentEnemy.hp,
          log: document.getElementById('logContainer')?.textContent || '',
        };
      });
      expect(result.currentHP).toBe(999);
      expect(result.enemyHP).toBe(20);
      expect(result.log).toContain('《耐火グローブ》で反撃した！');
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

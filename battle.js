// 🚩ーー【Build 12.0.1: Battle System Engine】ーー
// Refactored to separate Engine (battle.js) from Content (battleData.js)

const battleSystem = {
    startBattle: function (enemyId = null) {
        // Enemy Selection logic remains in engine as it processes data
        let template = null;
        if (enemyId) {
            template = RPG.Assets.ENEMIES.find(e => e.id === enemyId);
        }

        if (!template) {
            const candidates = RPG.Assets.ENEMIES.filter(e =>
                e.area && // Build 12.0.6: Safety check
                RPG.State.currentDistance >= e.area[0] &&
                RPG.State.currentDistance <= e.area[1]
            );
            if (candidates.length === 0) return;

            const totalWeight = candidates.reduce((sum, e) => sum + e.weight, 0);
            let random = Math.random() * totalWeight;
            template = candidates[0];

            for (const e of candidates) {
                random -= e.weight;
                if (random < 0) {
                    template = e;
                    break;
                }
            }
        }

        uiControl.addSeparator();

        if (template.preBattleDialogue) {
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                ...template.preBattleDialogue.map(line => ({ ...line })),
                {
                    text: null,
                    action: () => {
                        this.beginBattle(template);
                    }
                }
            ];
            explorationSystem.playDialogueLoop();
            return;
        }

        this.beginBattle(template);
    },

    beginBattle: function (template) {
        RPG.State.mode = "battle";
        RPG.State.isBattling = true;
        RPG.State.currentEnemy = {
            ...template,
            hp: template.maxHp,
            frozenTurns: 0,
            cainHitCount: 0
        };
        // Build 9.0.0: Battle State container
        RPG.State.battleState = { skippedTurns: 0 };
        RPG.State.lastBlowBy = null;
        RPG.State.battleTurn = 1;
        RPG.State.hasOwenIntervened = false;
        RPG.State.hasOwenSavedLife = false;

        // Build 8.45: Boss Scaling & Intros (Delegated to Cinematics)
        if (Cinematics.scaleBoss(this, RPG.State.currentEnemy)) return;

        uiControl.updateUI();

        // Check Pre-emptive
        if (RPG.State.currentEnemy.id === "weasel") {
            const delay = RPG.State.debug.isSkipping ? 50 : 800;
            setTimeout(() => {
                this.enemyTurn(true);
            }, delay);
            return;
        }

        if (RPG.State.currentEnemy.preemptive && Math.random() < RPG.State.currentEnemy.preemptive) {
            const delay = RPG.State.debug.isSkipping ? 50 : 800;
            setTimeout(() => {
                uiControl.addLog(RPG.Assets.BATTLE_TEXT.intro.preemptive(RPG.State.currentEnemy.name));
                this.enemyTurn(true);
            }, delay);
        } else {
            const delay = RPG.State.debug.isSkipping ? 50 : 800;
            setTimeout(() => this.runBattleLoop(), delay);
        }
    },

    runBattleLoop: function () {
        if (!RPG.State.isBattling || !RPG.State.currentEnemy) return;

        // Build 8.0: Poison Check
        if (RPG.State.isPoisoned) {
            const poisonDmg = 2;
            RPG.State.currentHP -= poisonDmg;
            if (RPG.State.currentHP <= 1) RPG.State.currentHP = 1;
            uiControl.addLog(`毒が蝕む… （HP -${poisonDmg}）`, "", "#ff4d4d");
            uiControl.updateUI();
            if (RPG.State.currentHP === 1 && this.checkBattleEnd()) return;
        }

        if (RPG.State.battleState && RPG.State.battleState.stunTurns > 0) {
            RPG.State.battleState.stunTurns--;
            uiControl.updateUI();

            if (this.checkBattleEnd()) return;

            const delay = RPG.State.debug.isSkipping ? 50 : 1000;
            setTimeout(() => {
                this.enemyTurn(false, true);
            }, delay);
            return;
        }

        // Build 9.0.0: Turn Skip Logic
        if (RPG.State.battleState && RPG.State.battleState.skippedTurns > 0) {
            RPG.State.battleState.skippedTurns--;
            uiControl.addLog("カインは飲み込まれていて動けない！", "damage");
            uiControl.addLog("胃液で溶かされる……", "damage");

            const digestDmg = Math.floor(RPG.State.maxHP * 0.1);
            RPG.State.currentHP = Math.max(1, RPG.State.currentHP - digestDmg);
            uiControl.updateUI();

            if (this.checkBattleEnd()) return;

            // Skip player turn -> Enemy turn immediately
            setTimeout(() => {
                // Pass true to indicate player was skipped
                this.enemyTurn(false, true);
            }, 1000);
            return;
        }

        // 1. Owen's Intervention
        this.processOwenAction(() => {
            // 2. Cain's Turn
            if (this.checkBattleEnd()) return;

            this.processCainAction(() => {
                // 3. Enemy Turn
                if (this.checkBattleEnd()) return;

                if (RPG.State.currentEnemy.frozenTurns > 0) {
                    RPG.State.currentEnemy.frozenTurns--;
                    uiControl.addLog(`${RPG.State.currentEnemy.name}は凍りついて動けない！`, "");
                    const delay = RPG.State.debug.isSkipping ? 50 : 1000;
                    setTimeout(() => this.runBattleLoop(), delay);
                } else {
                    this.enemyTurn();
                }
            });
        });
    },

    processOwenAction: function (callback) {
        // AI Logic Delegated to BATTLE_AI / OWEN_BEHAVIOR
        if (RPG.State.currentEnemy && RPG.State.currentEnemy.id === 'giant_larva') {
            callback();
            return;
        }

        if (RPG.State.hasOwenIntervened) {
            callback();
            return;
        }

        if (!RPG.Assets.OWEN_BEHAVIOR.shouldIntervene(RPG.State.battleTurn)) {
            callback();
            return;
        }

        const action = RPG.Assets.OWEN_BEHAVIOR.decideAction(RPG.State.battleTurn);
        if (!action) {
            callback();
            return;
        }

        RPG.State.hasOwenIntervened = true;
        let delay = 1000;

        switch (action) {
            case "herb":
                RPG.State.inventory.herb--;
                RPG.State.currentHP = RPG.State.maxHP;
                if (RPG.State.isPoisoned) {
                    RPG.State.isPoisoned = false;
                }
                uiControl.addLog(RPG.Assets.BATTLE_TEXT.owen.herb, "", "#a333c8");
                break;
            case "kill":
                RPG.State.currentEnemy.hp = 0;
                RPG.State.lastBlowBy = "Owen";
                uiControl.addLog(
                    RPG.Assets.BATTLE_TEXT.owen.kill[Math.floor(Math.random() * RPG.Assets.BATTLE_TEXT.owen.kill.length)],
                    "",
                    "#a333c8"
                );
                uiControl.addLog("オーエンの魔法が敵を消滅させた！", "");
                delay = 1500;
                break;
            case "freeze":
                RPG.State.currentEnemy.frozenTurns = 2;
                uiControl.addLog(
                    RPG.Assets.BATTLE_TEXT.owen.freeze[Math.floor(Math.random() * RPG.Assets.BATTLE_TEXT.owen.freeze.length)],
                    "",
                    "#a333c8"
                );
                uiControl.addLog(`${RPG.State.currentEnemy.name}は凍りついた！`, "");
                break;
            case "idle":
                const idlePhrase = RPG.Assets.GAME_TEXT.owenIdlePhrases[Math.floor(Math.random() * RPG.Assets.GAME_TEXT.owenIdlePhrases.length)];
                uiControl.addLog(idlePhrase, "", "#a333c8");
                delay = 800;
                break;
        }

        uiControl.updateUI();

        if (RPG.State.currentEnemy.hp <= 0 && action === "kill") {
            this.endBattle(false); // No EXP
            return;
        }

        const finalDelay = RPG.State.debug.isSkipping ? 50 : delay;
        setTimeout(callback, finalDelay);
    },

    processCainAction: function (next) {
        let damage = RPG.State.attack;
        let isCrit = Math.random() < 0.15;
        if (isCrit) {
            damage = Math.floor(damage * 1.5);
            uiControl.addLog("カインの剣技が冴え渡る！");
        }

        RPG.State.currentEnemy.hp -= damage;
        uiControl.addLog(`カインの攻撃！ ${RPG.State.currentEnemy.name}に${damage}のダメージ！`);
        uiControl.updateUI();

        const isAmberTree = RPG.State.currentEnemy.id === 'hungry_amber_tree';
        let shouldPlayAmberTreeFourHitScene = false;
        if (isAmberTree) {
            RPG.State.currentEnemy.cainHitCount = (RPG.State.currentEnemy.cainHitCount || 0) + 1;
            shouldPlayAmberTreeFourHitScene =
                !RPG.State.flags.amberTreeFourHitSceneSeen &&
                RPG.State.currentEnemy.cainHitCount >= 4;
        }

        const finalizeCainTurn = () => {
            if (RPG.State.currentEnemy.hp <= 0) {
                RPG.State.lastBlowBy = "Cain";
                this.endBattle(true);
                return;
            }

            const delay = RPG.State.debug.isSkipping ? 50 : 1000;
            setTimeout(next, delay);
        };

        if (shouldPlayAmberTreeFourHitScene) {
            RPG.State.flags.amberTreeFourHitSceneSeen = true;
            this.playAmberTreeFourHitScene(finalizeCainTurn);
            return;
        }

        finalizeCainTurn();
    },

    playAmberTreeFourHitScene: function (callback) {
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            { text: "カイン「…く…っ硬いな！しかも樹液が剣にまとわりついて…」" },
            { text: "オーエン「あはは！ぐちゃぐちゃのネバネバ。」", color: "#a020f0" },
            { text: "オーエンはいつのまにか離れたところの木の上に腰掛けている", color: "#888888" },
            { text: "しなった枝がカインの頭に飛んでくる！" },
            { text: "カインはそれを剣で、切るのではなく殴るように叩き払った。" },
            {
                text: null,
                action: () => {
                    RPG.State.mode = "battle";
                    uiControl.updateUI();
                    callback();
                }
            }
        ];
        explorationSystem.playDialogueLoop();
    },

    playAmberTreeDefeatScene: function () {
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            { text: "琥珀樹の触手がカインの首に絡みつく。" },
            { text: "カイン「あ\"…っ」" },
            { text: "首を締め上げる触手が振り払えない！" },
            { text: "オーエン「…あーあ。駄目そう」", color: "#a020f0" },
            { text: "カインの意識はそこで途絶えた…" },
            {
                text: null,
                action: () => {
                    this.finalizeStandardDefeat('hungry_amber_tree');
                }
            }
        ];
        explorationSystem.playDialogueLoop();
    },

    playAmberHuskHalfHpScene: function (callback) {
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            { text: "カイン「…くっ…どんどん攻撃が強くなってる！」" },
            { text: "オーエン「ああ、鎌が飛んでくる。首落ちちゃうよ」", color: "#a020f0" },
            {
                text: null,
                action: () => {
                    RPG.State.mode = "battle";
                    uiControl.updateUI();
                    callback();
                }
            }
        ];
        explorationSystem.playDialogueLoop();
    },

    enemyTurn: function (isPreemptive = false, isPlayerSkipped = false) {
        if (!RPG.State.isBattling || !RPG.State.currentEnemy) return;

        const enemy = RPG.State.currentEnemy;

        // Build 12.0.1: Delegated AI Logic
        if (RPG.Assets.BATTLE_AI[enemy.id]) {
            RPG.Assets.BATTLE_AI[enemy.id].execute(this);
            return;
        }

        // Standard Enemy Logic (Others)
        if (!isPreemptive && Math.random() < 0.1) {
            uiControl.addLog("カインは攻撃を剣で受け流した！");
            const delay = RPG.State.debug.isSkipping ? 50 : 1000;
            setTimeout(() => this.runBattleLoop(), delay);
            return;
        }

        let dmg = RPG.State.currentEnemy.atk;
        const newHP = RPG.State.currentHP - dmg;

        // Death Save
        if (newHP <= 0 && !RPG.State.hasOwenSavedLife) {
            RPG.State.hasOwenSavedLife = true;
            uiControl.addLog(`${RPG.State.currentEnemy.name}が${RPG.State.currentEnemy.msg || "攻撃してきた！"}`);
            uiControl.addLog(RPG.Assets.BATTLE_TEXT.owen.intimidation, "", "#a333c8");
            uiControl.addLog(RPG.Assets.BATTLE_TEXT.owen.intimidationEffect, "", "#ffff00");
            RPG.State.currentHP = 1;
            uiControl.updateUI();
            const delay = RPG.State.debug.isSkipping ? 50 : 1500;
            setTimeout(() => this.endBattle(false, true), delay);
            return;
        }

        RPG.State.currentHP = Math.max(1, newHP);

        let msg = RPG.State.currentEnemy.msg || "攻撃してきた！";
        // Build 6.3.2: Weasel Logic (Specific case kept inline for simplicity as it's minor)
        if (RPG.State.currentEnemy.id === "weasel") {
            msg = (RPG.State.battleTurn === 1) ? "目にも止まらぬ速さで先制攻撃！" : "カマで切り付けてきた";
        }

        uiControl.addLog(`${RPG.State.currentEnemy.name}が${msg} カインは${dmg}のダメージ！`);

        if (RPG.State.currentEnemy.poison && !RPG.State.isPoisoned) {
            if (Math.random() < 0.2) {
                RPG.State.isPoisoned = true;
                uiControl.addLog("攻撃に毒が含まれていた！ (毒状態)", "", "#ff4d4d");
            }
        }

        uiControl.updateUI();

        if (RPG.State.currentHP === 1) {
            const delay = RPG.State.debug.isSkipping ? 50 : 1000;
            setTimeout(() => this.resolveDefeat(), delay);
        } else {
            RPG.State.battleTurn++;
            const delay = RPG.State.debug.isSkipping ? 50 : 1000;
            setTimeout(() => this.runBattleLoop(), delay);
        }
    },

    checkBattleEnd: function () {
        if (RPG.State.currentEnemy.hp <= 0) {
            this.endBattle(true);
            return true;
        }
        if (RPG.State.currentHP <= 1) {
            this.resolveDefeat();
            return true;
        }
        return false;
    },

    endBattle: function (playerWin, isDeathSave = false) {
        if (!RPG.State.defeatCounts) RPG.State.defeatCounts = {};
        if (!RPG.State.lastBlowBy) RPG.State.lastBlowBy = "Cain";

        const enemyId = RPG.State.currentEnemy.id;
        if (!RPG.State.defeatCounts[enemyId]) RPG.State.defeatCounts[enemyId] = { cain: 0, owen: 0 };

        uiControl.addSeparator();

        // Giant Larva Death Spasm
        // Giant Larva Death Spasm (Cinematic)
        if (RPG.State.currentEnemy.id === 'giant_larva' && playerWin) {
            Cinematics.playGiantLarvaDeath(this, enemyId);
            return;
        }

        if (isDeathSave) {
            uiControl.addLog("戦闘から離脱した。");
        } else if (!playerWin) {
            RPG.State.defeatCounts[enemyId].owen++;
            uiControl.addLog(`${RPG.State.currentEnemy.name}は塵になった…`);
        } else {
            this.executeStandardVictory(enemyId);
        }

        RPG.State.mode = "base";
        RPG.State.isBattling = false;
        RPG.State.currentEnemy = null;
        RPG.State.battleState = null;
        uiControl.updateUI();
    },

    executeStandardVictory: function (enemyId) {
        // Build 15.1.8: Lock UI IMMEDIATELY to prevent Race Condition
        RPG.State.mode = "event";
        // Victory text ownership rule:
        // - Common defeat/victory lines such as "〇〇を倒した！" or "〇〇は塵になった…" are emitted ONLY here.
        // - Post-battle BATTLE_EVENTS / onDeathEvent handlers must not repeat those generic victory lines.
        //   They are reserved for boss-specific aftermath, cinematics, and dialogue only.

        if (enemyId === 'hungry_amber_tree' && RPG.State.lastBlowBy === "Cain") {
            uiControl.addLog("最後の一撃！");
            uiControl.addLog("カインの剣が、骸の腹部にめりこんだ！");
            uiControl.addLog("グシャッ");
            uiControl.addLog("空っぽの人体を砕くような、嫌な手応え。飢えた触手樹は動かなくなった。");
        }

        if (RPG.State.lastBlowBy === "Owen") {
            RPG.State.defeatCounts[enemyId].owen++;
            uiControl.addLog(`${RPG.State.currentEnemy.name}は塵になった…`);
        } else {
            RPG.State.defeatCounts[enemyId].cain++;
            uiControl.addLog(`${RPG.State.currentEnemy.name}を倒した！`);
        }

        if (RPG.State.searchCounter !== null && RPG.State.searchCounter < 5) {
            RPG.State.searchCounter++;
        }

        // --- Battle Event & Clean-up Sync ---
        let hasPostBattleEvent = false;

        if (RPG.State.flags.treeDefeated && RPG.State.postTreeBattles !== "DONE") {
            if (RPG.State.postTreeBattles === null) RPG.State.postTreeBattles = 0;
            if (typeof RPG.State.postTreeBattles === 'number') {
                RPG.State.postTreeBattles++;
                if (RPG.State.postTreeBattles === 5) {
                    const fatigueEvent = RPG.Assets.EVENT_DATA.find(e => e.id === "post_tree_fatigue");
                    if (fatigueEvent) {
                        fatigueEvent.action(RPG.State);
                        RPG.State.mode = "event";
                        explorationSystem.playDialogueLoop();
                        hasPostBattleEvent = true;
                    }
                }
            }
        }

        if (RPG.State.currentEnemy.gold > 0) {
            RPG.State.inventory.silverCoin += RPG.State.currentEnemy.gold;
            uiControl.addLog(`銀貨を${RPG.State.currentEnemy.gold}枚手に入れた。`);
        }
        if (RPG.State.currentEnemy.drop && Math.random() < RPG.State.currentEnemy.drop.rate) {
            const itemId = RPG.State.currentEnemy.drop.id;
            RPG.State.inventory[itemId] = (RPG.State.inventory[itemId] || 0) + 1;
            uiControl.addLog(`${RPG.Assets.CONFIG.ITEM_NAME[itemId]}を手に入れた！`);
        }

        if (RPG.State.currentEnemy.xp) {
            RPG.State.exp += RPG.State.currentEnemy.xp;
            uiControl.addLog(`${RPG.State.currentEnemy.xp}の経験値を得た。`);
            if (RPG.State.exp >= 100 * Math.pow(1.5, RPG.State.cainLv - 1)) {
                RPG.State.cainLv++;
                RPG.State.maxHP += 10;
                RPG.State.currentHP = RPG.State.maxHP;
                RPG.State.attack += 2;
                RPG.State.currentHP = RPG.State.maxHP;
                uiControl.addLog(`【LEVEL UP!】カインのレベルが ${RPG.State.cainLv} に上がった！`, "marker", "#ffff00");
            }
        }

        const count = RPG.State.defeatCounts[enemyId] ? (RPG.State.defeatCounts[enemyId].cain + RPG.State.defeatCounts[enemyId].owen) : 1;
        if (!hasPostBattleEvent && RPG.Assets.BATTLE_EVENTS[enemyId] && RPG.Assets.BATTLE_EVENTS[enemyId][count]) {
            const eventDialogues = RPG.Assets.BATTLE_EVENTS[enemyId][count];
            uiControl.addLog("---");
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [...eventDialogues];
            explorationSystem.playDialogueLoop();
            hasPostBattleEvent = true;
        }

        const defeatedEnemy = RPG.Assets.ENEMIES.find(e => e.id === enemyId);
        if (!hasPostBattleEvent && defeatedEnemy && defeatedEnemy.onDeathEvent) {
            // onDeathEvent responsibility rule:
            // - Continue the battle aftermath AFTER the common victory text above.
            // - Do not add another generic "〇〇を倒した！" line inside the destination event.
            const victoryEvent = RPG.Assets.EVENT_DATA.find(e => e.id === defeatedEnemy.onDeathEvent);
            if (victoryEvent) {
                victoryEvent.action(RPG.State);
                hasPostBattleEvent = true;
            }
        }

        // Final State Cleanup
        RPG.State.isBattling = false;
        RPG.State.currentEnemy = null;
        RPG.State.battleState = null;

        // ONLY revert to base if no event dialogue is scheduled
        if (!hasPostBattleEvent) {
            RPG.State.mode = "base";
            uiControl.updateUI();
        }
    },

    finalizeStandardDefeat: function (defeatedEnemyId = null) {
        uiControl.addLog(RPG.Assets.GAME_TEXT.battle.cainDefeated);
        RPG.State.isBattling = false;
        RPG.State.currentEnemy = null;
        RPG.State.isInDungeon = false;
        RPG.State.currentDistance = 0;
        RPG.State.battleStatus = {};
        RPG.State.mood = Math.max(0, RPG.State.mood - 20);

        innSystem.showDefeatSequence(defeatedEnemyId);
    },

    resolveDefeat: function () {
        uiControl.addSeparator();

        // Build 14.1.5: Special Boss Defeat
        if (RPG.State.currentEnemy && RPG.State.currentEnemy.id === 'giant_larva') {
            Cinematics.playGiantLarvaDefeat();
            return;
        }

        // Build 15.1.1a: Amber Tree Rematch State Logic
        if (RPG.State.currentEnemy && RPG.State.currentEnemy.id === 'hungry_amber_tree') {
            RPG.State.flags.isTreeRematch = true;
            RPG.State.flags.hasTreeEventOccurred = false;
            this.playAmberTreeDefeatScene();
            return;
        }

        const defeatedEnemyId = RPG.State.currentEnemy ? RPG.State.currentEnemy.id : null;
        this.finalizeStandardDefeat(defeatedEnemyId);
    },
};

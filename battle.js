// 🚩ーー【Build 12.0.1: Battle System Engine】ーー
// Refactored to separate Engine (battle.js) from Content (battleData.js)

const battleSystem = {
    getGlowingCatRabbitProfile: function () {
        // Rabbit levels are a hidden reward for actual victories, before or after the fur quest.
        const defeatCount = RPG.State.glowCatRabbitDefeatCount || 0;
        const profiles = [
            { level: 5, atk: 5 },
            { level: 10, atk: 8 },
            { level: 15, atk: 14 },
            { level: 20, atk: 22 },
            { level: 88, atk: 88 }
        ];

        const profile = profiles[Math.min(defeatCount, profiles.length - 1)];
        if (!profile) return null;

        if (profile.level >= 15 && RPG.State.storyPhase < 4) {
            return null;
        }

        return profile;
    },

    prepareGlowingCatRabbitTemplate: function (template) {
        if (!template || template.id !== "glowing_cat_rabbit") return template;

        const profile = this.getGlowingCatRabbitProfile();
        if (!profile) return null;
        const isLv88 = profile.level === 88;
        const isLv88Repeat = isLv88 && RPG.State.flags.glowCatRabbitLv88EscapeTalkDone === true;
        const lv88Prelude = RPG.Assets.GAME_TEXT.events.glowingRabbitLv88Prelude || [];
        const lv88AfterIntro = RPG.Assets.GAME_TEXT.events.glowingRabbitLv88AfterIntro || [];
        const lv88RepeatPrelude = RPG.Assets.GAME_TEXT.events.glowingRabbitLv88RepeatPrelude || [];

        return {
            ...template,
            name: `光る猫うさぎLv${profile.level}`,
            atk: profile.atk,
            rabbitLevel: profile.level,
            isBoss: isLv88,
            maxHp: isLv88 ? 9999 : template.maxHp,
            skipDefaultIntro: isLv88,
            lv88Repeat: isLv88Repeat,
            preBattleDialogue: isLv88
                ? [
                    ...(isLv88Repeat ? lv88RepeatPrelude : lv88Prelude).map(text => ({ text, typewriter: true, typeSpeed: 24 })),
                    {
                        text: RPG.Assets.BATTLE_TEXT.glowing_cat_rabbit.bossIntro(profile.level),
                        color: "#ffd166",
                        typewriter: true,
                        typeSpeed: 24
                    },
                    ...(!isLv88Repeat ? lv88AfterIntro : []).map(text => ({ text, typewriter: true, typeSpeed: 24 }))
                ]
                : [
                    { text: RPG.Assets.BATTLE_TEXT.glowing_cat_rabbit.intro(profile.level), color: "#ffd166" },
                    { text: RPG.Assets.BATTLE_TEXT.glowing_cat_rabbit.sight, type: "ambient" }
                ]
        };
    },

    markPlayerTookDamage: function (damage = 0) {
        if (damage <= 0) return;
        if (!RPG.State.battleState) {
            RPG.State.battleState = {};
        }
        RPG.State.battleState.playerTookDamage = true;
        if (typeof visualDirector !== "undefined") {
            visualDirector.playBattleCue("party-hit");
        }
    },

    inflictPoison: function () {
        if (RPG.State.isPoisoned) return false;

        RPG.State.isPoisoned = true;
        RPG.State.poisonDamageRemaining = Math.max(1, Math.floor(RPG.State.maxHP / 3));
        uiControl.addLog("攻撃に毒が含まれていた！ (毒状態)", "", "#ff4d4d");
        uiControl.updateUI();
        return true;
    },

    curePoison: function () {
        RPG.State.isPoisoned = false;
        RPG.State.poisonDamageRemaining = 0;
    },

    hasNightMedicineEvasion: function () {
        return RPG.State.battleState?.nightMedicineEvasionActive === true;
    },

    tryNightMedicineDodge: function () {
        if (!this.hasNightMedicineEvasion() || Math.random() >= 0.5) return false;

        uiControl.addLog("カインは薬の余韻に導かれるように攻撃を避けた！", "", "#f1e6c8");
        return true;
    },

    applyPoisonTick: function () {
        if (!RPG.State.isPoisoned) return false;

        if (!Number.isFinite(RPG.State.poisonDamageRemaining) || RPG.State.poisonDamageRemaining <= 0) {
            RPG.State.poisonDamageRemaining = Math.max(1, Math.floor(RPG.State.maxHP / 3));
        }

        const tickDamage = Math.min(
            Math.max(1, Math.floor(RPG.State.maxHP / 15)),
            RPG.State.poisonDamageRemaining
        );
        RPG.State.currentHP = Math.max(1, RPG.State.currentHP - tickDamage);
        RPG.State.poisonDamageRemaining -= tickDamage;
        uiControl.addLog(`毒が身体を蝕む…（HP -${tickDamage}）`, "", "#ff4d4d");

        if (RPG.State.poisonDamageRemaining <= 0) {
            this.curePoison();
            uiControl.addLog("毒が抜けてきた。", "", "#a333c8");
        }

        uiControl.updateUI();
        return RPG.State.currentHP <= 1;
    },

    shouldActivateMatamatabiAfterBattle: function () {
        return (
            (RPG.State.inventory.matamatabiBranch || 0) > 0 &&
            RPG.State.flags.matamatabiActive !== true &&
            RPG.State.battleState &&
            RPG.State.battleState.playerTookDamage === true
        );
    },

    buildMatamatabiActivationQueue: function () {
        if (!this.shouldActivateMatamatabiAfterBattle()) return [];

        const lines = RPG.Assets.GAME_TEXT.events.phase4MatamatabiActivate || [];
        return lines.map(line => {
            if (line.startsWith("オーエン")) {
                return { text: line, color: "#a020f0" };
            }
            if (line === "マタマタビの枝は活性化した。") {
                return {
                    text: line,
                    color: "#9acd32",
                    action: () => {
                        RPG.State.flags.matamatabiActive = true;
                        RPG.State.flags.matamatabiNightPending = true;
                        RPG.State.matamatabiStepsRemaining = 10;
                        uiControl.updateUI();
                    }
                };
            }
            return { text: line };
        });
    },

    chooseGlowingCatRabbitTemplate: function () {
        const rabbitTemplate = RPG.Assets.ENEMIES.find(e => e.id === "glowing_cat_rabbit");
        if (!rabbitTemplate) return null;

        const isForestEncounter =
            RPG.State.isInDungeon &&
            RPG.State.location !== "かつての街道" &&
            RPG.State.currentDistance > 0 &&
            RPG.State.currentDistance < 10;

        if (!isForestEncounter) return null;
        if (RPG.State.flags.glowCatRabbitBadEndSeen) return null;
        if (Math.random() >= rabbitTemplate.rareRate) return null;

        return this.prepareGlowingCatRabbitTemplate(rabbitTemplate);
    },

    chooseMatamatabiEncounterTemplate: function () {
        const isForestEncounter =
            RPG.State.flags.matamatabiActive === true &&
            RPG.State.isInDungeon &&
            RPG.State.location !== "かつての街道" &&
            RPG.State.currentDistance > 0 &&
            RPG.State.currentDistance < 10;

        if (!isForestEncounter) return null;

        if (Math.random() < 0.15) {
            const rabbitTemplate = RPG.Assets.ENEMIES.find(e => e.id === "glowing_cat_rabbit");
            if (!rabbitTemplate || RPG.State.flags.glowCatRabbitBadEndSeen) return null;
            return this.prepareGlowingCatRabbitTemplate(rabbitTemplate);
        }

        return RPG.Assets.ENEMIES.find(e => e.id === "weasel") || null;
    },

    buildPreBattleDialogue: function (template) {
        if (Array.isArray(template.preBattleDialogue)) {
            return template.preBattleDialogue.map(line => ({ ...line }));
        }

        if (template.id !== "sap") return [];

        const sapText = RPG.Assets.BATTLE_TEXT.sap;
        const text = RPG.State.flags.treeDefeated === true
            ? sapText.afterTreeDefeat
            : sapText.beforeTreeDefeat;
        return [{ text, type: "ambient" }];
    },

    maybeUseAmberizedVariant: function (template) {
        const canAppear =
            RPG.State.flags.metThiefBoy === true &&
            RPG.State.isInDungeon === true &&
            RPG.State.explorationArea === "forest" &&
            RPG.State.location !== "かつての街道";
        const provisionalReplacementRate = 0.25;
        if (!canAppear || Math.random() >= provisionalReplacementRate) return template;

        const variantIds = {
            rat: "amber_rat",
            weasel: "amber_weasel"
        };
        const variantId = variantIds[template && template.id];
        return variantId
            ? (RPG.Assets.ENEMIES.find(enemy => enemy.id === variantId) || template)
            : template;
    },

    startBattle: function (enemyId = null) {
        // Enemy Selection logic remains in engine as it processes data
        let template = null;
        if (enemyId) {
            template = RPG.Assets.ENEMIES.find(e => e.id === enemyId);
            if (template && template.id === "glowing_cat_rabbit") {
                template = this.prepareGlowingCatRabbitTemplate(template);
                if (!template) {
                    uiControl.addLog("光る猫うさぎの気配はまだ現れない。");
                    return;
                }
            }
        }

        if (!template) {
            template = this.chooseMatamatabiEncounterTemplate();
        }

        if (!template) {
            template = this.chooseGlowingCatRabbitTemplate();
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

            template = this.maybeUseAmberizedVariant(template);
        }

        uiControl.addSeparator();
        const preBattleDialogue = this.buildPreBattleDialogue(template);

        if (preBattleDialogue.length > 0) {
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                ...preBattleDialogue,
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
        const isPhase4FirstRabbitEncounter =
            template.id === "glowing_cat_rabbit" &&
            RPG.State.storyPhase >= 4 &&
            !RPG.State.flags.glowCatRabbitPhase4EncounterSeen;

        if (isPhase4FirstRabbitEncounter) {
            RPG.State.flags.glowCatRabbitPhase4EncounterSeen = true;
        }

        RPG.State.isBattling = true;
        RPG.State.currentEnemy = {
            ...template,
            hp: template.maxHp,
            armorHp: Number(template.armorMax) || 0,
            frozenTurns: 0,
            cainHitCount: 0,
            rabbitHitCount: 0,
            rabbitEnemyTurnCount: 0,
            rabbitExposed: false
        };
        // Build 9.0.0: Battle State container
        const usesNightMedicineEvasion =
            (RPG.State.nightMedicineEvasionBattlesRemaining || 0) > 0 &&
            !(template.id === "glowing_cat_rabbit" && template.rabbitLevel === 88);
        RPG.State.battleState = {
            skippedTurns: 0,
            playerTookDamage: false,
            nightMedicineEvasionActive: usesNightMedicineEvasion
        };
        if (usesNightMedicineEvasion) {
            RPG.State.nightMedicineEvasionBattlesRemaining--;
        }
        RPG.State.lastBlowBy = null;
        RPG.State.battleTurn = 1;
        RPG.State.hasOwenIntervened = false;
        RPG.State.hasOwenSavedLife = false;

        if (typeof visualDirector !== "undefined") {
            visualDirector.syncScene();
            visualDirector.playBattleCue("encounter");
        }

        // Build 8.45: Boss Scaling & Intros (Delegated to Cinematics)
        if (Cinematics.scaleBoss(this, RPG.State.currentEnemy)) return;

        uiControl.updateUI();

        // Keep pre-emptive handling for boss-style encounters only.
        if (
            (RPG.State.currentEnemy.isBoss === true || RPG.State.currentEnemy.forcePreemptive === true) &&
            RPG.State.currentEnemy.preemptive &&
            Math.random() < RPG.State.currentEnemy.preemptive
        ) {
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

        if (
            RPG.State.currentEnemy.id === "glowing_cat_rabbit" &&
            RPG.State.currentEnemy.rabbitLevel === 88
        ) {
            this.runGlowingCatRabbitLv88Turn();
            return;
        }

        // Build 8.0: Poison Check
        if (this.applyPoisonTick()) {
            if (this.checkBattleEnd()) return;
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
            if (RPG.State.currentEnemy && RPG.State.currentEnemy.id === "glowing_cat_rabbit") {
                if (this.checkBattleEnd()) return;

                this.runGlowingCatRabbitTurn(() => {
                    if (this.checkBattleEnd()) return;

                    this.processCainAction(() => {
                        if (this.checkBattleEnd()) return;

                        RPG.State.battleTurn++;
                        const delay = RPG.State.debug.isSkipping ? 50 : 1000;
                        setTimeout(() => this.runBattleLoop(), delay);
                    });
                });
                return;
            }

            const isJourneyEnemy = RPG.State.currentEnemy && RPG.State.currentEnemy.isBoss !== true;
            if (isJourneyEnemy) {
                if (this.checkBattleEnd()) return;

                const runCainAfterEnemy = () => {
                    if (this.checkBattleEnd()) return;

                    this.processCainAction(() => {
                        if (this.checkBattleEnd()) return;

                        RPG.State.battleTurn++;
                        const delay = RPG.State.debug.isSkipping ? 50 : 1000;
                        setTimeout(() => this.runBattleLoop(), delay);
                    });
                };

                if (RPG.State.currentEnemy.frozenTurns > 0) {
                    RPG.State.currentEnemy.frozenTurns--;
                    uiControl.addLog(`${RPG.State.currentEnemy.name}は凍りついて動けない！`, "");
                    const delay = RPG.State.debug.isSkipping ? 50 : 1000;
                    setTimeout(runCainAfterEnemy, delay);
                } else {
                    this.runJourneyEnemyTurn(runCainAfterEnemy);
                }
                return;
            }

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

        if (action !== "idle" && typeof visualDirector !== "undefined") {
            visualDirector.playBattleCue("owen-action");
        }

        switch (action) {
            case "herb":
                RPG.State.inventory.herb--;
                const healAmount = Math.floor(RPG.State.maxHP * 0.3);
                RPG.State.currentHP = Math.min(RPG.State.maxHP, RPG.State.currentHP + healAmount);
                uiControl.addLog(RPG.Assets.BATTLE_TEXT.owen.herb, "", "#a333c8");
                break;
            case "kill":
                if (RPG.State.flags.matamatabiActive === true && (!RPG.State.currentEnemy || RPG.State.currentEnemy.id !== "glowing_cat_rabbit")) {
                    uiControl.addLog("オーエンは一瞬で敵を吹き飛ばした！", "", "#a333c8");
                } else {
                    uiControl.addLog(
                        RPG.Assets.BATTLE_TEXT.owen.kill[Math.floor(Math.random() * RPG.Assets.BATTLE_TEXT.owen.kill.length)],
                        "",
                        "#a333c8"
                    );
                }
                if (RPG.State.currentEnemy && RPG.State.currentEnemy.id === "glowing_cat_rabbit") {
                    uiControl.addLog(RPG.Assets.BATTLE_TEXT.glowing_cat_rabbit.killImmune, "", "#ffffaa");
                    delay = 1200;
                } else {
                    RPG.State.currentEnemy.hp = 0;
                    RPG.State.lastBlowBy = "Owen";
                    uiControl.addLog("オーエンの魔法が敵を消滅させた！", "");
                    delay = 1500;
                }
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

    applyCainDamage: function (damage, isCritical = false) {
        const enemy = RPG.State.currentEnemy;
        if (!enemy) return;

        const hasHardenedPart = (enemy.armorHp || 0) > 0;
        uiControl.addLog("カインの攻撃！", "player-action");

        if (hasHardenedPart && isCritical) {
            uiControl.addLog(
                RPG.Assets.BATTLE_TEXT.hardened.bypass(enemy.armorLabel),
                "player-action",
                "#ffd166"
            );
            enemy.hp -= damage;
            uiControl.addLog(
                `${enemy.name}に${damage}のダメージ！`,
                "player-action"
            );
            return;
        }

        if (hasHardenedPart) {
            const armorDamage = Math.min(enemy.armorHp, damage);
            const overflowDamage = Math.max(0, damage - enemy.armorHp);
            enemy.armorHp = Math.max(0, enemy.armorHp - damage);
            uiControl.addLog(
                RPG.Assets.BATTLE_TEXT.hardened.damage(enemy.armorLabel, armorDamage),
                "player-action"
            );

            if (enemy.armorHp <= 0) {
                uiControl.addLog(enemy.armorBreakText, "marker", "#ffd166");
            }
            if (overflowDamage > 0) {
                enemy.hp -= overflowDamage;
                uiControl.addLog(
                    RPG.Assets.BATTLE_TEXT.hardened.bodyDamage(enemy.name, overflowDamage),
                    "player-action"
                );
            }
            return;
        }

        enemy.hp -= damage;
        uiControl.addLog(`${enemy.name}に${damage}のダメージ！`, "player-action");
    },

    processCainAction: function (next) {
        if (typeof visualDirector !== "undefined") {
            visualDirector.playBattleCue("cain-attack");
        }

        if (RPG.State.currentEnemy && RPG.State.currentEnemy.id === "glowing_cat_rabbit") {
            const enemy = RPG.State.currentEnemy;
            const text = RPG.Assets.BATTLE_TEXT.glowing_cat_rabbit;
            const isFrozen = enemy.frozenTurns > 0;
            const hitChance = (isFrozen || enemy.rabbitExposed) ? 1 : 0.18;

            if (Math.random() < hitChance) {
                enemy.rabbitHitCount = (enemy.rabbitHitCount || 0) + 1;
                uiControl.addLog("カインの攻撃！");
                uiControl.addLog(text.hit(enemy.rabbitHitCount), "marker", "#ffd166");
                uiControl.updateUI();

                if (enemy.rabbitHitCount >= enemy.hitGoal) {
                    RPG.State.lastBlowBy = "Cain";
                    this.endGlowingCatRabbitBattle(false);
                    return;
                }
            } else {
                uiControl.addLog(text.miss);
                uiControl.updateUI();
            }

            enemy.rabbitExposed = false;

            const delay = RPG.State.debug.isSkipping ? 50 : 1000;
            setTimeout(next, delay);
            return;
        }

        let damage = RPG.State.attack;
        const isCrit = Math.random() < 0.15;
        if (isCrit) {
            damage = Math.floor(damage * 1.5);
            uiControl.addLog(RPG.Assets.BATTLE_TEXT.hardened.critical, "marker", "#ffd166");
        }

        this.applyCainDamage(damage, isCrit);
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

    runJourneyEnemyTurn: function (onComplete) {
        if (!RPG.State.isBattling || !RPG.State.currentEnemy) return;

        if (
            RPG.State.currentEnemy.ambientAttackChance &&
            Math.random() < RPG.State.currentEnemy.ambientAttackChance
        ) {
            uiControl.addLog(RPG.State.currentEnemy.ambientAttackLog, "enemy-action");
            const delay = RPG.State.debug.isSkipping ? 50 : 1000;
            setTimeout(onComplete, delay);
            return;
        }

        if (typeof visualDirector !== "undefined") {
            visualDirector.playBattleCue("enemy-attack");
        }

        const dodgeChance = this.hasNightMedicineEvasion() ? 0.5 : 0.1;
        if (Math.random() < dodgeChance) {
            uiControl.addLog(
                this.hasNightMedicineEvasion()
                    ? "カインは薬の余韻に導かれるように攻撃を避けた！"
                    : "カインは攻撃を剣で受け流した！",
                "",
                this.hasNightMedicineEvasion() ? "#f1e6c8" : null
            );
            const delay = RPG.State.debug.isSkipping ? 50 : 1000;
            setTimeout(onComplete, delay);
            return;
        }

        let dmg = RPG.State.currentEnemy.atk;
        const newHP = RPG.State.currentHP - dmg;

        if (newHP <= 0 && !RPG.State.hasOwenSavedLife) {
            RPG.State.hasOwenSavedLife = true;
            this.markPlayerTookDamage(dmg);
            uiControl.addLog(`${RPG.State.currentEnemy.name}が${RPG.State.currentEnemy.msg || "攻撃してきた！"}`);
            uiControl.addLog(RPG.Assets.BATTLE_TEXT.owen.intimidation, "", "#a333c8");
            uiControl.addLog(RPG.Assets.BATTLE_TEXT.owen.intimidationEffect, "", "#ffff00");
            RPG.State.currentHP = 1;
            uiControl.updateUI();
            const delay = RPG.State.debug.isSkipping ? 50 : 1500;
            setTimeout(() => this.endBattle(false, true), delay);
            return;
        }

        RPG.State.currentHP = Math.max(0, newHP);
        this.markPlayerTookDamage(dmg);

        let msg = RPG.State.currentEnemy.msg || "攻撃してきた！";
        if (RPG.State.currentEnemy.id === "weasel") {
            msg = (RPG.State.battleTurn === 1) ? "目にも止まらぬ速さで先制攻撃！" : "カマで切り付けてきた";
        }

        uiControl.addLog(
            `${RPG.State.currentEnemy.name}が${msg} カインは${dmg}のダメージ！`,
            "enemy-action"
        );

        if (RPG.State.currentEnemy.poison && !RPG.State.isPoisoned) {
            if (Math.random() < (RPG.State.currentEnemy.poisonRate || 0.2)) {
                this.inflictPoison();
            }
        }

        uiControl.updateUI();

        if (this.checkBattleEnd()) return;

        const delay = RPG.State.debug.isSkipping ? 50 : 1000;
        setTimeout(onComplete, delay);
    },

    runGlowingCatRabbitTurn: function (callback) {
        const enemy = RPG.State.currentEnemy;
        if (!enemy || enemy.id !== "glowing_cat_rabbit") {
            callback();
            return;
        }

        const text = RPG.Assets.BATTLE_TEXT.glowing_cat_rabbit;
        const rabbitLevel = enemy.rabbitLevel || 5;
        const delay = RPG.State.debug.isSkipping ? 50 : 900;
        enemy.rabbitEnemyTurnCount = (enemy.rabbitEnemyTurnCount || 0) + 1;

        if (enemy.rabbitEnemyTurnCount >= 4) {
            uiControl.addLog(text.escape(rabbitLevel));
            setTimeout(() => this.endGlowingCatRabbitBattle(true), delay);
            return;
        }

        if (enemy.rabbitEnemyTurnCount === 3) {
            enemy.rabbitExposed = true;
            uiControl.addLog(text.yawn(rabbitLevel));
            setTimeout(callback, delay);
            return;
        }

        if (enemy.frozenTurns > 0) {
            enemy.frozenTurns--;
            uiControl.addLog(`${enemy.name}は凍りついて動けない！`, "");
            setTimeout(callback, delay);
            return;
        }

        const roll = Math.random();
        if (roll < 0.35) {
            uiControl.addLog(text.yawn(rabbitLevel));
            setTimeout(callback, delay);
            return;
        }

        if (roll < 0.65) {
            uiControl.addLog(text.waiting(rabbitLevel));
            setTimeout(callback, delay);
            return;
        }

        const damage = Math.max(1, enemy.atk);
        uiControl.addLog(text.standardAttack(rabbitLevel), "enemy-action");
        setTimeout(() => {
            if (this.tryNightMedicineDodge()) {
                setTimeout(callback, delay);
                return;
            }
            RPG.State.currentHP = Math.max(1, RPG.State.currentHP - damage);
            this.markPlayerTookDamage(damage);
            uiControl.addLog(`カインは${damage}のダメージを受けた！`, "damage");
            uiControl.updateUI();
            setTimeout(callback, delay);
        }, delay);
    },

    runGlowingCatRabbitLv88Turn: function () {
        const text = RPG.Assets.BATTLE_TEXT.glowing_cat_rabbit;

        if (RPG.State.currentEnemy.lv88Repeat === true) {
            this.resolveGlowingCatRabbitLv88BadEnd();
            return;
        }

        const roll = Math.random();

        if (roll < 1 / 3) {
            uiControl.addLog(text.yawn(88));
            uiControl.addLog("オーエン「逃げろ！」");
            uiControl.addLog("カイン「…ッ！」");
            setTimeout(() => this.showGlowingCatRabbitLv88Choices(), RPG.State.debug.isSkipping ? 50 : 900);
            return;
        }

        if (roll < 2 / 3) {
            uiControl.addLog("光る猫うさぎLv88は咆哮をあげた！", "enemy-action");
            uiControl.addLog("カイン「…っな、」");
            uiControl.addLog("オーエン「…くっ」");
            uiControl.addLog("空が震える。ズン、と、地面が地震のように揺れた。");
            uiControl.addLog("カインは足がすくんで動けない！", "damage");
            uiControl.addLog("オーエンはカインを引っ張って逃げ出した！");
            setTimeout(() => this.finishGlowingCatRabbitLv88Escape(), RPG.State.debug.isSkipping ? 50 : 1400);
            return;
        }

        this.resolveGlowingCatRabbitLv88BadEnd();
    },

    showGlowingCatRabbitLv88Choices: function () {
        const container = document.getElementById("action-buttons");
        const choiceUI = document.getElementById("choiceUI");
        if (!container) return;

        container.innerHTML = "";
        container.style.display = "flex";
        if (choiceUI) choiceUI.style.display = "none";

        const escapeButton = document.createElement("button");
        escapeButton.className = "btn btn-full";
        escapeButton.textContent = "逃げる！";
        escapeButton.onclick = () => this.finishGlowingCatRabbitLv88Escape();

        const challengeButton = document.createElement("button");
        challengeButton.className = "btn btn-full";
        challengeButton.textContent = "挑む！";
        challengeButton.onclick = () => this.resolveGlowingCatRabbitLv88BadEnd();

        container.appendChild(escapeButton);
        container.appendChild(challengeButton);
        RPG.State.mode = "choice";
        uiControl.updateUI();
    },

    clearGlowingCatRabbitLv88Choices: function () {
        const container = document.getElementById("action-buttons");
        if (!container) return;
        container.innerHTML = "";
        container.style.display = "none";
    },

    finishGlowingCatRabbitLv88Escape: function () {
        this.clearGlowingCatRabbitLv88Choices();
        RPG.State.isBattling = false;
        RPG.State.currentEnemy = null;
        RPG.State.battleState = null;
        RPG.State.isInDungeon = true;
        RPG.State.currentDistance = 0;
        RPG.State.location = uiControl.getLocData(0).name;
        RPG.State.mode = "event";

        const shouldPlayAftermath = !RPG.State.flags.glowCatRabbitLv88EscapeTalkDone;
        if (!shouldPlayAftermath) {
            RPG.State.mode = "base";
            uiControl.updateUI();
            return;
        }

        RPG.State.flags.glowCatRabbitLv88EscapeTalkDone = true;
        const lines = RPG.Assets.GAME_TEXT.events.glowingRabbitLv88Escape || [];
        RPG.State.dialogueQueue = [
            { text: null, action: () => uiControl.beginSceneLogFocus() },
            { text: null, delay: 650 },
            ...lines.map(text => ({ text, typewriter: true, typeSpeed: 24 })),
            {
                text: null,
                action: () => {
                    uiControl.endSceneLogFocus();
                    RPG.State.mode = "base";
                    uiControl.updateUI();
                }
            }
        ];
        uiControl.updateUI();
        explorationSystem.playDialogueLoop();
    },

    resolveGlowingCatRabbitLv88BadEnd: function () {
        this.clearGlowingCatRabbitLv88Choices();
        RPG.State.currentHP = Math.max(0, RPG.State.currentHP - 888);
        uiControl.screenShake();
        uiControl.flashFullScreen("#8b0000", 900);
        uiControl.addLog("光る猫うさぎLv88は業火を吹いた！", "enemy-action");
        uiControl.addLog("カイン「うわあぁ！」");
        uiControl.addLog("オーエン「…ちっ」");
        uiControl.addLog("カインは888のダメージを受けた！", "damage");
        uiControl.updateUI();

        const openingLines = (RPG.Assets.GAME_TEXT.events.glowingRabbitLv88BadEnd || []).slice(0, 2);
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            { text: null, delay: RPG.State.debug.isSkipping ? 50 : 1200 },
            ...openingLines.map(text => ({
                text,
                color: "#ff4d4d",
                typewriter: true,
                typeSpeed: 30
            })),
            { text: null, action: () => this.showGlowingCatRabbitLv88BadEnd() }
        ];
        explorationSystem.playDialogueLoop();
    },

    showGlowingCatRabbitLv88BadEnd: function () {
        RPG.State.flags.glowCatRabbitBadEndSeen = true;
        RPG.State.isBattling = false;
        RPG.State.currentEnemy = null;
        RPG.State.battleState = null;
        RPG.State.mode = "event";
        RPG.State.location = "？？？";

        const lines = (RPG.Assets.GAME_TEXT.events.glowingRabbitLv88BadEnd || []).slice(2);
        const fadeDuration = RPG.State.debug.isSkipping ? 50 : 2400;
        const blackout = uiControl.fadeFullScreen("#000000", fadeDuration);
        RPG.State.dialogueQueue = [
            {
                text: null,
                delay: fadeDuration
            },
            {
                text: null,
                action: () => {
                    const logContainer = document.getElementById("logContainer");
                    if (logContainer) {
                        logContainer.innerHTML = "";
                    }
                    blackout.remove();
                }
            },
            ...lines.map((text, index) => ({
                text,
                typewriter: true,
                typeSpeed: 24,
                type: index === lines.length - 1 ? "marker" : ""
            })),
            {
                text: null,
                action: () => {
                    const container = document.getElementById("action-buttons");
                    if (!container) return;
                    container.innerHTML = "";
                    container.style.display = "flex";

                    const button = document.createElement("button");
                    button.className = "btn btn-full btn-accent";
                    button.textContent = "タイトルへ戻る";
                    button.onclick = () => location.reload();
                    container.appendChild(button);
                }
            }
        ];
        uiControl.updateUI();
    },

    shouldAwardGlowingCatRabbitFur: function (enemy) {
        if (!enemy || enemy.id !== "glowing_cat_rabbit") return false;
        const canReceiveQuestFur =
            RPG.State.flags.needsGlowingRabbitFur === true &&
            (RPG.State.inventory.glowingCatRabbitFur || 0) === 0;

        if (!canReceiveQuestFur) return false;
        if (
            RPG.State.flags.matamatabiActive === true &&
            (RPG.State.flags.phase4MatamatabiRabbitEncounters || 0) >= 1
        ) {
            return true;
        }
        return Math.random() < 0.2;
    },

    getGlowingCatRabbitVictoryReward: function (rabbitLevel) {
        const rewards = {
            5: { itemId: "lightBook", flag: "glowCatRabbitRewardLv5Received" },
            10: { itemId: "purpleMacaron", flag: "glowCatRabbitRewardLv10Received" },
            15: { itemId: "glowingBunnyEars", flag: "glowCatRabbitRewardLv15Received" },
            20: { itemId: "nightMedicine", flag: "glowCatRabbitRewardLv20Received" }
        };
        const reward = rewards[rabbitLevel];
        if (!reward || RPG.State.flags[reward.flag] === true) return null;
        return reward;
    },

    buildGlowingCatRabbitFurQueue: function () {
        const lines = RPG.Assets.GAME_TEXT.events.phase4GlowingRabbitFurObtained || [];
        return lines.map(line => {
            if (line.startsWith("オーエン「") || line.startsWith("オーエン｢")) {
                return { text: line, color: "#a020f0" };
            }

            if (line === "ダメージ+2") {
                return {
                    text: line,
                    color: "#ff4d4d",
                    action: () => {
                        RPG.State.currentHP = Math.max(1, RPG.State.currentHP - 2);
                        uiControl.addLog("カインは2のダメージを受けた！", "damage");
                        uiControl.updateUI();
                    }
                };
            }

            if (line === "オーエンが全て舐めとったため、枝は不活性化した。") {
                return {
                    text: line,
                    color: "#9acd32",
                    action: () => {
                        RPG.State.inventory.matamatabiBranch = 0;
                        RPG.State.flags.matamatabiActive = false;
                        RPG.State.matamatabiStepsRemaining = 0;
                        uiControl.updateUI();
                    }
                };
            }

            return { text: line };
        });
    },

    advanceHerbGardenHarvestCooldowns: function () {
        const flags = RPG.State.flags;
        const cooldowns = [
            {
                remainingKey: "herbGardenHerb2BattlesRemaining",
                availableKey: "herbGardenHerb2Available"
            },
            {
                remainingKey: "herbGardenHighHerbBattlesRemaining",
                availableKey: "herbGardenHighHerbAvailable"
            },
            {
                remainingKey: "herbGardenAntidoteHerbBattlesRemaining",
                availableKey: "herbGardenAntidoteHerbAvailable"
            }
        ];

        cooldowns.forEach(({ remainingKey, availableKey }) => {
            const remaining = flags[remainingKey] || 0;
            if (remaining <= 0) return;

            flags[remainingKey] = remaining - 1;
            if (flags[remainingKey] <= 0) {
                flags[remainingKey] = 0;
                flags[availableKey] = true;
            }
        });
    },

    endGlowingCatRabbitBattle: function (escaped) {
        this.advanceHerbGardenHarvestCooldowns();

        const enemy = RPG.State.currentEnemy;
        const text = RPG.Assets.BATTLE_TEXT.glowing_cat_rabbit;
        const rabbitLevel = enemy?.rabbitLevel || 5;
        const hadBranch = (RPG.State.inventory.matamatabiBranch || 0) > 0;
        const isActiveFurQuest =
            RPG.State.flags.needsGlowingRabbitFur === true &&
            (RPG.State.inventory.glowingCatRabbitFur || 0) === 0;
        const isMatamatabiQuestEncounter =
            isActiveFurQuest &&
            RPG.State.flags.matamatabiActive === true;
        const furAwarded = this.shouldAwardGlowingCatRabbitFur(enemy);
        const victoryReward = escaped ? null : this.getGlowingCatRabbitVictoryReward(rabbitLevel);
        const followupDialogue = this.getGlowingCatRabbitFollowupDialogue(rabbitLevel);
        const matamatabiActivationQueue = this.buildMatamatabiActivationQueue();
        const noFurDialogue = (
            RPG.State.flags.needsGlowingRabbitFur === true &&
            (RPG.State.inventory.glowingCatRabbitFur || 0) === 0 &&
            !furAwarded
        )
            ? (RPG.Assets.GAME_TEXT.events.phase4GlowingRabbitNoFur || []).map(line => ({ text: line }))
            : [];

        uiControl.addSeparator();

        if (!escaped) {
            uiControl.addLog(text.vanish(rabbitLevel));
        }

        if (furAwarded) {
            uiControl.addLog(
                escaped ? text.furDropOnEscape(rabbitLevel) : text.furDropOnDefeat(rabbitLevel),
                "",
                "#ffd166"
            );
            RPG.State.inventory.glowingCatRabbitFur = (RPG.State.inventory.glowingCatRabbitFur || 0) + 1;
            RPG.State.flags.phase4MatamatabiRabbitEncounters = 0;
            if (!hadBranch) {
                uiControl.addLog("✨光る猫うさぎの毛を手に入れた！", "", "#ffd166");
            }
        } else if (isMatamatabiQuestEncounter) {
            RPG.State.flags.phase4MatamatabiRabbitEncounters =
                (RPG.State.flags.phase4MatamatabiRabbitEncounters || 0) + 1;
        }

        if (victoryReward) {
            RPG.State.inventory[victoryReward.itemId] = (RPG.State.inventory[victoryReward.itemId] || 0) + 1;
            RPG.State.flags[victoryReward.flag] = true;
            uiControl.addLog("✨光る猫うさぎは、きらめく何かを落とした！", "marker", "#ffd166");
            uiControl.addLog(`《${RPG.Assets.CONFIG.ITEM_NAME[victoryReward.itemId]}を手に入れた！》`, "marker", "#ffd166");
        }

        if (!escaped) {
            RPG.State.glowCatRabbitDefeatCount = (RPG.State.glowCatRabbitDefeatCount || 0) + 1;
        }

        RPG.State.isBattling = false;
        RPG.State.currentEnemy = null;
        RPG.State.battleState = null;

        const shouldPlayFurScene = furAwarded && hadBranch;
        const furDialogueQueue = shouldPlayFurScene ? this.buildGlowingCatRabbitFurQueue() : [];

        if (
            shouldPlayFurScene ||
            noFurDialogue.length > 0 ||
            (followupDialogue && followupDialogue.length > 0) ||
            matamatabiActivationQueue.length > 0
        ) {
            RPG.State.mode = "event";
            uiControl.updateUI();
            RPG.State.dialogueQueue = [
                ...(shouldPlayFurScene
                    ? furDialogueQueue
                    : [
                        ...noFurDialogue,
                        ...(followupDialogue ? followupDialogue.map(line => ({ ...line })) : []),
                        ...matamatabiActivationQueue
                    ])
            ];
            explorationSystem.playDialogueLoop();
            return;
        }

        RPG.State.mode = "base";
        uiControl.updateUI();
    },

    getGlowingCatRabbitFollowupDialogue: function (rabbitLevel) {
        const flags = RPG.State.flags;

        if (rabbitLevel === 5 && RPG.State.storyPhase <= 3 && !flags.glowCatRabbitTalkLv5Done) {
            flags.glowCatRabbitTalkLv5Done = true;
            return [
                { text: "カイン「なんだったんだあれは…」" },
                { text: "オーエン「……」", color: "#a020f0" },
                { text: "カイン「…どうした？」" },
                { text: "オーエン「こんなところにいるなんて」", color: "#a020f0" },
                { text: "カイン「知ってるのか？」" },
                { text: "オーエン「魔界の珍しい生き物だよ」", color: "#a020f0" }
            ];
        }

        if (rabbitLevel === 10 && !flags.glowCatRabbitTalkLv10Done) {
            flags.glowCatRabbitTalkLv10Done = true;
            return [
                { text: "カイン「またいたな…」" },
                { text: "オーエン「不吉だね」", color: "#a020f0" },
                { text: "カイン「可愛いし、あんまり攻撃も痛くないけどな」" },
                { text: "オーエン「子供なんじゃない？小さいもの」", color: "#a020f0" },
                { text: "カイン「小さいか？普通の猫くらいの大きさだったが…」" }
            ];
        }

        if (rabbitLevel === 15 && !flags.glowCatRabbitTalkLv15Done) {
            flags.glowCatRabbitTalkLv15Done = true;
            return [
                { text: "オーエン「あんな珍しいものに、よく会うね」", color: "#a020f0" },
                { text: "カイン「ラッキーなのかな？」" },
                { text: "オーエン「好かれてるとしたら、アンラッキー」", color: "#a020f0" },
                { text: "カイン「可愛いけどな。にゃあにゃあ言ってて」" },
                { text: "オーエン「へえ…おまえにはそう聞こえるの」", color: "#a020f0" }
            ];
        }

        if (rabbitLevel === 20 && !flags.glowCatRabbitTalkLv20Done) {
            flags.glowCatRabbitTalkLv20Done = true;
            return [
                { text: "カイン「今のはかなり大きかったな！黒豹くらいの大きさだった」" },
                { text: "オーエン「………」", color: "#a020f0" },
                { text: "カイン「オーエン？」" },
                { text: "オーエン「次、アレが出たらすぐ逃げなよ」", color: "#a020f0" }
            ];
        }

        return null;
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

    isDeferredLevelUpTalkBoss: function (enemyId) {
        return ["hungry_amber_tree", "giant_larva", "amber_husk_giant_larva"].includes(enemyId);
    },

    getLevelUpTalkDialogues: function (level) {
        const talks = {
            2: [
                { text: "カイン「やった！」" },
                { text: "オーエン「誤差でしょ」" },
                { text: "カイン「それでも、確かな一歩だ」" }
            ],
            4: [
                { text: "オーエン「技とか覚えないの？」" },
                { text: "カイン「この程度のレベルでか？」" },
                { text: "オーエン「はは、言えてる」" }
            ],
            6: [
                { text: "カイン「必殺！ナイトレイビーム！！」" },
                { text: "オーエン「……」" },
                { text: "カイン「あれ」" },
                { text: "オーエン「早く強くなってよね」" },
                { text: "カイン（無視された）" }
            ],
            8: [
                { text: "オーエン「今どのくらい強いの？」" },
                { text: "カイン「うーん…たしか俺が10歳くらいの頃このくらいだった？」" },
                { text: "オーエン「今何歳？」" },
                { text: "カイン「22歳」" },
                { text: "オーエン「あんまり変わらない」" },
                { text: "カイン「そうかな？」" }
            ]
        };

        return talks[level] ? talks[level].map(line => ({ ...line })) : [];
    },

    buildLevelUpTalkQueue: function (currentLevel = null) {
        const pendingLevels = Array.isArray(RPG.State.flags.pendingLevelUpTalk)
            ? [...RPG.State.flags.pendingLevelUpTalk]
            : [];
        const queue = [];

        if (pendingLevels.length > 0) {
            queue.push(
                { text: "カイン「そういえば、ちょっと強くなった気がする」" },
                { text: "オーエン「…そう？」" }
            );

            pendingLevels.forEach(level => {
                queue.push(...this.getLevelUpTalkDialogues(level));
            });

            RPG.State.flags.pendingLevelUpTalk = [];
        }

        if (currentLevel !== null) {
            queue.push(...this.getLevelUpTalkDialogues(currentLevel));
        }

        return queue;
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
        const dodgeChance = this.hasNightMedicineEvasion() ? 0.5 : 0.1;
        if (!isPreemptive && Math.random() < dodgeChance) {
            uiControl.addLog(
                this.hasNightMedicineEvasion()
                    ? "カインは薬の余韻に導かれるように攻撃を避けた！"
                    : "カインは攻撃を剣で受け流した！",
                "",
                this.hasNightMedicineEvasion() ? "#f1e6c8" : null
            );
            const delay = RPG.State.debug.isSkipping ? 50 : 1000;
            setTimeout(() => this.runBattleLoop(), delay);
            return;
        }

        let dmg = RPG.State.currentEnemy.atk;
        const newHP = RPG.State.currentHP - dmg;

        // Death Save
        if (newHP <= 0 && !RPG.State.hasOwenSavedLife) {
            RPG.State.hasOwenSavedLife = true;
            this.markPlayerTookDamage(dmg);
            uiControl.addLog(`${RPG.State.currentEnemy.name}が${RPG.State.currentEnemy.msg || "攻撃してきた！"}`);
            uiControl.addLog(RPG.Assets.BATTLE_TEXT.owen.intimidation, "", "#a333c8");
            uiControl.addLog(RPG.Assets.BATTLE_TEXT.owen.intimidationEffect, "", "#ffff00");
            RPG.State.currentHP = 1;
            uiControl.updateUI();
            const delay = RPG.State.debug.isSkipping ? 50 : 1500;
            setTimeout(() => this.endBattle(false, true), delay);
            return;
        }

        RPG.State.currentHP = Math.max(0, newHP);
        this.markPlayerTookDamage(dmg);

        let msg = RPG.State.currentEnemy.msg || "攻撃してきた！";
        // Build 6.3.2: Weasel Logic (Specific case kept inline for simplicity as it's minor)
        if (RPG.State.currentEnemy.id === "weasel") {
            msg = (RPG.State.battleTurn === 1) ? "目にも止まらぬ速さで先制攻撃！" : "カマで切り付けてきた";
        }

        uiControl.addLog(
            `${RPG.State.currentEnemy.name}が${msg} カインは${dmg}のダメージ！`,
            "enemy-action"
        );

        if (RPG.State.currentEnemy.poison && !RPG.State.isPoisoned) {
            if (Math.random() < (RPG.State.currentEnemy.poisonRate || 0.2)) {
                this.inflictPoison();
            }
        }

        uiControl.updateUI();

        if (this.checkBattleEnd()) return;

        RPG.State.battleTurn++;
        const delay = RPG.State.debug.isSkipping ? 50 : 1000;
        setTimeout(() => this.runBattleLoop(), delay);
    },

    checkBattleEnd: function () {
        if (RPG.State.currentEnemy.hp <= 0) {
            this.endBattle(true);
            return true;
        }
        if (RPG.State.currentHP <= 1) {
            if ((RPG.State.inventory.charm || 0) > 0) {
                RPG.State.inventory.charm -= 1;
                RPG.State.currentHP = Math.floor(RPG.State.maxHP * 0.5);
                if (RPG.State.battleState) {
                    RPG.State.battleState.stunTurns = 0;
                }
                uiControl.screenShake();
                uiControl.addLog("🧧お守り袋が眩い光を放った！", "marker", "#f1e6c8");
                uiControl.addLog("カイン（なんだ…！？助かった、のか？）");
                uiControl.updateUI();
                return false;
            }
            this.resolveDefeat();
            return true;
        }
        return false;
    },

    grantGuaranteedEnemyDrop: function (enemy = RPG.State.currentEnemy) {
        if (!enemy || !enemy.guaranteedDrop || enemy.guaranteedDropGranted === true) return;
        const itemId = enemy.guaranteedDrop;
        RPG.State.inventory[itemId] = (RPG.State.inventory[itemId] || 0) + 1;
        enemy.guaranteedDropGranted = true;
        uiControl.addLog(`${RPG.Assets.CONFIG.ITEM_NAME[itemId]}を手に入れた！`, "marker", "#ffd166");
    },

    endBattle: function (playerWin, isDeathSave = false) {
        if (!RPG.State.defeatCounts) RPG.State.defeatCounts = {};
        if (!RPG.State.lastBlowBy) RPG.State.lastBlowBy = "Cain";

        const enemyId = RPG.State.currentEnemy.id;
        if (!RPG.State.defeatCounts[enemyId]) RPG.State.defeatCounts[enemyId] = { cain: 0, owen: 0 };

        if (enemyId === "glowing_cat_rabbit") {
            this.endGlowingCatRabbitBattle(false);
            return;
        }

        this.advanceHerbGardenHarvestCooldowns();

        uiControl.addSeparator();

        // Giant Larva Death Spasm
        // Giant Larva Death Spasm (Cinematic)
        if (RPG.State.currentEnemy.id === 'giant_larva' && playerWin) {
            Cinematics.playGiantLarvaDeath(this, enemyId);
            return;
        }

        const matamatabiActivationQueue = this.buildMatamatabiActivationQueue();
        let hasPostBattleEvent = false;

        if (isDeathSave) {
            uiControl.addLog("戦闘から離脱した。");
            if (matamatabiActivationQueue.length > 0) {
                hasPostBattleEvent = true;
            }
        } else if (!playerWin) {
            if (typeof visualDirector !== "undefined") {
                visualDirector.playBattleCue("enemy-defeated");
            }
            RPG.State.defeatCounts[enemyId].owen++;
            uiControl.addLog(`${RPG.State.currentEnemy.name}は塵になった…`);
            this.grantGuaranteedEnemyDrop();
            if (matamatabiActivationQueue.length > 0) {
                hasPostBattleEvent = true;
            }
        } else {
            this.executeStandardVictory(enemyId);
            return;
        }

        RPG.State.isBattling = false;
        RPG.State.currentEnemy = null;
        RPG.State.battleState = null;

        if (hasPostBattleEvent) {
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [...matamatabiActivationQueue];
            uiControl.updateUI();
            explorationSystem.playDialogueLoop();
            return;
        }

        RPG.State.mode = "base";
        uiControl.updateUI();
    },

    executeStandardVictory: function (enemyId) {
        // Build 15.1.8: Lock UI IMMEDIATELY to prevent Race Condition
        RPG.State.mode = "event";
        if (typeof visualDirector !== "undefined") {
            visualDirector.playBattleCue("enemy-defeated");
        }
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

        this.grantGuaranteedEnemyDrop();

        const shouldAdvanceForestSearchCounter =
            RPG.State.isInDungeon &&
            RPG.State.location !== "かつての街道";

        if (shouldAdvanceForestSearchCounter && RPG.State.searchCounter !== null && RPG.State.searchCounter < 5) {
            RPG.State.searchCounter++;
        }

        // --- Battle Event & Clean-up Sync ---
        let hasPostBattleEvent = false;
        const matamatabiActivationQueue = this.buildMatamatabiActivationQueue();

        if (
            RPG.State.flags.treeDefeated &&
            RPG.State.flags.amberTreeCoinMined === true &&
            RPG.State.postTreeBattles !== "DONE"
        ) {
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
            const silverReward = RPG.State.currentEnemy.gold;
            RPG.State.inventory.silverCoin = (RPG.State.inventory.silverCoin || 0) + silverReward;
            RPG.State.silverCoins = (RPG.State.silverCoins || 0) + silverReward;
            uiControl.addLog(`銀貨を${silverReward}枚手に入れた。`);
        }
        if (RPG.State.currentEnemy.drop && Math.random() < RPG.State.currentEnemy.drop.rate) {
            const itemId = RPG.State.currentEnemy.drop.id;
            RPG.State.inventory[itemId] = (RPG.State.inventory[itemId] || 0) + 1;
            uiControl.addLog(`${RPG.Assets.CONFIG.ITEM_NAME[itemId]}を手に入れた！`);
        }
        if (Array.isArray(RPG.State.currentEnemy.drops) && RPG.State.currentEnemy.drops.length > 0) {
            const drops = RPG.State.currentEnemy.drops;
            const totalWeight = drops.reduce((sum, drop) => sum + drop.weight, 0);
            let roll = Math.random() * totalWeight;
            let selectedDrop = drops[0];

            for (const drop of drops) {
                roll -= drop.weight;
                if (roll < 0) {
                    selectedDrop = drop;
                    break;
                }
            }

            RPG.State.inventory[selectedDrop.id] = (RPG.State.inventory[selectedDrop.id] || 0) + 1;
            uiControl.addLog(`${RPG.Assets.CONFIG.ITEM_NAME[selectedDrop.id]}を手に入れた！`);
        }

        if (enemyId === "carnivorous_vine") {
            RPG.State.flags.carnivorousVineDefeated = true;
            RPG.State.flags.carnivorousVineRegrown = false;
            RPG.State.flags.carnivorousVineStayCount = 0;
        }

        let currentLevelUpTalkLevel = null;

        if (RPG.State.currentEnemy.xp) {
            RPG.State.exp += RPG.State.currentEnemy.xp;
            uiControl.addLog(`${RPG.State.currentEnemy.xp}の経験値を得た。`);
            if (RPG.State.exp >= 75 * Math.pow(1.5, RPG.State.cainLv - 1)) {
                RPG.State.cainLv++;
                RPG.State.maxHP += 10;
                RPG.State.attack += 2;
                if (RPG.Config.HEAL_ON_LEVEL_UP) {
                    RPG.State.currentHP = RPG.State.maxHP;
                }
                uiControl.addLog(`【LEVEL UP!】カインのレベルが ${RPG.State.cainLv} に上がった！`, "marker", "#ffff00");

                if (RPG.Config.LEVEL_UP_TALK_BATTLE_ONLY && this.getLevelUpTalkDialogues(RPG.State.cainLv).length > 0) {
                    currentLevelUpTalkLevel = RPG.State.cainLv;
                }
            }
        }

        const isBossLevelUpBattle = this.isDeferredLevelUpTalkBoss(enemyId);
        if (currentLevelUpTalkLevel !== null && isBossLevelUpBattle) {
            if (!Array.isArray(RPG.State.flags.pendingLevelUpTalk)) {
                RPG.State.flags.pendingLevelUpTalk = [];
            }
            RPG.State.flags.pendingLevelUpTalk.push(currentLevelUpTalkLevel);
            currentLevelUpTalkLevel = null;
        }

        const levelUpTalkQueue = isBossLevelUpBattle
            ? []
            : this.buildLevelUpTalkQueue(currentLevelUpTalkLevel);

        const count = RPG.State.defeatCounts[enemyId] ? (RPG.State.defeatCounts[enemyId].cain + RPG.State.defeatCounts[enemyId].owen) : 1;
        const hasInnRatEvent2Aftermath =
            enemyId === 'rat' &&
            RPG.State.flags.innRatEvent2BattleActive === true &&
            RPG.Assets.BATTLE_EVENTS.inn_rat_event2 &&
            RPG.Assets.BATTLE_EVENTS.inn_rat_event2[1];

        if (!hasPostBattleEvent && hasInnRatEvent2Aftermath) {
            const eventDialogues = [
                ...RPG.Assets.BATTLE_EVENTS.inn_rat_event2[1],
                {
                    text: null,
                    action: () => {
                        RPG.State.flags.innRatEvent2BattleActive = false;
                    }
                }
            ];
            uiControl.addLog("---");
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [...levelUpTalkQueue, ...eventDialogues, ...matamatabiActivationQueue];
            explorationSystem.playDialogueLoop();
            hasPostBattleEvent = true;
        }

        if (!hasPostBattleEvent && RPG.Assets.BATTLE_EVENTS[enemyId] && RPG.Assets.BATTLE_EVENTS[enemyId][count]) {
            const eventDialogues = RPG.Assets.BATTLE_EVENTS[enemyId][count];
            uiControl.addLog("---");
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [...levelUpTalkQueue, ...eventDialogues, ...matamatabiActivationQueue];
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

        if (!hasPostBattleEvent && levelUpTalkQueue.length > 0) {
            uiControl.addLog("---");
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [...levelUpTalkQueue, ...matamatabiActivationQueue];
            explorationSystem.playDialogueLoop();
            hasPostBattleEvent = true;
        }

        if (!hasPostBattleEvent && matamatabiActivationQueue.length > 0) {
            uiControl.addLog("---");
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [...matamatabiActivationQueue];
            explorationSystem.playDialogueLoop();
            hasPostBattleEvent = true;
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
        RPG.State.flags.innRatEvent2BattleActive = false;
        RPG.State.isBattling = false;
        RPG.State.currentEnemy = null;
        RPG.State.battleState = null;
        RPG.State.mood = Math.max(0, RPG.State.mood - 20);

        innSystem.showDefeatSequence(defeatedEnemyId);
    },

    resolveDefeat: function () {
        uiControl.addSeparator();

        if (
            RPG.State.isBattling &&
            RPG.State.currentEnemy &&
            typeof visualDirector !== "undefined"
        ) {
            visualDirector.playBattleCue("party-defeated");
        }

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

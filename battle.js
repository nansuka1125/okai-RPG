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

    hasMikawashiEvasion: function () {
        return RPG.State.battleState?.mikawashiEvasionActive === true;
    },

    getActiveEvasionEffect: function (options = {}) {
        if (this.hasMikawashiEvasion()) {
            return {
                chance: RPG.Config.EVASION_RATE.mikawashiFeather,
                log: "ミカワシ羽の力で、カインは攻撃をかわした！",
                color: "#f1e6c8"
            };
        }

        if (this.hasNightMedicineEvasion()) {
            return {
                chance: RPG.Config.EVASION_RATE.nightMedicine,
                log: "カインは薬の余韻に導かれるように攻撃を避けた！",
                color: "#f1e6c8"
            };
        }

        if (options.allowNormalEvasion === true) {
            return {
                chance: RPG.Config.EVASION_RATE.normal,
                log: "カインは攻撃を剣で受け流した！",
                color: null
            };
        }

        return null;
    },

    tryEnemyAttackDodge: function (options = {}) {
        const effect = this.getActiveEvasionEffect(options);
        if (!effect) return false;

        const chance = Number.isFinite(options.chanceCap)
            ? Math.min(effect.chance, options.chanceCap)
            : effect.chance;
        if (Math.random() >= chance) return false;

        uiControl.addLog(effect.log, "", effect.color);
        return true;
    },

    tryNightMedicineDodge: function (options = {}) {
        return this.tryEnemyAttackDodge(options);
    },

    clearGratefulTalismanSurvivalOnDamage: function () {
        if (RPG.State.battleState) {
            RPG.State.battleState.gratefulTalismanSurvivalActive = false;
        }
    },

    applyEnemyDirectDamage: function (damage) {
        const normalizedDamage = Math.max(0, Number(damage) || 0);
        this.clearGratefulTalismanSurvivalOnDamage();
        const nextHP = RPG.State.currentHP - normalizedDamage;

        if (
            nextHP <= 0 &&
            (RPG.State.inventory.gratefulTalisman || 0) > 0
        ) {
            RPG.State.inventory.gratefulTalisman -= 1;
            RPG.State.currentHP = 1;
            if (!RPG.State.battleState) RPG.State.battleState = {};
            RPG.State.battleState.gratefulTalismanSurvivalActive = true;
            this.markPlayerTookDamage(normalizedDamage);
            uiControl.addLog("🧧ありがた〜い札が光った！", "marker", "#f1e6c8");
            uiControl.addLog("カインはHP1で踏みとどまった！");
            uiControl.updateUI();
            return { talismanActivated: true, lethal: true };
        }

        RPG.State.currentHP = Math.max(0, nextHP);
        this.markPlayerTookDamage(normalizedDamage);
        return {
            talismanActivated: false,
            lethal: RPG.State.currentHP <= 0
        };
    },

    applyPoisonTick: function () {
        if (!RPG.State.isPoisoned) return false;

        this.clearGratefulTalismanSurvivalOnDamage();
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

    // Build 15.6.x: Vampire-amber / matamatabi conflict. Checked ahead of the normal
    // post-battle matamatabi activation at every battle-end path that would otherwise
    // build/use buildMatamatabiActivationQueue() - reuses the same underlying condition,
    // just gated on the amber also being equipped.
    shouldTriggerVampireAmberMatamatabiAccident: function () {
        return (
            RPG.State.equippedRareAmberId === 'vampireAmber' &&
            this.shouldActivateMatamatabiAfterBattle()
        );
    },

    // Not a one-time event - can recur every time the trigger condition is met. Bypasses
    // all normal victory/defeat bookkeeping (no EXP/gold/drops/kill-count/deathCount, no
    // matamatabi activation) and returns Cain to the inn the same way a real defeat does,
    // minus the parts that shouldn't apply here.
    triggerVampireAmberMatamatabiAccident: function () {
        uiControl.detachRareAmber({ log: false });

        RPG.State.isBattling = false;
        RPG.State.currentEnemy = null;
        RPG.State.battleState = null;
        uiControl.addSeparator();
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            { text: "《マタマタビ》が活性化した。" },
            { text: "吸血琥珀の様子がおかしい。", color: "#cc3333" },
            { text: "カイン「あ……っ！？」" },
            { text: "ドクッ、ドクッ、ドクッ――", color: "#cc3333" },
            {
                text: "カインは、その場に倒れた。",
                action: () => {
                    const logContainer = document.getElementById('logContainer');
                    if (logContainer) logContainer.classList.add('night-mode');
                }
            },
            {
                text: "",
                delay: 3000,
                action: () => {
                    const logContainer = document.getElementById('logContainer');
                    if (logContainer) logContainer.innerHTML = '';
                }
            },
            {
                text: "",
                delay: 1000,
                action: () => {
                    const logContainer = document.getElementById('logContainer');
                    if (logContainer) logContainer.classList.remove('night-mode');
                    innSystem.enterInn(false, { preserveEventMode: true, skipEntryEvents: true });
                    RPG.State.currentHP = Math.floor(RPG.State.maxHP * 0.1);
                    RPG.State.isPoisoned = false;
                    uiControl.updateUI();
                }
            },
            {
                text: "",
                action: () => {
                    RPG.State.mode = "base";
                    uiControl.updateUI();
                }
            }
        ];
        explorationSystem.playDialogueLoop();
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

    // The amber sap (id "sap") is empowered once metThiefBoy is true - not on any fixed
    // post-tree battle count, and not renamed/re-identified as a different enemy. Intentionally
    // independent of postTreeBattles/post_tree_fatigue so it keeps working if their own trigger
    // conditions change later.
    isEmpoweredSap: function (enemy) {
        return !!enemy && enemy.id === "sap" && RPG.State.flags.metThiefBoy === true;
    },

    // Marks only the current distance's root as defeated - the other two sites are untouched.
    // Called from both the Cain/burn victory path (executeStandardVictory) and the Owen instant
    // -kill path (endBattle's !playerWin branch), since either can finish an amber_burning_root.
    markAmberRootDefeated: function (distance) {
        if (!RPG.State.amberRootState) RPG.State.amberRootState = {};
        RPG.State.amberRootState[distance] = "defeated";
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
        const lines = [{ text, type: "ambient" }];
        if (this.isEmpoweredSap(template)) {
            lines.push({ text: sapText.empoweredIntro, type: "ambient" });
        }
        return lines;
    },

    isAmberVariantEncounterUnlocked: function () {
        return (
            RPG.State.flags.metThiefBoy === true &&
            RPG.State.isInDungeon === true &&
            RPG.State.explorationArea === "forest" &&
            RPG.State.location !== "かつての街道"
        );
    },

    isAmberVariantEncounterZone: function () {
        return ["rat", "weasel"].some(baseId => {
            const base = RPG.Assets.ENEMIES.find(e => e.id === baseId);
            return (
                Array.isArray(base && base.area) &&
                RPG.State.currentDistance >= base.area[0] &&
                RPG.State.currentDistance <= base.area[1]
            );
        });
    },

    // Amberized rat/weasel are a separate brood spawned by the amber tree's
    // power, not a rare mutation of the normal beasts, so they roll as an
    // independent candidate rather than replacing a normal draw result.
    rollAmberVariantEncounter: function () {
        if (!this.isAmberVariantEncounterUnlocked() || !this.isAmberVariantEncounterZone()) {
            return null;
        }
        if (Math.random() >= RPG.Config.AMBER_VARIANT_ENCOUNTER_RATE) return null;

        const variantId = Math.random() < 0.5 ? "amber_rat" : "amber_weasel";
        return RPG.Assets.ENEMIES.find(e => e.id === variantId) || null;
    },

    isNotebookAllRandomEncounterExcluded: function (enemyId) {
        const entries = Array.isArray(RPG.Assets.NOTEBOOK_ENTRIES)
            ? RPG.Assets.NOTEBOOK_ENTRIES
            : [];
        const entry = entries.find(candidate => candidate.enemyId === enemyId);
        const allTier = entry && entry.tiers.find(tier => (
            tier.id === "all" &&
            tier.unlockFlag &&
            tier.progressFlag &&
            Number.isFinite(tier.target)
        ));
        if (!allTier || RPG.State.flags[allTier.unlockFlag] !== true) return false;
        return (Number(RPG.State.flags[allTier.progressFlag]) || 0) >= allTier.target;
    },

    incrementNotebookAllProgress: function (enemyId, defeatedBy) {
        if (defeatedBy !== "Cain") return false;
        const entries = Array.isArray(RPG.Assets.NOTEBOOK_ENTRIES)
            ? RPG.Assets.NOTEBOOK_ENTRIES
            : [];
        const entry = entries.find(candidate => candidate.enemyId === enemyId);
        const allTier = entry && entry.tiers.find(tier => (
            tier.id === "all" &&
            tier.unlockFlag &&
            tier.progressFlag &&
            Number.isFinite(tier.target)
        ));
        if (!allTier || RPG.State.flags[allTier.unlockFlag] !== true) return false;

        const currentProgress = Math.max(
            0,
            Number(RPG.State.flags[allTier.progressFlag]) || 0
        );
        if (currentProgress >= allTier.target) return false;
        RPG.State.flags[allTier.progressFlag] = Math.min(
            allTier.target,
            currentProgress + 1
        );
        return true;
    },

    // Keeps sap_source_awareness's threshold in sync with the sap notebook entry's second
    // tier target (currently 15) instead of duplicating the number as a separate hardcoded
    // constant. Looked up by claimedFlag since that name stays stable across target changes.
    getSapSecondTierTarget: function () {
        const entries = Array.isArray(RPG.Assets.NOTEBOOK_ENTRIES)
            ? RPG.Assets.NOTEBOOK_ENTRIES
            : [];
        const sapEntry = entries.find(entry => entry.enemyId === "sap");
        const secondTier = sapEntry && sapEntry.tiers.find(
            tier => tier.claimedFlag === "sapBounty20Received"
        );
        return Number.isFinite(secondTier && secondTier.target) ? secondTier.target : 15;
    },

    getHighwayFixedBattleSpec: function (distance) {
        const specs = {
            2: {
                enemyId: "hell_rat_swarm",
                requiredWins: 2,
                victoryEventIds: ["highway_2m_rats_intro", "highway_2m_rats_interlude"],
                interludeEventId: "highway_2m_rats_interlude"
            },
            4: {
                enemyId: "eye_eating_crow",
                requiredWins: 2,
                victoryEventIds: ["highway_4m_crows_intro", "highway_4m_crows_interlude"],
                interludeEventId: "highway_4m_crows_interlude",
                finishEventId: "highway_4m_crows_outro"
            },
            6: {
                enemyId: "eye_eating_crow",
                requiredWins: 1,
                victoryEventIds: []
            },
            8: {
                enemyId: "hell_rat_swarm",
                requiredWins: 1,
                victoryEventIds: ["highway_8m_escalation"]
            },
            10: {
                enemyId: "amber_husk_giant_larva",
                requiredWins: 1,
                victoryEventIds: ["highway_10m_boss_arrival"]
            }
        };
        return specs[Number(distance)] || null;
    },

    isHighwayBattleContext: function () {
        return (
            RPG.State.storyPhase === 9 &&
            RPG.State.flags.onWagon === true &&
            (
                RPG.State.explorationArea === "highway" ||
                RPG.State.location === "かつての街道"
            )
        );
    },

    startHighwayFixedBattle: function (distance, enemyId, options = {}) {
        const spec = this.getHighwayFixedBattleSpec(distance);
        if (!spec || spec.enemyId !== enemyId) return;
        this.startBattle(enemyId, {
            ...options,
            highwayFixedDistance: Number(distance)
        });
    },

    recordHighwayFixedBattleVictory: function (enemyId) {
        const battleState = RPG.State.battleState;
        const distance = Number(battleState?.highwayFixedDistance);
        const spec = this.getHighwayFixedBattleSpec(distance);
        if (
            !battleState ||
            battleState.highwayFixedVictoryRecorded === true ||
            !this.isHighwayBattleContext() ||
            !spec ||
            spec.enemyId !== enemyId
        ) {
            return { handled: false, postBattleEventId: null };
        }

        battleState.highwayFixedVictoryRecorded = true;
        if (!RPG.State.highwayBattleCount || typeof RPG.State.highwayBattleCount !== "object") {
            RPG.State.highwayBattleCount = {};
        }
        if (!Array.isArray(RPG.State.completedEvents)) {
            RPG.State.completedEvents = [];
        }

        const previousWins = Math.max(
            0,
            Math.min(spec.requiredWins, Number(RPG.State.highwayBattleCount[distance]) || 0)
        );
        const completedWins = Math.min(spec.requiredWins, previousWins + 1);
        RPG.State.highwayBattleCount[distance] = completedWins;

        const completedBattleEventId = spec.victoryEventIds[previousWins];
        if (
            completedBattleEventId &&
            !RPG.State.completedEvents.includes(completedBattleEventId)
        ) {
            RPG.State.completedEvents.push(completedBattleEventId);
        }

        let postBattleEventId = null;
        let completePostBattleEvent = false;
        if (completedWins < spec.requiredWins) {
            postBattleEventId = spec.interludeEventId || null;
        } else if (spec.finishEventId) {
            postBattleEventId = spec.finishEventId;
            completePostBattleEvent = true;
        }

        return {
            handled: true,
            distance,
            completedWins,
            postBattleEventId,
            completePostBattleEvent
        };
    },

    buildHighwayPostBattleQueue: function (victoryResult) {
        if (!victoryResult?.postBattleEventId) return [];
        const event = RPG.Assets.EVENT_DATA.find(
            candidate => candidate.id === victoryResult.postBattleEventId
        );
        if (!event) return [];

        RPG.State.dialogueQueue = [];
        event.action(RPG.State);
        const queue = Array.isArray(RPG.State.dialogueQueue)
            ? [...RPG.State.dialogueQueue]
            : [];

        if (
            victoryResult.completePostBattleEvent === true &&
            !RPG.State.completedEvents.includes(event.id)
        ) {
            RPG.State.completedEvents.push(event.id);
        }
        return queue;
    },

    startBattle: function (enemyId = null, options = {}) {
        if (RPG.State.flags.chapter1Cleared === true) return false;
        const isRandomEncounter =
            enemyId === null ||
            options.randomEncounter === true;
        const pendingMoveEligibility =
            typeof explorationSystem !== "undefined" &&
            typeof explorationSystem.consumeMikawashiMoveBattleEligibility === "function"
                ? explorationSystem.consumeMikawashiMoveBattleEligibility()
                : false;
        const hasExplicitMikawashiState = Object.prototype.hasOwnProperty.call(
            options,
            "mikawashiEvasionActive"
        );
        const mikawashiEvasionActive = hasExplicitMikawashiState
            ? options.mikawashiEvasionActive === true
            : (
                pendingMoveEligibility ||
                Math.max(0, Number(RPG.State.mikawashiStepsRemaining) || 0) > 0
            );
        const highwayFixedDistance = Number.isFinite(Number(options.highwayFixedDistance))
            ? Number(options.highwayFixedDistance)
            : null;

        // Enemy Selection logic remains in engine as it processes data
        let template = null;
        if (enemyId) {
            template = RPG.Assets.ENEMIES.find(e => e.id === enemyId);
            if (template && template.id === "glowing_cat_rabbit") {
                template = this.prepareGlowingCatRabbitTemplate(template);
                if (!template) {
                    uiControl.addLog("光る猫うさぎの気配はまだ現れない。");
                    return false;
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
            template = this.rollAmberVariantEncounter();
        }

        if (!template) {
            const candidates = RPG.Assets.ENEMIES.filter(e =>
                e.area && // Build 12.0.6: Safety check
                RPG.State.currentDistance >= e.area[0] &&
                RPG.State.currentDistance <= e.area[1]
            );
            if (candidates.length === 0) return false;

            // In the post-thief-boy 7m-9m depths, sap draws a heavier weight than its normal 5
            // so it is easier to find without excluding the other normal candidates.
            const useDeepForestSapWeight = explorationSystem.isDeepForestPostThiefBoyZone();
            const getEncounterWeight = enemy => (
                useDeepForestSapWeight && enemy.id === "sap"
                    ? RPG.Config.DEEP_FOREST_POST_THIEF_BOY_SAP_WEIGHT
                    : enemy.weight
            );

            const totalWeight = candidates.reduce((sum, e) => sum + getEncounterWeight(e), 0);
            let random = Math.random() * totalWeight;
            template = candidates[0];

            for (const e of candidates) {
                random -= getEncounterWeight(e);
                if (random < 0) {
                    template = e;
                    break;
                }
            }
        }

        if (
            isRandomEncounter &&
            this.isNotebookAllRandomEncounterExcluded(template && template.id)
        ) {
            uiControl.updateUI();
            return false;
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
                        this.beginBattle(template, {
                            mikawashiEvasionActive,
                            highwayFixedDistance
                        });
                    }
                }
            ];
            explorationSystem.playDialogueLoop();
            return true;
        }

        this.beginBattle(template, {
            mikawashiEvasionActive,
            highwayFixedDistance
        });
        return true;
    },

    unlockNotebookEntryForEncounter: function (enemyId) {
        const entries = Array.isArray(RPG.Assets.NOTEBOOK_ENTRIES)
            ? RPG.Assets.NOTEBOOK_ENTRIES
            : [];
        const entry = entries.find(candidate => candidate.enemyId === enemyId);
        if (!entry || !entry.encounterFlag) return false;
        if (RPG.State.flags[entry.encounterFlag] === true) return false;
        RPG.State.flags[entry.encounterFlag] = true;
        return true;
    },

    beginBattle: function (template, options = {}) {
        this.unlockNotebookEntryForEncounter(template && template.id);
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
        if (this.isEmpoweredSap(RPG.State.currentEnemy)) {
            RPG.State.currentEnemy.atk = Math.round(
                template.atk * RPG.Config.EMPOWERED_SAP_ATK_MULTIPLIER
            );
        }
        // Build 9.0.0: Battle State container
        const usesNightMedicineEvasion =
            (RPG.State.nightMedicineEvasionBattlesRemaining || 0) > 0 &&
            !(template.id === "glowing_cat_rabbit" && template.rabbitLevel === 88);
        const usesMikawashiEvasion =
            options.mikawashiEvasionActive === true &&
            !(template.id === "glowing_cat_rabbit" && template.rabbitLevel === 88);
        RPG.State.battleState = {
            skippedTurns: 0,
            playerTookDamage: false,
            nightMedicineEvasionActive: usesNightMedicineEvasion,
            mikawashiEvasionActive: usesMikawashiEvasion,
            gratefulTalismanSurvivalActive: false,
            highwayFixedDistance: Number.isFinite(options.highwayFixedDistance)
                ? options.highwayFixedDistance
                : null,
            highwayFixedVictoryRecorded: false
        };
        if (usesNightMedicineEvasion) {
            RPG.State.nightMedicineEvasionBattlesRemaining--;
        }
        RPG.State.lastBlowBy = null;
        RPG.State.battleTurn = 1;
        RPG.State.hasOwenIntervened = false;
        RPG.State.hasOwenSavedLife = false;

        this.applyVampireAmberBattleStart(template, () => this.continueBattleStart());
    },

    continueBattleStart: function () {
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

    getVampireAmberPendingTalkStages: function () {
        const stages = Array.isArray(RPG.State.flags.vampireAmberPendingTalkStages)
            ? RPG.State.flags.vampireAmberPendingTalkStages
            : [];
        return stages.filter((stage, index) => (
            (stage === 1 || stage === 2) &&
            stages.indexOf(stage) === index
        ));
    },

    queueVampireAmberTalkStage: function (stage) {
        const seenFlag = stage === 1
            ? "vampireAmberStage1TalkSeen"
            : stage === 2
                ? "vampireAmberStage2TalkSeen"
                : null;
        if (!seenFlag || RPG.State.flags[seenFlag] === true) return;

        const pendingStages = this.getVampireAmberPendingTalkStages();
        if (!pendingStages.includes(stage)) pendingStages.push(stage);
        RPG.State.flags.vampireAmberPendingTalkStages = pendingStages;
    },

    clearVampireAmberTalkStage: function (stage) {
        RPG.State.flags.vampireAmberPendingTalkStages =
            this.getVampireAmberPendingTalkStages().filter(candidate => candidate !== stage);
    },

    buildVampireAmberPostBattleTalkQueue: function () {
        if (!RPG.State.battleState?.vampireAmberDamageMultiplier) return [];

        return this.getVampireAmberPendingTalkStages().flatMap(stage => {
            if (stage === 1 && RPG.State.flags.vampireAmberStage1TalkSeen !== true) {
                return [
                    { text: "オーエン「おまえ、そういうの好きなの？」", color: "#a020f0" },
                    { text: "カイン「何がだ」" },
                    { text: "オーエン「血を吸われるの」", color: "#a020f0" },
                    {
                        text: "カイン「好きじゃない。必要な時以外はなるべく使いたくないな」",
                        action: () => {
                            RPG.State.flags.vampireAmberStage1TalkSeen = true;
                            this.clearVampireAmberTalkStage(1);
                        }
                    }
                ];
            }
            if (stage === 2 && RPG.State.flags.vampireAmberStage2TalkSeen !== true) {
                return [
                    { text: "カイン（まずい、クラクラしてきた）" },
                    {
                        text: "オーエン「……もうやめたら？」",
                        color: "#a020f0",
                        action: () => {
                            RPG.State.flags.vampireAmberStage2TalkSeen = true;
                            this.clearVampireAmberTalkStage(2);
                        }
                    }
                ];
            }
            this.clearVampireAmberTalkStage(stage);
            return [];
        });
    },

    getPendingBattleCountEvents: function () {
        const pendingEvents = Array.isArray(RPG.State.flags.pendingBattleCountEvents)
            ? RPG.State.flags.pendingBattleCountEvents
            : [];
        const uniqueKeys = new Set();
        return pendingEvents.filter(event => {
            const enemyId = typeof event?.enemyId === "string" ? event.enemyId : "";
            const count = Number(event?.count);
            const key = `${enemyId}:${count}`;
            if (
                !enemyId ||
                !Number.isInteger(count) ||
                count < 1 ||
                uniqueKeys.has(key)
            ) {
                return false;
            }
            uniqueKeys.add(key);
            return true;
        }).map(event => ({
            enemyId: event.enemyId,
            count: Number(event.count)
        }));
    },

    deferBattleCountEvent: function (enemyId, count) {
        const pendingEvents = this.getPendingBattleCountEvents();
        if (!pendingEvents.some(event => event.enemyId === enemyId && event.count === count)) {
            pendingEvents.push({ enemyId, count });
        }
        RPG.State.flags.pendingBattleCountEvents = pendingEvents;
    },

    clearPendingBattleCountEvent: function (enemyId, count) {
        RPG.State.flags.pendingBattleCountEvents =
            this.getPendingBattleCountEvents().filter(event => (
                event.enemyId !== enemyId || event.count !== count
            ));
    },

    buildPendingBattleCountEventQueue: function (enemyId) {
        return this.getPendingBattleCountEvents()
            .filter(event => event.enemyId === enemyId)
            .sort((left, right) => left.count - right.count)
            .flatMap(event => {
                const eventDialogues = RPG.Assets.BATTLE_EVENTS[enemyId]?.[event.count];
                if (!Array.isArray(eventDialogues)) {
                    this.clearPendingBattleCountEvent(enemyId, event.count);
                    return [];
                }
                return [
                    ...eventDialogues.map(line => ({ ...line })),
                    {
                        text: null,
                        action: () => {
                            this.clearPendingBattleCountEvent(enemyId, event.count);
                        }
                    }
                ];
            });
    },

    // Build 15.6.x: Vampire-amber battle-start hook - HP drain (battles 1/4/6 only),
    // post-battle talk reservation, and the per-battle Cain-only damage multiplier
    // (read later by applyCainDamage). Fully excluded for glowing_cat_rabbit, which
    // runs its own hit-counter minigame.
    applyVampireAmberBattleStart: function (template, next) {
        if (template.id === 'glowing_cat_rabbit' || RPG.State.equippedRareAmberId !== 'vampireAmber') {
            next();
            return;
        }

        const battleNumber = (RPG.State.flags.vampireAmberChainBattleCount || 0) + 1;
        const damageMultiplier = battleNumber === 6 ? 2 : 1.5;
        RPG.State.battleState.vampireAmberDamageMultiplier = damageMultiplier;

        if (battleNumber === 1) this.queueVampireAmberTalkStage(1);
        if (battleNumber === 4) this.queueVampireAmberTalkStage(2);

        const drainRate = battleNumber === 1 ? 0.10 : battleNumber === 4 ? 0.15 : battleNumber === 6 ? 0.20 : null;
        if (drainRate !== null) {
            const rawDrain = Math.ceil(RPG.State.maxHP * drainRate);
            const maxDrain = Math.max(0, RPG.State.currentHP - 1);
            const actualDrain = Math.min(rawDrain, maxDrain);
            RPG.State.currentHP -= actualDrain;
            uiControl.addLog("《吸血琥珀》がカインの血を吸った！", "marker", "#cc3333");
        }

        uiControl.addLog(
            `《吸血琥珀》の力で、カインの攻撃力が${damageMultiplier}倍になった！`,
            "marker",
            "#cc3333"
        );
        uiControl.updateUI();
        next();
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
                    uiControl.addLog(`${RPG.State.currentEnemy.name}は氷の鎖に縛られて動けない！`, "");
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
                    uiControl.addLog(`${RPG.State.currentEnemy.name}は氷の鎖に縛られて動けない！`, "");
                    // A frozen enemy never reaches enemyTurn()/BATTLE_AI.execute() this turn, so
                    // give any custom AI a chance to still act on the skipped turn (e.g. the
                    // amber_burning_root's self-burn damage keeps ticking while frozen).
                    const enemyAI = RPG.Assets.BATTLE_AI[RPG.State.currentEnemy.id];
                    if (enemyAI && typeof enemyAI.onSkippedTurn === "function") {
                        enemyAI.onSkippedTurn(this);
                    }
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
        const isInnRatEventBattle =
            RPG.State.currentEnemy &&
            (
                RPG.State.currentEnemy.id === 'normal_rat' ||
                (
                    RPG.State.currentEnemy.id === 'rat' &&
                    RPG.State.flags.innRatEvent2BattleActive === true
                )
            );
        if (
            isInnRatEventBattle ||
            (RPG.State.currentEnemy && RPG.State.currentEnemy.id === 'giant_larva')
        ) {
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
                if (
                    RPG.State.flags.matamatabiActive === true &&
                    RPG.State.currentEnemy &&
                    RPG.State.currentEnemy.id === "weasel"
                ) {
                    uiControl.addLog("オーエンはイタチを遠くへ吹き飛ばした！", "", "#a333c8");
                    uiControl.addLog("魔界のイタチは逃げ出した！", "");
                    const escapeDelay = RPG.State.debug.isSkipping ? 50 : 1500;
                    setTimeout(() => this.endWeaselEscapeBattle(), escapeDelay);
                    return;
                }
                const isSilentMatamatabiKill =
                    RPG.State.flags.matamatabiActive === true &&
                    (!RPG.State.currentEnemy || RPG.State.currentEnemy.id !== "glowing_cat_rabbit");
                if (!isSilentMatamatabiKill) {
                    uiControl.addLog(
                        RPG.Assets.BATTLE_TEXT.owen.kill[Math.floor(Math.random() * RPG.Assets.BATTLE_TEXT.owen.kill.length)],
                        "",
                        "#a333c8"
                    );
                }
                if (RPG.State.currentEnemy && RPG.State.currentEnemy.id === "glowing_cat_rabbit") {
                    uiControl.addLog(`透明な狼が${RPG.State.currentEnemy.name}へ襲いかかった！`, "");
                    uiControl.addLog(RPG.Assets.BATTLE_TEXT.glowing_cat_rabbit.killImmune, "", "#ffffaa");
                    delay = 1200;
                } else {
                    RPG.State.currentEnemy.hp = 0;
                    RPG.State.lastBlowBy = "Owen";
                    uiControl.addLog(`透明な狼が${RPG.State.currentEnemy.name}を呑み込んだ！`, "");
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
                uiControl.addLog(`氷の鎖が${RPG.State.currentEnemy.name}を縛りつけた！`, "");
                uiControl.addLog(`${RPG.State.currentEnemy.name}は動けない！`, "");
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

        const vampireAmberMultiplier = RPG.State.battleState?.vampireAmberDamageMultiplier;
        if (vampireAmberMultiplier) {
            damage = Math.floor(damage * vampireAmberMultiplier);
        }

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

        if (this.tryEnemyAttackDodge({ allowNormalEvasion: true })) {
            const delay = RPG.State.debug.isSkipping ? 50 : 1000;
            setTimeout(onComplete, delay);
            return;
        }

        let dmg = RPG.State.currentEnemy.atk;
        let msg = RPG.State.currentEnemy.msg || "攻撃してきた！";
        if (RPG.State.currentEnemy.id === "weasel") {
            msg = (RPG.State.battleTurn === 1) ? "目にも止まらぬ速さで先制攻撃！" : "カマで切り付けてきた";
        }

        uiControl.addLog(
            `${RPG.State.currentEnemy.name}が${msg} カインは${dmg}のダメージ！`,
            "enemy-action"
        );

        const hpBeforeAttack = RPG.State.currentHP;
        const damageResult = this.applyEnemyDirectDamage(dmg);
        this.applyEmpoweredSapDrain(Math.max(0, hpBeforeAttack - RPG.State.currentHP));

        if (damageResult.talismanActivated) {
            const delay = RPG.State.debug.isSkipping ? 50 : 1000;
            setTimeout(onComplete, delay);
            return;
        }

        if (damageResult.lethal && !RPG.State.hasOwenSavedLife) {
            RPG.State.hasOwenSavedLife = true;
            uiControl.addLog(RPG.Assets.BATTLE_TEXT.owen.intimidation, "", "#a333c8");
            uiControl.addLog(RPG.Assets.BATTLE_TEXT.owen.intimidationEffect, "", "#ffff00");
            RPG.State.currentHP = 1;
            uiControl.updateUI();
            const delay = RPG.State.debug.isSkipping ? 50 : 1500;
            setTimeout(() => this.endBattle(false, true), delay);
            return;
        }

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

    // Only the empowered (post-thief-boy) amber sap drains HP from a landed hit. Heals by
    // exactly the HP Cain actually lost this hit (never the nominal attack value, and never
    // beyond the enemy's own max HP), and stays silent when nothing was actually healed.
    applyEmpoweredSapDrain: function (actualDamage) {
        const enemy = RPG.State.currentEnemy;
        if (!RPG.State.isBattling || !this.isEmpoweredSap(enemy)) return;
        if (!Number.isFinite(actualDamage) || actualDamage <= 0) return;
        if (!Number.isFinite(enemy.hp) || !Number.isFinite(enemy.maxHp)) return;

        const healAmount = Math.min(actualDamage, Math.max(0, enemy.maxHp - enemy.hp));
        if (healAmount <= 0) return;

        enemy.hp += healAmount;
        uiControl.addLog(
            `${enemy.name}はカインのHPを吸収し、HPが${healAmount}回復した！`,
            "enemy-action"
        );
        uiControl.updateUI();
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
            uiControl.addLog(`${enemy.name}は氷の鎖に縛られて動けない！`, "");
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
        if (this.shouldTriggerVampireAmberMatamatabiAccident()) {
            this.triggerVampireAmberMatamatabiAccident();
            return;
        }

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

    // Build 15.5.1: Weasel scared off while matamatabi is active - not a real kill,
    // so this bypasses endBattle()/executeStandardVictory() entirely (no defeatCounts/EXP/drop).
    endWeaselEscapeBattle: function () {
        this.advanceHerbGardenHarvestCooldowns();
        uiControl.addSeparator();
        uiControl.advanceVampireAmberChainOnBattleEnd();

        RPG.State.isBattling = false;
        RPG.State.currentEnemy = null;
        RPG.State.battleState = null;

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
        if (!isPreemptive && this.tryEnemyAttackDodge({ allowNormalEvasion: true })) {
            const delay = RPG.State.debug.isSkipping ? 50 : 1000;
            setTimeout(() => this.runBattleLoop(), delay);
            return;
        }

        let dmg = RPG.State.currentEnemy.atk;
        let msg = RPG.State.currentEnemy.msg || "攻撃してきた！";
        // Build 6.3.2: Weasel Logic (Specific case kept inline for simplicity as it's minor)
        if (RPG.State.currentEnemy.id === "weasel") {
            msg = (RPG.State.battleTurn === 1) ? "目にも止まらぬ速さで先制攻撃！" : "カマで切り付けてきた";
        }

        uiControl.addLog(
            `${RPG.State.currentEnemy.name}が${msg} カインは${dmg}のダメージ！`,
            "enemy-action"
        );

        const damageResult = this.applyEnemyDirectDamage(dmg);
        if (damageResult.talismanActivated) {
            const delay = RPG.State.debug.isSkipping ? 50 : 1000;
            setTimeout(() => this.runBattleLoop(), delay);
            return;
        }

        // Death Save
        if (damageResult.lethal && !RPG.State.hasOwenSavedLife) {
            RPG.State.hasOwenSavedLife = true;
            uiControl.addLog(RPG.Assets.BATTLE_TEXT.owen.intimidation, "", "#a333c8");
            uiControl.addLog(RPG.Assets.BATTLE_TEXT.owen.intimidationEffect, "", "#ffff00");
            RPG.State.currentHP = 1;
            uiControl.updateUI();
            const delay = RPG.State.debug.isSkipping ? 50 : 1500;
            setTimeout(() => this.endBattle(false, true), delay);
            return;
        }

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
        if (
            RPG.State.currentHP >= 2 &&
            RPG.State.battleState?.gratefulTalismanSurvivalActive === true
        ) {
            RPG.State.battleState.gratefulTalismanSurvivalActive = false;
        }
        if (RPG.State.currentHP <= 1) {
            if (
                RPG.State.currentHP === 1 &&
                RPG.State.battleState?.gratefulTalismanSurvivalActive === true
            ) {
                return false;
            }
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

        // On the highway, Owen's one-time rescue must not let a mandatory
        // encounter be skipped. Treat that escape as the same retry state as
        // any other defeat, while preserving the legacy rescue elsewhere.
        if (isDeathSave && this.isHighwayBattleContext()) {
            if (typeof explorationSystem !== "undefined") {
                explorationSystem.clearTemporaryItemEffects();
            }
            this.resolveHighwayDefeat();
            return;
        }

        // Giant Larva Death Spasm
        // Giant Larva Death Spasm (Cinematic)
        if (RPG.State.currentEnemy.id === 'giant_larva' && playerWin) {
            Cinematics.playGiantLarvaDeath(this, enemyId);
            return;
        }

        const matamatabiActivationQueue = this.buildMatamatabiActivationQueue();
        let vampireAmberTalkQueue = [];
        let hasPostBattleEvent = false;
        let postBattleStarted = false;
        let highwayPostBattleQueue = [];

        if (isDeathSave) {
            if (this.shouldTriggerVampireAmberMatamatabiAccident()) {
                this.triggerVampireAmberMatamatabiAccident();
                return;
            }

            uiControl.addLog("戦闘から離脱した。");
            if (matamatabiActivationQueue.length > 0) {
                hasPostBattleEvent = true;
            }
        } else if (!playerWin) {
            if (this.shouldTriggerVampireAmberMatamatabiAccident()) {
                this.triggerVampireAmberMatamatabiAccident();
                return;
            }

            if (typeof visualDirector !== "undefined") {
                visualDirector.playBattleCue("enemy-defeated");
            }
            RPG.State.defeatCounts[enemyId].owen++;
            uiControl.addLog(`${RPG.State.currentEnemy.name}は跡形もなく消えた。`);
            if (enemyId === "amber_burning_root") {
                uiControl.addLog("燃える琥珀樹の根は焼け落ちた。");
                this.markAmberRootDefeated(RPG.State.currentDistance);
            }
            this.grantGuaranteedEnemyDrop();
            vampireAmberTalkQueue = this.buildVampireAmberPostBattleTalkQueue();
            uiControl.advanceVampireAmberChainOnBattleEnd();
            const highwayVictory = this.recordHighwayFixedBattleVictory(enemyId);
            highwayPostBattleQueue = this.buildHighwayPostBattleQueue(highwayVictory);
            if (highwayPostBattleQueue.length > 0) {
                hasPostBattleEvent = true;
            } else if (highwayVictory.handled) {
                const defeatedEnemy = RPG.Assets.ENEMIES.find(enemy => enemy.id === enemyId);
                if (defeatedEnemy?.onDeathEvent) {
                    const victoryEvent = RPG.Assets.EVENT_DATA.find(
                        event => event.id === defeatedEnemy.onDeathEvent
                    );
                    if (victoryEvent) {
                        victoryEvent.action(RPG.State);
                        hasPostBattleEvent = true;
                        postBattleStarted = true;
                    }
                }
            }
            if (matamatabiActivationQueue.length > 0) {
                hasPostBattleEvent = true;
            }
            if (vampireAmberTalkQueue.length > 0 && !hasPostBattleEvent) {
                hasPostBattleEvent = true;
            }
        } else {
            this.executeStandardVictory(enemyId);
            return;
        }

        RPG.State.isBattling = false;
        RPG.State.currentEnemy = null;
        RPG.State.battleState = null;

        if (postBattleStarted) {
            return;
        }

        if (hasPostBattleEvent) {
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                ...highwayPostBattleQueue,
                ...(highwayPostBattleQueue.length === 0 ? vampireAmberTalkQueue : []),
                ...matamatabiActivationQueue
            ];
            uiControl.updateUI();
            explorationSystem.playDialogueLoop();
            return;
        }

        RPG.State.mode = "base";
        uiControl.updateUI();
    },

    executeStandardVictory: function (enemyId) {
        if (this.shouldTriggerVampireAmberMatamatabiAccident()) {
            this.triggerVampireAmberMatamatabiAccident();
            return;
        }

        // Build 15.1.8: Lock UI IMMEDIATELY to prevent Race Condition
        RPG.State.mode = "event";
        if (typeof visualDirector !== "undefined") {
            visualDirector.playBattleCue("enemy-defeated");
        }
        // Victory text ownership rule:
        // - Common defeat/victory lines such as "〇〇を倒した！" or "〇〇は跡形もなく消えた。" are emitted ONLY here.
        // - Post-battle BATTLE_EVENTS / onDeathEvent handlers must not repeat those generic victory lines.
        //   They are reserved for boss-specific aftermath, cinematics, and dialogue only.

        if (enemyId === 'hungry_amber_tree' && RPG.State.lastBlowBy === "Cain") {
            uiControl.addLog("最後の一撃！");
            uiControl.addLog("カインの剣が、骸の腹部にめりこんだ！");
            uiControl.addLog("グシャッ");
            uiControl.addLog("空っぽの人体を砕くような、嫌な手応え。飢えた触手樹は動かなくなった。");
        }

        // Fires for both a Cain finishing blow and a self-burn kill (lastBlowBy stays unset for
        // the latter, so this is intentionally not gated on lastBlowBy).
        if (enemyId === 'amber_burning_root') {
            uiControl.addLog("燃える琥珀樹の根は焼け落ちた。");
            this.markAmberRootDefeated(RPG.State.currentDistance);
        }

        if (RPG.State.lastBlowBy === "Owen") {
            RPG.State.defeatCounts[enemyId].owen++;
            uiControl.addLog(`${RPG.State.currentEnemy.name}は跡形もなく消えた。`);
        } else {
            RPG.State.defeatCounts[enemyId].cain++;
            uiControl.addLog(`${RPG.State.currentEnemy.name}を倒した！`);
        }
        this.incrementNotebookAllProgress(enemyId, RPG.State.lastBlowBy);

        this.grantGuaranteedEnemyDrop();
        const highwayVictory = this.recordHighwayFixedBattleVictory(enemyId);

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

        // Build 15.5.7: Ordinary-battle pacing gates for inn rat event 2 and the innkeeper repair
        // consult. Each gate must exclude the scripted inn rat battle that unlocked it, so a
        // separate later battle is genuinely required (not the same win that set innRatEvent/2).
        if (
            RPG.State.flags.innRatEvent === true &&
            RPG.State.flags.innRatEvent2 !== true &&
            RPG.State.flags.ratEvent2BattleFought !== true &&
            enemyId !== 'normal_rat'
        ) {
            RPG.State.flags.ratEvent2BattleFought = true;
        }

        if (
            RPG.State.flags.innRatEvent2 === true &&
            RPG.State.flags.innRepairConsultSeen !== true &&
            RPG.State.flags.repairConsultBattleFought !== true &&
            RPG.State.flags.innRatEvent2BattleActive !== true
        ) {
            RPG.State.flags.repairConsultBattleFought = true;
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
        const vampireAmberTalkQueue = this.buildVampireAmberPostBattleTalkQueue();
        const pendingCountEvents = this.getPendingBattleCountEvents()
            .filter(event => event.enemyId === enemyId);
        const pendingCountEventQueue = this.buildPendingBattleCountEventQueue(enemyId);
        const currentCountEvent = RPG.Assets.BATTLE_EVENTS[enemyId]?.[count];
        const currentCountEventAlreadyPending = pendingCountEvents.some(
            event => event.count === count
        );
        const currentCountEventQueue =
            Array.isArray(currentCountEvent) && !currentCountEventAlreadyPending
                ? currentCountEvent.map(line => ({ ...line }))
                : [];
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

        if (
            !hasPostBattleEvent &&
            highwayVictory.handled &&
            highwayVictory.postBattleEventId
        ) {
            const eventDialogues = this.buildHighwayPostBattleQueue(highwayVictory);
            uiControl.addLog("---");
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                ...levelUpTalkQueue,
                ...eventDialogues,
                ...matamatabiActivationQueue
            ];
            explorationSystem.playDialogueLoop();
            hasPostBattleEvent = true;
        }

        if (
            !hasPostBattleEvent &&
            !highwayVictory.handled &&
            (
                pendingCountEventQueue.length > 0 ||
                currentCountEventQueue.length > 0
            )
        ) {
            if (vampireAmberTalkQueue.length > 0) {
                if (currentCountEventQueue.length > 0) {
                    this.deferBattleCountEvent(enemyId, count);
                }
                uiControl.addLog("---");
                RPG.State.mode = "event";
                RPG.State.dialogueQueue = [
                    ...levelUpTalkQueue,
                    ...vampireAmberTalkQueue,
                    ...matamatabiActivationQueue
                ];
                explorationSystem.playDialogueLoop();
                hasPostBattleEvent = true;
            } else {
                const eventDialogues = [
                    ...pendingCountEventQueue,
                    ...currentCountEventQueue
                ];
                uiControl.addLog("---");
                RPG.State.mode = "event";
                RPG.State.dialogueQueue = [
                    ...levelUpTalkQueue,
                    ...eventDialogues,
                    ...matamatabiActivationQueue
                ];
                explorationSystem.playDialogueLoop();
                hasPostBattleEvent = true;
            }
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

        if (!hasPostBattleEvent && vampireAmberTalkQueue.length > 0) {
            uiControl.addLog("---");
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                ...levelUpTalkQueue,
                ...vampireAmberTalkQueue,
                ...matamatabiActivationQueue
            ];
            explorationSystem.playDialogueLoop();
            hasPostBattleEvent = true;
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

        // Amber sap source awareness: deliberately checked last (lowest priority) so it never
        // preempts post_tree_fatigue or any other post-battle event above. If it loses the slot
        // this battle, the flag stays unset and the same check re-runs on the next sap victory.
        const sapDefeatCount = RPG.State.defeatCounts.sap
            ? (RPG.State.defeatCounts.sap.cain + RPG.State.defeatCounts.sap.owen)
            : 0;
        if (
            !hasPostBattleEvent &&
            enemyId === "sap" &&
            RPG.State.flags.treeDefeated === true &&
            RPG.State.flags.amberTreeCoinMined === true &&
            sapDefeatCount >= this.getSapSecondTierTarget() &&
            RPG.State.flags.sapSourceAwarenessSeen !== true
        ) {
            const sapSourceEvent = RPG.Assets.EVENT_DATA.find(e => e.id === "sap_source_awareness");
            if (sapSourceEvent) {
                sapSourceEvent.action(RPG.State);
                RPG.State.mode = "event";
                explorationSystem.playDialogueLoop();
                hasPostBattleEvent = true;
            }
        }

        // Amberized beast conversations: same lowest-priority pattern as sap source awareness
        // above - checked last, gated on !hasPostBattleEvent, and each flag only set once its
        // own dialogue actually wins the slot. If it loses, it stays unset and re-evaluates on
        // the next matching victory. amber_rat's equipped-talk is checked ahead of its
        // three-kill talk so both cannot fire in the same battle.
        const amberRatDefeatCount = RPG.State.defeatCounts.amber_rat
            ? (RPG.State.defeatCounts.amber_rat.cain + RPG.State.defeatCounts.amber_rat.owen)
            : 0;
        const amberWeaselDefeatCount = RPG.State.defeatCounts.amber_weasel
            ? (RPG.State.defeatCounts.amber_weasel.cain + RPG.State.defeatCounts.amber_weasel.owen)
            : 0;

        if (
            !hasPostBattleEvent &&
            enemyId === "amber_rat" &&
            amberRatDefeatCount >= 1 &&
            RPG.State.equippedRareAmberId !== null &&
            RPG.State.flags.amberRatEquippedTalkSeen !== true
        ) {
            const amberRatEquippedEvent = RPG.Assets.EVENT_DATA.find(e => e.id === "amber_rat_equipped_talk");
            if (amberRatEquippedEvent) {
                amberRatEquippedEvent.action(RPG.State);
                RPG.State.mode = "event";
                explorationSystem.playDialogueLoop();
                hasPostBattleEvent = true;
            }
        }

        if (
            !hasPostBattleEvent &&
            enemyId === "amber_rat" &&
            amberRatDefeatCount >= 3 &&
            RPG.State.flags.amberRatThreeKillTalkSeen !== true
        ) {
            const amberRatThreeKillEvent = RPG.Assets.EVENT_DATA.find(e => e.id === "amber_rat_three_kill_talk");
            if (amberRatThreeKillEvent) {
                amberRatThreeKillEvent.action(RPG.State);
                RPG.State.mode = "event";
                explorationSystem.playDialogueLoop();
                hasPostBattleEvent = true;
            }
        }

        if (
            !hasPostBattleEvent &&
            enemyId === "amber_weasel" &&
            amberWeaselDefeatCount >= 1 &&
            RPG.State.flags.amberWeaselFirstKillTalkSeen !== true
        ) {
            const amberWeaselFirstKillEvent = RPG.Assets.EVENT_DATA.find(e => e.id === "amber_weasel_first_kill_talk");
            if (amberWeaselFirstKillEvent) {
                amberWeaselFirstKillEvent.action(RPG.State);
                RPG.State.mode = "event";
                explorationSystem.playDialogueLoop();
                hasPostBattleEvent = true;
            }
        }

        uiControl.advanceVampireAmberChainOnBattleEnd();

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

    resolveHighwayDefeat: function () {
        uiControl.addLog(RPG.Assets.GAME_TEXT.battle.cainDefeated);

        RPG.State.currentHP = RPG.State.maxHP;
        RPG.State.isPoisoned = false;
        RPG.State.poisonDamageRemaining = 0;
        RPG.State.isBattling = false;
        RPG.State.currentEnemy = null;
        RPG.State.battleState = null;
        RPG.State.lastBlowBy = null;
        RPG.State.battleTurn = 0;
        RPG.State.hasOwenIntervened = false;
        RPG.State.hasOwenSavedLife = false;

        if (!Array.isArray(RPG.State.completedEvents)) {
            RPG.State.completedEvents = [];
        }
        if (!RPG.State.completedEvents.includes("phase8_wagon_journey_completed")) {
            RPG.State.completedEvents.push("phase8_wagon_journey_completed");
        }

        RPG.State.storyPhase = 7;
        RPG.State.flags.onWagon = false;
        RPG.State.isAtInn = false;
        RPG.State.isInDungeon = false;
        RPG.State.explorationArea = null;
        RPG.State.location = "宿屋前";
        RPG.State.currentDistance = 0;
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            { text: "荷馬車は琥珀亭まで引き返した。", type: "marker" }
        ];

        uiControl.updateUI();
        explorationSystem.playDialogueLoop();
    },

    finalizeStandardDefeat: function (defeatedEnemyId = null) {
        uiControl.addLog(RPG.Assets.GAME_TEXT.battle.cainDefeated);
        RPG.State.flags.innRatEvent2BattleActive = false;

        // Build 15.6.x: A defeat on what would have been the 6th vampire-amber chain battle
        // still forces the removal, just without the conscious "もぎ取った！" line (Cain is out cold).
        const vampireAmberRemoved =
            RPG.State.equippedRareAmberId === 'vampireAmber' &&
            (RPG.State.flags.vampireAmberChainBattleCount || 0) === 5;
        if (vampireAmberRemoved) {
            uiControl.detachRareAmber({ log: false });
        }
        uiControl.resetVampireAmberChain();

        RPG.State.isBattling = false;
        RPG.State.currentEnemy = null;
        RPG.State.battleState = null;
        RPG.State.mood = Math.max(0, RPG.State.mood - 20);

        innSystem.showDefeatSequence(defeatedEnemyId, { vampireAmberRemoved });
    },

    resolveDefeat: function () {
        uiControl.addSeparator();
        if (typeof explorationSystem !== "undefined") {
            explorationSystem.clearTemporaryItemEffects();
        }

        if (
            RPG.State.isBattling &&
            RPG.State.currentEnemy &&
            typeof visualDirector !== "undefined"
        ) {
            visualDirector.playBattleCue("party-defeated");
        }

        if (this.isHighwayBattleContext()) {
            this.resolveHighwayDefeat();
            return;
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

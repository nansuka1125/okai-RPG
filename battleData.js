// 🚩ーー【Build 14.1.3: Battle Data & Behaviors (Surgical Fix)】ーー
// Standardized keys (atk, xp) while preserving structural integrity.
// Build 14.2.3: Amber Tree Migration (Phase 1)

window.RPG = window.RPG || {};
RPG.Assets = RPG.Assets || {};

RPG.Assets.BATTLE_TEXT = {
    intro: {
        larva: "泥這う大幼蟲との戦闘開始！",
        // tree intro string removed in 15.1.0 to prevent double logs
        default: (name) => `${name}が現れた！`,
        preemptive: (name) => `${name}の先制攻撃！`
    },
    larva: {
        poisonFog: "腐った毒霧を吐き出した！",
        swallow: "幼蟲の巨大な口がカインを飲み込んだ！カインは身動きが取れない！",
        digesting: "幼蟲の胃の中で、酸がカインの体を焼く……",
        waiting: "泥這う大幼蟲は身体を揺すりながら、カインを見つめている…",
        bodySlam: "泥這う大幼蟲は大きな体をぶつけてきた！"
    },
    owen: {
        larvaComment: "オーエン「おまえが食べごろになるのを待ってるんだよ。まだかなって」",
        herb: "オーエンは薬草を投げつけてきた",
        kill: [
            "オーエン「…雑魚ばっかり」",
            "オーエン「…邪魔」",
            "オーエン「はあ…」",
            "オーエン「見てらんない」",
            "オーエン「消えろよ」",
            "オーエン「もう飽きた」"
        ],
        freeze: [
            "オーエン「眠ってて」",
            "オーエン「そこ」",
            "オーエン「動くなよ」",
            "オーエン「さっさと片付けて」",
            "オーエン「早くして」"
        ],
        intimidation: "オーエン「…おい、やりすぎだ」",
        intimidationEffect: "オーエンの殺気が敵を威圧し、戦いは終わった…"
    },
    cain: {
        larvaResponse: "カイン「...毒が回るのを...っ 厄介だな」"
    },
    hungry_amber_tree: {
        standardAttack: "鋭い枝がカインを襲う！",
        waiting: "琥珀樹は不気味にざわめいている…",
        strongAttack: "樹の全力のしなりが叩きつけられた！"
    },
    amber_husk_giant_larva: {
        standardAttack: "琥珀の殻を軋ませながら、巨大な鎌が振り下ろされる！",
        phaseTwo: "巨虫の動きが変わった…",
        phaseThree: "巨虫の琥珀の殻が赤黒く変色し、殺気が膨れ上がる！",
        stun: "カインは立ち上がれない。",
        halfHpTalk: [
            { text: "カイン「…くっ…どんどん攻撃が強くなってる！」" },
            { text: "オーエン「ああ、鎌が飛んでくる。首落ちちゃうよ」", color: "#a020f0" }
        ],
        scytheMisses: [
            "カインはなんとか避けた。髪が数本、パラリと落ちた",
            "鋭い鎌がカインの外套を浅く切り裂いた。布の端が宙を舞う。",
            "わずかに回避が遅れ、頬を鋭利な刃がかすめる。一筋の血が流れた。",
            "回避したカインの背後の木々が、音もなく両断された。凄まじい斬れ味だ。"
        ]
    }
};


// ⚔️ AI Behavior Modules
RPG.Assets.BATTLE_AI = {
    // 🐛 Giant Larva (Build 9.0.0+)
    giant_larva: {
        execute: function (sys) {
            const enemy = RPG.State.currentEnemy;
            const bossDelay = 1000;

            // Priority 1: Swallow (HP <= 50%)
            if (!enemy.swallowUsed && RPG.State.currentHP <= RPG.State.maxHP * 0.5) {
                enemy.swallowUsed = true;
                uiControl.addLog(RPG.Assets.BATTLE_TEXT.larva.swallow, "enemy-action");

                setTimeout(() => {
                    if (!RPG.State.battleState) RPG.State.battleState = { skippedTurns: 0 };
                    RPG.State.battleState.skippedTurns = 2;
                    RPG.State.battleTurn++;
                    setTimeout(() => sys.runBattleLoop(), 1200);
                }, bossDelay);
                return;
            }

            // Priority 1.5: Digestion (While Swallowed)
            // Note: sys.runBattleLoop handles the player skip, but if we are here, it's enemy turn.
            // We check skippedTurns > 0 to see if player is still trapped.
            if (RPG.State.battleState && RPG.State.battleState.skippedTurns > 0) {
                uiControl.addLog(RPG.Assets.BATTLE_TEXT.larva.digesting, "damage", "#ff4d4d");
                const digestDmg = 5;
                RPG.State.currentHP -= digestDmg;
                uiControl.updateUI();
                uiControl.addLog(`カインは${digestDmg}のダメージを受けた！`, "damage");

                if (sys.checkBattleEnd()) return;

                RPG.State.battleTurn++;
                setTimeout(() => sys.runBattleLoop(), 1200);
                return;
            }

            // Priority 2: Turn 1 Poison
            if (RPG.State.battleTurn === 1) {
                uiControl.addLog(RPG.Assets.BATTLE_TEXT.larva.poisonFog, "enemy-action");
                setTimeout(() => {
                    if (!RPG.State.isPoisoned) {
                        RPG.State.isPoisoned = true;
                        uiControl.addLog("カインは猛毒に侵された！", "damage", "#ff4d4d");
                    } else {
                        uiControl.addLog("霧がカインの体を包み込む……", "ambient");
                    }
                    RPG.State.battleTurn++;
                    setTimeout(() => sys.runBattleLoop(), 1200);
                }, bossDelay);
                return;
            }

            // Priority 3: Waiting Move (Dynamic Probability)
            let observationChance = RPG.State.currentHP <= RPG.State.maxHP * 0.5 ? 0.8 : 0.4;

            if (RPG.State.battleTurn > 1 && Math.random() < observationChance) {
                uiControl.addLog(RPG.Assets.BATTLE_TEXT.larva.waiting, "ambient");

                if (!enemy.waitingUsed) {
                    enemy.waitingUsed = true;
                    setTimeout(() => {
                        uiControl.addLog(RPG.Assets.BATTLE_TEXT.owen.larvaComment, "talk", "#a020f0");
                        setTimeout(() => {
                            uiControl.addLog(RPG.Assets.BATTLE_TEXT.cain.larvaResponse, "talk");
                            RPG.State.battleTurn++;
                            setTimeout(() => sys.runBattleLoop(), 1200);
                        }, bossDelay);
                    }, bossDelay);
                } else {
                    RPG.State.battleTurn++;
                    setTimeout(() => sys.runBattleLoop(), 1200);
                }
                return;
            }

            // Standard Attack: Body Slam (Multiplier 1.2x - 1.6x)
            const def = RPG.State.defense || 0;
            const multiplier = (1.5 + (Math.random() * 0.5)) * 0.8;
            const rawDmg = (enemy.atk * multiplier) - (def / 2);
            const damage = Math.floor(Math.max(1, rawDmg));

            uiControl.addLog(RPG.Assets.BATTLE_TEXT.larva.bodySlam, "enemy-action");
            setTimeout(() => {
                uiControl.addLog(`カインは${damage}のダメージを受けた！`, "damage");
                RPG.State.currentHP -= damage;
                uiControl.updateUI();

                if (sys.checkBattleEnd()) return;

                RPG.State.battleTurn++;
                setTimeout(() => sys.runBattleLoop(), 1200);
            }, bossDelay);
        }
    },
    // 🌲 Hungry Amber Tree (Build 14.2.3+)
    hungry_amber_tree: {
        execute: function (sys) {
            const enemy = RPG.State.currentEnemy;
            const bossDelay = RPG.State.debug.isSkipping ? 50 : 1000;
            const loopDelay = RPG.State.debug.isSkipping ? 50 : 1200;
            const roll = Math.random();

            if (roll < 0.3) {
                // 30% Chance: Wait (Buffer for Cain)
                uiControl.addLog(RPG.Assets.BATTLE_TEXT.hungry_amber_tree.waiting, "ambient");
                setTimeout(() => {
                    RPG.State.battleTurn++;
                    setTimeout(() => sys.runBattleLoop(), loopDelay);
                }, bossDelay);
            } else if (roll < 0.4) {
                // 10% Chance: Strong Attack (Multiplier 1.5x)
                const def = RPG.State.defense || 0;
                const damage = Math.floor(Math.max(1, (enemy.atk * 1.5) - (def / 2)));
                uiControl.addLog(RPG.Assets.BATTLE_TEXT.hungry_amber_tree.strongAttack, "enemy-action", "#ff4d4d");
                setTimeout(() => {
                    uiControl.addLog(`カインは${damage}のダメージを受けた！`, "damage");
                    RPG.State.currentHP -= damage;
                    uiControl.updateUI();
                    if (sys.checkBattleEnd()) return;
                    RPG.State.battleTurn++;
                    setTimeout(() => sys.runBattleLoop(), loopDelay);
                }, bossDelay);
            } else {
                // 60% Chance: Standard Attack
                const def = RPG.State.defense || 0;
                const damage = Math.floor(Math.max(1, enemy.atk - (def / 2)));
                uiControl.addLog(RPG.Assets.BATTLE_TEXT.hungry_amber_tree.standardAttack, "enemy-action");
                setTimeout(() => {
                    uiControl.addLog(`カインは${damage}のダメージを受けた！`, "damage");
                    RPG.State.currentHP -= damage;
                    uiControl.updateUI();
                    if (sys.checkBattleEnd()) return;
                    RPG.State.battleTurn++;
                    setTimeout(() => sys.runBattleLoop(), loopDelay);
                }, bossDelay);
            }
        }
    },
    amber_husk_giant_larva: {
        execute: function (sys) {
            const enemy = RPG.State.currentEnemy;
            const bossDelay = RPG.State.debug.isSkipping ? 50 : 1000;
            const loopDelay = RPG.State.debug.isSkipping ? 50 : 1200;
            const maxHp = enemy.maxHp || 600;
            const hpRatio = enemy.hp / maxHp;

            if (!RPG.State.battleState) {
                RPG.State.battleState = { skippedTurns: 0, stunTurns: 0 };
            }

            if (!enemy.phaseTwoTriggered && hpRatio <= 0.7) {
                enemy.phaseTwoTriggered = true;
                enemy.atk = Math.floor(enemy.baseAtk * 1.5);
                uiControl.addLog(RPG.Assets.BATTLE_TEXT.amber_husk_giant_larva.phaseTwo, "enemy-action", "#ffb347");
            }

            if (!enemy.phaseThreeTriggered && hpRatio <= 0.4) {
                enemy.phaseThreeTriggered = true;
                enemy.atk = Math.floor(enemy.baseAtk * 2.0);
                uiControl.addLog(RPG.Assets.BATTLE_TEXT.amber_husk_giant_larva.phaseThree, "enemy-action", "#ff4d4d");
            }

            if (!enemy.halfHpTalkDone && hpRatio <= 0.5) {
                enemy.halfHpTalkDone = true;
                sys.playAmberHuskHalfHpScene(() => {
                    setTimeout(() => sys.runBattleLoop(), loopDelay);
                });
                return;
            }

            if (hpRatio <= 0.5 && Math.random() < 0.35) {
                const misses = RPG.Assets.BATTLE_TEXT.amber_husk_giant_larva.scytheMisses;
                const missIndex = enemy.scytheMissIndex || 0;
                uiControl.addLog("死神の鎌が唸りを上げて振るわれた！", "enemy-action", "#ff4d4d");
                setTimeout(() => {
                    uiControl.addLog(misses[missIndex], "ambient");
                    enemy.scytheMissIndex = (missIndex + 1) % misses.length;
                    RPG.State.battleTurn++;
                    setTimeout(() => sys.runBattleLoop(), loopDelay);
                }, bossDelay);
                return;
            }

            if (Math.random() > enemy.hitRate) {
                uiControl.addLog(RPG.Assets.BATTLE_TEXT.amber_husk_giant_larva.standardAttack, "enemy-action");
                setTimeout(() => {
                    uiControl.addLog("カインは紙一重で回避した！", "ambient");
                    RPG.State.battleTurn++;
                    setTimeout(() => sys.runBattleLoop(), loopDelay);
                }, bossDelay);
                return;
            }

            const def = RPG.State.defense || 0;
            const damage = Math.floor(Math.max(1, enemy.atk - (def / 2)));
            uiControl.addLog(RPG.Assets.BATTLE_TEXT.amber_husk_giant_larva.standardAttack, "enemy-action");
            setTimeout(() => {
                RPG.State.currentHP -= damage;
                uiControl.addLog(`カインは${damage}のダメージを受けた！`, "damage");

                if (enemy.hp <= maxHp * 0.6 && Math.random() < 0.35) {
                    uiControl.screenShake();
                    uiControl.addLog(RPG.Assets.BATTLE_TEXT.amber_husk_giant_larva.stun, "damage", "#ff4d4d");
                    RPG.State.battleState.stunTurns = 1;
                }

                uiControl.updateUI();
                if (sys.checkBattleEnd()) return;
                RPG.State.battleTurn++;
                setTimeout(() => sys.runBattleLoop(), loopDelay);
            }, bossDelay);
        }
    }
};

// 🧙‍♂️ Owen's Behavior Logic
RPG.Assets.OWEN_BEHAVIOR = {
    shouldIntervene: function (battleTurn) {
        if (RPG.State.hasOwenIntervened) return false;

        // Build 14.2.5: Targeted Supporter - Bypass mood check for Emergency (Herb)
        const isEmergency = (RPG.State.currentHP < (RPG.State.maxHP * 0.25) || RPG.State.isPoisoned) && (RPG.State.inventory.herb > 0);
        if (isEmergency) return true;

        // Chance based on mood (Mood 50 = 50% chance to *stay silent*)
        if (Math.random() * 100 > RPG.State.mood) return false;
        return true;
    },

    decideAction: function (battleTurn) {
        // 1. Critical Support (Herb)
        // Build 14.2.5: HP < 25% (1/4 Threshold) & 60% Chance
        if ((RPG.State.currentHP < (RPG.State.maxHP * 0.25) || RPG.State.isPoisoned) && RPG.State.inventory.herb > 0) {
            if (Math.random() < 0.6) return "herb";
        }

        // 2. Aggressive Intervention
        const isFirstTurn = battleTurn === 1;
        const isLowHP = RPG.State.currentHP < (RPG.State.maxHP * 0.4);

        const isBossEnemy = RPG.State.currentEnemy && RPG.State.currentEnemy.isBoss === true;
        if (!isBossEnemy && (isFirstTurn || isLowHP) && Math.random() < 0.15) return "kill";
        if (Math.random() < 0.20) return "freeze";

        // 3. Idle
        if (Math.random() < 0.30) return "idle";

        return null;
    }
};

// 🚩ーー【敵データ】ーー
RPG.Assets.ENEMIES = [
    {
        id: "rat", name: "魔界のネズミ", maxHp: 40,
        atk: 5,
        xp: 15,
        area: [1, 9], weight: 10,
        attackLog: "飢えた琥珀樹は根を伸ばしてカインに絡みついた！"
    },
    // --- Build 14.2.2: Former Highway Enemies ---
    {
        id: 'hell_rat_swarm',
        name: '魔界のネズミ《群》',
        hp: 40,
        maxHp: 40,
        atk: 6,
        xp: 25,
        msg: "ネズミの大群がよじ登ってくる！",
        preBattleDialogue: [
            { text: "ネズミの大群がよじ登ってくる！" }
        ]
    },
    {
        id: 'eye_eating_crow',
        name: '目食いカラス',
        hp: 30,
        maxHp: 30,
        atk: 8,
        xp: 30,
        msg: "目食いカラスは目玉を突いてきた！"
    },
    {
        id: "normal_rat",
        name: "普通のネズミ",
        maxHp: 1,
        atk: 1,
        xp: 1,
        area: null,
        msg: "噛みついてきた！"
    },
    {
        id: "weasel", name: "魔界のイタチ", maxHp: 50, atk: 12, // Build 6.2: HP 35 -> 50
        xp: 22,
        area: [1, 9], weight: 3,
        preemptive: 1.0, // Build 6.3: Guaranteed first strike
        drop: { id: "herb", rate: 0.2 }, // Build 8.51: Changed from silverCoin to herb
        msg: "カマで切り裂いてきた！"
    },
    {
        id: "sap", name: "琥珀の樹液", maxHp: 60, atk: 8,
        xp: 18,
        area: [4, 9], weight: 5,
        msg: "樹液の触手で攻撃してきた！"
    },
    {
        id: "hungry_tree", name: "飢えた琥珀樹", maxHp: 100, atk: 18,
        xp: 45,
        isBoss: true,
        area: null // Build 12.0.6: Excluded from random encounters
    },
    // Build 9.0.0: Giant Larva Mid-Boss
    {
        id: "giant_larva", name: "泥這う大幼蟲",
        maxHp: 100, // Dynamic: Atk * 12 (Build 9.1)
        atk: 15,
        area: null, // Build 12.0.6: Boss only summoned by event
        xp: 130,
        isBoss: true,
        drop: { id: "herb", rate: 0.2 },
        msg: "大きな体をぶつけてきた！", // Default msg (Build 9.1)
        onDeathEvent: "thief_rescue_victory" // Post-battle aftermath only; generic victory text stays in executeStandardVictory()
    },
    {
        id: "amber_husk_giant_larva",
        name: "琥珀骸の巨虫",
        maxHp: 600,
        atk: 20,
        baseAtk: 20,
        hitRate: 0.5,
        area: null,
        xp: 200,
        isBoss: true,
        msg: "巨大な鎌を振り上げてきた！",
        onDeathEvent: "amber_husk_giant_larva_victory" // Post-battle aftermath only; generic victory text stays in executeStandardVictory()
    },
    // Build 14.2.3: Hungry Amber Tree Boss Definition
    {
        id: "hungry_amber_tree",
        name: "飢えた琥珀樹",
        maxHp: 150,
        atk: 13, // Adjusted for survival balance
        xp: 100,
        isBoss: true,
        drop: { id: "silverCoin", rate: 1.0 }, // Changed back to silverCoin for consistency
        onDeathEvent: "amber_tree_victory" // Post-battle aftermath only; generic victory text stays in executeStandardVictory()
    }
];

// Ensure global accessibility
window.ENEMIES = RPG.Assets.ENEMIES;
window.BATTLE_TEXT = RPG.Assets.BATTLE_TEXT;
window.BATTLE_AI = RPG.Assets.BATTLE_AI;
window.OWEN_BEHAVIOR = RPG.Assets.OWEN_BEHAVIOR;

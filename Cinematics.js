// 🚩ーー【演出・シネマティクス管理】ーー
const Cinematics = {
    canPlayThiefDiscoveryFromModal: function () {
        return (
            RPG.State.flags.metThiefBoy === true &&
            RPG.State.flags.phase4TheftDiscovered !== true &&
            RPG.State.flags.thiefDiscoveryStatus === 0 &&
            RPG.State.isAtInn === false &&
            !RPG.State.flags.giantLarvaDefeated
        );
    },

    canPlayThiefDiscovery: function () {
        const isOutsideAtInnFront =
            RPG.State.isAtInn === false &&
            (
                RPG.State.location === "宿屋前" ||
                RPG.State.currentDistance === 0
            );

        return (
            RPG.State.flags.metThiefBoy === true &&
            RPG.State.flags.phase4TheftDiscovered !== true &&
            RPG.State.flags.thiefDiscoveryStatus === 0 &&
            RPG.State.flags.hasSleptAfterThief === true &&
            isOutsideAtInnFront &&
            !RPG.State.flags.giantLarvaDefeated
        );
    },

    // --- 戦闘演出 ---
    scaleBoss: function (sys, enemy) {
        const playerAtk = Math.max(10, RPG.State.attack);
        if (enemy.id === 'hungry_tree') {
            uiControl.addSeparator();
            enemy.maxHp = playerAtk * 5;
            enemy.hp = enemy.maxHp;
            uiControl.addLog(RPG.Assets.BATTLE_TEXT.intro.tree, "event");
            return false;
        }
        if (enemy.id === 'giant_larva') {
            uiControl.addSeparator();
            enemy.maxHp = playerAtk * 12;
            enemy.hp = enemy.maxHp;
            enemy.swallowUsed = false;
            enemy.waitingUsed = false;
            uiControl.addLog(RPG.Assets.BATTLE_TEXT.intro.larva, "marker", "#ff4d4d");
            uiControl.addLog(`泥這う大幼蟲 (HP: ${enemy.hp})`, "marker");
            setTimeout(() => { sys.runBattleLoop(); }, 1500);
            return true;
        }
        if (enemy.id === 'amber_husk_giant_larva') {
            uiControl.addSeparator();
            enemy.hp = enemy.maxHp;
            enemy.atk = enemy.baseAtk || enemy.atk;
            enemy.phaseTwoTriggered = false;
            enemy.phaseThreeTriggered = false;
            enemy.halfHpTalkDone = false;
            enemy.scytheMissIndex = 0;
            uiControl.addLog("琥珀骸の巨虫との戦闘開始！", "marker", "#ff4d4d");
            uiControl.addLog(`琥珀骸の巨虫 (HP: ${enemy.hp})`, "marker");
            uiControl.screenShake();
            setTimeout(() => { sys.runBattleLoop(); }, 1500);
            return true;
        }
        uiControl.addLog(RPG.Assets.BATTLE_TEXT.intro.default(enemy.name));
        return false;
    },

    sceneTransition: function (text) {
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            {
                text: null,
                delay: 0,
                action: () => {
                    const logContainer = document.getElementById('logContainer');
                    if (logContainer) logContainer.classList.add('night-mode');
                }
            },
            {
                text: null,
                delay: 1800,
                action: () => {
                    const logContainer = document.getElementById('logContainer');
                    if (logContainer) {
                        logContainer.innerHTML = '';
                        logContainer.classList.remove('night-mode');
                    }
                    uiControl.addLog(text, "marker", "#f1e6c8", "24px");
                }
            }
        ];
        explorationSystem.playDialogueLoop();
    },

    playGiantLarvaDeath: function (sys, enemyId) {
        uiControl.addLog("「ギシャアアアアア！」", "marker", "#ff4d4d");
        uiControl.addLog("泥這う大幼蟲は、狂ったようにのたうち回った。");
        uiControl.screenShake(1000);
        setTimeout(() => {
            uiControl.addLog("半透明の身体が弾け、腐毒の体液が豪雨のように降り注ぐ。");
            uiControl.addLog("カイン「うわ……っ！？」");
            if (RPG.State.currentHP > RPG.State.maxHP / 3) {
                uiControl.addLog("逃げ場はない。崩れ落ちる巨躯に押し潰された");
                if (uiControl.flashFullScreen) uiControl.flashFullScreen("#8b0000", 1000);
                RPG.State.currentHP = Math.floor(RPG.State.maxHP * 0.25);
                uiControl.addLog("カインはまともに霧を浴び、激しく咳き込む……！", "danger");
                uiControl.updateUI();
            } else {
                uiControl.addLog("カインはかろうじて崩れ落ちる巨軀を避けた。");
            }
            setTimeout(() => {
                // Build 14.1.3: Set flag on victory
                RPG.State.flags.giantLarvaDefeated = true;
                sys.executeStandardVictory(enemyId);
            }, 2000);
        }, 1000);
    },

    // --- 探索・イベント演出 (uiControlから移植) ---
    playThiefDiscovery: function () {
        RPG.State.mode = "event";
        RPG.State.flags.phase4TheftDiscovered = true;
        RPG.State.flags.thiefTrackActive = false;

        if (RPG.State.storyPhase < 4) {
            RPG.State.storyPhase = 4;
        }

        RPG.State.dialogueQueue = RPG.Assets.GAME_TEXT.events.thiefDiscoveryHookB;
        explorationSystem.playDialogueLoop();
    },

    // Build 14.1.5: Special Boss Defeat Cinematic
    playGiantLarvaDefeat: function () {
        // 1. Clear Logs (Optional, but helps focus)
        // uiControl.clearLogs(); // Not implemented, standard addLog stack

        // 2. Play Dialogue
        uiControl.addLog("泥這う大幼蟲は、“深く“カインを呑み込むことに成功した。", "marker", "#8b0000");

        setTimeout(() => {
            uiControl.addLog("カイン「…あ…っ…まず……」");
        }, 1500);

        setTimeout(() => {
            uiControl.addLog("視界が暗くなる。グネグネと動く胎内に、絶望とともに引き摺り込まれていく…。", "damage");
        }, 3000);

        setTimeout(() => {
            uiControl.addLog("BAD END《幼蟲の餌》", "marker", "#ff4d4d");

            // Visual Blackout (Simple override for effect)
            if (uiControl.flashFullScreen) uiControl.flashFullScreen("#000000", 3000);
        }, 5000);

        // 3. Silent Return
        setTimeout(() => {
            RPG.State.isBattling = false;
            RPG.State.currentEnemy = null;
            RPG.State.currentHP = RPG.State.maxHP; // Full Restore
            RPG.State.isPoisoned = false;
            RPG.State.mode = "base";
            RPG.State.isInDungeon = false;
            RPG.State.currentDistance = 0; // Inn Front

            // Build 14.1.6: Retroactive fix for re-triggering logic
            if (RPG.State.completedEvents.includes("thief_rescue_10m_battle")) {
                RPG.State.completedEvents = RPG.State.completedEvents.filter(e => e !== "thief_rescue_10m_battle");
            }

            uiControl.updateUI();
            uiControl.addLog("……。"); // Silent realization
        }, 7000);
    },
    // Build 14.1.8: Correct Delivery Dialogue
    playSilverDeliveryEvent: function () {
        RPG.State.mode = "event";

        RPG.State.dialogueQueue = [
            { text: "カイン「銀貨を3枚。遅くなったが…」", delay: 1000 },
            { text: "宿屋の主人「いやいや、…ありがとう。本当にあったんだな。森に落ちてたのか？」", delay: 1500 },
            { text: "カイン「いや…。かなり危険な魔物が持っていた。森には近づかない方がいいかもしれない。」", delay: 2000 },
            { text: "オーエン「腕試しにいいかもよ？銀貨を拾うか、命を落とすか…」", delay: 2000, color: "#a020f0" },
            { text: "宿屋の主人「おまえさんたちはまだしばらくここにいるのかい？」", delay: 1500 },
            { text: "カイン「そろそろ次の街に行くよ。森の異変を解決するためにも、原因を突き止めないと」", delay: 2000 },
            { text: "宿屋の主人「なら、綺麗なベッドでもう一泊していったらどうだ？風呂も沸かしてあるからさ」", delay: 2000 },
            { text: "カイン「それはありがたい！お言葉に甘えてそうするよ」", delay: 1500 },
            { text: "オーエン「汚いって言われてるんだよ」", delay: 1500, color: "#a020f0" },
            { text: "カイン「…虫の体液浴びたからな。わかってるさ」", delay: 1500 },
            {
                text: null,
                delay: 0,
                action: () => {
                    RPG.State.silverCoins = 0;
                    if (RPG.State.inventory && RPG.State.inventory.silverCoin) {
                        RPG.State.inventory.silverCoin = 0;
                    }
                    RPG.State.flags.silverDelivered = true;
                    RPG.State.storyPhase = 6; // Build 14.2.0: Advance to finale phase

                    RPG.State.mode = "base";
                    uiControl.updateUI();
                }
            }
        ];

        explorationSystem.playDialogueLoop();
    },

    // Build 14.2.0: Chapter 1 Finale - Night Event
    playChapter1FinaleNight: function () {
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            { text: "", delay: 1500, action: null },
            {
                text: "【〜琥珀亭馬小屋の裏〜】",
                delay: 1500,
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
                    if (logContainer) {
                        logContainer.innerHTML = '';
                        logContainer.classList.remove('night-mode');
                    }
                }
            },
            { text: "カイン「(宿屋の外、月明かりの下。馬小屋の横でカインが剣の手入れをしている。)」", delay: 2000 },
            { text: "オーエン「…せっかく綺麗なベッドなのに馬小屋が恋しいわけ？」", delay: 1500, color: "#a020f0" },
            { text: "カイン「オーエン。寝てて構わないのに。ああ、そうか、あんまり離れられないのか？俺から」", delay: 2000 },
            { text: "オーエン「…おまえを殺せば離れられるかもよ。そろそろ試そうかな」", delay: 2000, color: "#a020f0" },
            { text: "カイン「(冗談なのか本気なのか、わからないな)」", delay: 1500 },
            { text: "(ト書き: オーエンは不愉快そうに目を細めてカインの剣の手入れを眺めている。)", delay: 2000, color: "#888888" },
            { text: "カイン「…明日の朝にはここを出る。行き先は、まだ考え中だ」", delay: 2000 },
            { text: "オーエン「もうおまえに帰る場所はないもんね。王国はおまえに押し付けたんだ、面倒なことの後始末も」", delay: 2500, color: "#a020f0" },
            { text: "(ト書き: カインはピカピカになった剣を鞘に収めて立ち上がった。)", delay: 2000, color: "#888888" },
            { text: "カイン「そうでもないさ」", delay: 1500 },
            { text: "オーエン「………つまんないやつ」", delay: 1500, color: "#a020f0" },
            {
                text: null,
                delay: 1000,
                action: () => {
                    // Start blackout
                    const logContainer = document.getElementById('logContainer');
                    if (logContainer) logContainer.classList.add('night-mode');
                }
            },
            {
                text: "(2人はふかふかのベッドでたっぷり眠った！)",
                delay: 3000
            },
            {
                text: null,
                delay: 2000,
                action: () => {
                    // Recovery
                    RPG.State.currentHP = RPG.State.maxHP;
                    RPG.State.isPoisoned = false;

                    // Animate HP bar
                    const hpFill = document.getElementById('hpFill');
                    if (hpFill) {
                        hpFill.style.transition = "width 2.0s ease-out";
                    }
                    uiControl.updateUI();

                    // Reset transition after animation
                    setTimeout(() => {
                        const hpFill = document.getElementById('hpFill');
                        if (hpFill) hpFill.style.transition = "width 0.3s ease";
                    }, 2000);
                }
            },
            {
                text: null,
                delay: 1000,
                action: () => {
                    // End blackout
                    const logContainer = document.getElementById('logContainer');
                    if (logContainer) logContainer.classList.remove('night-mode');
                }
            },
            { text: "カイン「（店主に挨拶してから行こう）」", delay: 1500 },
            {
                text: null,
                delay: 0,
                action: () => {
                    RPG.State.storyPhase = 7;
                    RPG.State.mode = "base";
                    uiControl.updateUI();
                }
            }
        ];

        explorationSystem.playDialogueLoop();
    }
};
window.Cinematics = Cinematics;

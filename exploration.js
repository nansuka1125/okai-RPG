// 🚩ーー【移動・探索システム】ーー
// Build 14.1: Namespaces updated to RPG.State and RPG.Assets
const explorationSystem = {
    // --- checkEvents: イベントマネージャー ---
    checkEvents: function () {
        for (const ev of RPG.Assets.EVENT_DATA) {
            // Build 14.1.6: Support repeatable events (e.g., Boss Retry)
            const isCompleted = RPG.State.completedEvents.includes(ev.id);
            if (ev.condition(RPG.State) && (!isCompleted || ev.repeatable)) {
                RPG.State.mode = "event";
                ev.action(RPG.State);

                // Only mark as completed if NOT repeatable
                if (!ev.repeatable && !isCompleted) {
                    RPG.State.completedEvents.push(ev.id);
                }

                if (RPG.State.dialogueQueue && RPG.State.dialogueQueue.length > 0) {
                    // 自動再生開始
                    this.playDialogueLoop();
                } else {
                    // 通常イベントの場合：一定時間後に復帰
                    setTimeout(() => {
                        RPG.State.mode = "base";
                        uiControl.updateUI();
                    }, 500);
                }
                return true;
            }
        }
        return false;
    },

    // --- playDialogueLoop: 自動会話進行 ---
    playDialogueLoop: function () {
        if (!RPG.State.dialogueQueue || RPG.State.dialogueQueue.length === 0) {
            // Build 9.0.0: Prevent overwriting battle mode
            if (RPG.State.mode === "event") {
                RPG.State.mode = "base";
            }

            // Build 8.2: Intro Event Completion Check
            if (!RPG.State.flags.hasIntroFinished) {
                // Prologue ending - player is at Inn
                RPG.State.flags.hasIntroFinished = true;
                RPG.State.location = "宿屋《琥珀亭》";
                RPG.State.isAtInn = true;
            }

            // UIロック解除
            const allButtons = document.querySelectorAll('button');
            allButtons.forEach(btn => {
                btn.disabled = false;
                btn.style.opacity = "1";
                btn.style.pointerEvents = "auto";
            });

            uiControl.updateUI();
            return;
        }

        const nextLine = RPG.State.dialogueQueue.shift();
        
        // Build 15.1.7: Support 'One-Line-at-a-Time' progression
        if (nextLine.clear) {
            uiControl.clearLog();
        }

        if (nextLine.text) {
            uiControl.addLog(nextLine.text, "", nextLine.color);
        }
        uiControl.updateUI();

        // アクション実行（カスタム処理がある場合）
        if (nextLine.action) {
            nextLine.action();
        }

        // 次の行へ
        /* Build 13.0.0: Tap-to-Advance Logic */
        if (nextLine.text) {
            RPG.State.isWaitingForInput = true;
            uiControl.showFloatingArrow();
            uiControl.enableTapOverlay();
        } else {
            const delay = nextLine.delay || 0;
            if (delay > 0) {
                setTimeout(() => {
                    this.playDialogueLoop();
                }, delay);
            } else {
                this.playDialogueLoop();
            }
        }
    },

    enterDungeon: function () {
        const entranceLoc = uiControl.getLocData(0);
        RPG.State.isInDungeon = true;
        RPG.State.currentDistance = 0;
        RPG.State.location = entranceLoc.name;
        RPG.State.mode = "base";
        uiControl.addLog(RPG.Assets.GAME_TEXT.exploration.enteredForest, "marker");

        if (!RPG.State.flags.forestFirstEnter) {
            RPG.State.flags.forestFirstEnter = true;
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                { text: "カイン「森はここからか」", delay: 1500 },
                { text: "太陽の光を浴びて木々の間からキラキラと差し込む光が場違いなほど綺麗だ。", delay: 1500 },
                { text: "黄色味を帯びた木々は生きているはずにも関わらずどこか不気味な死の気配を漂わせている。", delay: 1500 },
                { text: "オーエン「見て。この虫たち、樹液に絡まってベタベタになったまま死んでるんだよ。死ぬまで甘かったなんて虫のくせに幸せそう」", delay: 1500 },
                { text: "カイン「…樹液が固まってる」", delay: 1500 },
                { text: "オーエン「それとも、木が命の甘さを啜ってるのかもね」", delay: 1500 },
                { text: "カイン「明らかに異常だな。行こう」", delay: 1500 }
            ];
            this.playDialogueLoop();
            return;
        }

        this.move(0);
    },

    move: function (step) {
        if (RPG.State.mode !== "base" || RPG.State.isAtInn) return;
        if (RPG.State.location === "宿屋内部") return;

        // 0m地点からの脱出 (Return to Inn Front)
        if (RPG.State.isInDungeon && RPG.State.currentDistance === 0 && step === -1) {
            RPG.State.isInDungeon = false;
            RPG.State.location = "宿屋前";

            if (scenarioEvents.thiefBoyEvent.handleInnEntranceCollision()) return;

            uiControl.addLog(RPG.Assets.GAME_TEXT.exploration.leftForest, "marker");
            uiControl.updateUI();
            return;
        }

        const prevLoc = uiControl.getLocData(RPG.State.currentDistance).name;
        let nextDist = RPG.State.currentDistance + step;

        if (!RPG.State.flags.silverDelivered && nextDist >= RPG.Assets.CONFIG.MAX_DISTANCE) {
            nextDist = RPG.Assets.CONFIG.MAX_DISTANCE;
            if (RPG.State.currentDistance === RPG.Assets.CONFIG.MAX_DISTANCE && step > 0) {
                uiControl.addLog(RPG.Assets.GAME_TEXT.exploration.gateGuard);
                return;
            }
        }

        if (nextDist < RPG.Assets.CONFIG.MIN_DISTANCE || nextDist > RPG.Assets.CONFIG.MAX_DISTANCE) return;

        if (step !== 0) {
            RPG.State.canStay = true;
            RPG.State.currentDistance = nextDist;
            uiControl.addLog(RPG.Assets.GAME_TEXT.exploration.moved(RPG.State.currentDistance));

            // Keep forest location labels in sync with distance thresholds.
            // Do not overwrite special area names like the Former Highway.
            if (RPG.State.isInDungeon && RPG.State.location !== "かつての街道") {
                RPG.State.location = uiControl.getLocData(RPG.State.currentDistance).name;
            }

            if (RPG.State.isPoisoned) {
                RPG.State.currentHP -= 2;
                uiControl.addLog(RPG.Assets.GAME_TEXT.exploration.poisonDamage, "", "#ff4d4d");
                if (RPG.State.currentHP <= 1) {
                    RPG.State.currentHP = 1;
                    battleSystem.resolveDefeat();
                    return;
                }
            }
        }

        // Build 14.2.1: Journey Dialogues (Story Phase 8)
        if (RPG.State.storyPhase === 8 && step !== 0) {
            const dist = RPG.State.currentDistance;
            let journeyText = null;
            let journeyDialogue = null;

            switch (dist) {
                case 3:
                    journeyText = "ギィ……ギィ……と、乾いた木の軋む音が、森の静寂を削り続けている。";
                    break;
                case 4:
                    journeyText = "石畳の継ぎ目に乗るたび、荷台が「ガタン」と大きく跳ね、カインの肩当てが木箱と擦れて、鈍い音を立てた。";
                    break;
                case 5:
                    journeyText = "荷台に積まれた麻袋が、振動でカサカサと音を立てる。";
                    break;
                case 6:
                    journeyDialogue = [
                        { text: "カイン「…なあオーエン、この世界はどうしたらいいんだ？」", delay: 1500 },
                        { text: "オーエン「何が？」", delay: 1000, color: "#a020f0" },
                        { text: "カイン「オズとフィガロを封印すれば世界は元に戻るのか？」", delay: 1800 },
                        { text: "オーエン「馬鹿じゃないの？」", delay: 1200, color: "#a020f0" }
                    ];
                    break;
                case 7:
                    journeyDialogue = [
                        { text: "オーエン「………できるわけない。それに、あの2人がいなくなっても門が開いてるなら意味ないよ」", delay: 2500, color: "#a020f0" },
                        { text: "カイン「門を閉じるのは？」", delay: 1200 },
                        { text: "オーエン「知らない。」", delay: 1000, color: "#a020f0" },
                        { text: "カイン「そうか。門を閉じても、魔物がいなくなるわけじゃないもんな。」", delay: 1800 }
                    ];
                    break;
                case 8:
                    journeyText = "(ト書き: オーエンは、揺れる荷台の縁に危うく腰掛け、興味なさそうに森の奥を見つめている。)";
                    break;
                case 9:
                    journeyText = "周囲が暗くなってきた。森の気配も不穏なものに変わっていく…。";
                    break;
                case 10:
                    journeyDialogue = [
                        { text: "カイン「あのデカい幼虫の死体が無くなってる」", delay: 1500 },
                        { text: "オーエン「もう森の養分になったのかもね」", delay: 1500, color: "#a020f0" },
                        { text: "御者「ここから、街道に出られるんだ」", delay: 1500 }
                    ];
                    break;
            }

            if (journeyText) {
                setTimeout(() => {
                    uiControl.addLog(journeyText, "ambient");
                }, 500);
            } else if (journeyDialogue) {
                RPG.State.mode = "event";
                RPG.State.dialogueQueue = journeyDialogue;
                this.playDialogueLoop();
                return;
            }
        }

        // Build 14.2.2: Former Highway Fixed Encounters (6m only - others handled by events)
        if (RPG.State.location === "かつての街道" && RPG.State.storyPhase === 9 && step !== 0) {
            const dist = RPG.State.currentDistance;

            // Initialize battle count for this distance if not exists
            if (!RPG.State.highwayBattleCount[dist]) {
                RPG.State.highwayBattleCount[dist] = 0;
            }

            // 6m: Single crow battle (not handled by events)
            if (dist === 6 && RPG.State.highwayBattleCount[6] < 1) {
                RPG.State.highwayBattleCount[dist]++;
                battleSystem.startBattle('eye_eating_crow');
                return;
            }
        }

        // Build 15.1.2: Delegated to scenarioEvents.treeEventSystem.handleEncounter()
        if (scenarioEvents.treeEventSystem.handleEncounter()) return;

        const dist = RPG.State.currentDistance;

        // 5m Priority Logic
        if (dist === 5) {
            if (!RPG.State.flags.hasFoundFirstCoin) {
                RPG.State.mode = "event";
                uiControl.addLog(RPG.Assets.GAME_TEXT.events.firstCoinFound);
                setTimeout(() => {
                    uiControl.addLog(RPG.Assets.GAME_TEXT.events.firstCoinGet);
                    RPG.State.silverCoins += 1;
                    RPG.State.inventory.silverCoin += 1;
                    RPG.State.flags.hasFoundFirstCoin = true;
                    if (RPG.State.storyPhase < 1) {
                        RPG.State.storyPhase = 1;
                    }
                    RPG.State.searchCounter = 0;
                    uiControl.updateUI();

                    setTimeout(() => {
                        RPG.State.mode = "base";
                        uiControl.updateUI();
                    }, 800);
                }, 800);
                return;
            } else {
                // Build 14.1.7: Check for Return Trip Event (Priority)
                if (this.checkEvents()) return;

                uiControl.addLog(RPG.Assets.GAME_TEXT.events.owenPlaceholder5m);
                uiControl.updateUI();
                return;
            }
        }

        // 10m Priority Logic
        if (dist === 10) {
            if (this.checkEvents()) return;
            uiControl.addLog(RPG.Assets.GAME_TEXT.events.pathAt10m);
            uiControl.updateUI();
            return;
        }

        if (this.checkEvents()) return;

        // エンカウント判定
        // Build 15.2.3: Peaceful Return Mode only applies to the successful 3-coin return trip
        // Amber Tree rematch route should still allow normal encounters at 1m-9m
        const isPeacefulMode = (RPG.State.inventory.silverCoin === 3 && !RPG.State.flags.silverDelivered);

        // Build 14.2.2: No random encounters on Former Highway (fixed encounters only)
        const isHighway = (RPG.State.location === "かつての街道");

        if (!isPeacefulMode && !isHighway && RPG.State.isInDungeon && RPG.State.currentDistance > 0 && RPG.State.currentDistance < 10) {
            if (!RPG.State.flags.isDebugEncountersOff && Math.random() < RPG.Assets.CONFIG.BATTLE_RATE) {
                battleSystem.startBattle();
                return;
            }
        }

        uiControl.updateUI();

        // Build 8.57: Discovery Hook B
        if (RPG.State.currentDistance === 0 &&
            RPG.State.flags.metThiefBoy === true &&
            RPG.State.flags.thiefDiscoveryStatus === 0 &&
            RPG.State.flags.hasSleptAfterThief === true &&
            !RPG.State.isAtInn) {

            RPG.State.mode = "event";
            RPG.State.flags.thiefDiscoveryStatus = 1;
            RPG.State.flags.thiefTrackActive = true;
            if (RPG.State.storyPhase < 4) {
                RPG.State.storyPhase = 4;
            }

            // 台本の住所を RPG.Assets に繋ぎ変え
            RPG.State.dialogueQueue = RPG.Assets.GAME_TEXT.events.thiefDiscoveryHookB;
            this.playDialogueLoop();
            return;
        }

        // Ambient Flavor Text
        if (RPG.Assets.AMBIENT_TEXTS[dist] && Math.random() < 0.4) {
            setTimeout(() => {
                uiControl.addLog(RPG.Assets.AMBIENT_TEXTS[dist], "ambient");
            }, 300);
        }

        const nextLoc = uiControl.getLocData(RPG.State.currentDistance);
        if (prevLoc !== nextLoc.name) {
            setTimeout(() => {
                uiControl.addLog(`―― ${nextLoc.name} ――`, "marker");
                uiControl.addLog(nextLoc.desc);
            }, 600);
        }
    },

    talk: function () {
        if (!RPG.State.isInDungeon) {
            uiControl.addLog(RPG.Assets.GAME_TEXT.exploration.talkAtInn);
        } else {
            uiControl.addLog(RPG.Assets.GAME_TEXT.exploration.talkInDungeon);
        }
    },

    getItemUseDialogue: function (itemId) {
        if (itemId === 'herb') {
            if (RPG.State.herbUseCount === 1) {
                return [
                    { text: "カイン「…う。かなり苦いな…」" },
                    { text: "オーエン「そのわりに嬉しそうに食べるね」", color: "#a020f0" },
                    { text: "カイン「苦いのは結構好きだ。けど嬉しくはないな」" }
                ];
            }
            if (RPG.State.herbUseCount === 3) {
                return [
                    { text: "カイン「この味、だんだん癖になってきた」" },
                    { text: "オーエン「癖になるほど薬草食べてるなんてカッコ悪いよ」", color: "#a020f0" },
                    { text: "カイン「ずっと噛んでると頭がぼーっとしてくる」" },
                    { text: "オーエン「…その辺にしといたら？」", color: "#a020f0" }
                ];
            }
        }

        if (itemId === 'debug_lvl10') {
            return [
                { text: "カイン「うわ！急にレベルが！」" },
                { text: "カイン「すごいな…何本も飲めばすぐに元のレベルに追いつけそうだ」" },
                { text: "オーエン「努力も時間も支払わずに、どんな代償があるだろうね」", color: "#a020f0" },
                { text: "カイン「…確かに。おまえの言う通りだな」" }
            ];
        }

        if (itemId === 'debug_poison') {
            return [
                { text: "オーエン「おいしかった？もう一個あるよ。ほら」", color: "#a020f0" },
                { text: "カイン「もういらない…」" },
                { text: "オーエン「ふうん？ああ、あそこのネズミがおまえのこと見てる」", color: "#a020f0" }
            ];
        }

        return null;
    },

    useItem: function (itemId) {
        if (!RPG.State.inventory[itemId] || RPG.State.inventory[itemId] <= 0) return;

        let success = false;
        switch (itemId) {
            case 'herb':
                if (RPG.State.currentHP >= RPG.State.maxHP && !RPG.State.isPoisoned) {
                    uiControl.addLog(RPG.Assets.GAME_TEXT.items.notNeeded);
                    uiControl.closeModal();
                    return;
                }
                const healAmount = Math.floor(RPG.State.maxHP * 0.4);
                RPG.State.currentHP = Math.min(RPG.State.maxHP, RPG.State.currentHP + healAmount);

                if (RPG.State.isPoisoned) {
                    RPG.State.isPoisoned = false;
                    uiControl.addLog(`薬草を使い、HPが${healAmount}回復し、毒が浄化された。`, "", "#a333c8");
                } else {
                    uiControl.addLog(`薬草を使い、HPが${healAmount}回復した。`);
                }
                RPG.State.herbUseCount = (RPG.State.herbUseCount || 0) + 1;
                success = true;
                break;
            case 'debug_poison':
                RPG.State.currentHP = 30;
                uiControl.addLog("《デバッグ毒》を煽った！カインの体力が30に設定されました。", "", "#ff4d4d");
                success = true;
                break;
            case 'debug_lvl10':
                RPG.State.cainLv = 10;
                RPG.State.maxHP = 100 + 180;
                RPG.State.attack = 10 + 45;
                RPG.State.currentHP = RPG.State.maxHP;
                uiControl.addLog("💊《レベルアップ薬》を煽った！力がみなぎる……（Lv.10になった）");
                success = true;
                break;
            default:
                uiControl.addLog(RPG.Assets.GAME_TEXT.items.cannotUse);
                break;
        }

        if (success) {
            const itemDialogue = this.getItemUseDialogue(itemId);
            RPG.State.inventory[itemId]--;
            uiControl.updateUI();
            uiControl.closeModal();

            if (itemDialogue && itemDialogue.length > 0) {
                RPG.State.mode = "event";
                RPG.State.dialogueQueue = itemDialogue.map(line => ({ ...line }));
                this.playDialogueLoop();
            }
        }
    },

    // Build 14.2.1: Transition to Former Highway
    transitionToHighway: function () {
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            { text: "―― かつての街道 ――", delay: 1500, color: "#FFD700" },
            { text: "荷馬車は森を抜け、古い石畳の街道へと出た。", delay: 1800 },
            {
                text: null,
                delay: 0,
                action: () => {
                    RPG.State.storyPhase = 9;
                    RPG.State.location = "かつての街道";
                    RPG.State.currentDistance = 0;
                    RPG.State.mode = "base";
                    uiControl.updateUI();
                }
            }
        ];
        this.playDialogueLoop();
    }
};

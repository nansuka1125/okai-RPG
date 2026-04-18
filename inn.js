// 🚩ーー【宿屋・拠点システム】ーー
// Build 8.16: Extracted from main.js for better code organization
innSystem = {
    shouldUsePhase4FortuneRoute: function () {
        return (
            RPG.State.storyPhase === 4 &&
            RPG.State.flags.phase4TheftDiscovered === true &&
            RPG.State.flags.thiefDiscoveryStatus === 0
        );
    },

    buildDialogueQueue: function (lines, action = null) {
        const queue = lines.map(text => ({ text }));
        if (action) {
            queue.push({ text: null, action });
        }
        return queue;
    },

    enterInn: function (showGreeting = true) {
        // Build 12.1.0: Delegated to scenarioEvents
        if (scenarioEvents.thiefBoyEvent.handleInnEntranceCollision()) return;

        RPG.State.isAtInn = true;
        RPG.State.mode = "base";
        RPG.State.location = "宿屋《琥珀亭》";
        uiControl.addLog(RPG.Assets.GAME_TEXT.inn.welcome, "marker");

        if (showGreeting) {
            uiControl.addLog(RPG.Assets.GAME_TEXT.inn.ownerGreeting);
        }

        const shouldPlayPhase4FortuneIntro =
            this.shouldUsePhase4FortuneRoute() &&
            RPG.State.flags.phase4FortuneIntroDone !== true;

        if (shouldPlayPhase4FortuneIntro) {
            RPG.State.flags.phase4FortuneIntroDone = true;
            uiControl.addSeparator();
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = this.buildDialogueQueue(
                RPG.Assets.GAME_TEXT.events.phase4FortuneIntro
            );
            explorationSystem.playDialogueLoop();
            return;
        }

        uiControl.updateUI();
    },

    exitInn: function () {
        // Build 12.4.2: Return to Inn Front stage
        if (RPG.State.mode !== "base") return;

        uiControl.addLog(RPG.Assets.GAME_TEXT.inn.locationFront, "marker");
        RPG.State.isAtInn = false;
        RPG.State.location = "宿屋前";
        RPG.State.isInDungeon = false;
        RPG.State.currentDistance = 0; // Explicitly 0m
        RPG.State.mode = "base";
        RPG.State.currentInnTalkLoop = null;

        // Remove night mode if persisted
        const logContainer = document.getElementById('logContainer');
        if (logContainer) logContainer.classList.remove('night-mode');

        const shouldPlayTreeExitTalk =
            RPG.State.flags.treeFirstDefeat === true &&
            RPG.State.flags.treeDefeated === false &&
            RPG.State.flags.treeExitTalkDone === false;

        if (shouldPlayTreeExitTalk) {
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                { text: "カイン「あの木の化け物はまだどこかにいるかな」" },
                { text: "オーエン「チップを貰いに行くの？命と引き換えに？」", color: "#a020f0" },
                { text: "カイン「次は勝つさ！」" },
                { text: "オーエン「ふうん…森の奥にまだいるかもね」", color: "#a020f0" },
                {
                    text: null,
                    action: () => {
                        RPG.State.flags.treeExitTalkDone = true;
                    }
                }
            ];
            explorationSystem.playDialogueLoop();
            return;
        }

        if (Cinematics.canPlayThiefDiscovery()) {
            Cinematics.playThiefDiscovery();
            return;
        }

        // Build 12.4.3: Proactive Trigger (Inn -> Front)
        if (scenarioEvents.thiefBoyEvent.handleInnEntranceCollision()) return;

        uiControl.updateUI();
    },

    talk: function () {
        if (RPG.State.mode !== "base") return;

        const talkData = RPG.Assets.TALK_DATA.innTalk;
        const currentPhase = Math.max(0, Math.min(RPG.State.storyPhase, 7));

        if (typeof RPG.State.talkIndex !== "number") {
            RPG.State.talkIndex = 0;
        }
        if (!RPG.State.talkPhaseReached || typeof RPG.State.talkPhaseReached !== "object") {
            RPG.State.talkPhaseReached = {};
        }

        const buildQueue = (lines, rewardAction = null) => {
            const queue = lines.map(line => ({ text: line }));
            if (rewardAction) {
                queue.push({ text: null, action: rewardAction });
            }
            return queue;
        };

        const shouldUsePhase4MatamatabiRumor =
            this.shouldUsePhase4FortuneRoute() &&
            RPG.State.flags.needsGlowingRabbitFur === true &&
            RPG.State.flags.heardMatamatabiRumor !== true;

        if (shouldUsePhase4MatamatabiRumor) {
            const talkCount = RPG.State.flags.phase4MatamatabiTalkCount || 0;
            const rumorLines = talkCount === 0
                ? RPG.Assets.GAME_TEXT.events.phase4MatamatabiTalk1
                : RPG.Assets.GAME_TEXT.events.phase4MatamatabiTalk2;

            const rumorAction = () => {
                RPG.State.flags.phase4MatamatabiTalkCount = talkCount + 1;
                if (talkCount >= 1) {
                    RPG.State.flags.heardMatamatabiRumor = true;
                }
                uiControl.updateUI();
            };

            uiControl.addSeparator();
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = buildQueue(rumorLines, rumorAction);
            explorationSystem.playDialogueLoop();
            return;
        }

        let selectedLines = null;
        let selectedPhase = null;
        let selectedEntryNumber = null;

        for (let phase = 0; phase <= currentPhase; phase++) {
            const phaseData = talkData.phases[phase];
            if (!phaseData || !phaseData.entries) continue;

            const reached = RPG.State.talkPhaseReached[phase] || 0;
            if (reached < phaseData.entries.length) {
                selectedPhase = phase;
                selectedEntryNumber = reached + 1;
                selectedLines = phaseData.entries[reached];
                RPG.State.talkPhaseReached[phase] = reached + 1;
                break;
            }
        }

        let rewardAction = null;

        if (!selectedLines) {
            if (currentPhase <= 5) {
                // Inn talk uses its own shared loop pool and currentInnTalkLoop memory.
                // Inn observe uses RPG.Assets.GAME_TEXT.innObserve plus observeIndex/observePhaseReached separately.
                const pool = talkData.sharedLoop05 || [];
                if (pool.length === 0) return;
                if (!RPG.State.currentInnTalkLoop) {
                    const index = Math.floor(Math.random() * pool.length);
                    RPG.State.currentInnTalkLoop = pool[index];
                }
                selectedLines = [RPG.State.currentInnTalkLoop];
            } else {
                const phaseData = talkData.phases[currentPhase];
                const loopLines = phaseData && phaseData.loop ? phaseData.loop : [];
                if (loopLines.length === 0) return;
                selectedLines = [loopLines[0]];
            }
        } else if (selectedPhase === 0 && selectedEntryNumber === 3) {
            rewardAction = () => {
                RPG.State.inventory.herb = (RPG.State.inventory.herb || 0) + 1;
                uiControl.updateUI();
            };
        } else if (selectedPhase === 6 && selectedEntryNumber === 2) {
            rewardAction = () => {
                RPG.State.inventory.herb = (RPG.State.inventory.herb || 0) + 3;
                uiControl.updateUI();
            };
        } else if (selectedPhase === 7 && selectedEntryNumber === 3) {
            rewardAction = () => {
                RPG.State.inventory.charm = (RPG.State.inventory.charm || 0) + 1;
                uiControl.updateUI();
            };
        }

        uiControl.addSeparator();
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = buildQueue(selectedLines, rewardAction);
        explorationSystem.playDialogueLoop();
    },

    stay: function () {
        if (RPG.State.mode !== "base") return;

        // Build 14.2.0: Chapter 1 Finale Trigger
        if (RPG.State.storyPhase === 6) {
            Cinematics.playChapter1FinaleNight();
            return;
        }

        if (RPG.State.currentHP >= RPG.State.maxHP) {
            uiControl.addLog("カイン「今はまだ休む必要はないな。」");
            return;
        }
        if (!RPG.State.canStay) {
            uiControl.addLog("宿屋の主人「悪いが、そう何度も部屋は貸せねえよ。」");
            return;
        }

        const shouldPlayFirstInnSleep =
            RPG.State.storyPhase === 1 &&
            RPG.State.flags.firstInnSleep === false;

        if (shouldPlayFirstInnSleep) {
            RPG.State.mode = "event";
            RPG.State.canStay = false;
            RPG.State.dialogueQueue = [];

            const startingHP = RPG.State.currentHP;
            const targetHP = Math.max(startingHP, Math.floor(RPG.State.maxHP * (2 / 3)));
            const recoveryAmount = Math.max(0, targetHP - startingHP);

            RPG.State.dialogueQueue.push(
                { text: "物置には樽と袋が積まれている。" },
                { text: "干し草の匂いがうっすら漂っている。" },
                { text: "カイン「…もう寝よう」" },
                { text: "カインはオーエンの手を掴んだ。" },
                { text: "オーエン「何で掴むの？」", color: "#a020f0" },
                { text: "カイン「いなくなられると困るから」" },
                { text: "オーエン「…へえ？そんなので止められると思う？」", color: "#a020f0" },
                { text: "カイン「………正直、わからない。何も。だから、わかりたいと思う。」" },
                { text: "オーエン「……」", color: "#a020f0" },
                { text: "カインの寝息が聞こえてくる。" },
                { text: "オーエン「……は？」", color: "#a020f0" },
                { text: "オーエンは決まりが悪そうに座り直した。" },
                { text: "オーエン「全然意味がわからない」", color: "#a020f0" },
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
                    delay: 3000,
                    action: () => {
                        const logContainer = document.getElementById('logContainer');
                        if (logContainer) {
                            logContainer.innerHTML = '';
                            logContainer.classList.remove('night-mode');
                        }

                        const hpFill = document.getElementById('hpFill');
                        if (hpFill) hpFill.style.transition = "width 2.0s ease-out";

                        RPG.State.currentHP = targetHP;
                        RPG.State.isPoisoned = false;
                        RPG.State.flags.matamatabiActive = false;
                        RPG.State.matamatabiStepsRemaining = 0;
                        RPG.State.flags.firstInnSleep = true;
                        uiControl.updateUI();
                    }
                },
                { text: "朝になった！" },
                { text: "オーエンは離れたところで丸くなって眠っている。" },
                { text: "カイン（…なるべく早く、ここも出た方がいいな）" },
                {
                    text: "さあ出発だ。",
                    action: () => {
                        if (recoveryAmount > 0) {
                            uiControl.addLog(`HPが ${recoveryAmount} 回復した。`);
                        }

                        setTimeout(() => {
                            const hpFill = document.getElementById('hpFill');
                            if (hpFill) hpFill.style.transition = "width 0.3s ease";
                        }, 1000);

                        uiControl.updateUI();
                    }
                }
            );

            explorationSystem.playDialogueLoop();
            return;
        }

        RPG.State.mode = "event";
        RPG.State.canStay = false;
        RPG.State.dialogueQueue = [];

        // PRE-CALCULATE ALL VARIABLES UPFRONT (exactly like showDefeatSequence)
        const event = this.selectInnEvent();
        const morningResult = event.morningOptions[Math.floor(Math.random() * event.morningOptions.length)];
        const recoveryAmount = Math.floor(RPG.State.maxHP * morningResult.rate);
        const morningLines = morningResult.text.split('\n').filter(l => l.trim() !== "");

        // BUILD INITIAL DIALOGUES (snappy 800ms pacing)
        let baseDialogues = [];
        if (event.id === "daughter_room" && RPG.State.silverCoins > 0) {
            if (RPG.State.silverCoins === 1) {
                baseDialogues = RPG.Assets.GAME_TEXT.innEvents.daughterRoom.coin1.map(d => ({ ...d, delay: d.delay || 800 }));
            } else {
                baseDialogues = RPG.Assets.GAME_TEXT.innEvents.daughterRoom.coinMultiple.map(d => ({ ...d, delay: d.delay || 800 }));
            }
        } else {
            const raw = (event.isViewed ? [...(event.shortDialogue || [])] : [...(event.dialogue || [])]); // Added fallback check
            baseDialogues = raw.map(d => ({ ...d, delay: 800 }));
        }
        event.isViewed = true;

        // ========================================
        // BUILD COMPLETE QUEUE UPFRONT (NO MID-EXECUTION MODIFICATIONS)
        // ========================================

        // ① Initial dialogues
        baseDialogues.forEach(d => RPG.State.dialogueQueue.push(d));

        // ② Sleep message + BLACKOUT START (mirroring showDefeatSequence line 162-169)
        RPG.State.dialogueQueue.push({
            text: "（カインは眠りについた……）",
            delay: 2000,
            action: () => {
                console.log("Blackout Start");
                const logContainer = document.getElementById('logContainer');
                if (logContainer) logContainer.classList.add('night-mode');
            }
        });

        // ③ Dark wait (3s) - EXACTLY like defeat sequence (mirroring line 172-181)
        RPG.State.dialogueQueue.push({
            text: null,
            delay: 3000,
            action: () => {
                // HP Recovery with slow animation
                const hpFill = document.getElementById('hpFill');
                if (hpFill) hpFill.style.transition = "width 3.0s ease-out";

                RPG.State.currentHP = Math.min(RPG.State.maxHP, RPG.State.currentHP + recoveryAmount);
                RPG.State.mood = Math.max(0, Math.min(100, RPG.State.mood + (morningResult.mood || 0)));
                RPG.State.isPoisoned = false;
                RPG.State.flags.matamatabiActive = false;
                RPG.State.matamatabiStepsRemaining = 0;
                uiControl.updateUI();
            }
        });

        // ④ Morning text lines (BUILD ALL UPFRONT - not during execution)
        morningLines.forEach(line => {
            RPG.State.dialogueQueue.push({
                text: line,
                delay: 1000
            });
        });

        // ⑤ Wake up - BLACKOUT END (mirroring showDefeatSequence line 204-214)
        RPG.State.dialogueQueue.push({
            text: null,
            delay: 1000,
            action: () => {
                console.log("Blackout End");
                const logContainer = document.getElementById('logContainer');
                if (logContainer) logContainer.classList.remove('night-mode');

                uiControl.addLog(`HPが ${recoveryAmount} 回復した。`);

                // Build 8.58: Mark that player has slept after meeting thief
                if (RPG.State.flags.metThiefBoy === true) {
                    RPG.State.flags.hasSleptAfterThief = true;
                    console.log("DEBUG: hasSleptAfterThief set to true after sleeping");
                }

                // Reset HP bar transition speed
                setTimeout(() => {
                    const hpFill = document.getElementById('hpFill');
                    if (hpFill) hpFill.style.transition = "width 0.3s ease";
                }, 1000);

                uiControl.updateUI();
            }
        });

        // START EXECUTION (exactly like showDefeatSequence line 216)
        explorationSystem.playDialogueLoop();
    },

    // Build 8.26.1: Defeat Sequence logic
    showDefeatSequence: function (defeatedEnemyId = null) {
        if (RPG.State.deathCount >= 3) {
            this.showBadEnd();
            return;
        }

        const eventIndex = RPG.State.deathCount;
        const scenario = RPG.Assets.GAME_TEXT.inn.defeatEvents[eventIndex];
        const isFirstAmberTreeDefeat =
            defeatedEnemyId === "hungry_amber_tree" &&
            RPG.State.flags.treeFirstDefeat === false;
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [];

        // ① 「カインは傷つき、倒れた…」の後の「ため」
        RPG.State.dialogueQueue.push({ text: "", delay: 2000 });

        // ② 「気が遠くなった」をゆっくり表示
        RPG.State.dialogueQueue.push({
            text: "カインの意識は遠くなった…",
            delay: 2000, // 表示してからフェード開始まで2秒待つ
            action: () => {
                const logContainer = document.getElementById('logContainer');
                if (logContainer) logContainer.classList.add('night-mode');
            }
        });

        // ③ 暗転（3秒）を待つ
        RPG.State.dialogueQueue.push({
            text: "",
            delay: 3000, // 暗転時間を3秒に
            action: () => {
                RPG.State.deathCount++;
                // ここではまだHPを回復させない
                const logContainer = document.getElementById('logContainer');
                if (logContainer) logContainer.innerHTML = '';
            }
        });

        // ④ 初回の飢えた琥珀樹敗北時のみ、専用ルートへ分岐
        if (isFirstAmberTreeDefeat) {
            // First, actually arrive at the inn and restore visibility
            RPG.State.dialogueQueue.push({
                text: "",
                delay: 1000,
                action: () => {
                    const logContainer = document.getElementById('logContainer');
                    if (logContainer) logContainer.classList.remove('night-mode');

                    this.enterInn(false);
                    RPG.State.currentHP = Math.floor(RPG.State.maxHP * 0.1);
                    RPG.State.isPoisoned = false;
                    uiControl.updateUI();
                }
            });

            // Then, play the one-time special dialogue in readable state
            RPG.State.dialogueQueue.push(
                { text: "カインは宿屋の物置で目を覚ました。" },
                { text: "まだ息苦しさが残っているような気がして、深呼吸する。" },
                { text: "カイン「……あれ、あの、木の化け物に」" },
                { text: "オーエン「めちゃくちゃにされてた。あんな雑魚に」", color: "#a020f0" },
                { text: "オーエンは木箱に座って足を組んでいた。", color: "#888888" },
                { text: "カイン（まさか助けてくれたのか？）", color: "#888888" },
                { text: "顔や身体についた樹液も綺麗に無くなっている。", color: "#888888" },
                { text: "カイン（どうやったんだろう…）", color: "#888888" },
                { text: "オーエン「…何」", color: "#a020f0" },
                { text: "じろ、とオーエンが睨んできた。", color: "#888888" },
                { text: "カイン「…ありがとな」" },
                {
                    text: "さあ出発だ。",
                    action: () => {
                        RPG.State.flags.treeFirstDefeat = true;
                    }
                }
            );

            explorationSystem.playDialogueLoop();
            return;
        }

        // ⑤ 宿屋に移動（ここで場所名を表示）
        RPG.State.dialogueQueue.push({
            text: "",
            delay: 1000,
            action: () => {
                this.enterInn(); // 宿屋の場所名を表示
                // 宿屋についてからHPを10%にする
                RPG.State.currentHP = Math.floor(RPG.State.maxHP * 0.1);
                RPG.State.isPoisoned = false;
                uiControl.updateUI(); // ゲージを動かす
            }
        });

        // ⑥ 通常敗北時のシナリオテキストは宿屋到着後に表示
        if (scenario && scenario.text) {
            scenario.text.forEach(t => {
                RPG.State.dialogueQueue.push({ text: t, delay: 2500 });
            });
        }

        // ⑦ 目覚め（フェード解除）
        RPG.State.dialogueQueue.push({
            text: "",
            delay: 1000,
            action: () => {
                const logContainer = document.getElementById('logContainer');
                if (logContainer) logContainer.classList.remove('night-mode');

                this.enterInn(false); // ★引数に false を渡して挨拶をスキップ
                uiControl.updateUI();
            }
        });

        explorationSystem.playDialogueLoop();
    },

    // Build 8.25: Bad End "The Burning of Amber Forest"
    showBadEnd: function () {
        RPG.State.mode = "event";
        RPG.State.location = "ーー？？？ーー"; // ★場所名を謎にする
        uiControl.updateUI(); // UIに反映
        uiControl.updateControlPanels();

        // Logic:
        // 1. Initial 1.5s delay
        // 2. Common Text
        // 3. Wait 1.5s -> Fade Out
        // 4. Wait 3.0s -> Show Bad End Text

        RPG.State.dialogueQueue = [];

        // Step 1: Initial Delay
        RPG.State.dialogueQueue.push({ text: "", delay: 1500, action: null });

        // Step 2: Common Text & Fade Trigger
        RPG.State.dialogueQueue.push({
            text: RPG.Assets.GAME_TEXT.inn.commonDefeat,
            delay: 1500,
            action: () => {
                const logContainer = document.getElementById('logContainer');
                if (logContainer) logContainer.classList.add('night-mode');
            }
        });

        // Step 3: Wait for Fade (3s) -> Clear Screen
        RPG.State.dialogueQueue.push({
            text: "",
            delay: 3000,
            action: () => {
                const logContainer = document.getElementById('logContainer');
                if (logContainer) {
                    logContainer.innerHTML = '';
                    logContainer.classList.remove('night-mode');
                }
                RPG.State.deathCount++; // Final increment
            }
        });

        // Queue Bad End Text
        const badEndTexts = RPG.Assets.GAME_TEXT.inn.badEnd;
        if (badEndTexts) {
            badEndTexts.forEach(t => {
                RPG.State.dialogueQueue.push({ text: t, delay: 2000 });
            });
        }

        // Final Action: Show "Return to Title" button
        RPG.State.dialogueQueue.push({
            text: "",
            delay: 1000,
            action: () => {
                const btnContainer = document.getElementById('action-buttons');
                if (btnContainer) {
                    btnContainer.innerHTML = '';
                    const btn = document.createElement('button');
                    btn.className = 'btn btn-full btn-accent';
                    btn.textContent = 'タイトルへ戻る';
                    btn.onclick = () => location.reload();
                    btnContainer.appendChild(btn);
                }
            }
        });

        explorationSystem.playDialogueLoop();
    },

    // Build 6.3.6: Observe Button with Silver Coin Branching
    observe: function () {
        if (RPG.State.mode !== "base") return;

        if (this.shouldUsePhase4FortuneRoute()) {
            uiControl.addSeparator();
            RPG.State.mode = "event";

            const canDeliverGlowingRabbitFur =
                RPG.State.flags.needsGlowingRabbitFur === true &&
                (RPG.State.inventory.glowingCatRabbitFur || 0) > 0;

            if (canDeliverGlowingRabbitFur) {
                RPG.State.dialogueQueue = this.buildDialogueQueue(
                    RPG.Assets.GAME_TEXT.events.phase4FortuneDelivery,
                    () => {
                        RPG.State.inventory.glowingCatRabbitFur = Math.max(
                            0,
                            (RPG.State.inventory.glowingCatRabbitFur || 0) - 1
                        );
                        RPG.State.flags.needsGlowingRabbitFur = false;
                        RPG.State.flags.thiefDiscoveryStatus = 1;
                        RPG.State.flags.thiefTrackActive = false;
                        uiControl.updateUI();
                    }
                );
                explorationSystem.playDialogueLoop();
                return;
            }

            if (RPG.State.flags.phase4FortuneConsultDone !== true) {
                RPG.State.dialogueQueue = this.buildDialogueQueue(
                    RPG.Assets.GAME_TEXT.events.phase4FortuneConsult,
                    () => {
                        RPG.State.flags.phase4FortuneConsultDone = true;
                        RPG.State.flags.needsGlowingRabbitFur = true;
                        uiControl.updateUI();
                    }
                );
                explorationSystem.playDialogueLoop();
                return;
            }

            RPG.State.dialogueQueue = this.buildDialogueQueue(
                RPG.Assets.GAME_TEXT.events.phase4OwenConsult1,
                () => {
                    RPG.State.flags.phase4OwenConsultCount = Math.max(
                        RPG.State.flags.phase4OwenConsultCount || 0,
                        1
                    );
                    uiControl.updateUI();
                }
            );
            explorationSystem.playDialogueLoop();
            return;
        }

        const shouldPlayInnRatEvent =
            RPG.State.storyPhase === 1 &&
            RPG.State.flags.innRatEvent === false;

        if (shouldPlayInnRatEvent) {
            uiControl.addSeparator();
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                { text: "ロビーの隅で、何かが動いた。" },
                { text: "看板娘「きゃっ」" },
                { text: "袋の影から、小さな影が飛び出す。" },
                { text: "ネズミが現れた！" },
                {
                    text: null,
                    action: () => {
                        RPG.State.flags.innRatEvent = true;
                        battleSystem.startBattle('normal_rat');
                    }
                }
            ];
            explorationSystem.playDialogueLoop();
            return;
        }

        const shouldPlayInnRatEvent2 =
            RPG.State.storyPhase >= 3 &&
            RPG.State.flags.innRatEvent2 === false;

        if (shouldPlayInnRatEvent2) {
            uiControl.addSeparator();
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                { text: "煙がこもっている。" },
                { text: "店主がドアを開けた。" },
                { text: "冷たい空気が流れ込み、ランプの火が揺れた。" },
                { text: "次の瞬間、赤い目の大きな影が飛び込んできた！" },
                { text: "犬ほどもある巨大なネズミが、床を滑るように走る。" },
                { text: "娘「きゃああっ！？」" },
                { text: "カイン「下がってろ！」" },
                { text: "カインは素早く剣を抜いた。" },
                { text: "魔界のネズミが現れた！" },
                {
                    text: null,
                    action: () => {
                        RPG.State.flags.innRatEvent2 = true;
                        RPG.State.flags.innRatEvent2BattleActive = true;
                        battleSystem.startBattle('rat');
                    }
                }
            ];
            explorationSystem.playDialogueLoop();
            return;
        }

        const observeData = RPG.Assets.GAME_TEXT.innObserve;
        const maxDefinedPhase = Math.max(...Object.keys(observeData).map(Number));
        const currentPhase = Math.min(RPG.State.storyPhase, maxDefinedPhase);

        if (typeof RPG.State.observeIndex !== "number") {
            RPG.State.observeIndex = 0;
        }
        if (!RPG.State.observePhaseReached || typeof RPG.State.observePhaseReached !== "object") {
            RPG.State.observePhaseReached = {};
        }
        if (RPG.State.observeIndex > currentPhase) {
            RPG.State.observeIndex = currentPhase;
        }

        const getUnreadLimit = (phase) => {
            const phaseData = observeData[phase];
            if (!phaseData) return 0;
            if (phase === 4 && currentPhase >= 5) return 2;
            return phaseData.loop - 1;
        };

        const buildDialogue = (lines, action = null) => {
            const queue = lines.map(text => ({ text }));
            if (action) {
                queue.push({ text: null, action });
            }
            return queue;
        };

        let selectedPhase = null;
        let selectedEntry = null;

        for (let phase = RPG.State.observeIndex; phase <= currentPhase; phase++) {
            const phaseData = observeData[phase];
            const unreadLimit = getUnreadLimit(phase);
            const reached = RPG.State.observePhaseReached[phase] || 0;
            const nextEntry = reached + 1;

            if (phaseData && nextEntry <= unreadLimit) {
                selectedPhase = phase;
                selectedEntry = nextEntry;
                RPG.State.observePhaseReached[phase] = nextEntry;
                RPG.State.observeIndex = nextEntry >= unreadLimit ? Math.min(phase + 1, currentPhase) : phase;
                break;
            }
        }

        if (selectedPhase === null) {
            selectedPhase = currentPhase;
            selectedEntry = observeData[currentPhase].loop;
            RPG.State.observeIndex = currentPhase;
        }

        let postAction = null;
        if (selectedPhase === 6 && selectedEntry === 2) {
            postAction = () => {
                RPG.State.inventory.herb = (RPG.State.inventory.herb || 0) + 3;
                uiControl.updateUI();
            };
        }

        uiControl.addSeparator();
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = buildDialogue(observeData[selectedPhase][selectedEntry], postAction);
        explorationSystem.playDialogueLoop();
    },

    selectInnEvent: function () {
        // 未読優先ロジック: 未読イベントがあれば、その中から抽選。なければ全イベントから抽選。
        let candidates = RPG.Assets.INN_EVENTS.filter(e => !e.isViewed);
        if (candidates.length === 0) {
            candidates = RPG.Assets.INN_EVENTS;
        }

        const totalWeight = candidates.reduce((sum, e) => sum + e.weight, 0);
        let random = Math.random() * totalWeight;

        for (const e of candidates) {
            random -= e.weight;
            if (random < 0) return e;
        }
        return candidates[0];
    },

    deliver: function () {
        // Build 14.1.8: Use Cinematics for delivery event
        if (RPG.State.silverCoins < 3 || RPG.State.mode !== "base") return;

        Cinematics.playSilverDeliveryEvent();
    }
};

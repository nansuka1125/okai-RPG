// 🚩ーー【宿屋・拠点システム】ーー
// Build 8.16: Extracted from main.js for better code organization
innSystem = {
    getAutomaticMorningTrainingId: function () {
        const state = RPG.State;
        const flags = state.flags;

        // Training 1 belongs to the quiet window after the amber tree, before the thief route begins.
        if (
            state.storyPhase === 2 &&
            flags.treeDefeated === true &&
            flags.morningTraining1Done !== true &&
            flags.readyForThiefBoy !== true &&
            flags.metThiefBoy !== true
        ) {
            return "morningTraining1";
        }

        // Phase 3 is consumed by theft discovery. Resume this low-priority scene after the fortune request instead.
        if (
            state.storyPhase >= 4 &&
            state.storyPhase <= 6 &&
            flags.phase4FortuneConsultDone === true &&
            flags.morningTraining2Done !== true
        ) {
            return "morningTraining2";
        }

        return null;
    },

    canScheduleMorningTraining3: function () {
        const state = RPG.State;
        return (
            state.storyPhase >= 4 &&
            state.storyPhase <= 6 &&
            state.flags.morningTraining2Done === true &&
            state.flags.morningTraining3Done !== true
        );
    },

    canPlayPhase6BlacksmithMorning: function () {
        const state = RPG.State;
        const flags = state.flags;
        return (
            state.storyPhase === 6 &&
            flags.phase6PostDeliverySleepDone === true &&
            flags.wagonInfoHeard === true &&
            flags.phase6BlacksmithMorningSeen !== true &&
            flags.wagonReadyForDeparture !== true
        );
    },

    canTalkToPhase6Blacksmith: function () {
        const state = RPG.State;
        const flags = state.flags;
        return (
            state.storyPhase === 6 &&
            flags.phase6BlacksmithAvailable === true &&
            flags.phase6BlacksmithTalked !== true &&
            flags.wagonReadyForDeparture !== true
        );
    },

    playPhase7SimpleStay: function () {
        const state = RPG.State;
        const recoveryAmount = Math.max(0, state.maxHP - state.currentHP);

        state.mode = "event";
        state.canStay = false;
        state.dialogueQueue = [
            { text: "カインはぐっすり眠った…" },
            {
                text: null,
                action: () => {
                    const logContainer = document.getElementById("logContainer");
                    if (logContainer) logContainer.classList.add("night-mode");
                }
            },
            {
                text: null,
                delay: 3000,
                action: () => {
                    state.currentHP = state.maxHP;
                    this.refreshHerbGardenHarvestsAfterStay();
                    state.isPoisoned = false;
                    state.poisonDamageRemaining = 0;
                    state.flags.matamatabiActive = false;
                    state.matamatabiStepsRemaining = 0;
                    uiControl.updateUI();
                }
            },
            {
                text: null,
                action: () => {
                    const logContainer = document.getElementById("logContainer");
                    if (logContainer) logContainer.classList.remove("night-mode");
                }
            },
            { text: "朝になった！" },
            {
                text: "カイン（さあ、出発だ）",
                action: () => {
                    if (recoveryAmount > 0) {
                        uiControl.addLog(`HPが ${recoveryAmount} 回復した。`, "", "#9acd32");
                    }
                }
            }
        ];

        explorationSystem.playDialogueLoop();
    },

    buildPhase6BlacksmithMorningQueue: function (recoveryAmount = 0) {
        return [
            ...(RPG.Assets.GAME_TEXT.events.phase6BlacksmithMorning || []).map(text => ({ text })),
            {
                text: null,
                action: () => {
                    RPG.State.flags.phase6BlacksmithMorningSeen = true;
                    RPG.State.flags.phase6BlacksmithAvailable = true;
                    if (recoveryAmount > 0) {
                        uiControl.addLog(`HPが ${recoveryAmount} 回復した。`);
                    }
                    uiControl.updateUI();
                }
            }
        ];
    },

    moveToInnFrontForMorning: function () {
        RPG.State.isAtInn = false;
        RPG.State.isInDungeon = false;
        RPG.State.explorationArea = null;
        RPG.State.currentDistance = 0;
        RPG.State.location = "宿屋前";
        RPG.State.currentInnTalkLoop = null;
    },

    buildMorningTrainingQueue: function (trainingId, recoveryAmount = 0) {
        const lines = RPG.Assets.GAME_TEXT.events[trainingId] || [];
        const doneFlag = `${trainingId}Done`;

        return [
            { text: RPG.Assets.GAME_TEXT.inn.locationFront, type: "marker" },
            ...lines.map(text => ({ text })),
            {
                text: null,
                action: () => {
                    RPG.State.flags[doneFlag] = true;
                    if (recoveryAmount > 0) {
                        uiControl.addLog(`HPが ${recoveryAmount} 回復した。`, "", "#9acd32");
                    }
                    uiControl.updateUI();
                }
            }
        ];
    },

    playMorningTraining3: function () {
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            ...(RPG.Assets.GAME_TEXT.events.morningTraining3 || []).map(text => ({ text })),
            {
                text: null,
                action: () => {
                    RPG.State.flags.morningTraining3Pending = false;
                    RPG.State.flags.morningTraining3Done = true;
                    uiControl.updateUI();
                }
            }
        ];
        explorationSystem.playDialogueLoop();
    },

    refreshHerbGardenHarvestsAfterStay: function () {
        RPG.State.flags.herbGardenHerb1Available = true;

        if (
            RPG.State.flags.carnivorousVineDefeated === true &&
            RPG.State.flags.carnivorousVineRegrown !== true
        ) {
            RPG.State.flags.carnivorousVineStayCount = (RPG.State.flags.carnivorousVineStayCount || 0) + 1;
            if (RPG.State.flags.carnivorousVineStayCount >= 3) {
                RPG.State.flags.carnivorousVineRegrown = true;
            }
        }
    },

    shouldUsePhase4FortuneRoute: function () {
        return (
            RPG.State.storyPhase === 4 &&
            RPG.State.flags.phase4TheftDiscovered === true &&
            RPG.State.flags.thiefDiscoveryStatus === 0
        );
    },

    shouldUsePhase6HerbGardenFortuneRoute: function () {
        return (
            RPG.State.storyPhase === 6 &&
            RPG.State.flags.herbGardenFortuneConsultUnlocked === true &&
            (
                RPG.State.flags.herbGardenBroochGranted !== true ||
                RPG.State.flags.herbGardenFortuneFollowupDone !== true
            )
        );
    },

    needsPhase6ScentPouchMaterialBriefing: function () {
        return (
            RPG.State.storyPhase === 6 &&
            RPG.State.flags.scentPouchQuestStarted === true &&
            RPG.State.flags.herbGardenBroochGranted === true &&
            RPG.State.flags.herbGardenFortuneFollowupDone !== true
        );
    },

    needsPhase6EmptyBottle: function () {
        return (
            RPG.State.storyPhase === 6 &&
            RPG.State.flags.scentPouchQuestStarted === true &&
            RPG.State.flags.herbGardenFortuneFollowupDone === true &&
            RPG.State.flags.herbGardenBoneMealCollected !== true &&
            RPG.State.flags.herbGardenEmptyBottleBorrowed !== true &&
            (RPG.State.inventory.emptyBottle || 0) <= 0
        );
    },

    getInnTalkCommandLabel: function () {
        if (
            RPG.State.storyPhase !== 6 ||
            RPG.State.flags.phase6PostDeliverySleepDone !== true
        ) {
            return "話す";
        }

        const requiredPhase6TalkFlags = [
            "phase6WagonMapTalkDone",
            "wagonInfoHeard",
            "phase6RoomTalkDone"
        ];
        if (requiredPhase6TalkFlags.some(flag => RPG.State.flags[flag] !== true)) {
            return "話す";
        }

        if (
            RPG.State.flags.wagonInfoHeard === true &&
            RPG.State.flags.wagonHorseEncouraged !== true
        ) {
            return "話す";
        }

        if (
            RPG.State.flags.wagonHorseEncouraged === true &&
            RPG.State.flags.scentPouchQuestStarted === true
        ) {
            if (RPG.State.flags.scentPouchInfoHeard !== true) {
                return "香草袋について聞く";
            }
            if (RPG.State.flags.scentPouchInfoFollowupDone !== true) {
                return "もっと話す";
            }
        }

        if (this.needsPhase6EmptyBottle()) {
            return "空き瓶について聞く";
        }

        return "話す";
    },

    isInnTalkEntryAvailable: function (phase, entryNumber) {
        const availability = RPG.Assets.TALK_DATA.innTalk.availability || {};
        const phaseRules = availability[phase] || {};
        const rule = phaseRules[entryNumber];
        return typeof rule !== "function" || rule(RPG.State);
    },

    isInnObserveEntryAvailable: function (phase, entryNumber) {
        const availability = RPG.Assets.GAME_TEXT.innObserveAvailability || {};
        const phaseRules = availability[phase] || {};
        const rule = phaseRules[entryNumber];
        return typeof rule !== "function" || rule(RPG.State);
    },

    shouldUsePhase6HerbGardenMaterialHint: function () {
        const inventory = RPG.State.inventory;
        return (
            RPG.State.storyPhase === 6 &&
            RPG.State.flags.scentPouchQuestStarted === true &&
            RPG.State.flags.scentPouchCrafted !== true &&
            RPG.State.flags.herbGardenBroochGranted === true &&
            RPG.State.flags.herbGardenFortuneFollowupDone === true &&
            ((inventory.mintFlower || 0) <= 0 || (inventory.boneMeal || 0) <= 0)
        );
    },

    shouldUsePhase6HerbGardenBroochReturn: function () {
        const inventory = RPG.State.inventory;
        return (
            RPG.State.storyPhase === 6 &&
            RPG.State.flags.scentPouchQuestStarted === true &&
            RPG.State.flags.herbGardenBroochGranted === true &&
            RPG.State.flags.herbGardenFortuneFollowupDone === true &&
            RPG.State.flags.herbGardenBroochReturned !== true &&
            (inventory.mintFlower || 0) > 0 &&
            (inventory.boneMeal || 0) > 0
        );
    },

    getPhase6HerbGardenMaterialHint: function () {
        const hasMint = (RPG.State.inventory.mintFlower || 0) > 0;
        const hasBoneMeal = (RPG.State.inventory.boneMeal || 0) > 0;

        if (hasBoneMeal && !hasMint) {
            return RPG.Assets.GAME_TEXT.events.phase6HerbGardenMaterialHintBoneOnly;
        }
        if (hasMint && !hasBoneMeal) {
            return RPG.Assets.GAME_TEXT.events.phase6HerbGardenMaterialHintMintOnly;
        }
        return RPG.Assets.GAME_TEXT.events.phase6HerbGardenMaterialHintNone;
    },

    showPhase6HerbGardenBroochChoices: function () {
        RPG.State.mode = "choice";
        uiControl.updateUI();

        const hasGlowingBrooch = (RPG.State.inventory.glowingBrooch || 0) > 0;
        const choices = [];

        if (RPG.State.flags.herbGardenOwenJewelChecked !== true) {
            choices.push({
                label: "オーエンの宝石飾り",
                action: () => {
                    RPG.State.mode = "event";
                    RPG.State.dialogueQueue = this.buildDialogueQueue(
                        RPG.Assets.GAME_TEXT.events.phase6HerbGardenOwenJewel,
                        () => {
                            RPG.State.flags.herbGardenOwenJewelChecked = true;
                            this.showPhase6HerbGardenBroochChoices();
                        }
                    );
                    explorationSystem.playDialogueLoop();
                }
            });
        }

        choices.push({
            label: hasGlowingBrooch ? "光るブローチ" : "他のものを探す",
            action: () => {
                if (!hasGlowingBrooch) {
                    RPG.State.mode = "base";
                    uiControl.updateUI();
                    return;
                }

                RPG.State.mode = "event";
                RPG.State.dialogueQueue = this.buildDialogueQueue(
                    RPG.Assets.GAME_TEXT.events.phase6HerbGardenBrooch,
                    () => {
                        RPG.State.inventory.glowingBrooch = Math.max(
                            0,
                            (RPG.State.inventory.glowingBrooch || 0) - 1
                        );
                        RPG.State.inventory.lightRabbitBrooch = (RPG.State.inventory.lightRabbitBrooch || 0) + 1;
                        RPG.State.flags.herbGardenBroochGranted = true;
                        RPG.State.mode = "base";
                        uiControl.updateUI();
                    }
                );
                explorationSystem.playDialogueLoop();
            }
        });

        [document.getElementById("btnChoiceA"), document.getElementById("btnChoiceB")]
            .forEach((button, index) => {
                if (!button) return;
                const choice = choices[index];
                button.style.display = choice ? "flex" : "none";
                if (!choice) return;

                button.textContent = choice.label;
                button.style.background = "";
                button.disabled = choice.disabled === true;
                button.style.opacity = choice.disabled ? "0.25" : "1";
                button.style.pointerEvents = choice.disabled ? "none" : "auto";
                button.onclick = choice.action;
            });
    },

    buildDialogueQueue: function (lines, action = null) {
        const queue = lines.map(text => ({ text }));
        if (action) {
            queue.push({ text: null, action });
        }
        return queue;
    },

    hasSeenGlowingCatRabbit: function () {
        const flags = RPG.State.flags;
        return (
            flags.glowCatRabbitPhase4EncounterSeen === true ||
            flags.glowCatRabbitTalkLv5Done === true ||
            flags.glowCatRabbitTalkLv10Done === true ||
            flags.glowCatRabbitTalkLv15Done === true ||
            flags.glowCatRabbitTalkLv20Done === true ||
            (RPG.State.glowCatRabbitDefeatCount || 0) > 0
        );
    },

    showPhase4SweetDeliveryButton: function () {
        const container = document.getElementById('action-buttons');
        const choiceUI = document.getElementById('choiceUI');
        if (!container) return;

        container.innerHTML = '';
        container.style.display = 'flex';
        if (choiceUI) choiceUI.style.display = 'none';

        const button = document.createElement('button');
        button.id = 'btnChoiceA';
        button.className = 'btn btn-full';
        button.textContent = '甘いものを納品';
        button.onclick = () => {
            container.innerHTML = '';
            container.style.display = 'none';
            RPG.State.mode = 'event';
            RPG.State.dialogueQueue = this.buildDialogueQueue(
                RPG.Assets.GAME_TEXT.events.phase4SweetDeliveryResponse,
                () => {
                    RPG.State.flags.phase4SweetDeliveryDone = true;
                    uiControl.updateUI();
                }
            );
            explorationSystem.playDialogueLoop();
        };

        container.appendChild(button);
        RPG.State.mode = 'choice';
    },

    playMatamatabiNight: function () {
        const state = RPG.State;
        const startingHP = state.currentHP;
        const recoveryAmount = Math.max(0, state.maxHP - startingHP);

        state.mode = "event";
        state.canStay = false;
        state.flags.matamatabiNightPending = false;
        state.flags.matamatabiNightSeen = true;

        const nightLines = RPG.Assets.GAME_TEXT.events.phase4MatamatabiNight || [];
        const morningLines = RPG.Assets.GAME_TEXT.events.phase4MatamatabiNightMorning || [];
        state.dialogueQueue = [
            {
                text: null,
                delay: 0,
                action: () => uiControl.beginSceneLogFocus()
            },
            { text: null, delay: 650 },
            {
                text: "【マタマタビの夜】",
                type: "marker",
                color: "#f1e6c8",
                fontSize: "20px",
                delay: 1700,
                autoAdvance: true
            },
            ...nightLines.map(text => ({ text })),
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
                    const hpFill = document.getElementById('hpFill');
                    if (hpFill) hpFill.style.transition = "width 2.0s ease-out";

                    state.currentHP = state.maxHP;
                    this.refreshHerbGardenHarvestsAfterStay();
                    state.isPoisoned = false;
                    state.flags.matamatabiActive = false;
                    state.matamatabiStepsRemaining = 0;
                    uiControl.updateUI();
                }
            },
            {
                text: null,
                delay: 1000,
                action: () => {
                    const logContainer = document.getElementById('logContainer');
                    if (logContainer) logContainer.classList.remove('night-mode');
                }
            },
            ...morningLines.map(text => ({ text })),
            {
                text: null,
                action: () => {
                    if (recoveryAmount > 0) {
                        uiControl.addLog(`HPが ${recoveryAmount} 回復した。`);
                    }

                    setTimeout(() => {
                        const hpFill = document.getElementById('hpFill');
                        if (hpFill) hpFill.style.transition = "width 0.3s ease";
                    }, 1000);

                    uiControl.endSceneLogFocus();
                    uiControl.updateUI();
                }
            }
        ];

        state.dialogueQueue.forEach(line => {
            if (!line.text || line.type === "marker" || line.action) return;
            line.typewriter = true;
            line.typeSpeed = line.text.startsWith("オーエン") ? 30 : 21;
        });

        explorationSystem.playDialogueLoop();
    },

    playNightMedicineSleep: function () {
        const state = RPG.State;
        const startingHP = state.currentHP;
        const recoveryAmount = Math.max(0, state.maxHP - startingHP);

        state.mode = "event";
        state.canStay = false;
        state.flags.nightMedicineAftermathPending = true;

        state.dialogueQueue = [
            { text: null, action: () => uiControl.beginSceneLogFocus() },
            { text: null, delay: 650 },
            { text: "カインは💊夜の薬を飲んだ！", type: "marker", color: "#f1e6c8" },
            { text: "オーエン「よく平気で飲むよね」" },
            { text: "カイン「寝る前に飲んだら、回復するとか」" },
            { text: "オーエン「いつもぐっすり眠ってるじゃない」" },
            { text: "カイン（…何かあればすぐ起きれるようにしてるつもりなんだが）" },
            { text: "しばらくすると、じわじわと身体が温まってくる。むず痒いような熱が身体の中心に集まってくる。" },
            { text: "カイン「…っ…はあ…」" },
            { text: "カイン（「夜の薬」って、こっちの意味か……！ しまった）" },
            { text: "身体が熱い。シャツもベルトも、肌に触れるものすべてが、くすぐったいような妙な刺激になっている。" },
            { text: "カイン「……オーエン。少し離れてくれ」" },
            { text: "オーエン「いいよ」" },
            { text: "カイン「いや、この部屋からは出るな。そこにいてくれ。あと、こっちを見るな」" },
            { text: "オーエン「何それ」" },
            { text: "カイン「……悪い。今だけでいい」" },
            { text: "この状態でオーエンを一人にするわけにはいかない。\nけれど、今の自分を正面から見られるのも耐えがたかった。" },
            { text: "オーエン「どうして？」" },
            { text: "カイン「……いいから」" },
            { text: "オーエン「言えないんだ？」" },
            { text: "カインは答えず、せめてシャツだけでも脱ごうと、震える指をボタンにかけた。" },
            { text: "うまくつまめない。" },
            { text: "カイン「……っ、は……」" },
            { text: "その時、背後の気配が近づいた。" },
            { text: "触れてはいない。\nそれなのに、すぐ後ろにある体温が分かるほど近い。" },
            { text: "背中をぞくぞくとした感覚が這い上がり、カインの肩が震えた。" },
            { text: "カイン「……あっ！？」" },
            { text: "オーエン「手伝ってあげる」" },
            { text: "オーエンの手が、ボタンにかかったカインの指へ、するりと重なる。" },
            { text: "背後から身体を囲われたような距離だった。\n触れているのは手だけなのに、背中にはオーエンの熱があるように感じる。" },
            { text: "カイン「……いらない……っ。今は、やめてくれ！」" },
            { text: "コンコン、とノックの音。" },
            { text: "娘が部屋に入ってくる。" },
            { text: "娘「カインさん、余ったパンをよろしかったら――…」" },
            { text: "ベッドの上では息を切らしたカインに、後ろから抱き抱えるようにオーエンが腕を回していた。二人の手はボタンにかかっている。" },
            { text: "宿屋の娘「……っ、す、すみません！」" },
            { text: "娘は盆を抱えたまま、勢いよく扉を閉めた。" },
            { text: "――――バタン。", type: "marker", color: "#f1e6c8" },
            {
                text: null,
                action: () => {
                    const logContainer = document.getElementById("logContainer");
                    if (logContainer) logContainer.classList.add("night-mode");
                }
            },
            {
                text: null,
                delay: 3000,
                action: () => {
                    state.currentHP = state.maxHP;
                    this.refreshHerbGardenHarvestsAfterStay();
                    state.isPoisoned = false;
                    state.poisonDamageRemaining = 0;
                    state.flags.matamatabiActive = false;
                    state.matamatabiStepsRemaining = 0;
                    uiControl.updateUI();
                }
            },
            {
                text: null,
                action: () => {
                    const logContainer = document.getElementById("logContainer");
                    if (logContainer) logContainer.classList.remove("night-mode");
                }
            },
            { text: "宿屋で目が覚める。" },
            { text: "カイン「あ、あれ？」" },
            { text: "（昨夜の途中から、全く記憶がない…）" },
            { text: "耳元でオーエンが囁く。" },
            { text: "オーエン「…おもしろかった」" },
            { text: "カイン「うぁっ…！！！」" },
            { text: "オーエン「…なに」" },
            { text: "カイン「…やたら感覚が鋭敏だ。あの薬のせいか？」" },
            { text: "オーエン「そうかもね」" },
            {
                text: "カインの回避が一時的に大幅アップした！",
                type: "marker",
                color: "#f1e6c8",
                action: () => {
                    state.nightMedicineEvasionBattlesRemaining = 5;
                    if (recoveryAmount > 0) {
                        uiControl.addLog(`HPが${recoveryAmount}回復した。`, "", "#9acd32");
                    }
                    uiControl.endSceneLogFocus();
                    uiControl.updateUI();
                }
            }
        ];

        explorationSystem.playDialogueLoop();
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

        if (this.needsPhase6ScentPouchMaterialBriefing()) {
            RPG.Assets.GAME_TEXT.events.phase6HerbGardenNeedMaterialBriefing
                .forEach(line => uiControl.addLog(line));
            uiControl.updateUI();
            return;
        }

        if (this.needsPhase6EmptyBottle()) {
            RPG.Assets.GAME_TEXT.events.phase6HerbGardenNoBottle
                .forEach(line => uiControl.addLog(line));
            uiControl.updateUI();
            return;
        }

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

        if (RPG.State.flags.phase7DepartureMorningTalkPending === true) {
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                { text: "オーエン「おまえの好物の草は持った？」", color: "#cc73ff" },
                { text: "カイン「薬草か？そう言われると馬みたいだな」" },
                { text: "オーエン「好物でしょ。いつも食べてる」", color: "#cc73ff" },
                { text: "カイン（仕方なく食べてるんだが）" },
                {
                    text: null,
                    action: () => {
                        RPG.State.flags.phase7DepartureMorningTalkPending = false;
                        uiControl.updateUI();
                    }
                }
            ];
            explorationSystem.playDialogueLoop();
            return;
        }

        const shouldPlayNightMedicineAftermath =
            RPG.State.flags.nightMedicineAftermathPending === true &&
            RPG.State.flags.nightMedicineAftermathSeen !== true;

        if (shouldPlayNightMedicineAftermath) {
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                { text: "宿屋の娘が、物干し竿に洗濯物を掛けている。" },
                { text: "カイン「……おはよう」" },
                { text: "宿屋の娘「あ……」" },
                { text: "娘はカインの顔を見ると、すぐに目を逸らした。" },
                { text: "宿屋の娘「私、誰にも言いませんから！」" },
                { text: "娘は真っ赤な顔で洗濯籠を抱え、そのまま宿屋へ逃げ込んだ。" },
                { text: "カイン「…………」" },
                { text: "オーエン「ふふ」" },
                {
                    text: "《オーエンは機嫌が良くなった！》",
                    type: "marker",
                    color: "#f1e6c8",
                    action: () => {
                        RPG.State.flags.nightMedicineAftermathPending = false;
                        RPG.State.flags.nightMedicineAftermathSeen = true;
                    }
                }
            ];
            explorationSystem.playDialogueLoop();
            return;
        }

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

        // Low-priority morning scene: let every required departure event resolve first.
        if (
            RPG.State.flags.morningTraining3Pending === true &&
            this.canScheduleMorningTraining3()
        ) {
            this.playMorningTraining3();
            return;
        }

        uiControl.updateUI();
    },

    talk: function () {
        if (RPG.State.mode !== "base") return;

        const talkData = RPG.Assets.TALK_DATA.innTalk;
        const currentPhase = Math.max(0, Math.min(RPG.State.storyPhase, 7));

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

        if (RPG.State.storyPhase === 6 && RPG.State.flags.phase6PostDeliverySleepDone === true) {
            const phase6Talks = [
                {
                    flag: "phase6WagonMapTalkDone",
                    lines: RPG.Assets.GAME_TEXT.events.phase6WagonMapTalk
                },
                {
                    flag: "wagonInfoHeard",
                    lines: RPG.Assets.GAME_TEXT.events.phase6WagonInfoTalk
                },
                {
                    flag: "phase6RoomTalkDone",
                    lines: RPG.Assets.GAME_TEXT.events.phase6RoomTalk
                }
            ];
            const nextPhase6Talk = phase6Talks.find(talk => RPG.State.flags[talk.flag] !== true);

            if (nextPhase6Talk) {
                uiControl.addSeparator();
                RPG.State.mode = "event";
                RPG.State.dialogueQueue = buildQueue(nextPhase6Talk.lines, () => {
                    RPG.State.flags[nextPhase6Talk.flag] = true;
                    uiControl.updateUI();
                });
                explorationSystem.playDialogueLoop();
                return;
            }

            if (
                RPG.State.flags.wagonInfoHeard === true &&
                RPG.State.flags.wagonHorseEncouraged !== true
            ) {
                uiControl.addSeparator();
                RPG.State.mode = "event";
                RPG.State.dialogueQueue = buildQueue(RPG.Assets.GAME_TEXT.events.phase6WagonReminderTalk);
                explorationSystem.playDialogueLoop();
                return;
            }

            if (
                RPG.State.flags.wagonHorseEncouraged === true &&
                RPG.State.flags.scentPouchQuestStarted === true
            ) {
                if (RPG.State.flags.scentPouchInfoHeard !== true) {
                    uiControl.addSeparator();
                    RPG.State.mode = "event";
                    RPG.State.dialogueQueue = buildQueue(
                        RPG.Assets.GAME_TEXT.events.phase6ScentPouchInfo,
                        () => {
                            RPG.State.flags.scentPouchInfoHeard = true;
                            uiControl.updateUI();
                        }
                    );
                    explorationSystem.playDialogueLoop();
                    return;
                }

                if (RPG.State.flags.scentPouchInfoFollowupDone !== true) {
                    const followupLines = RPG.State.flags.herbGardenBlockedExperienced === true
                        ? RPG.Assets.GAME_TEXT.events.phase6ScentPouchInfoBlocked
                        : RPG.Assets.GAME_TEXT.events.phase6ScentPouchInfoFirstVisit;

                    uiControl.addSeparator();
                    RPG.State.mode = "event";
                    RPG.State.dialogueQueue = buildQueue(followupLines, () => {
                        RPG.State.flags.scentPouchInfoFollowupDone = true;
                        uiControl.updateUI();
                    });
                    explorationSystem.playDialogueLoop();
                    return;
                }
            }

            if (this.needsPhase6EmptyBottle()) {
                uiControl.addSeparator();
                RPG.State.mode = "event";
                RPG.State.dialogueQueue = buildQueue(
                    RPG.Assets.GAME_TEXT.events.phase6EmptyBottleTalk,
                    () => {
                        RPG.State.inventory.emptyBottle = (RPG.State.inventory.emptyBottle || 0) + 1;
                        RPG.State.flags.herbGardenEmptyBottleBorrowed = true;
                        uiControl.updateUI();
                    }
                );
                explorationSystem.playDialogueLoop();
                return;
            }
        }

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

        const phaseOrder = [
            currentPhase,
            ...Array.from({ length: currentPhase }, (_, phase) => phase)
        ];

        for (const phase of phaseOrder) {
            const phaseData = talkData.phases[phase];
            if (!phaseData || !phaseData.entries) continue;

            let reached = RPG.State.talkPhaseReached[phase] || 0;
            while (reached < phaseData.entries.length) {
                const entryNumber = reached + 1;
                if (!this.isInnTalkEntryAvailable(phase, entryNumber)) {
                    reached = entryNumber;
                    RPG.State.talkPhaseReached[phase] = reached;
                    continue;
                }

                selectedPhase = phase;
                selectedEntryNumber = entryNumber;
                selectedLines = phaseData.entries[reached];
                RPG.State.talkPhaseReached[phase] = entryNumber;
                break;
            }

            if (selectedLines) break;
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

        const hasThreeUndeliveredCoins =
            RPG.State.flags.silverDelivered !== true &&
            (RPG.State.silverCoins >= 3 || RPG.State.inventory.silverCoin >= 3);

        if (hasThreeUndeliveredCoins) {
            uiControl.addLog("カイン（先に納品しよう）");
            return;
        }

        const shouldPlayMatamatabiNight =
            RPG.State.flags.matamatabiNightPending === true &&
            RPG.State.flags.matamatabiNightSeen !== true &&
            RPG.State.flags.silverDelivered !== true;

        if (shouldPlayMatamatabiNight) {
            this.playMatamatabiNight();
            return;
        }

        // Build 15.2.68: Departure-night scene is now delayed until wagon prep is complete.
        if (RPG.State.storyPhase === 6 && RPG.State.flags.wagonReadyForDeparture === true) {
            Cinematics.playChapter1FinaleNight();
            return;
        }

        if (
            RPG.State.storyPhase === 7 &&
            RPG.State.flags.phase7DepartureNightSeen === true
        ) {
            this.playPhase7SimpleStay();
            return;
        }

        const shouldPlayPhase6PostDeliverySleep =
            RPG.State.storyPhase === 6 &&
            RPG.State.flags.silverDelivered === true &&
            RPG.State.flags.phase6PostDeliverySleepDone !== true;

        if (shouldPlayPhase6PostDeliverySleep) {
            RPG.State.mode = "event";
            RPG.State.canStay = false;
            RPG.State.dialogueQueue = [];

            const startingHP = RPG.State.currentHP;
            const recoveryAmount = Math.max(0, RPG.State.maxHP - startingHP);

            RPG.State.dialogueQueue.push(
                {
                    text: null,
                    delay: 0,
                    action: () => {
                        uiControl.beginSceneLogFocus();
                    }
                },
                {
                    text: null,
                    delay: 650
                },
                {
                    text: "【質素な客室】",
                    type: "marker",
                    color: "#f1e6c8",
                    fontSize: "20px",
                    delay: 1700,
                    autoAdvance: true
                },
                { text: "部屋には、木枠の寝台が一つ置かれていた。", tapDelay: 1200 },
                { text: "洗い立ての粗いシーツが掛けられ、その下には藁を詰めた寝具が敷かれている。", tapDelay: 1400 },
                { text: "（物置でもありがたかったが、やっぱり落ち着くな）", tapDelay: 1300 },
                { text: "虫の体液も、泥も、血も、湯で洗い流した。清潔なシャツに着替え、襟元をゆるめたカインは、ようやくさっぱりした様子だった。", tapDelay: 1800 },
                { text: "カイン「ああ……やっと休める」", tapDelay: 1700 },
                { text: "寝台へうつ伏せに倒れ込むと、木枠に張られた縄が、ぎし、と鳴る。", tapDelay: 1500 },
                { text: "急に、背中へ重みが加わる。", tapDelay: 1300 },
                { text: "カイン「うっ……！？」", tapDelay: 1000 },
                { text: "オーエンが、カインの背中の上に座っている。", tapDelay: 1300 },
                { text: "オーエン「全然ふかふかじゃない」", tapDelay: 1800 },
                { text: "カイン「それは、俺だからだ」", tapDelay: 1300 },
                { text: "オーエンは少し座り直した。", tapDelay: 1300 },
                { text: "カインの胸が、寝具へ押しつけられる。", tapDelay: 1300 },
                { text: "カイン「……」", tapDelay: 1500 },
                { text: "オーエン「殺した獣を敷き詰めて寝た方がやわらかいんじゃない？」", tapDelay: 2200 },
                { text: "カイン「…元気だな、おまえは」", tapDelay: 1700 },
                { text: "オーエン「まあね」", tapDelay: 1700 },
                { text: "カイン（戦ってないもんな。俺がドロドロになるのを見てただけで）", tapDelay: 1500 },
                { text: "部屋は静かだった。", tapDelay: 1600 },
                { text: "湯で温まった身体が、寝具へゆっくり沈んでいく。", tapDelay: 1800 },
                { text: "オーエンは、カインの緩んだ襟元から覗く傷や、袖口の下に残る赤い擦り傷を、ただじっと見ている。", tapDelay: 2200 },
                { text: "オーエン「…あんな虫の赤ちゃんに食べられかけるなんて」", tapDelay: 2400 },
                { text: "カイン「倒しただろ…子供も助けたし」", tapDelay: 1800 },
                { text: "オーエン「最後消化されかけてた」", tapDelay: 2100 },
                { text: "カイン「……そうかな」", tapDelay: 1900 },
                { text: "オーエン「そうだよ。かっこ悪い。」", tapDelay: 2200 },
                { text: "カイン「……」", tapDelay: 1700 },
                { text: "オーエン「大きい剣を持ってるのに」", tapDelay: 2300 },
                { text: "カイン「………」", tapDelay: 1900 },
                { text: "オーエン「まあ、でもここに来た時よりはマシになったかな」", tapDelay: 2600 },
                { text: "カイン「くー……」", tapDelay: 2200 },
                { text: "オーエン「……………は？」", tapDelay: 2200 },
                { text: "尻の下で、カインの身体から完全に力が抜けていく。", tapDelay: 1800 },
                { text: "オーエン「寝てるの？」", tapDelay: 2000 },
                { text: "カイン「くー…くー……」", tapDelay: 2400 },
                { text: "寝息だけが返ってきた。", tapDelay: 1800 },
                { text: "オーエン「嘘」", tapDelay: 2100 },
                { text: "やはり、起きる気配はない。髪の毛を触ると、首があらわになる。", tapDelay: 2200 },
                { text: "オーエン「ねえ、おまえの首を――」", tapDelay: 2600 },
                { text: "言葉を止める。", tapDelay: 1800 },
                { text: "カインの頬は寝具へ押しつけられ、呼吸に合わせて、湿った髪がわずかに揺れている。", tapDelay: 2500 },
                { text: "オーエン「……」", tapDelay: 2600 },
                { text: "しばらく、そのまま眺めていた。", tapDelay: 2500 },
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
                        const hpFill = document.getElementById('hpFill');
                        if (hpFill) hpFill.style.transition = "width 2.0s ease-out";

                        RPG.State.currentHP = RPG.State.maxHP;
                        this.refreshHerbGardenHarvestsAfterStay();
                        RPG.State.isPoisoned = false;
                        RPG.State.flags.matamatabiActive = false;
                        RPG.State.matamatabiStepsRemaining = 0;
                        RPG.State.flags.phase6PostDeliverySleepDone = true;
                        uiControl.updateUI();
                    }
                },
                {
                    text: null,
                    delay: 1000,
                    action: () => {
                        const logContainer = document.getElementById('logContainer');
                        if (logContainer) logContainer.classList.remove('night-mode');
                    }
                },
                { text: "朝になった。" },
                { text: "カインはゆっくりと目を開けた。" },
                { text: "寝台の脇では、オーエンが床に座り、背を木枠へ預けていた。目を閉じているが、眠っているのかどうかは分からない。" },
                { text: "カイン「……おはよう」" },
                { text: "オーエンが目を開けた。" },
                { text: "オーエン「遅い」" },
                { text: "身体を起こす。" },
                { text: "傷の痛みは残っていたが、昨日よりはずっと軽い。" },
                { text: "（久しぶりによく眠れたな）" },
                {
                    text: "（さて、これからどうするか。まずは宿屋の主人に挨拶しよう）",
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
                },
                {
                    text: null,
                    action: () => {
                        uiControl.endSceneLogFocus();
                    }
                }
            );

            // First trial of the slow special-event presentation: Owen lingers, Cain gradually fades out.
            const drowsyLineSpeeds = {
                "カイン「倒しただろ…子供も助けたし」": 34,
                "カイン「……そうかな」": 48,
                "カイン「……」": 64,
                "カイン「………」": 80,
                "カイン「くー……」": 120,
                "カイン「くー…くー……」": 150,
                "オーエン「……」": 110
            };
            RPG.State.dialogueQueue.forEach(line => {
                if (!line.text || line.type === "marker" || line.action) return;

                line.typewriter = true;
                line.typeSpeed = line.text.startsWith("オーエン") ? 30 : 21;
                if (drowsyLineSpeeds[line.text]) line.typeSpeed = drowsyLineSpeeds[line.text];
            });

            explorationSystem.playDialogueLoop();
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
                        this.refreshHerbGardenHarvestsAfterStay();
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
        const shouldPlayPhase6BlacksmithMorning = this.canPlayPhase6BlacksmithMorning();
        const automaticMorningTrainingId = shouldPlayPhase6BlacksmithMorning
            ? null
            : this.getAutomaticMorningTrainingId();

        // BUILD INITIAL DIALOGUES (snappy 800ms pacing)
        let baseDialogues = [];
        if (event.id === "daughter_room" && RPG.State.silverCoins > 0) {
            if (RPG.State.silverCoins === 1) {
                baseDialogues = RPG.Assets.GAME_TEXT.innEvents.daughterRoom.coin1.map(d => ({ ...d, delay: d.delay || 800 }));
            } else {
                baseDialogues = RPG.Assets.GAME_TEXT.innEvents.daughterRoom.coinMultiple.map(d => ({ ...d, delay: d.delay || 800 }));
            }
        } else {
            const raw = (this.isInnEventViewed(event) ? [...(event.shortDialogue || [])] : [...(event.dialogue || [])]);
            baseDialogues = raw.map(d => ({ ...d, delay: 800 }));
        }
        this.markInnEventViewed(event);

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
                this.refreshHerbGardenHarvestsAfterStay();
                RPG.State.mood = Math.max(0, Math.min(100, RPG.State.mood + (morningResult.mood || 0)));
                RPG.State.isPoisoned = false;
                RPG.State.flags.matamatabiActive = false;
                RPG.State.matamatabiStepsRemaining = 0;
                uiControl.updateUI();
            }
        });

        if (shouldPlayPhase6BlacksmithMorning) {
            // The blacksmith arrives on a normal phase 6 morning and leaves the player inside the inn.
            RPG.State.dialogueQueue.push({
                text: null,
                delay: 1000,
                action: () => {
                    const logContainer = document.getElementById('logContainer');
                    if (logContainer) logContainer.classList.remove('night-mode');

                    setTimeout(() => {
                        const hpFill = document.getElementById('hpFill');
                        if (hpFill) hpFill.style.transition = "width 0.3s ease";
                    }, 1000);

                    uiControl.updateUI();
                }
            });
            RPG.State.dialogueQueue.push(
                ...this.buildPhase6BlacksmithMorningQueue(recoveryAmount)
            );
        } else if (automaticMorningTrainingId) {
            // The training scene replaces the generic morning line and starts outside.
            RPG.State.dialogueQueue.push({
                text: null,
                delay: 1000,
                action: () => {
                    const logContainer = document.getElementById('logContainer');
                    if (logContainer) logContainer.classList.remove('night-mode');

                    this.moveToInnFrontForMorning();

                    setTimeout(() => {
                        const hpFill = document.getElementById('hpFill');
                        if (hpFill) hpFill.style.transition = "width 0.3s ease";
                    }, 1000);

                    uiControl.updateUI();
                }
            });
            RPG.State.dialogueQueue.push(
                ...this.buildMorningTrainingQueue(automaticMorningTrainingId, recoveryAmount)
            );
        } else {
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
                    const logContainer = document.getElementById('logContainer');
                    if (logContainer) logContainer.classList.remove('night-mode');

                    uiControl.addLog(`HPが ${recoveryAmount} 回復した。`);

                    // Build 8.58: Mark that player has slept after meeting thief
                    if (RPG.State.flags.metThiefBoy === true) {
                        RPG.State.flags.hasSleptAfterThief = true;
                    }

                    if (this.canScheduleMorningTraining3()) {
                        RPG.State.flags.morningTraining3Pending = true;
                    }

                    // Reset HP bar transition speed
                    setTimeout(() => {
                        const hpFill = document.getElementById('hpFill');
                        if (hpFill) hpFill.style.transition = "width 0.3s ease";
                    }, 1000);

                    uiControl.updateUI();
                }
            });
        }

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

            const owenConsultCount = RPG.State.flags.phase4OwenConsultCount || 0;

            if (owenConsultCount === 0) {
                const owenConsultLines = this.hasSeenGlowingCatRabbit()
                    ? RPG.Assets.GAME_TEXT.events.phase4OwenConsultKnownRabbit
                    : RPG.Assets.GAME_TEXT.events.phase4OwenConsult1;

                RPG.State.dialogueQueue = this.buildDialogueQueue(
                    owenConsultLines,
                    () => {
                        RPG.State.flags.phase4OwenConsultCount = 1;
                        uiControl.updateUI();
                    }
                );
                explorationSystem.playDialogueLoop();
                return;
            }

            if (owenConsultCount === 1) {
                RPG.State.dialogueQueue = this.buildDialogueQueue(
                    RPG.Assets.GAME_TEXT.events.phase4OwenConsult2,
                    () => {
                        RPG.State.flags.phase4OwenConsultCount = 2;
                        this.showPhase4SweetDeliveryButton();
                    }
                );
                explorationSystem.playDialogueLoop();
                return;
            }

            const followupCount = RPG.State.flags.phase4FortuneFollowupCount || 0;
            if (followupCount >= 2) {
                RPG.State.mode = 'base';
                uiControl.updateUI();
                return;
            }

            const followupLines = followupCount === 0
                ? RPG.Assets.GAME_TEXT.events.phase4FortuneFollowup1
                : RPG.Assets.GAME_TEXT.events.phase4FortuneFollowup2;
            RPG.State.dialogueQueue = this.buildDialogueQueue(
                followupLines,
                () => {
                    RPG.State.flags.phase4FortuneFollowupCount = followupCount + 1;
                    uiControl.updateUI();
                }
            );
            explorationSystem.playDialogueLoop();
            return;
        }

        if (this.shouldUsePhase6HerbGardenFortuneRoute()) {
            uiControl.addSeparator();
            RPG.State.mode = "event";

            if (RPG.State.flags.herbGardenBroochGranted === true) {
                RPG.State.dialogueQueue = this.buildDialogueQueue(
                    RPG.Assets.GAME_TEXT.events.phase6HerbGardenFortuneFollowup,
                    () => {
                        RPG.State.flags.herbGardenFortuneFollowupDone = true;
                        uiControl.updateUI();
                    }
                );
            } else {
                RPG.State.dialogueQueue = this.buildDialogueQueue(
                    RPG.Assets.GAME_TEXT.events.phase6HerbGardenFortuneConsult,
                    () => this.showPhase6HerbGardenBroochChoices()
                );
            }

            explorationSystem.playDialogueLoop();
            return;
        }

        if (this.shouldUsePhase6HerbGardenMaterialHint()) {
            uiControl.addSeparator();
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = this.buildDialogueQueue(
                this.getPhase6HerbGardenMaterialHint()
            );
            explorationSystem.playDialogueLoop();
            return;
        }

        if (this.shouldUsePhase6HerbGardenBroochReturn()) {
            uiControl.addSeparator();
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = this.buildDialogueQueue(
                RPG.Assets.GAME_TEXT.events.phase6HerbGardenBroochReturn,
                () => {
                    RPG.State.inventory.lightRabbitBrooch = Math.max(
                        0,
                        (RPG.State.inventory.lightRabbitBrooch || 0) - 1
                    );
                    RPG.State.inventory.glowingBrooch = (RPG.State.inventory.glowingBrooch || 0) + 1;
                    RPG.State.flags.herbGardenBroochReturned = true;
                    uiControl.updateUI();
                }
            );
            explorationSystem.playDialogueLoop();
            return;
        }

        if (this.canTalkToPhase6Blacksmith()) {
            uiControl.addSeparator();
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                ...(RPG.Assets.GAME_TEXT.events.phase6BlacksmithTalk || []).map(text => {
                    if (text === "剣を研いでくれた！" || text === "カインの剣のレベルが上がった！") {
                        return { text, type: "marker", color: "#f1e6c8" };
                    }
                    if (text === "攻撃力＋2") {
                        return { text, type: "marker", color: "#9acd32" };
                    }
                    return { text };
                }),
                {
                    text: null,
                    action: () => {
                        RPG.State.attack += 2;
                        RPG.State.swordLevel = (RPG.State.swordLevel || 1) + 1;
                        RPG.State.flags.phase6BlacksmithAvailable = false;
                        RPG.State.flags.phase6BlacksmithTalked = true;
                        uiControl.updateUI();
                    }
                }
            ];
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

        const buildDialogue = (lines, action = null) => {
            const queue = lines.map(text => ({ text }));
            if (action) {
                queue.push({ text: null, action });
            }
            return queue;
        };

        let selectedPhase = null;
        let selectedEntry = null;

        const phaseOrder = [
            currentPhase,
            ...Array.from({ length: currentPhase }, (_, phase) => phase)
        ];

        for (const phase of phaseOrder) {
            const phaseData = observeData[phase];
            if (!phaseData) continue;

            const unreadLimit = phaseData.loop - 1;
            let reached = RPG.State.observePhaseReached[phase] || 0;
            while (reached < unreadLimit) {
                const nextEntry = reached + 1;
                if (!this.isInnObserveEntryAvailable(phase, nextEntry)) {
                    reached = nextEntry;
                    RPG.State.observePhaseReached[phase] = reached;
                    continue;
                }

                selectedPhase = phase;
                selectedEntry = nextEntry;
                RPG.State.observePhaseReached[phase] = nextEntry;
                break;
            }

            if (selectedPhase !== null) break;
        }

        if (selectedPhase === null) {
            selectedPhase = currentPhase;
            selectedEntry = observeData[currentPhase].loop;
        }
        RPG.State.observeIndex = selectedPhase;

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

    isInnEventViewed: function (event) {
        const viewedIds = Array.isArray(RPG.State.innEventViewedIds)
            ? RPG.State.innEventViewedIds
            : [];
        return Boolean(event && viewedIds.includes(event.id));
    },

    markInnEventViewed: function (event) {
        if (!event || !event.id) return;
        if (!Array.isArray(RPG.State.innEventViewedIds)) {
            RPG.State.innEventViewedIds = [];
        }
        if (!RPG.State.innEventViewedIds.includes(event.id)) {
            RPG.State.innEventViewedIds.push(event.id);
        }
    },

    selectInnEvent: function () {
        // 未読優先ロジック: 未読イベントがあれば、その中から抽選。なければ全イベントから抽選。
        let candidates = RPG.Assets.INN_EVENTS.filter(e => !this.isInnEventViewed(e));
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

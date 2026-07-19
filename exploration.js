// 🚩ーー【移動・探索システム】ーー
// Build 14.1: Namespaces updated to RPG.State and RPG.Assets
const explorationSystem = {
    isInHerbGarden: function () {
        return RPG.State.explorationArea === "herbGarden";
    },

    getHerbGardenMaxDistance: function () {
        return (RPG.State.inventory.lightRabbitBrooch || 0) > 0
            ? RPG.Assets.CONFIG.HERB_GARDEN_MAX_DISTANCE
            : 3;
    },

    getHerbGardenAmbientText: function (distance) {
        const flags = RPG.State.flags;

        if (distance === 1) {
            return flags.herbGardenHerb1Available !== false
                ? RPG.Assets.HERB_GARDEN_AMBIENT_TEXTS[1]
                : "柔らかい土には、獣に踏み荒らされた跡が残っている。";
        }

        if (distance === 2) {
            return flags.herbGardenHerb2Available !== false
                ? RPG.Assets.HERB_GARDEN_AMBIENT_TEXTS[2]
                : "大きな木が倒れている。";
        }

        if (distance === 4) {
            return flags.herbGardenHighHerbAvailable !== false
                ? "レンガの隙間から、みずみずしい葉が生えている。"
                : "足元のレンガが崩れている。";
        }

        if (distance === 6) {
            return flags.herbGardenAntidoteHerbAvailable !== false
                ? "石柱の陰に、黄色い花をつけた薬草が生えている。"
                : "石柱の陰には、葉を摘み取った跡が残っている。";
        }

        if (distance === 7) {
            if (flags.herbGardenMintCollected !== true) {
                return "枯れ草の中に、薄紫の花が混じっている。";
            }
            if (flags.herbGardenEdibleHerbCollected !== true) {
                return "枯れた植物の隙間に見覚えのある葉が生えている。";
            }
            return "石で囲まれた小さな花壇がある。";
        }

        return RPG.Assets.HERB_GARDEN_AMBIENT_TEXTS[distance] || null;
    },

    playHerbGardenBroochPassage: function (distance) {
        const flags = RPG.State.flags;
        if ((RPG.State.inventory.lightRabbitBrooch || 0) <= 0) return false;

        if (distance === 2 && !flags.herbGardenBrooch2mPassageSeen) {
            flags.herbGardenBrooch2mPassageSeen = true;
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                { text: "頭の重さはあるが、足取りは乱れない。" },
                { text: "カインはまっすぐ前を見て歩いていた。" },
                { text: "オーエン｢今日は手、繋がないの？」" },
                { text: "カイン｢戦えるようにしておきたい」" }
            ];
            this.playDialogueLoop();
            return true;
        }

        if (distance === 3 && !flags.herbGardenBrooch3mPassageSeen) {
            flags.herbGardenBrooch3mPassageSeen = true;
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                {
                    text: "光兎のブローチが光っている。",
                    type: "marker",
                    color: "#f1e6c8",
                    action: () => uiControl.flashFullScreen("#fff1a8", 220, 0.22)
                },
                { text: "カイン（ちゃんと道が見えてる。進めそうだ）" },
                { text: "オーエン｢……」" },
                { text: "霞んでいた視界は晴れて、足元の骨までよく見える。" }
            ];
            this.playDialogueLoop();
            return true;
        }

        return false;
    },

    canCollectHerbGardenBoneMeal: function () {
        return (
            this.isInHerbGarden() &&
            RPG.State.currentDistance === 3 &&
            (RPG.State.inventory.lightRabbitBrooch || 0) > 0 &&
            RPG.State.flags.herbGardenBoneMealInspected === true &&
            RPG.State.flags.herbGardenBoneMealCollected !== true
        );
    },

    tryHerbGardenEncounter: function (distance) {
        if (RPG.State.flags.isDebugEncountersOff) return false;
        if (distance === 3 || distance <= 0) return false;
        if (Math.random() >= RPG.Assets.CONFIG.BATTLE_RATE) return false;

        if (RPG.State.storyPhase >= 6 && distance <= 2) {
            battleSystem.startBattle(Math.random() < 0.35 ? "skull_bee" : "rat");
            return true;
        }

        if (distance <= 2) {
            battleSystem.startBattle("rat");
            return true;
        }

        if (RPG.State.storyPhase >= 6 && Math.random() < 0.25) {
            battleSystem.startBattle("skull_bee");
            return true;
        }

        // Match the forest's existing rat/weasel weight ratio (10:3) after 4m.
        const enemyId = Math.random() < (10 / 13) ? "rat" : "weasel";
        battleSystem.startBattle(enemyId);
        return true;
    },

    tryHerbGardenVineEncounter: function (distance) {
        const flags = RPG.State.flags;
        if (RPG.State.storyPhase < 6) return false;

        if (distance === 5 && flags.carnivorousVineDefeated !== true) {
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                ...this.buildDialogueQueue(RPG.Assets.GAME_TEXT.events.phase6CarnivorousVineIntro),
                { text: null, action: () => battleSystem.startBattle("carnivorous_vine") }
            ];
            this.playDialogueLoop();
            return true;
        }

        if (
            distance >= 4 &&
            distance <= 6 &&
            flags.carnivorousVineRegrown === true &&
            Math.random() < 0.08
        ) {
            battleSystem.startBattle("carnivorous_vine");
            return true;
        }

        return false;
    },

    enterHerbGarden: function () {
        if (RPG.State.mode !== "base" || RPG.State.isAtInn) return;

        if (
            RPG.State.storyPhase === 6 &&
            RPG.State.flags.herbGardenFortuneFollowupDone === true &&
            RPG.State.flags.herbGardenBoneMealCollected !== true &&
            (RPG.State.inventory.emptyBottle || 0) <= 0
        ) {
            RPG.Assets.GAME_TEXT.events.phase6HerbGardenNoBottle
                .forEach(line => uiControl.addLog(line));
            uiControl.updateUI();
            return;
        }

        RPG.State.isInDungeon = true;
        RPG.State.explorationArea = "herbGarden";
        RPG.State.currentDistance = 0;
        RPG.State.location = uiControl.getLocData(0).name;
        uiControl.addLog(RPG.Assets.GAME_TEXT.exploration.enteredHerbGarden, "marker");

        if (!RPG.State.flags.herbGardenFirstEnterDone) {
            RPG.State.flags.herbGardenFirstEnterDone = true;
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                { text: "森の奥に、ぽっかりと開けた場所があった。" },
                { text: "朽ちかけた柵と「琥珀亭薬草園」の看板が、かつて人に使われていた場所だと示している。" },
                { text: "鮮やかな花々の間を、大きな蜂が飛び回っていた。" },
                { text: "カイン「なんか甘い匂いがするな」" },
                { text: "オーエン「へえ、そう感じるんだ？」" },
                { text: "カイン「花の匂いじゃないのか？」" },
                { text: "オーエン「花の匂いだよ。嫌な匂い」" }
            ];
            this.playDialogueLoop();
            return;
        }

        uiControl.addLog("風もないのに花が揺れている。", "ambient");
        uiControl.addLog("（やけに鮮やかだな…目がチカチカする）", "ambient");
        uiControl.updateUI();
    },

    canPlayHerbGardenKiss: function () {
        return (
            RPG.State.currentDistance === 7 &&
            RPG.State.flags.herbGardenKissEventDone !== true &&
            (RPG.State.inventory.mintFlower || 0) > 0
        );
    },

    playHerbGardenKiss: function () {
        const flags = RPG.State.flags;
        flags.herbGardenKissEventDone = true;
        RPG.State.mode = "event";

        const kissLines = RPG.Assets.GAME_TEXT.events.phase6HerbGardenKiss || [];
        RPG.State.dialogueQueue = [
            { text: "カインは来た道へ戻ろうとして、足を止めた。" },
            { text: "カイン（風が気持ちいい…少し休んでいくか）" },
            { text: null, action: () => uiControl.beginSceneLogFocus() },
            { text: null, delay: 650 },
            ...kissLines.map((text, index) => ({
                text,
                typewriter: true,
                typeSpeed: index < 6 ? 30 : 24,
                action: text === "避けきれず、唇が掠める" ? () => uiControl.screenShake() : null
            })),
            {
                text: null,
                action: () => {
                    uiControl.endSceneLogFocus();
                    RPG.State.mode = "base";
                    uiControl.updateUI();
                }
            }
        ];
        this.playDialogueLoop();
    },

    canPlayHerbGardenReturnHandhold: function () {
        const flags = RPG.State.flags;
        return (
            RPG.State.currentDistance === 3 &&
            flags.herbGardenKissEventDone === true &&
            flags.herbGardenReturnHandholdDone !== true &&
            (RPG.State.inventory.mintFlower || 0) > 0
        );
    },

    finishHerbGardenReturnHandhold: function () {
        RPG.State.mode = "base";
        uiControl.updateUI();
    },

    handleHerbGardenReturnFromThreeMeters: function () {
        if (!this.canPlayHerbGardenReturnHandhold()) return false;

        if ((RPG.State.inventory.boneMeal || 0) <= 0) {
            uiControl.addLog("カイン（骨粉はこのあたりにあるはずだ）");
            uiControl.updateUI();
            return true;
        }

        RPG.State.flags.herbGardenReturnHandholdDone = true;
        RPG.State.flags.herbGardenReturnHandholdActive = true;
        RPG.State.mode = "event";
        const lines = RPG.Assets.GAME_TEXT.events.phase6HerbGardenReturnHandhold || [];
        RPG.State.dialogueQueue = [
            {
                text: null,
                action: () => uiControl.screenDizzy()
            },
            ...lines.map(text => ({ text })),
            {
                text: null,
                action: () => uiControl.updateUI()
            },
            { text: null, action: () => this.finishHerbGardenReturnHandhold() }
        ];
        this.playDialogueLoop();
        return true;
    },

    moveHerbGarden: function (step) {
        if (RPG.State.currentDistance === 0 && step === -1) {
            RPG.State.isInDungeon = false;
            RPG.State.explorationArea = null;
            RPG.State.location = "宿屋前";

            if (scenarioEvents.thiefBoyEvent.handleInnEntranceCollision()) return;

            uiControl.addLog(RPG.Assets.GAME_TEXT.exploration.leftHerbGarden, "marker");
            uiControl.updateUI();
            return;
        }

        if (step === -1 && this.canPlayHerbGardenKiss()) {
            this.playHerbGardenKiss();
            return;
        }

        if (step === -1 && this.handleHerbGardenReturnFromThreeMeters()) {
            return;
        }

        const nextDistance = RPG.State.currentDistance + step;
        if (nextDistance < 0 || nextDistance > this.getHerbGardenMaxDistance()) return;

        if (step !== 0) {
            RPG.State.canStay = true;
            RPG.State.currentDistance = nextDistance;
            this.recordTravelStep();
            RPG.State.location = uiControl.getLocData(nextDistance).name;
            uiControl.addLog(RPG.Assets.GAME_TEXT.exploration.moved(nextDistance));

            if (RPG.State.isPoisoned && battleSystem.applyPoisonTick()) {
                battleSystem.resolveDefeat();
                return;
            }

            const ambientText = this.getHerbGardenAmbientText(nextDistance);
            if (ambientText) {
                uiControl.addLog(ambientText, "ambient");
            }
            if (
                nextDistance === 3 &&
                (RPG.State.inventory.lightRabbitBrooch || 0) > 0 &&
                RPG.State.flags.herbGardenBoneMealCollected !== true
            ) {
                uiControl.addLog("足元に白いものが散らばっている。", "ambient");
            }
            if (
                nextDistance === 7 &&
                RPG.State.flags.herbGardenMintCollected === true &&
                RPG.State.flags.herbGardenEdibleHerbCollected === true
            ) {
                uiControl.addLog("他の場所より丁寧に整えられている。", "ambient");
            }

            if (this.playHerbGardenBroochPassage(nextDistance)) return;

            if (nextDistance === 3 && (RPG.State.inventory.lightRabbitBrooch || 0) === 0) {
                if (RPG.State.storyPhase >= 6 && RPG.State.flags.scentPouchQuestStarted === true) {
                    this.playPhase6HerbGardenBlock();
                } else {
                    this.playHerbGardenBlockedEvent();
                }
                return;
            }

            if (
                nextDistance === 0 &&
                RPG.State.flags.herbGardenReturnHandholdActive === true
            ) {
                RPG.State.flags.herbGardenReturnHandholdActive = false;
                RPG.State.mode = "event";
                RPG.State.dialogueQueue = [
                    ...this.buildDialogueQueue(RPG.Assets.GAME_TEXT.events.phase6HerbGardenReturnEntrance),
                    { text: null, action: () => this.finishHerbGardenReturnHandhold() }
                ];
                this.playDialogueLoop();
                return;
            }

            if (RPG.State.flags.herbGardenReturnHandholdActive !== true) {
                if (this.tryHerbGardenVineEncounter(nextDistance)) return;
                if (this.tryHerbGardenEncounter(nextDistance)) return;
            }
        }

        uiControl.updateUI();
    },

    returnFromHerbGardenBlock: function () {
        RPG.State.currentDistance = 2;
        RPG.State.location = uiControl.getLocData(2).name;
        RPG.State.mode = "base";
        uiControl.updateUI();
    },

    showHerbGardenBlockedChoices: function (allowReturn) {
        RPG.State.mode = "choice";
        uiControl.updateUI();

        const btnChoiceA = document.getElementById("btnChoiceA");
        const btnChoiceB = document.getElementById("btnChoiceB");

        if (btnChoiceA) {
            btnChoiceA.style.display = allowReturn ? "flex" : "none";
            if (allowReturn) {
                btnChoiceA.textContent = "引き返す";
                btnChoiceA.style.background = "";
                btnChoiceA.onclick = () => {
                    RPG.State.mode = "event";
                    RPG.State.dialogueQueue = [
                        { text: "カインは来た道を戻った。" },
                        { text: "カイン（二日酔いのような具合悪さだ）" },
                        { text: null, action: () => this.returnFromHerbGardenBlock() }
                    ];
                    this.playDialogueLoop();
                };
            }
        }

        if (btnChoiceB) {
            btnChoiceB.textContent = "無理やり進む";
            btnChoiceB.style.background = "";
            btnChoiceB.onclick = () => {
                RPG.State.mode = "event";
                RPG.State.flags.herbGardenForceAdvanceTried = true;
                RPG.State.dialogueQueue = [
                    { text: "カインは足に力をいれ、無理やり前へと踏み出した。足の下でパキパキと骨が砕ける。" },
                    { text: "（………！！！）" },
                    { text: "胃がひっくり返り、カインはその場に膝をついた。" },
                    { text: "カイン「……っ、う……」" },
                    { text: "オーエン「あーあ…」" },
                    { text: "これ以上は進めそうにない。" },
                    { text: null, action: () => this.returnFromHerbGardenBlock() }
                ];
                this.playDialogueLoop();
            };
        }
    },

    recordTravelStep: function () {
        // Wagon movement belongs to its story sequence rather than the free-roam day clock.
        if (RPG.State.flags.onWagon === true) return;

        RPG.State.travelStepsSinceStay =
            Math.max(0, Number(RPG.State.travelStepsSinceStay) || 0) + 1;

        if (typeof visualDirector !== "undefined") {
            visualDirector.syncScene();
        }
    },

    playHerbGardenBlockedEvent: function () {
        const flags = RPG.State.flags;
        RPG.State.mode = "event";

        if (flags.herbGardenBlockedExperienced) {
            if (!flags.herbGardenForceAdvanceTried) {
                this.showHerbGardenBlockedChoices(false);
                return;
            }

            RPG.State.dialogueQueue = [
                { text: "カイン（…これ以上は無理だ。引き返そう）" },
                { text: null, action: () => this.returnFromHerbGardenBlock() }
            ];
            this.playDialogueLoop();
            return;
        }

        flags.herbGardenBlockedExperienced = true;
        RPG.State.dialogueQueue = [
            { text: "カイン「目が回りそうだ…」" },
            { text: "足元がおぼつかない。" },
            { text: "カイン「…あれ？」" },
            { text: "オーエン｢もう回ってるよ」" },
            { text: "カインは膝をついた。" },
            { text: "じゃり…" },
            { text: "地面は無数の骨で覆われている。" },
            { text: "カイン｢なんだ、これ」" },
            { text: "オーエン｢今のおまえの仲間。ここで動けなくなったやつら」" },
            { text: null, action: () => this.showHerbGardenBlockedChoices(true) }
        ];
        this.playDialogueLoop();
    },

    showPhase6HerbGardenChoices: function () {
        const flags = RPG.State.flags;
        const choices = [];

        if (!flags.herbGardenBreathAttempted) {
            choices.push({
                label: "息を止めて進む",
                action: () => this.choosePhase6HerbGardenBreath()
            });
        }
        if (!flags.herbGardenHandholdAttempted) {
            choices.push({
                label: "オーエンと手を繋ぐ",
                action: () => this.choosePhase6HerbGardenHandhold()
            });
        }

        if (choices.length === 0) {
            RPG.State.mode = "base";
            uiControl.addLog("カイン（いい作戦が思いつかない。誰かに相談しよう）");
            uiControl.updateUI();
            return;
        }

        RPG.State.mode = "choice";
        uiControl.updateUI();

        const buttons = [
            document.getElementById("btnChoiceA"),
            document.getElementById("btnChoiceB")
        ];

        buttons.forEach((button, index) => {
            if (!button) return;
            const choice = choices[index];
            button.style.display = choice ? "flex" : "none";
            if (!choice) return;

            button.textContent = choice.label;
            button.style.background = "";
            button.onclick = choice.action;
        });
    },

    choosePhase6HerbGardenBreath: function () {
        RPG.State.flags.herbGardenBreathAttempted = true;
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            ...this.buildDialogueQueue(RPG.Assets.GAME_TEXT.events.phase6HerbGardenBreathAttempt),
            { text: null, action: () => this.returnFromHerbGardenBlock() }
        ];
        this.playDialogueLoop();
    },

    finishPhase6HerbGardenHandhold: function () {
        const state = RPG.State;
        state.currentHP = state.maxHP;
        state.isPoisoned = false;
        state.isInDungeon = false;
        state.explorationArea = null;
        state.isAtInn = true;
        state.currentDistance = 0;
        state.location = "宿屋《琥珀亭》";
        state.flags.herbGardenFortuneConsultUnlocked = true;

        const logContainer = document.getElementById("logContainer");
        if (logContainer) logContainer.classList.remove("night-mode");
        uiControl.updateUI();
    },

    choosePhase6HerbGardenHandhold: function () {
        RPG.State.flags.herbGardenHandholdAttempted = true;
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            ...this.buildDialogueQueue(RPG.Assets.GAME_TEXT.events.phase6HerbGardenHandholdAttempt),
            { text: null, action: () => uiControl.beginSceneLogFocus() },
            { text: null, delay: 650 },
            {
                text: null,
                action: () => {
                    const logContainer = document.getElementById("logContainer");
                    if (logContainer) logContainer.classList.add("night-mode");
                }
            },
            { text: null, delay: 1800 },
            { text: null, action: () => this.finishPhase6HerbGardenHandhold() },
            ...this.buildDialogueQueue(RPG.Assets.GAME_TEXT.events.phase6HerbGardenHandholdMorning),
            {
                text: null,
                action: () => {
                    uiControl.endSceneLogFocus();
                    RPG.State.mode = "base";
                    uiControl.updateUI();
                }
            }
        ];
        this.playDialogueLoop();
    },

    playPhase6HerbGardenBlock: function () {
        const flags = RPG.State.flags;
        RPG.State.mode = "event";

        const lines = flags.herbGardenBlockedExperienced
            ? RPG.Assets.GAME_TEXT.events.phase6HerbGardenRepeatBlock
            : RPG.Assets.GAME_TEXT.events.phase6HerbGardenFirstBlock;
        flags.herbGardenBlockedExperienced = true;

        RPG.State.dialogueQueue = [
            ...this.buildDialogueQueue(lines),
            { text: null, action: () => this.showPhase6HerbGardenChoices() }
        ];
        this.playDialogueLoop();
    },

    isPhase6WagonDriverSpot: function () {
        return (
            RPG.State.explorationArea !== "herbGarden" &&
            RPG.State.storyPhase === 6 &&
            RPG.State.flags.wagonInfoHeard === true &&
            RPG.State.currentDistance === 5 &&
            RPG.State.location !== "かつての街道"
        );
    },

    isPhase6WagonSpot: function () {
        return (
            this.isPhase6WagonDriverSpot() &&
            RPG.State.flags.wagonHorseEncouraged !== true
        );
    },

    canUseScentPouchAtWagon: function () {
        const flags = RPG.State.flags;
        return (
            this.isPhase6WagonDriverSpot() &&
            flags.wagonHorseEncouraged === true &&
            flags.scentPouchCrafted === true &&
            flags.wagonReadyForDeparture !== true
        );
    },

    needsHighwayScentPouchHandoff: function () {
        const state = RPG.State;
        return (
            state.storyPhase === 9 &&
            state.location === "かつての街道" &&
            state.currentDistance === 1 &&
            state.flags.scentPouchCrafted === true &&
            state.flags.scentPouchHandedToDriver !== true &&
            (state.inventory.scentPouch || 0) > 0
        );
    },

    canUseScentPouchOnHighway: function () {
        return this.needsHighwayScentPouchHandoff();
    },

    buildDialogueQueue: function (lines, action = null) {
        const queue = (lines || []).map(line => ({ text: line }));
        if (action) {
            queue.push({ text: null, action });
        }
        return queue;
    },

    activeTypewriter: null,

    hasActiveTypewriter: function () {
        return !!(this.activeTypewriter && !this.activeTypewriter.finished);
    },

    completeActiveTypewriter: function () {
        if (!this.hasActiveTypewriter()) return false;
        return this.activeTypewriter.complete();
    },

    cancelActiveTypewriter: function () {
        const active = this.activeTypewriter;
        if (!active) return;

        active.finished = true;
        if (active.timerId) clearTimeout(active.timerId);
        this.activeTypewriter = null;
    },

    typewriteLogEntry: function (entry, text, characterDelay, onComplete) {
        const characters = Array.from(text);
        let index = 0;

        this.cancelActiveTypewriter();

        const controller = {
            timerId: null,
            finished: false,
            complete: null
        };

        const finish = (showFullText) => {
            if (controller.finished) return false;

            controller.finished = true;
            if (controller.timerId) clearTimeout(controller.timerId);
            if (showFullText) entry.textContent = text;

            const container = entry.parentElement;
            uiControl.scrollLogToLatest(container);

            if (this.activeTypewriter === controller) {
                this.activeTypewriter = null;
            }
            onComplete();
            return true;
        };

        controller.complete = () => finish(true);
        this.activeTypewriter = controller;

        const writeNextCharacter = () => {
            if (controller.finished) return;

            const character = characters[index];
            entry.textContent += character;
            index += 1;

            const container = entry.parentElement;
            uiControl.scrollLogToLatest(container);

            if (index >= characters.length) {
                finish(false);
                return;
            }

            // Sentence endings receive a small natural pause without delaying every line.
            const punctuationPause = /[、。！？…]/.test(character) ? 90 : 0;
            controller.timerId = setTimeout(writeNextCharacter, characterDelay + punctuationPause);
        };

        writeNextCharacter();
    },

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
            // A fully automatic scene can finish without a final player tap.
            // Always clear the transparent tap layer before restoring commands.
            this.cancelActiveTypewriter();
            RPG.State.isWaitingForInput = false;
            uiControl.hideFloatingArrow();
            uiControl.disableTapOverlay();

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

            if (typeof visualDirector !== "undefined") {
                visualDirector.clearInnScene();
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

        let typewriterEntry = null;
        if (nextLine.text) {
            typewriterEntry = nextLine.typewriter
                ? uiControl.addLog("", nextLine.type || "", nextLine.color, nextLine.fontSize, true, nextLine.text)
                : uiControl.addLog(nextLine.text, nextLine.type || "", nextLine.color, nextLine.fontSize);
        }
        uiControl.updateUI();

        // アクション実行（カスタム処理がある場合）
        if (nextLine.action) {
            nextLine.action();
        }

        // 次の行へ
        /* Build 13.0.0: Tap-to-Advance Logic */
        if (nextLine.text) {
            const tapDelay = nextLine.tapDelay || 0;
            const enableTapAdvance = () => {
                RPG.State.isWaitingForInput = true;
                uiControl.showFloatingArrow();
                uiControl.enableTapOverlay();
            };

            const finishText = () => {
                if (nextLine.autoAdvance) {
                    const normalDelay = nextLine.delay || 0;
                    const delay = RPG.State.debug.isSkipping
                        ? Math.min(50, normalDelay)
                        : normalDelay;
                    setTimeout(() => {
                        this.playDialogueLoop();
                    }, delay);
                } else if (tapDelay > 0 && !nextLine.typewriter) {
                    setTimeout(enableTapAdvance, tapDelay);
                } else {
                    enableTapAdvance();
                }
            };

            if (nextLine.typewriter && typewriterEntry) {
                RPG.State.isWaitingForInput = false;
                uiControl.hideFloatingArrow();
                uiControl.enableTapOverlay();
                this.typewriteLogEntry(
                    typewriterEntry,
                    nextLine.text,
                    nextLine.typeSpeed || 22,
                    finishText
                );
            } else {
                finishText();
            }
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
        if (RPG.State.mode !== "base" || RPG.State.isAtInn) return;

        const entranceLoc = uiControl.getLocData(0);
        RPG.State.isInDungeon = true;
        RPG.State.explorationArea = "forest";
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

    move: function (step, options = {}) {
        const skipTravelCue = options.skipTravelCue === true;
        if (RPG.State.mode !== "base" || RPG.State.isAtInn) return;
        if (RPG.State.location === "宿屋内部") return;
        if (!skipTravelCue && typeof visualDirector !== "undefined" && visualDirector.travelActive) return;

        if (this.isInHerbGarden()) {
            this.moveHerbGarden(step);
            return;
        }

        // 0m地点からの脱出 (Return to Inn Front)
        if (RPG.State.isInDungeon && RPG.State.currentDistance === 0 && step === -1) {
            if (
                !skipTravelCue &&
                typeof visualDirector !== "undefined" &&
                visualDirector.isAmberForestScene()
            ) {
                const started = visualDirector.playTravel({
                    direction: step,
                    targetDistance: 0,
                    maxDistance: RPG.Assets.CONFIG.MAX_DISTANCE,
                    onComplete: () => this.move(step, { skipTravelCue: true })
                });
                if (started) return;
            }

            RPG.State.isInDungeon = false;
            RPG.State.explorationArea = null;
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

        // The driver needs the scent pouch before Cain is drawn into the highway's opening fights.
        if (step > 0 && this.needsHighwayScentPouchHandoff()) {
            uiControl.screenShake();
            uiControl.addLog("カイン（馬を落ち着かせないと！）");
            uiControl.updateUI();
            return;
        }

        if (
            step !== 0 &&
            !skipTravelCue &&
            typeof visualDirector !== "undefined" &&
            visualDirector.isAmberForestScene() &&
            RPG.State.flags.onWagon !== true
        ) {
            const started = visualDirector.playTravel({
                direction: step,
                targetDistance: nextDist,
                maxDistance: RPG.Assets.CONFIG.MAX_DISTANCE,
                onComplete: () => this.move(step, { skipTravelCue: true })
            });
            if (started) return;
        }

        if (step !== 0) {
            RPG.State.canStay = true;
            RPG.State.currentDistance = nextDist;
            this.recordTravelStep();
            uiControl.addLog(
                RPG.Assets.GAME_TEXT.exploration.moved(RPG.State.currentDistance),
                "movement"
            );

            // Keep forest location labels in sync with distance thresholds.
            // Do not overwrite special area names like the Former Highway.
            if (RPG.State.isInDungeon && RPG.State.location !== "かつての街道") {
                RPG.State.location = uiControl.getLocData(RPG.State.currentDistance).name;
            }

            if (
                RPG.State.flags.matamatabiActive === true &&
                RPG.State.isInDungeon &&
                RPG.State.location !== "かつての街道"
            ) {
                RPG.State.matamatabiStepsRemaining = Math.max(0, (RPG.State.matamatabiStepsRemaining || 0) - 1);
                if (RPG.State.matamatabiStepsRemaining <= 0) {
                    RPG.State.flags.matamatabiActive = false;
                    RPG.State.matamatabiStepsRemaining = 0;
                    RPG.State.mode = "event";
                    RPG.State.dialogueQueue = this.buildMatamatabiFadeQueue();
                    uiControl.updateUI();
                    this.playDialogueLoop();
                    return;
                }
            }

            if (RPG.State.isPoisoned) {
                if (battleSystem.applyPoisonTick()) {
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
                    journeyText = " オーエンは、揺れる荷台の縁に危うく腰掛け、興味なさそうに森の奥を見つめている。";
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
        if (scenarioEvents.treeEventSystem.handleEncounter(step)) return;

        const dist = RPG.State.currentDistance;
        const canInspectAmberTree =
            dist === 8 &&
            step > 0 &&
            RPG.State.inventory.silverCoin >= 1 &&
            !RPG.State.flags.hasTreeEventOccurred &&
            !RPG.State.flags.treeDefeated &&
            !RPG.State.flags.isTreeRematch;

        if (canInspectAmberTree) {
            uiControl.addLog("きらり。", "ambient");
            uiControl.addLog("少し先の木立の奥で、樹液が鈍く光っている。", "ambient");
            uiControl.updateUI();
            return;
        }

        const shouldShowMatamatabiHint =
            dist === 4 &&
            RPG.State.flags.heardMatamatabiRumor === true &&
            RPG.State.flags.matamatabiBranchFound !== true;

        if (shouldShowMatamatabiHint) {
            const hintLines = RPG.Assets.GAME_TEXT.events.phase4MatamatabiHint4m || [];
            hintLines.forEach(line => uiControl.addLog(line, "ambient"));
            uiControl.updateUI();
            return;
        }

        if (dist === 5 && !RPG.State.flags.forest5mBroochFound) {
            uiControl.addLog("きらり。", "ambient");
            uiControl.addLog("何かが一瞬、木漏れ日を反射して光ったように見えた。", "ambient");
        }

        if (dist === 6 && !RPG.State.flags.forest6mCoinFound) {
            uiControl.addLog("きらり。", "ambient");
            uiControl.addLog("足元の泥が、一瞬鈍く光ったように見えた。", "ambient");
        }

        if (this.isPhase6WagonSpot()) {
            const flavorLines = RPG.Assets.GAME_TEXT.events.phase6Wagon5mFlavor || [];
            flavorLines.forEach(line => uiControl.addLog(line, "ambient"));
            uiControl.updateUI();
            return;
        }

        if (RPG.State.storyPhase === 0) {
            if (dist === 3) {
                uiControl.addLog("カインは森の中を銀貨を探しながら歩いた", "ambient");
                if (!RPG.State.flags.forest3mFirstVisit) {
                    RPG.State.flags.forest3mFirstVisit = true;
                    RPG.State.mode = "event";
                    RPG.State.dialogueQueue = [
                        { text: "カイン「そんなに簡単に銀貨が落ちてるとは思えないが…」", delay: 1500 },
                        { text: "オーエン「王国の騎士様が這いつくばって小銭拾いとはね」", delay: 1500, color: "#a020f0" }
                    ];
                    this.playDialogueLoop();
                }
                return;
            }

            if (dist === 5) {
                RPG.State.flags.forest5mFirstVisit = true;
                uiControl.updateUI();
                return;
            }

            if (dist === 6) {
                if (!RPG.State.flags.forest6mFirstVisit) {
                    RPG.State.flags.forest6mFirstVisit = true;
                    RPG.State.mode = "event";
                    RPG.State.dialogueQueue = [
                        { text: "カイン「…ん？これは」", delay: 1500 }
                    ];
                    this.playDialogueLoop();
                }
                return;
            }
        }

        // Build 14.1.7: Check for Return Trip Event (Priority)
        if (dist === 5 && this.checkEvents()) return;

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
        if (Cinematics.canPlayThiefDiscovery()) {
            Cinematics.playThiefDiscovery();
            return;
        }

        const isMatamatabiFlavorActive =
            RPG.State.flags.matamatabiActive === true &&
            !isHighway &&
            RPG.State.isInDungeon &&
            dist > 0 &&
            dist < 10;

        // Ambient Flavor Text
        if (isMatamatabiFlavorActive) {
            const flavorPool = RPG.Assets.GAME_TEXT.events.phase4MatamatabiFlavor || [];
            if (flavorPool.length > 0 && Math.random() < 0.4) {
                const line = flavorPool[Math.floor(Math.random() * flavorPool.length)];
                uiControl.addLog(line, "ambient");
            }
        } else if (dist === 5 && !isHighway && RPG.State.storyPhase >= 1) {
            const flavorPool = RPG.Assets.GAME_TEXT.events.owenFlavor5m || [];
            if (flavorPool.length > 0) {
                const entry = flavorPool[Math.floor(Math.random() * flavorPool.length)];
                uiControl.addLog(entry.text, "ambient");

                if (entry.givesHerb) {
                    RPG.State.inventory.herb = (RPG.State.inventory.herb || 0) + 1;
                    uiControl.addLog("薬草を1つ手に入れた！");
                    uiControl.updateUI();
                }
            }
            return;
        } else if (RPG.Assets.AMBIENT_TEXTS[dist] && Math.random() < 0.4) {
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

    inspectHerbGarden: function () {
        const flags = RPG.State.flags;
        const distance = RPG.State.currentDistance;

        if (distance === 1 && flags.herbGardenHerb1Available !== false) {
            flags.herbGardenHerb1Available = false;
            RPG.State.inventory.herb = (RPG.State.inventory.herb || 0) + 1;
            uiControl.addLog("🌿薬草を手に入れた！", "", "#9fdb77");
            uiControl.updateUI();
            return;
        }

        if (distance === 2) {
            if (flags.herbGardenHerb2Available !== false) {
                flags.herbGardenHerb2Available = false;
                flags.herbGardenHerb2BattlesRemaining = 3;
                RPG.State.inventory.herb = (RPG.State.inventory.herb || 0) + 2;
                uiControl.addLog("🌿薬草を2つ手に入れた！", "", "#9fdb77");
                uiControl.addLog("カイン（…ちょっと頭が痛い）");
            } else {
                uiControl.addLog("倒木の下には何も残っていない。", "ambient");
            }
            uiControl.updateUI();
            return;
        }

        if (
            distance === 3 &&
            (RPG.State.inventory.lightRabbitBrooch || 0) > 0 &&
            flags.herbGardenBoneMealCollected !== true
        ) {
            if (!flags.herbGardenBoneMealInspected) {
                flags.herbGardenBoneMealInspected = true;
                uiControl.addLog("砕けた小さな骨のようだ。", "ambient");
                uiControl.addLog("カイン（これを🫙空瓶に入れれば、骨粉として持ち帰れそうだ）");
                // A subdued one-time operation cue prevents inspect-spam without overpowering the scene.
                uiControl.addLog("《アイテム欄から🫙空瓶を選んで使おう》", "ambient", "#555555", "13px");
            }
            uiControl.updateUI();
            return;
        }

        if (distance === 4) {
            if (flags.herbGardenHighHerbAvailable !== false) {
                flags.herbGardenHighHerbAvailable = false;
                flags.herbGardenHighHerbBattlesRemaining = 5;
                RPG.State.inventory.highHerb = (RPG.State.inventory.highHerb || 0) + 1;
                uiControl.addLog("🌿上薬草を手に入れた！", "", "#9fdb77");
            } else {
                uiControl.addLog("レンガの隙間には何も残っていない。", "ambient");
            }
            uiControl.updateUI();
            return;
        }

        if (distance === 6) {
            if (flags.herbGardenAntidoteHerbAvailable !== false) {
                flags.herbGardenAntidoteHerbAvailable = false;
                flags.herbGardenAntidoteHerbBattlesRemaining = 5;
                RPG.State.inventory.antidoteHerb = (RPG.State.inventory.antidoteHerb || 0) + 1;
                uiControl.addLog("🌼毒消し草を手に入れた！", "", "#f0d75b");
            } else {
                uiControl.addLog("石柱の陰には何も残っていない。", "ambient");
            }
            uiControl.updateUI();
            return;
        }

        if (distance === 7) {
            if (flags.herbGardenMintCollected !== true) {
                flags.herbGardenMintCollected = true;
                RPG.State.inventory.mintFlower = (RPG.State.inventory.mintFlower || 0) + 1;
                RPG.State.mode = "event";
                RPG.State.dialogueQueue = [
                    { text: "触れるとひんやりと冷たい。", type: "ambient" },
                    { text: "カイン「スースーした香りがする。これかな？」" },
                    { text: "🪻薄荷草を手に入れた！", color: "#b7a7e8" }
                ];
                this.playDialogueLoop();
                return;
            }

            if (flags.herbGardenEdibleHerbCollected !== true) {
                flags.herbGardenEdibleHerbCollected = true;
                RPG.State.inventory.edibleHerb = (RPG.State.inventory.edibleHerb || 0) + 1;
                RPG.State.mode = "event";
                RPG.State.dialogueQueue = [
                    { text: "カイン「肉料理に入ってるのを見たことがあるな。土産に持って帰るか」" },
                    { text: "🌱食用ハーブを手に入れた！", color: "#9fdb77" }
                ];
                this.playDialogueLoop();
                return;
            }

            uiControl.addLog("石で囲まれた小さな花壇がある。", "ambient");
            uiControl.updateUI();
            return;
        }

        uiControl.addLog(RPG.Assets.GAME_TEXT.exploration.talkInDungeon);
    },

    getForestObservation: function (distance) {
        if (RPG.State.location === "かつての街道") return null;

        const observations = RPG.Assets.GAME_TEXT.exploration.forestObservations || {};

        if (RPG.State.flags.giantLarvaDefeated === true && distance === 9) {
            return observations.giantLarvaDefeated?.[distance] || null;
        }
        if (RPG.State.flags.treeDefeated === true && (distance === 7 || distance === 8)) {
            return observations.treeDefeated?.[distance] || null;
        }
        return null;
    },

    talk: function () {
        if (RPG.State.mode !== "base") return;

        if (!RPG.State.isInDungeon) {
            uiControl.addLog(RPG.Assets.GAME_TEXT.exploration.talkAtInn);
            return;
        }

        if (this.isInHerbGarden()) {
            this.inspectHerbGarden();
            return;
        }

        const dist = RPG.State.currentDistance;
        const flags = RPG.State.flags;

        const forestObservation = this.getForestObservation(dist);
        if (forestObservation) {
            uiControl.addLog(forestObservation, "ambient");
            uiControl.updateUI();
            return;
        }

        if (dist === 5 && !flags.forest5mBroochFound) {
            flags.forest5mBroochFound = true;
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                {
                    text: "💍光るブローチを拾った！",
                    delay: 1500,
                    color: "#FFD700",
                    action: () => {
                        RPG.State.inventory.glowingBrooch = (RPG.State.inventory.glowingBrooch || 0) + 1;
                        uiControl.updateUI();
                    }
                },
                { text: "カイン「誰かの落とし物かもしれない。一応拾っておこう」", delay: 1500 },
                { text: "オーエン「汚いしゴミだと思うけど」", delay: 1500, color: "#a020f0" },
                { text: "カイン「日に当てるとちょっとだけキラッとする」", delay: 1500 }
            ];
            this.playDialogueLoop();
            return;
        }

        if (this.isPhase6WagonDriverSpot()) {
            if (flags.wagonHorseEncouraged === true) {
                if (flags.scentPouchCrafted !== true) {
                    const hasMint = (RPG.State.inventory.mintFlower || 0) > 0;
                    const hasBoneMeal = (RPG.State.inventory.boneMeal || 0) > 0;

                    if (!hasMint || !hasBoneMeal) {
                        RPG.State.mode = "event";
                        RPG.State.dialogueQueue = this.buildDialogueQueue(
                            RPG.Assets.GAME_TEXT.events.phase6WagonMaterialsPending
                        );
                        this.playDialogueLoop();
                        return;
                    }

                    if (flags.herbGardenBroochReturned !== true) {
                        RPG.State.mode = "event";
                        RPG.State.dialogueQueue = this.buildDialogueQueue(
                            RPG.Assets.GAME_TEXT.events.phase6WagonBroochReturnPending
                        );
                        this.playDialogueLoop();
                        return;
                    }

                    RPG.State.mode = "event";
                    RPG.State.dialogueQueue = [
                        ...this.buildDialogueQueue(RPG.Assets.GAME_TEXT.events.phase6ScentPouchCraft),
                        {
                            text: "🪻薄荷草と🦴骨粉を失った",
                            type: "marker",
                            color: "#f1e6c8",
                            action: () => {
                                RPG.State.inventory.mintFlower = Math.max(0, (RPG.State.inventory.mintFlower || 0) - 1);
                                RPG.State.inventory.boneMeal = Math.max(0, (RPG.State.inventory.boneMeal || 0) - 1);
                                uiControl.updateUI();
                            }
                        },
                        {
                            text: "💐香草袋が完成した！",
                            type: "marker",
                            color: "#f1e6c8",
                            action: () => {
                                RPG.State.inventory.scentPouch = (RPG.State.inventory.scentPouch || 0) + 1;
                                flags.scentPouchCrafted = true;
                                uiControl.updateUI();
                            }
                        }
                    ];
                    this.playDialogueLoop();
                    return;
                }

                if (flags.wagonReadyForDeparture !== true) {
                    RPG.State.mode = "event";
                    RPG.State.dialogueQueue = this.buildDialogueQueue(
                        RPG.Assets.GAME_TEXT.events.phase6ScentPouchTry
                    );
                    this.playDialogueLoop();
                    return;
                }

                RPG.State.mode = "event";
                RPG.State.dialogueQueue = this.buildDialogueQueue(
                    RPG.Assets.GAME_TEXT.events.phase6WagonReadyTalk
                );
                this.playDialogueLoop();
                return;
            } else {
                const talkStep = flags.wagonDriverTalkStep || 0;

                if (talkStep <= 0) {
                    RPG.State.mode = "event";
                    RPG.State.dialogueQueue = this.buildDialogueQueue(
                        RPG.Assets.GAME_TEXT.events.phase6WagonDriverTalk,
                        () => {
                            flags.wagonDriverTalkStep = 1;
                            uiControl.updateUI();
                        }
                    );
                    this.playDialogueLoop();
                    return;
                }

                if (talkStep === 1) {
                    RPG.State.mode = "event";
                    RPG.State.dialogueQueue = this.buildDialogueQueue(
                        RPG.Assets.GAME_TEXT.events.phase6WagonDriverMoreTalk,
                        () => {
                            flags.wagonDriverTalkStep = 2;
                            this.showWagonEncourageChoices();
                        }
                    );
                    this.playDialogueLoop();
                    return;
                }

                this.showWagonEncourageChoices();
                return;
            }
        }

        if (RPG.State.storyPhase === 0 && dist === 3 && flags.forest3mInspectCount === 0) {
            flags.forest3mInspectCount += 1;
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                { text: "カイン「おまえも手伝ってくれ」", delay: 1500 },
                { text: "オーエン「手伝ってるよ。間抜けな姿を見ててあげてるでしょ」", delay: 1500, color: "#a020f0" },
                { text: "カイン「……」", delay: 1500 }
            ];
            this.playDialogueLoop();
            return;
        }

        if (RPG.State.storyPhase === 0 && dist === 6 && !flags.forest6mCoinFound) {
            flags.forest6mCoinFound = true;
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                { text: "泥と落ち葉をかき分ける。", delay: 1500 },
                { text: "汚れでわかりづらいが、それは確かに銀貨だった。", delay: 1600 },
                {
                    text: "🪙銀貨を手に入れた！",
                    delay: 1500,
                    color: "#FFD700",
                    action: () => {
                        RPG.State.inventory.silverCoin += 1;
                        RPG.State.silverCoins += 1;
                        RPG.State.flags.hasFoundFirstCoin = true;
                        RPG.State.storyPhase = 1;
                        RPG.State.searchCounter = 0;
                        uiControl.updateUI();
                    }
                },
                { text: "カイン「…本当にあった……。」", delay: 1500 },
                { text: "オーエン「………へえ」", delay: 1500, color: "#a020f0" },
                { text: "カイン「他にもあるかもしれない。もう少し森を歩き回ってみよう」", delay: 1800 }
            ];
            this.playDialogueLoop();
            return;
        }

        if (
            dist === 4 &&
            flags.heardMatamatabiRumor === true &&
            flags.matamatabiBranchFound !== true
        ) {
            flags.matamatabiBranchFound = true;
            const pickupLines = RPG.Assets.GAME_TEXT.events.phase4MatamatabiPickup4m || [];
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = pickupLines.map(line => {
                if (line === "🌿マタマタビの枝 を手に入れた！") {
                    return {
                        text: line,
                        delay: 1500,
                        color: "#FFD700",
                        action: () => {
                            RPG.State.inventory.matamatabiBranch = (RPG.State.inventory.matamatabiBranch || 0) + 1;
                            RPG.State.matamatabiUseCount = 0;
                            uiControl.updateUI();
                        }
                    };
                }
                if (line.startsWith("オーエン")) {
                    return { text: line, delay: 1500, color: "#a020f0" };
                }
                return { text: line, delay: 1500 };
            });
            this.playDialogueLoop();
            return;
        }

        if (
            dist === 8 &&
            RPG.State.inventory.silverCoin >= 1 &&
            !flags.hasTreeEventOccurred &&
            !flags.treeDefeated &&
            !flags.isTreeRematch
        ) {
            if (flags.forest8mInspectCount === 0) {
                flags.forest8mInspectCount = 1;
                RPG.State.mode = "event";
                RPG.State.dialogueQueue = [
                    { text: "カイン「…ん？ あそこ何か」", delay: 1500 },
                    { text: "視線の先、その大樹は他の木々とは明らかに異相を呈していた。", delay: 1500 },
                    { text: "幹のいたるところで琥珀の瘤がぼこぼこと隆起し、黄金色の腫瘍のように木肌を覆っている。", delay: 1800 },
                    { text: "特に太い幹の空洞は、溢れ出した樹脂に飲み込まれた「黒い何か」で埋め尽くされていた。", delay: 1800 }
                ];
                this.playDialogueLoop();
                return;
            }

            if (flags.forest8mInspectCount === 1) {
                flags.forest8mInspectCount = 2;
                RPG.State.mode = "event";
                RPG.State.dialogueQueue = [
                    { text: "よく見ると黒い何かは樹脂に飲み込まれた人間のなれの果てだった。", delay: 1800 },
                    { text: "その中央、どろりとした塊の奥で、銀貨が心臓のように沈んでいる。", delay: 1800 },
                    { text: "オーエン「宿代、彼が払ってくれるって。ラッキーだね」", delay: 1500, color: "#a020f0" },
                    {
                        text: null,
                        action: () => {
                            RPG.State.flags.hasTreeEventOccurred = true;
                            RPG.State.mode = "choice";
                            scenarioEvents.treeEventSystem.showChoices();
                        }
                    }
                ];
                this.playDialogueLoop();
                return;
            }
        }

        uiControl.addLog(RPG.Assets.GAME_TEXT.exploration.talkInDungeon);
    },

    showWagonEncourageChoices: function () {
        RPG.State.mode = "choice";
        uiControl.updateUI();

        const btnChoiceA = document.getElementById('btnChoiceA');
        const btnChoiceB = document.getElementById('btnChoiceB');

        if (btnChoiceA) {
            btnChoiceA.style.display = 'flex';
            btnChoiceA.textContent = "馬をはげます";
            btnChoiceA.onclick = () => this.chooseWagonHorseEncourage();
            btnChoiceA.style.background = "";
        }

        if (btnChoiceB) {
            if (RPG.State.flags.wagonDriverEncouraged === true) {
                btnChoiceB.style.display = 'none';
            } else {
                btnChoiceB.style.display = 'flex';
                btnChoiceB.textContent = "御者をはげます";
                btnChoiceB.onclick = () => this.chooseWagonDriverEncourage();
                btnChoiceB.style.background = "#555";
            }
        }
    },

    chooseWagonDriverEncourage: function () {
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = this.buildDialogueQueue(
            RPG.Assets.GAME_TEXT.events.phase6WagonDriverEncourage,
            () => {
                RPG.State.flags.wagonDriverEncouraged = true;
                this.showWagonEncourageChoices();
            }
        );
        this.playDialogueLoop();
    },

    chooseWagonHorseEncourage: function () {
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = this.buildDialogueQueue(
            RPG.Assets.GAME_TEXT.events.phase6WagonHorseEncourage,
            () => {
                RPG.State.flags.wagonHorseEncouraged = true;
                RPG.State.flags.scentPouchQuestStarted = true;
                RPG.State.mode = "base";
                uiControl.updateUI();
            }
        );
        this.playDialogueLoop();
    },

    buildMatamatabiFadeQueue: function () {
        const lines = RPG.Assets.GAME_TEXT.events.phase4MatamatabiFade || [];
        return lines.map(line => {
            if (line.startsWith("オーエン")) {
                return { text: line, color: "#a020f0" };
            }
            if (line.startsWith("※")) {
                return { text: line, color: "#9acd32" };
            }
            return { text: line };
        });
    },

    buildMatamatabiManualUseQueue: function () {
        const useCount = RPG.State.matamatabiUseCount || 0;
        let sourceLines = RPG.Assets.GAME_TEXT.events.phase4MatamatabiReuseLoop || [];

        if (useCount === 0) {
            sourceLines = RPG.Assets.GAME_TEXT.events.phase4MatamatabiReuse1 || sourceLines;
        } else if (useCount === 1) {
            sourceLines = RPG.Assets.GAME_TEXT.events.phase4MatamatabiReuse2 || sourceLines;
        } else if (useCount === 2) {
            sourceLines = RPG.Assets.GAME_TEXT.events.phase4MatamatabiReuse3 || sourceLines;
        }

        return sourceLines.map(line => {
            if (line.startsWith("オーエン")) {
                return { text: line, color: "#a020f0" };
            }
            if (line === "🌿マタマタビの枝は活性化した") {
                return {
                    text: line,
                    color: "#9acd32",
                    action: () => {
                        RPG.State.flags.matamatabiActive = true;
                        RPG.State.flags.matamatabiNightPending = true;
                        RPG.State.matamatabiStepsRemaining = 10;
                        RPG.State.matamatabiUseCount = (RPG.State.matamatabiUseCount || 0) + 1;
                        uiControl.updateUI();
                    }
                };
            }
            return { text: line };
        });
    },

    buildGlowingCatRabbitRewardUseQueue: function (itemId) {
        if (itemId === "lightBook") {
            return [
                { text: "カインは📙光の書を開いた！", type: "marker", color: "#f1e6c8" },
                { text: "カイン「これは文字か？全然読めない」" },
                { text: "ページには指で擦ったような、文字とも言えない痕がたくさんついている。カインが指先で触れた瞬間、口が勝手に内容を読み始めた。" },
                { text: "カイン「…！魔界において、最強の魔獣であり洞穴の守護者…我ら、光る猫うさぎの王の名においてこの書を記す。我らの王の名はミス…っむぐ」" },
                { text: "オーエン「おい」" },
                { text: "オーエンがカインの口を後ろから手で塞いで、もう片手でその本を奪い取った。" },
                { text: "カイン「んぐ」" },
                { text: "オーエン「呼ぶなよ。来たらどうすんの」" },
                { text: "カイン「むぐぐ」" },
                { text: "オーエンは本を紫の炎で燃やし尽くすと土に投げ捨て、靴で踏んだ。" },
                { text: "オーエン「…やっぱりね。そんな気がしてたんだ」" },
                { text: "カイン「知ってるのか？光る猫うさぎの王を」" },
                { text: "オーエン「知らないよ。猫もうさぎもどうでもいい」" },
                { text: "カイン（光る猫うさぎの愛読書か？内容がめちゃくちゃ気になるな）" }
            ];
        }

        if (itemId === "purpleMacaron") {
            return [
                { text: "カインは🟣紫マカロンを取り出した！", type: "marker", color: "#f1e6c8" },
                { text: "オーエン「やった！お菓子だ！」" },
                { text: "カイン「…食べ物に紫は不味そうじゃないか？」" },
                { text: "オーエン「はやく頂戴」" },
                { text: "オーエンはマカロンを奪い取った！" },
                { text: "カイン（けど、オーエンの服装とは合ってるな。）" },
                { text: "オーエン「もぐもぐ。甘い。……」" },
                { text: "オーエンが黙る。" },
                { text: "カイン「…どうした？」" },
                { text: "オーエンが口元を抑える。" },
                { text: "オーエン「……、っ！！！」" },
                { text: "抑えた手元から、ボタボタと鮮血が垂れる。珍しく苦しそうだ。" },
                { text: "カイン「オーエン！？」" },
                { text: "オーエン「……、」" },
                { text: "オーエンはカインの手を引き寄せて、そこに口の中のものを全部出した。" },
                { text: "カイン「うわ！？地面に吐けよ！」" },
                { text: "オーエン「…っげほ、」" },
                { text: "しゅう、と手袋が溶ける。" },
                { text: "カイン「なっ！？」" },
                { text: "溶けた手袋の下で、指先がじんと痺れた。" },
                {
                    text: "《カインは毒状態になった！》",
                    type: "marker",
                    color: "#ff4d4d",
                    action: () => {
                        RPG.State.isPoisoned = true;
                        RPG.State.poisonDamageRemaining = Math.max(1, Math.floor(RPG.State.maxHP / 3));
                        uiControl.updateUI();
                    }
                },
                { text: "オーエン「ふう…すっきりした」" },
                { text: "オーエンの鼻血はもう止まっている。" },
                { text: "カイン（……俺が毒状態になったんだが…）" },
                { text: "カインは溶けた手袋を外した。" }
            ];
        }

        if (itemId === "glowingBunnyEars") {
            const healAmount = Math.max(1, Math.floor(RPG.State.maxHP * 0.3));
            return [
                { text: "カインは🐰光るうさ耳をつけた！", type: "marker", color: "#f1e6c8" },
                { text: "カイン「にゃあ！にゃあにゃあ！！」" },
                { text: "（変わった耳だな！本物みたいで）" },
                { text: "オーエン「は？」" },
                { text: "カイン「にゃっ！？にゃあにゃあ！！」" },
                { text: "（えっ！俺にゃあにゃあ言ってる！？）" },
                { text: "オーエン「たのしそうだね」" },
                { text: "カインは光るうさ耳を外そうとした。" },
                { text: "カイン「…っ」" },
                { text: "（痛い！）" },
                { text: "オーエン「どうしたの？」" },
                { text: "カイン「にゃあにゃあ！」" },
                { text: "（外せない！取ってくれ！）" },
                { text: "オーエン「お腹空いたの？」" },
                { text: "カイン「にゃあ！」（違う！）" },
                { text: "オーエン「撫でて欲しい？」" },
                { text: "カイン「にゃあ！」（違…っ）" },
                { text: "オーエンの手が、カインのウサ耳をやんわりと掴む。" },
                { text: "カイン「にゃ…っ！！」" },
                { text: "鳥肌の立つような感覚に思わず目を瞑る。" },
                { text: "カチューシャがする、と頭から取れた。" },
                { text: "カイン「はあ、はあ……びっくりした。」" },
                { text: "オーエン「ふうん…？」" },
                { text: "《オーエンはカチューシャを再びカインの頭に戻した》", type: "marker", color: "#f1e6c8" },
                { text: "カイン「にゃあ！にゃあにゃあ！！」" },
                { text: "オーエン「あはは！何？もっとちゃんと言ってよ」" },
                { text: "オーエンはしつこく耳を触る。" },
                { text: "カイン「にゃあ！！にゃあ！！」" },
                { text: "オーエン「身体が光ってきた。たのしい」" },
                {
                    text: null,
                    action: () => {
                        const logContainer = document.getElementById("logContainer");
                        if (logContainer) logContainer.classList.add("night-mode");
                    }
                },
                {
                    text: null,
                    delay: 2600,
                    action: () => {
                        RPG.State.currentHP = Math.min(RPG.State.maxHP, RPG.State.currentHP + healAmount);
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
                { text: "――しばらくして。", type: "marker", color: "#f1e6c8" },
                { text: "カイン「はあ…はあ…」" },
                { text: "ぼんやりと光ったカインは明らかに弱っている。" },
                { text: "オーエン「ほら、食べていいよ」" },
                { text: "オーエンはカインの口に🌿薬草を入れた！" },
                { text: `HPが${healAmount}回復した。`, type: "marker", color: "#9acd32" },
                { text: "カイン「……むしゃむしゃ」" },
                { text: "オーエン「ありがとうは？」" },
                { text: "カイン「にゃあ……」" },
                { text: "オーエン「どういたしまして」" },
                { text: "オーエンはカインからカチューシャを取ると、光るうさ耳を自分の懐へしまった。" },
                { text: "《🐰光るうさ耳を失った！》", type: "marker", color: "#f1e6c8" },
                { text: "カイン「え？」" },
                { text: "オーエン「僕が貰ってあげる。」" },
                { text: "カイン「…何か使い道あるのか？それ」" },
                { text: "オーエン「必要な時に使う。」" },
                { text: "カイン（どんな時かは聞かないでおこう…）" }
            ];
        }

        return null;
    },

    getItemUseDialogue: function (itemId) {
        if (itemId === 'scentPouch') {
            if (this.canUseScentPouchOnHighway()) {
                return [
                    ...this.buildDialogueQueue(RPG.Assets.GAME_TEXT.events.phase7ScentPouchHandoff),
                    {
                        text: null,
                        action: () => {
                            RPG.State.flags.scentPouchHandedToDriver = true;
                            uiControl.updateUI();
                        }
                    }
                ];
            }

            return [
                ...this.buildDialogueQueue(RPG.Assets.GAME_TEXT.events.phase6ScentPouchUse),
                {
                    text: null,
                    action: () => {
                        RPG.State.flags.wagonReadyForDeparture = true;
                        uiControl.updateUI();
                    }
                }
            ];
        }

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

        if (itemId === 'matamatabiBranch') {
            return this.buildMatamatabiManualUseQueue();
        }

        if (["lightBook", "purpleMacaron", "glowingBunnyEars"].includes(itemId)) {
            return this.buildGlowingCatRabbitRewardUseQueue(itemId);
        }

        return null;
    },

    useItem: function (itemId) {
        if (!RPG.State.inventory[itemId] || RPG.State.inventory[itemId] <= 0) return;

        let success = false;
        let consumeItem = true;
        switch (itemId) {
            case 'herb':
                if (RPG.State.currentHP >= RPG.State.maxHP) {
                    uiControl.addLog(RPG.Assets.GAME_TEXT.items.notNeeded);
                    uiControl.closeModal();
                    return;
                }
                const healAmount = Math.floor(RPG.State.maxHP * 0.3);
                RPG.State.currentHP = Math.min(RPG.State.maxHP, RPG.State.currentHP + healAmount);
                uiControl.addLog(`🌿薬草を使い、HPが${healAmount}回復した。`);
                RPG.State.herbUseCount = (RPG.State.herbUseCount || 0) + 1;
                success = true;
                break;
            case 'highHerb':
                if (RPG.State.currentHP >= RPG.State.maxHP) {
                    uiControl.addLog(RPG.Assets.GAME_TEXT.items.notNeeded);
                    uiControl.closeModal();
                    return;
                }
                const highHerbHealAmount = Math.floor(RPG.State.maxHP * 0.6);
                RPG.State.currentHP = Math.min(RPG.State.maxHP, RPG.State.currentHP + highHerbHealAmount);
                uiControl.addLog(`🌿上薬草を使い、HPが${highHerbHealAmount}回復した。`);
                success = true;
                break;
            case 'antidoteHerb':
                if (!RPG.State.isPoisoned) {
                    uiControl.addLog(RPG.Assets.GAME_TEXT.items.notNeeded);
                    uiControl.closeModal();
                    return;
                }
                battleSystem.curePoison();
                uiControl.addLog("🌼毒消し草を使い、毒が浄化された。", "", "#a333c8");
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
            case 'matamatabiBranch':
                if (RPG.State.flags.matamatabiActive === true) {
                    uiControl.addLog(RPG.Assets.GAME_TEXT.items.notNeeded, "", "#9acd32");
                    uiControl.closeModal();
                    return;
                }
                success = true;
                consumeItem = false;
                break;
            case 'emptyBottle':
                if (!this.canCollectHerbGardenBoneMeal()) {
                    uiControl.addLog(RPG.Assets.GAME_TEXT.items.cannotUse);
                    uiControl.closeModal();
                    return;
                }
                RPG.State.inventory.boneMeal = (RPG.State.inventory.boneMeal || 0) + 1;
                RPG.State.flags.herbGardenBoneMealCollected = true;
                uiControl.addLog("🦴骨粉を手に入れた！", "", "#f1e6c8");
                success = true;
                break;
            case 'scentPouch':
                const canUseScentPouchAtWagon = this.canUseScentPouchAtWagon();
                const canUseScentPouchOnHighway = this.canUseScentPouchOnHighway();
                if (!canUseScentPouchAtWagon && !canUseScentPouchOnHighway) {
                    uiControl.addLog(RPG.Assets.GAME_TEXT.items.cannotUse);
                    uiControl.closeModal();
                    return;
                }
                success = true;
                consumeItem = canUseScentPouchOnHighway;
                break;
            case 'glowingBunnyEars':
                if (!RPG.State.isInDungeon) {
                    uiControl.addLog("カイン（人前でつけるのはちょっと恥ずかしいな）");
                    uiControl.closeModal();
                    return;
                }
                success = true;
                break;
            case 'nightMedicine':
                if (!RPG.State.isAtInn) {
                    uiControl.addLog("カイン（寝る前に飲もう）");
                    uiControl.closeModal();
                    return;
                }
                RPG.State.inventory[itemId]--;
                uiControl.updateUI();
                uiControl.closeModal();
                innSystem.playNightMedicineSleep();
                return;
            case 'lightBook':
            case 'purpleMacaron':
                success = true;
                break;
            default:
                uiControl.addLog(RPG.Assets.GAME_TEXT.items.cannotUse);
                break;
        }

        if (success) {
            const itemDialogue = this.getItemUseDialogue(itemId);
            if (consumeItem) {
                RPG.State.inventory[itemId]--;
            }
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

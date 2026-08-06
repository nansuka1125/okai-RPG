// 🚩ーー【移動・探索システム】ーー
// Build 14.1: Namespaces updated to RPG.State and RPG.Assets
const explorationSystem = {
    isInHerbGarden: function () {
        return RPG.State.explorationArea === "herbGarden";
    },

    getTemporaryEffectSteps: function (fieldName) {
        return Math.max(0, Number(RPG.State[fieldName]) || 0);
    },

    canUseFakeWoundMedicine: function () {
        return RPG.State.mode === "base";
    },

    canUseShinyOil: function () {
        return RPG.State.mode === "base";
    },

    canUseSmokeBomb: function () {
        const isFreeExplorationArea =
            RPG.State.explorationArea === "forest" ||
            RPG.State.explorationArea === "herbGarden";
        return (
            RPG.State.mode === "base" &&
            RPG.State.isInDungeon === true &&
            RPG.State.isAtInn !== true &&
            RPG.State.flags.onWagon !== true &&
            RPG.State.location !== "かつての街道" &&
            isFreeExplorationArea &&
            this.getTemporaryEffectSteps("smokeBombStepsRemaining") <= 0
        );
    },

    canOpenHardBottle: function () {
        return RPG.State.cainLv >= 10;
    },

    beginTemporaryFieldStep: function () {
        const isCountedFreeMove =
            RPG.State.mode === "base" &&
            RPG.State.isInDungeon === true &&
            RPG.State.isAtInn !== true &&
            RPG.State.flags.onWagon !== true;

        if (!isCountedFreeMove) {
            return {
                counted: false,
                smokeActive: false,
                smokeExpired: false
            };
        }

        const smokeSteps = this.getTemporaryEffectSteps("smokeBombStepsRemaining");
        const effects = {
            counted: true,
            smokeActive: smokeSteps > 0,
            smokeExpired: smokeSteps === 1
        };

        RPG.State.smokeBombStepsRemaining = Math.max(0, smokeSteps - 1);
        return effects;
    },

    finishTemporaryFieldStep: function (effects) {
        if (!effects || effects.counted !== true) return;

        if (effects.smokeExpired) {
            uiControl.addLog("煙が薄れ、気配が元に戻った。");
        }
        if (effects.smokeExpired) {
            uiControl.updateUI();
        }
    },

    clearTemporaryItemEffects: function () {
        RPG.State.smokeBombStepsRemaining = 0;
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

    isRandomEncounterSuppressed: function (options = {}) {
        return (
            options.smokeActive === true ||
            (
                RPG.State.storyPhase === 8 &&
                RPG.State.flags.onWagon === true
            ) ||
            RPG.State.location === "かつての街道"
        );
    },

    // After the thief-boy encounter, the forest's 7m-9m depths are where the amber sap and its
    // spreading source are meant to be easy to find. This only ever gates the plain random-step
    // battle roll below - fixed/boss/event battles never pass through this check.
    isDeepForestPostThiefBoyZone: function () {
        return (
            RPG.State.flags.metThiefBoy === true &&
            RPG.State.location !== "かつての街道" &&
            RPG.State.currentDistance >= 7 &&
            RPG.State.currentDistance <= 9
        );
    },

    // 雨そのものの継続を表す。占い師から少年の居場所を聞いた直後(thiefDiscoveryStatus>=1)に始まり、
    // 銀貨納品後の一泊(phase6PostDeliverySleepDone)が明けるまで続く。大幼蟲を倒しても銀貨を納品
    // しても雨は止まらないため、このヘルパーは giantLarvaDefeated / silverDelivered を一切参照
    // しない。7mの開始演出「雨が降り始めた……」だけはボス撃破前の一度きりの体験にしたいので、
    // その呼び出し側だけが `isRainActive() && flags.giantLarvaDefeated !== true` を重ねる
    // （EVENT_DATA の forest_7m_rain_start を参照）。8mの継続フレーバーは isRainActive() のみで
    // 判定し、ボス撃破後・銀貨納品後の再訪でも雨が続いている限り表示される。
    isRainActive: function () {
        return (
            (RPG.State.flags.thiefDiscoveryStatus || 0) >= 1 &&
            RPG.State.flags.phase6PostDeliverySleepDone !== true
        );
    },

    // 大幼蟲を倒し、銀貨3枚を持って宿屋へ向かっている最中（納品前）。
    // ランダムエンカウント抑制・毒ティック停止・帰路イベント条件を一箇所で定義する。
    isPeacefulReturnActive: function () {
        return (
            RPG.State.flags.giantLarvaDefeated === true &&
            RPG.State.inventory.silverCoin === 3 &&
            RPG.State.flags.silverDelivered !== true
        );
    },

    tryHerbGardenEncounter: function (distance, options = {}) {
        if (this.isRandomEncounterSuppressed(options)) return false;
        if (distance === 3 || distance <= 0) return false;
        if (Math.random() >= RPG.Assets.CONFIG.BATTLE_RATE) return false;

        if (RPG.State.storyPhase >= 6 && distance <= 2) {
            return battleSystem.startBattle(
                Math.random() < 0.35 ? "skull_bee" : "rat",
                { randomEncounter: true }
            ) === true;
        }

        if (distance <= 2) {
            return battleSystem.startBattle("rat", { randomEncounter: true }) === true;
        }

        if (RPG.State.storyPhase >= 6 && Math.random() < 0.25) {
            return battleSystem.startBattle("skull_bee", { randomEncounter: true }) === true;
        }

        // Match the forest's existing rat/weasel weight ratio (10:3) after 4m.
        const enemyId = Math.random() < (10 / 13) ? "rat" : "weasel";
        return battleSystem.startBattle(enemyId, { randomEncounter: true }) === true;
    },

    tryHerbGardenVineEncounter: function (distance, options = {}) {
        const flags = RPG.State.flags;
        if (RPG.State.storyPhase < 6) return false;

        if (distance === 5 && flags.carnivorousVineDefeated !== true) {
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                ...this.buildDialogueQueue(RPG.Assets.GAME_TEXT.events.phase6CarnivorousVineIntro),
                {
                    text: null,
                    action: () => {
                        if (battleSystem.startBattle("carnivorous_vine") && RPG.State.battleState) {
                            RPG.State.battleState.isInitialHerbGardenVine = true;
                        }
                    }
                }
            ];
            this.playDialogueLoop();
            return true;
        }

        if (
            distance >= 4 &&
            distance <= 6 &&
            flags.carnivorousVineRegrown === true &&
            !this.isRandomEncounterSuppressed(options) &&
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
            const temporaryEffects = this.beginTemporaryFieldStep();
            RPG.State.location = uiControl.getLocData(nextDistance).name;
            uiControl.addLog(RPG.Assets.GAME_TEXT.exploration.moved(nextDistance));

            if (RPG.State.isPoisoned && battleSystem.applyPoisonTick()) {
                this.finishTemporaryFieldStep(temporaryEffects);
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

            if (this.playHerbGardenBroochPassage(nextDistance)) {
                this.finishTemporaryFieldStep(temporaryEffects);
                return;
            }

            if (nextDistance === 3 && (RPG.State.inventory.lightRabbitBrooch || 0) === 0) {
                if (RPG.State.storyPhase >= 6 && RPG.State.flags.scentPouchQuestStarted === true) {
                    this.playPhase6HerbGardenBlock();
                } else {
                    this.playHerbGardenBlockedEvent();
                }
                this.finishTemporaryFieldStep(temporaryEffects);
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
                this.finishTemporaryFieldStep(temporaryEffects);
                return;
            }

            if (RPG.State.flags.herbGardenReturnHandholdActive !== true) {
                if (this.tryHerbGardenVineEncounter(nextDistance, temporaryEffects)) {
                    this.finishTemporaryFieldStep(temporaryEffects, { preserveBattleEligibility: true });
                    return;
                }
                if (this.tryHerbGardenEncounter(nextDistance, temporaryEffects)) {
                    this.finishTemporaryFieldStep(temporaryEffects, { preserveBattleEligibility: true });
                    return;
                }
            }

            this.finishTemporaryFieldStep(temporaryEffects);
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

        // herbAmber: shared by every genuine field-movement call site (forest and herb garden
        // both route through here), so a single hook covers both without duplication.
        if (RPG.State.equippedRareAmberId === "herbAmber" && RPG.State.currentHP < RPG.State.maxHP) {
            const healAmount = Math.min(
                RPG.State.maxHP - RPG.State.currentHP,
                Math.max(1, Math.floor(RPG.State.maxHP * RPG.Config.RARE_AMBER_TUNING.HERB_AMBER_MOVE_HEAL_RATE))
            );
            RPG.State.currentHP += healAmount;
            uiControl.addLog(`《薬草入り琥珀》の効果でHPが${healAmount}回復した。`, "", "#9acd32");
        }

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

    // Tail of the one-time forest-2m pacification talk. Marks it read only here, once the last
    // line has actually been shown, then hands the same arrival over to the Phase 7 wagon prompt
    // if that was also due - playDialogueLoop() re-enters synchronously after this action, so a
    // freshly assigned queue is picked up seamlessly and neither scene is lost.
    continueAfterForest2mPacifiedTalk: function () {
        RPG.State.flags.forest2mPacifiedTalkSeen = true;

        const wagonEvent = (RPG.Assets.EVENT_DATA || []).find(ev => ev.id === "finale_wagon_encounter");
        if (wagonEvent && wagonEvent.condition(RPG.State)) {
            wagonEvent.action(RPG.State);
            return;
        }
        uiControl.updateUI();
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
        if (RPG.State.flags.chapter1Cleared === true) return;
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
            this.clearAmberRootKeyBurnOpportunity();

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

        // Hold Cain at the giant_larva corpse until the third silver coin is recovered.
        // Repeated presses must not stack the same line endlessly.
        if (
            step < 0 &&
            RPG.State.currentDistance === 10 &&
            RPG.State.location !== "かつての街道" &&
            RPG.State.flags.giantLarvaDefeated === true &&
            (RPG.State.larvaCorpseStage || 0) < 1
        ) {
            const container = document.getElementById('logContainer');
            const line = "カイン（さっき光ったものが気になるな…一応見ておくか）";
            if (!container || container.lastElementChild?.textContent !== line) {
                uiControl.addLog(line);
            }
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

        let temporaryEffects = null;
        if (step !== 0) {
            RPG.State.canStay = true;
            RPG.State.currentDistance = nextDist;
            // Stepping off the burn site forfeits the burn chance for good, in either direction.
            this.clearAmberRootKeyBurnOpportunity();
            this.recordTravelStep();
            if (
                RPG.State.flags.onWagon === true &&
                RPG.State.location !== "かつての街道"
            ) {
                this.clearTemporaryItemEffects();
            }
            temporaryEffects = this.beginTemporaryFieldStep();
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
                    this.finishTemporaryFieldStep(temporaryEffects);
                    return;
                }
            }

            if (RPG.State.isPoisoned && !this.isPeacefulReturnActive()) {
                if (battleSystem.applyPoisonTick()) {
                    this.finishTemporaryFieldStep(temporaryEffects);
                    battleSystem.resolveDefeat();
                    return;
                }
            }
        }

        // Build 14.2.1: Journey Dialogues (Story Phase 8)
        if (
            RPG.State.storyPhase === 8 &&
            step !== 0 &&
            !RPG.State.completedEvents.includes("phase8_wagon_journey_completed")
        ) {
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
                this.finishTemporaryFieldStep(temporaryEffects);
                return;
            }
        }

        // Build 14.2.2: Former Highway Fixed Encounters (6m only - others handled by events)
        if (RPG.State.location === "かつての街道" && RPG.State.storyPhase === 9 && step !== 0) {
            const dist = RPG.State.currentDistance;

            // 6m: Single crow battle (not handled by EVENT_DATA).
            // The count is a victory count and is updated only by battleSystem.
            if (dist === 6 && (Number(RPG.State.highwayBattleCount[6]) || 0) < 1) {
                battleSystem.startHighwayFixedBattle(6, 'eye_eating_crow');
                this.finishTemporaryFieldStep(temporaryEffects);
                return;
            }
        }

        // Build 15.1.2: Delegated to scenarioEvents.treeEventSystem.handleEncounter()
        if (scenarioEvents.treeEventSystem.handleEncounter(step)) {
            this.finishTemporaryFieldStep(temporaryEffects);
            return;
        }

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
            this.finishTemporaryFieldStep(temporaryEffects);
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
            this.finishTemporaryFieldStep(temporaryEffects);
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
            this.finishTemporaryFieldStep(temporaryEffects);
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
                this.finishTemporaryFieldStep(temporaryEffects);
                return;
            }

            if (dist === 5) {
                RPG.State.flags.forest5mFirstVisit = true;
                uiControl.updateUI();
                this.finishTemporaryFieldStep(temporaryEffects);
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
                this.finishTemporaryFieldStep(temporaryEffects);
                return;
            }
        }

        // Build 14.1.7: Check for Return Trip Event (Priority)
        if (dist === 5 && this.checkEvents()) {
            this.finishTemporaryFieldStep(temporaryEffects, { preserveBattleEligibility: true });
            return;
        }

        // 10m Priority Logic
        if (dist === 10) {
            if (this.checkEvents()) {
                this.finishTemporaryFieldStep(temporaryEffects, { preserveBattleEligibility: true });
                return;
            }
            uiControl.addLog(RPG.Assets.GAME_TEXT.events.pathAt10m);
            uiControl.updateUI();
            this.finishTemporaryFieldStep(temporaryEffects);
            return;
        }

        if (this.checkEvents()) {
            this.finishTemporaryFieldStep(temporaryEffects, { preserveBattleEligibility: true });
            return;
        }

        // エンカウント判定
        // Build 15.2.3: Peaceful Return Mode only applies to the successful post-giant_larva
        // return trip (silver coin count alone is not a safe gate - see isPeacefulReturnActive()).
        const isPeacefulMode = this.isPeacefulReturnActive();

        // Build 14.2.2: No random encounters on Former Highway (fixed encounters only)
        const isHighway = (RPG.State.location === "かつての街道");
        const randomEncounterSuppressed = this.isRandomEncounterSuppressed(temporaryEffects || {});

        if (
            !randomEncounterSuppressed &&
            !isPeacefulMode &&
            RPG.State.isInDungeon &&
            step !== 0 &&
            RPG.State.currentDistance > 0 &&
            RPG.State.currentDistance < 10
        ) {
            const effectiveBattleRate = this.isDeepForestPostThiefBoyZone()
                ? RPG.Config.DEEP_FOREST_POST_THIEF_BOY_BATTLE_RATE
                : RPG.Assets.CONFIG.BATTLE_RATE;
            if (Math.random() < effectiveBattleRate) {
                const battleStarted = battleSystem.startBattle(null);
                if (battleStarted) {
                    this.finishTemporaryFieldStep(temporaryEffects);
                    return;
                }
            }
        }

        uiControl.updateUI();

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
            this.finishTemporaryFieldStep(temporaryEffects);
            return;
        } else if (dist === 8 && this.isRainActive()) {
            // Continues to show on any 8m visit while the rain lasts, including post-boss and
            // post-delivery revisits (rain only ends at phase6PostDeliverySleepDone). The
            // checkEvents() call earlier in move() already gives the giant_larva return-trip
            // event (and other checkEvents()-based events) priority on the move that triggers
            // them, so this branch is only ever reached once no such event fires this step.
            uiControl.addLog("足元がぬかるんでいる。", "ambient");
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
        this.finishTemporaryFieldStep(temporaryEffects);
    },

    inspectHerbGarden: function () {
        const flags = RPG.State.flags;
        const distance = RPG.State.currentDistance;

        // Vine nest side trip. Both branches sit ahead of the harvest spots below: inside the
        // nest the examine command belongs to the nest, and at the entrance the nest button
        // replaces 【調べる】 outright once discovered (it never comes back).
        if (this.isInVineNest()) {
            this.inspectVineNestDepths();
            return;
        }

        if (distance === 0) {
            if (flags.herbGardenVineNestState === "unknown") {
                flags.herbGardenVineNestState = "discovered";
                uiControl.addLog("カイン（……ここの草むら、かき分けたら入れそうだな）");
                uiControl.updateUI();
            } else {
                this.enterVineNest();
            }
            return;
        }

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

    // --- Carnivorous vine nest (herb garden entrance side trip) ---
    //
    // The nest is a location override at distance 0, exactly like the forest hut at 10m: the
    // distance never changes, so the garden's own harvest/encounter logic is untouched and the
    // backdrop swap rides on visualDirector's location check.

    VINE_NEST_LOCATION: "肉食カズラの巣",

    isInVineNest: function () {
        return (
            RPG.State.explorationArea === "herbGarden" &&
            RPG.State.location === this.VINE_NEST_LOCATION
        );
    },

    // Whether the nest currently holds vines. Deliberately keyed on the nest's own flag rather
    // than carnivorousVineRegrown: the shared regrowth flag is cleared by every vine kill
    // (executeStandardVictory), so reading it here would empty the nest as soon as the first of
    // the three died and break the "defeated mid-chain retries from the first vine" rule.
    isVineNestOccupied: function () {
        return RPG.State.flags.herbGardenVineNestCleared !== true;
    },

    exitVineNest: function () {
        RPG.State.location = uiControl.getLocData(0).name;
        uiControl.updateUI();
    },

    // Shared blackout for both nest transitions. Darkens the log only, the same way the inn's
    // scene changes do (#logContainer.night-mode), rather than covering the whole screen. The
    // location is swapped while the log is dark, so the backdrop change lands unseen.
    buildVineNestTransitionQueue: function (line, applyMove) {
        return [
            {
                text: null,
                delay: 400,
                action: () => {
                    const logContainer = document.getElementById('logContainer');
                    if (logContainer) logContainer.classList.add('night-mode');
                }
            },
            // Tagged so it stays readable while the log is dark - see the night-mode exception
            // in style.css. Without it the darkened log hides every entry.
            { text: line, type: "nightvisible" },
            {
                text: null,
                delay: 400,
                action: () => {
                    applyMove();
                    uiControl.updateUI();
                    const logContainer = document.getElementById('logContainer');
                    if (logContainer) logContainer.classList.remove('night-mode');
                }
            }
        ];
    },

    enterVineNest: function () {
        uiControl.addSeparator();
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            { text: null, action: () => uiControl.beginSceneLogFocus() },
            { text: null, delay: 650 },
            ...this.buildVineNestTransitionQueue(
                "カインは草むらを手探りで進んだ。",
                () => {
                    RPG.State.location = this.VINE_NEST_LOCATION;
                }
            ),
            {
                text: "肉食カズラの巣だ！",
                action: () => {
                    // Confirmed here, which is what makes the entrance button permanently
                    // 【肉食カズラの巣】 - fleeing or being defeated never walks it back.
                    RPG.State.flags.herbGardenVineNestState = "confirmed";
                    uiControl.updateUI();
                }
            },
            {
                text: null,
                action: () => {
                    if (this.isVineNestOccupied()) {
                        this.showVineNestChoices();
                    } else {
                        RPG.State.mode = "event";
                        RPG.State.dialogueQueue = [
                            { text: "行き止まりだ……。" },
                            { text: null, action: () => uiControl.endSceneLogFocus() }
                        ];
                        this.playDialogueLoop();
                    }
                }
            }
        ];
        this.playDialogueLoop();
    },

    showVineNestChoices: function () {
        const container = document.getElementById('action-buttons');
        if (!container) return;

        RPG.State.mode = 'choice';
        container.innerHTML = '';
        container.style.display = 'flex';
        const addChoice = (text, action) => {
            const button = document.createElement('button');
            button.className = 'btn btn-full';
            button.textContent = text;
            button.onclick = action;
            container.appendChild(button);
        };

        addChoice('【戦う】', () => {
            container.style.display = 'none';
            uiControl.endSceneLogFocus();
            battleSystem.vineNestChainRemaining = 3;
            battleSystem.startBattle("carnivorous_vine");
        });
        addChoice('【逃げる】', () => {
            container.style.display = 'none';
            uiControl.endSceneLogFocus();
            // Pure retreat: HP, defeat counts and every vine defeat/regrowth flag are left alone.
            battleSystem.clearVineNestChain();
            uiControl.addSeparator();
            RPG.State.mode = 'event';
            RPG.State.dialogueQueue = this.buildVineNestTransitionQueue(
                "カインは草むらを引き返した。",
                () => this.exitVineNest()
            );
            this.playDialogueLoop();
        });

        // Use the shared choice-mode lock: only these two buttons remain visible and enabled.
        uiControl.updateUI();
    },

    inspectVineNestDepths: function () {
        if (RPG.State.flags.herbGardenVineNestAmberTaken === true) {
            uiControl.addLog(RPG.Assets.GAME_TEXT.exploration.talkInDungeon);
            uiControl.updateUI();
            return;
        }

        uiControl.addSeparator();
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            {
                text: "🔸？琥珀を手に入れた！",
                type: "marker",
                color: "#ffd166",
                action: () => {
                    // Same idiom as the larva-corpse amber: the ？琥珀 goes in unidentified and
                    // only the queued appraisal result decides what it turns out to be, so the
                    // name 《無視入り琥珀》 stays hidden until the merchant appraises it.
                    RPG.State.inventory.unknownAmber = (RPG.State.inventory.unknownAmber || 0) + 1;
                    RPG.State.unappraisedAmberResults = Array.isArray(RPG.State.unappraisedAmberResults)
                        ? RPG.State.unappraisedAmberResults
                        : [];
                    RPG.State.unappraisedAmberResults.push("ignoredAmber");
                    RPG.State.flags.herbGardenVineNestAmberTaken = true;
                    uiControl.updateUI();
                }
            }
        ];
        this.playDialogueLoop();
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

    // --- Amber root discovery (6m/7m/8m), unlocked by sap_source_awareness ---

    getAmberRootState: function (distance) {
        if (!RPG.State.amberRootState) RPG.State.amberRootState = {};
        return RPG.State.amberRootState[distance] || "unexamined";
    },

    // Called from every point where Cain is committed to leaving his current spot: the two
    // move() paths, inn arrival, and the two defeat resolutions. Idempotent, so overlapping
    // call sites are harmless.
    clearAmberRootKeyBurnOpportunity: function () {
        RPG.State.amberRootKeyBurnOpportunityDistance = null;
    },

    // The single predicate behind both the 【調べる】 label and talk()'s branch, so the button
    // text can never promise something the click does not do. Note this requires the recorded
    // site to still be present - matching the distance alone is not enough, which is what makes
    // a later return to the same burn site stay unusable.
    canBurnKeyAmberHere: function () {
        const site = RPG.State.amberRootKeyBurnOpportunityDistance;
        return (
            RPG.State.mode === "base" &&
            RPG.State.isInDungeon === true &&
            RPG.State.explorationArea === "forest" &&
            RPG.State.location !== "かつての街道" &&
            (site === 6 || site === 7 || site === 8) &&
            RPG.State.currentDistance === site &&
            this.getAmberRootState(site) === "defeated" &&
            (RPG.State.inventory.keyAmber || 0) > 0
        );
    },

    burnKeyAmber: function () {
        uiControl.addSeparator();
        RPG.State.mode = "event";
        // The grant rides on the acquisition marker so the swap, and the closing of the burn
        // chance, happen together in one action - an interrupted scene leaves nothing changed
        // and simply replays. Re-entry is already impossible while mode is "event".
        RPG.State.dialogueQueue = RPG.Assets.GAME_TEXT.events.keyAmberBurn.map(line => {
            if (line === "🗝️古びた鍵を手に入れた！") {
                return {
                    text: line,
                    type: "marker",
                    color: "#ffd166",
                    action: () => {
                        RPG.State.inventory.keyAmber = Math.max(0, (RPG.State.inventory.keyAmber || 0) - 1);
                        RPG.State.inventory.oldKey = (RPG.State.inventory.oldKey || 0) + 1;
                        this.clearAmberRootKeyBurnOpportunity();
                        uiControl.updateUI();
                    }
                };
            }
            if (line.startsWith("オーエン「")) {
                return { text: line, color: "#a020f0" };
            }
            return { text: line };
        });
        this.playDialogueLoop();
    },

    getForestHutState: function () {
        return RPG.State.forestHutState || "locked";
    },

    enterForestHutFront: function () {
        RPG.State.location = "森小屋前";
        uiControl.updateUI();
    },

    showForestHutKeyChoices: function () {
        const container = document.getElementById('action-buttons');
        if (!container) return;

        RPG.State.mode = 'choice';
        container.innerHTML = '';
        container.style.display = 'flex';
        const addChoice = (text, action) => {
            const button = document.createElement('button');
            button.className = 'btn btn-full';
            button.textContent = text;
            button.onclick = action;
            container.appendChild(button);
        };

        addChoice('【開ける】', () => {
            container.style.display = 'none';
            RPG.State.inventory.oldKey = Math.max(0, (RPG.State.inventory.oldKey || 0) - 1);
            RPG.State.forestHutState = 'unlocked';
            this.playForestHutUnlockScene();
        });
        addChoice('【…嫌な予感がする】', () => {
            container.style.display = 'none';
            RPG.State.mode = 'event';
            RPG.State.dialogueQueue = [{ text: 'カイン（…今はやめておこう）' }];
            this.playDialogueLoop();
        });

        // Use the shared choice-mode lock: only these two buttons remain visible and enabled.
        uiControl.updateUI();
    },

    playForestHutUnlockScene: function () {
        let blackout = null;
        const snakeEventLines = RPG.Assets.GAME_TEXT.events.forestHutSnakeEvent || [];

        uiControl.addSeparator();
        RPG.State.mode = 'event';
        RPG.State.dialogueQueue = [
            { text: 'オーエン「本当に開けるの？何が起きても知らないよ」', color: '#a020f0' },
            { text: 'カイン「無意味に脅かすなよ」' },
            { text: 'カインは扉を開けた！' },
            {
                text: null,
                action: () => {
                    blackout = uiControl.fadeFullScreen('#000000', 250);
                }
            },
            { text: null, delay: 250 },
            {
                text: null,
                action: () => {
                    RPG.State.location = '森小屋内部';
                    uiControl.updateUI();
                    if (blackout) {
                        blackout.style.transition = 'opacity 250ms ease-out';
                        blackout.style.opacity = '0';
                        setTimeout(() => blackout.remove(), 250);
                    }
                }
            },
            { text: null, delay: 300 },
            { text: null, action: () => uiControl.screenShake() },
            ...snakeEventLines.map(line => (
                line.startsWith('オーエン「')
                    ? { text: line, color: '#a020f0' }
                    : { text: line }
            )),
            {
                text: null,
                action: () => {
                    RPG.State.forestHutState = 'eventPlayed';
                    uiControl.updateUI();
                }
            }
        ];
        this.playDialogueLoop();
    },

    // Returns true if the forest-hut examine was handled (a branch fired), false if the hut
    // has nothing new to show (gloveGranted) so the caller should fall through to the generic
    // dungeon-examine fallback text.
    inspectForestHut: function () {
        let hutState = this.getForestHutState();

        if (hutState === "locked") {
            if ((RPG.State.inventory.oldKey || 0) > 0) {
                uiControl.addLog('カイン（🗝️古びた鍵を使ってみるか？）');
                this.showForestHutKeyChoices();
                return true;
            } else if ((RPG.State.inventory.keyAmber || 0) > 0) {
                RPG.State.mode = 'event';
                RPG.State.dialogueQueue = [
                    { text: 'カイン（この鍵入り琥珀で開かないかな）' },
                    { text: 'カインは琥珀を鍵穴に押し当ててみた。' },
                    { text: 'オーエン「…何してるの？」', color: '#a020f0' },
                    { text: 'カイン「さすがに無理か」' }
                ];
                this.playDialogueLoop();
                return true;
            } else {
                uiControl.addSeparator();
                RPG.State.mode = "event";
                RPG.State.dialogueQueue = this.buildDialogueQueue(
                    RPG.Assets.GAME_TEXT.events.forestHutLocked
                );
                this.playDialogueLoop();
                return true;
            }
        }

        if (hutState === "unlocked") {
            uiControl.addSeparator();
            RPG.State.mode = "event";
            // This remains as the safe continuation for an existing unlocked state. New unlocks
            // enter through playForestHutUnlockScene() so the backdrop transition happens first.
            const snakeEventLines = RPG.Assets.GAME_TEXT.events.forestHutSnakeEvent || [];
            RPG.State.dialogueQueue = snakeEventLines.map(line => (
                line.startsWith("オーエン「")
                    ? { text: line, color: "#a020f0" }
                    : { text: line }
            ));
            RPG.State.dialogueQueue.push({
                text: null,
                action: () => {
                    RPG.State.forestHutState = "eventPlayed";
                    uiControl.updateUI();
                }
            });
            this.playDialogueLoop();
            return true;
        }

        if (hutState === "eventPlayed") {
            uiControl.addSeparator();
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                { text: '部屋の隅に、何か落ちている。' },
                { text: 'カインはそれを拾い上げた。' },
                {
                    text: "《🥊耐火グローブを手に入れた！》",
                    type: "marker",
                    color: "#ffd166",
                    action: () => {
                        RPG.State.inventory.fireproofGloves = (RPG.State.inventory.fireproofGloves || 0) + 1;
                        RPG.State.forestHutState = "gloveGranted";
                        uiControl.updateUI();
                    }
                },
                { text: 'カイン「………」' },
                { text: 'カインは無言でそれを手に嵌めた。' }
            ];
            this.playDialogueLoop();
            return true;
        }

        return false;
    },

    // Post-giant_larva 10m corpse examination, staged 0 -> 1 -> 2 -> 3 via larvaCorpseStage.
    // Stage 3 is terminal; the talk() caller then resumes the normal forest-hut guidance.
    inspectGiantLarvaCorpse: function () {
        const stage = RPG.State.larvaCorpseStage || 0;

        if (stage === 0) {
            uiControl.addSeparator();
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                { text: "大幼蟲が飲み込んだらしい物が、泥と体液にまみれて散らばっている。" },
                { text: "カイン「荷馬車の残骸、骨……さっきこの辺で何か光ったような」" },
                { text: "カインは落ちていた枝で、泥の中をかき分けた。" },
                { text: "錆びた金具。砕けた骨。潰れて形の分からなくなった硬貨。" },
                { text: "その下で、泥にまみれた銀貨が一枚光っていた。" },
                { text: "カイン「……あった」" },
                {
                    text: "《🪙銀貨を手に入れた！》",
                    type: "marker",
                    color: "#ffd166",
                    action: () => {
                        RPG.State.inventory.silverCoin = (RPG.State.inventory.silverCoin || 0) + 1;
                        RPG.State.silverCoins = (RPG.State.silverCoins || 0) + 1;
                        RPG.State.larvaCorpseStage = 1;
                        uiControl.updateUI();
                    }
                },
                { text: "《銀貨が三枚そろった！》", type: "marker", color: "#ffd166" },
                { text: "オーエン「もらっとけば？　……たった銀貨一枚なんて、英雄の命も随分値切られたね、騎士様」", color: "#a020f0" }
            ];
            this.playDialogueLoop();
            return;
        }

        if (stage === 1) {
            uiControl.addSeparator();
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                { text: "カイン（他に何かないかな）" },
                { text: "オーエン「……痛くないの？それ」", color: "#a020f0" },
                {
                    text: "オーエンは肩口の傷を掴んだ！",
                    action: () => {
                        uiControl.flashFullScreen("#800080", 800);
                        uiControl.screenShake();
                    }
                },
                { text: "カイン「ぐあ…ｯ！？」" },
                {
                    text: "オーエン「あはは、変な声出た」",
                    color: "#a020f0",
                    action: () => {
                        RPG.State.larvaCorpseStage = 2;
                        uiControl.updateUI();
                    }
                }
            ];
            this.playDialogueLoop();
            return;
        }

        if (stage === 2) {
            uiControl.addSeparator();
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                { text: "カイン「ん…これは？」" },
                {
                    text: "🔸？琥珀を手に入れた！",
                    type: "marker",
                    color: "#ffd166",
                    action: () => {
                        RPG.State.inventory.unknownAmber = (RPG.State.inventory.unknownAmber || 0) + 1;
                        RPG.State.unappraisedAmberResults = Array.isArray(RPG.State.unappraisedAmberResults)
                            ? RPG.State.unappraisedAmberResults
                            : [];
                        RPG.State.unappraisedAmberResults.push("monsterAmber");
                        RPG.State.larvaCorpseStage = 3;
                        uiControl.updateUI();
                    }
                },
                { text: "カイン（もう何もないな。宿屋に戻ろう）" }
            ];
            this.playDialogueLoop();
        }
    },

    inspectAmberRoot: function (distance) {
        const state = this.getAmberRootState(distance);

        if (state === "ignited") {
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                { text: "【琥珀樹の根】", type: "marker", color: "#f1e6c8" },
                { text: "焦げた根が、地面から隆起している。" },
                {
                    text: null,
                    action: () => {
                        this.showIgnitedAmberRootChoices(distance);
                    }
                }
            ];
            this.playDialogueLoop();
            return;
        }

        if (state === "scarred") {
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                { text: "【琥珀樹の根】", type: "marker", color: "#f1e6c8" },
                { text: "樹皮の割れ目から、琥珀化した根が覗いている。" },
                {
                    text: null,
                    action: () => {
                        this.showScarredAmberRootChoices(distance);
                    }
                }
            ];
            this.playDialogueLoop();
            return;
        }

        RPG.State.mode = "event";
        if (state === "examined") {
            RPG.State.dialogueQueue = [
                { text: "【琥珀樹の根】", type: "marker", color: "#f1e6c8" },
                { text: "根は硬い樹皮に覆われたままだ。" },
                {
                    text: null,
                    action: () => {
                        this.showAmberRootChoices(distance);
                    }
                }
            ];
        } else {
            if (!RPG.State.amberRootState) RPG.State.amberRootState = {};
            RPG.State.amberRootState[distance] = "examined";
            RPG.State.dialogueQueue = [
                { text: "【琥珀樹の根】", type: "marker", color: "#f1e6c8" },
                { text: "足元にはグロテスクに隆起した根がある。" },
                { text: "カイン「この根…もしかして琥珀樹の根か？」" },
                { text: "オーエン「さあね」", color: "#a020f0" },
                {
                    text: null,
                    action: () => {
                        this.showAmberRootChoices(distance);
                    }
                }
            ];
        }
        this.playDialogueLoop();
    },

    closeAmberRootChoices: function () {
        const container = document.getElementById('action-buttons');
        if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
        }
    },

    showAmberRootChoices: function (distance) {
        const container = document.getElementById('action-buttons');
        if (!container) return;

        const exploreUI = document.getElementById('exploreUI');
        const innUI = document.getElementById('innUI');
        const choiceUI = document.getElementById('choiceUI');
        if (exploreUI) exploreUI.style.display = 'none';
        if (innUI) innUI.style.display = 'none';
        if (choiceUI) choiceUI.style.display = 'none';

        container.innerHTML = '';
        container.style.display = 'flex';

        const btnFire = document.createElement('button');
        btnFire.id = 'btnAmberRootFire';
        btnFire.className = 'btn btn-full';
        btnFire.textContent = '【火をつける】';
        btnFire.onclick = () => {
            this.closeAmberRootChoices();
            this.tryAmberRootFire(distance);
        };
        container.appendChild(btnFire);

        const btnKnife = document.createElement('button');
        btnKnife.id = 'btnAmberRootKnife';
        btnKnife.className = 'btn btn-full';
        btnKnife.textContent = '【ナイフで傷をつける】';
        btnKnife.onclick = () => {
            this.closeAmberRootChoices();
            this.tryAmberRootKnife(distance);
        };
        container.appendChild(btnKnife);

        if ((RPG.State.inventory.shinyOil || 0) > 0) {
            const btnOil = document.createElement('button');
            btnOil.id = 'btnAmberRootOil';
            btnOil.className = 'btn btn-full';
            btnOil.textContent = '【ピカピカ油を使う】';
            btnOil.onclick = () => {
                this.closeAmberRootChoices();
                this.useShinyOilOnAmberRoot(distance);
            };
            container.appendChild(btnOil);
        }

        const btnCancel = document.createElement('button');
        btnCancel.id = 'btnAmberRootCancel';
        btnCancel.className = 'btn btn-full';
        btnCancel.textContent = '【やめる】';
        btnCancel.onclick = () => {
            this.closeAmberRootChoices();
            RPG.State.mode = "base";
            uiControl.updateUI();
        };
        container.appendChild(btnCancel);

        RPG.State.mode = "choice";
    },

    tryAmberRootFire: function () {
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            { text: "カインは火打ち石で火種を作り、根の表面へ近づけた。" },
            { text: "樹皮の表面が黒く焦げたが、火はすぐに消えた。" },
            { text: "カイン「…火がつかない」" },
            { text: "（表面に傷をつけたら燃えるだろうか）" },
            {
                text: null,
                action: () => {
                    RPG.State.mode = "base";
                    uiControl.updateUI();
                }
            }
        ];
        this.playDialogueLoop();
    },

    tryAmberRootKnife: function () {
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            { text: "カインはナイフで表面を傷つけようとした。" },
            { text: "カイン「…！硬いな！？傷ひとつつかない」" },
            {
                text: null,
                action: () => {
                    RPG.State.mode = "base";
                    uiControl.updateUI();
                }
            }
        ];
        this.playDialogueLoop();
    },

    useShinyOilOnAmberRoot: function (distance) {
        if ((RPG.State.inventory.shinyOil || 0) <= 0) return;
        if (this.getAmberRootState(distance) !== "examined") return;

        RPG.State.inventory.shinyOil -= 1;
        if (!RPG.State.amberRootState) RPG.State.amberRootState = {};
        RPG.State.amberRootState[distance] = "scarred";

        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            { text: "カインはピカピカ油をナイフに塗った。" },
            { text: "もう一度、根へ刃を押し当てる。" },
            { text: "今度は硬い樹皮に深い傷が入った。" },
            { text: "割れ目の奥に、琥珀色のものが見える。" },
            { text: "カイン「中が琥珀になってるのか……」" },
            {
                text: null,
                action: () => {
                    RPG.State.mode = "base";
                    uiControl.updateUI();
                }
            }
        ];
        this.playDialogueLoop();
    },

    showScarredAmberRootChoices: function (distance) {
        const container = document.getElementById('action-buttons');
        if (!container) return;

        const exploreUI = document.getElementById('exploreUI');
        const innUI = document.getElementById('innUI');
        const choiceUI = document.getElementById('choiceUI');
        if (exploreUI) exploreUI.style.display = 'none';
        if (innUI) innUI.style.display = 'none';
        if (choiceUI) choiceUI.style.display = 'none';

        container.innerHTML = '';
        container.style.display = 'flex';

        const btnFire = document.createElement('button');
        btnFire.id = 'btnAmberRootFire';
        btnFire.className = 'btn btn-full';
        btnFire.textContent = '【火をつける】';
        btnFire.onclick = () => {
            this.closeAmberRootChoices();
            this.tryScarredAmberRootFire();
        };
        container.appendChild(btnFire);

        if ((RPG.State.inventory.hardOil || 0) > 0) {
            const btnHardOil = document.createElement('button');
            btnHardOil.id = 'btnAmberRootHardOil';
            btnHardOil.className = 'btn btn-full';
            btnHardOil.textContent = '【カチカチ油を使う】';
            btnHardOil.onclick = () => {
                this.closeAmberRootChoices();
                this.useHardOilOnAmberRoot(distance);
            };
            container.appendChild(btnHardOil);
        }

        const btnCancel = document.createElement('button');
        btnCancel.id = 'btnAmberRootCancel';
        btnCancel.className = 'btn btn-full';
        btnCancel.textContent = '【やめる】';
        btnCancel.onclick = () => {
            this.closeAmberRootChoices();
            RPG.State.mode = "base";
            uiControl.updateUI();
        };
        container.appendChild(btnCancel);

        RPG.State.mode = "choice";
    },

    tryScarredAmberRootFire: function () {
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            { text: "傷ついた樹皮に火がついた。" },
            { text: "だが炎はすぐに小さくなって消えた。" },
            {
                text: null,
                action: () => {
                    RPG.State.mode = "base";
                    uiControl.updateUI();
                }
            }
        ];
        this.playDialogueLoop();
    },

    // hardOil is treated as one bottle with enough for all three roots - it is intentionally
    // NOT decremented here (first, second, or third use, including rematches). Whether it gets
    // consumed/removed once all three roots are down is left to the finite-supply follow-up work.
    useHardOilOnAmberRoot: function (distance) {
        if ((RPG.State.inventory.hardOil || 0) <= 0) return;
        if (this.getAmberRootState(distance) !== "scarred") return;

        const isFirstIgnitionEver = !Object.values(RPG.State.amberRootState || {}).some(
            s => s === "ignited" || s === "defeated"
        );

        if (!RPG.State.amberRootState) RPG.State.amberRootState = {};
        RPG.State.amberRootState[distance] = "ignited";

        const lines = [
            { text: "カインは琥珀樹の根へ、カチカチ油をかけた。" },
            { text: "火を近づけると、根は一気に燃え上がった。" },
            {
                text: "地面が揺れた。",
                action: () => {
                    uiControl.screenShake();
                }
            }
        ];
        if (isFirstIgnitionEver) {
            lines.push(
                { text: "カイン「……動くのか！」" },
                { text: "オーエン「やっぱりね」", color: "#a020f0" }
            );
        } else {
            lines.push({ text: "カイン「来るぞ！」" });
        }
        lines.push({
            text: null,
            action: () => {
                this.startAmberBurningRootBattle();
            }
        });

        RPG.State.mode = "event";
        RPG.State.dialogueQueue = lines;
        this.playDialogueLoop();
    },

    showIgnitedAmberRootChoices: function (distance) {
        const container = document.getElementById('action-buttons');
        if (!container) return;

        const exploreUI = document.getElementById('exploreUI');
        const innUI = document.getElementById('innUI');
        const choiceUI = document.getElementById('choiceUI');
        if (exploreUI) exploreUI.style.display = 'none';
        if (innUI) innUI.style.display = 'none';
        if (choiceUI) choiceUI.style.display = 'none';

        container.innerHTML = '';
        container.style.display = 'flex';

        const btnRetry = document.createElement('button');
        btnRetry.id = 'btnAmberRootRetry';
        btnRetry.className = 'btn btn-full';
        btnRetry.textContent = '【再戦する】';
        btnRetry.onclick = () => {
            this.closeAmberRootChoices();
            this.startAmberBurningRootBattle();
        };
        container.appendChild(btnRetry);

        const btnCancel = document.createElement('button');
        btnCancel.id = 'btnAmberRootCancel';
        btnCancel.className = 'btn btn-full';
        btnCancel.textContent = '【やめる】';
        btnCancel.onclick = () => {
            this.closeAmberRootChoices();
            RPG.State.mode = "base";
            uiControl.updateUI();
        };
        container.appendChild(btnCancel);

        RPG.State.mode = "choice";
    },

    startAmberBurningRootBattle: function () {
        battleSystem.startBattle('amber_burning_root');
    },

    talk: function () {
        if (RPG.State.mode !== "base") return;

        if (!RPG.State.isInDungeon) {
            // Build 15.5.5: Inn-front outer-wall hole inspection, once the inn-repair
            // damage inspection stage is unlocked.
            if (
                RPG.State.flags.innRepairInspectionUnlocked === true &&
                RPG.State.flags.innRepairHoleInspected !== true
            ) {
                uiControl.addSeparator();
                RPG.State.mode = "event";
                RPG.State.dialogueQueue = RPG.Assets.GAME_TEXT.events.innRepairHoleInspect.map(text => ({ text }));
                RPG.State.dialogueQueue.push({
                    text: null,
                    action: () => {
                        RPG.State.flags.innRepairHoleInspected = true;
                        uiControl.updateUI();
                    }
                });
                this.playDialogueLoop();
                return;
            }

            // Inn repair thread, back half: resume (state 3, oils in hand) takes priority over
            // the awaiting-oils reminder (state 2), which takes priority over the intro (state 1).
            if (typeof innSystem !== "undefined" && innSystem.canResumeInnRepairHelp()) {
                uiControl.addSeparator();
                RPG.State.mode = "event";
                RPG.State.dialogueQueue = RPG.Assets.GAME_TEXT.events.innRepairFinish.map(text => ({ text }));
                RPG.State.dialogueQueue.push({
                    text: RPG.Assets.GAME_TEXT.events.innRepairAmberReward[0]
                });
                RPG.State.dialogueQueue.push({
                    text: RPG.Assets.GAME_TEXT.events.innRepairAmberReward[1],
                    type: "marker",
                    color: "#ffd166",
                    action: () => {
                        if (RPG.State.flags.innRepairAmberRewardReceived !== true) {
                            innSystem.ensureAmberState();
                            RPG.State.inventory.unknownAmber = (RPG.State.inventory.unknownAmber || 0) + 1;
                            RPG.State.unappraisedAmberResults.push("milkAmber");
                            RPG.State.flags.innRepairAmberRewardReceived = true;
                        }
                        RPG.State.inventory.glossyOil = Math.max(0, (RPG.State.inventory.glossyOil || 0) - 1);
                        RPG.State.flags.innRepairCompleted = true;
                        uiControl.updateUI();
                    }
                });
                this.playDialogueLoop();
                return;
            }

            if (typeof innSystem !== "undefined" && innSystem.isAwaitingInnRepairOils()) {
                uiControl.addLog("カイン（先に、娘さんからテカテカ油をもらってこよう）");
                return;
            }

            if (typeof innSystem !== "undefined" && innSystem.canStartInnRepairHelp()) {
                uiControl.addSeparator();
                RPG.State.mode = "event";
                RPG.State.dialogueQueue = RPG.Assets.GAME_TEXT.events.innRepairHelpStart.map(text => ({ text }));
                RPG.State.dialogueQueue.push({
                    text: null,
                    action: () => {
                        RPG.State.flags.innRepairHelpStarted = true;
                        uiControl.updateUI();
                    }
                });
                this.playDialogueLoop();
                return;
            }

            uiControl.addLog(RPG.Assets.GAME_TEXT.exploration.talkAtInn);
            return;
        }

        if (this.isInHerbGarden()) {
            this.inspectHerbGarden();
            return;
        }

        const dist = RPG.State.currentDistance;
        const flags = RPG.State.flags;

        if (
            RPG.State.location === "かつての街道" &&
            dist === 8 &&
            flags.highway8mMasochistAmberAvailable === true &&
            flags.highway8mMasochistAmberTaken !== true
        ) {
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [{
                text: "🔸被虐の琥珀を手に入れた！",
                type: "marker",
                color: "#ffd166",
                action: () => {
                    RPG.State.inventory.masochistAmber = (RPG.State.inventory.masochistAmber || 0) + 1;
                    flags.highway8mMasochistAmberTaken = true;
                    uiControl.updateUI();
                }
            }];
            this.playDialogueLoop();
            return;
        }

        // Build 15.5.5: Forest-entrance rat-droppings inspection takes priority over the
        // amber merchant, but only once and only while unlocked and not yet inspected.
        if (
            dist === 0 &&
            RPG.State.explorationArea === "forest" &&
            flags.innRepairInspectionUnlocked === true &&
            flags.innRepairDroppingsInspected !== true
        ) {
            uiControl.addSeparator();
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = RPG.Assets.GAME_TEXT.events.innRepairDroppingsInspect.map(text => ({ text }));
            RPG.State.dialogueQueue.push({
                text: null,
                action: () => {
                    flags.innRepairDroppingsInspected = true;
                    uiControl.updateUI();
                }
            });
            this.playDialogueLoop();
            return;
        }

        if (
            dist === 0 &&
            flags.amberMerchantMovedToForest === true &&
            typeof innSystem !== "undefined"
        ) {
            innSystem.interactWithAmberMerchant();
            return;
        }

        // Ahead of the 8m coin/timber quests so that when the burn site happens to be 8m, the
        // command shown by uiControl (which checks this same predicate first) is the one that
        // actually runs. No confirmation prompt - stepping away is how the player declines.
        if (this.canBurnKeyAmberHere()) {
            this.burnKeyAmber();
            return;
        }

        if (dist === 8 && flags.treeDefeated === true && flags.amberTreeCoinMined !== true) {
            const hasMiningKnife =
                (RPG.State.inventory.borrowedMiningKnife || 0) > 0 ||
                (RPG.State.inventory.miningKnife || 0) > 0;

            if (!hasMiningKnife) {
                uiControl.addLog("カイン（宿屋で道具を借りれないか聞いてみよう）");
                uiControl.updateUI();
                return;
            }

            RPG.State.mode = "event";
            RPG.State.dialogueQueue = [
                { text: "【埋まった銀貨を掘る】8m", type: "marker", color: "#f1e6c8" },
                { text: "カイン「悪いな、ちょっと貸してくれ」" },
                { text: "黒ずんだ遺体にこびりついた樹液の塊から、ナイフで銀貨を抉り出した。" },
                { text: "オーエン「僕には、貸してくれって言わなかったよね」", color: "#a020f0" },
                { text: "オーエンは返答を期待するようにカインを見ている。" },
                { text: "ナイフを傷つけないように丁寧に、銀貨の周りの琥珀化した樹液を削っていく。" },
                { text: "カリカリカリ……" },
                { text: "カイン「……返すつもりがなかったから、言わなかった。最初から、奪うつもりで抉った」" },
                { text: "オーエン「……へえ？」", color: "#a020f0" },
                { text: "カリカリ……" },
                { text: "オーエンは木にもたれて腕を組んでいる。" },
                { text: "カイン「……よし、掘れた」" },
                {
                    text: "🪙銀貨を手に入れた！",
                    type: "marker",
                    color: "#ffd166",
                    action: () => {
                        RPG.State.silverCoins = (RPG.State.silverCoins || 0) + 1;
                        RPG.State.inventory.silverCoin = (RPG.State.inventory.silverCoin || 0) + 1;
                    }
                },
                { text: "カイン（周りの琥珀も採れたな）" },
                {
                    text: "🔸？琥珀を手に入れた！",
                    type: "marker",
                    color: "#ffd166",
                    action: () => {
                        RPG.State.inventory.unknownAmber = (RPG.State.inventory.unknownAmber || 0) + 1;
                        flags.amberTreeCoinMined = true;
                        RPG.State.postTreeBattles = 0;
                        if (typeof innSystem !== "undefined") {
                            innSystem.tryUnlockInnRepairInspection();
                        }
                        uiControl.updateUI();
                    }
                },
                { text: "カイン（銀貨はあと一枚か……）" },
                { text: "オーエン「それで？」", color: "#a020f0" },
                { text: "カイン「なんだ？」" },
                { text: "オーエン「もっとその話をしようよ。僕の目玉を抉って、どうしたかったんだっけ？」", color: "#a020f0" },
                { text: "カイン（……琥珀商に、ナイフを返さないとな）" }
            ];
            this.playDialogueLoop();
            return;
        }

        // Build 15.5.6: Inn-repair timber retrieval from the fallen amber tree at 8m,
        // once the damage-inspection report has unlocked the search. The highway route
        // also reaches currentDistance === 8 (see highway_8m_escalation) without resetting
        // explorationArea, so exclude it the same way getForestObservation() does.
        if (
            dist === 8 &&
            RPG.State.location !== "かつての街道" &&
            flags.treeDefeated === true &&
            flags.innRepairInspectionReported === true &&
            flags.innRepairTimberSearchUnlocked === true &&
            flags.innRepairTimberObtained !== true
        ) {
            const timberLines = RPG.Assets.GAME_TEXT.events.innRepairTimberObtain || [];
            RPG.State.mode = "event";
            RPG.State.dialogueQueue = timberLines.map(line => {
                if (line === "《🪵琥珀樹の木材》を手に入れた！") {
                    return {
                        text: line,
                        type: "marker",
                        color: "#ffd166",
                        action: () => {
                            RPG.State.inventory.amberTreeTimber = (RPG.State.inventory.amberTreeTimber || 0) + 1;
                            flags.innRepairTimberObtained = true;
                            uiControl.updateUI();
                        }
                    };
                }
                if (line.startsWith("オーエン")) {
                    return { text: line, color: "#a020f0" };
                }
                return { text: line };
            });
            this.playDialogueLoop();
            return;
        }

        // Build: Amber root discovery. Unlocked once sap_source_awareness has played (Cain
        // suspects another source), independent of the thief-boy encounter alone. Placed after
        // the 8m coin/timber quest events above so those keep priority while still pending, but
        // before the generic ambient observation fallback so the root becomes explicitly
        // selectable at 6m/7m/8m once unlocked.
        if (
            (dist === 6 || dist === 7 || dist === 8) &&
            RPG.State.location !== "かつての街道" &&
            flags.sapSourceAwarenessSeen === true &&
            this.getAmberRootState(dist) !== "defeated"
        ) {
            this.inspectAmberRoot(dist);
            return;
        }

        if (
            dist === 10 &&
            RPG.State.location !== "かつての街道" &&
            flags.giantLarvaDefeated === true &&
            (RPG.State.larvaCorpseStage || 0) < 3
        ) {
            this.inspectGiantLarvaCorpse();
            return;
        }

        if (dist === 10 && RPG.State.location !== "かつての街道") {
            if (RPG.State.location === "森小屋前" || RPG.State.location === "森小屋内部") {
                const hutHandled = this.inspectForestHut();
                if (hutHandled) return;
            } else if (RPG.State.forestHutDiscovered === true) {
                this.enterForestHutFront();
                return;
            } else {
                RPG.State.forestHutDiscovered = true;
                RPG.State.mode = 'event';
                RPG.State.dialogueQueue = this.buildDialogueQueue(RPG.Assets.GAME_TEXT.events.forestHutLocked);
                this.playDialogueLoop();
                return;
            }
        }

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

    buildSomeonesDiaryFirstReadQueue: function () {
        return [
            { text: "新しい日記帳だが、1ページしか書いてない。" },
            { text: "ボスはかっこいい。はやくボスにほめられたい。", type: "marker", color: "#f1e6c8" },
            { text: "ボスはフライドチキンが好き。けどフライドチキンを盗んできてもな。", type: "marker", color: "#f1e6c8" },
            { text: "カイン「なんだこれ」" },
            { text: "オーエン「フライドチキンが好きなボスがいるんじゃない？」", color: "#a020f0" },
            { text: "カイン「…それはわかるが」" },
            {
                text: "カイン（それしかわからない）",
                action: () => {
                    RPG.State.flags.someonesDiaryFirstReadDone = true;
                    uiControl.updateUI();
                }
            }
        ];
    },

    buildSomeonesDiaryRepeatReadQueue: function () {
        return [
            { text: "新しい日記帳だが、1ページしか書いてない。" },
            { text: "ボスはかっこいい。はやくボスにほめられたい。", type: "marker", color: "#f1e6c8" },
            { text: "ボスはフライドチキンが好き。けどフライドチキンを盗んできてもな。", type: "marker", color: "#f1e6c8" }
        ];
    },

    // Build 15.6.2: One-time hard-bottle opening. The bottle itself is lost here and
    // replaced by a full set of 上薬草のジャム uses.
    buildHardBottleOpeningQueue: function () {
        return [
            { text: "カインは渾身の力で瓶の蓋を捻った。" },
            { text: "カイン「ふんっっっっ！！！」" },
            { text: "バキッ", type: "marker" },
            { text: "ついに蓋が開いた。" },
            { text: "中に詰まっている黒っぽいドロドロはなんだろう。" },
            { text: "オーエン「くんくん……僕はいらない」", color: "#a020f0" },
            { text: "カイン「あ、この匂いもしかして」" },
            {
                text: `${RPG.Assets.CONFIG.ITEM_NAME.highHerbJam}を手に入れた！`,
                type: "marker",
                color: "#9acd32",
                action: () => {
                    RPG.State.flags.hardBottleOpened = true;
                    RPG.State.inventory.hardBottle = Math.max(0, (RPG.State.inventory.hardBottle || 0) - 1);
                    RPG.State.inventory.highHerbJam =
                        (RPG.State.inventory.highHerbJam || 0) + RPG.Config.HIGH_HERB_JAM_MAX_USES;
                    uiControl.updateUI();
                }
            }
        ];
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

        if (itemId === 'matamatabiBranch') {
            return this.buildMatamatabiManualUseQueue();
        }

        if (itemId === 'hardBottle') {
            return this.buildHardBottleOpeningQueue();
        }

        if (["lightBook", "purpleMacaron", "glowingBunnyEars"].includes(itemId)) {
            return this.buildGlowingCatRabbitRewardUseQueue(itemId);
        }

        if (itemId === 'someonesDiary') {
            return RPG.State.flags.someonesDiaryFirstReadDone === true
                ? this.buildSomeonesDiaryRepeatReadQueue()
                : this.buildSomeonesDiaryFirstReadQueue();
        }

        if (itemId === 'keyAmber') {
            const useCount = Math.max(0, Number(RPG.State.keyAmberUseCount) || 0);
            if (useCount === 1) {
                return [
                    { text: 'カイン「ひらけごまー！」' },
                    { text: 'オーエン「……」', color: '#a020f0' },
                    { text: '特に何も起きなかった！' },
                    { text: 'カイン（特別な力はないみたいだ）' }
                ];
            }
            if (useCount === 2) {
                return [
                    { text: 'オーエン「もうやらないの？」', color: '#a020f0' },
                    { text: 'カイン「もうやらない」' }
                ];
            }
            return [{ text: 'カイン（もうやらないってば）' }];
        }

        return null;
    },

    useItem: function (itemId) {
        if (!RPG.State.inventory[itemId] || RPG.State.inventory[itemId] <= 0) return;

        let success = false;
        let consumeItem = true;
        switch (itemId) {
            case 'fakeWoundMedicine':
                if (!this.canUseFakeWoundMedicine()) {
                    uiControl.addLog(RPG.Assets.GAME_TEXT.items.cannotUse);
                    uiControl.closeModal();
                    return;
                }
                if (RPG.State.flags.fakeWoundMedicinePrepared === true) {
                    uiControl.addLog("🩹傷薬もどきは、もう準備してある。");
                    uiControl.closeModal();
                    return;
                }
                RPG.State.flags.fakeWoundMedicinePrepared = true;
                uiControl.addLog("🩹傷薬もどきを準備した。");
                success = true;
                break;
            case 'shinyOil':
                if (!this.canUseShinyOil()) {
                    uiControl.addLog(RPG.Assets.GAME_TEXT.items.cannotUse);
                    uiControl.closeModal();
                    return;
                }
                if (RPG.State.flags.shinyOilPrepared === true) {
                    uiControl.addLog("✨ピカピカ油は、もう準備してある。", "", "#ffd166");
                    uiControl.closeModal();
                    return;
                }
                RPG.State.flags.shinyOilPrepared = true;
                uiControl.addLog("✨ピカピカ油を準備した。次の戦闘で刃がきらめく。", "", "#ffd166");
                success = true;
                break;
            case 'smokeBomb':
                if (!this.canUseSmokeBomb()) {
                    uiControl.addLog(
                        this.getTemporaryEffectSteps("smokeBombStepsRemaining") > 0
                            ? RPG.Assets.GAME_TEXT.items.notNeeded
                            : RPG.Assets.GAME_TEXT.items.cannotUse
                    );
                    uiControl.closeModal();
                    return;
                }
                RPG.State.smokeBombStepsRemaining = RPG.Config.SMOKE_BOMB_STEP_COUNT;
                uiControl.addLog("💨煙玉を使った！");
                uiControl.addLog("煙がカインの気配を覆った。");
                success = true;
                break;
            case 'herb':
                if (RPG.State.currentHP >= RPG.State.maxHP) {
                    uiControl.addLog(RPG.Assets.GAME_TEXT.items.notNeeded);
                    uiControl.closeModal();
                    return;
                }
                const herbAmberHealMultiplier = RPG.State.equippedRareAmberId === "herbAmber"
                    ? RPG.Config.RARE_AMBER_TUNING.HERB_AMBER_ITEM_HEAL_MULTIPLIER
                    : 1;
                const healAmount = Math.floor(RPG.State.maxHP * 0.3 * herbAmberHealMultiplier);
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
                const highHerbAmberHealMultiplier = RPG.State.equippedRareAmberId === "herbAmber"
                    ? RPG.Config.RARE_AMBER_TUNING.HERB_AMBER_ITEM_HEAL_MULTIPLIER
                    : 1;
                const highHerbHealAmount = Math.floor(RPG.State.maxHP * 0.6 * highHerbAmberHealMultiplier);
                RPG.State.currentHP = Math.min(RPG.State.maxHP, RPG.State.currentHP + highHerbHealAmount);
                uiControl.addLog(`🌿上薬草を使い、HPが${highHerbHealAmount}回復した。`);
                success = true;
                break;
            case 'highHerbJam':
                if (RPG.State.flags.highHerbJamPrepared === true) {
                    uiControl.addLog("🫙🌿上薬草のジャムは、もう準備してある。");
                    uiControl.closeModal();
                    return;
                }
                RPG.State.flags.highHerbJamPrepared = true;
                uiControl.addLog("🫙🌿上薬草のジャムを口にした。", "", "#9acd32");
                uiControl.addLog("薬草の力が体に残った。体力が半分以下になれば効いてくるだろう。");
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
            case 'debug_lvl10':
                RPG.State.cainLv = 10;
                RPG.State.maxHP = 100 + 180;
                RPG.State.attack = 10 + 45;
                RPG.State.currentHP = RPG.State.maxHP;
                uiControl.addLog("💊《レベルアップ薬》を煽った！力がみなぎる……（Lv.10になった）");
                success = true;
                break;
            case 'matamatabiBranch':
                if (RPG.State.equippedRareAmberId === 'vampireAmber') {
                    uiControl.addLog("カイン（先に吸血琥珀を外そう）");
                    uiControl.closeModal();
                    return;
                }
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
            case 'hardBottle':
                if (!this.canOpenHardBottle()) {
                    uiControl.addLog("カイン（ビクともしない……もっと力をつけてからだな）");
                    uiControl.closeModal();
                    return;
                }
                if (RPG.State.flags.hardBottleOpened === true) {
                    uiControl.addLog("カイン（もう開けてあるんだったな）");
                    uiControl.closeModal();
                    return;
                }
                // The bottle is lost and the jam is granted inside the opening dialogue,
                // so the "手に入れた！" line lands in scene order.
                success = true;
                consumeItem = false;
                break;
            case 'someonesDiary':
                if (RPG.State.flags.someonesDiaryReadUnlocked !== true) {
                    uiControl.addLog("カイン（今は読む気力がない）");
                    uiControl.closeModal();
                    return;
                }
                success = true;
                consumeItem = false;
                break;
            case 'keyAmber':
                RPG.State.keyAmberUseCount = (RPG.State.keyAmberUseCount || 0) + 1;
                success = true;
                consumeItem = false;
                break;
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
        this.clearTemporaryItemEffects();
        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            { text: "―― かつての街道 ――", delay: 1500, color: "#FFD700" },
            { text: "荷馬車は森を抜け、古い石畳の街道へと出た。", delay: 1800 },
            {
                text: null,
                delay: 0,
                action: () => {
                    if (
                        !RPG.State.completedEvents.includes("phase8_wagon_journey_completed")
                    ) {
                        RPG.State.completedEvents.push("phase8_wagon_journey_completed");
                    }
                    RPG.State.storyPhase = 9;
                    RPG.State.flags.onWagon = true;
                    RPG.State.isAtInn = false;
                    RPG.State.isInDungeon = true;
                    RPG.State.explorationArea = "highway";
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

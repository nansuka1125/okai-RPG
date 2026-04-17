// 🚩ーー【State Management: Build 14.0 - Modular Architecture】ーー



// RPGオブジェクトの初期化（もし未定義なら）
window.RPG = window.RPG || {};

// Build 14.1: Game Configurations
RPG.Config = {
    MAX_DISTANCE: 10,    // 琥珀の森の最深部
    MIN_DISTANCE: 0,     // 宿屋前
    BATTLE_RATE: 0.3,    // エンカウント率（30%）
    HEAL_ON_LEVEL_UP: false, // Build 15.2.47: Toggle full HP recovery on level up
    LEVEL_UP_TALK_BATTLE_ONLY: true // Build 15.2.49: Reserve milestone level-up talks for battle victories only
};

// この下に既存の RPG.State = { ... } が続くようにする

RPG.State = {
    // Build version tracking
    version: "15.2.63 (Matamatabi Rumor Hook)", // Build 15.2.63: Add the matamatabi rumor and 4m pickup route for phase 4
    mode: "base", // base, event, battle
    location: "宿屋《琥珀亭》",
    mood: 50,              // 気分値（デバッグ用表示あり）
    isPoisoned: false,     // 毒状態
    isInDungeon: false,    // 拠点(false)とダンジョン(true)の切り替え
    completedEvents: [],   // 発生済みイベントIDを記録
    dialogueQueue: [],     // 会話イベントのキュー
    isWaitingForInput: false, // Tap-to-advance dialogue state
    dialogueIndex: 0,      // Current position in dialogue queue
    storyPhase: 0,         // Build 14.2.0: Story progression tracking (0-9+)
    highwayBattleCount: {}, // Build 14.2.2: Track fixed encounters on highway
    herbUseCount: 0,       // Build 15.2.25: Track herb use dialogue milestones
    observeIndex: 0,       // Build 15.2.29: Next phase candidate for inn observe dialogue
    observePhaseReached: {}, // Build 15.2.29: Track highest inn observe entry read per phase
    talkIndex: 0,          // Build 15.2.30: Next shared loop line for inn talk
    talkPhaseReached: {},  // Build 15.2.30: Track highest inn talk entry read per phase
    currentInnTalkLoop: null, // Build 15.2.31: Remember current generic inn talk loop line

    // 基本ステータス (Unified HP variables)
    currentDistance: 0,
    deathCount: 0, // Track number of defeats
    cainLv: 1,
    currentHP: 100,        // Unified HP variable
    maxHP: 100,            // Unified max HP variable
    attack: 10,
    exp: 0,

    // Debug flags
    debug: {
        isSkipping: false // Space key held for fast text skip
    },

    // 進行管理
    inventory: {
        silverCoin: 0,
        herb: 0,
        berry: 0,
        charm: 0,
        edibleHerb: 0,
        mintFlower: 0,
        boneMeal: 0,
        emptyBottle: 0,
        matamatabiBranch: 0,
        glowingCatRabbitFur: 0,
        glowingBrooch: 0,
        lightRabbitBrooch: 0,
        debug_poison: 10,
        debug_lvl10: 1
    },
    silverCoins: 0, // Currency tracking
    postTreeBattles: null, // Count battles after tree defeat
    searchCounter: 0, // Battle counter for finding the tree
    flags: {
        silverDelivered: false,
        gotTestCoin: false,
        hasIntroFinished: false, // プロローグ完了フラグ
        hasFoundFirstCoin: false, // First coin discovery now triggered by inspecting 6m
        forest3mFirstVisit: false, // Build 15.2.54: One-time auto dialogue at forest 3m during phase 0
        forest3mInspectCount: 0, // Build 15.2.54: Track one-time special inspect talk at forest 3m during phase 0
        forest5mFirstVisit: false, // Build 15.2.43: One-time first visit scene at forest 5m
        forest5mBroochFound: false, // Build 15.2.54: One-time brooch pickup at forest 5m inspect
        forest6mFirstVisit: false, // Build 15.2.43: One-time first coin scene at forest 6m
        forest6mCoinFound: false, // Build 15.2.54: One-time silver coin pickup at forest 6m inspect
        forest8mTreeHintShown: false, // Build 15.2.55: Track one-time ambient hint for the amber tree at forest 8m
        forest8mInspectCount: 0, // Build 15.2.55: Track inspect progress toward the first amber tree encounter at forest 8m
        forestFirstEnter: false, // Build 15.2.39: One-time first arrival dialogue at forest entrance 0m
        firstInnSleep: false, // Build 15.2.50: One-time special inn sleep scene during story phase 1
        innRatEvent: false, // Build 15.2.51: One-time inn rat event on first observe during story phase 1
        innRatEvent2: false, // Build 15.2.52: One-time inn rat event on first observe from story phase 3 onward
        innRatEvent2BattleActive: false, // Build 15.2.52: Temporary routing flag for phase 3 inn rat post-battle dialogue
        hasTreeEventOccurred: false, // Hungry Amber Tree event at 8m
        treeDefeated: false, // Track if tree has been defeated
        duelCoinAwarded: false, // Track duel coin reward
        isDebugEncountersOff: false, // Toggle random encounters
        readyForThiefBoy: false, // Flag for Thief Boy event
        isTreeRematch: false, // Build 15.1.1a: Persistent tracker for rematch state
        treeFirstDefeat: false, // Build 15.2.8: Track first defeat against the hungry amber tree
        treeExitTalkDone: false, // Build 15.2.9: One-time inn-exit talk after first amber tree defeat
        treeVictoryTalkDone: false, // Build 15.2.11: One-time post-victory talk after defeating the hungry amber tree
        amberTreeFourHitSceneSeen: false, // Build 15.2.6: One-time amber tree battle dialogue gate
        pendingLevelUpTalk: [], // Build 15.2.48: Store unplayed level-up talk milestones from boss victories
        glowCatRabbitBadEndSeen: false, // Build 15.2.57: Stop future glowing cat rabbit encounters after the Lv88 bad end
        glowCatRabbitPhase4EncounterSeen: false, // Build 15.2.59: Guarantee fur on the first glowing rabbit encounter after phase 4 unlock
        glowCatRabbitTalkLv5Done: false, // Build 15.2.61: One-time normal glowing rabbit talk for the first Lv5 encounter before phase 4
        glowCatRabbitTalkLv10Done: false, // Build 15.2.61: One-time normal glowing rabbit talk for Lv10
        glowCatRabbitTalkLv15Done: false, // Build 15.2.61: One-time normal glowing rabbit talk for Lv15
        glowCatRabbitTalkLv20Done: false, // Build 15.2.61: One-time normal glowing rabbit talk for Lv20
        metThiefBoy: false, // Flag for meeting the thief boy
        thiefDiscoveryStatus: 0, // 0=not discovered, 1=discovered
        thiefTrackActive: false, // Tracking quest active
        hasSleptAfterThief: false, // Track if player slept after meeting thief
        heardScream: false, // Build 14.1.4: Track if 9m scream event is finished
        giantLarvaDefeated: false, // Build 14.1.3: Robust Boss Flag
        onWagon: false, // Build 14.2.1: Track if player boarded wagon
        phase4TheftDiscovered: false, // Build 15.2.62: Theft has been noticed and the phase 4 inn route should begin
        phase4FortuneIntroDone: false, // Build 15.2.62: One-time automatic fortune-teller intro on entering the inn during phase 4
        phase4FortuneConsultDone: false, // Build 15.2.62: Main fortune consultation that requests glowing cat rabbit fur
        phase4OwenConsultCount: 0, // Build 15.2.62: Track early Owen consultations during the phase 4 inn route
        needsGlowingRabbitFur: false, // Build 15.2.62: Phase 4 fur quest gate before re-enabling the 9m/10m rescue route
        phase4MatamatabiTalkCount: 0, // Build 15.2.63: Track the two rumor talks about the matamatabi branch
        heardMatamatabiRumor: false, // Build 15.2.63: Unlock the 4m branch clue after hearing the daughter's rumor
        matamatabiBranchFound: false // Build 15.2.63: Track whether the branch has already been picked up at 4m
    },

    // 一時フラグ
    isBattling: false,
    isAtInn: false,
    currentEnemy: null,
    talkCount: 0,
    canStay: true,
    lastBlowBy: null, // "Cain" or "Owen"
    defeatCounts: {}, // Track kills by ID
    glowCatRabbitDefeatCount: 0, // Build 15.2.57: Track how many glowing cat rabbits have been defeated
    playerTookCoin: null, // Track choice at tree event (true/false/null)

    // Duel System State
    // Duel system removed in Build 15.0.0
};

// Legacy Support Shim
window.gameState = RPG.State;

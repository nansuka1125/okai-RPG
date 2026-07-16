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
    version: "15.2.115 (Legacy Cleanup)", // Build 15.2.115: Remove confirmed unreferenced legacy data and state
    mode: "base", // base, event, battle
    location: "宿屋《琥珀亭》",
    mood: 50,              // 気分値（デバッグ用表示あり）
    isPoisoned: false,     // 毒状態
    poisonDamageRemaining: 0, // Remaining poison damage budget; starts at one third of max HP
    isInDungeon: false,    // 拠点(false)とダンジョン(true)の切り替え
    explorationArea: null, // null, forest, herbGarden, or highway
    completedEvents: [],   // 発生済みイベントIDを記録
    dialogueQueue: [],     // 会話イベントのキュー
    isWaitingForInput: false, // Tap-to-advance dialogue state
    dialogueIndex: 0,      // Current position in dialogue queue
    storyPhase: 0,         // Build 14.2.0: Story progression tracking (0-9+)
    highwayBattleCount: {}, // Build 14.2.2: Track fixed encounters on highway
    herbUseCount: 0,       // Build 15.2.25: Track herb use dialogue milestones
    matamatabiUseCount: 0, // Build 15.2.67: Track sequential manual-use dialogue for the matamatabi branch
    observeIndex: 0,       // Build 15.2.29: Next phase candidate for inn observe dialogue
    observePhaseReached: {}, // Build 15.2.29: Track highest inn observe entry read per phase
    talkPhaseReached: {},  // Build 15.2.30: Track highest inn talk entry read per phase
    currentInnTalkLoop: null, // Build 15.2.31: Remember current generic inn talk loop line
    innEventViewedIds: [], // Track viewed random inn-stay events per save slot

    // 基本ステータス (Unified HP variables)
    currentDistance: 0,
    deathCount: 0, // Track number of defeats
    cainLv: 1,
    currentHP: 100,        // Unified HP variable
    maxHP: 100,            // Unified max HP variable
    attack: 10,
    swordLevel: 1,
    exp: 0,

    // Debug flags
    debug: {
        isSkipping: false // Space key held for fast text skip
    },

    // 進行管理
    inventory: {
        silverCoin: 0,
        herb: 0,
        highHerb: 0,
        antidoteHerb: 0,
        berry: 0,
        charm: 0,
        edibleHerb: 0,
        mintFlower: 0,
        boneMeal: 0,
        scentPouch: 0,
        emptyBottle: 0,
        matamatabiBranch: 0,
        glowingCatRabbitFur: 0,
        lightBook: 0,
        purpleMacaron: 0,
        glowingBunnyEars: 0,
        nightMedicine: 0,
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
        hasIntroFinished: false, // プロローグ完了フラグ
        hasFoundFirstCoin: false, // First coin discovery now triggered by inspecting 6m
        forest3mFirstVisit: false, // Build 15.2.54: One-time auto dialogue at forest 3m during phase 0
        forest3mInspectCount: 0, // Build 15.2.54: Track one-time special inspect talk at forest 3m during phase 0
        forest5mFirstVisit: false, // Build 15.2.43: One-time first visit scene at forest 5m
        forest5mBroochFound: false, // Build 15.2.54: One-time brooch pickup at forest 5m inspect
        forest6mFirstVisit: false, // Build 15.2.43: One-time first coin scene at forest 6m
        forest6mCoinFound: false, // Build 15.2.54: One-time silver coin pickup at forest 6m inspect
        forest8mInspectCount: 0, // Build 15.2.55: Track inspect progress toward the first amber tree encounter at forest 8m
        forestFirstEnter: false, // Build 15.2.39: One-time first arrival dialogue at forest entrance 0m
        herbGardenFirstEnterDone: false, // Build 15.2.89: One-time arrival dialogue at the herb garden
        herbGardenHerb1Available: true, // Build 15.2.90: 1m herb returns after staying at the inn
        herbGardenHerb2Available: true, // Build 15.2.90: 2m herbs return after three completed battles
        herbGardenHerb2BattlesRemaining: 0,
        herbGardenHighHerbAvailable: true, // Build 15.2.99: 4m high herb returns after five completed battles
        herbGardenHighHerbBattlesRemaining: 0,
        herbGardenAntidoteHerbAvailable: true, // Build 15.2.99: 6m antidote herb returns after five completed battles
        herbGardenAntidoteHerbBattlesRemaining: 0,
        herbGardenMintCollected: false, // Build 15.2.99: One-time mint flower gathering at 7m
        herbGardenEdibleHerbCollected: false, // Build 15.2.99: One-time edible herb gathering at 7m
        herbGardenBlockedExperienced: false, // Build 15.2.91: Track the first pre-phase-6 hallucination at 3m
        herbGardenForceAdvanceTried: false, // Build 15.2.91: Keep the forced-advance option until it has been tried once
        scentPouchQuestStarted: false, // Build 15.2.93: The wagon's horse needs a calming scent pouch
        herbGardenBreathAttempted: false, // Build 15.2.93: Phase 6 3m option completion
        herbGardenHandholdAttempted: false, // Build 15.2.93: Phase 6 3m option completion
        herbGardenFortuneConsultUnlocked: false, // Build 15.2.93: Handhold failure unlocks the fortune teller
        herbGardenBroochGranted: false, // Build 15.2.93: The light rabbit brooch has been loaned
        herbGardenFortuneFollowupDone: false, // Build 15.2.93: One-time material hint after receiving the brooch
        herbGardenOwenJewelChecked: false, // Build 15.2.93: Hide Owen's jewel option after its one-time exchange
        scentPouchInfoHeard: false, // Build 15.2.95: First inn hint directing Cain to the herb garden
        scentPouchInfoFollowupDone: false, // Build 15.2.95: One-time herb garden warning from the innkeeper
        herbGardenEmptyBottleBorrowed: false, // Build 15.2.96: The innkeeper has lent Cain the dried-fruit jar
        herbGardenBoneMealInspected: false, // Build 15.2.97: Cain has identified the small bones at 3m
        herbGardenBoneMealCollected: false, // Build 15.2.97: One-time bone meal collection gate
        herbGardenBrooch2mPassageSeen: false, // Build 15.2.101: One-time safe-passage dialogue at 2m
        herbGardenBrooch3mPassageSeen: false, // Build 15.2.101: One-time brooch-light scene at 3m
        herbGardenKissEventDone: false, // Build 15.2.102: One-time rest scene after collecting mint at 7m
        herbGardenReturnHandholdDone: false, // Build 15.2.102: One-time return scene after collecting both pouch materials
        herbGardenReturnHandholdActive: false, // Build 15.2.109: Prevent encounters while Owen leads Cain back to the entrance
        herbGardenBroochReturned: false, // Build 15.2.103: The borrowed light rabbit fur has been returned to the fortune teller
        carnivorousVineDefeated: false, // Build 15.2.98: Initial 5m vine has been defeated at least once
        carnivorousVineRegrown: false, // Build 15.2.98: Another vine can reappear after three stays
        carnivorousVineStayCount: 0,
        firstInnSleep: false, // Build 15.2.50: One-time special inn sleep scene during story phase 1
        innRatEvent: false, // Build 15.2.51: One-time inn rat event on first observe during story phase 1
        innRatEvent2: false, // Build 15.2.52: One-time inn rat event on first observe from story phase 3 onward
        innRatEvent2BattleActive: false, // Build 15.2.52: Temporary routing flag for phase 3 inn rat post-battle dialogue
        hasTreeEventOccurred: false, // Hungry Amber Tree event at 8m
        treeDefeated: false, // Track if tree has been defeated
        isDebugEncountersOff: false, // Toggle random encounters
        readyForThiefBoy: false, // Flag for Thief Boy event
        isTreeRematch: false, // Build 15.1.1a: Persistent tracker for rematch state
        treeFirstDefeat: false, // Build 15.2.8: Track first defeat against the hungry amber tree
        treeExitTalkDone: false, // Build 15.2.9: One-time inn-exit talk after first amber tree defeat
        treeVictoryTalkDone: false, // Build 15.2.11: One-time post-victory talk after defeating the hungry amber tree
        amberTreeFourHitSceneSeen: false, // Build 15.2.6: One-time amber tree battle dialogue gate
        pendingLevelUpTalk: [], // Build 15.2.48: Store unplayed level-up talk milestones from boss victories
        glowCatRabbitBadEndSeen: false, // Build 15.2.57: Stop future glowing cat rabbit encounters after the Lv88 bad end
        glowCatRabbitPhase4EncounterSeen: false, // Build 15.2.59: Track the first rabbit encounter after phase 4 unlock
        glowCatRabbitTalkLv5Done: false, // Build 15.2.61: One-time normal glowing rabbit talk for the first Lv5 encounter before phase 4
        glowCatRabbitTalkLv10Done: false, // Build 15.2.61: One-time normal glowing rabbit talk for Lv10
        glowCatRabbitTalkLv15Done: false, // Build 15.2.61: One-time normal glowing rabbit talk for Lv15
        glowCatRabbitTalkLv20Done: false, // Build 15.2.61: One-time normal glowing rabbit talk for Lv20
        glowCatRabbitLv88EscapeTalkDone: false, // Build 15.2.88: Play the Lv88 escape aftermath only once
        glowCatRabbitRewardLv5Received: false, // Build 15.2.106: Prevent duplicate Lv5 victory rewards
        glowCatRabbitRewardLv10Received: false, // Build 15.2.106: Prevent duplicate Lv10 victory rewards
        glowCatRabbitRewardLv15Received: false, // Build 15.2.106: Prevent duplicate Lv15 victory rewards
        glowCatRabbitRewardLv20Received: false, // Build 15.2.106: Prevent duplicate Lv20 victory rewards
        nightMedicineAftermathPending: false, // Build 15.2.106: Play the inn-front aftermath after the medicine night
        nightMedicineAftermathSeen: false, // Build 15.2.106: Keep the inn-front aftermath one-time
        morningTraining1Done: false, // Build 15.2.107: First post-tree morning training scene
        morningTraining2Done: false, // Build 15.2.107: Post-fortune-request morning training scene
        morningTraining3Pending: false, // Build 15.2.107: Play the wood-chopping scene on a later inn-front exit
        morningTraining3Done: false, // Build 15.2.107: One-time wood-chopping training scene
        phase6BlacksmithMorningSeen: false, // Build 15.2.108: The daughter has announced the visiting blacksmith
        phase6BlacksmithAvailable: false, // Build 15.2.108: The blacksmith remains in the inn until departure or conversation
        phase6BlacksmithTalked: false, // Build 15.2.108: The optional sword-maintenance event has been completed
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
        phase4SweetDeliveryDone: false, // Build 15.2.81: Track the one-time joke delivery button after Owen's second consultation
        phase4FortuneFollowupCount: 0, // Build 15.2.81: Track the two optional fortune-teller follow-up talks
        needsGlowingRabbitFur: false, // Build 15.2.62: Phase 4 fur quest gate before re-enabling the 9m/10m rescue route
        phase4MatamatabiTalkCount: 0, // Build 15.2.63: Track the two rumor talks about the matamatabi branch
        heardMatamatabiRumor: false, // Build 15.2.63: Unlock the 4m branch clue after hearing the daughter's rumor
        matamatabiBranchFound: false, // Build 15.2.63: Track whether the branch has already been picked up at 4m
        matamatabiActive: false, // Build 15.2.64: Party-wide phase 4 state enabled after taking damage while carrying the branch
        matamatabiNightPending: false, // Build 15.2.85: Schedule the first pre-delivery inn night after the branch activates
        matamatabiNightSeen: false, // Build 15.2.85: Prevent the matatabi special night from replaying
        phase6PostDeliverySleepDone: false, // Build 15.2.72: One-time sleep scene after silver delivery before wagon info unlocks
        phase6WagonMapTalkDone: false, // Build 15.2.70: First phase 6 inn talk about choosing a route
        wagonInfoHeard: false, // Build 15.2.70: Unlock the stalled wagon encounter in the forest
        phase6RoomTalkDone: false, // Build 15.2.70: One-time room follow-up after silver delivery
        wagonDriverTalkStep: 0, // Build 15.2.71: 0=unmet, 1=driver talked, 2=encourage choices unlocked
        wagonDriverEncouraged: false, // Build 15.2.71: One-time gag choice at the stalled wagon
        wagonHorseEncouraged: false, // Build 15.2.70: Switch phase 6 inn reminder after talking to the stalled wagon driver
        scentPouchCrafted: false, // Build 15.2.110: Mint and bone meal have been made into the calming pouch
        scentPouchHandedToDriver: false, // Build 15.2.112: The pouch now hangs by the wagon reins on the Former Highway
        phase7DepartureNightSeen: false, // Build 15.2.111: One-time departure-eve scene after the scent pouch is tested
        phase7DepartureMorningTalkPending: false, // Play the herb banter on the next inn-front exit after departure night
        wagonReadyForDeparture: false // Build 15.2.68: Allow the moved departure-night scene only after the wagon preparation quest is complete
    },

    // 一時フラグ
    isBattling: false,
    isAtInn: true,
    currentEnemy: null,
    talkCount: 0,
    canStay: true,
    lastBlowBy: null, // "Cain" or "Owen"
    defeatCounts: {}, // Track kills by ID
    glowCatRabbitDefeatCount: 0, // Build 15.2.57: Track how many glowing cat rabbits have been defeated
    nightMedicineEvasionBattlesRemaining: 0, // Build 15.2.106: 50% evasion for the next five battles
    playerTookCoin: null, // Track choice at tree event (true/false/null)
    matamatabiStepsRemaining: 0, // Build 15.2.64: Remaining forest steps before the activated branch effect fades
};

// Keep a pristine deep copy for old-save migration. Load must never use the
// currently played slot as the source of defaults for fields missing in a save.
RPG.DefaultState = JSON.parse(JSON.stringify(RPG.State));

// Legacy Support Shim
window.gameState = RPG.State;

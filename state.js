// 🚩ーー【State Management: Build 14.0 - Modular Architecture】ーー



// RPGオブジェクトの初期化（もし未定義なら）
window.RPG = window.RPG || {};

// Build 14.1: Game Configurations
RPG.Config = {
    MAX_DISTANCE: 10,    // 琥珀の森の最深部
    MIN_DISTANCE: 0,     // 宿屋前
    BATTLE_RATE: 0.6,    // エンカウント率（60%）
    NIGHT_STEP_THRESHOLD: 20, // Valid field moves after staying before night falls
    HEAL_ON_LEVEL_UP: false, // Build 15.2.47: Toggle full HP recovery on level up
    LEVEL_UP_TALK_BATTLE_ONLY: true, // Build 15.2.49: Reserve milestone level-up talks for battle victories only
    FAKE_WOUND_MEDICINE_AUTO_HEAL_RATE: 0.4,
    SMOKE_BOMB_STEP_COUNT: 10,
    HIGH_HERB_JAM_MAX_USES: 3, // Build 15.6.2: Uses granted by the one-time hard-bottle opening
    AMBER_VARIANT_ENCOUNTER_RATE: 0.25, // Provisional Chapter 1 balance value for independent amberized rat/weasel encounters
    // Provisional Chapter 1 balance values: after metThiefBoy, the forest's 7m-9m depths raise
    // the base BATTLE_RATE (0.6) and give sap a heavier draw weight than its normal 5, so the
    // amber sap source is easier to find without ever excluding the other normal candidates.
    DEEP_FOREST_POST_THIEF_BOY_BATTLE_RATE: 0.8,
    DEEP_FOREST_POST_THIEF_BOY_SAP_WEIGHT: 15,
    // Provisional Chapter 1 balance value: sap's attack power once empowered (metThiefBoy true),
    // applied fresh to the per-battle enemy copy in beginBattle() - never written back onto the
    // shared ENEMIES template, so it can't stack across battles or duplicate on save/load.
    EMPOWERED_SAP_ATK_MULTIPLIER: 1.5,
    // Fraction of the HP actually drained from Cain that the empowered sap heals itself for.
    EMPOWERED_SAP_DRAIN_HEAL_RATE: 0.5,
    // Provisional Chapter 1 battle-kit values. Keeping the entire set here lets balance work
    // tune Cain's sword techniques without changing battle flow.
    CAIN_COMBAT: {
        CRITICAL_RATE: 0.10,
        SHINY_OIL_CRITICAL_RATE_BONUS: 0.20,
        CRITICAL_DAMAGE_MULTIPLIER: 1.5,
        SWORD_TECHNIQUE_RATE: 0.20,
        BLUE_AMBER_SWORD_TECHNIQUE_RATE_BONUS: 0.20,
        STRONG_ATTACK_RATE: 0.50,
        STRONG_ATTACK_DAMAGE_MULTIPLIER: 1.8,
        RAPID_ATTACK_DAMAGE_MULTIPLIER: 0.7,
        RAPID_ATTACK_HIT_COUNT: 2,
        FIREPROOF_GLOVES_COUNTER_DAMAGE_MULTIPLIER: 1.0
    },
    // The gloves always provide their flat defense bonus. Their former parry-damage reduction
    // is intentionally replaced by the counterattack in battle.js.
    FIREPROOF_GLOVES_DEFENSE_BONUS: 2,
    // Provisional, pre-balance rare-amber effect values. Kept in one place so tuning later
    // doesn't require hunting through battle.js/exploration.js/uiControl.js.
    RARE_AMBER_TUNING: {
        SWEET_AMBER_INTERVENTION_BONUS_PP: 10, // Flat bonus added to Owen's intervention chance (0-100 scale, same units as RPG.State.mood)
        BEE_AMBER_FIRST_HIT_MULTIPLIER: 1.5, // Applied to Cain's first damage instance dealt each battle only
        BEE_AMBER_DAMAGE_TAKEN_MULTIPLIER: 0.5, // Applied to ordinary enemy-attack damage against Cain
        BEE_AMBER_DROP_RATE: 0.1, // skull_bee drop chance; capped to one lifetime copy via flags.beeAmberObtained
        HERB_AMBER_TURN_HEAL_RATE: 0.03, // Fraction of maxHP healed at the end of each battle turn (min 1)
        HERB_AMBER_MOVE_HEAL_RATE: 0.02, // Fraction of maxHP healed per field move (min 1)
        HERB_AMBER_ITEM_HEAL_MULTIPLIER: 1.5, // Applied to herb/highHerb item heal amounts
        MONSTER_AMBER_XP_MULTIPLIER: 1.25, // Applied to ordinary battle-victory XP only
        MILK_AMBER_MAX_HP_BONUS_RATE: 0.3, // Flat % of maxHP added on equip, subtracted back on unequip
        CRACKED_AMBER_CRIT_BONUS_PP: 20, // Flat percentage-point bonus to the crit roll while below the HP threshold
        CRACKED_AMBER_HP_THRESHOLD_RATE: 0.5, // currentHP/maxHP at or below this fraction activates the crit bonus
        HATED_AMBER_ENCOUNTER_RATE: 0.05, // Ordinary random encounter rate while 嫌われ琥珀 is equipped
        MASOCHIST_AMBER_MID_HIT_HEAL_RATE: 0.2,
        MASOCHIST_AMBER_LATE_HIT_HEAL_RATE: 0.4
    }
};

// この下に既存の RPG.State = { ... } が続くようにする

RPG.State = {
    // Build version tracking
    version: "15.6.0 (Chapter 1 Complete)", // Build 15.6.0: Complete Chapter 1 flow, retreat/retry support, and preserved side events
    mode: "base", // base, event, battle
    location: "宿屋《琥珀亭》",
    mood: 50,              // 気分値
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
    // 《琥珀樹の根》 discovery progress at each forest distance, independent per site.
    // "unexamined" -> "examined" (talked to, no scar yet) -> "scarred" (shinyOil used)
    // -> "ignited" (hardOil used) -> "defeated" (the site's burning-root battle is won).
    amberRootState: { 6: "unexamined", 7: "unexamined", 8: "unexamined" },
    // Fixed exactly once when the third amber root is defeated. Each value is the saved ALL
    // target for that enemy's finite post-root forest encounters; null keeps the ALL tier hidden.
    // Old saves without these values intentionally remain unsupported once all roots are down.
    amberEnemyAllTargets: { sap: null, amber_rat: null, amber_weasel: null },
    // The 《鍵入り琥珀》 can only be burned on the burn site of the root just defeated, so this
    // holds that site's distance (6, 7, or 8) and is cleared back to null the moment Cain leaves
    // it. Returning to the same burn site later does not bring the chance back.
    amberRootKeyBurnOpportunityDistance: null,
    // Single forest hut at 10m. "locked" -> "unlocked" (examined while holding the 《🗝️古びた鍵》,
    // which is consumed) -> "eventPlayed" (one-time snake scene seen) -> "gloveGranted" (fireproof
    // gloves obtained, terminal). The key itself comes from burning the 《鍵入り琥珀》 at a defeated
    // amber root's burn site.
    forestHutState: "locked",
    // Forest 10m's hut is discovered by its first ordinary examination.
    forestHutDiscovered: false,
    // 《鍵入り琥珀》をアイテム欄から使った回数。三段階会話の進行を保存する。
    keyAmberUseCount: 0,
    // 泥這う大幼蟲の死骸調査。0=未調査(銀貨3枚目 未取得) -> 1=銀貨3枚目 取得
    // -> 2=オーエンの一幕 済み -> 3=《誰かの日記》入手済み(終端)。
    larvaCorpseStage: 0,
    herbUseCount: 0,       // Build 15.2.25: Track herb use dialogue milestones
    matamatabiUseCount: 0, // Build 15.2.67: Track sequential manual-use dialogue for the matamatabi branch
    observeIndex: 0,       // Build 15.2.29: Next phase candidate for inn observe dialogue
    observePhaseReached: {}, // Build 15.2.29: Track highest inn observe entry read per phase
    talkPhaseReached: {},  // Build 15.2.30: Track highest inn talk entry read per phase
    currentInnTalkLoop: null, // Build 15.2.31: Remember current generic inn talk loop line
    innEventViewedIds: [], // Track viewed random inn-stay events per save slot
    saveMeta: {
        format: 1,
        kind: null,
        savedAt: null,
        memo: "",
        location: ""
    }, // Presentation metadata stored with each manual or suspend save

    // 基本ステータス (Unified HP variables)
    currentDistance: 0,
    travelStepsSinceStay: 0, // Valid forward/back field moves since the last overnight stay
    deathCount: 0, // Track number of defeats
    cainLv: 5,
    currentHP: 140,        // Unified HP variable
    maxHP: 140,            // Unified max HP variable
    attack: 18,
    defense: 0,            // Base defense; fireproofGloves' bonus is computed on top of this, never added into it
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
        fakeWoundMedicine: 0,
        smokeBomb: 0,
        hardBottle: 0,
        highHerbJam: 0,
        gratefulTalisman: 0,
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
        glowingBrooch: 0,
        lightRabbitBrooch: 0,
        unknownAmber: 0,
        vampireAmber: 0,
        secretLetter: 0,
        borrowedMiningKnife: 0,
        miningKnife: 0,
        amberTreeTimber: 0,
        someonesDiary: 0,
        shinyOil: 0,
        glossyOil: 0,
        hardOil: 0,
        fireproofGloves: 0,
        hatedAmber: 0,
        sweetAmber: 0,
        herbAmber: 0,
        monsterAmber: 0,
        milkAmber: 0,
        blueAmber: 0,
        beeAmber: 0,
        ignoredAmber: 0,
        crackedAmber: 0,
        masochistAmber: 0,
        keyAmber: 0,
        oldKey: 0,
        debug_lvl10: 1
    },
    equippedRareAmberId: null, // Rare amber currently socketed into the glowing brooch
    // 未鑑定琥珀のうち、入手時に鑑定結果まで決まっているものだけを順に保持する。
    // unknownAmber との差分が通常枠で、古いセーブの specialUnknownAmber は読込時に吸血琥珀へ移行する。
    unappraisedAmberResults: [],
    amberStorage: {
        sparkling: 0
    },
    amberAppraisalSeen: {
        sparkling: false,
        junk: false,
        insect: false
    },
    junkAmberDelivered: 0,
    silverCoins: 0, // Currency tracking
    postTreeBattles: null, // Count battles after tree defeat
    searchCounter: 0, // Battle counter for finding the tree
    flags: {
        silverDelivered: false,
        hasIntroFinished: false, // プロローグ完了フラグ
        introDebtTalkPending: false, // Formal prologue has finished; only the inn talk command may continue the debt negotiation
        introDebtFurJokeTried: false, // One-time opening joke choice before Cain accepts the silver-coin debt
        introDebtNegotiationDone: false, // Opening debt negotiation has resolved and normal inn controls may unlock
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
        herbGarden7mIgnoredAmberRestSeen: false, // One-time rest scene on first reaching 7m via the ignoredAmber bypass, post brooch return
        carnivorousVineDefeated: false, // Build 15.2.98: Initial 5m vine has been defeated at least once
        carnivorousVineRegrown: false, // Build 15.2.98: Another vine can reappear after three stays
        carnivorousVineStayCount: 0,
        herbGardenVineNestState: "unknown", // Vine nest side trip: "unknown" -> "discovered" -> "confirmed"
        herbGardenVineNestCleared: false, // All three nest vines beaten; reset by the existing three-stay regrowth
        herbGardenVineNestAmberTaken: false, // One-time ？琥珀 at the back of the nest
        firstInnSleep: false, // Build 15.2.50: One-time special inn sleep scene during story phase 1
        innRatEvent: false, // Build 15.2.51: One-time inn rat event on first observe during story phase 1
        innRatEvent2: false, // Build 15.2.52: One-time second inn rat event
        innRatEvent2StayCount: 0, // Completed inn stays after the first rat event, capped at one
        innRatEvent2BattleActive: false, // Build 15.2.52: Temporary routing flag for the second inn rat post-battle dialogue
        hasTreeEventOccurred: false, // Hungry Amber Tree event at 8m
        treeDefeated: false, // Track if tree has been defeated
        readyForThiefBoy: false, // Flag for Thief Boy event
        isTreeRematch: false, // Build 15.1.1a: Persistent tracker for rematch state
        treeFirstDefeat: false, // Build 15.2.8: Track first defeat against the hungry amber tree
        treeExitTalkDone: false, // Build 15.2.9: One-time inn-exit talk after first amber tree defeat
        treeVictoryTalkDone: false, // Build 15.2.11: One-time post-victory talk after defeating the hungry amber tree
        amberTreeFourHitSceneSeen: false, // Build 15.2.6: One-time amber tree battle dialogue gate
        amberMerchantRecognized: false,
        borrowedMiningKnifeReceived: false,
        amberTreeCoinMined: false,
        sapSourceAwarenessSeen: false, // One-time post-battle talk realizing the amber sap has another source; also the start condition for the amber root thread
        forest2mPacifiedTalkSeen: false, // One-time forest-2m talk once all three amber roots are down
        amberRatEquippedTalkSeen: false, // One-time post-battle talk after an amber_rat win while a rare amber is equipped
        amberRatThreeKillTalkSeen: false, // One-time post-battle talk once cumulative amber_rat kills reach 3
        amberWeaselFirstKillTalkSeen: false, // One-time post-battle talk after the first cumulative amber_weasel kill
        firstAmberAppraisalDone: false,
        keyAmberExchanged: false, // The 《鍵入り琥珀》 trades exactly once; burning it back to 0 does not re-offer it
        vampireAmberAppraisalSeen: false,
        vampireAmberChainBattleCount: 0, // 0-5; battles completed in a row while vampireAmber is equipped. Next battle fought is this+1
        vampireAmberStage1TalkSeen: false, // One-time dialogue the first time the stage-1 (1st-battle) drain fires
        vampireAmberStage2TalkSeen: false, // One-time dialogue the first time the stage-2 (4th-battle) drain fires
        vampireAmberPendingTalkStages: [], // One-time vampire-amber talks waiting for a safe post-battle slot (1 or 2)
        pendingBattleCountEvents: [], // Enemy-count BATTLE_EVENTS deferred by a higher-priority vampire-amber talk
        beeAmberObtained: false, // 蜂入り琥珀 drops at most once ever; survives being equipped/unequipped (inventory count alone can't gate this)
        milkAmberMaxHpBonus: 0, // Exact maxHP delta 牛乳琥珀 added on equip, so unequip subtracts precisely that amount back
        amberKnifeReturnAttemptDone: false,
        amberMerchantMovePending: false,
        amberMerchantMovedToForest: false,
        amberMerchantCrackedAmberReceived: false,
        miningKnifeAwarded: false,
        fakeWoundMedicinePrepared: false,
        gratefulTalismanPrepared: false,
        shinyOilPrepared: false,
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
        morningTraining1Done: false, // Build 15.2.107: First post-tree morning training scene
        morningTraining2Done: false, // Build 15.2.107: Post-fortune-request morning training scene
        morningTraining3Pending: false, // Build 15.2.107: Play the wood-chopping scene on a later inn-front exit
        morningTraining3Done: false, // Build 15.2.107: One-time wood-chopping training scene
        metThiefBoy: false, // Flag for meeting the thief boy
        thiefDiscoveryStatus: 0, // 0=not discovered, 1=discovered
        thiefTrackActive: false, // Tracking quest active
        hasSleptAfterThief: false, // True once the player has slept one night after learning the thief boy's whereabouts from the fortune teller; unlocks the rain and thief rescue route, reset when the rescue completes
        heardScream: false, // Build 14.1.4: Track if 9m scream event is finished
        giantLarvaDefeated: false, // Build 14.1.3: Robust Boss Flag
        highway8mMasochistAmberAvailable: false, // One-time inspection reward after the 8m fixed highway battle
        highway8mMasochistAmberDiscoverySeen: false, // The 8m highway reward discovery text has been shown
        highway8mMasochistAmberTaken: false, // The 8m highway masochist amber has been collected
        forest2mSparklingAmberTaken: false, // One-time fixed sparkling amber at forest 2m
        forest9mSparklingAmberTaken: false, // One-time fixed sparkling amber at forest 9m
        someonesDiaryFirstReadDone: false, // 初回読了キューを最後まで再生したら true
        onWagon: false, // Build 14.2.1: Track if player boarded wagon
        phase4TheftDiscovered: false, // Build 15.2.62: Theft has been noticed and the phase 4 inn route should begin
        phase4FortuneIntroDone: false, // Build 15.2.62: One-time automatic fortune-teller intro on entering the inn during phase 4
        phase4FortuneConsultDone: false, // Build 15.2.62: Main fortune consultation that requests glowing cat rabbit fur
        phase4OwenConsultCount: 0, // Build 15.2.62: Track early Owen consultations during the phase 4 inn route
        phase4SweetDeliveryDone: false, // Build 15.2.81: Track the one-time joke delivery button after Owen's second consultation
        phase4FortuneFollowupCount: 0, // Build 15.2.81: Track the two optional fortune-teller follow-up talks
        needsGlowingRabbitFur: false, // Build 15.2.62: Phase 4 fur quest gate before re-enabling the 9m/10m rescue route
        phase4MatamatabiRabbitEncounters: 0, // Fur-less rabbit encounters while matatabi is active; the second quest encounter guarantees fur
        phase4MatamatabiTalkCount: 0, // Build 15.2.63: Track the two rumor talks about the matamatabi branch
        heardMatamatabiRumor: false, // Build 15.2.63: Unlock the 4m branch clue after hearing the daughter's rumor
        matamatabiBranchFound: false, // Build 15.2.63: Track whether the branch has already been picked up at 4m
        matamatabiBranchFoundAgain: false, // One-time re-acquisition of the branch at 4m, available once giantLarvaDefeated and phase6PostDeliverySleepDone are both true (post-boss, rain stopped)
        matamatabiActive: false, // Build 15.2.64: Party-wide phase 4 state enabled after taking damage while carrying the branch
        matamatabiAutoActivationDone: false, // Build 15.6.x: The automatic damage-triggered activation is one-time; manual use remains repeatable
        matamatabiNightPending: false, // Build 15.2.85: Schedule the first pre-delivery inn night after the branch activates
        matamatabiNightSeen: false, // Build 15.2.85: Prevent the matatabi special night from replaying
        phase6PostDeliverySleepDone: false, // Build 15.2.72: One-time sleep scene after silver delivery before wagon info unlocks
        forestPacifiedNightSeen: false, // One-time night talk on the first ordinary stay after the forest-2m pacification talk
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
        wagonReadyForDeparture: false, // Build 15.2.68: Allow the moved departure-night scene only after the wagon preparation quest is complete
        chapter1Cleared: false, // Chapter 1 is complete only after the final victory scene has fully finished
        notebookUnlocked: false, // Build 15.5.1: One-time daughter scene unlocks the inn's 討伐ノート command
        notebookRatEncountered: false,
        notebookWeaselEncountered: false,
        notebookSapEncountered: false,
        notebookAmberRatEncountered: false,
        notebookAmberWeaselEncountered: false,
        ratBounty10Received: false, // Build 15.5.1: Prevent duplicate rat-10-kill bounty reward from the 討伐ノート
        weaselBounty10Received: false,
        weaselBounty20Received: false,
        sapBounty10Received: false,
        sapBounty20Received: false,
        amberRatBounty15Received: false,
        amberWeaselBounty15Received: false,
        ratBountyAllUnlocked: false,
        ratBountyAllProgress: 0,
        weaselBountyAllUnlocked: false,
        weaselBountyAllProgress: 0,
        ratBountyAllReceived: false,
        weaselBountyAllReceived: false,
        sapBountyAllReceived: false,
        amberRatBountyAllReceived: false,
        amberWeaselBountyAllReceived: false,
        innRepairConsultSeen: false, // Build 15.5.3: One-time innkeeper consultation after both inn rat battles, introducing the inn-repair thread
        ratBounty20Received: false, // Build 15.5.3: Rat-20 bounty from the 討伐ノート; also signals the inn-repair thread's next stage is unlocked
        ratEvent2BattleFought: false, // Build 15.5.4: One ordinary battle victory after inn rat event 1, required before the チューチュー❗️ trigger for inn rat event 2
        repairConsultBattleFought: false, // Build 15.5.4: One ordinary battle victory after inn rat event 2, required before the innkeeper repair consult
        innRepairInspectionUnlocked: false, // Build 15.5.5: Silently unlocked once innRepairConsultSeen and ratBounty20Received are both true; cleared once innRepairInspectionReported
        innRepairHoleInspected: false, // Build 15.5.5: Inn-front outer wall hole inspection done
        innRepairDroppingsInspected: false, // Build 15.5.5: Forest-entrance rat droppings inspection done
        innRepairPillarInspected: false, // Build 15.5.5: Inn lobby gnawed pillar inspection done
        innRepairInspectionReported: false, // Build 15.5.5: One-time report to the innkeeper after all three inspections
        innRepairTimberSearchUnlocked: false, // Build 15.5.5: Set alongside the report; gates the forest-8m timber retrieval event
        innRepairTimberObtained: false, // Build 15.5.6: One-time amber tree timber retrieval at forest 8m, once the damage report has unlocked the search
        innRepairTimberDelivered: false, // The innkeeper has received the timber and secured material for repair boards
        innRepairHelpStarted: false, // The innkeeper repair-help intro has played; waiting on the daughter's oils
        innRepairOilsReceived: false, // The daughter has granted all three oils; waiting to resume the repair
        innRepairCompleted: false, // The outer wall hole has been sealed; the repair thread's terminal state
        innRepairAmberRewardReceived: false, // One-time fixed milk-amber result from the completed repair
        hardBottleOpened: false, // Build 15.6.1: One-time opening flourish for the hard bottle once Cain reaches Lv10
        highHerbJamPrepared: false // Build 15.6.2: Prepared 上薬草のジャム; survives battles until it full-heals once at half HP or less
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
    smokeBombStepsRemaining: 0,
    playerTookCoin: null, // Track choice at tree event (true/false/null)
    matamatabiStepsRemaining: 0, // Build 15.2.64: Remaining forest steps before the activated branch effect fades
};

// Keep a pristine deep copy for old-save migration. Load must never use the
// currently played slot as the source of defaults for fields missing in a save.
RPG.DefaultState = JSON.parse(JSON.stringify(RPG.State));

// Legacy Support Shim
window.gameState = RPG.State;

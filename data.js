// --- 定数・設定管理 --- 
const CONFIG = {
    MAX_DISTANCE: 10,
    MIN_DISTANCE: 0,
    ITEM_NAME: { silverCoin: "🪙銀貨", herb: "🌿薬草", berry: "甘い木の実", debug_poison: "《デバッグ毒》" },
    ITEM_DESC: {
        silverCoin: "宿屋に納品するための銀貨。3枚必要だ。",
        herb: "傷を癒やす野草。HPの40%を回復する。", // Build 8.51: Updated to 40% MaxHP
        berry: "魔界の植物の実。甘くて美味しい。",
        debug_poison: "【テスト用】使うとHPが1になります。",
        debug_lvl10: "💊レベルアップ薬"
    },
    ITEM_DESC: {
        silverCoin: "宿屋に納品するための銀貨。3枚必要だ。",
        herb: "傷を癒やす野草。HPの40%を回復する。", // Build 8.51: Updated to 40% MaxHP
        berry: "魔界の植物の実。甘くて美味しい。",
        debug_poison: "【テスト用】使うとHPが1になります。",
        debug_lvl10: "【デバッグ用】使うと一気にLv.10になります。"
    },
    // バトル設定
    BATTLE_RATE: 0.6, // Build 6.2: Increased encounter rate (was 0.3)
};

// Build 6.3.6: Ambient Flavor Texts (1m-9m, excluding 5m)
const AMBIENT_TEXTS = {
    1: "宿屋の喧騒が遠のき、湿った静寂が二人を包み込む。",
    2: "枝の間からのぞく光が、カインのブーツを照らす。",
    3: "何かの小動物が逃げていく気配がした。",
    4: "踏みしめた枯れ葉が、乾いた音を立てて砕ける。",
    6: "風に乗って、かすかに血生臭い甘い匂いが漂ってきた。",
    7: "見上げると、空が急に暗くなってきた。木々が光を吸っているようだ。",
    8: "泥ではない。粘りつく樹液が、靴底に嫌な重さを与える。",
    9: "腐肉が発酵したような、鼻を突く芳香が足元から立ち昇った。"
};

// 🚩ーー【Build 8.0: Game Text - UI and Scenario Strings】ーー
const GAME_TEXT = {
    // UI Buttons
    buttons: {
        enterForest: "琥珀の森",
        moveForward: "進む",
        useItem: "使う"
    },

    // Exploration Messages
    exploration: {
        enteredForest: "―― 琥珀の森 ――",
        leftForest: "琥珀の森を抜け、宿屋前まで戻ってきた。",
        moved: (dist) => `${dist}m地点へ移動した。`,
        poisonDamage: "毒が身体を蝕んでいる…（HP-2）",
        talkAtInn: "（宿屋に入って主人と話そう）",
        talkInDungeon: "（周囲を警戒している…）",
        noInventory: "所持品なし",
        gateGuard: "門番『通行証か納品が済むまでは通せん。』"
    },

    // Inn System Messages
    inn: {
        welcome: "―― 宿屋《琥珀亭》 ――",
        ownerGreeting: "宿屋の主人『いらっしゃい、カイン。ゆっくりしていきな。』",
        locationFront: "―― 宿屋前 ――",
        noNeedRest: "カイン「今はまだ休む必要はないな。」",
        cannotStayAgain: "宿屋の主人『悪いが、そう何度も部屋は貸せねえよ。』",
        // Build 8.24: Sequential Defeat Events
        defeatEvents: [
            {
                id: 1,
                text: [
                    "カインは宿屋のベッドで目を覚ました。手当はされている。",
                    "娘「大丈夫ですか…？ 宿の前で倒れていて…」",
                    "カイン「すまない…助かったよ。」"
                ]
            },
            {
                id: 2,
                text: [
                    "全身が酷く痛む。カインは目を覚ました。",
                    "オーエン「…次は置いてくからな」",
                    "カイン「…ああ。気をつけよう。」"
                ]
            },
            {
                id: 3,
                text: [
                    "酷い夢を見た。汗びっしょりで目が覚めた。",
                    "カイン「夢、だけじゃなかったな」",
                    "身体の震えが止まらない…まだ恐怖が残っているようだ。"
                ]
            }
        ],
        commonDefeat: "カインは気が遠くなった…",
        // Build 8.25: Bad End Text
        badEnd: [
            "身体が痛い。",
            "目が覚めると、カインは荷馬車に揺られていた。",
            "カイン「……は？」",
            "ひどく焦げた匂いが鼻をつく。",
            "空を舞う黒い雪のようなものは、なんだ。",
            "身体を無理矢理起こしたカインは、目に飛び込んできた景色に絶句した。",
            "琥珀の森は、消滅していた。",
            "至るところで黒紫の炎がうねり、雪のように灰が降っている。空が暗い。",
            "遠く、目を凝らした。",
            "宿屋も、跡形もなくなっていた。",
            "カイン「そんな……宿屋の主人は、娘は……！？」",
            "オーエン「銀貨なら、もう払う必要はないよ」",
            "カインは荷馬車を降りようと身を乗り出す。",
            "カイン「どこかで怪我をしているかもしれない。探しに行かないと……！」",
            "オーエン「…騎士様」",
            "オーエンがカインの腕を掴んだ。",
            "騎士であるカインが身動きを封じられるほどの、異常な力。",
            "オーエン「もうちょっと眠ってたら？」",
            "ガタガタと荷馬車が揺れる。",
            "降り注ぐ灰の中で、オーエンの衣類にだけは、一片の汚れもついていなかった。",
            "カインの意識は、そこで途絶えた。",
            "【BAD END 〜琥珀の森焼失〜】"
        ],
        morningMessage: [
            "朝になった。さあ出発だ",
            "小鳥のさえずりで目が覚めた。体力が戻っている。",
            "昨夜の疲れはすっかり取れたようだ。朝日が眩しい。"
        ],
        hpRecovered: (amount) => `HPが ${amount} 回復した。`,
        poisonCured: "（毒も浄化された）",
        deliveryComplete: "銀貨を納品した。"
    },

    // Inn Observe Messages (by silver coin count)
    innObserve: {
        0: "[Silver: 0] Conversation Placeholder ①",
        1: "[Silver: 1] Conversation Placeholder ②",
        2: "[Silver: 2] Conversation Placeholder ③",
        default: "（静かに宿屋の様子を見ている…）"
    },

    // Item Usage Messages
    items: {
        notNeeded: "今は使う必要がない。",
        herbHealed: "薬草を使い、HPが全回復した。",
        herbHealedAndCured: "薬草を使い、HPが全回復し、毒が浄化された。",
        debugPoisonUsed: "《デバッグ毒》を煽った！カインの意識が遠のく……（HPが1になりました）",
        cannotUse: "それは使えないようだ。"
    },

    // Event Messages
    events: {
        firstCoinFound: "道端に何かが光っている…",
        firstCoinGet: "🪙銀貨を見つけた！",
        owenPlaceholder5m: "[5m: Owen's random behavior placeholder]",
        hintAt7m: "(A sickly sweet, honey-like scent begins to drift through the air...)",
        treeEncounter: "飢えた琥珀樹がそびえ立っている。幹の中心部に、心臓のように🪙銀貨が埋め込まれている。",
        pathAt10m: "The path opens up. You see a stalled carriage and shadows moving around it.",
        thiefDiscoveryHookB: [
            { text: "カイン「……あれ？」", delay: 1000 },
            { text: "カイン「銀貨が……ない」", delay: 1500 },
            { text: "カイン「さっきの少年……まさか」", delay: 1500 },
            { text: "オーエン「気づいたんだ」", delay: 1000, color: "#a020f0" },
            { text: "カイン「おまえ、知ってたのか！？」", delay: 1000 },
            { text: "オーエン「うん。でも教えてあげなかった」", delay: 1500, color: "#a020f0" },
            { text: "カイン「……」", delay: 1000 },
            {
                text: null, delay: 0, action: () => {
                    gameState.mode = "base";
                    uiControl.updateUI();
                }
            }
        ],

        // Build 12.3.8: Re-adding Missing Thief Collision Data
        thiefCollision: [
            { text: "――ドンッ！！", delay: 1000 },
            { text: "勢いよく飛び出してきた影がカインの背中に衝突した。", delay: 1500 },
            { text: "黒い髪の少年がぶつかってきたようだ。", delay: 1000 },
            { text: "カイン「おっと！……大丈夫か？」", delay: 1000 },
            { text: "カインが少年の様子を窺うが、少年は気まずそうに目を逸らすと、軽く会釈して足早に走り去っていった。", delay: 1500 },
            {
                text: null, delay: 0, action: () => {
                    // Silent Theft Logic
                    gameState.silverCoins = 0;
                    gameState.inventory.silverCoin = 0;
                    uiControl.updateUI();
                }
            },
            { text: "オーエン「……ふーん？」", delay: 1000, color: "#a020f0" },
            { text: "オーエンは何かに気づいたような顔をしたが、カインを見つめるだけで何も教えてくれなかった。", delay: 1500 },
            // Build 8.55: Delayed Discovery Logic (Part A)
            {
                text: null, delay: 0, action: () => {
                    gameState.flags.metThiefBoy = true;
                    gameState.flags.readyForThiefBoy = false;
                    gameState.flags.thiefDiscoveryStatus = 0;
                    gameState.flags.thiefTrackActive = false;

                    // Silent Theft Logic
                    gameState.silverCoins = 0;
                    gameState.inventory.silverCoin = 0;
                    uiControl.updateUI();

                    // Proceed to Inn Front state (Manual Entry Required)
                    gameState.isAtInn = false;
                    gameState.location = "宿屋前";
                    gameState.mode = "base";
                    uiControl.addLog(GAME_TEXT.inn.locationFront, "marker");
                    uiControl.updateUI();
                }
            }
        ]
    },

    // Tree Event Choices
    treeEvent: {
        takeCoin: "銀貨を取る",
        leaveCoin: "やめておく",
        playerTakes: "カインは銀貨に手を伸ばした…",
        playerLeaves: "カインは不吉な予感を感じ、その場を離れることにした。",
        returnedTo7m: "7m地点まで戻った。",
        treeAwakens: "樹の枝が突然、激しく動き出した！"
    },

    // Battle Defeat Messages
    battle: {
        cainDefeated: "カインは傷つき、倒れた…",
        foundAtInn: [
            "気がつくと、宿屋の前に転がされていた。",
            "気がつくと、宿屋のベッドで看病されていた。",
            "通りがかりの冒険者に助けられ、宿屋まで運ばれたようだ。"
        ]
    },

    // Build 8.8: Owen's Idle Phrases (傍観)
    owenIdlePhrases: [
        "オーエンは目を細めて見ている",
        "オーエンはつまらなそうに爪をいじっている",
        "オーエンは靴の汚れを気にしている",
        "オーエン「そんな雑魚早く片付けて」"
    ]
};

// 🚩ーー【敵データ】ーー
// 🚩ーー【敵データ】ーー (Moved to battleData.js in Build 12.0.2)
// See battleData.js for ENEMIES definition

// Duel Data removed in Build 15.0.0


// 🚩ーー【イベントデータ】ーー
const EVENT_DATA = [
    {
        id: "prologue_event",
        condition: (state) => !state.flags.hasIntroFinished,
        action: (state) => {
            state.dialogueQueue = [
                { text: "宿屋の主人「…なあ、言いづらいんだがそろそろ宿代を払ってはくれないか？」", delay: 1000 },
                { text: "カイン「…本当にすまない。今日明日でなんとか、稼いでくるよ。」", delay: 1000 },
                { text: "宿屋の主人「そうしてくれ」", delay: 1000 },
                { text: "カイン「まさか財布の中が空っぽになってるとは思わなかったんだよ…」", delay: 1000 },
                { text: "オーエン「間抜け」", delay: 1000, color: "#a020f0" },
                { text: "カイン「おまえだろ」", delay: 1000 },
                { text: "宿屋の主人「よし、こうしよう。【銀貨３枚】持ってきてくれ。それでツケ。チャラにしてやる。それまで寝る場所は物置になるからな。」", delay: 1000 },
                { text: "System「《銀貨を３枚納品しよう》」", delay: 1000 }
            ];
        }
    },
    // Build 8.46: Post-Tree Fatigue Event
    {
        id: "post_tree_fatigue",
        condition: () => false, // Manually triggered
        action: (state) => {
            state.dialogueQueue = [
                { text: "銀貨を求めて森を探索したが、特に何も見つけられなかった。", delay: 800 },
                { text: "カイン「さすがにそんなに落ちてる筈ないか」", delay: 800 },
                { text: "オーエン「もっとたくさんの行商人の死体が山積みになってればいいのに？」", delay: 1200, color: "#a020f0" },
                { text: "カイン「そんなことは言ってない。…だが、そうだな。銀貨は自然発生しない。」", delay: 1200 },
                { text: "何かを期待して森を彷徨うような行為には、疲労を感じてきた。", delay: 800 },
                { text: "カイン「一度、宿屋に戻ろう」", delay: 800 }
            ];
            state.flags.readyForThiefBoy = true; // Set flag
            state.postTreeBattles = "DONE"; // Build 8.54: Permanently disable counter
        }
    },
    // Build 8.49: 9m Scream Event (Thief Boy Rescue - Part 1)
    {
        id: "thief_rescue_9m_scream",
        condition: (state) => state.currentDistance === 9 && state.flags.thiefDiscoveryStatus === 1 && !state.completedEvents.includes("thief_rescue_9m_scream"),
        action: (state) => {
            console.log("DEBUG: 9m Scream Event triggered. thiefDiscoveryStatus =", state.flags.thiefDiscoveryStatus);
            state.dialogueQueue = [
                { text: "腐った泥の臭いが漂ってくる。", delay: 1200 },
                { text: "カイン「…なんか変な臭いがしないか？」", delay: 1200 },
                { text: "オーエン「……」", delay: 1000, color: "#a020f0" },
                {
                    text: null,
                    delay: 500,
                    action: () => {
                        uiControl.screenShake();
                    }
                },
                { text: "うわああああーーー！！", delay: 1500, color: "#ff4d4d", fontSize: "18px" },
                { text: "カイン「あっちの方からだ！行くぞ！」", delay: 1200 }
            ];
            state.completedEvents.push("thief_rescue_9m_scream");
        }
    },

    // Build 8.49: 10m Rescue Event (Thief Boy Rescue - Part 2)
    {
        id: "thief_rescue_10m_battle",
        condition: (state) => state.currentDistance === 10 && state.flags.thiefDiscoveryStatus === 1 && !state.completedEvents.includes("thief_rescue_10m_battle"),
        action: (state) => {
            console.log("DEBUG: 10m Rescue Event triggered. Preparing battle intro.");
            state.dialogueQueue = [
                { text: "カイン「なんだあれ…！？」", delay: 1200 },
                { text: "半透明な皮膚に、斑（まだら）模様の肉が透けている。巨大なミミズのような、あるいは幼虫のような…そんな不気味な魔物が、少年をじりじりと追い詰めていた。", delay: 2000 },
                { text: "少年「だすけてええぇぇーー！！！」", delay: 1500, color: "#4d94ff" },
                { text: "カイン「待ってろ！今助ける！」", delay: 1000 },
                {
                    text: null,
                    delay: 500,
                    action: () => {
                        uiControl.screenShake();
                        // Start Mid-Boss Battle
                        // Build 9.0.0: Direct Trigger
                        battleSystem.startBattle("giant_larva");
                    }
                },
                { text: "少年と異形の間に、黒い外套が割って入る。カインは抜いたばかりの剣の腹で、そのヌメリを帯びた巨躯を強引に弾いた。", delay: 2000 }
            ];
            gameState.completedEvents.push("thief_rescue_10m_battle");
        }
    },
    // Build 11.0.0: Mid-Boss Outro "The Bitter Reward" - Tap-to-Advance
    {
        id: "thief_rescue_victory",
        condition: (state) => false, // Triggered manually by battle logic
        action: (state) => {
            // Build 11.0.0: Dialogue array for tap-to-advance system
            const dialogue = [
                { text: "《泥這う大幼蟲》を倒した！", type: "defeat" },
                { text: "カイン「はぁ…はぁ…やったか…？」", type: "talk" },
                { text: "カインは、その場に膝をついた。" },
                { text: "肩口の傷から、コールタールのような毒が滲んでいる。" },
                { text: "少年「あ、あ……」", type: "talk", color: "#4d94ff" },
                { text: "少年は恐怖に顔を歪めたまま、幼蟲の死骸を見つめていた。" },
                { text: "半透明の身体からどろりとした体液が溢れ、カインが切り裂いた隙間から、見覚えのある革袋の端が覗いている。" },
                { text: "オーエンはためらいもなくその中に手を突っ込み、袋を引き抜いた。" },
                { text: "オーエン「…あぁ、中は無事そう」", type: "talk", color: "#a020f0" },
                { text: "少年「あああ、あげます！それはあげます！」", type: "talk", color: "#4d94ff" },
                { text: "少年は叫ぶなり、脱兎のごとく森の奥へ逃げ去っていった。" },
                { text: "カイン「えっ!?…大丈夫なのか？」", type: "talk" },
                { text: "オーエン「あの子は元気そうだね。…銀貨も入ってたよ。３枚」", type: "talk", color: "#a020f0" },
                { text: "オーエンが袋から銀貨を取り出してみせる。" },
                { text: "カイン「…２枚は、俺のだな」", type: "talk" },
                { text: "オーエン「もらっとけば？…たった銀貨一枚なんて、英雄の命も随分値切られたね騎士様」", type: "talk", color: "#a020f0" },
                { text: "オーエンは銀貨を袋に戻した。" },
                {
                    text: "🪙 銀貨を手に入れた！",
                    type: "item",
                    color: "#FFD700",
                    action: () => {
                        gameState.silverCoins = 3;
                        if (gameState.inventory.silverCoin !== undefined) {
                            gameState.inventory.silverCoin = 3;
                        }
                        uiControl.updateUI();
                    }
                },
                { text: "カイン「……う…っ」", type: "talk" },
                {
                    text: null, // Silent action
                    action: () => {
                        gameState.currentHP = Math.max(1, gameState.currentHP - 2);
                        uiControl.flashFullScreen("#800080", 800);
                        uiControl.updateUI();
                    }
                },
                { text: "オーエンは革袋の中から薬草を引っ張り出してカインに投げた。" },
                {
                    text: "🌿 薬草を手に入れた！",
                    type: "item",
                    color: "#00ff00",
                    action: () => {
                        gameState.inventory.herb = (gameState.inventory.herb || 0) + 1;
                        uiControl.updateUI();
                    }
                },
                { text: "オーエン「置いてくよ」", type: "talk", color: "#a020f0" },
                { text: "カインはなんとか気力を振り絞って立ち上がった。" },
                { text: "《さあ、宿屋に戻って銀貨を納品しよう。》", type: "system", color: "#cccccc" }
            ];

            // Start the tap-to-advance dialogue sequence
            uiControl.startDialogueSequence(dialogue);
        }
    },
    // Build 10.1: Chapter 1 Conclusion Event
    {
        id: "chapter1_conclusion",
        condition: (state) => false, // Triggered manually by innSystem.deliver
        action: (state) => {
            const delay = 1000;
            let currentTime = 0;
            const log = (text, type, color) => {
                setTimeout(() => {
                    uiControl.addLog(text, type, color);
                }, currentTime);
                currentTime += delay;
            };

            log("カインは銀貨を３枚、カウンターに並べた。");
            log("宿屋の主人「おお、本当に持ってきたか！ 疑って悪かったな」", "talk");
            log("主人はじゃらじゃらと銀貨を回収し、満足そうに頷いた。");
            log("宿屋の主人「これでツケはチャラだ。今日はとびきりいいうまい酒をおごってやるよ！」", "talk");
            log("カイン「ああ…ありがとう。助かるよ」", "talk");
            log("オーエン「よかったね。これでまたボロ雑巾みたいになるまで働けるよ」", "talk", "#a020f0");
            log("カイン「…言うな」", "talk");

            setTimeout(() => {
                uiControl.addLog("【 Chapter 1 銀貨と宿屋 - 完 - 】", "marker", null, "16px");
                uiControl.addLog("Coming Soon: Chapter 2...", "marker");

                // Update State
                state.silverCoins -= 3;
                if (state.inventory.silverCoin) state.inventory.silverCoin -= 3;
                state.flags.isDelivered = true;

                uiControl.updateUI();
                state.mode = "base";
            }, currentTime + 1500);
        }
    }
];

// 🚩ーー【バトルイベントデータ】ーー (Build 6.3.2)
const BATTLE_EVENTS = {
    rat: {
        1: [
            { text: "カイン「デカいネズミだったな…犬くらいあるぞ」", delay: 2000 },
            { text: "オーエン「魔界のネズミだよ。すっごく凶暴でなんでも食べる」", delay: 2000, color: "#a333c8" },
            { text: "カイン「魔界の生き物はみんな目が赤いのか？」", delay: 2000 },
            { text: "オーエン「…なんか腹立つな」", delay: 2000, color: "#a333c8" }
        ]
    },
    weasel: {
        3: [
            { text: "カイン「悔しいな…次こそは見切ってみせる！」", delay: 2000 },
            { text: "オーエン「ケモノ相手にムキになるなよ」", delay: 2000, color: "#a333c8" },
            { text: "カイン「速くて全然見えないんだ」", delay: 2000 },
            { text: "オーエン「…魔界のイタチが見えないのは速いからじゃないよ。最初現れる時は透明なんだ」", delay: 2000, color: "#a333c8" },
            { text: "カイン「そうだったのか！？」", delay: 2000 }
        ]
    }
};

// 🚩ーー【会話データ】ーー
const TALK_DATA = {
    innOwner: [
        { text: "店主「あれだ、森で適当に探してくるとかさ」", effect: null },
        { text: "娘「カインさん、あの…っ！これどうぞ」", effect: "getHerb" },
        { text: "娘「琥珀の森は最近、魔物が増えています。どうかお気をつけて」", effect: null },
        { text: "店主「早く銀貨を持ってきてくれ」", effect: null }
    ]
};

// 🚩ーー【宿屋イベントデータ】ーー
const INN_EVENTS = [
    {
        id: "storage_room",
        weight: 50,
        isViewed: false,
        dialogue: [
            { text: "宿屋の主人「銀貨を払ってくれるまでは物置くらいしか空いてないぞ」", delay: 1000 },
            { text: "オーエン「…ねえ、僕が払ってあげようか？もちろん対価はもらうけど」", delay: 1000, color: "#a020f0" },
            { text: "カイン「よせオーエン」", delay: 1000 }
        ],
        shortDialogue: [{ text: "（物置に泊まった…）", delay: 1000 }],
        morningOptions: [
            { text: "狭い部屋は静かで、ぐっすり眠れた", rate: 1.0, mood: 0 },
            { text: "オーエンはフカフカの毛皮にくるまって寝ている。\nカイン「…おーい、オーエン、行くぞー」\n肩をゆすったら、うっすら目が開いた。", rate: 1.0, mood: -5 },
            { text: "オーエン「いつまで寝てるの」\nオーエンに起こされて、カインは硬い床で目を覚ました。腰が痛い。\nカイン「………」\nオーエンはご機嫌だ。", rate: 0.7, mood: 5 }
        ]
    },
    {
        id: "stable",
        weight: 30,
        isViewed: false,
        dialogue: [
            { text: "宿屋の主人「…馬小屋にでも泊まるかい？」", delay: 1000 },
            { text: "カイン「ありがとう。馬は好きだ。」", delay: 1000 },
            { text: "オーエン「……馬鹿だもんね」", delay: 1000, color: "#a020f0" }
        ],
        morningOptions: [
            { text: "馬小屋は暖かかった。カインは馬たちに見守られながらぐっすり眠った", rate: 1.0, mood: 0 },
            { text: "その夜は妙に馬が騒がしかった…", rate: 0.7, mood: 0 },
            { text: "馬たちはオーエンを露骨に避けている…", rate: 0.7, mood: 0 }
        ]
    },
    {
        id: "daughter_room",
        weight: 10,
        isViewed: false,
        dialogue: [
            { text: "娘「あの…私の部屋でよかったら」", delay: 1000 },
            { text: "カイン「はは、気持ちは嬉しいよ！」", delay: 1000 },
            { text: "オーエン「嬉しいんだ？」", delay: 1000, color: "#a020f0" }
        ],
        morningOptions: [
            { text: "結局物置き小屋で寝た。\nカイン「…眠った気がしないな」\nさあ出発だ。", rate: 0.5, mood: 0 }
        ]
    }
];

// --- ロケーションデータ ---
const LOCATIONS = {
    0: { name: "琥珀の森 入口", hasTarget: false, desc: "ここから先が琥珀の森だ。" },
    1: { name: "琥珀の森", hasTarget: false, desc: "鳥の鳴き声が聞こえる…" },
    7: { name: "森の深層", hasTarget: true, desc: "空気が湿ってきた…" }
};

// 🚩ーー【状態管理：Build 8.0 - Unified HP Variables】ーー
let gameState = {
    // Build version tracking
    version: "11.0.6", // Build 11.0.6: Space Key Support
    mode: "base", // base, event, battle          // "base", "event", "battle", "duel"
    location: "宿屋《琥珀亭》",
    mood: 50,              // 気分値（デバッグ用表示あり）
    isPoisoned: false,     // 毒状態
    isInDungeon: false,    // 拠点(false)とダンジョン(true)の切り替え
    completedEvents: [],   // 発生済みイベントIDを記録
    dialogueQueue: [],     // 会話イベントのキュー
    isWaitingForInput: false, // Build 11.0.0: Tap-to-advance dialogue state
    dialogueIndex: 0,      // Build 11.0.0: Current position in dialogue queue

    // Build 8.0: 基本ステータス (Unified HP variables)
    currentDistance: 0,
    deathCount: 0, // Build 8.24: Track number of defeats
    cainLv: 1,
    currentHP: 100,        // Unified HP variable
    maxHP: 100,            // Unified max HP variable
    attack: 10,
    exp: 0,

    // Build 8.7: Debug flags
    debug: {
        isSkipping: false // Space key held for fast text skip
    },

    // 進行管理
    inventory: { silverCoin: 0, herb: 0, berry: 0, debug_poison: 10, debug_lvl10: 1 },
    silverCoins: 0, // Build 6.3.6: Currency tracking
    postTreeBattles: null, // Build 8.45: Count battles after tree defeat
    searchCounter: 0, // Build 8.45: Battle counter for finding the tree
    flags: {
        isDelivered: false,
        gotTestCoin: false,
        hasIntroFinished: false, // プロローグ完了フラグ
        hasFoundFirstCoin: false, // Build 6.3.6: First coin discovery at 5m
        hasTreeEventOccurred: false, // Build 6.3.7: Hungry Amber Tree event at 8m
        treeDefeated: false, // Build 8.45: Track if tree has been defeated
        duelCoinAwarded: false, // Build 8.0: Track duel coin reward
        isDebugEncountersOff: false, // Build 8.3: Toggle random encounters
        readyForThiefBoy: false, // Build 8.46: Flag for Thief Boy event
        metThiefBoy: false, // Build 8.47: Flag for meeting the thief boy
        thiefDiscoveryStatus: 0, // Build 8.48: 0=not discovered, 1=discovered
        thiefTrackActive: false, // Build 8.48: Tracking quest active
        hasSleptAfterThief: false // Build 8.58: Track if player slept after meeting thief
    },

    // 一時フラグ
    isBattling: false,
    isAtInn: false,
    currentEnemy: null,
    talkCount: 0,
    canStay: true,
    lastBlowBy: null, // "Cain" or "Owen"
    defeatCounts: {}, // Track kills by ID
    playerTookCoin: null, // Build 6.3.7: Track choice at tree event (true/false/null)

    // Build 6.3.8: Duel System State
    isDueling: false,
    duelEnemy: null, // { name, hp, maxHp }
    duelPlayerChoice: null,
    duelEnemyChoice: null
};

// Build 10.0.8: Ensure global accessibility for browser
// window.ENEMIES = ENEMIES; // Moved to battleData.js
window.EVENT_DATA = EVENT_DATA;
window.gameState = gameState;

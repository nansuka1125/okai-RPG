// 🚩ーー【Asset Management: Build 14.0 - Modular Architecture】ーー
window.RPG = window.RPG || {};

RPG.Assets = {};

// --- 定数・設定管理 --- 
RPG.Assets.CONFIG = {
    MAX_DISTANCE: 10,
    MIN_DISTANCE: 0,
    ITEM_NAME: {
        silverCoin: "🪙銀貨",
        herb: "🌿薬草",
        berry: "甘い木の実",
        charm: "🧧お守り袋",
        edibleHerb: "🌱食用ハーブ",
        matamatabiBranch: "🌿マタマタビの枝",
        mintFlower: "🪻薄荷草",
        boneMeal: "🦴骨粉",
        emptyBottle: "🫙空瓶",
        glowingCatRabbitFur: "🐇光る猫うさぎの毛",
        glowingBrooch: "💍光るブローチ",
        lightRabbitBrooch: "💍光兎のブローチ",
        debug_poison: "《デバッグ毒》"
    },
    ITEM_DESC: {
        silverCoin: "宿屋に納品するための銀貨。3枚必要だ。",
        herb: "傷を癒やす野草。HPの40%を回復する。",
        berry: "魔界の植物の実。甘くて美味しい。",
        charm: "旅の無事を願うお守り袋。",
        edibleHerb: "料理に使える種類のハーブ。",
        matamatabiBranch: "獣っぽい魔物を妙に引き寄せるらしい、不思議な枝。",
        mintFlower: "触れるとひんやりする青い花。",
        boneMeal: "細かく砕けた白い粉。不思議と落ち着く。",
        emptyBottle: "小さなガラス瓶。何かを入れられそうだ。",
        glowingCatRabbitFur: "淡い光を浴びた魔獣の毛。様々な効能があるらしい。",
        glowingBrooch: "小さく開く構造になっている。",
        lightRabbitBrooch: "耐混乱/耐幻惑の効果がある。",
        debug_poison: "【テスト用】使うとHPが1になります。",
        debug_lvl10: "【デバッグ用】使うと一気にLv.10になります。"
    },
    // バトル設定
    BATTLE_RATE: 0.6,
};

// Ambient Flavor Texts (1m-9m, excluding 5m)
RPG.Assets.AMBIENT_TEXTS = {
    1: "宿屋の喧騒が遠のき、湿った静寂が二人を包み込む。",
    2: "枝の間からのぞく光が、カインのブーツを照らす。",
    3: "何かの小動物が逃げていく気配がした。",
    4: "踏みしめた枯れ葉が、乾いた音を立てて砕ける。",
    6: "風に乗って、かすかに血生臭い甘い匂いが漂ってきた。",
    7: "見上げると、空が急に暗くなってきた。木々が光を吸っているようだ。",
    8: "泥ではない。粘りつく樹液が、靴底に嫌な重さを与える。",
    9: "腐肉が発酵したような、鼻を突く芳香が足元から立ち昇った。"
};

// Game Text - UI and Scenario Strings
RPG.Assets.GAME_TEXT = {
    // UI Buttons
    buttons: {
        enterForest: "琥珀の森",
        moveForward: "進む",
        useItem: "使う"
    },

    // Exploration Messages
    exploration: {
        enteredForest: "―― 琥珀の森入り口 ――",
        leftForest: "琥珀の森を抜け、宿屋前まで戻ってきた。",
        moved: (dist) => `${dist}m地点へ移動した。`,
        poisonDamage: "毒が身体を蝕んでいる…（HP-2）",
        talkAtInn: "カイン（特に気になるものはないな）",
        talkInDungeon: "カイン（特に気になるものはないな）",
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
        // Sequential Defeat Events
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
        // Bad End Text
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

    // Inn Observe Messages (by story phase)
    innObserve: {
        0: {
            loop: 4,
            1: [
                "元兵士「これはなんの肉なんだ？」",
                "元兵士「やたら固いなあ」",
                "護衛の男「それより塩が足りねえよ…」"
            ],
            2: [
                "元兵士「王都は壊滅状態だっていうだろ。魔王の仕業か？」",
                "護衛の男「いや、馬鹿でかい魔獣が暴れ回ったとか。城壁が崩れたってよ」",
                "カイン「………」"
            ],
            3: [
                "元兵士「あの王国騎士団は出なかったのか？」",
                "護衛の男「全然、歯が立たないほどらしい。住民を必死に逃がそうとしたが、結局は——」",
                "元兵士「……」",
                "オーエン「それで？どんな悲鳴だった？」",
                "護衛の男「どうなったのかあんまり知らないんだ」",
                "オーエン「ちっ。つまんないな。」",
                "カイン「…もう行こう」"
            ],
            4: [
                "スパイスの香りが漂う。"
            ]
        },
        1: {
            loop: 4,
            1: [
                "行商人「宿屋の娘可愛いよなぁ」",
                "行商人「お近づきになりたいな」",
                "若い剣士「やめとけよこっぴどく振られるぞ」"
            ],
            2: [
                "琥珀採り「これはどうだ？」",
                "琥珀商「なんか気味の悪いものが入ってるから買えん」",
                "琥珀採り「なんだこれ…髪の毛みたいな」"
            ],
            3: [
                "傭兵崩れ「南方は魔物が弱いって聞いたぞ」",
                "傭兵崩れ「俺らでもいけないか？」",
                "若い剣士「今から剣の修行するか？」",
                "若い剣士「案外才能があったら王都騎士団に入れたりしてな」",
                "傭兵崩れ「今なら副騎士団長の座もあいてるぞ！」",
                "オーエン「だって」",
                "カイン「………」",
                "オーエンはカインの脇腹をこづいた。"
            ],
            4: [
                "娘は忙しそうに掃除をしている。"
            ]
        },
        2: {
            loop: 4,
            1: [
                "護衛の男「オズは黒くて、デカくて、巨大な翼に棘のある尻尾があるってきいたぞ」",
                "オーエン「あはは！あたってる」",
                "護衛の男「姿を見たやつがいるのか？」",
                "護衛の男「オズは姿を見ただけで石になるって聞いたぞ」",
                "オーエン「オズに石にされて、ずっと死ねないまま、うめき続けてるんだよ」",
                "元兵士「ひえぇ」"
            ],
            2: [
                "地図屋「…東の方はもう安全なんじゃないか？」",
                "地図屋「小柄で若い戦士が、魔物どもを一人で薙ぎ払ったって話だぜ。」",
                "地図屋「ブランシェットの石造りの街まで、道を開いたらしい。」",
                "関所帰りの役人「ブランシェットか…」",
                "関所帰りの役人「あそこはよほど有能な職人でもなきゃ入れねえ。」",
                "関所帰りの役人「もしくは…貴族様に知り合いでもいなきゃなあ。」",
                "地図屋「噂が本当ならすげえけどなあ」"
            ],
            3: [
                "地図屋「ファウスト様の一行はどうなったんだろう」",
                "関所帰りの役人「…ああ。あの魔王フィガロを討ちにいったって聞いたが」",
                "地図屋「戻ってきたらさぞかし噂になってるはずだろ？…てことは、」",
                "オーエン「犬死に」",
                "カイン「……」",
                "オーエン「ああ、ファウストは生きてるかもね。手足もがれて頭だけになって喋ってるかも。」"
            ],
            4: [
                "床に樹液の汚れがこびりついている。"
            ]
        },
        3: {
            loop: 3,
            1: [
                "カウンターで男が困っている。",
                "カウンターの男「あれ？おかしいな財布が…どこかで落としたのかな？」"
            ],
            2: [
                "若い剣士「最近どこもかしこも治安が悪くなったなあ」",
                "若い剣士「西の大歓楽街じゃ盗賊が街を牛耳ってるって話だぜ」"
            ],
            3: [
                "風が強く、窓枠がガタガタと揺れている。"
            ]
        },
        4: {
            loop: 4,
            1: [
                "占い師「あら？カイン副団長？」",
                "カイン「しー…っ声を落として」",
                "占い師「バレバレだと思うけど…どうしたの？こんなところで。」",
                "カイン「訳ありなんだ。ええと、極秘の任務でさ。あんたは？」",
                "占い師「あたしは野暮用。」"
            ],
            2: [
                "占い師「それよりあなた噂になってるよ。」",
                "占い師「そっちのやたら顔のいい男は？」",
                "カイン「訳ありなんだ！」",
                "オーエン「訳ありだって」"
            ],
            3: [
                "占い師「…なんか大変そうだから、タダでアドバイス。あなたの探し物は森の奥かもよ」",
                "カイン「！ありがとう！」"
            ],
            4: [
                "旅人たちは占い師の方をチラチラ見ている。"
            ]
        },
        5: {
            loop: 3,
            1: [
                "元兵士「あのイモムシを倒したのか！？あんたらすげえな」",
                "カイン「はは、ありがとう」",
                "オーエン「あの程度で苦戦するなんて、王国の——むぐ」",
                "カインはオーエンの口を手で塞いだ",
                "カイン「痛ッ」",
                "カインは手を噛まれた"
            ],
            2: [
                "農夫「森に薬草が生えてて助かったよ…」",
                "農夫「地べた這いずり回りながら」",
                "農夫「草食いながらここまで来たんだ」",
                "カイン（わかる…）",
                "農夫「苦くてよ…」",
                "カイン（わかるぞ…）"
            ],
            3: [
                "行商人「あの化け物がいなくなったなら、チャンスじゃないか？森を抜ける…」",
                "若い剣士「街道を抜けて西まで行きてえけどな。昔は三日で行けたけど」"
            ]
        },
        6: {
            loop: 3,
            1: [
                "元兵士「物価が上がってよ…」",
                "元兵士「銅貨10枚で買えたパンが今は銀貨だ」",
                "元兵士「剣の手入れ油も手に入らねえ」"
            ],
            2: [
                "占い師「もう行くの？」",
                "カイン「ああ。またどこかで会えたらその時は酒でも飲もう！」",
                "占い師「ふふ、うれしい。これあげる。」",
                "薬草を三つ受け取った！",
                "オーエン「そうやって貢がせてるんだ」",
                "カイン「そんなつもりでは…？」"
            ],
            3: [
                "旅人たちは出発の準備をしている。",
                "カイン（俺もそろそろ行こう）"
            ]
        }
    },

    // Build 14.1: Restored Daughter Room Event Data
    innEvents: {
        daughterRoom: {
            coin1: [
                { text: "娘「物置は寝具もありませんし、私の部屋はソファがありますから…」", delay: 800 },
                { text: "娘「もしよければ…どうぞ」", delay: 800 },
                { text: "カイン「いつもありがとう。気持ちだけ受け取っておくよ」", delay: 800 },
                { text: "オーエン「この娘の正体は魔物で、おまえを食おうとしてるんだよ。」", delay: 1000, color: "#a020f0" },
                { text: "カイン「おい！」", delay: 500 },
                { text: "娘「そんな…」", delay: 500 },
                { text: "オーエン「あはは！その顔。図星だった？」", delay: 1000, color: "#a020f0" }
            ],
            coinMultiple: [
                { text: "娘「私の部屋にいらしてください。旅のお話、きかせてくれませんか？」", delay: 800 },
                { text: "カイン「ぜひそうしたいが、流石に夜に娘さんの部屋には…」", delay: 800 },
                { text: "オーエン「僕がしてあげようか？魔界の楽しい話をたくさん聞かせてあげる。」", delay: 1000, color: "#a020f0" },
                { text: "オーエン「ふかふかのベッドでね」", delay: 1000, color: "#a020f0" },
                { text: "娘「えっ」", delay: 500 },
                { text: "カイン「こら」", delay: 500 }
            ]
        }
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
        owenFlavor5m: [
            { text: "オーエンは退屈そうに視線を泳がせた" },
            { text: "オーエンは足元の土を蹴ってわざとカインにかけた" },
            { text: "オーエンは鼻歌を歌っている" },
            { text: "オーエンはだるそうに歩いている" },
            { text: "オーエンは茂みに視線を投げた。何かが逃げていった" },
            { text: "オーエンはそこら辺の草をカインの顔に投げてきた！", givesHerb: true },
            { text: "オーエンは獲物を探している…" },
            { text: "オーエンが足元の何かを蹴り飛ばした" },
            { text: "オーエンはカインの足を引っ掛けた" },
            { text: "オーエンはつま先で、落ちてる琥珀を弄んでいる" },
            { text: "オーエンは不吉な歌を歌っている" },
            { text: "オーエンは眠そうに目を擦った" }
        ],
        hintAt7m: "(A sickly sweet, honey-like scent begins to drift through the air...)",
        treeEncounter: "飢えた琥珀樹がそびえ立っている。幹の中心部に、心臓のように🪙銀貨が埋め込まれている。",
        pathAt10m: "ここが森の最奥だ。\nカイン（まだこの先に進むわけにはいかないな）",
        thiefDiscoveryHookB: [
            { text: "カイン「……あれ？」", delay: 1000 },
            { text: "カイン「銀貨が……ない」", delay: 1500 },
            { text: "カイン「さっきの少年……まさか」", delay: 1500 },
            { text: "オーエン「気づいたんだ」", delay: 1000, color: "#a020f0" },
            { text: "カイン「おまえ、知ってたのか！？」", delay: 1000 },
            { text: "オーエン「うん。でも教えてあげなかった」", delay: 1500, color: "#a020f0" },
            { text: "カイン「……」", delay: 1000 },
            { text: "カイン「困ったな…宿屋で聞き込みしてみよう」", delay: 1500 },
            {
                text: null, delay: 0, action: () => {
                    RPG.State.mode = "base";
                    uiControl.updateUI();
                }
            }
        ],
        phase4FortuneIntro: [
            "〜宿屋琥珀亭〜",
            "宿屋に入ると、紫のヴェールをまとい、宝石の耳飾りを揺らした女性が声をかけてきた。",
            "王都の占い師｢あら？もしかしてカイン副団長？」",
            "カイン｢しー、声を落として。久しぶりだな！」",
            "カインは小声で肩を叩いた。",
            "占い師｢バレバレだと思うけど…どうしたの？こんなところで。」",
            "カイン｢訳ありなんだ。ええと、極秘の任務でさ。あんたは？」",
            "占い師「あたしも仕事だよ。…それよりあなた噂になってるよ。そっちのやたら顔のいい男は？」",
            "カイン｢訳ありなんだ」",
            "オーエン｢訳ありだって」",
            "カイン（泥棒について何か知っているかもしれない）",
            "カイン｢実は全財産、盗まれちまってさ」",
            "占い師｢あらお気の毒」",
            "カイン（銀貨2枚だけど…）",
            "占い師｢まさか、占って欲しいの？」",
            "カイン｢占えるか？」",
            "カイン（占いは行動技術だ。対価を用意できるかな）",
            "占い師｢デートしてくれるならいいよ！」",
            "カインはテーブルに腕をついて笑った。",
            "カイン｢あんたとデートできるなら役得だ！けど俺は今財布がないし、デートできる場所も…あるか？」",
            "占い師｢そこの森でもいいよ」",
            "カイン｢それなら」",
            "オーエン｢……」",
            "カイン｢ええと…こいつも一緒でもいいかな？」",
            "占い師｢うーん、彼もすごく素敵だけど、デートなら2人がいいかな」",
            "カイン｢今どうしてもこいつと離れられないんだ」",
            "占い師｢じゃあ仕方ないな。デートは今度ってことで。」",
            "カイン｢他に方法はないか？」",
            "占い師｢光る猫うさぎの毛を採ってきて」"
        ],
        phase4FortuneConsult: [
            "占い師｢仕事に必要なの。持ってきてくれたら、タダで占ってあげる」",
            "カイン｢わかった。探してみるよ」",
            "占い師｢あたしの占いだと、琥珀の森にいるはずなんだけど。頑張ってね」"
        ],
        phase4FortuneDelivery: [
            "✨光る猫うさぎの毛を渡した！",
            "占い師｢よく手に入ったね！さすが副騎士団長！」",
            "カイン｢内密に頼む！それで、泥棒の居場所頼めるか？」",
            "占い師｢まかせて」",
            "占い師は鏡のようなものを取り出してぶつぶつと何か呟いた。",
            "占い師｢……今夜、琥珀の森の奥に来るみたいよ」",
            "カイン｢本当か！？ありがとう」",
            "占い師｢あとこれはおまけだけど…」",
            "占い師はカインの顔をじっと見た。",
            "占い師｢カイン、あなた、大きな勘違いをしているかもしれない」",
            "カイン｢勘違い？なんのことだ？」",
            "占い師｢あたしにはそこまでは見えないかな。」",
            "オーエン「…っあははは」",
            "カイン｢…？覚えておくよ」",
            "カイン（よし、準備して琥珀の森に行こう）",
            "オーエンはまだニヤニヤしている。"
        ],
        phase4OwenConsult1: [
            "オーエン｢光る猫うさぎの毛？そんなの、今のおまえじゃ取れないよ」",
            "カイン｢占いは高等魔術なんだ。本来一般人が頼めるものじゃない」",
            "オーエン｢デートは？」",
            "カイン｢だから、今はおまえから離れられないし」",
            "オーエン｢デートって何するの」",
            "カイン｢2人きりで喋りながら歩いたり、踊ったり」",
            "オーエン｢それがどうして毛の代わりになるの？」",
            "カイン｢俺にもよくわからない。とにかく、光る猫うさぎを探そう。協力してくれないか」",
            "オーエン｢やだ」",
            "カイン｢オーエン…」",
            "カイン（宿屋でもう少し情報を集められないかな）"
        ],
        phase4MatamatabiTalk1: [
            "店主「猫うさぎ？なんだそりゃ」",
            "カイン｢レアモンスターらしいんだが…それを見つけたら、あんたに銀貨を渡せそうなんだ」",
            "店主「そう言われてもなあ…」"
        ],
        phase4MatamatabiTalk2: [
            "娘「この森には、獣っぽい魔物を妙に引き寄せる枝があるって聞いたことがあります。",
            "……白っぽい葉の低木だったとか」",
            "カイン｢猫うさぎにも効くかな」",
            "娘｢可愛い響きですね猫うさぎ。見てみたいです」"
        ],
        phase4MatamatabiHint4m: [
            "周囲の草木に混じって、見慣れない低木が生えている。",
            "葉の色がわずかに白っぽく見える。"
        ],
        phase4MatamatabiPickup4m: [
            "葉の先だけ、白く乾いたように変色している。",
            "他の植物とは少し様子が違う。",
            "カイン「これじゃないか？」",
            "パキッ",
            "🌿マタマタビの枝 を手に入れた！",
            "カイン｢なんの匂いもしないな」",
            "カインはオーエンに匂いを嗅がせてみた",
            "オーエン｢…木の匂いしかしないけど」",
            "カイン｢とりあえず持ち歩いてみるか」",
            "折れた枝は軽く、乾いている。",
            "ほとんど匂いはしない。"
        ],
        phase4MatamatabiActivate: [
            "カイン｢いてて…」",
            "手に持っていたマタマタビの枝にカインの血がついた。",
            "オーエン｢……っ！」",
            "カイン｢どうした？」",
            "オーエンが肩越しに覗き込んでくる。",
            "カイン｢匂いがするか？」",
            "オーエン｢かなりね」",
            "ゾワッ",
            "森の気配が変わった。",
            "マタマタビの枝は活性化した。"
        ],
        phase4MatamatabiFade: [
            "マタマタビの枝の匂いが薄くなってきた",
            "オーエン「匂いが薄くなった」",
            "カイン「まだ使えるかな」",
            "※アイテム欄から再び使うことができます"
        ],
        phase4MatamatabiReuse1: [
            "カインは枝を傷口に擦り付けた。",
            "オーエン「そんなんじゃダメだよ。貸して」",
            "カイン「痛…っ！？」",
            "🌿マタマタビの枝は活性化した"
        ],
        phase4MatamatabiReuse2: [
            "オーエンは枝をカインに擦り付けた。",
            "カイン「…っ」",
            "カインは声を出さずに耐え切った。",
            "🌿マタマタビの枝は活性化した"
        ],
        phase4MatamatabiReuse3: [
            "カインは枝を擦り付けた",
            "カイン「どんな匂いなんだ？」",
            "オーエン「落ち着いて、気持ちいいような匂い」",
            "🌿マタマタビの枝は活性化した"
        ],
        phase4MatamatabiReuseLoop: [
            "カインは枝を擦り付けた",
            "🌿マタマタビの枝は活性化した"
        ],
        phase4MatamatabiFlavor: [
            "あちらこちらから生き物の気配がする。",
            "オーエンがやたら近くを歩いている。",
            "魔界イタチの群れに囲まれている気配がする。",
            "オーエンがカインの前を歩いている。",
            "オーエンは殺気立っている。",
            "オーエンは周囲の気配に苛立っている…。",
            "オーエンは落ち着かない様子だ…。",
            "オーエンはあたりを威嚇している。"
        ],
        phase4GlowingRabbitFurObtained: [
            "カイン｢やった！毛を手に入れたぞ！」",
            "オーエン｢…ちょうだい」",
            "カイン｢えっ！？」",
            "オーエンは🌿マタマタビの枝を奪い取った！",
            "オーエンはマタマタビの枝で傷口を抉った！",
            "ダメージ+2",
            "カイン｢いててて！」",
            "オーエン｢くんくん…くんくん…」",
            "カイン｢オーエン！ちょっと、」",
            "オーエンは枝を舐めては、カインの傷を抉ってくる。",
            "オーエン｢もう少し枝取ってこよう」",
            "カイン｢痛いからもうやめよう」",
            "カインは傷口を隠すように庇った。",
            "オーエンの目はまだギラギラしている……",
            "オーエンが全て舐めとったため、枝は不活性化した。"
        ],
        phase4GlowingRabbitNoFur: [
            "カイン（すばしっこくてなかなか取れないな…",
            "もう少し粘ってみるか）"
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
                    RPG.State.silverCoins = 0;
                    RPG.State.inventory.silverCoin = 0;
                    uiControl.updateUI();
                }
            },
            { text: "オーエン「……ふーん？」", delay: 1000, color: "#a020f0" },
            { text: "オーエンは何かに気づいたような顔をしたが、カインを見つめるだけで何も教えてくれなかった。", delay: 1500 },
            // Build 8.55: Delayed Discovery Logic (Part A)
            {
                text: null, delay: 0, action: () => {
                    RPG.State.flags.metThiefBoy = true;
                    RPG.State.flags.readyForThiefBoy = false;
                    RPG.State.flags.thiefDiscoveryStatus = 0;
                    RPG.State.flags.thiefTrackActive = false;
                    if (RPG.State.storyPhase < 3) {
                        RPG.State.storyPhase = 3;
                    }

                    // Silent Theft Logic
                    RPG.State.silverCoins = 0;
                    RPG.State.inventory.silverCoin = 0;
                    uiControl.updateUI();

                    // Proceed to Inn Front state (Manual Entry Required)
                    RPG.State.isAtInn = false;
                    RPG.State.location = "宿屋前";
                    RPG.State.mode = "base";
                    uiControl.addLog(GAME_TEXT.inn.locationFront, "marker");
                    uiControl.updateUI();
                }
            }
        ]
    },

    // Tree Event Choices
    treeEvent: {
        intro: "【飢えた琥珀樹】\n\nカイン「…ん？あそこ何か」\n\n視線の先、その大樹は他の木々とは明らかに異相を呈していた。幹のいたるところで琥珀の瘤（こぶ）がぼこぼこと隆起し、黄金色の腫瘍のように木肌を覆っている。特に太い幹の空洞は、溢れ出した樹脂に飲み込まれた「黒い何か」で埋め尽くされていた。その中央。どろりとした澱みの奥で、銀貨が心臓のように沈んでいる。",
        owenIntro: "オーエン：「宿代、彼が払ってくれるって。ラッキーだね」",
        takeCoin: "銀貨を取る",
        leaveCoin: "やめておく",
        // Choice 1 Texts
        desc1: "カインが銀貨に手を伸ばした瞬間、固まっていたはずの琥珀がぐにゃりと歪んだ。中から、黒ずんだ遺体の腕がしなやかに伸びる。それはカインを道連れにするように、重く、その背を抱きしめた。",
        owen1: "オーエン：「へえ、愛されてるね。チップの代わりに抱いて欲しいんだって」",
        cain1: "カイン：「……っ、生きているのか……！？ くそッ！」",
        trans1: "バキバキバキバキッ。ぐちゃ、べちゃべちゃ。その音と共に幹の瘤が裂け、熱い樹液が溢れ出した。粘液の束が、カインを飲み込もうと四方から一斉に逆立つ。",
        // Choice 2 Texts
        cain2_1: "カイン「…いや、やめておこう」",
        owen2: "オーエン「ふふ、そうだね。良い子面の騎士様には可哀想な遺体から宝物を奪うなんてできないよね？」",
        action2: "そう言うとオーエンは無造作に、琥珀に埋まっている銀貨に手を伸ばした。ぐにゃり、とうねった樹液がオーエンの首に向かって伸びる。",
        cain2_2: "カイン「オーエン！」",
        finish2: "カインの剣が、琥珀の触手を弾き飛ばした。オーエンはたのしそうに笑った。"
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

    // Owen's Idle Phrases (傍観)
    owenIdlePhrases: [
        "オーエンは目を細めて見ている",
        "オーエンはつまらなそうに爪をいじっている",
        "オーエンは靴の汚れを気にしている",
        "オーエン「そんな雑魚早く片付けて」"
    ]
};

// Duel Data removed in Build 15.0.0


// イベントデータ
RPG.Assets.EVENT_DATA = [
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
    // Post-Tree Fatigue Event
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
            state.postTreeBattles = "DONE"; // Permanently disable counter
        }
    },
    // 9m Scream Event (Thief Boy Rescue - Part 1)
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
                { text: "カイン「あっちの方からだ！行くぞ！」", delay: 1200 },
                {
                    text: null,
                    delay: 0,
                    action: () => {
                        console.log("DEBUG: 9m Scream Event Finished. Setting heardScream = true.");
                        state.flags.heardScream = true;
                        uiControl.updateUI();
                    }
                }
            ];
            state.completedEvents.push("thief_rescue_9m_scream");
        }
    },
    // 10m Rescue Event (Thief Boy Rescue - Part 2)
    {
        id: "thief_rescue_10m_battle",
        repeatable: true, // Build 14.1.6: Allow retry until victory
        condition: (state) => state.currentDistance === 10 && state.flags.thiefDiscoveryStatus === 1 && !state.flags.giantLarvaDefeated,
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
                        battleSystem.startBattle("giant_larva");
                    }
                },
                { text: "少年と異形の間に、黒い外套が割って入る。カインは抜いたばかりの剣の腹で、そのヌメリを帯びた巨躯を強引に弾いた。", delay: 2000 }
            ];
            // Removed manual push to completedEvents
        }
    },
    // Mid-Boss Outro "The Bitter Reward"
    {
        id: "thief_rescue_victory",
        condition: (state) => false, // Triggered manually by battle logic
        action: (state) => {
            // Boss aftermath rule:
            // This event handles giant_larva-specific aftermath only.
            // Generic victory text is emitted in battleSystem.executeStandardVictory().
            if (RPG.State.storyPhase < 5) {
                RPG.State.storyPhase = 5;
            }
            const dialogue = [
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
                        RPG.State.silverCoins = 3;
                        if (RPG.State.inventory.silverCoin !== undefined) {
                            RPG.State.inventory.silverCoin = 3;
                        }
                        uiControl.updateUI();
                    }
                },
                { text: "カイン「……う…っ」", type: "talk" },
                {
                    text: null, // Silent action
                    action: () => {
                        RPG.State.currentHP = Math.max(1, RPG.State.currentHP - 2);
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
                        RPG.State.inventory.herb = (RPG.State.inventory.herb || 0) + 1;
                        uiControl.updateUI();
                    }
                },
                { text: "オーエン「置いてくよ」", type: "talk", color: "#a020f0" },
                { text: "カインはなんとか気力を振り絞って立ち上がった。" },
                {
                    text: "《さあ、宿屋に戻って銀貨を納品しよう。》",
                    type: "system",
                    color: "#cccccc",
                    action: () => {
                        // Mark the thief-boy route as resolved so old hooks stop firing
                        RPG.State.flags.thiefTrackActive = false;
                        RPG.State.flags.readyForThiefBoy = false;
                        RPG.State.flags.hasSleptAfterThief = false;
                        RPG.State.flags.thiefDiscoveryStatus = 2;
                        uiControl.updateUI();
                    }
                }
            ];

            // Start the tap-to-advance dialogue sequence
            uiControl.startDialogueSequence(dialogue);
        }
    },
    // --- Build 14.2.1: Chapter 1 Finale - Wagon Event ---
    {
        id: "finale_wagon_encounter",
        repeatable: true, // Allow re-triggering until player boards
        condition: (state) => state.storyPhase === 7 && state.currentDistance === 2 && !state.flags.onWagon,
        action: (state) => {
            state.dialogueQueue = [
                { text: "御者「…何か用か？」", delay: 1500 },
                { text: "カイン「怪しいものじゃない。もしかして…乗せてもらえないだろうか？」", delay: 1800 },
                { text: "御者「…そうだな。あんた剣士か？腕が立ちそうだし、街道を出るまで魔物から守ってくれるならいいぜ。」", delay: 2000 },
                { text: "カイン「もちろんさ！」", delay: 1200 },
                { text: "御者「よかった。森が抜けられなくて困ってたんだ。そこかしこに魔物がいやがる。」", delay: 1800 },
                { text: "荷馬車に乗りますか？ ※宿屋には戻れなくなります", delay: 1500, color: "#ff4d4d" },
                {
                    text: null,
                    delay: 0,
                    action: () => {
                        // Show choice buttons
                        state.mode = "choice";
                        uiControl.showWagonChoice();
                    }
                }
            ];
            // Do NOT add to completedEvents - let onWagon flag control this
        }
    },
    // --- Build 14.2.2: Former Highway Events ---
    {
        id: "highway_1m_entry",
        condition: (state) => state.location === "かつての街道" && state.currentDistance === 1 && !state.completedEvents.includes("highway_1m_entry"),
        action: (state) => {
            state.dialogueQueue = [
                { text: "木々の間を抜けると、そこからは急に石畳だった。等間隔で並んだ樹木は琥珀に侵食され、月明かりを反射している歪な街灯のようだ。", delay: 2500 },
                { text: "石畳のあちらこちらに、ざわざわと蠢く黒い影。", delay: 1800 },
                { text: "御者「うう、恐ろしい雰囲気だ…。」", delay: 1500 },
                { text: "カイン「確かに…。魔界はこんな感じなんだろうか」", delay: 1500 },
                { text: "オーエン「は？全然違うよ」", delay: 1200, color: "#a020f0" },
                { text: "傍には荷車の残骸。そして、馬の骨がまるまる一体分、落ちている。", delay: 2000 },
                { text: "御者「あんたらがいてよかった。前に通ったやつはこうなっちまったんだな」", delay: 2000 },
                { text: "カイン「気を引き締めて行こう」", delay: 1500 },
                { text: "(怯える馬を、カインが宥めながら走る。)", delay: 1800, color: "#888888" }
            ];
            state.completedEvents.push("highway_1m_entry");
        }
    },
    {
        id: "highway_2m_rats_intro",
        condition: (state) => state.location === "かつての街道" && state.currentDistance === 2 && !state.completedEvents.includes("highway_2m_rats_intro"),
        action: (state) => {
            state.dialogueQueue = [
                { text: "石畳の隙間に溜まった琥珀の粉塵が、車輪に弾かれて舞い上がる。", delay: 1800 },
                { text: "カイン「！」", delay: 800 },
                { text: "御者「なんだあれ…」", delay: 1200 },
                { text: "(黒い影がどんどんこちらに向かってくる。ざわ、ざわわ…)", delay: 1800, color: "#888888" },
                { text: "オーエン「まあ、あれはちょっと魔界っぽいかな」", delay: 1500, color: "#a020f0" },
                {
                    text: null,
                    delay: 0,
                    action: () => {
                        battleSystem.startBattle('hell_rat_swarm');
                    }
                }
            ];
            state.completedEvents.push("highway_2m_rats_intro");
        }
    },
    {
        id: "highway_2m_rats_interlude",
        condition: (state) => state.location === "かつての街道" && state.currentDistance === 2 && state.highwayBattleCount[2] === 1 && !state.completedEvents.includes("highway_2m_rats_interlude"),
        action: (state) => {
            state.dialogueQueue = [
                { text: "カイン「あの黒い影、全部ネズミか…！？」", delay: 1500 },
                { text: "オーエン「夜は群れるんだよ。馬でも虎でも食い尽くす」", delay: 1800, color: "#a020f0" },
                { text: "カイン「嘘だろ…範囲攻撃が欲しいな」", delay: 1500 },
                { text: "オーエン「ほら、ここにも、チューチュー。ご立派な剣でちまちま切り刻んでね？」", delay: 2000, color: "#a020f0" },
                {
                    text: null,
                    delay: 0,
                    action: () => {
                        battleSystem.startBattle('hell_rat_swarm');
                    }
                }
            ];
            state.completedEvents.push("highway_2m_rats_interlude");
        }
    },
    {
        id: "highway_3m_ambient",
        condition: (state) => state.location === "かつての街道" && state.currentDistance === 3 && !state.completedEvents.includes("highway_3m_ambient"),
        action: (state) => {
            uiControl.addLog("荷台にまで乗ったネズミの死骸を、オーエンは靴の先で蹴り落とした。ガァ！ガァ！カラスが騒いでいる。", "ambient");
            state.completedEvents.push("highway_3m_ambient");
        }
    },
    {
        id: "highway_4m_crows_intro",
        condition: (state) => state.location === "かつての街道" && state.currentDistance === 4 && !state.completedEvents.includes("highway_4m_crows_intro"),
        action: (state) => {
            state.mode = "event";
            state.dialogueQueue = [
                {
                    text: null,
                    delay: 0,
                    action: () => {
                        battleSystem.startBattle('eye_eating_crow');
                    }
                }
            ];
            state.completedEvents.push("highway_4m_crows_intro");
        }
    },
    {
        id: "highway_4m_crows_interlude",
        condition: (state) => state.location === "かつての街道" && state.currentDistance === 4 && state.highwayBattleCount[4] === 1 && !state.completedEvents.includes("highway_4m_crows_interlude"),
        action: (state) => {
            state.dialogueQueue = [
                { text: "カイン「くそ、ネズミは下から、カラスは上から！」", delay: 1500 },
                { text: "オーエン「前からと後ろからも来てるよ。ほら。」", delay: 1500, color: "#a020f0" },
                { text: "カイン「ああもう…っまた！」", delay: 1200 },
                {
                    text: null,
                    delay: 0,
                    action: () => {
                        battleSystem.startBattle('eye_eating_crow');
                    }
                }
            ];
            state.completedEvents.push("highway_4m_crows_interlude");
        }
    },
    {
        id: "highway_4m_crows_outro",
        condition: (state) => state.location === "かつての街道" && state.currentDistance === 4 && state.highwayBattleCount[4] === 2 && !state.completedEvents.includes("highway_4m_crows_outro"),
        action: (state) => {
            state.dialogueQueue = [
                { text: "カイン「こいつら…っ、こっちの目ばっかり狙ってくる」", delay: 1500 },
                { text: "オーエン「その目玉甘そうだもの。蜂蜜みたいで」", delay: 1800, color: "#a020f0" },
                { text: "カイン「おまえは狙われないんだな…」", delay: 1500 },
                { text: "オーエン「僕の目玉を狙うような身の程知らずは滅多にいないからね」", delay: 2000, color: "#a020f0" },
                { text: "カイン「…………」", delay: 1200 }
            ];
            state.completedEvents.push("highway_4m_crows_outro");
        }
    },
    {
        id: "highway_5m_ambient",
        condition: (state) => state.location === "かつての街道" && state.currentDistance === 5 && !state.completedEvents.includes("highway_5m_ambient"),
        action: (state) => {
            uiControl.addLog("暗い空をさらに黒いカラスの群れが飛び交っている。", "ambient");
            state.completedEvents.push("highway_5m_ambient");
        }
    },
    {
        id: "highway_7m_goal_dialogue",
        condition: (state) => state.location === "かつての街道" && state.currentDistance === 7 && !state.completedEvents.includes("highway_7m_goal_dialogue"),
        action: (state) => {
            state.dialogueQueue = [
                { text: "カイン「オーエン、門の場所はわかるか？」", delay: 1500 },
                { text: "オーエン「…たぶん北だけど。聞いてどうするの？」", delay: 1800, color: "#a020f0" },
                { text: "カイン「見に行こう」", delay: 1200 },
                { text: "オーエン「は？…観光気分？門に名前でも書きにいくの？」", delay: 2000, color: "#a020f0" },
                { text: "カイン「道中、魔物を少しでも倒しながら、門まで様子を見に行ってそこで俺たちに何かできることがないか考えよう」", delay: 2500 },
                { text: "オーエン「…僕を含めるなよ。」", delay: 1500, color: "#a020f0" }
            ];
            state.completedEvents.push("highway_7m_goal_dialogue");
        }
    },
    {
        id: "highway_8m_escalation",
        condition: (state) => state.location === "かつての街道" && state.currentDistance === 8 && !state.completedEvents.includes("highway_8m_escalation"),
        action: (state) => {
            state.dialogueQueue = [
                { text: "街道を覆う琥珀の侵食がひどくなっている。石畳は隆起し、馬車は今にもひっくり返りそうなほど左右に激しく傾いた。", delay: 2500 },
                {
                    text: null,
                    delay: 0,
                    action: () => {
                        battleSystem.startBattle('hell_rat_swarm');
                    }
                }
            ];
            state.completedEvents.push("highway_8m_escalation");
        }
    },
    {
        id: "highway_9m_boss_intro",
        condition: (state) => state.location === "かつての街道" && state.currentDistance === 9 && !state.completedEvents.includes("highway_9m_boss_intro"),
        action: (state) => {
            state.dialogueQueue = [
                { text: "馬たちが怯えて足並みが乱れる。御者「おっと…！どうどう、しっかりしろおまえたち」", delay: 2000 },
                { text: "カイン「…この先、なんか嫌な予感がするな」", delay: 1500 },
                { text: "オーエン「上からかな？下からかな？」", delay: 1500, color: "#a020f0" },
                { text: "(ト書き: オーエンはゆったりと足を組んで座っている。)", delay: 1500, color: "#888888" }
            ];
            state.completedEvents.push("highway_9m_boss_intro");
        }
    },
    {
        id: "highway_10m_boss_arrival",
        condition: (state) => state.location === "かつての街道" && state.currentDistance === 10 && !state.completedEvents.includes("highway_10m_boss_arrival"),
        action: (state) => {
            state.dialogueQueue = [
                { text: "等間隔に並んだ琥珀街路樹の列が、ついに途切れる。", delay: 2000 },
                { text: "頭上を覆っていた琥珀の枝葉が消え、狭かった空が、唐突にその広さを取り戻した。", delay: 2500 },
                { text: "その時。", delay: 1000 },
                { text: "ブンッ！", delay: 800 },
                { text: "凄まじい羽音がした。", delay: 1500 },
                { text: "カイン「上か！？」", delay: 1200 },
                { text: "見上げた先。", delay: 1500 },
                { text: "満月を背に輝く琥珀色の巨大な——。", delay: 2000 },
                { text: "鋭利な鎌を月光に濡らし、異形が急降下してくる。ギチギチとその口を鳴らせて。", delay: 2500 },
                { text: "カイン「来るぞ！」", delay: 1200 },
                {
                    text: null,
                    delay: 0,
                    action: () => {
                        battleSystem.startBattle('amber_husk_giant_larva');
                    }
                }
            ];
            state.completedEvents.push("highway_10m_boss_arrival");
        }
    },
    {
        id: "amber_husk_giant_larva_victory",
        condition: (state) => false,
        action: (state) => {
            // Boss aftermath rule:
            // This event starts after executeStandardVictory() has already shown the shared victory text.
            RPG.State.dialogueQueue = [
                { text: "荷馬車は大きな交易路に出た。" },
                { text: "月が明るい。" },
                { text: "カインはドロドロになった剣を鞘に収めてため息をついた。" },
                { text: "カイン「あそこまでデカいと切った手答えがあって嫌だな…ぐしゃって」" },
                { text: "オーエン「虫の体液かかってるよ」", color: "#a020f0" },
                { text: "カイン「宿屋に戻って風呂に入りたいな」" },
                { text: "オーエン「宿屋の娘がよろこぶよ。背中流してくれるんじゃない？」", color: "#a020f0" },
                { text: "カイン「うーん、あんまりもう戻りたくないな。せっかく次の街に行けるんだ。銀貨もあるしさ。」" },
                { text: "御者「それで？どこに行くんですか？」" },
                { text: "カイン「北に」" },
                { text: "オーエン「ケーキ屋。」", color: "#a020f0" },
                { text: "カイン「…北にケーキ屋はあるか？」" },
                { text: "オーエン「あるわけない」", color: "#a020f0" },
                { text: "カイン「なんで知ってるんだ？」" },
                { text: "オーエン「……どうだっていいだろ」", color: "#a020f0" },
                { text: "カイン「まあいいか。」" },
                { text: "カイン「じゃあ、ケーキ屋に寄ってから、北だ！」" },
                {
                    text: null,
                    action: () => {
                        Cinematics.sceneTransition("第1章クリア");
                    }
                }
            ];
            explorationSystem.playDialogueLoop();
        }
    },
    // --- Build 14.1.7: Cheerful Return Events ---
    // --- Build 14.2.3: Amber Tree Victory Event ---
    {
        id: "amber_tree_victory",
        condition: (state) => false, // Triggered manually
        action: (state) => {
            // Boss aftermath rule:
            // Keep this event focused on hungry_amber_tree aftermath and follow-up dialogue only.
            // Do not add another generic "飢えた琥珀樹を倒した！" line here.
            RPG.State.flags.treeDefeated = true;
            RPG.State.flags.isTreeRematch = false;
            RPG.State.flags.hasTreeEventOccurred = true;
            if (RPG.State.storyPhase < 2) {
                RPG.State.storyPhase = 2;
            }
            RPG.State.postTreeBattles = 0;

            const dialogue = [
                { text: "―― 勝利！ ――", type: "marker", color: "#ffff00" },
                { text: "樹の枝が静まり返った…", type: "talk" },
                { text: "カインは深く息をついた。", type: "talk" }
            ];

            if (!RPG.State.flags.treeVictoryTalkDone) {
                dialogue.push(
                    { text: "カインは剣先で銀貨を抉り出した。", type: "talk" },
                    { text: "カイン「悪いな、ちょっと貸してくれ。」", type: "talk" },
                    {
                        text: "🪙銀貨を手に入れた！",
                        type: "system",
                        color: "#FFD700",
                        action: () => {
                            RPG.State.silverCoins += 1;
                            RPG.State.inventory.silverCoin += 1;
                            uiControl.updateUI();
                        }
                    },
                    { text: "オーエン「僕の目玉もそうやって抉ったよね」", type: "talk", color: "#a020f0" },
                    { text: "カイン「それは…！」", type: "talk" },
                    { text: "オーエン｢痛かった。貸してくれとも言わなかったし」", type: "talk", color: "#a020f0" },
                    { text: "カイン｢返すつもりがなかったから、言わなかった。奪うつもりで抉った。」", type: "talk" },
                    { text: "オーエン｢へえ？正直だね」", type: "talk", color: "#a020f0" },
                    { text: "カイン｢後悔するくらいなら、最初からそんなことやらないさ。俺のことを憎むなり殺すなり好きにすればいい」", type: "talk" },
                    { text: "オーエン｢……ふうん」", type: "talk", color: "#a020f0" },
                    { text: "カイン｢……銀貨はあと一枚か。もう少し森を探してみよう」", type: "talk" },
                    { text: "オーエン｢気前のいい死体を？」", type: "talk", color: "#a020f0" },
                    { text: "カイン｢銀貨を、だな」", type: "talk" },
                    {
                        text: "もう少しだけ森を歩いてみよう。",
                        type: "system",
                        color: "#cccccc",
                        action: () => {
                            RPG.State.flags.treeVictoryTalkDone = true;
                            RPG.State.mode = "base";
                            RPG.State.isBattling = false;
                            RPG.State.currentEnemy = null;
                            RPG.State.battleState = null;
                            uiControl.updateUI();
                        }
                    }
                );
            } else {
                dialogue.push({
                    text: "《さあ、先へ進むか、一度戻って体制を整えよう。》",
                    type: "system",
                    color: "#cccccc",
                    action: () => {
                        RPG.State.mode = "base";
                        RPG.State.isBattling = false;
                        RPG.State.currentEnemy = null;
                        RPG.State.battleState = null;
                        uiControl.updateUI();
                    }
                });
            }
            uiControl.startDialogueSequence(dialogue);
        }
    },
    {
        id: "return_trip_8m_rummage",
        condition: (state) => state.currentDistance === 8 && state.inventory.silverCoin === 3 && !state.flags.silverDelivered && !state.completedEvents.includes("return_trip_8m_rummage"),
        action: (state) => {
            uiControl.addLog("オーエンは革袋の中を漁っている…");
            state.completedEvents.push("return_trip_8m_rummage");
        }
    },
    {
        id: "return_trip_7m_sweets",
        condition: (state) => state.currentDistance === 7 && state.inventory.silverCoin === 3 && !state.flags.silverDelivered && !state.completedEvents.includes("return_trip_7m_sweets"),
        action: (state) => {
            state.dialogueQueue = [
                { text: "オーエン「お菓子もある。やった。」", delay: 1000, color: "#a020f0" },
                { text: "カイン「虫の腹の中のお菓子、食うのか？」", delay: 1000 },
                { text: "オーエン「おまえだって虫の腹の中の草食べてるだろ」", delay: 1000, color: "#a020f0" },
                { text: "カイン「…たしかに」", delay: 1000 }
            ];
            state.completedEvents.push("return_trip_7m_sweets");
        }
    },
    {
        id: "return_trip_5m_walking",
        condition: (state) => state.currentDistance === 5 && state.inventory.silverCoin === 3 && !state.flags.silverDelivered && !state.completedEvents.includes("return_trip_5m_walking"),
        action: (state) => {
            uiControl.addLog("オーエンは、我が物顔で、お菓子を食べながら森を歩いている。その背中をなんども見失いそうになりながらカインはついていった。");
            state.completedEvents.push("return_trip_5m_walking");
        }
    }
];

// バトルイベントデータ
RPG.Assets.BATTLE_EVENTS = {
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
    },
    hell_rat_swarm: {
        1: [
            { text: "カイン「あの黒い影、全部ネズミか…！？」", delay: 2000 },
            { text: "オーエン「夜は群れるんだよ。馬でも虎でも食い尽くす」", delay: 2000, color: "#a333c8" },
            { text: "カイン「嘘だろ…範囲攻撃が欲しいな」", delay: 2000 },
            { text: "オーエン「ほら、ここにも、チューチュー。ご立派な剣でちまちま切り刻んでね？」", delay: 2000, color: "#a333c8" },
            {
                text: null,
                action: () => {
                    if (RPG.State.location === "かつての街道" && RPG.State.currentDistance === 2) {
                        battleSystem.startBattle('hell_rat_swarm');
                    }
                }
            }
        ]
    },
    eye_eating_crow: {
        1: [
            { text: "カイン「くそ、ネズミは下から、カラスは上から！」", delay: 2000 },
            { text: "オーエン「前からと後ろからが物足りない？」", delay: 2000, color: "#a333c8" },
            { text: "カイン「ああもう…っまた！」", delay: 2000 },
            {
                text: null,
                action: () => {
                    if (RPG.State.location === "かつての街道" && RPG.State.currentDistance === 4) {
                        battleSystem.startBattle('eye_eating_crow');
                    }
                }
            }
        ],
        2: [
            { text: "カイン「こいつら…っ、目玉ばっかり狙ってくる」", delay: 2000 },
            { text: "オーエン「おまえと同じ趣味だね」", delay: 2000, color: "#a333c8" },
            { text: "カイン「……趣味だったわけでは」", delay: 2000 },
            { text: "オーエン「おまえの目玉、美味しそうなんじゃない？蜂蜜色で」", delay: 2000, color: "#a333c8" },
            { text: "カイン「おまえだって片目は同じなのに狙われないんだな…」", delay: 2000 }
        ]
    },
    inn_rat_event2: {
        1: [
            { text: "店主「あれが森に出るって噂の化け物か…。あんたらがいてくれて助かったよ…」", delay: 2000 },
            { text: "オーエン「夜だったら面白かったのに」", delay: 2000, color: "#a333c8" },
            { text: "娘「え？」", delay: 2000 },
            { text: "オーエン「今頃おまえたちみんな骨になってる。」", delay: 2000, color: "#a333c8" },
            { text: "カイン「無事でよかった！…建物まで入ってくるのか。本当に、なんとかしないとな」", delay: 2000 },
            { text: "店主「お礼と言ってはなんだが、ハーブソーセージでも食べてくれ」", delay: 2000 },
            { text: "カイン「やった！あれうまそうだと思ってたんだ」", delay: 2000 },
            { text: "カインはソーセージを食べてビールを飲んだ。", delay: 2000 },
            { text: "オーエン「…本当においしいの？それ」", delay: 2000, color: "#a333c8" },
            { text: "カイン「食うか？」", delay: 2000 },
            { text: "カインはオーエンに一口ソーセージを齧らせた！", delay: 2000 },
            { text: "オーエン「…まずい。血の味がしない」", delay: 2000, color: "#a333c8" },
            { text: "カイン「そういうソーセージなんだ。」", delay: 2000 }
        ]
    },
    normal_rat: {
        1: [
            { text: "カイン「思わず倒しちまったが…普通のネズミだな」", delay: 2000 },
            { text: "娘「ありがとうございます！」", delay: 2000 },
            { text: "カイン「そんなお礼を言われるほどのものじゃないさ」", delay: 2000 },
            { text: "オーエン「ただのネズミ相手に、聖剣を抜く騎士様かっこよかったよ」", delay: 2000, color: "#a333c8" },
            { text: "カイン（馬鹿にされてるのはわかる）", delay: 2000 },
            { text: "店主はネズミの死体を拾った。", delay: 2000 },
            { text: "店主「食えなくはないが…」", delay: 2000 },
            { text: "娘「やめましょうよ」", delay: 2000 },
            { text: "カイン「オーエン、食えるか？」", delay: 2000 },
            { text: "オーエン「おまえが殺したんだからおまえの獲物だよ。食べていいよ。」", delay: 2000, color: "#a333c8" },
            { text: "カイン「………」", delay: 2000 },
            { text: "カインはネズミを食べなかった！", delay: 2000 }
        ]
    }
};

// 会話データ
RPG.Assets.TALK_DATA = {
    innTalk: {
        sharedLoop05: [
            "店主「とにかく銀貨三枚を早く持ってきてくれ。」",
            "店主「部屋はないぞ。馬小屋か物置だな」",
            "店主「飯が食いたいならなんか取ってきてくれ」",
            "店主「ほら、どいたどいた」"
        ],
        phases: {
            0: {
                entries: [
                    [
                        "店主「最近、森に銀貨が落ちてるって噂がある。銅貨じゃなくて銀貨がだぜ？…気になっててよお。見てきてくれねえか」",
                        "カイン「そいつはすごいが…それなら、みんな森に殺到するんじゃないか？」",
                        "店主「森の中は魔物だらけさ。銀貨のなる木でもあるなら大もうけだな！ガハハ」"
                    ],
                    [
                        "店主「この辺りも、魔王たちのせいでめちゃくちゃだ。」",
                        "オーエン「魔王たちって？」",
                        "店主「オズと、フィガロだよ。」",
                        "オーエン「ああ…言っちゃったね。あの2人は名前出すと聞いてるかもよ？」",
                        "店主「おお…っ恐ろしいことを！」",
                        "オーエン「呪い殺されるかもね。可哀想。」",
                        "カイン「ジョークなんだ。気にしないでくれ」"
                    ],
                    [
                        "看板娘「琥珀の森は危険です。最近戻ってこない方も多くて…。くれぐれもお気をつけて」",
                        "カイン「わかった。気を引き締めるよ」",
                        "娘「…カイン様はお強そうだから大丈夫だとは思いますが。」",
                        "娘「これをどうぞ」",
                        "薬草を手に入れた！",
                        "カイン「…ありがとう。」",
                        "カイン（強そうに見えているんだな…）"
                    ]
                ]
            },
            1: {
                entries: [
                    [
                        "オーエン「甘いもの頂戴。」",
                        "オーエンがカインのポケットに手を突っ込み、銀貨を取り戻そうとする",
                        "カイン「うわ！？頂戴、じゃない！」",
                        "カインはポケットの上からオーエンの手を押さえた。"
                    ],
                    [
                        "店主「甘いものはもうない。なんならあんたらが仕入れてきてくれ」",
                        "カイン「甘いものは、どこで手に入るんだ？」",
                        "店主「砂糖は大都市に全部持ってかれちまう」",
                        "オーエン「大都市をめちゃくちゃにしたらたくさん食べれる？」",
                        "カイン「こら」"
                    ],
                    [
                        "娘「お二人とも、珍しい目の色ですね。ご兄弟ですか？」",
                        "オーエン「そうだよ。僕がお兄ちゃん。」",
                        "カイン「…というのは冗談でさ」",
                        "オーエン「何。まさか本当の関係をこんなところで暴露したいの？…いいよ？言ってごらんおまえの口から」",
                        "カイン「………」",
                        "娘「すいません、込み入ったことをお聞きしてしまって…」",
                        "娘は気まずそうに目を逸らした"
                    ]
                ]
            },
            2: {
                entries: [
                    [
                        "店主「あんた、王国から来たのか？ニコラス団長を知ってるか？」",
                        "カイン「ああ、ニコラス団長の知り合いなのか？」",
                        "店主「ニコラス団長は前にこの村に立ち寄ったことがあるんだ。握手してもらった。」"
                    ],
                    [
                        "店主「王都もメチャクチャになったとかいう噂をきいた。ニコラス団長もどうなったのかわからないが…」",
                        "カイン「ニコラス団長は無事だ。」",
                        "店主「おお、アーサー殿下は？」",
                        "カイン「ご無事だ。」",
                        "オーエン「どうかな？今頃オズに攫われてるかも。王子の肉はどんな味だろうね」",
                        "カイン「…そういう冗談は好きじゃない」"
                    ]
                ]
            },
            3: {
                entries: [
                    [
                        "店主「前から思ってたんだが…そっちの兄ちゃんは、いつも傷一つねえな。あんたばっかり怪我してる」",
                        "オーエン「当たり前でしょ」",
                        "店主「カインはあんたの護衛なのか？」",
                        "オーエン「そんなわけない。僕の方が遥かに強いのに」",
                        "カイン「…そうだな。守ってる」",
                        "オーエン「…ふうん？」",
                        "カイン（目を離すわけにはいかない）"
                    ]
                ]
            },
            4: {
                entries: [
                    [
                        "カイン「銀貨2枚までは集めたんだが、盗まれてしまった。」",
                        "店主「最近手癖の悪いやつが増えてな。気の毒だが、銀貨はまけてやれない。」",
                        "オーエン「だから僕に預けておけばよかったのに」",
                        "カイン「次は油断しないさ」"
                    ]
                ]
            },
            5: {
                entries: [
                    [
                        "娘「おかえりなさい。あの、大丈夫ですか…？ボロボロですが。」",
                        "カイン「すまない、汚いよな。返り血やら体液やら、虫の。」",
                        "オーエン「ここで脱ぐなよ」",
                        "カイン「コートだけだ」"
                    ],
                    [
                        "カイン「銀貨を見つけてきた。」",
                        "店主「本当か！？銀貨のなる木は？」",
                        "オーエン「あったね。」",
                        "カイン「…まあ、あったと言えなくはないか？」",
                        "店主「見たかったなぁ」",
                        "カイン「恐ろしい化物だった。不用意に森に入らない方がいい。」"
                    ]
                ]
            },
            6: {
                entries: [
                    [
                        "娘「カイン様、お湯の用意があります。今なら空いていますよ。」",
                        "カイン「助かる！川は好きだが、ちょっと寒くてさ」",
                        "オーエン「おまえの水浴び、犬みたいだもんね」",
                        "カイン（そんなふうに思われてたんだ…）"
                    ],
                    [
                        "テーブルに座ると、固いパンとスープ、干し肉の食事が出てきた。",
                        "カイン「このキノコのスープは出汁が出ててうまいな」",
                        "娘「あの、お連れの方はあまりお腹が空いてないのでしょうか？」",
                        "オーエン「空いてるよ？…空いてる。」",
                        "オーエンがカインを睨みつける",
                        "カイン「…特殊体質なんだ。」",
                        "オーエン「そろそろ無理かも」",
                        "カイン「もう少し、我慢してくれ」",
                        "娘「？」"
                    ]
                ],
                loop: [
                    "店主「ゆっくり休んでくれ。」"
                ]
            },
            7: {
                entries: [
                    [
                        "店主「森の向こうには昔、街道があったんだ。その先は西の方の大きな町まで交易路が続いてる。…続いてた。」",
                        "カイン「だがみんなここで足止めされてるのは？」",
                        "店主「前の荷馬車も、その前の荷馬車も、誰も森から戻ってこない。余程たちの悪いやつがいるのか、なんなのか。」"
                    ],
                    [
                        "娘「もう出発されるのですか？…せっかくちゃんとした部屋をご用意できたのに。もう少しゆっくり休まれては？」",
                        "カイン「ありがとな。けどもう行くよ。」",
                        "娘「……カイン様がいらっしゃらなくなると寂しくなります」"
                    ],
                    [
                        "娘「あの、これを！」",
                        "お守り袋🧧をもらった！",
                        "カイン「ありがとう！」",
                        "娘「父には内緒にしてください。ご武運を」"
                    ]
                ],
                loop: [
                    "娘はずっと見送っている。"
                ]
            }
        }
    }
};

// 宿屋イベントデータ
RPG.Assets.INN_EVENTS = [
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

// ロケーションデータ
RPG.Assets.LOCATIONS = {
    0: { name: "琥珀の森入り口", hasTarget: false, desc: "ここから先が琥珀の森だ。" },
    1: { name: "琥珀の森", hasTarget: false, desc: "鳥の鳴き声が聞こえる…" },
    7: { name: "森の深層", hasTarget: true, desc: "空気が湿ってきた…" }
};


// Legacy Support Shim
window.CONFIG = RPG.Assets.CONFIG;
window.GAME_TEXT = RPG.Assets.GAME_TEXT;
window.AMBIENT_TEXTS = RPG.Assets.AMBIENT_TEXTS;
window.DUEL_DATA = RPG.Assets.DUEL_DATA;
window.EVENT_DATA = RPG.Assets.EVENT_DATA;
window.BATTLE_EVENTS = RPG.Assets.BATTLE_EVENTS;
window.TALK_DATA = RPG.Assets.TALK_DATA;
window.INN_EVENTS = RPG.Assets.INN_EVENTS;
window.LOCATIONS = RPG.Assets.LOCATIONS;

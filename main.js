// 🚩ーー【UI表示・更新処理】ーー
// Build 8.13: UI control functions moved to uiControl.js
// See uiControl.js for: addLog, updateUI, updateControlPanels, getLocData, openModal, selectItem, closeModal



// 🚩ーー【Build 8.3: Debug System】ーー
const debugSystem = {
    spawnGlowingCatRabbit: function () {
        if (RPG.State.isBattling) {
            uiControl.addLog("すでに戦闘中だ。", "ambient");
            return;
        }

        battleSystem.startBattle('glowing_cat_rabbit');
    },
};

// Development-only, URL-gated battle presets.  This stays outside RPG.State so a
// debug battle never becomes part of a journal or suspend record.
const debugBattlePresets = {
    active: false,
    selectedPresetId: null,
    selectedAmberId: null,
    presets: [
        { id: "hungry_amber_tree", label: "Lv5《飢えた琥珀樹》", enemyId: "hungry_amber_tree", level: 5, fireproofGloves: 0 },
        { id: "giant_larva", label: "Lv8《泥這う大幼蟲》", enemyId: "giant_larva", level: 8, fireproofGloves: 0 },
        { id: "skull_bee", label: "Lv8《ドクロ蜂》", enemyId: "skull_bee", level: 8, fireproofGloves: 1 },
        { id: "carnivorous_vine", label: "Lv8《肉食カズラ》", enemyId: "carnivorous_vine", level: 8, fireproofGloves: 1 },
        { id: "amber_burning_root", label: "Lv9《燃える琥珀樹の根》", enemyId: "amber_burning_root", level: 9, fireproofGloves: 1 },
        { id: "hell_rat_swarm", label: "Lv10《魔界のネズミ《群》》", enemyId: "hell_rat_swarm", level: 10, fireproofGloves: 1 },
        { id: "eye_eating_crow", label: "Lv10《目食いカラス》", enemyId: "eye_eating_crow", level: 10, fireproofGloves: 1 },
        { id: "amber_husk_giant_larva", label: "Lv10《琥珀骸の巨虫》", enemyId: "amber_husk_giant_larva", level: 10, fireproofGloves: 1 },
        { id: "amber_husk_giant_larva_lv12", label: "Lv12《琥珀骸の巨虫》", enemyId: "amber_husk_giant_larva", level: 12, fireproofGloves: 1 }
    ],

    isActive: function () {
        return this.active === true;
    },

    getSelectedPreset: function () {
        return this.presets.find(preset => preset.id === this.selectedPresetId) || null;
    },

    replaceTemporaryState: function () {
        const freshState = JSON.parse(JSON.stringify(RPG.DefaultState));
        Object.keys(RPG.State).forEach(key => delete RPG.State[key]);
        Object.assign(RPG.State, freshState);
    },

    clearLog: function () {
        const log = document.getElementById("logContainer");
        if (log) log.innerHTML = "";
    },

    hideNormalControls: function () {
        ["exploreUI", "innUI", "choiceUI", "btnStartBattle"].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = "none";
        });
    },

    renderActions: function (actions) {
        const container = document.getElementById("action-buttons");
        if (!container) return;

        container.innerHTML = "";
        container.style.display = "flex";
        actions.forEach(action => {
            const button = document.createElement("button");
            button.id = action.id;
            button.className = "btn btn-full";
            button.textContent = action.label;
            button.onclick = action.onClick;
            container.appendChild(button);
        });
    },

    getLevelStats: function (level) {
        const base = RPG.DefaultState;
        const gainedLevels = Math.max(0, level - base.cainLv);
        // These are the same +10 HP / +2 ATK increments used by battle.js at level-up.
        return {
            maxHP: base.maxHP + gainedLevels * 10,
            attack: base.attack + gainedLevels * 2
        };
    },

    applySelectedPreset: function () {
        const preset = this.getSelectedPreset();
        if (!preset) return false;

        this.replaceTemporaryState();
        const stats = this.getLevelStats(preset.level);
        Object.assign(RPG.State, {
            mode: "base",
            location: "デバッグ戦闘プリセット",
            isAtInn: false,
            isInDungeon: false,
            explorationArea: null,
            currentDistance: 0,
            cainLv: preset.level,
            maxHP: stats.maxHP,
            currentHP: stats.maxHP,
            attack: stats.attack,
            defense: 0,
            exp: 0,
            mood: RPG.DefaultState.mood,
            isPoisoned: false,
            poisonDamageRemaining: 0,
            isBattling: false,
            currentEnemy: null,
            battleState: null,
            lastBlowBy: null
        });

        Object.keys(RPG.State.inventory).forEach(itemId => {
            RPG.State.inventory[itemId] = 0;
        });
        Object.assign(RPG.State.inventory, {
            herb: 3,
            highHerb: 3,
            antidoteHerb: 3,
            glowingBrooch: 1,
            blueAmber: 1,
            milkAmber: 1,
            herbAmber: 1,
            fireproofGloves: preset.fireproofGloves
        });

        // Reuse the normal brooch equipment path.  The fresh state has no amber in
        // the socket, so the no-amber option still goes through the normal detach API.
        if (this.selectedAmberId) {
            uiControl.equipRareAmber(this.selectedAmberId);
        } else {
            uiControl.detachRareAmber({ log: false, refreshModal: false });
        }

        this.clearLog();
        return true;
    },

    showPresetSelector: function () {
        this.selectedPresetId = null;
        this.selectedAmberId = null;
        this.replaceTemporaryState();
        this.clearLog();
        uiControl.updateUI();
        this.hideNormalControls();
        uiControl.addLog("非保存デバッグ戦闘：確認する敵を選ぶ。", "marker", "#ffd166");
        this.renderActions(this.presets.map(preset => ({
            id: `debugBattlePreset_${preset.id}`,
            label: preset.label,
            onClick: () => {
                this.selectedPresetId = preset.id;
                this.selectedAmberId = null;
                this.showLoadoutSelector();
            }
        })));
    },

    showLoadoutSelector: function () {
        const preset = this.getSelectedPreset();
        if (!preset || !this.applySelectedPreset()) {
            this.showPresetSelector();
            return;
        }

        uiControl.updateUI();
        this.hideNormalControls();
        const amberLabel = this.selectedAmberId
            ? RPG.Assets.CONFIG.ITEM_NAME[this.selectedAmberId]
            : "琥珀装備なし";
        uiControl.addLog(`${preset.label} ／ ${amberLabel}`, "marker", "#ffd166");

        const amberChoices = [
            { id: null, label: "琥珀装備なし" },
            { id: "blueAmber", label: "《ブルーアンバー》" },
            { id: "milkAmber", label: "《牛乳琥珀》" },
            { id: "herbAmber", label: "《薬草入り琥珀》" }
        ];
        this.renderActions([
            ...amberChoices.map(choice => ({
                id: `debugBattleAmber_${choice.id || "none"}`,
                label: choice.label,
                onClick: () => {
                    this.selectedAmberId = choice.id;
                    this.showLoadoutSelector();
                }
            })),
            {
                id: "debugBattleStart",
                label: "戦闘開始",
                onClick: () => this.startSelectedBattle()
            },
            {
                id: "debugBattleBack",
                label: "プリセット選択へ戻る",
                onClick: () => this.showPresetSelector()
            }
        ]);
    },

    startSelectedBattle: function () {
        const preset = this.getSelectedPreset();
        if (!preset || !this.applySelectedPreset()) return false;

        // The normal milk-amber equip behavior does not heal current HP.  A debug
        // battle starts fully healed after that existing equip effect has applied.
        if (this.selectedAmberId === "milkAmber") {
            RPG.State.currentHP = RPG.State.maxHP;
        }

        const template = RPG.Assets.ENEMIES.find(enemy => enemy.id === preset.enemyId);
        if (!template) return false;
        this.hideNormalControls();
        const actions = document.getElementById("action-buttons");
        if (actions) actions.style.display = "none";
        battleSystem.beginBattle(template);
        return true;
    },

    finishBattle: function () {
        if (!this.isActive()) return false;
        this.replaceTemporaryState();
        this.clearLog();
        uiControl.updateUI();
        this.hideNormalControls();
        uiControl.addLog("デバッグ戦闘を終了した。結果は保存されない。", "marker", "#ffd166");
        this.renderActions([
            {
                id: "debugBattleReplay",
                label: "同じ条件で再戦",
                onClick: () => this.startSelectedBattle()
            },
            {
                id: "debugBattleReturn",
                label: "プリセット選択へ戻る",
                onClick: () => this.showPresetSelector()
            }
        ]);
        return true;
    },

    open: function () {
        this.active = true;
        document.body.classList.remove("intro-opening", "intro-title-card");
        uiControl.disableTapOverlay();
        this.showPresetSelector();
    }
};


// 🚩ーー【移動・探索システム】ーー
// Build 8.15: Exploration system functions moved to exploration.js
// See exploration.js for: checkEvents, playDialogueLoop, enterDungeon, move, talk, useItem



// 🚩ーー【宿屋・拠点システム & イベントシステム】ーー
// Build 8.16: Inn and Tree Event systems moved to inn.js
// See inn.js for: innSystem (enterInn, exitInn, talk, stay, observe, deliver)



// 🚩ーー【初期化：完全版】ーー
window.onload = () => {
    const resumeTargets = {
        suspend: {
            storageKey: "okai_rpg_suspend",
            sourceLabel: "中断記録"
        },
        1: {
            storageKey: "okai_rpg_save_1",
            sourceLabel: "第一頁"
        },
        2: {
            storageKey: "okai_rpg_save_2",
            sourceLabel: "第二頁"
        },
        3: {
            storageKey: "okai_rpg_save_3",
            sourceLabel: "第三頁"
        },
        4: {
            storageKey: "okai_rpg_save_4",
            sourceLabel: "第四頁"
        },
        5: {
            storageKey: "okai_rpg_save_5",
            sourceLabel: "第五頁"
        }
    };
    const searchParams = new URLSearchParams(window.location.search);
    const isDebugBattlePreset = searchParams.get("debugBattle") === "1";
    const resumeParam = searchParams.get("resume");
    const isNewGame = searchParams.get("new") === "1";
    const resumeTarget = (
        resumeParam &&
        Object.prototype.hasOwnProperty.call(resumeTargets, resumeParam)
    )
        ? resumeTargets[resumeParam]
        : null;

    if (isDebugBattlePreset) {
        debugBattlePresets.open();
        return;
    }

    if (resumeParam === null && !isNewGame) {
        let hasStoredRecord = false;
        try {
            hasStoredRecord = Object.values(resumeTargets).some(target => (
                localStorage.getItem(target.storageKey) !== null
            ));
        } catch (error) {
            hasStoredRecord = false;
        }

        if (hasStoredRecord) {
            window.location.replace("chapter1-records.html");
            return;
        }
    }

    if (resumeTarget) {
        const loaded = uiControl.loadFromStorage(
            resumeTarget.storageKey,
            resumeTarget.sourceLabel
        );
        if (loaded) {
            document.body.classList.remove("intro-opening", "intro-title-card");
            return;
        }

        window.location.replace("chapter1-records.html?resumeError=1");
        return;
    }

    // 強制初期化
    RPG.State.location = "宿屋《琥珀亭》";
    RPG.State.isAtInn = true;
    const exploreUI = document.getElementById('exploreUI');
    const innUI = document.getElementById('innUI');
    const locationBar = document.getElementById('locationBar');

    if (locationBar) locationBar.textContent = "ーー 宿屋《琥珀亭》 ーー";

    // UI強制設定（宿屋表示、探索非表示）
    if (exploreUI) exploreUI.style.display = 'none';
    if (innUI) innUI.style.display = 'grid';

    // 初期イベントチェック（プロローグなど）
    if (explorationSystem.checkEvents()) {
        uiControl.updateUI();
    } else {
        // 通常開始
        if (RPG.State.mode === "base") {
            uiControl.addLog("探索を開始した。");
            uiControl.updateUI();
        } else if (RPG.State.mode === "event") {
            uiControl.updateUI();
        }
    }

    // 画面クリックで会話進行のリスナーは削除（自動再生のみ）
};

// --- イベントリスナー登録 ---
window.addEventListener('DOMContentLoaded', () => {
    uiControl.updateUI();
});

window.debugSystem = debugSystem;
window.debugSpawnGlowingCatRabbit = () => debugSystem.spawnGlowingCatRabbit();
window.debugBattlePresets = debugBattlePresets;

/* DEBUG: KEYBOARD SKIP START */
// Build 8.7/8.12.1: Space key for high-speed text skip (DEBUG ONLY)
document.addEventListener('keydown', (e) => {
    // Build 8.12.1: Also works during battles
    if (e.code === 'Space' && (RPG.State.mode === 'event' || RPG.State.mode === 'battle')) {
        e.preventDefault(); // Prevent page scroll
        RPG.State.debug.isSkipping = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        RPG.State.debug.isSkipping = false;
    }
});
/* DEBUG: KEYBOARD SKIP END */

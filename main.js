// 🚩ーー【UI表示・更新処理】ーー
// Build 8.13: UI control functions moved to uiControl.js
// See uiControl.js for: addLog, updateUI, updateControlPanels, getLocData, openModal, selectItem, closeModal



// 🚩ーー【Build 8.3: Debug System】ーー
const debugSystem = {
    toggleEncounters: function () {
        RPG.State.flags.isDebugEncountersOff = !RPG.State.flags.isDebugEncountersOff;
        const icon = document.getElementById('debugEncounterToggle');

        if (icon) {
            if (RPG.State.flags.isDebugEncountersOff) {
                icon.style.opacity = '0.3';
                uiControl.addLog("🚫エンカウント無効", "ambient");
            } else {
                icon.style.opacity = '1.0';
                uiControl.addLog("👾エンカウント有効", "ambient");
            }
        }
    },

    spawnGlowingCatRabbit: function () {
        if (RPG.State.isBattling) {
            uiControl.addLog("すでに戦闘中だ。", "ambient");
            return;
        }

        battleSystem.startBattle('glowing_cat_rabbit');
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
    const resumeParam = searchParams.get("resume");
    const isNewGame = searchParams.get("new") === "1";
    const resumeTarget = (
        resumeParam &&
        Object.prototype.hasOwnProperty.call(resumeTargets, resumeParam)
    )
        ? resumeTargets[resumeParam]
        : null;

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

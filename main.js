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
    }
};


// 🚩ーー【移動・探索システム】ーー
// Build 8.15: Exploration system functions moved to exploration.js
// See exploration.js for: checkEvents, playDialogueLoop, enterDungeon, move, talk, useItem



// 🚩ーー【宿屋・拠点システム & イベントシステム】ーー
// Build 8.16: Inn and Tree Event systems moved to inn.js
// See inn.js for: innSystem (enterInn, exitInn, talk, stay, observe, deliver)
//                 treeEventSystem (showChoices, choiceTakeCoin, choiceLeave, triggerDuel)



// 🚩ーー【初期化：完全版】ーー
window.onload = () => {
    // 強制初期化
    RPG.State.location = "宿屋《琥珀亭》";
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

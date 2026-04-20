// 🚩ーー【UI表示・更新処理】ーー
// Build 8.13: Extracted from main.js for better code organization
const uiControl = {
    // --- addLog: ログの出力 ---
    addLog: function (text, type = "", color = null, fontSize = null) {
        if (!text) return; // Build 8.44: Prevent empty divs from creating black gaps

        const container = document.getElementById('logContainer');
        if (!container) return;

        const entry = document.createElement('div');
        entry.className = 'log-entry';
        const OWEN_DIALOGUE_COLOR = "#cc73ff";
        const normalizedText = typeof text === "string" ? text.trimStart() : "";
        const isOwenDialogue = normalizedText.startsWith("オーエン「");
        const resolvedColor = (typeof color === "string" && color.toLowerCase() === "#a020f0")
            ? OWEN_DIALOGUE_COLOR
            : color;

        if (type === "marker") entry.classList.add('log-marker');
        if (type === "ambient") {
            entry.style.color = "#888888"; // Build 6.3.6: Gray color for ambient texts
            entry.style.fontSize = "14px"; // Build 6.3.6: Smaller font for ambient texts
        }
        if (resolvedColor) {
            entry.style.color = resolvedColor;
        } else if (isOwenDialogue) {
            entry.style.color = OWEN_DIALOGUE_COLOR;
        }
        if (fontSize) entry.style.fontSize = fontSize;
        entry.textContent = text;

        container.appendChild(entry);
        container.scrollTop = container.scrollHeight;
    },

    addSeparator: function () {
        const container = document.getElementById('logContainer');
        if (!container) return;

        const separator = document.createElement('div');
        separator.style.borderTop = "1px solid rgba(255, 255, 255, 0.12)";
        separator.style.margin = "8px 0";
        separator.style.opacity = "0.7";
        container.appendChild(separator);
        container.scrollTop = container.scrollHeight;
    },

    // Build 15.1.7: Purge the narrative log
    clearLog: function () {
        const container = document.getElementById('logContainer');
        if (container) {
            container.innerHTML = '';
        }
    },

    // --- updateUI: 画面の全要素を最新状態に更新 ---
    updateUI: function () {
        if (!RPG.State) return; // 安全ガード

        const loc = this.getLocData(RPG.State.currentDistance);

        // Build 8.0: ステータス更新 - Unified HP variables
        const statusInfo = document.getElementById('statusInfo');
        const hpFill = document.getElementById('hpFill');
        const hpText = document.getElementById('hpText');
        const xpFill = document.getElementById('xpFill');

        const statusTags = [];
        if (RPG.State.isPoisoned) statusTags.push("毒");
        if (RPG.State.flags.matamatabiActive === true) statusTags.push("マタマタビ");
        const statusSuffix = statusTags.length > 0 ? ` 【${statusTags.join(" / ")}】` : "";
        if (statusInfo) statusInfo.textContent = `カイン Lv.${RPG.State.cainLv}${statusSuffix}`;

        if (hpFill) {
            hpFill.style.width = `${(RPG.State.currentHP / RPG.State.maxHP) * 100}%`;
            hpFill.style.background = RPG.State.isPoisoned
                ? '#a333c8'
                : (RPG.State.flags.matamatabiActive === true ? '#9acd32' : '#ff4d4d');
        }
        if (hpText) {
            hpText.textContent = `${RPG.State.currentHP} / ${RPG.State.maxHP}`;
        }

        if (xpFill) {
            const nextLevelExp = 75 * Math.pow(1.5, RPG.State.cainLv - 1);
            const xpRatio = nextLevelExp > 0 ? Math.min(100, (RPG.State.exp / nextLevelExp) * 100) : 0;
            xpFill.style.width = `${xpRatio}%`;
        }

        // Build 10.0: Update Header text with Version
        const header = document.getElementById('chapterHeader');
        if (header) {
            header.textContent = `Chapter 1 銀貨と宿屋 (Build ${RPG.State.version})`;
        }

        const overworldRow = document.getElementById('overworldRow');
        const battleInfoRow = document.getElementById('battleInfoRow');
        const currentLocationName = document.getElementById('currentLocationName');
        const progressStartLabel = document.getElementById('progressStartLabel');
        const progressEndLabel = document.getElementById('progressEndLabel');
        const progressMarker = document.getElementById('progressMarker');
        const enemyNameLabel = document.getElementById('enemyNameLabel');
        const enemyTopHpFill = document.getElementById('enemyTopHpFill');

        const currentLocationText = RPG.State.location && RPG.State.location !== "" ? RPG.State.location : loc.name;
        const isHighway = currentLocationText === "かつての街道";

        if (progressStartLabel) progressStartLabel.textContent = isHighway ? "街道入口" : "宿屋";
        if (progressEndLabel) progressEndLabel.textContent = isHighway ? "街道奥" : "森の深層";

        if (RPG.State.isBattling && RPG.State.currentEnemy) {
            if (overworldRow) overworldRow.style.display = 'none';
            if (battleInfoRow) battleInfoRow.style.display = 'flex';
            if (enemyNameLabel) enemyNameLabel.textContent = RPG.State.currentEnemy.name;
            if (enemyTopHpFill) {
                const hpPct = Math.max(0, (RPG.State.currentEnemy.hp / RPG.State.currentEnemy.maxHp) * 100);
                enemyTopHpFill.style.width = `${hpPct}%`;
                enemyTopHpFill.style.background = "#ff4d4d";
            }
        } else {
            if (battleInfoRow) battleInfoRow.style.display = 'none';
            if (overworldRow) overworldRow.style.display = 'block';
            if (currentLocationName) currentLocationName.textContent = currentLocationText;
        }

        if (progressMarker) {
            const ratio = (RPG.State.currentDistance / RPG.Assets.CONFIG.MAX_DISTANCE) * 100;
            progressMarker.style.left = `${ratio}%`;
        }

        // デバッグ用気分値表示
        const debugMood = document.getElementById('debug-mood');
        if (debugMood) {
            debugMood.textContent = `Mood: ${RPG.State.mood}`;
        }

        // Keep the save button available without consuming header layout space.
        let saveBtn = document.getElementById('miniSaveButton');
        if (!saveBtn) {
            saveBtn = document.createElement('button');
            saveBtn.id = 'miniSaveButton';
            saveBtn.textContent = 'Save';
            saveBtn.onclick = () => this.openSaveModal();
            document.body.appendChild(saveBtn);
        }

        this.updateControlPanels(loc);
    },

    // --- updateControlPanels: RPG.State.modeに基づくボタン制御 ---
    updateControlPanels: function (loc) {
        const exploreUI = document.getElementById('exploreUI');
        const innUI = document.getElementById('innUI');
        const choiceUI = document.getElementById('choiceUI');
        const actionButtons = document.getElementById('action-buttons');
        const allButtons = document.querySelectorAll('button');

        // Build 15.2.2: Strict Exclusivity Protocol (Battle menu visible)
        // Hide all control panels by default - only one shall be shown below
        if (exploreUI) exploreUI.style.display = 'none';
        if (innUI) innUI.style.display = 'none';
        if (choiceUI) choiceUI.style.display = 'none';

        // Step 1: Default Reset (Reset interaction states)
        allButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = "1";
            btn.style.pointerEvents = "auto";
        });

        const mode = RPG.State.mode;

        // Step 2: Mode-Based Rendering
        if (mode === "choice") {
            // Wagon choices use their own container; don't also show the amber-tree choice UI
            const isWagonChoiceActive =
                actionButtons &&
                actionButtons.style.display !== 'none' &&
                actionButtons.childElementCount > 0;

            if (choiceUI) choiceUI.style.display = isWagonChoiceActive ? 'none' : 'grid';
            return; // Exit early to prevent exploration setup
        }

        if (mode === "battle") {
            // Battle State: Keep exploration menu visible, but greyed out
            if (exploreUI) exploreUI.style.display = 'grid';
            allButtons.forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = "0.5";
                btn.style.pointerEvents = "none";
            });
            return;
        }

        // --- Common Setup for Base & Event (Dialogue) Modes ---
        // Both show the standard menu, but 'event' disables it (Grey Out)
        if (RPG.State.isAtInn) {
            if (innUI) innUI.style.display = 'grid';

            const btnInnObserve = document.getElementById('btnInnObserve');
            const btnInnDeliver = document.getElementById('btnInnDeliver');
            const canDeliver = (RPG.State.silverCoins >= 3 && !RPG.State.flags.silverDelivered && mode === 'base');

            if (btnInnObserve) {
                let observeLabel = "様子を見る";
                if (
                    RPG.State.storyPhase === 4 &&
                    RPG.State.flags.phase4TheftDiscovered &&
                    RPG.State.flags.thiefDiscoveryStatus === 0
                ) {
                    if (
                        RPG.State.flags.needsGlowingRabbitFur === true &&
                        (RPG.State.inventory.glowingCatRabbitFur || 0) > 0
                    ) {
                        observeLabel = "納品する";
                    } else {
                        observeLabel = RPG.State.flags.phase4FortuneConsultDone
                            ? "オーエンに相談"
                            : "占い師に相談";
                    }
                }
                btnInnObserve.textContent = observeLabel;
            }

            if (btnInnDeliver) {
                btnInnDeliver.style.display = canDeliver ? 'flex' : 'none';
                if (canDeliver) {
                    btnInnDeliver.onclick = () => Cinematics.playSilverDeliveryEvent();
                }
            }
        } else {
            if (exploreUI) exploreUI.style.display = 'grid';

            const btnEnterInn = document.getElementById('btnEnterInn');
            const btnMoveForward = document.getElementById('btnMoveForward');
            const btnMoveBack = document.getElementById('btnMoveBack');
            const btnTalk = document.getElementById('btnTalk');

            if (!RPG.State.isInDungeon) {
                if (btnEnterInn) btnEnterInn.style.display = 'flex';
                if (btnMoveForward) {
                    btnMoveForward.textContent = RPG.Assets.GAME_TEXT.buttons.enterForest;
                    btnMoveForward.onclick = () => explorationSystem.enterDungeon();
                }
                if (btnMoveBack) btnMoveBack.style.display = 'none';
            } else {
                if (btnEnterInn) btnEnterInn.style.display = 'none';
                if (btnMoveForward) {
                    btnMoveForward.textContent = RPG.Assets.GAME_TEXT.buttons.moveForward;
                    btnMoveForward.onclick = () => explorationSystem.move(1);

                    // Highway / Special Transitions
                    if (RPG.State.flags.isTreeRematch && RPG.State.currentDistance === 9) {
                        btnMoveForward.textContent = RPG.Assets.GAME_TEXT.buttons.moveForward;
                        btnMoveForward.style.backgroundColor = "#8b0000";
                        btnMoveForward.style.fontWeight = "bold";
                    } else if (RPG.State.location === "かつての街道" && RPG.State.currentDistance === 9) {
                        btnMoveForward.textContent = "【BOSS戦】";
                        btnMoveForward.style.backgroundColor = "#8b0000";
                        btnMoveForward.style.fontWeight = "bold";
                    } else if (RPG.State.storyPhase === 8 && RPG.State.currentDistance === 10) {
                        btnMoveForward.textContent = "街道へ進む";
                        btnMoveForward.style.backgroundColor = "#4d94ff";
                        btnMoveForward.style.fontWeight = "bold";
                        btnMoveForward.onclick = () => explorationSystem.transitionToHighway();
                    } else if (RPG.State.currentDistance === 9 && RPG.State.flags.heardScream && !RPG.State.flags.giantLarvaDefeated) {
                        btnMoveForward.textContent = "【BOSS戦：悲鳴の方へ】";
                        btnMoveForward.style.backgroundColor = "#8b0000";
                        btnMoveForward.style.fontWeight = "bold";
                    } else {
                        // Standard Reset
                        btnMoveForward.style.backgroundColor = "";
                        btnMoveForward.style.fontWeight = "";
                        if (RPG.State.currentDistance >= RPG.Assets.CONFIG.MAX_DISTANCE && RPG.State.storyPhase !== 8) {
                            btnMoveForward.disabled = true;
                            btnMoveForward.style.opacity = "0.5";
                        }
                    }
                }
                if (btnMoveBack) {
                    if (RPG.State.flags.onWagon) {
                        btnMoveBack.style.display = 'none';
                    } else {
                        btnMoveBack.style.display = 'flex';
                        btnMoveBack.onclick = () => explorationSystem.move(-1);
                    }
                }
                if (btnTalk) btnTalk.disabled = false;
            }
        }

        // --- Step 3: Interaction Logic (The 'Grey Out') ---
        if (mode === "event") {
            // Dialogue State: Keep standard set (visible) but disable interaction
            allButtons.forEach(btn => {
                // Don't disable Choice Buttons if they somehow exist
                if (btn.id !== 'btnChoiceA' && btn.id !== 'btnChoiceB') {
                    btn.disabled = true;
                    btn.style.opacity = "0.5";
                    btn.style.pointerEvents = "none";
                }
            });
        }
    },

    getLocData: function (dist) {
        const keys = Object.keys(RPG.Assets.LOCATIONS).map(Number).sort((a, b) => b - a);
        const key = keys.find(k => dist >= k);
        return RPG.Assets.LOCATIONS[key] || RPG.Assets.LOCATIONS[0];
    },

    openModal: function () {
        if (RPG.State.mode !== "base") return;
        const modal = document.getElementById('itemModal');
        const list = document.getElementById('itemList');
        const detail = document.getElementById('itemDetailArea');
        if (!modal || !list) return;

        // Build 8.18: Clear ghost item details when opening modal
        if (detail) detail.innerHTML = 'アイテムを選択してください';

        list.innerHTML = '';
        const items = Object.entries(RPG.State.inventory).filter(([k, v]) => v > 0);
        if (items.length === 0) {
            list.innerHTML = `<div style="text-align:center; padding:20px;">${RPG.Assets.GAME_TEXT.exploration.noInventory}</div>`;
        } else {
            items.forEach(([key, count]) => {
                const div = document.createElement('div');
                div.className = 'item-row';
                div.textContent = `${RPG.Assets.CONFIG.ITEM_NAME[key]} (×${count})`;
                div.onclick = () => this.selectItem(key, count);
                list.appendChild(div);
            });
        }
        modal.style.display = 'flex';
    },

    selectItem: function (key, count) {
        const detail = document.getElementById('itemDetailArea');
        if (!detail) return;
        let html = `<strong>${RPG.Assets.CONFIG.ITEM_NAME[key]}</strong> (×${count})<br><span style="font-size:12px;color:#aaa;">${RPG.Assets.CONFIG.ITEM_DESC[key]}</span>`;

        // アイテム使用ボタンの表示判定
        // 将来的にはtype判定などが望ましいが、今はswitchか個別判定
        if (key === 'herb' || key === 'debug_poison' || key === 'debug_lvl10' || key === 'matamatabiBranch') {
            html += `<br><button class="btn" style="height:35px;margin:10px auto 0;width:120px;" onclick="explorationSystem.useItem('${key}')">${RPG.Assets.GAME_TEXT.buttons.useItem}</button>`;
        }

        detail.innerHTML = html;
    },

    closeModal: function () {
        const modal = document.getElementById('itemModal');
        if (modal) modal.style.display = 'none';


        // Build 8.56: Enhanced debug logging for Scenario A
        console.log("DEBUG: closeModal called", {
            metThiefBoy: RPG.State.flags.metThiefBoy,
            phase4TheftDiscovered: RPG.State.flags.phase4TheftDiscovered,
            thiefDiscoveryStatus: RPG.State.flags.thiefDiscoveryStatus,
            hasSleptAfterThief: RPG.State.flags.hasSleptAfterThief,
            location: RPG.State.location,
            isAtInn: RPG.State.isAtInn,
            mode: RPG.State.mode
        });

        // Build 8.55: Discovery Hook A (Inventory Close)
        if (Cinematics.canPlayThiefDiscoveryFromModal()) {
            console.log("DEBUG: Final Discovery Hook Active in closeModal");
            Cinematics.playThiefDiscovery();
        }
    },

    // Build 8.22: Save/Load System
    openSaveModal: function () {
        const modal = document.getElementById('saveModal');
        if (!modal) return;

        // Update slot info display
        for (let i = 1; i <= 5; i++) {
            const slotInfo = document.getElementById(`saveSlot${i}Info`);
            const loadBtn = document.getElementById(`btnLoad${i}`);
            const saveData = localStorage.getItem(`okai_rpg_save_${i}`);

            if (saveData) {
                try {
                    const data = JSON.parse(saveData);
                    if (slotInfo) slotInfo.textContent = `Lv.${data.cainLv} | ${data.currentDistance}m | ${data.silverCoins} coins`;
                    if (loadBtn) loadBtn.disabled = false;
                } catch (e) {
                    if (slotInfo) slotInfo.textContent = 'Empty';
                    if (loadBtn) loadBtn.disabled = true;
                }
            } else {
                if (slotInfo) slotInfo.textContent = 'Empty';
                if (loadBtn) loadBtn.disabled = true;
            }
        }

        modal.style.display = 'flex';
    },

    closeSaveModal: function () {
        const modal = document.getElementById('saveModal');
        if (modal) modal.style.display = 'none';
    },

    saveGame: function (slot) {
        if (!slot || slot < 1 || slot > 5) return;
        const saveData = JSON.stringify(RPG.State);
        localStorage.setItem(`okai_rpg_save_${slot}`, saveData);
        this.addLog(`Slot ${slot} にセーブしました。`);
        this.closeSaveModal();
    },

    loadGame: function (slot) {
        if (!slot || slot < 1 || slot > 5) return;
        const saveData = localStorage.getItem(`okai_rpg_save_${slot}`);
        if (!saveData) {
            this.addLog(`Slot ${slot} にデータがありません。`);
            return;
        }
        try {
            const loadedState = JSON.parse(saveData);
            // Build 10.0.8: Preserve current system version
            const currentVersion = RPG.State.version;
            const defaultFlags = { ...RPG.State.flags };
            const defaultInventory = { ...RPG.State.inventory };
            const defaultDebug = { ...RPG.State.debug };
            Object.assign(RPG.State, loadedState);
            RPG.State.flags = { ...defaultFlags, ...(loadedState.flags || {}) };
            RPG.State.inventory = { ...defaultInventory, ...(loadedState.inventory || {}) };
            RPG.State.debug = { ...defaultDebug, ...(loadedState.debug || {}) };
            RPG.State.version = currentVersion; // Hard-force the version
            this.addLog(`Slot ${slot} からロードしました。`);
            this.updateUI();
            this.closeSaveModal();
        } catch (e) {
            this.addLog('セーブデータの読み込みに失敗しました。');
        }
    },

    // Build 8.49: Screen Shake Effect (Reusable Recipe)
    screenShake: function () {
        const body = document.body;
        body.style.transition = "transform 0.1s";
        body.style.transform = "translateX(5px)";
        setTimeout(() => body.style.transform = "translateX(-5px)", 50);
        setTimeout(() => body.style.transform = "translateX(5px)", 100);
        setTimeout(() => {
            body.style.transform = "none";
            body.style.transition = "";
        }, 150);
    },

    // Build 11.0.0: Tap-to-Advance Dialogue System
    startDialogueSequence: function (dialogueArray) {
        if (!dialogueArray || dialogueArray.length === 0) return;

        RPG.State.dialogueQueue = dialogueArray;
        RPG.State.dialogueIndex = 0;
        RPG.State.mode = "event";
        RPG.State.isWaitingForInput = false;

        // Use the shared queue-based dialogue loop so the first line is not replayed on tap.
        explorationSystem.playDialogueLoop();
    },

    showNextDialogueLine: function () {
        if (RPG.State.dialogueIndex >= RPG.State.dialogueQueue.length) {
            this.endDialogueSequence();
            return;
        }

        const current = RPG.State.dialogueQueue[RPG.State.dialogueIndex];

        // Execute action if present
        if (current.action && typeof current.action === 'function') {
            current.action();
        }

        // Display text if present
        if (current.text) {
            this.addLog(current.text, current.type || "", current.color || null, current.fontSize || null);
        }

        RPG.State.dialogueIndex++;

        // Show arrow and enable tap
        this.showFloatingArrow();
        this.enableTapOverlay();
        RPG.State.isWaitingForInput = true;
    },

    // Build 13.0.0: Global Input Handler
    handlePlayerInput: function () {
        if (RPG.State.isWaitingForInput) {
            this.advanceDialogue();
        }
    },

    advanceDialogue: function () {
        if (!RPG.State.isWaitingForInput) return;

        RPG.State.isWaitingForInput = false;
        this.hideFloatingArrow();
        this.disableTapOverlay(); // Hide overlay immediately to prevent double clicks

        // Call the main loop to process next line
        explorationSystem.playDialogueLoop();
    },

    endDialogueSequence: function () {
        this.hideFloatingArrow();
        this.disableTapOverlay();
        RPG.State.isWaitingForInput = false;
        RPG.State.dialogueQueue = [];
        RPG.State.dialogueIndex = 0;
        RPG.State.mode = "base";
        this.updateUI();
    },

    showFloatingArrow: function () {
        let arrow = document.getElementById('floating-arrow');
        if (!arrow) {
            arrow = document.createElement('div');
            arrow.id = 'floating-arrow';
            arrow.className = 'floating-arrow';
            arrow.textContent = '▼';
            document.body.appendChild(arrow);
        }
        arrow.style.display = 'block';
    },

    hideFloatingArrow: function () {
        const arrow = document.getElementById('floating-arrow');
        if (arrow) arrow.style.display = 'none';
    },

    enableTapOverlay: function () {
        const overlay = document.getElementById('tap-overlay');
        if (overlay) {
            overlay.style.display = 'block';
            overlay.onclick = () => this.advanceDialogue();
        }
    },

    disableTapOverlay: function () {
        const overlay = document.getElementById('tap-overlay');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.onclick = null;
        }
    },

    // Build 11.0.0: Flash full-screen (for visual effects during dialogue)
    flashFullScreen: function (color = "#ff0000", duration = 500) {
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: ${color};
            opacity: 0.7;
            z-index: 9997;
            pointer-events: none;
        `;
        document.body.appendChild(flash);

        setTimeout(() => {
            flash.style.transition = 'opacity 0.5s ease';
            flash.style.opacity = '0';
            setTimeout(() => flash.remove(), 500);
        }, duration);
    },

    // Build 14.2.1: Wagon Choice System
    showWagonChoice: function () {
        const container = document.getElementById('action-buttons');
        const choiceUI = document.getElementById('choiceUI');
        if (!container) return;

        container.innerHTML = '';
        container.style.display = 'flex';
        if (choiceUI) choiceUI.style.display = 'none';

        const btnAccept = document.createElement('button');
        btnAccept.id = 'btnChoiceA'; // Add ID to bypass disable logic
        btnAccept.className = 'btn btn-full';
        btnAccept.textContent = 'もちろん';
        btnAccept.onclick = () => this.acceptWagonRide();

        const btnWait = document.createElement('button');
        btnWait.id = 'btnChoiceB'; // Add ID to bypass disable logic
        btnWait.className = 'btn btn-full';
        btnWait.textContent = 'ちょっと待ってくれ';
        btnWait.onclick = () => this.declineWagonRide();

        container.appendChild(btnAccept);
        container.appendChild(btnWait);

        // Prevent updateUI from overwriting these buttons immediately
        RPG.State.mode = "choice";
    },


    acceptWagonRide: function () {
        // Clear choice buttons
        const container = document.getElementById('action-buttons');
        if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
        }

        RPG.State.mode = "event";
        RPG.State.storyPhase = 8;
        RPG.State.flags.onWagon = true;

        RPG.State.dialogueQueue = [
            {
                text: null,
                delay: 0,
                action: () => {
                    uiControl.addLog("カインとオーエンは荷馬車に乗りこんだ！", "marker");
                }
            },
            { text: "御者「まずこの森を抜けて、そこから街道に出られるぞ。油断するなよ」", delay: 1800 },
            {
                text: null,
                delay: 0,
                action: () => {
                    RPG.State.mode = "base";
                    uiControl.updateUI();
                }
            }
        ];
        explorationSystem.playDialogueLoop();
    },

    declineWagonRide: function () {
        // Clear choice buttons
        const container = document.getElementById('action-buttons');
        if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
        }

        RPG.State.mode = "base";
        this.updateUI();
    }
};

// Build 13.0.0: Global Input & Key Listeners
document.addEventListener('keydown', function (event) {
    if ((event.code === 'Space' || event.code === 'Enter') && RPG.State.isWaitingForInput) {
        event.preventDefault();
        uiControl.handlePlayerInput();
    }
});

// Initial binding for the overlay (dynamically managed but good to have reference)
const overlay = document.getElementById('tap-overlay');
if (overlay) {
    overlay.onclick = () => uiControl.handlePlayerInput();
}

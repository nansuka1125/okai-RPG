// 🚩ーー【UI表示・更新処理】ーー
// Build 8.13: Extracted from main.js for better code organization
const uiControl = {
    pendingOverwriteSlot: null,
    overwriteResetTimer: null,

    scrollLogToLatest: function (container) {
        if (!container) return;

        // Smooth scrolling is pleasant during normal dialogue, but it falls behind
        // when a held skip key adds several lines at once.
        const isSkipping = RPG.State.debug && RPG.State.debug.isSkipping === true;
        const previousBehavior = container.style.scrollBehavior;
        if (isSkipping) container.style.scrollBehavior = "auto";

        container.scrollTop = container.scrollHeight;

        if (isSkipping) {
            requestAnimationFrame(() => {
                if (container.style.scrollBehavior === "auto") {
                    container.style.scrollBehavior = previousBehavior;
                }
            });
        }
    },

    // --- addLog: ログの出力 ---
    addLog: function (text, type = "", color = null, fontSize = null, allowEmpty = false, colorSource = text) {
        if (!text && !allowEmpty) return; // Build 8.44: Prevent empty divs from creating black gaps

        const container = document.getElementById('logContainer');
        if (!container) return;

        const entry = document.createElement('div');
        entry.className = 'log-entry';
        if (type) {
            const safeType = String(type).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
            entry.classList.add(`log-${safeType}`);
        }
        const OWEN_DIALOGUE_COLOR = "#cc73ff";
        const normalizedText = typeof colorSource === "string" ? colorSource.trimStart() : "";
        const isOwenDialogue = /^オーエン[「｢]/.test(normalizedText);
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

        const previousCurrent = container.querySelector('.log-current');
        if (previousCurrent) previousCurrent.classList.remove('log-current');
        entry.classList.add('log-current');
        container.appendChild(entry);
        this.scrollLogToLatest(container);
        return entry;
    },

    beginSceneLogFocus: function () {
        const container = document.getElementById('logContainer');
        if (!container) return;

        if (container.sceneFocusTimer) clearTimeout(container.sceneFocusTimer);
        Array.from(container.children).forEach(entry => entry.classList.add('scene-history'));
        container.classList.add('scene-fading');

        // Fade only the previous log, then hide it without deleting it so the title can begin at the top.
        container.sceneFocusTimer = setTimeout(() => {
            container.classList.remove('scene-fading');
            container.classList.add('scene-focus');
            container.scrollTop = 0;
        }, 550);
    },

    endSceneLogFocus: function () {
        const container = document.getElementById('logContainer');
        if (!container) return;

        if (container.sceneFocusTimer) clearTimeout(container.sceneFocusTimer);
        container.classList.remove('scene-fading');
        container.classList.remove('scene-focus');
        Array.from(container.children).forEach(entry => entry.classList.remove('scene-history'));
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
        if ((RPG.State.nightMedicineEvasionBattlesRemaining || 0) > 0) {
            statusTags.push(`夜の薬 ${RPG.State.nightMedicineEvasionBattlesRemaining}戦`);
        }
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

        // Keep the chapter title immersive; the current build remains available as a tooltip.
        const header = document.getElementById('chapterHeader');
        if (header) {
            header.textContent = 'Chapter 1 銀貨と宿屋';
            header.title = `Build ${RPG.State.version}`;
        }

        const overworldRow = document.getElementById('overworldRow');
        const battleInfoRow = document.getElementById('battleInfoRow');
        const currentLocationName = document.getElementById('currentLocationName');
        const progressStartLabel = document.getElementById('progressStartLabel');
        const progressEndLabel = document.getElementById('progressEndLabel');
        const progressMarker = document.getElementById('progressMarker');
        const progressTrail = document.getElementById('progressTrail');
        const progressTrack = document.querySelector('.progress-track');
        const enemySymbolLabel = document.getElementById('enemySymbolLabel');
        const enemyNameLabel = document.getElementById('enemyNameLabel');
        const enemyTopHpFill = document.getElementById('enemyTopHpFill');

        const currentLocationText = RPG.State.location && RPG.State.location !== "" ? RPG.State.location : loc.name;
        const isHighway = currentLocationText === "かつての街道";
        const isHerbGarden = RPG.State.explorationArea === "herbGarden";
        const shouldShowLocationBar = RPG.State.isInDungeon === true && RPG.State.isAtInn !== true;

        if (progressStartLabel) progressStartLabel.textContent = isHerbGarden ? "薬草園入口" : (isHighway ? "街道入口" : "宿屋");
        if (progressEndLabel) progressEndLabel.textContent = isHerbGarden ? "薬草園の最奥" : (isHighway ? "街道奥" : "森の深層");

        if (RPG.State.isBattling && RPG.State.currentEnemy) {
            if (overworldRow) overworldRow.style.display = 'none';
            if (battleInfoRow) battleInfoRow.style.display = 'flex';
            if (enemySymbolLabel) enemySymbolLabel.textContent = '👾';
            if (enemyNameLabel) enemyNameLabel.textContent = RPG.State.currentEnemy.name;
            if (enemyTopHpFill) {
                const hpPct = Math.max(0, (RPG.State.currentEnemy.hp / RPG.State.currentEnemy.maxHp) * 100);
                enemyTopHpFill.style.width = `${hpPct}%`;
                enemyTopHpFill.style.background = "#ff4d4d";
            }
        } else {
            if (battleInfoRow) battleInfoRow.style.display = 'none';
            if (overworldRow) {
                overworldRow.style.display = 'block';
                overworldRow.classList.toggle('location-only', !shouldShowLocationBar);
            }
            if (currentLocationName) currentLocationName.textContent = currentLocationText;
        }

        if (progressMarker) {
            const maxDistance = isHerbGarden
                ? RPG.Assets.CONFIG.HERB_GARDEN_MAX_DISTANCE
                : RPG.Assets.CONFIG.MAX_DISTANCE;
            const ratio = (RPG.State.currentDistance / maxDistance) * 100;
            progressMarker.style.left = `clamp(5px, ${ratio}%, calc(100% - 5px))`;
            if (progressTrail) progressTrail.style.width = `${ratio}%`;
            if (progressTrack) {
                progressTrack.setAttribute('role', 'progressbar');
                progressTrack.setAttribute('aria-label', '探索距離');
                progressTrack.setAttribute('aria-valuemin', '0');
                progressTrack.setAttribute('aria-valuemax', String(maxDistance));
                progressTrack.setAttribute('aria-valuenow', String(RPG.State.currentDistance));
            }
        }

        // デバッグ用気分値表示
        const debugMood = document.getElementById('debug-mood');
        if (debugMood) {
            debugMood.textContent = `Mood: ${RPG.State.mood}`;
        }

        // Outside the inn this becomes a one-slot suspend bookmark. During an
        // inn event it remains a load-only journal entrance for returning players.
        let saveBtn = document.getElementById('miniSaveButton');
        if (!saveBtn) {
            saveBtn = document.createElement('button');
            saveBtn.id = 'miniSaveButton';
            document.body.appendChild(saveBtn);
        }
        const canSuspend = this.canWriteSuspendSave();
        const showInnLoadAccess = RPG.State.isAtInn === true && RPG.State.mode === 'event';
        if (saveBtn) {
            saveBtn.style.display = (canSuspend || showInnLoadAccess) ? 'block' : 'none';
            saveBtn.textContent = canSuspend ? '中断' : '宿帳';
            saveBtn.title = canSuspend ? '旅の途中に中断記録を残す' : '保存した旅を再開する';
            saveBtn.onclick = canSuspend
                ? () => this.saveSuspendGame()
                : () => this.openSaveModal();
        }

        if (typeof visualDirector !== 'undefined') {
            visualDirector.syncScene();
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
        const isHerbGarden = RPG.State.explorationArea === "herbGarden";

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

            // Choice mode is an exclusive input state. Do not rely only on hidden
            // panels: a queued tap must not reach exploration or inn commands.
            allButtons.forEach(btn => {
                const isActiveChoiceButton = isWagonChoiceActive
                    ? actionButtons?.contains(btn)
                    : choiceUI?.contains(btn);
                btn.disabled = !isActiveChoiceButton;
                btn.style.opacity = isActiveChoiceButton ? "1" : "0.5";
                btn.style.pointerEvents = isActiveChoiceButton ? "auto" : "none";
            });
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
            const btnInnTalk = document.getElementById('btnInnTalk');
            const btnInnDeliver = document.getElementById('btnInnDeliver');
            const canDeliver = (RPG.State.silverCoins >= 3 && !RPG.State.flags.silverDelivered && mode === 'base');

            if (btnInnObserve) {
                let observeLabel = "様子を見る";
                if (
                    typeof innSystem !== "undefined" &&
                    innSystem.shouldUsePhase4FortuneRoute()
                ) {
                    const fortuneFollowupsComplete =
                        RPG.State.flags.phase4FortuneFollowupCount >= 2;
                    const canDeliverGlowingRabbitFur =
                        RPG.State.flags.needsGlowingRabbitFur === true &&
                        (RPG.State.inventory.glowingCatRabbitFur || 0) > 0;
                    if (canDeliverGlowingRabbitFur) {
                        observeLabel = "納品する";
                    } else {
                        if (RPG.State.flags.phase4FortuneConsultDone !== true) {
                            observeLabel = "占い師に相談";
                        } else if ((RPG.State.flags.phase4OwenConsultCount || 0) < 2) {
                            observeLabel = "オーエンに相談";
                        } else {
                            observeLabel = "占い師と話す";
                        }
                    }

                    if (fortuneFollowupsComplete && !canDeliverGlowingRabbitFur) {
                        btnInnObserve.disabled = true;
                        btnInnObserve.style.opacity = "0.25";
                        btnInnObserve.style.pointerEvents = "none";
                    }
                } else if (RPG.State.storyPhase === 6) {
                    if (RPG.State.flags.herbGardenFortuneConsultUnlocked === true) {
                        if (RPG.State.flags.herbGardenBroochGranted !== true) {
                            observeLabel = "占い師に相談";
                        } else if (
                            typeof innSystem !== "undefined" &&
                            innSystem.needsPhase6ScentPouchMaterialBriefing()
                        ) {
                            observeLabel = "香草袋について聞く";
                        } else if (
                            typeof innSystem !== "undefined" &&
                            innSystem.shouldUsePhase6HerbGardenBroochReturn()
                        ) {
                            observeLabel = "ブローチを返す";
                        } else if (
                            typeof innSystem !== "undefined" &&
                            innSystem.shouldUsePhase6HerbGardenMaterialHint()
                        ) {
                            observeLabel = "占い師と話す";
                        }
                    }

                }
                btnInnObserve.textContent = observeLabel;
            }

            if (btnInnTalk) {
                const talkLabel = typeof innSystem !== "undefined"
                    ? innSystem.getInnTalkCommandLabel()
                    : "話す";
                btnInnTalk.textContent = talkLabel;
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
            const btnEnterHerbGarden = document.getElementById('btnEnterHerbGarden');
            const btnMoveBack = document.getElementById('btnMoveBack');
            const btnTalk = document.getElementById('btnTalk');
            const isPhase6WagonSpot =
                RPG.State.explorationArea !== "herbGarden" &&
                RPG.State.storyPhase === 6 &&
                RPG.State.flags.wagonInfoHeard === true &&
                RPG.State.currentDistance === 5 &&
                RPG.State.location !== "かつての街道" &&
                RPG.State.flags.wagonHorseEncouraged !== true;
            const isPhase6WagonDriverSpot =
                RPG.State.explorationArea !== "herbGarden" &&
                RPG.State.storyPhase === 6 &&
                RPG.State.flags.wagonInfoHeard === true &&
                RPG.State.currentDistance === 5 &&
                RPG.State.location !== "かつての街道";
            const hasUnfoundForestBrooch =
                RPG.State.explorationArea !== "herbGarden" &&
                RPG.State.currentDistance === 5 &&
                RPG.State.location !== "かつての街道" &&
                RPG.State.flags.forest5mBroochFound !== true;
            const isPhase6WagonDriverPending =
                isPhase6WagonDriverSpot &&
                RPG.State.flags.scentPouchCrafted !== true &&
                (
                    RPG.State.flags.wagonHorseEncouraged !== true ||
                    (RPG.State.inventory.mintFlower || 0) <= 0 ||
                    (RPG.State.inventory.boneMeal || 0) <= 0 ||
                    RPG.State.flags.herbGardenBroochReturned !== true
                );
            const isAmberTreeSecondInspect =
                RPG.State.explorationArea !== "herbGarden" &&
                RPG.State.currentDistance === 8 &&
                RPG.State.inventory.silverCoin >= 1 &&
                RPG.State.flags.forest8mInspectCount === 1 &&
                !RPG.State.flags.hasTreeEventOccurred &&
                !RPG.State.flags.treeDefeated &&
                !RPG.State.flags.isTreeRematch;

            if (!RPG.State.isInDungeon) {
                if (btnEnterInn) btnEnterInn.style.display = 'flex';
                if (btnEnterHerbGarden) {
                    btnEnterHerbGarden.style.display = 'flex';
                    btnEnterHerbGarden.onclick = () => explorationSystem.enterHerbGarden();
                }
                if (btnMoveForward) {
                    btnMoveForward.textContent = RPG.Assets.GAME_TEXT.buttons.enterForest;
                    btnMoveForward.onclick = () => explorationSystem.enterDungeon();
                }
                if (btnMoveBack) btnMoveBack.style.display = 'none';
            } else {
                if (btnEnterInn) btnEnterInn.style.display = 'none';
                if (btnEnterHerbGarden) btnEnterHerbGarden.style.display = 'none';
                if (btnMoveForward) {
                    btnMoveForward.textContent = RPG.Assets.GAME_TEXT.buttons.moveForward;
                    btnMoveForward.onclick = () => explorationSystem.move(1);

                    // Highway / Special Transitions
                    if (
                        RPG.State.location === "かつての街道" &&
                        RPG.State.currentDistance === 9 &&
                        mode === "base"
                    ) {
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
                        const maxDistance = isHerbGarden
                            ? explorationSystem.getHerbGardenMaxDistance()
                            : RPG.Assets.CONFIG.MAX_DISTANCE;
                        if (RPG.State.currentDistance >= maxDistance && RPG.State.storyPhase !== 8) {
                            btnMoveForward.disabled = true;
                            btnMoveForward.style.opacity = "0.5";
                        }
                    }
                }
                if (btnMoveBack) {
                    if (RPG.State.flags.onWagon) {
                        btnMoveBack.style.display = 'flex';
                        btnMoveBack.disabled = true;
                        btnMoveBack.style.opacity = "0.25";
                        btnMoveBack.style.pointerEvents = "none";
                        btnMoveBack.onclick = null;
                    } else {
                        btnMoveBack.style.display = 'flex';
                        btnMoveBack.onclick = () => explorationSystem.move(-1);
                    }
                }
                if (btnTalk) {
                    btnTalk.disabled = false;
                    btnTalk.textContent = "調べる";
                    btnTalk.onclick = () => explorationSystem.talk();

                    if (hasUnfoundForestBrooch && isPhase6WagonDriverSpot) {
                        btnTalk.textContent = "光るものを調べる";
                    } else if (isPhase6WagonSpot) {
                        const talkStep = RPG.State.flags.wagonDriverTalkStep || 0;
                        btnTalk.textContent = talkStep <= 0
                            ? "御者と話す"
                            : (talkStep === 1 ? "もっと話す" : "馬をはげます");
                    } else if (isPhase6WagonDriverPending) {
                        btnTalk.textContent = "御者と話す";
                    } else if (isPhase6WagonDriverSpot) {
                        btnTalk.textContent = (
                            RPG.State.flags.scentPouchCrafted === true &&
                            RPG.State.flags.wagonReadyForDeparture !== true
                        ) ? "香草袋を試す" : "御者と話す";
                    } else if (isAmberTreeSecondInspect) {
                        btnTalk.textContent = "さらに調べる";
                    }
                }
            }
        }

        // --- Step 3: Interaction Logic (The 'Grey Out') ---
        if (mode === "event") {
            // Dialogue State: Keep standard set (visible) but disable interaction
            allButtons.forEach(btn => {
                // Don't disable Choice Buttons if they somehow exist
                if (
                    btn.id !== 'btnChoiceA' &&
                    btn.id !== 'btnChoiceB' &&
                    btn.id !== 'btnWagonAccept' &&
                    btn.id !== 'btnWagonWait' &&
                    btn.id !== 'btnSweetDeliveryAccept' &&
                    btn.id !== 'miniSaveButton'
                ) {
                    btn.disabled = true;
                    btn.style.opacity = "0.5";
                    btn.style.pointerEvents = "none";
                }
            });
        }
    },

    getLocData: function (dist) {
        const locations = RPG.State.explorationArea === "herbGarden"
            ? RPG.Assets.HERB_GARDEN_LOCATIONS
            : RPG.Assets.LOCATIONS;
        const keys = Object.keys(locations).map(Number).sort((a, b) => b - a);
        const key = keys.find(k => dist >= k);
        return locations[key] || locations[0];
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
        const canUseEmptyBottle =
            key === 'emptyBottle' &&
            typeof explorationSystem !== 'undefined' &&
            explorationSystem.canCollectHerbGardenBoneMeal();
        const canUseScentPouch =
            key === 'scentPouch' &&
            typeof explorationSystem !== 'undefined' &&
            (
                explorationSystem.canUseScentPouchAtWagon() ||
                explorationSystem.canUseScentPouchOnHighway()
            );
        if (
            key === 'herb' ||
            key === 'highHerb' ||
            key === 'antidoteHerb' ||
            key === 'debug_poison' ||
            key === 'debug_lvl10' ||
            key === 'matamatabiBranch' ||
            key === 'lightBook' ||
            key === 'purpleMacaron' ||
            key === 'glowingBunnyEars' ||
            key === 'nightMedicine' ||
            canUseEmptyBottle ||
            canUseScentPouch
        ) {
            html += `<br><button class="btn" style="height:35px;margin:10px auto 0;width:120px;" onclick="explorationSystem.useItem('${key}')">${RPG.Assets.GAME_TEXT.buttons.useItem}</button>`;
        }

        detail.innerHTML = html;
    },

    closeModal: function () {
        const modal = document.getElementById('itemModal');
        if (modal) modal.style.display = 'none';

        // Build 8.55: Discovery Hook A (Inventory Close)
        if (Cinematics.canPlayThiefDiscoveryFromModal()) {
            Cinematics.playThiefDiscovery();
        }
    },

    // Build 15.3.1: Inn journal and safe one-slot suspend saves.
    canWriteJournalSave: function () {
        return (
            RPG.State.isAtInn === true &&
            RPG.State.mode === "base" &&
            RPG.State.isBattling !== true
        );
    },

    canWriteSuspendSave: function () {
        return (
            RPG.State.isAtInn !== true &&
            RPG.State.mode === "base" &&
            RPG.State.isBattling !== true
        );
    },

    getJourneyMemo: function (state = RPG.State) {
        if (RPG.Assets && typeof RPG.Assets.getJourneyMemo === "function") {
            return RPG.Assets.getJourneyMemo(state);
        }
        return "琥珀亭を拠点に、旅の続きを進める。";
    },

    createSaveSnapshot: function (kind) {
        const snapshot = JSON.parse(JSON.stringify(RPG.State));

        // New saves are only written from a stable base state. Strip completed
        // dialogue/battle residue so a reload cannot resume half an interaction.
        snapshot.mode = "base";
        snapshot.dialogueQueue = [];
        snapshot.dialogueIndex = 0;
        snapshot.isWaitingForInput = false;
        snapshot.isBattling = false;
        snapshot.currentEnemy = null;
        delete snapshot.battleState;

        snapshot.saveMeta = {
            format: 1,
            kind,
            savedAt: new Date().toISOString(),
            memo: this.getJourneyMemo(RPG.State),
            location: RPG.State.location || "宿屋《琥珀亭》"
        };
        return snapshot;
    },

    readSaveData: function (storageKey) {
        const serialized = localStorage.getItem(storageKey);
        if (!serialized) return null;

        const data = JSON.parse(serialized);
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new Error("Invalid save data");
        }
        return data;
    },

    formatSaveTime: function (savedAt) {
        if (!savedAt) return "以前の記録";
        const date = new Date(savedAt);
        if (Number.isNaN(date.getTime())) return "日時不明";
        return new Intl.DateTimeFormat("ja-JP", {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);
    },

    formatSaveInfo: function (data) {
        const meta = data.saveMeta && typeof data.saveMeta === "object"
            ? data.saveMeta
            : {};
        const obsoleteMemos = [
            "占い師への礼に、光る猫兎の毛皮を探す。"
        ];
        const memo = (!meta.memo || obsoleteMemos.includes(meta.memo))
            ? this.getJourneyMemo(data)
            : meta.memo;
        const location = meta.location || data.location || "場所不明";
        const level = Number(data.cainLv) || 1;
        const time = this.formatSaveTime(meta.savedAt);
        return `${memo}\n${time} ・ ${location} ・ Lv.${level}`;
    },

    resetOverwriteConfirmation: function () {
        this.pendingOverwriteSlot = null;
        if (this.overwriteResetTimer) clearTimeout(this.overwriteResetTimer);
        this.overwriteResetTimer = null;

        for (let i = 1; i <= 5; i++) {
            const button = document.getElementById(`btnSave${i}`);
            if (!button) continue;
            button.textContent = "書き留める";
            button.classList.remove("confirming");
        }
    },

    refreshSaveModal: function () {
        const manualSaveAllowed = this.canWriteJournalSave();
        document.querySelectorAll("#saveModal button").forEach(button => {
            button.disabled = false;
            button.style.opacity = "1";
            button.style.pointerEvents = "auto";
        });
        const preview = document.getElementById("currentJourneyMemo");
        if (preview) {
            const prefix = manualSaveAllowed ? "いまの旅の続き" : "いまは記録の読み込みのみできます";
            preview.textContent = `${prefix}\n${this.getJourneyMemo(RPG.State)}`;
        }

        for (let i = 1; i <= 5; i++) {
            const slotInfo = document.getElementById(`saveSlot${i}Info`);
            const loadBtn = document.getElementById(`btnLoad${i}`);
            const saveBtn = document.getElementById(`btnSave${i}`);

            if (saveBtn) saveBtn.disabled = !manualSaveAllowed;
            try {
                const data = this.readSaveData(`okai_rpg_save_${i}`);
                if (data) {
                    if (slotInfo) slotInfo.textContent = this.formatSaveInfo(data);
                    if (loadBtn) loadBtn.disabled = false;
                } else {
                    if (slotInfo) slotInfo.textContent = "まだ何も書かれていない。";
                    if (loadBtn) loadBtn.disabled = true;
                }
            } catch (error) {
                if (slotInfo) slotInfo.textContent = "文字が滲んでいて読めない。";
                if (loadBtn) loadBtn.disabled = true;
            }
        }

        const suspendSlot = document.getElementById("suspendSaveSlot");
        const suspendInfo = document.getElementById("suspendSaveInfo");
        const suspendLoadBtn = document.getElementById("btnLoadSuspend");
        try {
            const suspendData = this.readSaveData("okai_rpg_suspend");
            if (suspendSlot) suspendSlot.style.display = suspendData ? "flex" : "none";
            if (suspendInfo && suspendData) suspendInfo.textContent = this.formatSaveInfo(suspendData);
            if (suspendLoadBtn) suspendLoadBtn.disabled = !suspendData;
        } catch (error) {
            if (suspendSlot) suspendSlot.style.display = "flex";
            if (suspendInfo) suspendInfo.textContent = "中断記録を読み込めない。";
            if (suspendLoadBtn) suspendLoadBtn.disabled = true;
        }
    },

    openSaveModal: function () {
        const modal = document.getElementById("saveModal");
        if (!modal) return;

        this.resetOverwriteConfirmation();
        this.refreshSaveModal();
        modal.style.display = "flex";
    },

    closeSaveModal: function () {
        const modal = document.getElementById("saveModal");
        if (modal) modal.style.display = "none";
        this.resetOverwriteConfirmation();
    },

    saveGame: function (slot) {
        if (!slot || slot < 1 || slot > 5 || !this.canWriteJournalSave()) return;

        const storageKey = `okai_rpg_save_${slot}`;
        if (localStorage.getItem(storageKey) && this.pendingOverwriteSlot !== slot) {
            this.resetOverwriteConfirmation();
            this.pendingOverwriteSlot = slot;
            const button = document.getElementById(`btnSave${slot}`);
            if (button) {
                button.textContent = "もう一度押して上書き";
                button.classList.add("confirming");
            }
            this.overwriteResetTimer = setTimeout(() => {
                this.resetOverwriteConfirmation();
            }, 4500);
            return;
        }

        try {
            localStorage.setItem(storageKey, JSON.stringify(this.createSaveSnapshot("journal")));
            this.addLog("カインは宿帳に旅の続きを書き留めた。", "item");
            this.closeSaveModal();
        } catch (error) {
            this.addLog("宿帳に記録を書き留められなかった。", "damage");
        }
    },

    saveSuspendGame: function () {
        if (!this.canWriteSuspendSave()) return;

        try {
            localStorage.setItem("okai_rpg_suspend", JSON.stringify(this.createSaveSnapshot("suspend")));
            this.addLog("旅の途中に、しおりを挟んだ。", "item");
        } catch (error) {
            this.addLog("中断記録を残せなかった。", "damage");
        }
    },

    loadGame: function (slot) {
        if (!slot || slot < 1 || slot > 5) return;
        this.loadFromStorage(`okai_rpg_save_${slot}`, `第${["一", "二", "三", "四", "五"][slot - 1]}頁`);
    },

    loadSuspendGame: function () {
        this.loadFromStorage("okai_rpg_suspend", "中断記録");
    },

    loadFromStorage: function (storageKey, sourceLabel) {
        const saveData = localStorage.getItem(storageKey);
        if (!saveData) {
            this.addLog("記録が見つからなかった。", "damage");
            return;
        }

        try {
            const loadedState = JSON.parse(saveData);
            if (!loadedState || typeof loadedState !== "object" || Array.isArray(loadedState)) {
                throw new Error("Invalid save data");
            }

            if (typeof explorationSystem !== "undefined") {
                explorationSystem.cancelActiveTypewriter();
            }
            this.hideFloatingArrow();
            this.disableTapOverlay();

            // Preserve current system version and merge defaults for old saves.
            const currentVersion = RPG.State.version;
            const defaultState = JSON.parse(JSON.stringify(RPG.DefaultState));
            const mergedState = {
                ...defaultState,
                ...loadedState,
                flags: { ...defaultState.flags, ...(loadedState.flags || {}) },
                inventory: { ...defaultState.inventory, ...(loadedState.inventory || {}) },
                debug: { ...defaultState.debug, ...(loadedState.debug || {}) },
                saveMeta: { ...defaultState.saveMeta, ...(loadedState.saveMeta || {}) }
            };

            // Retired keys may still exist in older saves; do not reintroduce
            // confirmed-unreferenced state into the live runtime object.
            ["gotTestCoin", "forest8mTreeHintShown", "duelCoinAwarded"].forEach(flag => {
                delete mergedState.flags[flag];
            });
            delete mergedState.talkIndex;
            delete mergedState.battleStatus;

            // Preserve the shared RPG.State object identity while removing values
            // that belong only to the previously active save slot.
            Object.keys(RPG.State).forEach(key => delete RPG.State[key]);
            Object.assign(RPG.State, mergedState);

            // Older builds could record the same one-time event twice because
            // both the event action and the event manager appended its ID.
            RPG.State.completedEvents = Array.isArray(RPG.State.completedEvents)
                ? [...new Set(RPG.State.completedEvents)]
                : [];

            // Older saves can store coins in only one of these legacy fields.
            if (RPG.State.flags.silverDelivered === true) {
                RPG.State.silverCoins = 0;
                RPG.State.inventory.silverCoin = 0;
            } else {
                const savedCurrency = Number(RPG.State.silverCoins) || 0;
                const savedInventoryCoins = Number(RPG.State.inventory.silverCoin) || 0;
                const syncedCoins = Math.max(savedCurrency, savedInventoryCoins);
                RPG.State.silverCoins = syncedCoins;
                RPG.State.inventory.silverCoin = syncedCoins;
            }
            RPG.State.version = currentVersion;
            this.addLog(`${sourceLabel}から旅を再開した。`, "item");
            this.updateUI();
            this.closeSaveModal();
        } catch (error) {
            this.addLog("記録の読み込みに失敗した。", "damage");
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

    // A restrained wobble for brief disorientation scenes without a light flash.
    screenDizzy: function () {
        const body = document.body;
        body.style.transition = "transform 0.12s ease-in-out";
        body.style.transform = "translate(2px, -1px) rotate(0.15deg)";
        setTimeout(() => body.style.transform = "translate(-2px, 1px) rotate(-0.15deg)", 120);
        setTimeout(() => {
            body.style.transform = "none";
            body.style.transition = "";
        }, 250);
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
        if (
            typeof explorationSystem !== "undefined" &&
            explorationSystem.completeActiveTypewriter()
        ) {
            return;
        }

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
        if (typeof explorationSystem !== "undefined") {
            explorationSystem.cancelActiveTypewriter();
        }
        this.hideFloatingArrow();
        this.disableTapOverlay();
        RPG.State.isWaitingForInput = false;
        RPG.State.dialogueQueue = [];
        RPG.State.dialogueIndex = 0;
        RPG.State.mode = "base";
        if (typeof visualDirector !== "undefined") {
            visualDirector.clearInnScene();
        }
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
            overlay.onclick = () => this.handlePlayerInput();
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
    flashFullScreen: function (color = "#ff0000", duration = 500, opacity = 0.7) {
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: ${color};
            opacity: ${opacity};
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

    // Slow full-screen fade for irreversible scene changes such as a bad end.
    fadeFullScreen: function (color = "#000000", duration = 2000) {
        const fade = document.createElement('div');
        fade.style.cssText = `
            position: fixed;
            inset: 0;
            background: ${color};
            opacity: 0;
            transition: opacity ${duration}ms ease-in;
            z-index: 9998;
            pointer-events: none;
        `;
        document.body.appendChild(fade);

        requestAnimationFrame(() => {
            fade.style.opacity = '1';
        });

        return fade;
    },

    // Build 14.2.1: Wagon Choice System
    showWagonChoice: function () {
        const container = document.getElementById('action-buttons');
        const choiceUI = document.getElementById('choiceUI');
        const exploreUI = document.getElementById('exploreUI');
        const innUI = document.getElementById('innUI');
        if (!container) return;

        container.innerHTML = '';
        container.style.display = 'flex';
        if (choiceUI) choiceUI.style.display = 'none';
        // Build 15.2.x fix: hide exploration/inn buttons so they can't be
        // triggered underneath the wagon choice while it's on screen.
        if (exploreUI) exploreUI.style.display = 'none';
        if (innUI) innUI.style.display = 'none';

        // Build 15.2.x fix: unique IDs so this dynamically-created choice
        // never collides with the static #choiceUI btnChoiceA/btnChoiceB
        // buttons (whose onclick handlers are reassigned by other events,
        // e.g. the herb garden brooch choice via getElementById).
        const btnAccept = document.createElement('button');
        btnAccept.id = 'btnWagonAccept';
        btnAccept.className = 'btn btn-full';
        btnAccept.textContent = 'もちろん';
        btnAccept.onclick = () => this.acceptWagonRide();

        const btnWait = document.createElement('button');
        btnWait.id = 'btnWagonWait';
        btnWait.className = 'btn btn-full';
        btnWait.textContent = 'ちょっと待ってくれ';
        btnWait.onclick = () => this.declineWagonRide();

        container.appendChild(btnAccept);
        container.appendChild(btnWait);

        // Prevent updateUI from overwriting these buttons immediately
        RPG.State.mode = "choice";
    },


    acceptWagonRide: function () {
        // Guard against double-fire (e.g. rapid double click)
        if (RPG.State.flags.onWagon === true) return;

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

        RPG.State.mode = "event";
        RPG.State.dialogueQueue = [
            { text: "御者「早くしてくれよ」" },
            {
                text: null,
                action: () => {
                    RPG.State.mode = "base";
                    this.updateUI();
                }
            }
        ];
        explorationSystem.playDialogueLoop();
    }
};

// Build 13.0.0: Global Input & Key Listeners
document.addEventListener('keydown', function (event) {
    const isDialogueInput = event.code === 'Space' || event.code === 'Enter';
    const isTypewriterActive =
        typeof explorationSystem !== "undefined" &&
        explorationSystem.hasActiveTypewriter();

    if (isDialogueInput && (RPG.State.isWaitingForInput || isTypewriterActive)) {
        event.preventDefault();
        if (event.repeat && event.code !== 'Space') return;
        uiControl.handlePlayerInput();
    }
});

// Initial binding for the overlay (dynamically managed but good to have reference)
const overlay = document.getElementById('tap-overlay');
if (overlay) {
    overlay.onclick = () => uiControl.handlePlayerInput();
}

// 🚩ーー【Build 14.1.0: Scenario Event System (Refactored)】ーー
// Extracted from inn.js to separate Scenario Logic from Inn Systems
// Migrated to RPG.State Namespace

const scenarioEvents = {
    // 🏃‍♂️ Thief Boy Pursuit Events
    thiefBoyEvent: {
        // Handle collision when entering the Inn
        handleInnEntranceCollision: function () {
            const state = RPG.State;
            // Build 12.4.2: Trigger ONLY at "Inn Front"
            if (state.location === "宿屋前" && state.flags.readyForThiefBoy === true) {
                state.mode = "event";

                // Screen Shake Effect
                const body = document.body;
                body.style.transition = "transform 0.1s";
                body.style.transform = "translateX(5px)";
                setTimeout(() => body.style.transform = "translateX(-5px)", 50);
                setTimeout(() => body.style.transform = "translateX(5px)", 100);
                setTimeout(() => {
                    body.style.transform = "none";
                    body.style.transition = "";
                }, 150);

                // Build 12.3.7: Fix Data Mutation (Use Spread Operator)
                state.dialogueQueue = [...RPG.Assets.GAME_TEXT.events.thiefCollision];
                explorationSystem.playDialogueLoop();
                return true; // Signal that event was triggered
            }
            // Build 8.57: Legacy trigger support
            if (state.flags.thiefTrackActive && state.location === "宿屋前" && !state.flags.giantLarvaDefeated) {
                state.mode = "event";
                state.dialogueQueue = RPG.Assets.GAME_TEXT.events.thiefInnEntrance;
                explorationSystem.playDialogueLoop();
                return true;
            }
            return false;
        }
    },

    // 🌳 Amber Tree Scenario Engine
    treeEventSystem: {
        showChoices: function () {
            // Build 15.2.0: Rely on centralized uiControl.updateUI() for DOM management
            const state = RPG.State;
            state.mode = "choice";
            
            // This call triggers updateControlPanels which will HIDE exploration and SHOW choice UI
            uiControl.updateUI();

            const btnChoiceA = document.getElementById('btnChoiceA');
            const btnChoiceB = document.getElementById('btnChoiceB');

            if (btnChoiceA) {
                btnChoiceA.textContent = "銀貨を取る";
                btnChoiceA.onclick = () => this.choiceTakeCoin();
                btnChoiceA.style.background = ""; // Clear any boss styling
            }
            if (btnChoiceB) {
                btnChoiceB.textContent = "やめておく";
                btnChoiceB.onclick = () => this.choiceLeave();
                btnChoiceB.style.background = "";
            }
        },

        clearChoices: function () {
            const choiceUI = document.getElementById('choiceUI');
            if (choiceUI) choiceUI.style.display = 'none';
        },

        choiceTakeCoin: function () {
            this.clearChoices();
            RPG.State.mode = "event";
            RPG.State.playerTookCoin = true;

            const te = RPG.Assets.GAME_TEXT.treeEvent;
            
            // Build 15.1.9: Standard Log Scroll Result
            RPG.State.dialogueQueue = [
                { text: te.desc1, delay: 1000 },
                { text: te.owen1, color: "#a020f0", delay: 1000 },
                { text: te.cain1, delay: 1000 },
                { text: te.trans1, delay: 1500 },
                { 
                    text: null, 
                    action: () => {
                        battleSystem.startBattle('hungry_amber_tree');
                    }
                }
            ];
            explorationSystem.playDialogueLoop();
        },

        choiceLeave: function () {
            this.clearChoices();
            RPG.State.mode = "event";
            RPG.State.playerTookCoin = false;

            const te = RPG.Assets.GAME_TEXT.treeEvent;
            
            // Build 15.1.9: Standard Log Scroll Result
            RPG.State.dialogueQueue = [
                { text: te.cain2_1, delay: 1000 },
                { text: te.owen2, color: "#a020f0", delay: 1000 },
                { text: te.action2, delay: 1000 },
                { text: te.cain2_2, delay: 1000 },
                { text: te.finish2, delay: 1500 },
                { 
                    text: null, 
                    action: () => {
                        battleSystem.startBattle('hungry_amber_tree');
                    }
                }
            ];
            explorationSystem.playDialogueLoop();
        },

        handleEncounter: function (step = 0) {
            // Build 15.1.3: Centralized Encounter Logic (Refined Spatial Trigger)
            const state = RPG.State;
            const isForwardMove = step > 0;
            const isTreeEncounterDepth = state.currentDistance >= 8 && state.currentDistance <= 10;
            
            // Build 15.1.8: Sequential Event Guard
            // Prevent spatial triggers if a Kill Count or other dialogue is still active
            if (state.dialogueQueue && state.dialogueQueue.length > 0) return false;
            
            // --- Case A: Rematch Logic (Spatial) ---
            if (state.flags.isTreeRematch === true) {
                // 9m: The Resolve (Cinematic Beat)
                if (isForwardMove && state.currentDistance === 9) {
                    uiControl.addLog("カイン「…あそこに、さっきの木の化け物がいる。俺たちで倒せるだろうか」", "", "#ffffff");
                    uiControl.addLog("オーエン「僕は手伝わないよ。アレはおまえ指名でしょ。」", "", "#a020f0");
                    return false; // Let base system continue to update UI
                }
                
                // 10m: The Ambush (Instant Battle)
                if (isForwardMove && state.currentDistance === 10) {
                    state.mode = "event";
                    state.flags.hasTreeEventOccurred = true;
                    battleSystem.startBattle('hungry_amber_tree');
                    return true;
                }
                return false;
            }

            // --- Case B: Standard First Encounter ---
            // Build 15.2.55: The first amber tree encounter is now triggered by
            // inspecting at forest 8m instead of moving into a distance band.
            return false;
        }
    }
};

console.log("DEBUG: scenarioEvents.js Build Check:", RPG.State.version);

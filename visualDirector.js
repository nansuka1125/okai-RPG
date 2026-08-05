// Presentation-only scene coordinator. Nothing in this object is serialized.
const visualDirector = {
    travelActive: false,
    travelTimer: null,
    battleCueTimer: null,
    innSceneOverride: null,
    sceneOverride: null,
    lastEnemySymbol: "×",

    enemySymbols: {
        rat: "×",
        hell_rat_swarm: "× × ×",
        normal_rat: "·",
        weasel: "⌁",
        skull_bee: "✦",
        eye_eating_crow: "⌃",
        carnivorous_vine: "⌇",
        sap: "◉",
        hungry_amber_tree: "╫",
        giant_larva: "≋",
        amber_husk_giant_larva: "≋",
        glowing_cat_rabbit: "✧"
    },

    isReducedMotion: function () {
        return Boolean(
            window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        );
    },

    isAmberForestScene: function () {
        return (
            RPG.State.isAtInn !== true &&
            RPG.State.isInDungeon === true &&
            RPG.State.explorationArea === "forest" &&
            RPG.State.location !== "かつての街道"
        );
    },

    getInnScene: function () {
        if (RPG.State.isAtInn !== true) return null;
        if (this.innSceneOverride === "none") return null;
        return this.innSceneOverride || "lobby";
    },

    getActiveScene: function () {
        if (this.sceneOverride) return this.sceneOverride;

        const innScene = this.getInnScene();
        if (innScene) return `inn-${innScene}`;

        if (RPG.State.isAtInn === true) return null;

        if (
            RPG.State.location === "宿屋前" &&
            RPG.State.isInDungeon !== true
        ) {
            return "inn-front";
        }

        if (RPG.State.explorationArea === "herbGarden") {
            // Ahead of the distance checks: the nest is a location override that sits at
            // distance 0, so the entrance backdrop would otherwise win.
            if (RPG.State.location === "肉食カズラの巣") return "vine-nest";

            const distance = Number(RPG.State.currentDistance) || 0;
            if (distance <= 0) return "herb-garden-entrance";
            if (distance < 7) return "herb-garden-deep";
            return "herb-garden";
        }

        if (RPG.State.location === "かつての街道") {
            return "former-highway";
        }

        if (this.isAmberForestScene()) {
            if (RPG.State.flags && RPG.State.flags.onWagon === true) return "wagon";

            if (RPG.State.location === "森小屋前") return "forest-hut-front";
            if (RPG.State.location === "森小屋内部") return "forest-hut-interior";

            const distance = Number(RPG.State.currentDistance) || 0;
            if (distance >= 10) return "forest-10m";
            if (distance >= 7) {
                return this.isNightTime() ? "forest-deep-night" : "forest-deep-day";
            }
            return "forest";
        }

        return null;
    },

    // Where the rain is actually drawn, as opposed to explorationSystem.isRainActive(),
    // which only says whether the rain period is running at all. Before the giant larva
    // is beaten the storm is only visible in the deep forest (7m+), which is where its
    // "雨が降り始めた……" line fires; once the boss is down it is visible across the whole
    // forest and at the inn's front yard. Inn interiors never show it.
    //
    // Deliberately not gated on isBattling: a fight keeps the location state it started
    // from, so the same place test answers for both exploration and battle and the rain
    // carries straight through an encounter instead of blinking out at the transition.
    shouldShowRainVisual: function () {
        if (typeof explorationSystem === "undefined") return false;
        if (explorationSystem.isRainActive() !== true) return false;

        if (RPG.State.isAtInn === true) return false;

        const inForest = this.isAmberForestScene();
        const atInnFront = (
            RPG.State.location === "宿屋前" &&
            RPG.State.isInDungeon !== true
        );

        if (RPG.State.flags.giantLarvaDefeated !== true) {
            // silverDelivered is deliberately not consulted here; the rain period only
            // ends through isRainActive()'s phase6PostDeliverySleepDone check.
            const distance = Number(RPG.State.currentDistance) || 0;
            return inForest && distance >= 7;
        }

        return inForest || atInnFront;
    },

    isNightTime: function () {
        const threshold = RPG.Config.NIGHT_STEP_THRESHOLD || 20;
        return (Number(RPG.State.travelStepsSinceStay) || 0) >= threshold;
    },

    setInnScene: function (sceneName) {
        const validScenes = [
            "lobby",
            "storage",
            "stable",
            "room",
            "stable-back-day",
            "stable-back-night",
            "none"
        ];
        this.innSceneOverride = validScenes.includes(sceneName) ? sceneName : null;
        this.syncScene();
    },

    clearInnScene: function () {
        this.innSceneOverride = null;
        this.syncScene();
    },

    // State-independent scene override for cutscenes that must show a location's backdrop
    // (e.g. the forest) without moving the player's actual exploration state there.
    setScene: function (sceneName) {
        this.sceneOverride = sceneName;
        this.syncScene();
    },

    clearScene: function () {
        this.sceneOverride = null;
        this.syncScene();
    },

    getEnemySymbol: function (enemy) {
        if (!enemy) return this.lastEnemySymbol;
        return enemy.symbol || this.enemySymbols[enemy.id] || "×";
    },

    syncScene: function () {
        const body = document.body;
        if (!body || !RPG.State) return;

        const activeScene = this.getActiveScene();
        const forestScenes = [
            "forest",
            "forest-deep-day",
            "forest-deep-night",
            "forest-10m",
            "forest-hut-front",
            "forest-hut-interior"
        ];
        const innScenes = [
            "inn-lobby",
            "inn-storage",
            "inn-stable",
            "inn-room",
            "inn-stable-back-day",
            "inn-stable-back-night"
        ];
        const sceneClasses = [
            ...forestScenes,
            ...innScenes,
            "inn-front",
            "herb-garden-entrance",
            "herb-garden",
            "herb-garden-deep",
            "vine-nest",
            "wagon",
            "former-highway"
        ];
        const isForest = forestScenes.includes(activeScene);
        const isInn = innScenes.includes(activeScene);
        const showBattle = Boolean(RPG.State.isBattling && RPG.State.currentEnemy);
        const exploreUI = document.getElementById("exploreUI");
        const enemySymbolLabel = document.getElementById("enemySymbolLabel");

        body.classList.toggle("scene-backdrop-active", Boolean(activeScene));
        body.classList.toggle("scene-forest", isForest);
        body.classList.toggle("scene-inn", isInn);
        body.classList.toggle("time-night", this.isNightTime());
        sceneClasses.forEach(sceneName => {
            body.classList.toggle(`scene-${sceneName}`, activeScene === sceneName);
        });
        body.classList.toggle("scene-battle", showBattle);

        // Rain is presentation-only: derived fresh from the existing isRainActive()
        // window plus the current location, never stored.
        body.classList.toggle("rain-active", this.shouldShowRainVisual());

        if (exploreUI) {
            exploreUI.classList.toggle(
                "explore-forest",
                isForest && RPG.State.isAtInn !== true
            );
        }

        if (enemySymbolLabel) enemySymbolLabel.textContent = "👾";
    },

    playTravel: function ({ direction, targetDistance, maxDistance, onComplete }) {
        if (this.travelActive) return false;

        const body = document.body;
        const marker = document.getElementById("progressMarker");
        const trail = document.getElementById("progressTrail");
        const reducedMotion = this.isReducedMotion();
        const duration = reducedMotion ? 80 : 460;
        const directionClass = direction < 0 ? "travel-backward" : "travel-forward";

        this.travelActive = true;
        if (body) {
            body.classList.remove("travel-forward", "travel-backward");
            body.classList.add("travel-active", directionClass);
        }

        if (marker && Number.isFinite(targetDistance) && maxDistance > 0) {
            const ratio = Math.max(0, Math.min(100, (targetDistance / maxDistance) * 100));
            marker.style.left = `clamp(5px, ${ratio}%, calc(100% - 5px))`;
            if (trail) {
                trail.style.width = `${ratio}%`;
                trail.classList.remove("trail-backward");
                if (direction < 0) trail.classList.add("trail-backward");
            }
        }

        clearTimeout(this.travelTimer);
        this.travelTimer = setTimeout(() => {
            if (body) {
                body.classList.remove("travel-active", "travel-forward", "travel-backward");
            }
            this.travelActive = false;
            this.travelTimer = null;
            if (typeof onComplete === "function") onComplete();
        }, duration);

        return true;
    },

    playBattleCue: function (type) {
        // An attempted enemy attack is already explained by the log. Only the
        // resolved hit reacts through the player HP bar, avoiding double motion.
        if (type === "enemy-attack") return;

        const battleInfo = document.getElementById("battleInfoRow");
        const playerHpBar = document.querySelector(".hp-bar-bg");
        if (!battleInfo || !playerHpBar) return;

        const cueClasses = [
            "cue-encounter",
            "cue-cain-attack",
            "cue-party-hit",
            "cue-owen-action",
            "cue-enemy-defeated",
            "cue-party-defeated"
        ];
        cueClasses.forEach(className => {
            battleInfo.classList.remove(className);
            playerHpBar.classList.remove(className);
        });

        const target = (type === "party-hit" || type === "party-defeated")
            ? playerHpBar
            : battleInfo;
        // Restart the short CSS animation even when the same action repeats.
        void target.offsetWidth;
        target.classList.add(`cue-${type}`);

        clearTimeout(this.battleCueTimer);
        this.battleCueTimer = setTimeout(() => {
            cueClasses.forEach(className => {
                battleInfo.classList.remove(className);
                playerHpBar.classList.remove(className);
            });
        }, this.isReducedMotion() ? 100 : 520);
    }
};

window.visualDirector = visualDirector;

// Presentation-only scene coordinator. Nothing in this object is serialized.
const visualDirector = {
    travelActive: false,
    travelTimer: null,
    battleCueTimer: null,
    innSceneOverride: null,
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

    isNightTime: function () {
        const threshold = RPG.Config.NIGHT_STEP_THRESHOLD || 20;
        return (Number(RPG.State.travelStepsSinceStay) || 0) >= threshold;
    },

    setInnScene: function (sceneName) {
        const validScenes = ["lobby", "storage", "stable", "room", "none"];
        this.innSceneOverride = validScenes.includes(sceneName) ? sceneName : null;
        this.syncScene();
    },

    clearInnScene: function () {
        this.innSceneOverride = null;
        this.syncScene();
    },

    getEnemySymbol: function (enemy) {
        if (!enemy) return this.lastEnemySymbol;
        return enemy.symbol || this.enemySymbols[enemy.id] || "×";
    },

    syncScene: function () {
        const body = document.body;
        if (!body || !RPG.State) return;

        const innScene = this.getInnScene();
        const isForest = this.isAmberForestScene();
        const showBattle = Boolean(RPG.State.isBattling && RPG.State.currentEnemy);
        const exploreUI = document.getElementById("exploreUI");
        const enemySymbolLabel = document.getElementById("enemySymbolLabel");

        body.classList.toggle("scene-forest", isForest);
        body.classList.toggle("scene-inn", Boolean(innScene));
        body.classList.toggle("time-night", this.isNightTime());
        ["lobby", "storage", "stable", "room"].forEach(sceneName => {
            body.classList.toggle(`scene-inn-${sceneName}`, innScene === sceneName);
        });
        body.classList.toggle("scene-battle", showBattle);

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

(() => {
    const SAVE_SLOTS = [
        { resume: "suspend", storageKey: "okai_rpg_suspend", label: "中断記録" },
        { resume: "1", storageKey: "okai_rpg_save_1", label: "第一頁" },
        { resume: "2", storageKey: "okai_rpg_save_2", label: "第二頁" },
        { resume: "3", storageKey: "okai_rpg_save_3", label: "第三頁" },
        { resume: "4", storageKey: "okai_rpg_save_4", label: "第四頁" },
        { resume: "5", storageKey: "okai_rpg_save_5", label: "第五頁" }
    ];

    const formatSaveTime = savedAt => {
        if (!savedAt) return "以前の記録";
        const date = new Date(savedAt);
        if (Number.isNaN(date.getTime())) return "以前の記録";
        return new Intl.DateTimeFormat("ja-JP", {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);
    };

    const readSlot = slot => {
        const serialized = localStorage.getItem(slot.storageKey);
        if (!serialized) return { ...slot, status: "empty" };

        try {
            const data = JSON.parse(serialized);
            if (!data || typeof data !== "object" || Array.isArray(data)) {
                throw new Error("Invalid save data");
            }

            const meta = data.saveMeta && typeof data.saveMeta === "object"
                ? data.saveMeta
                : {};
            const savedAtMs = Date.parse(meta.savedAt);
            const hasComparableTime = Number.isFinite(savedAtMs);
            const memo = typeof meta.memo === "string" && meta.memo.trim()
                ? meta.memo.trim()
                : "旅の記録";
            const location = meta.location || data.location || "場所不明";
            const level = Number(data.cainLv) || 1;

            return {
                ...slot,
                status: "valid",
                data,
                savedAtMs: hasComparableTime ? savedAtMs : null,
                summary: `${memo}\n${formatSaveTime(meta.savedAt)} ・ ${location} ・ Lv.${level}`
            };
        } catch (error) {
            return { ...slot, status: "corrupt" };
        }
    };

    const navigateToSlot = slot => {
        window.location.assign(`chapter1.html?resume=${encodeURIComponent(slot.resume)}`);
    };

    window.addEventListener("DOMContentLoaded", () => {
        const newGameButton = document.getElementById("newGameButton");
        const savePickerList = document.getElementById("savePickerList");
        const startupError = document.getElementById("startupError");

        if (!newGameButton || !savePickerList) {
            return;
        }

        let slots;
        try {
            slots = SAVE_SLOTS.map(readSlot);
        } catch (error) {
            if (startupError) {
                startupError.hidden = false;
                startupError.textContent = "保存記録を確認できなかった。";
            }
            return;
        }

        slots.forEach(slot => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "save-picker-row";

            const label = document.createElement("strong");
            label.textContent = slot.label;
            const info = document.createElement("span");

            if (slot.status === "valid") {
                info.textContent = slot.summary;
                button.onclick = () => navigateToSlot(slot);
            } else {
                button.disabled = true;
                info.textContent = slot.status === "corrupt"
                    ? "記録を読み込めない。"
                    : "まだ何も書かれていない。";
            }

            button.append(label, info);
            savePickerList.appendChild(button);
        });

        if (new URLSearchParams(window.location.search).get("resumeError") === "1" && startupError) {
            startupError.hidden = false;
            startupError.textContent = "記録を読み込めなかった。別の記録を選んでください。";
        }

        newGameButton.onclick = () => {
            window.location.assign("chapter1.html?new=1");
        };
    });
})();

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

    const getDirectContinueSlot = validSlots => {
        if (validSlots.length === 1) return validSlots[0];
        if (
            validSlots.length > 1 &&
            validSlots.every(slot => slot.savedAtMs !== null)
        ) {
            return [...validSlots].sort((a, b) => b.savedAtMs - a.savedAtMs)[0];
        }
        return null;
    };

    const navigateToSlot = slot => {
        window.location.assign(`chapter1.html?resume=${encodeURIComponent(slot.resume)}`);
    };

    window.addEventListener("DOMContentLoaded", () => {
        const freshStartButton = document.getElementById("freshStartButton");
        const savedStartMenu = document.getElementById("savedStartMenu");
        const continueButton = document.getElementById("continueButton");
        const latestSaveInfo = document.getElementById("latestSaveInfo");
        const openSavePickerButton = document.getElementById("openSavePickerButton");
        const newGameButton = document.getElementById("newGameButton");
        const savePicker = document.getElementById("savePicker");
        const savePickerList = document.getElementById("savePickerList");
        const closeSavePickerButton = document.getElementById("closeSavePickerButton");
        const startupError = document.getElementById("startupError");

        if (
            !freshStartButton ||
            !savedStartMenu ||
            !continueButton ||
            !latestSaveInfo ||
            !openSavePickerButton ||
            !newGameButton ||
            !savePicker ||
            !savePickerList ||
            !closeSavePickerButton
        ) {
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

        const storedSlots = slots.filter(slot => slot.status !== "empty");
        const validSlots = slots.filter(slot => slot.status === "valid");
        const directContinueSlot = getDirectContinueSlot(validSlots);

        const closePicker = () => {
            savePicker.hidden = true;
            openSavePickerButton.focus();
        };
        const openPicker = () => {
            savePicker.hidden = false;
            const firstAvailable = savePickerList.querySelector("button:not(:disabled)");
            (firstAvailable || closeSavePickerButton).focus();
        };

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

        if (storedSlots.length > 0) {
            freshStartButton.hidden = true;
            savedStartMenu.hidden = false;

            if (directContinueSlot) {
                latestSaveInfo.textContent = directContinueSlot.summary;
                continueButton.onclick = () => navigateToSlot(directContinueSlot);
            } else {
                latestSaveInfo.textContent = validSlots.length > 0
                    ? "保存日時を比較できない記録があります。再開する記録を選んでください。"
                    : "読み込める記録がありません。";
                continueButton.onclick = openPicker;
            }
        }

        if (new URLSearchParams(window.location.search).get("resumeError") === "1" && startupError) {
            startupError.hidden = false;
            startupError.textContent = "記録を読み込めなかった。別の記録を選んでください。";
        }

        openSavePickerButton.onclick = openPicker;
        newGameButton.onclick = () => {
            if (!window.confirm("保存している旅の記録をすべて消して、はじめから開始しますか？")) {
                return;
            }
            try {
                SAVE_SLOTS.forEach(slot => localStorage.removeItem(slot.storageKey));
            } catch (error) {
                if (startupError) {
                    startupError.hidden = false;
                    startupError.textContent = "保存記録を削除できなかった。";
                }
                return;
            }
            window.location.assign("chapter1.html");
        };
        closeSavePickerButton.onclick = closePicker;
        savePicker.addEventListener("click", event => {
            if (event.target === savePicker) closePicker();
        });
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && !savePicker.hidden) closePicker();
        });
    });
})();

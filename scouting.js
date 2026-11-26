(() => {
    const EMBEDDED_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyiLAJlqh9GGTIc4HLJGShPdq6hVLprxKFJ7l9sQvuUhvJu460AxyFCb17YEpteV8ukeQ/exec";
    const STORAGE_KEY = "supernova_31742_biobuzz_scout_v1";
    const SCRIPT_URL_OVERRIDE_KEY = "supernova_31742_sheets_script_url_override";

    let entries = [];
    let photoData = "";
    let initialized = false;
    let remoteRefreshTimer = null;

    function getScriptUrl() {
        return (localStorage.getItem(SCRIPT_URL_OVERRIDE_KEY) || EMBEDDED_SCRIPT_URL).trim();
    }

    function showToast(message, type = "info") {
        let container = document.getElementById("scoutingToastContainer");
        if (!container) {
            container = document.createElement("div");
            container.id = "scoutingToastContainer";
            container.className = "scouting-toast-container";
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.className = `scouting-toast scouting-toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }

    function checkedValues(name) {
        return Array.from(document.querySelectorAll(`#pitScoutForm input[name="${name}"]:checked`))
            .map((input) => input.value);
    }

    function togglePhotoUpload(allowed) {
        const container = document.getElementById("photoUploadContainer");
        if (!container) return;
        container.hidden = !allowed;
        if (!allowed) removePhoto();
    }

    function removePhoto() {
        photoData = "";
        const input = document.getElementById("robotPhotoInput");
        const preview = document.getElementById("photoPreviewContainer");
        const image = document.getElementById("photoPreviewImg");
        if (input) input.value = "";
        if (image) image.removeAttribute("src");
        if (preview) preview.hidden = true;
    }

    function processPhoto(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement("canvas");
                const maxDimension = 900;
                let width = image.width;
                let height = image.height;

                if (width > height && width > maxDimension) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else if (height > maxDimension) {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }

                canvas.width = width;
                canvas.height = height;
                canvas.getContext("2d").drawImage(image, 0, 0, width, height);
                photoData = canvas.toDataURL("image/jpeg", 0.72);

                const preview = document.getElementById("photoPreviewContainer");
                const previewImage = document.getElementById("photoPreviewImg");
                previewImage.src = photoData;
                preview.hidden = false;
            };
            image.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    function updateSyncBadge(status = "unknown") {
        const label = document.getElementById("scoutingSyncLabel");
        const dot = document.getElementById("scoutingSyncDot");
        if (!label || !dot) return;

        if (!getScriptUrl()) {
            label.textContent = "Sheets Disconnected";
            dot.className = "scouting-sync-dot";
        } else if (status === "connected") {
            label.textContent = "Sheets Verified";
            dot.className = "scouting-sync-dot connected";
        } else if (status === "failed") {
            label.textContent = "Sheets Unreachable";
            dot.className = "scouting-sync-dot";
        } else {
            label.textContent = "Testing Sheets...";
            dot.className = "scouting-sync-dot";
        }
    }

    function openSettings() {
        document.getElementById("scoutingScriptUrl").value = getScriptUrl();
        document.getElementById("scoutingSettingsModal").hidden = false;
    }

    function closeSettings() {
        document.getElementById("scoutingSettingsModal").hidden = true;
    }

    function loadJsonp(url, params) {
        return new Promise((resolve, reject) => {
            const callbackName = `__supernovaSheetCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const script = document.createElement("script");
            const timeout = window.setTimeout(() => {
                cleanup();
                reject(new Error("Apps Script did not respond"));
            }, 12000);

            function cleanup() {
                window.clearTimeout(timeout);
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
            }

            window[callbackName] = (result) => {
                cleanup();
                resolve(result);
            };

            const query = new URLSearchParams(params);
            query.set("callback", callbackName);
            query.set("_", Date.now().toString());
            script.src = `${url}${url.includes("?") ? "&" : "?"}${query.toString()}`;
            script.onerror = () => {
                cleanup();
                reject(new Error("Could not reach Apps Script"));
            };
            document.head.appendChild(script);
        });
    }

    async function testConnection() {
        const url = getScriptUrl();
        if (!url) {
            showToast("Add an Apps Script Web App URL first.", "error");
            return false;
        }

        try {
            const result = await loadJsonp(url, { action: "test" });
            if (!result.ok) throw new Error(result.error || "Apps Script returned an error");
            const sheetLink = document.getElementById("scoutingOpenSheet");
            if (sheetLink && result.spreadsheetUrl) {
                sheetLink.href = result.spreadsheetUrl;
                sheetLink.hidden = false;
            }
            updateSyncBadge("connected");
            showToast("Google Sheets connection verified.", "success");
            return true;
        } catch (error) {
            updateSyncBadge("failed");
            showToast(`Sheets connection check failed: ${error.message}`, "error");
            return false;
        }
    }

    async function refreshRemoteEntries() {
        const url = getScriptUrl();
        if (!url) return;

        try {
            const result = await loadJsonp(url, { action: "entries" });
            if (!result.ok) throw new Error(result.error || "Could not read sheet entries");

            const remoteEntries = (result.entries || []).map((remoteEntry) => ({
                ...remoteEntry,
                id: remoteEntry.entryId || `sheet-${remoteEntry.teamNumber}-${remoteEntry.teamName}-${remoteEntry.timestamp}`
            }));

            const unsyncedLocalEntries = entries.filter((entry) =>
                entry.syncStatus === "submitted" || entry.syncStatus === "failed" || entry.syncStatus === "local"
            );

            const combinedEntries = [...unsyncedLocalEntries, ...remoteEntries];
            entries = combinedEntries.filter((entry, index, allEntries) =>
                allEntries.findIndex((candidate) =>
                    String(candidate.teamNumber) === String(entry.teamNumber) &&
                    candidate.teamName === entry.teamName
                ) === index
            );

            localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
            updateStats();
            renderTeamsList();
        } catch (error) {
            console.warn("Could not refresh Scouting entries:", error);
        }
    }

    async function pushEntry(entry) {
        const url = getScriptUrl();
        if (!url) return false;

        const payload = {
            entryId: entry.id,
            timestamp: entry.timestamp,
            teamNumber: entry.teamNumber,
            teamName: entry.teamName,
            gameElementsHandled: entry.gameElements.join(", "),
            scoringFieldTasks: entry.scoringCaps.join(", "),
            endgameSpecsVision: entry.endgameSpecs.join(", "),
            extraSpecs: entry.capabilitiesNotes,
            autoStartingPositions: entry.autoStarts.join(", "),
            autoActionsScoring: entry.autoActions.join(", "),
            autoPathDetails: entry.autoNotes,
            localOutreach: entry.localOutreach,
            globalOutreach: entry.globalOutreach,
            specialDetails: entry.specialInfo,
            photoPermission: entry.photoPermission,
            robotPhoto: entry.photoBase64 ? "Photo attached" : entry.photoPermission === "No" ? "Declined" : "No photo",
            photoBase64: entry.photoBase64 || "",
            photoMimeType: entry.photoMimeType || "",
            photoName: entry.photoName || ""
        };

        try {
            const beaconSent = navigator.sendBeacon
                ? navigator.sendBeacon(url, new Blob([JSON.stringify(payload)], { type: "text/plain;charset=utf-8" }))
                : false;

            if (!beaconSent) {
                await fetch(url, {
                    method: "POST",
                    mode: "no-cors",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify(payload)
                });
            }
            entry.synced = false;
            entry.syncStatus = "submitted";
            localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
            await refreshAfterSubmission(entry);
            return entry.syncStatus === "verified";
        } catch (error) {
            entry.synced = false;
            entry.syncStatus = "failed";
            localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
            return false;
        }
    }

    async function refreshAfterSubmission(entry) {
        for (let attempt = 0; attempt < 6; attempt += 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 1000));
            const url = getScriptUrl();

            try {
                const result = await loadJsonp(url, { action: "entries" });
                const remoteEntry = (result.entries || []).find((item) =>
                    (item.entryId && String(item.entryId) === String(entry.entryId || entry.id)) ||
                    (String(item.teamNumber) === String(entry.teamNumber) && item.teamName === entry.teamName)
                );

                if (remoteEntry) {
                    entry.syncStatus = "verified";
                    entry.synced = true;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
                    updateStats();
                    renderTeamsList();
                    showToast(`Verified Team #${entry.teamNumber} in Google Sheets.`, "success");
                    return;
                }
            } catch (error) {
                console.warn("Could not verify Scouting row:", error);
            }
        }

        entry.syncStatus = "submitted";
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        renderTeamsList();
        showToast(`Team #${entry.teamNumber} was submitted but could not be verified yet.`, "info");
    }

    function switchTab(tabName) {
        const formView = document.getElementById("scoutFormView");
        const teamsView = document.getElementById("scoutedTeamsView");
        const formTab = document.getElementById("scoutFormTab");
        const teamsTab = document.getElementById("scoutedTeamsTab");
        const showTeams = tabName === "teams";

        formView.hidden = showTeams;
        teamsView.hidden = !showTeams;
        formTab.classList.toggle("active", !showTeams);
        teamsTab.classList.toggle("active", showTeams);
        formTab.setAttribute("aria-selected", String(!showTeams));
        teamsTab.setAttribute("aria-selected", String(showTeams));
        if (showTeams) renderTeamsList();
    }

    function resetForm() {
        document.getElementById("pitScoutForm").reset();
        removePhoto();
        togglePhotoUpload(true);
    }

    function updateStats() {
        const safeEntries = Array.isArray(entries) ? entries : [];
        document.getElementById("scoutedCountBadge").textContent = safeEntries.length;
        document.getElementById("statTotalScouted").textContent = safeEntries.length;
        document.getElementById("statHiveScout").textContent = safeEntries.filter((entry) =>
            (entry.scoringCaps || []).includes("Launch into Hive")
        ).length;
        document.getElementById("statAutoScout").textContent = safeEntries.filter((entry) =>
            (entry.autoStarts || []).length && !(entry.autoStarts || []).includes("No Auto")
        ).length;
    }

    function escapeHtml(value) {
        const element = document.createElement("span");
        element.textContent = String(value || "");
        return element.innerHTML;
    }

    function renderTeamsList() {
        const container = document.getElementById("teamsListContainer");
        if (!container) return;

        const query = (document.getElementById("teamSearchInput").value || "").toLowerCase().trim();
        const filtered = entries.filter((entry) =>
            String(entry.teamNumber).toLowerCase().includes(query) ||
            entry.teamName.toLowerCase().includes(query)
        );

        if (!filtered.length) {
            container.innerHTML = '<div class="scouting-empty">No scouted teams match yet.</div>';
            return;
        }

        container.innerHTML = filtered.map((entry) => `
            <article class="scouting-team-card">
                <div class="scouting-team-card-header">
                    <div><strong>#${escapeHtml(entry.teamNumber)}</strong> ${escapeHtml(entry.teamName)}</div>
                    <span class="scouting-sync-status ${entry.syncStatus === "verified" ? "synced" : "pending"}">${entry.syncStatus === "verified" ? "Verified in Sheet" : entry.syncStatus === "submitted" ? "Submitted - Pending Verification" : "Local Only"}</span>
                </div>
                <p><strong>Capabilities:</strong> ${escapeHtml((entry.scoringCaps || []).join(", ") || "None listed")}</p>
                <p><strong>Auto:</strong> ${escapeHtml((entry.autoStarts || []).join(", ") || "None")} - ${escapeHtml((entry.autoActions || []).join(", ") || "No actions listed")}</p>
                <p class="scouting-team-time">${escapeHtml(entry.timestamp)}</p>
            </article>
        `).join("");
    }

    function exportCSV() {
        if (!entries.length) {
            showToast("No entries to export.", "error");
            return;
        }

        const headers = ["Timestamp", "Team Number", "Team Name", "Game Elements", "Scoring Tasks", "Endgame & Vision", "Extra Specs", "Auto Starts", "Auto Actions", "Auto Notes", "Local Outreach", "Global Outreach", "Special Info", "Photo Permission", "Synced"];
        const rows = entries.map((entry) => [
            entry.timestamp, entry.teamNumber, entry.teamName, entry.gameElements.join("; "), entry.scoringCaps.join("; "),
            entry.endgameSpecs.join("; "), entry.capabilitiesNotes, entry.autoStarts.join("; "), entry.autoActions.join("; "),
            entry.autoNotes, entry.localOutreach, entry.globalOutreach, entry.specialInfo, entry.photoPermission,
            entry.synced ? "Yes" : "No"
        ].map((value) => `"${String(value || "").replace(/"/g, '""')}"`).join(","));

        const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "FTC_31742_SuperNOVA_Pit_Scout.csv";
        link.click();
        URL.revokeObjectURL(link.href);
    }

    async function syncPending() {
        if (!getScriptUrl()) {
            openSettings();
            return;
        }
        const pending = entries.filter((entry) => !entry.synced);
        if (!pending.length) {
            showToast("All scouted teams have been submitted.", "success");
            return;
        }
        for (const entry of pending) await pushEntry(entry);
        updateStats();
        renderTeamsList();
        showToast(`Submitted ${pending.filter((entry) => entry.synced).length} team entry(ies). Refreshing sheet data.`, "success");
        refreshRemoteEntries();
    }

    function wireEvents() {
        document.getElementById("scoutingSettingsButton").addEventListener("click", openSettings);
        document.getElementById("scoutingSettingsClose").addEventListener("click", closeSettings);
        document.getElementById("scoutingSaveUrl").addEventListener("click", async () => {
            const url = document.getElementById("scoutingScriptUrl").value.trim();
            if (!url) {
                showToast("Enter a valid Apps Script Web App URL.", "error");
                return;
            }
            localStorage.setItem(SCRIPT_URL_OVERRIDE_KEY, url);
            updateSyncBadge("unknown");
            const verified = await testConnection();
            if (verified) closeSettings();
        });
        document.getElementById("scoutingResetUrl").addEventListener("click", () => {
            localStorage.removeItem(SCRIPT_URL_OVERRIDE_KEY);
            closeSettings();
            updateSyncBadge("unknown");
            showToast("Reset to the embedded Sheets connection.", "info");
        });
        document.getElementById("scoutFormTab").addEventListener("click", () => switchTab("form"));
        document.getElementById("scoutedTeamsTab").addEventListener("click", () => switchTab("teams"));
        document.getElementById("clearScoutingForm").addEventListener("click", () => {
            if (confirm("Clear all current form inputs?")) resetForm();
        });
        document.getElementById("robotPhotoInput").addEventListener("change", (event) => processPhoto(event.target.files[0]));
        document.getElementById("removeScoutingPhoto").addEventListener("click", removePhoto);
        document.querySelectorAll('input[name="photoPermission"]').forEach((radio) => {
            radio.addEventListener("change", () => togglePhotoUpload(radio.value === "Yes"));
        });
        document.getElementById("teamSearchInput").addEventListener("input", renderTeamsList);
        document.getElementById("exportScoutingCSV").addEventListener("click", exportCSV);
        document.getElementById("syncAllScouting").addEventListener("click", syncPending);

        document.getElementById("pitScoutForm").addEventListener("submit", async (event) => {
            event.preventDefault();
            const photoPermission = document.querySelector('input[name="photoPermission"]:checked').value;
            const entry = {
                id: Date.now(),
                timestamp: new Date().toLocaleString(),
                teamNumber: document.getElementById("teamNumber").value.trim(),
                teamName: document.getElementById("teamName").value.trim(),
                gameElements: checkedValues("gameElements"),
                scoringCaps: checkedValues("scoringCaps"),
                endgameSpecs: checkedValues("endgameSpecs"),
                capabilitiesNotes: document.getElementById("capabilitiesNotes").value.trim(),
                autoStarts: checkedValues("autoStarts"),
                autoActions: checkedValues("autoActions"),
                autoNotes: document.getElementById("autoNotes").value.trim(),
                localOutreach: document.getElementById("localOutreach").value.trim(),
                globalOutreach: document.getElementById("globalOutreach").value.trim(),
                specialInfo: document.getElementById("specialInfo").value.trim(),
                photoPermission,
                hasPhoto: Boolean(photoData),
                photoBase64: photoData,
                photoMimeType: photoData ? "image/jpeg" : "",
                photoName: photoData ? `31742-team-${document.getElementById("teamNumber").value.trim()}-${Date.now()}.jpg` : "",
                synced: false
            };

            entries.unshift(entry);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

            let submitted = false;
            if (getScriptUrl()) submitted = await pushEntry(entry);
            showToast(submitted ? `Team #${entry.teamNumber} submitted. Waiting for sheet verification.` : `Team #${entry.teamNumber} saved locally; Sheets is unreachable.`, submitted ? "info" : "error");

            resetForm();
            updateStats();
            renderTeamsList();
        });
    }

    window.initScoutingApp = function () {
        if (!document.getElementById("pitScoutForm") || initialized) return;
        initialized = true;
        entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").map((entry) => ({
            ...entry,
            gameElements: entry.gameElements || [],
            scoringCaps: entry.scoringCaps || [],
            endgameSpecs: entry.endgameSpecs || [],
            autoStarts: entry.autoStarts || [],
            autoActions: entry.autoActions || [],
            photoBase64: entry.photoBase64 || "",
            photoMimeType: entry.photoMimeType || "",
            photoName: entry.photoName || "",
            syncStatus: entry.syncStatus || (entry.synced ? "submitted" : "local")
        }));
        updateSyncBadge("unknown");
        updateStats();
        renderTeamsList();
        wireEvents();
        testConnection().then((connected) => {
            if (connected) refreshRemoteEntries();
        });
        if (!remoteRefreshTimer) {
            remoteRefreshTimer = window.setInterval(refreshRemoteEntries, 30000);
        }
    };
})();

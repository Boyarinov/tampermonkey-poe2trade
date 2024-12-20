// ==UserScript==
// @name         PoE2 live search spammer
// @namespace    http://tampermonkey.net/
// @version      2024-12-19
// @description  
// @match        https://*.pathofexile.com/trade2/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=pathofexile.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let isEnabled = false;
    let currentHref = window.location.href;
    let isLivePage = currentHref.includes("/live");
    let toggleButton = null; // Auto Send button
    let saveLi = null;       // Save Preset tab li
    let loadLi = null;       // Load Preset tab li

    // Styles for enabled button and tabs
    const style = document.createElement('style');
    style.textContent = `
        .toggle-script-btn.enabled {
            background-color: green !important;
            color: #fff !important;
        }

        /* Keep Save/Load tabs similar to the About/Settings tabs */
        .nav-tabs.account .menu-save,
        .nav-tabs.account .menu-load {
            float: right;
            height: 32px;
        }

        /* Disabled state for Save Preset */
        .menu-save.disabled > a,
        .menu-save.disabled > a:hover {
            color: #aaa;
            cursor: not-allowed;
        }

        /* Preset list styling in the modal */
        .preset-name {
            display: inline-block;
            max-width: 70%;
            overflow: hidden;
            text-overflow: ellipsis;
            vertical-align: middle;
        }
        .preset-hash {
            float: right;
            color: #666;
            font-size: 0.9em;
            font-style: italic;
        }
    `;
    document.head.appendChild(style);

    function sendWhisper(token) {
        fetch("https://www.pathofexile.com/api/trade2/whisper", {
            method: "POST",
            body: JSON.stringify({ token: token }),
            headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest"
            },
        });
    }

    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function() {
        if (isEnabled && isLivePage && arguments?.[1]?.startsWith("/api/trade2/fetch/")) {
            this.addEventListener('load', function() {
                const result = JSON.parse(this.responseText)?.result;
                if (Array.isArray(result)) {
                    result.forEach(item => {
                        const token = item?.listing?.whisper_token;
                        if (token) {
                            sendWhisper(token);
                        }
                    });
                }
            });
        }
        return origOpen.apply(this, arguments);
    };

    function getPresets() {
        const data = localStorage.getItem('poe_presets');
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch (e) {
            return [];
        }
    }

    function savePresets(presets) {
        localStorage.setItem('poe_presets', JSON.stringify(presets));
    }

    // Extract hash code from URL if available
    function getHashFromUrl(url) {
        const u = new URL(url);
        const segments = u.pathname.split('/').filter(s => s !== '');
        const standardIndex = segments.indexOf("Standard");
        if (standardIndex !== -1 && standardIndex < segments.length - 1) {
            let potentialHash = segments[standardIndex + 1];
            if (potentialHash === "live") {
                return null; // no hash if only "live" after Standard
            } else {
                // If last segment is "live", hash is second last. Otherwise just potentialHash.
                if (segments[segments.length - 1] === "live") {
                    return potentialHash;
                } else {
                    return potentialHash;
                }
            }
        }
        return null;
    }

    function updateButtonState() {
        const nowLive = window.location.href.includes("/live");
        isLivePage = nowLive;

        if (toggleButton) {
            if (isLivePage) {
                toggleButton.disabled = false;
                toggleButton.innerHTML = `<span>${isEnabled ? 'Auto Send: On' : 'Auto Send: Off'}</span>`;
                if (isEnabled) {
                    toggleButton.classList.add('enabled');
                } else {
                    toggleButton.classList.remove('enabled');
                }
            } else {
                isEnabled = false;
                toggleButton.disabled = true;
                toggleButton.innerHTML = '<span>Waiting for live...</span>';
                toggleButton.classList.remove('enabled');
            }
        }

        if (saveLi) {
            const hash = getHashFromUrl(window.location.href);
            const presets = getPresets();
            if (hash) {
                // Check if this hash is already saved
                const exists = presets.some(p => p.hash === hash);
                if (exists) {
                    saveLi.classList.add('disabled');
                } else {
                    saveLi.classList.remove('disabled');
                }
            } else {
                saveLi.classList.add('disabled');
            }
        }

        if (loadLi) {
            loadLi.classList.remove('disabled');
        }
    }

    function addToggleButton() {
        const interval = setInterval(() => {
            const clearButton = document.querySelector('.controls-right .clear-btn');
            if (clearButton) {
                clearInterval(interval);

                toggleButton = document.createElement('button');
                toggleButton.type = 'button';
                toggleButton.className = 'btn toggle-script-btn';

                toggleButton.addEventListener('click', () => {
                    if (isLivePage) {
                        isEnabled = !isEnabled;
                        toggleButton.innerHTML = `<span>${isEnabled ? 'Auto Send: On' : 'Auto Send: Off'}</span>`;
                        if (isEnabled) {
                            toggleButton.classList.add('enabled');
                        } else {
                            toggleButton.classList.remove('enabled');
                        }
                    }
                });

                if (isLivePage) {
                    toggleButton.disabled = false;
                    toggleButton.innerHTML = '<span>Auto Send: Off</span>';
                } else {
                    toggleButton.disabled = true;
                    toggleButton.innerHTML = '<span>Waiting for live...</span>';
                }

                clearButton.insertAdjacentElement('beforebegin', toggleButton);
            }
        }, 500);
    }

    function insertPresetTabs() {
        const interval = setInterval(() => {
            const navTabs = document.querySelector('.nav.nav-tabs.account');
            const settingsTab = navTabs && navTabs.querySelector('.menu-settings');
            if (settingsTab) {
                clearInterval(interval);

                // Insert Save Preset tab after settings
                saveLi = document.createElement('li');
                saveLi.setAttribute('role', 'presentation');
                saveLi.className = 'menu-save disabled'; // initially disabled
                const saveA = document.createElement('a');
                saveA.href = '#';
                saveA.className = 'save-preset-link';
                saveA.innerHTML = '<span>Save Preset</span>';
                saveA.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (saveLi.classList.contains('disabled')) return; // no action if disabled
                    const presetName = prompt("Enter preset name:");
                    if (!presetName) return;
                    let url = window.location.href;
                    // Remove /live if present
                    if (url.endsWith("/live")) {
                        url = url.slice(0, -5);
                    }
                    const hash = getHashFromUrl(url);
                    if (!hash) return;
                    const presets = getPresets();
                    // If hash already exists, do not save
                    const exists = presets.some(p => p.hash === hash);
                    if (exists) {
                        alert("This URL (hash) is already saved.");
                        return;
                    }
                    const existing = presets.find(p => p.name === presetName);
                    if (existing) {
                        existing.url = url;
                        existing.hash = hash;
                    } else {
                        presets.push({ name: presetName, url: url, hash: hash });
                    }
                    savePresets(presets);
                    alert("Preset saved!");
                    updateButtonState();
                });
                saveLi.appendChild(saveA);
                settingsTab.insertAdjacentElement('afterend', saveLi);

                // Insert Load Preset tab after save
                loadLi = document.createElement('li');
                loadLi.setAttribute('role', 'presentation');
                loadLi.className = 'menu-load';
                const loadA = document.createElement('a');
                loadA.href = '#';
                loadA.className = 'load-preset-link';
                loadA.innerHTML = '<span>Load Preset</span>';
                loadA.addEventListener('click', (e) => {
                    e.preventDefault();
                    showLoadModal();
                });
                loadLi.appendChild(loadA);
                saveLi.insertAdjacentElement('afterend', loadLi);

                // Initial state update
                updateButtonState();
            }
        }, 500);
    }

    function showLoadModal() {
        const presets = getPresets();

        const style = document.createElement('style');
        style.textContent = `
        .preset-modal-overlay {
            position: fixed;
            top: 0; left: 0;
            width:100%; height:100%;
            background: rgba(0,0,0,0.5);
            z-index:99999;
            display:flex;
            align-items:center;
            justify-content:center;
        }
        .preset-modal {
            background:#fff;
            padding:20px;
            border-radius:8px;
            box-shadow:0 0 10px rgba(0,0,0,0.3);
            width: 70vw;
            height: 70vh;
            display: flex;
            flex-direction: column;
        }
        .preset-modal h2 {
            margin-top:0;
            flex: 0 0 auto;
        }
        .preset-list {
            flex: 1 1 auto;
            overflow:auto;
            margin-bottom:10px;
            border: 1px solid #ccc;
            border-radius:4px;
            padding: 10px;
        }
        .preset-item {
            padding:5px;
            border:1px solid #ccc;
            border-radius:4px;
            margin-bottom:5px;
            cursor:pointer;
            position: relative;
            background: #fff;
        }
        .preset-item.selected {
            background:#efefef;
        }
        .preset-modal-buttons {
            display:flex;
            justify-content: flex-end;
            gap:10px;
            flex: 0 0 auto;
        }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.className = 'preset-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'preset-modal';

        const title = document.createElement('h2');
        title.textContent = 'Load Preset';
        modal.appendChild(title);

        const listContainer = document.createElement('div');
        listContainer.className = 'preset-list';

        let selectedPreset = null;
        presets.forEach(p => {
            const item = document.createElement('div');
            item.className = 'preset-item';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'preset-name';
            nameSpan.textContent = p.name;
            const hashSpan = document.createElement('span');
            hashSpan.className = 'preset-hash';
            hashSpan.textContent = p.hash ? p.hash : '';

            item.appendChild(nameSpan);
            item.appendChild(hashSpan);

            item.addEventListener('click', () => {
                Array.from(listContainer.children).forEach(c => c.classList.remove('selected'));
                item.classList.add('selected');
                selectedPreset = p;
            });
            listContainer.appendChild(item);
        });

        modal.appendChild(listContainer);

        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'preset-modal-buttons';

        const setBtn = document.createElement('button');
        setBtn.textContent = 'Load';
        setBtn.addEventListener('click', () => {
            if (selectedPreset) {
                window.location.href = selectedPreset.url;
            } else {
                alert("Please select a preset first.");
            }
        });
        buttonsContainer.appendChild(setBtn);

        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', () => {
            if (!selectedPreset) {
                alert("Please select a preset to delete.");
                return;
            }
            const presets = getPresets();
            const index = presets.findIndex(pr => pr.hash === selectedPreset.hash);
            if (index !== -1) {
                presets.splice(index, 1);
                savePresets(presets);
                alert("Preset deleted.");
                overlay.remove();
            } else {
                alert("Preset not found.");
            }
        });
        buttonsContainer.appendChild(delBtn);

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => {
            overlay.remove();
        });
        buttonsContainer.appendChild(cancelBtn);

        modal.appendChild(buttonsContainer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    // fix SPA behavior
    setInterval(() => {
        if (currentHref !== window.location.href) {
            currentHref = window.location.href;
            updateButtonState();
        }
    }, 500);

    addToggleButton();
    insertPresetTabs();
})();

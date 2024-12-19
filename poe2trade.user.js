// ==UserScript==
// @name         PoE2 live search spammer
// @namespace    http://tampermonkey.net/
// @version      2024-12-18
// @description  auto send messages while live search is enabled
// @author       Svotin
// @match        https://www.pathofexile.com/trade2/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=pathofexile.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let isEnabled = false;
    let currentHref = window.location.href;
    let isLivePage = currentHref.includes("/live");
    let toggleButton = null;

    // inject custom styles for enabled button
    const style = document.createElement('style');
    style.textContent = `
        .toggle-script-btn.enabled {
            background-color: green !important;
            color: #fff !important;
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
                            sendWhisper(token)
                        }
                    });
                }
            });
        }
        return origOpen.apply(this, arguments);
    };

    function updateButtonState() {
        const nowLive = window.location.href.includes("/live");

        if (nowLive !== isLivePage) {
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
                    // not on '/live' page: disable the script and button
                    isEnabled = false;
                    toggleButton.disabled = true;
                    toggleButton.innerHTML = '<span>Waiting for live...</span>';
                    toggleButton.classList.remove('enabled');
                }
            }
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
                    // only toggle if on '/live' page
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

    // fix spa behavior
    setInterval(() => {
        if (currentHref !== window.location.href) {
            currentHref = window.location.href;
            updateButtonState();
        }
    }, 500);

    addToggleButton();
})();

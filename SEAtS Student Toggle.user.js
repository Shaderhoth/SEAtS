// ==UserScript==
// @name         SEAtS Student Toggle
// @namespace    http://tampermonkey.net/
// @version      2024-02-26
// @description  Make SEAtS *somewhat* GDPR safe
// @author       David Kuc
// @match        https://southampton.seats.cloud/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=undefined.
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    var hiddenText = false;
    var hiddenElements = true;
    var optionsPanel;
    var toggleButton;
    var toggleText;
    var toggleElements;
    const sensitiveContentSelectors = ['app-student-list'];

    const style = document.createElement("style");
    const style2 = document.createElement("style");
    hiddenElements ? (applyConditionalStyles()) : '';
    style2.textContent = hiddenText ? `body * { color: transparent !important; transition: color 0.3s ease; }` : '';
    function appendStyles() {
        if (document.head) {
            document.head.appendChild(style);
            document.head.appendChild(style2);
        } else {
            requestAnimationFrame(appendStyles);
        }
    }
    appendStyles();

    function setupUI() {
        if (document.body) {
            optionsPanel = createOptionsPanel();
            toggleButton = createToggleButton();
            document.body.appendChild(optionsPanel);
            setupAndObserveDOMChanges();
            window.addEventListener('hashchange', applyConditionalStyles, false);
        } else {
            requestAnimationFrame(setupUI);
        }
    }

    let dynamicallyHiddenElements = [];

    function applyConditionalStyles() {
        style.textContent = window.location.href.includes('/lectures/details/') ?  ' {app-timetable-list display: none !important; }' : '';
        style.textContent += sensitiveContentSelectors.join(', ') + ' { display: none !important; }'
    }

    function createToggleButton() {
        const button = document.createElement('button');
        button.innerText = 'Options';
        button.id = 'toggle-options';
        button.style.cssText = "background-color: rgb(141, 57, 112); color: white !important; font-family: 'Source Sans Pro'; font-size: 13px; font-weight: 400; border-radius: 5px; padding: 0 16px; line-height: 36px; border: none; cursor: pointer; margin: 5px;";
        button.addEventListener('click', () => optionsPanel.style.display = optionsPanel.style.display === 'none' ? 'block' : 'none');
        return button;
    }

    function createOptionsPanel() {
        const panel = document.createElement('div');
        panel.id = 'options-panel';
        panel.style.cssText = "display: none; position: fixed; top: 50px; left: 10px; background-color: #fff; border: 1px solid #ddd; padding: 10px; z-index: 1000; color: black;";
        toggleText = createOptionButton( hiddenText ? "Show All Text" : "Hide All Text", toggleTextVisibility);
        toggleElements = createOptionButton( hiddenElements ? "Show Hidden Elements" : "Hide Hidden Elements", toggleElementVisibility);
        panel.appendChild(toggleText);
        panel.appendChild(toggleElements);

        document.addEventListener('click', function(event) {
            if (!panel.contains(event.target) && event.target !== toggleButton) {
                panel.style.display = 'none';
            }
        });
        return panel;
    }

    function createOptionButton(text, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.cssText = "display: block; width: 100%; padding: 10px; margin-bottom: 10px; font-family: 'Source Sans Pro', sans-serif; font-size: 14px; background-color: #f7f7f7; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: black !important;";
        button.addEventListener('click', onClick);
        return button;
    }

    function toggleTextVisibility() {
        hiddenText = !hiddenText;
        style2.textContent = hiddenText ? `body * { color: transparent !important; transition: color 0.3s ease; }` : '';
        toggleText.textContent = hiddenText ? "Show All Text" : "Hide All Text";
    }

    function toggleElementVisibility() {
        hiddenElements = !hiddenElements;
        if (hiddenElements) {
            applyConditionalStyles();

            let elementsToRemove = [];
            dynamicallyHiddenElements.forEach(element => {
                try {
                    element.style.display = 'none';

                } catch(error) {
                    console.error(error);
                    elementsToRemove.push(element);

                }

            });
            dynamicallyHiddenElements.filter(node => ! (elementsToRemove.includes(node)) );
            toggleElements.textContent = "Show Hidden Elements";
        } else {
            style.textContent ='';
            let elementsToRemove = [];
            dynamicallyHiddenElements.forEach(element => {
                try {
                    element.style.display = element.getAttribute('data-original-display') || '';

                } catch(error) {
                    console.error(error);
                    elementsToRemove.push(element);

                }

            });
            dynamicallyHiddenElements.filter(node => !  (elementsToRemove.includes(node)) );
            toggleElements.textContent = "Hide Hidden Elements";
        }
    }


    function setupAndObserveDOMChanges() {
        const observer = new MutationObserver((mutationsList) => {
            mutationsList.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            hideSensitiveDataIfFound(node);
                        }
                    });
                }
            });

            if (toggleButton) {
                const toolbarElement = document.querySelector("mat-toolbar");
                if (toolbarElement && !toolbarElement.contains(toggleButton)) {
                    toolbarElement.insertBefore(toggleButton, toolbarElement.firstChild);
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }


    function hideSensitiveDataIfFound(node) {
        const patterns = {
            studentId: /\b\d{8}\b/,
            email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
            studentDetailsLink: /#\/student\/details\/\d+/
        };

        function isEffectivelyVisible(element) {
            while (element) {
                const style = window.getComputedStyle(element);
                if (style.display === 'none' || style.visibility === 'hidden') {
                    return false;
                }
                element = element.parentElement;
            }
            return true;
        }


        const checkNode = (element) => {
            if (!isEffectivelyVisible(element)) {
                return false;
            }

            let textContent = element.textContent || "";
            let hrefAttribute = element.getAttribute('href');

            const hasSensitiveData = (node) => {
                return patterns.studentId.test(node.textContent) || patterns.email.test(node.textContent) || patterns.studentDetailsLink.test(node.getAttribute('href')) || node.getAttribute('alt') == "Student image";
            };

            if (element.children.length === 0) {
                if (hasSensitiveData(element)){
                    console.log(element, 0);
                }

                return hasSensitiveData(element);
            }

            const checkChildrenForSensitiveData = (node) => {
                let style = window.getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden') {
                    return 0;
                }
                let sensitiveChildrenCount = 0
                Array.from(node.children).forEach(child => {
                    if (hasSensitiveData(child) || checkChildrenForSensitiveData(child) > 0) {
                        sensitiveChildrenCount++;
                    }
                });
                return sensitiveChildrenCount;
            };
            let sensitiveChildrenCount = checkChildrenForSensitiveData(element)
            if (sensitiveChildrenCount>1) {
                console.log(element, sensitiveChildrenCount);
                return true;
            }

            return false;
        };

        const searchAndHide = (node) => {
            if (node.nodeType !== Node.ELEMENT_NODE || window.getComputedStyle(node).display === 'none') {
                return;
            }

            node.querySelectorAll('*').forEach(element => {
                if (checkNode(element)) {
                    element.setAttribute('data-original-display', element.style.display || '');
                    element.style.display = 'none';
                    dynamicallyHiddenElements.push(element);
                }
            });
        };

        searchAndHide(node);
        if (dynamicallyHiddenElements.length > 0 && !hiddenText) {
            toggleTextVisibility();
            displayWarningAndProvideRevealOption();
        }
    }


    document.addEventListener('DOMContentLoaded', () => {
        setupUI();
        hideSensitiveDataIfFound(document.body);
    });

    function displayWarningAndProvideRevealOption() {
        const warningMsg = document.createElement('div');
        warningMsg.textContent = 'Potential leak discovered.\r\nText has been hidden.\r\nClick to reveal text.\r\n(Show hidden elements through the options tab on the top left)';
        warningMsg.style.position = 'fixed';
        warningMsg.style.setProperty('white-space','pre');
        warningMsg.style.setProperty('color', 'black', 'important');
        warningMsg.style.setProperty('font-size', '48');
        warningMsg.style.bottom = '10px';
        warningMsg.style.right = '10px';
        warningMsg.style.backgroundColor = 'yellow';
        warningMsg.style.padding = '10px';
        warningMsg.style.cursor = 'pointer';
        warningMsg.style.zIndex = '10000';
        warningMsg.onclick = () => {
            if (hiddenText) {toggleTextVisibility()};
            warningMsg.remove();
        };

        document.body.appendChild(warningMsg);
    }
})();
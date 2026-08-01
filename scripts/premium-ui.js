(function () {
    'use strict';

    // ── Grain Overlay ──
    function initGrainOverlay() {
        var grain = document.createElement('div');
        grain.id = 'grain-overlay';
        grain.setAttribute('aria-hidden', 'true');
        document.body.prepend(grain);
    }

    // ── Split-Text Reveal ──
    function initSplitText() {
        var targets = document.querySelectorAll('[data-split-text]');
        if (!targets.length) return;

        targets.forEach(function (el) {
            var wordIndex = 0;

            function wrapTextNodes(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    var text = node.textContent;
                    var parts = text.split(/(\s+)/);
                    var frag = document.createDocumentFragment();
                    parts.forEach(function (part) {
                        if (part.trim() === '') {
                            frag.appendChild(document.createTextNode(part));
                        } else {
                            var span = document.createElement('span');
                            span.className = 'split-word';
                            span.style.transitionDelay = wordIndex * 0.06 + 's';
                            span.textContent = part;
                            wordIndex++;
                            frag.appendChild(span);
                        }
                    });
                    node.parentNode.replaceChild(frag, node);
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    Array.from(node.childNodes).forEach(wrapTextNodes);
                }
            }

            Array.from(el.childNodes).forEach(wrapTextNodes);
            el.classList.add('split-text-ready');
        });

        // IntersectionObserver to trigger reveal
        var observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('split-text-visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.2 }
        );

        document.querySelectorAll('.split-text-ready').forEach(function (el) {
            observer.observe(el);
        });
    }

    // ── Page Transitions ──
    function initPageTransitions() {
        // Fade in on load
        document.body.classList.add('page-ready');

        // Intercept internal link clicks for smooth fade-out
        document.addEventListener('click', function (e) {
            var link = e.target.closest('a[href]');
            if (!link) return;

            var href = link.getAttribute('href');
            // Skip external links, anchors, mailto, tel, whatsapp, javascript, and new-tab links
            if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:') || link.target === '_blank') return;

            e.preventDefault();
            document.body.classList.add('page-exit');
            document.body.classList.remove('page-ready');
            setTimeout(function () {
                window.location.href = href;
            }, 200);
        });
    }

    // ── Safe Lucide wrapper ──
    // If the Lucide CDN fails to load (content blockers, slow CDN),
    // ensure it never crashes the page init.
    window.safeCreateIcons = function () {
        try {
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
            }
        } catch (e) {
            // Lucide unavailable — icons degrade to empty, page still works
        }
    };

    // ── Visibility fallback ──
    // If GSAP fails to animate opacity-0 elements, force them visible after 3s
    // Skip elements that are intentionally hidden (menus, overlays, modals)
    function initVisibilityFallback() {
        setTimeout(function () {
            var skip = ['mobile-menu', 'success-overlay', 'error-state', 'source-modal'];
            document.querySelectorAll('.opacity-0').forEach(function (el) {
                if (skip.indexOf(el.id) !== -1 || el.closest('[id="mobile-menu"]') || el.closest('.pointer-events-none')) return;
                el.classList.remove('opacity-0');
                el.style.opacity = '1';
            });
        }, 3000);
    }

    // ── Initialize ──
    function init() {
        initGrainOverlay();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                initSplitText();
                initPageTransitions();
                initVisibilityFallback();
            });
        } else {
            initSplitText();
            initPageTransitions();
            initVisibilityFallback();
        }
    }

    init();
})();

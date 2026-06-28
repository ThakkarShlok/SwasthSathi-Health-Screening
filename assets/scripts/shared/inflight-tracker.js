/**
 * InFlightTracker — client-side deduplication guard for Edge Function calls.
 * Prevents the same request from being sent twice concurrently (e.g. double-tap).
 * Usage:
 *   if (!window.InFlightTracker.start('ocr')) return;  // already running
 *   try { ... } finally { window.InFlightTracker.end('ocr'); }
 */
(function () {
    const _set = new Set();

    window.InFlightTracker = {
        start(key) {
            if (_set.has(key)) return false;
            _set.add(key);
            return true;
        },
        end(key) {
            _set.delete(key);
        },
        has(key) {
            return _set.has(key);
        },
        clear() {
            _set.clear();
        },
    };
})();

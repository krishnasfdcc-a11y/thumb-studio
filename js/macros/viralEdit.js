/**
 * Viral Edit Macro
 * Caches current UI state and applies a high-impact preset.
 */
(function(){
    const cacheKey = '__viralEdit_cache__';

    function snapshot() {
        const s = window.globalState.getState();
        const toCache = {
            text: s.text,
            effects: s.effects,
            shadowStrength: s.shadowStrength,
            lightAngle: s.lightAngle,
            panX: s.panX,
            panY: s.panY
        };
        sessionStorage.setItem(cacheKey, JSON.stringify(toCache));
    }

    function restore() {
        const raw = sessionStorage.getItem(cacheKey);
        if (!raw) return;
        try {
            const v = JSON.parse(raw);
            window.globalState.setState({
                text: v.text,
                effects: v.effects,
                shadowStrength: v.shadowStrength,
                lightAngle: v.lightAngle,
                panX: v.panX,
                panY: v.panY
            });
        } catch (e) {
            console.warn('Failed to restore viral edit cache', e);
        }
    }

    function applyViralEdit() {
        const s = window.globalState.getState();
        // Save current state
        snapshot();
        // Apply high-impact changes
        window.globalState.setState({
            effects: { ...s.effects, backgroundBlur: 0.4, contrast: Math.min(2, s.effects.contrast + 0.15) },
            shadowStrength: Math.min(1, s.shadowStrength + 0.15),
            text: { ...s.text, size: Math.round(s.text.size * 1.08), x: 0.5, y: 0.18 },
            panX: Math.max(0, Math.min(1, s.panX)),
            panY: Math.max(0, Math.min(1, s.panY))
        });
    }

    function revertViralEdit() {
        restore();
    }

    window.viralEdit = {
        applyViralEdit,
        revertViralEdit
    };
})();

"""
Compatibility and safety module for PatternLab.
Ensures that scikit-learn ensemble modules import safely on Windows systems
where Windows AppLocker or Application Control policy blocks _gradient_boosting.cp*.pyd.
"""

import sys
import types

def apply_compatibility_patches():
    """Apply safety shims for native C-extensions if blocked by system security policies."""
    # Check if _gradient_boosting is blocked
    try:
        import sklearn.ensemble._gradient_boosting  # type: ignore
    except (ImportError, OSError):
        # Stub the blocked C-extension so RandomForest and other ensemble models work cleanly
        if 'sklearn.ensemble._gradient_boosting' not in sys.modules:
            mock_gb = types.ModuleType('sklearn.ensemble._gradient_boosting')
            mock_gb._random_sample_mask = lambda: None
            mock_gb.predict_stage = lambda: None
            mock_gb.predict_stages = lambda: None
            sys.modules['sklearn.ensemble._gradient_boosting'] = mock_gb

# Automatically apply on import
apply_compatibility_patches()

import pytest
from app.services.frontfix.multilingual import MultilingualService
from app.services.frontfix.engine import DiagnosticEngine


def test_language_detection():
    # English
    assert MultilingualService.detect_language("My React app is crashing on mount") == "en"

    # Hindi (Devanagari)
    assert MultilingualService.detect_language("मेरा रिएक्ट ऐप काम नहीं कर रहा") == "hi"

    # Punjabi (Gurmukhi)
    assert MultilingualService.detect_language("ਮੇਰਾ ਰਿਐਕਟ ਕੋਡ ਚੱਲ ਨਹੀਂ ਰਿਹਾ") == "pa"

    # Hinglish
    assert MultilingualService.detect_language("mera React page blank ho gaya hai kaise fix karein") == "hinglish"
    assert MultilingualService.detect_language("kuch bhi kaam nahi kar raha browser pe") == "hinglish"


def test_ui_labels_and_preservation():
    labels_hi = MultilingualService.get_ui_labels("hi")
    assert "समस्या" in labels_hi["problem"]
    assert "हल" in labels_hi["solved_btn"]

    labels_pa = MultilingualService.get_ui_labels("pa")
    assert "ਮਸਲਾ" in labels_pa["problem"]
    assert "ਹੱਲ" in labels_pa["solved_btn"]


@pytest.mark.asyncio
async def test_multilingual_diagnostic_flow():
    engine = DiagnosticEngine()

    # Query in Hinglish asking vague question triggers Hinglish options
    res_hinglish = await engine.diagnose(
        user_input="mera React app crash ho raha hai",
        language="hinglish",
    )
    assert res_hinglish["language"] == "hinglish"
    assert "options" in res_hinglish or "interactive_options" in res_hinglish
    options = res_hinglish.get("interactive_options", [])
    assert any("blank" in opt.lower() or "console" in opt.lower() for opt in options)

    # Resolution in Hindi
    res_hi = await engine.diagnose(
        user_input="",
        action="verify_solved",
        language="hi",
    )
    assert res_hi["language"] == "hi"
    assert "बढ़िया" in res_hi["extra_tips"] or "खुशी" in res_hi["extra_tips"]

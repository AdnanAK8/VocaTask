import pytest
from app.services.frontfix.evaluator import MatchEvaluator, QuestionGenerator
from app.services.frontfix.state_machine import CaseSummary


def test_evaluator_high_confidence():
    candidate = {
        "score": 38.0,
        "item": {
            "id": "cors_policy_blocked",
            "title": "CORS Policy Blocked: No Access-Control-Allow-Origin",
            "category": "Network & API",
            "trigger_patterns": ["cors", "access-control-allow-origin"],
        },
    }
    evidence = {"detectedFramework": "React"}
    eval_res = MatchEvaluator.evaluate_match(candidate, "CORS error blocked by Access-Control-Allow-Origin", evidence)

    assert eval_res["is_reliable"] is True
    assert eval_res["confidence"] == "high"
    assert eval_res["is_contradictory"] is False


def test_evaluator_contradiction_detection():
    candidate = {
        "score": 15.0,
        "item": {
            "id": "react_hydration_error",
            "title": "React Hydration Error Mismatch",
            "category": "React SSR",
            "trigger_patterns": ["hydration mismatch"],
        },
    }
    evidence = {"detectedFramework": "Angular"}
    eval_res = MatchEvaluator.evaluate_match(candidate, "Hydration mismatch in Angular application", evidence)

    assert eval_res["is_contradictory"] is True
    assert len(eval_res["reasons"]) > 0


def test_question_generator_targeted_facets():
    case = CaseSummary(problem_statement="My app crashes with .map on undefined")
    q_data = QuestionGenerator.generate_interactive_followup("TypeError: Cannot read properties of undefined (reading 'map')", case, {}, "en")

    assert q_data["facet"] == "data_source"
    assert len(q_data["options"]) >= 3
    assert any("api" in opt.lower() for opt in q_data["options"])

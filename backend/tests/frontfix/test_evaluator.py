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


def test_starter_category_api_backend():
    case = CaseSummary()
    q_data = QuestionGenerator.generate_interactive_followup("API or backend problem", case, {}, "en")

    assert q_data["facet"] == "api_symptom"
    assert q_data["response_type"] == "follow_up_question"
    assert "troubleshoot your API or backend issue" in q_data["greeting"]
    assert "What problem are you experiencing?" in q_data["question"]
    assert len(q_data["options"]) == 8
    assert "API request is failing." in q_data["options"]
    assert "I'm getting a 400, 401, 403, 404, or 500 error." in q_data["options"]


def test_multiturn_api_backend_flow():
    case = CaseSummary()
    # Step 1: Starter category
    q1 = QuestionGenerator.generate_interactive_followup("API or backend problem", case, {}, "en")
    assert q1["facet"] == "api_symptom"
    case.record_answer(q1["facet"], "API request is failing.")

    # Step 2: User says API request is failing -> Ask origin
    q2 = QuestionGenerator.generate_interactive_followup("API request is failing.", case, {}, "en")
    assert q2["facet"] == "api_origin"
    assert "Where are you making the API request from?" in q2["question"]
    case.record_answer(q2["facet"], "React or another frontend application (fetch / axios)")

    # Step 3: Origin answered -> Ask status code / DevTools
    q3 = QuestionGenerator.generate_interactive_followup("React or another frontend application (fetch / axios)", case, {}, "en")
    assert q3["facet"] == "http_status_code"
    assert "Which HTTP status code" in q3["question"]


def test_devtools_guidance_flow():
    case = CaseSummary()
    q_data = QuestionGenerator.generate_interactive_followup("I don't know how to check", case, {}, "en")
    assert q_data["facet"] == "devtools_guide"
    assert "F12" in q_data["question"]
    assert len(q_data["options"]) >= 3

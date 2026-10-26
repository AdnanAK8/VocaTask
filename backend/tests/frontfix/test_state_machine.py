import pytest
from app.services.frontfix.state_machine import DiagnosticState, CaseSummary, DiagnosticStateMachine
from app.services.frontfix.engine import DiagnosticEngine


def test_case_summary_serialization():
    case = CaseSummary(problem_statement="App is blank")
    case.record_answer("data_source", "api")
    case.record_answer("symptom", "white screen")

    d = case.to_dict()
    assert d["problem_statement"] == "App is blank"
    assert d["data_source"] == "api"
    assert "white screen" in d["symptoms"]

    hydrated = CaseSummary.from_dict(d)
    assert hydrated.problem_statement == "App is blank"
    assert hydrated.data_source == "api"


def test_state_machine_transitions():
    case = CaseSummary(problem_statement="My app is crashing")

    # Vague query without evidence stays in COLLECT_CONTEXT
    next_st = DiagnosticStateMachine.determine_next_state(
        DiagnosticState.UNDERSTAND_PROBLEM,
        "My app is crashing",
        case,
        {},
    )
    assert next_st == DiagnosticState.COLLECT_CONTEXT

    # When solid evidence like a stack trace is present, bypasses questionnaire
    next_st_with_evidence = DiagnosticStateMachine.determine_next_state(
        DiagnosticState.COLLECT_CONTEXT,
        "TypeError: Cannot read properties of undefined (reading 'map')\n    at TaskList.tsx:42:15",
        case,
        {"stack": "TypeError: Cannot read properties..."},
        has_kb_match=True,
        is_kb_reliable=True,
    )
    assert next_st_with_evidence == DiagnosticState.PRESENT_SOLUTION


@pytest.mark.asyncio
async def test_engine_verify_solved_and_broken():
    engine = DiagnosticEngine()

    # 1. Test verify_solved
    res_solved = await engine.diagnose(
        user_input="",
        action="verify_solved",
        case_summary={"problem_statement": "TypeError: .map on undefined"},
        language="en",
    )
    assert res_solved["state"] == DiagnosticState.RESOLVED.value
    assert res_solved["confidence_level"] == "verified"
    assert "resolved" in res_solved["title"].lower()

    # 2. Test verify_broken
    res_broken = await engine.diagnose(
        user_input="",
        action="verify_broken",
        case_summary={"problem_statement": "TypeError: .map on undefined"},
        language="en",
    )
    assert res_broken["state"] == DiagnosticState.ESCALATE_OR_FALLBACK.value
    assert len(res_broken["interactive_options"]) > 0


@pytest.mark.asyncio
async def test_engine_skip_questions():
    engine = DiagnosticEngine()

    # Skip questions should not get stuck in clarification
    res_skip = await engine.diagnose(
        user_input="page is blank",
        action="skip_questions",
        language="en",
    )
    assert res_skip["is_followup_needed"] is False
    assert res_skip["state"] in (DiagnosticState.PRESENT_SOLUTION.value, DiagnosticState.ESCALATE_OR_FALLBACK.value)

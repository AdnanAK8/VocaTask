"""
Diagnostic State Machine & Case Management for FrontFix AI
Maintains structured case context across multi-turn troubleshooting conversations.
"""

from enum import Enum
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone


class DiagnosticState(str, Enum):
    UNDERSTAND_PROBLEM = "UNDERSTAND_PROBLEM"
    COLLECT_CONTEXT = "COLLECT_CONTEXT"
    SEARCH_KNOWLEDGE_BASE = "SEARCH_KNOWLEDGE_BASE"
    EVALUATE_EVIDENCE = "EVALUATE_EVIDENCE"
    AI_DIAGNOSIS = "AI_DIAGNOSIS"
    PRESENT_SOLUTION = "PRESENT_SOLUTION"
    VERIFY_SOLUTION = "VERIFY_SOLUTION"
    RESOLVED = "RESOLVED"
    ESCALATE_OR_FALLBACK = "ESCALATE_OR_FALLBACK"


@dataclass
class CaseSummary:
    problem_statement: str = ""
    problem_category: Optional[str] = None  # e.g., 'website_down', 'react_error', 'api_backend', 'styling_ui', 'build_deploy', 'database', 'other'
    technology: Optional[str] = None
    error_type: Optional[str] = None
    stack_trace: Optional[str] = None
    framework: Optional[str] = None
    file_location: Optional[str] = None
    environment: Optional[str] = None
    data_source: Optional[str] = None  # e.g., 'api', 'state', 'props', 'db'
    reproduction_trigger: Optional[str] = None  # e.g., 'on_load', 'on_click', 'on_submit'
    steps_to_reproduce: Optional[str] = None
    symptoms: List[str] = field(default_factory=list)
    tried_fixes: List[str] = field(default_factory=list)
    active_hypothesis: Optional[str] = None
    suggested_fix: Optional[str] = None
    resolution_status: str = "unresolved"  # 'unresolved', 'verifying', 'resolved', 'escalated', 'partial'
    language: str = "en"
    step_number: int = 1
    max_steps: int = 3
    active_facet: Optional[str] = None
    asked_questions: List[str] = field(default_factory=list)
    answered_facets: Dict[str, Any] = field(default_factory=dict)
    collected_answers: Dict[str, str] = field(default_factory=dict)
    history_stack: List[Dict[str, Any]] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]) -> "CaseSummary":
        if not data or not isinstance(data, dict):
            return cls()
        valid_fields = {f for f in cls.__dataclass_fields__}
        filtered = {k: v for k, v in data.items() if k in valid_fields}
        return cls(**filtered)

    def record_answer(self, facet: str, answer: str) -> None:
        self.answered_facets[facet] = answer
        self.collected_answers[facet] = answer
        self.step_number += 1
        self.updated_at = datetime.now(timezone.utc).isoformat()
        if facet == "data_source":
            self.data_source = answer
        elif facet == "reproduction_trigger":
            self.reproduction_trigger = answer
        elif facet == "framework":
            self.framework = answer
        elif facet == "technology":
            self.technology = answer
        elif facet == "problem_category":
            self.problem_category = answer
        elif facet == "symptom":
            if answer not in self.symptoms:
                self.symptoms.append(answer)


class DiagnosticStateMachine:
    """Manages conversational transitions and evaluates whether sufficient information exists."""

    @staticmethod
    def determine_next_state(
        current_state: DiagnosticState,
        query: str,
        case: CaseSummary,
        evidence: Dict[str, Any],
        has_kb_match: bool = False,
        is_kb_reliable: bool = False,
        user_action: Optional[str] = None,
    ) -> DiagnosticState:
        # Handle explicit verification actions
        if user_action == "verify_solved":
            return DiagnosticState.RESOLVED
        if user_action == "verify_broken":
            return DiagnosticState.ESCALATE_OR_FALLBACK
        if user_action in ("verify_partial", "verify_different_error", "verify_need_help"):
            return DiagnosticState.COLLECT_CONTEXT
        if user_action == "skip_questions":
            return DiagnosticState.PRESENT_SOLUTION
        if user_action == "restart":
            return DiagnosticState.UNDERSTAND_PROBLEM

        # Completed states
        if current_state == DiagnosticState.RESOLVED:
            return DiagnosticState.RESOLVED

        # Check if query already contains sufficient concrete evidence (e.g. stack trace, exact error)
        has_solid_evidence = bool(
            evidence.get("stack")
            or evidence.get("fileLocation")
            or evidence.get("errorSignature")
            or len(query.strip().split("\n")) > 2
            or (case.data_source and case.reproduction_trigger)
            or case.step_number > case.max_steps
        )

        if current_state in (DiagnosticState.UNDERSTAND_PROBLEM, DiagnosticState.COLLECT_CONTEXT):
            if has_solid_evidence:
                if has_kb_match and is_kb_reliable:
                    return DiagnosticState.PRESENT_SOLUTION
                return DiagnosticState.SEARCH_KNOWLEDGE_BASE
            return DiagnosticState.COLLECT_CONTEXT

        if current_state == DiagnosticState.SEARCH_KNOWLEDGE_BASE:
            return DiagnosticState.EVALUATE_EVIDENCE

        if current_state == DiagnosticState.EVALUATE_EVIDENCE:
            if has_kb_match and is_kb_reliable:
                return DiagnosticState.PRESENT_SOLUTION
            return DiagnosticState.AI_DIAGNOSIS

        if current_state == DiagnosticState.AI_DIAGNOSIS:
            return DiagnosticState.PRESENT_SOLUTION

        if current_state == DiagnosticState.PRESENT_SOLUTION:
            return DiagnosticState.VERIFY_SOLUTION

        return current_state

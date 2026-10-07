#!/usr/bin/env python3
"""Re-scenario spec files: replace the boilerplate "invariants hold" scenario with
domain-behavior scenarios derived from each file's ## Model transitions.

Per transition: one scenario (WHEN in <from>, THEN enters <to>) citing every
property deriving from the guard's constraints — property citations are what
bind contracts (resolve_verifies_coverage).
The slug-bound conformance-gate scenario ("Violating <spec> invariant is
rejected") is retained: its contract binds by scenario slug.
Constraints never cited by a guard get a constraint-derived scenario so
property coverage stays complete.
"""
import re
import sys
from pathlib import Path

LINK = re.compile(r"\[\[spec\.([a-z0-9_]+)\]\]")


def hyphens(name: str) -> str:
    return name.replace("_", "-")


def _consume_constraints(cells, state):
    if len(cells) < 4:
        return
    state["constraints"][cells[0]] = cells[2]


def _consume_properties(cells, state):
    if len(cells) < 4:
        return
    for constraint in LINK.findall(cells[2]):
        state["props"].setdefault(constraint, []).append(cells[0])


def _consume_transition(cells, state):
    if len(cells) != 4:
        return
    state["transitions"].append(
        {"id": cells[0], "from": cells[1], "to": cells[2], "guard": cells[3]}
    )


CONSUMERS = {
    "Constraints": _consume_constraints,
    "Properties": _consume_properties,
    "Model": _consume_transition,
}


def parse(content: str):
    state = {"section": None, "constraints": {}, "props": {}, "transitions": []}
    for line in content.splitlines():
        if line.startswith("## "):
            state["section"] = line[3:].strip()
            continue
        consume = CONSUMERS.get(state["section"])
        if consume is None:
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if cells[0] == "id" or cells[0] == "":
            continue
        if all(re.fullmatch(r"[-: ]*", c) for c in cells):
            continue
        consume(cells, state)
    return state["constraints"], state["props"], state["transitions"]


def _verifies_lines(constraints_cited, props_by_constraint):
    props = sorted({p for c in constraints_cited for p in props_by_constraint.get(c, [])})
    return [f"- **VERIFIES** [[spec.{p}]]" for p in props]


def gen_transition_scenario(t, cited, props_by_constraint):
    verifies = _verifies_lines(set(cited), props_by_constraint)
    head = f"#### Scenario: {hyphens(t['id'])} moves `{t['from']}` to `{t['to']}`"
    mood = "evaluates false" if t["guard"].startswith("¬") else "holds"
    when = (
        f"- **WHEN** the model is in the `{t['from']}` state and the `{t['id']}` "
        f"transition guard {mood} ({t['guard']})"
    )
    then = f"- **THEN** the model enters the `{t['to']}` state and records the transition"
    return "\n".join([head, when, then, *verifies])


def gen_constraint_scenario(constraint, expr, props_by_constraint):
    verifies = _verifies_lines({constraint}, props_by_constraint)
    head = f"#### Scenario: {hyphens(constraint)} invariant holds under canonical operation"
    when = "- **WHEN** the system performs any operation governed by this specification"
    then = f"- **THEN** the invariant holds: \"{expr}\""
    return "\n".join([head, when, then, *verifies])


def _gate_scenario(content: str):
    match = re.search(
        r"#### Scenario: Violating .+ invariant is rejected\n\n(?:- .*\n)+", content
    )
    return match.group(0).rstrip() if match else None


def _build_block(name, constraints, props, transitions):
    cited = set()
    for t in transitions:
        cited |= set(LINK.findall(t["guard"]))
    uncited = [c for c in constraints if c not in cited]
    scen = [gen_transition_scenario(t, LINK.findall(t["guard"]), props) for t in transitions]
    scen += [gen_constraint_scenario(c, constraints[c], props) for c in uncited]
    intro = (
        "Each declared model transition is carried by a domain-behavior scenario "
        "naming the state change it authorizes and the properties that guard it; "
        "constraints not bound to a transition are carried by invariant-holding "
        "scenarios, so every deriving property remains scenario-verified. The "
        "conformance-gate scenario closes the set: revisions that break the model "
        "are rejected by the gate with a finding naming the violated row."
    )
    block = f"### Requirement: {name} model transitions are observable\n\n{intro}\n\n"
    block += "\n\n".join(scen)
    return block + "\n"


def rework(path: Path) -> bool:
    content = path.read_text()
    match = re.search(r"### Requirement: (.+?) declared invariants are observable\n", content)
    if not match:
        return False
    constraints, props, transitions = parse(content)
    block = _build_block(match.group(1), constraints, props, transitions)
    gate = _gate_scenario(content)
    if gate:
        block += "\n\n" + gate
    start = match.start()
    endm = re.search(r"^## ", content[match.end():], re.M)
    end = match.end() + (endm.start() if endm else len(content) - match.end())
    path.write_text(content[:start] + block + "\n" + content[end:])
    return True


def main():
    only = sys.argv[1:] if len(sys.argv) > 1 else None
    root = Path("openspec/specs")
    for d in sorted(root.iterdir()):
        spec = d / "spec.md"
        if not spec.exists() or (only and d.name not in only):
            continue
        if rework(spec):
            print(f"reworked {d.name}")


if __name__ == "__main__":
    main()

# Design: Composition Shell for Artifact Review

## Scope and ownership

The unit of delivery is a resumable artifact review. Only normalized
`review_artifact` needs selecting catalog kind `review` are supported in v0.
A review records feedback and completion; it never grants authority or executes
an external effect. Trusted application inputs supply artifact revisions, policy,
catalog and evidence references. Agent proposals and human responses are data.

The shell owns conversions and orchestration through public barrels. The need
layer normalizes; interaction-policy owns eligibility, hard gates and ranking;
engine owns decision context and freshness; runtime owns event validation/reduction;
session-state owns continuity summaries. Conformance tests assert behavior across
these boundaries, not merely equality of exported constants. If the adapters cannot
preserve a layer's semantics, add a delta to that owning capability before coding it.

## Representation decisions

| Boundary | v0 decision | Refusal / evidence |
|---|---|---|
| Revision identity | Public task and interaction revisions are nonnegative safe integers. Need/session adapters emit their canonical decimal strings. Reverse conversion requires an exact canonical decimal round trip. Artifact revision is the task revision in this slice; aggregate storage version is separate. | Reject fractional, unsafe, negative, noncanonical or opaque revision values; never silently parse a hash or truncate a number. |
| Need to runtime kind | `review_artifact` normalizes, then trusted catalog/policy must select `review`; runtime kind is `review`. | Other kinds return `unsupported_kind`; no heuristic mapping between other vocabularies. |
| Policy to engine | Run the public policy evaluator first. Preserve its recommendation order, exclusions, scores and evidence in the shell decision. Supply engine candidates in that order using positive descending ordinal priorities; engine priority is an adapter rank, not a policy score. | Excluded candidates cannot reappear. Zero eligible candidates returns `no_candidate`, with exclusions, and creates no interaction. |
| Review response | Public response is a nonempty feedback string associated with an event ID and expected task/interaction revisions. | Validate through runtime; feedback completion remains distinct from authorization. |
| Version identity | Persist evaluation policy, catalog, need taxonomy and shell surface versions with the decision; persist runtime contract/schema/reducer policy versions separately. | A fixed runtime policy constant must not be reported as the evaluation policy. Reopening checks support for the recorded versions. |
| Provenance | Keep proposal ID, evidence references, normalizer identity and decision exclusions through commit, projection and reload. | Empty evidence is explicitly represented; evidence references are not claims of independently verified truth. |

## Public API and state ownership

`consumer-example.md` proposes names and observable outcomes. The first
implementation task makes that example an executable contract before behavior.
Construction requires a trusted session/task key, immutable policy/catalog inputs,
and an explicitly declared persistence port. Evaluation accepts a raw need
proposal and normalizes internally; there is no caller assertion that bypasses it.

The persisted aggregate contains task/artifact revision metadata, session data,
committed interaction state, committed decision provenance, replay records, command
receipts and an aggregate version. Artifact contents belong to the host; a durable
revision-specific content reference or content hash binds the review to that content.
Task revision updates and session changes use the same conditional-write boundary.
A trusted `updateArtifact` command replaces revision metadata and marks pending
reviews changed; a stale review can be explicitly superseded and a new one created.
Evaluation alone does not mutate the aggregate. Returned projections are copies.

`project()` is an observation and cannot disable commands. Cancel/retire/supersede/
expire are validated runtime commands both before and after projection. A successful
review response is recorded and explicitly retired in one shell transaction; both
runtime transitions are retained in replay with deterministic event IDs derived
from the submitted operation ID (response and retirement suffixes). It marks the pending review completed in
the same aggregate transaction, preventing another completion on a newer interaction
revision. Shell results name rejected, unavailable and uncertain outcomes explicitly.

## Persistence contract (wanna-d0h)

All operations are asynchronous. The first durable adapter MUST support atomic
conditional writes of aggregate state, replay and command receipts. The shell may
also accept a weaker-declared port, but MUST expose its limitations in results and
cannot claim the durable/shared-writer acceptance criteria for that adapter.

The deduplication scope is `(sessionId, taskId)` for the lifetime of the retained
aggregate, across shell instances and restarts. Event/command IDs are unique inside
that scope. Reuse with different payloads is rejected. No receipt pruning is provided
in v0. The port owns storage serialization; shell-local checks alone are insufficient.

| Operation | Preconditions | Postconditions and typed outcomes |
|---|---|---|
| `load(key)` | Trusted key within the declared scope. | Authoritative snapshot containing aggregate version, state, replay, provenance and receipts, or `not_found`, `unavailable`, `recovery_required`. Returned data cannot alias mutable storage. |
| `compareAndCommit(key, expectedVersion, operation)` | Valid operation ID, proposed next aggregate, replay additions and matching identity; expected version is a loaded version, or null only for creation. | In one atomic storage transaction: enforce ID dedup, compare current version, validate expected task/interaction revisions, and persist state/replay/receipt with incremented aggregate version. Return `applied` with receipt, `duplicate` without reapplication, `conflict` without mutation, `unavailable` with certain no effect, or `unknown_effect`. Concurrent operations from one base cannot both apply. |
| `reconcile(key, operationId)` | An operation outcome is uncertain. | Return `applied` with receipt and authoritative snapshot, `not_applied` only with authoritative proof the operation cannot later commit, or `unknown_effect`. A temporarily absent receipt is insufficient proof. |

An operation includes its expected task and interaction revisions as appropriate;
initial decision commit checks the evaluated task revision. Trusted artifact updates
also increment the aggregate version, so they race safely with initial commit and
response commit. A port may derive expected revisions from the initial replay state;
the obligation is atomic conditional behavior, not a mandated lower-level CAS API.

`conflict` returns a typed rejection. Refresh loads authoritative state before a new
attempt; the host must obtain a new decision or human response when its reviewed
revision changed. It never automatically rebinds old feedback to a new revision.
After `unknown_effect`, further mutation is blocked until reconciliation determines
the outcome. Restart preserves pending operation identity in adapter storage so
uncertainty cannot disappear when a shell instance is destroyed. A weaker adapter
must document how it exposes uncertainty and partial writes and pass failure tests.

## Recovery and observable outcomes

Normalization refusal, unsupported mapping, no candidate and certain-no-effect
persistence failure return typed results without changing committed state. These
are results of attempted operations, rather than terminal session states. Unknown
effects put the shell into a blocked recovery state. A fresh authoritative snapshot
alone permits stale-event retry; unknown effects additionally require reconciliation.
Incompatible schema/version or corrupt replay yields `recovery_required`; no silent
reset or automatic migration is allowed. Resume returns completed, pending, changed,
unresolved and next-attention data, including the review's original artifact revision.

## Consumer and packaging decisions

The companion workbench imports `src/composition-shell/index.ts` through a stable
public import alias; UI and IndexedDB adapter code stay outside the shell. Enforce
transitive source dependency and public-type boundaries now. A workspace split,
exports map and distribution build follow demonstrated reuse, not the first screen.
The eventual runtime target is ESM; exact supported consumers are decided by the
packaging ticket's fresh-consumer checks. The shell surface still has an explicit
v0 version and records compatibility decisions for semantic changes.

## Delivery and risks

A failing consumer contract precedes shell behavior. Then deliver the first human
review through the smallest shell path and workbench together. Restart and concurrency
acceptance require the durable adapter, not only an in-memory fake. Fault injection
covers before-write failure, committed-but-lost acknowledgement, and uncertain
reconciliation across reconstruction. Tidy work is a separate ticket and commit.

The review-only scope deliberately rejects unsupported interactions. Reuse evidence
may justify broader mappings later. A small direct implementation is the comparison
baseline; conformance test counts alone do not establish reduced integration effort.

This decision supersedes the earlier shell → packaging → SPA sequence in the
2026-10-08 composition decision matrix. Governance stays spec-first; packaging and
server hosting remain options. The approved adaptation here is proposal work only;
implementation begins after the revised proposals are approved.

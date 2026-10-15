---
id: shell.distribution
kind: intent
statement: THE Distribution SHALL emit the composition shell public surface as an importable ESM package artifact with declarations that a fresh consumer can verify outside the repository aliases, with supported runtime combinations explicitly documented and registry publication remaining separately unauthorized
---

# Shell Distribution

Distribution turns the demonstrated semantic-reuse surface — one public barrel,
`@wanna/composition-shell` — into an importable package artifact. The emission
compiles only the package sources, excludes test roots and test globals, and
exposes the shell barrel through a single export. The durable IndexedDB adapter
and the workbench screen stay in-repo: no evidence supports packaging them. A
fresh-consumer verification outside the repo aliases is the executable boundary
of the capability. Publication to any registry is a separately authorized act
and is not performed, wired, or prepared by any requirement here. Runtime and
module combinations outside the documented matrix are unsupported, not broken —
they carry no compatibility commitment in either direction.

## Constraints

| id | kind | expr | traces_to |
|---|---|---|---|
| emitted_entry_importable | invariant | A consumer outside the repository aliases, with no access to package sources, imports the emitted entry point and typechecks against the emitted declarations to run the demonstrated consumer scenario. | [[shell.distribution]] |
| source_compile_excludes_test_globals | invariant | The emission compiles only package sources: test roots and test files are excluded from the build unit, and emitted declarations contain no test globals. | [[shell.distribution]] |
| runtime_matrix_documented | invariant | The supported runtime and module combinations are explicitly documented, and every undocumented combination is declared unsupported without a compatibility commitment. | [[shell.distribution]] |
| no_transitive_host_dependency | invariant | The emitted package carries zero runtime dependencies and its public surface and transitive imports expose no host or transport types. | [[shell.distribution]] |
| publication_not_authorized | invariant | No requirement or task in this capability publishes to a registry, wires release automation, or bumps a released version; publication remains a separately authorized act. | [[shell.distribution]] |
| single_package_topology | invariant | The distribution exposes only the composition shell public barrel as its package entry; the durable IndexedDB adapter and workbench screen remain in-repo reference material until their own reuse evidence independently supports packaging. | [[shell.distribution]] |

## Model

### States
- `source`
- `emitted`
- `verified`

Emission failures and fresh-consumer verification failures return the artifact to
source for revision; no failure terminal state exists because an unusable
artifact is simply not emitted. `verified` is the only terminal state.

### Transitions
| id | from | to | guard |
|---|---|---|---|
| emit_artifact | source | emitted | [[shell.distribution.source_compile_excludes_test_globals]] ∧ [[shell.distribution.single_package_topology]] |
| verify_fresh_consumer | emitted | verified | [[shell.distribution.emitted_entry_importable]] ∧ [[shell.distribution.no_transitive_host_dependency]] ∧ [[shell.distribution.runtime_matrix_documented]] |
| revise_after_failure | emitted | source | ¬([[shell.distribution.source_compile_excludes_test_globals]] ∨ [[shell.distribution.single_package_topology]] ∨ [[shell.distribution.emitted_entry_importable]] ∨ [[shell.distribution.no_transitive_host_dependency]] ∨ [[shell.distribution.runtime_matrix_documented]]) |

## Properties

| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| fresh_consumer_imports_entry | unit | [[shell.distribution.emitted_entry_importable]] | `any::<String>()` | `TypeScript test: a fresh consumer outside the repository aliases imports the emitted entry point and runs the demonstrated consumer scenario` |
| declarations_typecheck_standalone | unit | [[shell.distribution.emitted_entry_importable]] | `any::<String>()` | `TypeScript test: the emitted declarations typecheck a minimal consumer compiled without access to package sources` |
| emitted_types_exclude_test_globals | unit | [[shell.distribution.source_compile_excludes_test_globals]] | `any::<String>()` | `Static emission test: emitted declarations and runtime code contain no test globals and the build unit excludes test roots` |
| runtime_matrix_recorded | unit | [[shell.distribution.runtime_matrix_documented]] | `any::<String>()` | `Documentation test: the supported and explicitly unsupported runtime and module combinations are recorded and machine-readable` |
| package_dependency_free | unit | [[shell.distribution.no_transitive_host_dependency]] | `any::<String>()` | `Static dependency test: the emitted package declares zero runtime dependencies and its import graph contains no host or transport types` |
| no_publication_step | unit | [[shell.distribution.publication_not_authorized]] | `any::<String>()` | `Static task test: no task, script, or gate publishes to a registry or wires release automation` |
| single_public_entry | unit | [[shell.distribution.single_package_topology]] | `any::<String>()` | `Static export test: the package exports map admits only the shell public barrel` |

## Purpose

Provide the packaging capability for the semantic-reuse distribution decision:
an importable, verified ESM artifact of the composition shell public surface,
with an explicitly documented runtime matrix, zero runtime dependencies, and no
publication path.

## ADDED Requirements

### Requirement: Fresh-consumer importable artifact

The distribution SHALL emit an ESM artifact with type declarations whose entry
point a fresh consumer can import and typecheck outside the repository aliases
and without access to package sources, executing the demonstrated consumer
scenario through the emitted artifact.

#### Scenario: fresh consumer imports entry
- **WHEN** a fresh consumer with no repository aliases and no access to package sources imports the emitted entry point
- **THEN** the demonstrated consumer scenario runs through the emitted artifact
- **VERIFIES** [[shell.distribution.fresh_consumer_imports_entry]]

#### Scenario: declarations typecheck standalone
- **WHEN** a minimal consumer is typechecked against the emitted declarations without access to package sources
- **THEN** the typecheck succeeds with no repository-alias resolution
- **VERIFIES** [[shell.distribution.declarations_typecheck_standalone]]

### Requirement: Excluded test compilation

The emission SHALL compile only package sources, excluding test roots and test
files from the build unit so that emitted declarations contain no test globals.

#### Scenario: emitted types exclude test globals
- **WHEN** the emitted declarations and runtime code are inspected
- **THEN** no test globals appear and the build unit excludes test roots
- **VERIFIES** [[shell.distribution.emitted_types_exclude_test_globals]]

### Requirement: Documented runtime combinations

The distribution SHALL explicitly document its supported runtime and module
combinations and SHALL declare every undocumented combination unsupported
without a compatibility commitment in either direction.

#### Scenario: runtime matrix recorded
- **WHEN** the supported runtime and module combinations are recorded
- **THEN** supported combinations (ESM on the documented Node.js line and ESM-aware bundlers) and explicitly unsupported combinations (CommonJS require, UMD, non-ESM browsers) are both listed
- **VERIFIES** [[shell.distribution.runtime_matrix_recorded]]

### Requirement: Dependency-free emission

The emitted package SHALL declare zero runtime dependencies, and its public
surface and transitive imports SHALL expose no host or transport types.

#### Scenario: package dependency-free
- **WHEN** the emitted package manifest and import graph are inspected
- **THEN** zero runtime dependencies are declared and no host or transport types appear in the public surface or transitive imports
- **VERIFIES** [[shell.distribution.package_dependency_free]]

### Requirement: Publication remains unauthorized

No requirement or task in this capability SHALL publish to a registry, wire
release automation, or bump a released version; publication remains a
separately authorized act.

#### Scenario: no publication step
- **WHEN** the tasks, scripts, and gates of this capability are inspected
- **THEN** no step publishes to a registry or wires release automation
- **VERIFIES** [[shell.distribution.no_publication_step]]

### Requirement: Single-package semantic-reuse topology

The distribution SHALL expose only the composition shell public barrel as its
package entry, keeping the durable IndexedDB adapter and workbench screen
in-repo until their own reuse evidence independently supports packaging.

#### Scenario: single public entry
- **WHEN** the package exports map is inspected
- **THEN** it admits only the shell public barrel and no adapter or screen surface
- **VERIFIES** [[shell.distribution.single_public_entry]]

## Requirements

### Requirement: Fresh-consumer importable artifact

The distribution SHALL emit an ESM artifact with type declarations whose entry
point a fresh consumer can import and typecheck outside the repository aliases
and without access to package sources, executing the demonstrated consumer
scenario through the emitted artifact.

#### Scenario: fresh consumer imports entry
- **WHEN** a fresh consumer with no repository aliases and no access to package sources imports the emitted entry point
- **THEN** the demonstrated consumer scenario runs through the emitted artifact
- **VERIFIES** [[shell.distribution.fresh_consumer_imports_entry]]

#### Scenario: declarations typecheck standalone
- **WHEN** a minimal consumer is typechecked against the emitted declarations without access to package sources
- **THEN** the typecheck succeeds with no repository-alias resolution
- **VERIFIES** [[shell.distribution.declarations_typecheck_standalone]]

### Requirement: Excluded test compilation

The emission SHALL compile only package sources, excluding test roots and test
files from the build unit so that emitted declarations contain no test globals.

#### Scenario: emitted types exclude test globals
- **WHEN** the emitted declarations and runtime code are inspected
- **THEN** no test globals appear and the build unit excludes test roots
- **VERIFIES** [[shell.distribution.emitted_types_exclude_test_globals]]

### Requirement: Documented runtime combinations

The distribution SHALL explicitly document its supported runtime and module
combinations and SHALL declare every undocumented combination unsupported
without a compatibility commitment in either direction.

#### Scenario: runtime matrix recorded
- **WHEN** the supported runtime and module combinations are recorded
- **THEN** supported combinations (ESM on the documented Node.js line and ESM-aware bundlers) and explicitly unsupported combinations (CommonJS require, UMD, non-ESM browsers) are both listed
- **VERIFIES** [[shell.distribution.runtime_matrix_recorded]]

### Requirement: Dependency-free emission

The emitted package SHALL declare zero runtime dependencies, and its public
surface and transitive imports SHALL expose no host or transport types.

#### Scenario: package dependency-free
- **WHEN** the emitted package manifest and import graph are inspected
- **THEN** zero runtime dependencies are declared and no host or transport types appear in the public surface or transitive imports
- **VERIFIES** [[shell.distribution.package_dependency_free]]

### Requirement: Publication remains unauthorized

No requirement or task in this capability SHALL publish to a registry, wire
release automation, or bump a released version; publication remains a
separately authorized act.

#### Scenario: no publication step
- **WHEN** the tasks, scripts, and gates of this capability are inspected
- **THEN** no step publishes to a registry or wires release automation
- **VERIFIES** [[shell.distribution.no_publication_step]]

### Requirement: Single-package semantic-reuse topology

The distribution SHALL expose only the composition shell public barrel as its
package entry, keeping the durable IndexedDB adapter and workbench screen
in-repo until their own reuse evidence independently supports packaging.

#### Scenario: single public entry
- **WHEN** the package exports map is inspected
- **THEN** it admits only the shell public barrel and no adapter or screen surface
- **VERIFIES** [[shell.distribution.single_public_entry]]

# shell-distribution Specification

## Purpose
TBD - created by archiving change add-shell-distribution. Update Purpose after archive.
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


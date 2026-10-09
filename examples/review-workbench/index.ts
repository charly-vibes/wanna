// Purpose: public barrel of the review-workbench consumer example
// Responsibilities: export the screen bootstrap and the scripted fixture; callers import from this barrel only
// Rationale: hosts consumer-example.md (openspec/changes/add-workbench-spa); the screen uses the shell public barrel via the @wanna/composition-shell source alias and never shell layer internals
export { startReviewWorkbench, type ReviewScreenHandle, type ReviewScreenDeps } from "./screen";
export { scriptedRevision7Fixture, type ReviewFixture } from "./fixture";
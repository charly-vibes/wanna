// Purpose: view assembly and density metrics for the presentation-contract layer
// Responsibilities: build the host-neutral presentation view from a contract and count items/depth/size for density_bounded
// Rationale: rendered presentation data exists only as semantic records assembled here — density limits evaluate against this shape
import type {
  PresentationContract,
  PresentationView,
  RenderedAction,
  RenderedMetric,
  ViewItem,
} from "./types";

export function itemsOf(contract: PresentationContract): ViewItem[] {
  const items: ViewItem[] = [];
  if (contract.primaryTask !== undefined) {
    items.push({ id: "primary-task", content: contract.primaryTask, children: [] });
  }
  const supporting = contract.supportingContext ?? [];
  supporting.forEach((content, i) => items.push({ id: `supporting-${i}`, content, children: [] }));
  const detail = contract.optionalDetail ?? [];
  detail.forEach((content, i) => items.push({ id: `detail-${i}`, content, children: [] }));
  return items;
}

export function countItems(items: readonly ViewItem[]): number {
  return items.reduce((sum, item) => sum + 1 + countItems(item.children), 0);
}

export function depthOf(items: readonly ViewItem[], above: number = 0): number {
  return items.reduce((max, item) => Math.max(max, depthOf(item.children, above + 1)), above);
}

export function contentSize(items: readonly ViewItem[]): number {
  return items.reduce(
    (sum, item) => sum + item.content.length + contentSize(item.children),
    0,
  );
}

export function buildView(
  contract: PresentationContract,
  actions: readonly RenderedAction[],
  uncertainty: readonly RenderedMetric[],
): PresentationView {
  return {
    actions: [...actions],
    inertTexts: [...(contract.texts ?? [])],
    items: itemsOf(contract),
    density: contract.density ?? "comfortable",
    uncertainty: [...uncertainty],
  };
}
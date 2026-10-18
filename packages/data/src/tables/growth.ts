// CharGrowthTable: an operator's talent tree. Attribute nodes (nodeType 3)
// add stats; passive skill nodes (nodeType 4) unlock talent levels, whose
// effects are in PotentialTalentEffectTable.

import { arr, at, get, int, obj, str, type Ctx } from "../fields.ts";
import { readTable, type SourceName } from "../sources.ts";
import { attrModifier, records, type RawAttrModifier } from "./common.ts";

export interface Growth {
  readonly attributeNodes: readonly { nodeId: string; breakStage: number; modifiers: readonly RawAttrModifier[] }[];
  readonly talentNodes: readonly { nodeId: string; index: number; level: number; effectId: string }[];
}

const NODE_ATTRIBUTE = 3;
const NODE_PASSIVE = 4;

export function normalizeGrowth(raw: unknown, source: SourceName): Record<string, Growth> {
  const out: Record<string, Growth> = {};
  for (const [charId, record, c] of records(raw, { source, path: "CharGrowthTable" })) {
    const nodes = obj(record["talentNodeMap"], at(c, "talentNodeMap"));
    const attributeNodes: Growth["attributeNodes"][number][] = [];
    const talentNodes: Growth["talentNodes"][number][] = [];
    for (const nodeId of Object.keys(nodes).sort()) {
      const nc: Ctx = at(at(c, "talentNodeMap"), nodeId);
      const node = obj(nodes[nodeId], nc);
      const type = get(node, "nodeType", nc, int);
      if (type === NODE_ATTRIBUTE) {
        const info = obj(node["attributeNodeInfo"], at(nc, "attributeNodeInfo"));
        const ic = at(nc, "attributeNodeInfo");
        attributeNodes.push({
          nodeId,
          breakStage: get(info, "breakStage", ic, int),
          modifiers: get(info, "attributeModifiers", ic, arr).map((m, i) => attrModifier(m, at(at(ic, "attributeModifiers"), i))),
        });
      } else if (type === NODE_PASSIVE) {
        const info = obj(node["passiveSkillNodeInfo"], at(nc, "passiveSkillNodeInfo"));
        const ic = at(nc, "passiveSkillNodeInfo");
        talentNodes.push({
          nodeId,
          index: get(info, "index", ic, int),
          level: get(info, "level", ic, int),
          effectId: get(info, "talentEffectId", ic, str),
        });
      }
    }
    attributeNodes.sort((a, b) => a.breakStage - b.breakStage || (a.nodeId < b.nodeId ? -1 : 1));
    talentNodes.sort((a, b) => a.index - b.index || a.level - b.level);
    out[charId] = { attributeNodes, talentNodes };
  }
  return out;
}

export function loadGrowth(source: SourceName): Record<string, Growth> {
  return normalizeGrowth(readTable(source, "CharGrowthTable"), source);
}

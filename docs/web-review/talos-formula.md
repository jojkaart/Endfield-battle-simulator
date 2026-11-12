# Talos Wiki (endfield.wiki.gg): engine comparison

Source: https://endfield.wiki.gg (api.php action=parse, prop=wikitext; one title search), pages read:
Damage calculation https://endfield.wiki.gg/wiki/Damage_calculation ;
Attribute https://endfield.wiki.gg/wiki/Attribute ;
Critical Rate https://endfield.wiki.gg/wiki/Critical_Rate ;
Susceptibility https://endfield.wiki.gg/wiki/Susceptibility ;
Arts Intensity https://endfield.wiki.gg/wiki/Arts_Intensity ;
Amp https://endfield.wiki.gg/wiki/Amp ;
Weakness https://endfield.wiki.gg/wiki/Weakness ;
Protection https://endfield.wiki.gg/wiki/Protection ;
Breach https://endfield.wiki.gg/wiki/Breach ;
Electrification https://endfield.wiki.gg/wiki/Electrification ;
Corrosion https://endfield.wiki.gg/wiki/Corrosion ;
Element https://endfield.wiki.gg/wiki/Element.
Not found (missing titles): "Critical DMG", "Critical Damage", "Resistance"; the search for "Critical DMG" returned no such page.
Fetched 2026-11-12 (about 16 API requests). Saved copies: scratchpad/web/talos-formula/.
Basis in general: mostly unstated. The pages say a few things were tested in game (for example, that the hidden level multiplier is checked on Earthshaking Hazefyre, and that negative DEF is "to be tested"), but they cite no numbers. Version/date: the Attribute page carries a "Zeroth Directive" update tag; Susceptibility and Amp say "As of October 2026". No page gives a patch number.

## Differences

### W1. D10 (attribute floor): the source says full attribute values are used
- **Engine:** the attribute bonus uses each attribute's whole-number part (floored), including buff-added points. Tagged SETTLED. The evidence is in docs/combat-mechanics.md (an in-game ATK of 5871) and docs/reference-simulators.md (INT 720 shown from 720.985). docs/data-sources.md calls this "disputed".
- **Source:** Attribute page: attributes "can also take decimal values ... The full values are still used in calculations and are only rounded down for display purposes." https://endfield.wiki.gg/wiki/Attribute
- **Basis:** unstated (no test cited). It conflicts with an engine rule that rests on in-game numbers.
- **Impact if the source is right:** every hit of an operator whose main or secondary attribute has a fractional part (buff-added points or percentages of the panel line). The bonus changes by 0.005 × fraction for the main attribute (0.002 for the secondary), so up to about 0.5% of ATK (average about 0.25%). This shifts the ATK line and so every hit of that fight.
- **How we could test it:** an in-game check on the Operator screen. Compare the displayed ATK with and without a buff that adds a fractional attribute (for example one that adds a percentage of the panel line), and compare with the engine's floored and unfloored predictions. The existing 5871 fixture already supports the floor, so the test has to be a new case where the two predictions differ by at least 1 displayed ATK.

### W2. D9 (attribute bonus): extra per-point terms for attributes 76–79
- **Engine:** Attribute bonus = 1 + 0.005·main + 0.002·secondary + Σ (ATK-per-point factor × points, attributes 76–79). The per-point factors are ASSUMED ("not yet verified in game", docs/combat-mechanics.md).
- **Source:** Attribute page gives only the main and secondary terms: "Attribute Bonuses = 1 + 0.005 × MAIN + 0.002 × SEC". Damage calculation gives the same. https://endfield.wiki.gg/wiki/Attribute and https://endfield.wiki.gg/wiki/Damage_calculation
- **Basis:** unstated. The source does not mention attributes 76–79 at all.
- **Impact if the source is right:** no effect when 76–79 are zero. Where they are not (Lifeng's talent 1, per combat-mechanics.md), the engine adds ATK the source does not give.
- **How we could test it:** an in-game ATK check on an operator with Lifeng's talent 1 active, comparing the displayed ATK with and without the talent's per-point term.

### W3. D3 / D7 (damage-bonus zone): classification of generic "DMG Bonus" wording
- **Engine:** generic "DMG +x%" buffs are additive (D3); "effects written in this zone" such as Fluorite's 30% are multiplicative (D7).
- **Source:** Multiplier Group lists generic "DMG Bonus" as additive. The Multiplicative section says multiplicative bonuses are "usually indistinguishable from other damage increases as they are marked as 'DMG Boost' or 'DMG Bonus'", and its examples include Fluorite's 30% DMG Boost and Da Pan's Crush "receives a (10-20)% DMG Bonus". The source gives no rule for telling them apart. https://endfield.wiki.gg/wiki/Damage_calculation
- **Basis:** unstated.
- **Impact if the source is right:** if Da Pan's Crush bonus is multiplicative and the engine treats it as additive, the difference per hit is S × x, where S is the other additive bonuses and x the new bonus. At S = 1.0 and x = 0.15: 2.30 against 2.15, about 7% of the hit.
- **How we could test it:** check the Da Pan kit (its zone field in data) and compare a Crush log with the engine. Or in game: toggle Da Pan's bonus with a known additive bonus active.

### W4. D26 (Weakness ×1): the source puts Weakness in the damage chain
- **Engine:** Weakness (attribute 62) is ×1 in damage. It is only a buff category for triggers. ASSUMED.
- **Source:** Damage calculation puts a Weakness Multiplier = Π(1 − Weakness Effect) in the damage chain. The Weakness page says Weakness is a debuff on enemies that makes them "deal reduced damage", and that several sources stack multiplicatively. Camille and Catcher apply it. The two pages do not say which side it acts on. https://endfield.wiki.gg/wiki/Weakness
- **Basis:** unstated.
- **Impact if the source is right:** if Weakness on an enemy also reduces our operators' damage to it, every hit against a Weakened enemy is too high by the Weakness factor. If it only reduces the enemy's own damage, which the simulator does not model (N8), the engine is right and there is no impact. The size is unknown: the Weakness values are not in this read.
- **How we could test it:** a Camille or Catcher fight log (ZMDLogs) with and without Weakness on the target; compare the per-hit values against the engine.

### W5. D2 (per-hit rounding): the source says the display rounds down
- **Engine:** the final damage per hit is Math.round (nearest; .5 up). SETTLED.
- **Source:** Damage calculation: all numbers are exact, and "When floating damage numbers or values are displayed in-game or in a menu, the value is usually rounded down to the closest integer (e.g. 99.6 is shown as 99)." https://endfield.wiki.gg/wiki/Damage_calculation
- **Basis:** unstated for the display rule.
- **Impact if the source is right:** the engine's per-hit numbers would not match the displayed numbers: up to 1 point per hit, which is 0.5 on average. The total is barely affected. A log comparison of single hits may look wrong by 1.
- **How we could test it:** in a ZMDLogs fixture, check whether logged per-hit values are the floor or the nearest integer of the engine's exact value. The engine's SETTLED status suggests the logs already fit nearest, so the source's display claim may just be a different layer.

## Engine silent (mechanics the source states that no rule covers)
- Protection (https://endfield.wiki.gg/wiki/Protection): reduces damage taken by protected operators by 1 − max(Protection). Multiple sources do not stack (only the strongest applies). Negative values are possible (Purrchena). Incoming damage to operators, not simulated (N8). The engine has the category (D26) but no value rule.
- Final DMG Reduction from gear (Damage calculation, DMG Reduction Multiplier; Attribute page, Defense): Π(1 − effect), applies to all damage including Æther. Incoming damage only.
- Operator resistance from AGI and INT (Attribute page): up to 90% reduction of incoming damage. Incoming damage only.
- Hostile Combustion ignoring operator DEF, hostile Corrosion (operator DEF −20%), and hostile Electrification (operators take 20% more Arts damage, multiplicative) (Defense, Corrosion, Electrification pages). All apply to operators, not simulated.
- Susceptibility Effect Multiplier (Damage calculation, Susceptibility section; Susceptibility page): effects worded "the effect ... is 1.X times the original" multiply the Susceptibility sum (Last Rite's Cryogenic Embrittlement). D5 has no such rule.
- Special Bonus in Attack (Damage calculation; the Attribute page's "Flat Increases" line). Protocol Space bonuses are not in the engine rules.
- Crit-triggered effects (Critical Rate page: MI Security set, Artzy Tyrannical's skill). In expected mode no hit counts as a crit (C5), so these cannot fire there. Rolled mode can.
- Arts Intensity on Breach and Electrification damage-taken effects and Corrosion shred follows the same curve (Arts Intensity page). The engine has it (A25, A29, A31, B24); the Breach curve is not in the D and R groups, so not checked here.

## Agreements
- **D1** (formula chain): Attack × multipliers, with the source's Stagger ×1.3 and finisher, Link and multiplicative effects as one product. Same as the engine. The order does not matter for a product. Weakness and Protection are covered by W4 and the engine-silent list.
- **D3** (damage-bonus pool): one additive sum of element, skill-type (basic, battle, combo, ultimate), vs Staggered, and generic bonuses (Multiplier Group).
- **D4, D5** (Amp and Susceptibility): additive within each category, from several sources; the source says two Arts Susceptibility sources stack additively (Damage calculation). That is the claim behind open test 38 (docs/in-game-tests.md), but it is still a claim, not a measurement. Arts Amp and Arts Susceptibility apply to every arts element (Amp and Susceptibility pages). The engine's arts list is fire, pulse, cryst, natural (status.ts). The source does not say Æther is an arts element. The engine's amp and susceptibility buffs are per element in data, and I did not check that arts-category buffs expand to all four arts elements.
- **D6** (damage-taken zone): Breach, Electrification and "DMG taken" effects are additive, in the same zone (Damage calculation). Electrification is "Arts DMG Taken" on heat, cryo, nature and electric, which matches A26's element list (A26 is OPEN; the source does not define Æther).
- **D7** (multiplicative zone): Stagger, finisher, Link, and Fluorite's 30% are multiplicative (Damage calculation, Link section; Multiplicative examples). Stagger is ×1.3 in the source and +0.3 in the engine: the same product.
- **D8, E1, E9** (ATK): (operator + weapon ATK) × percentage bonuses + flat, then × attribute bonus. Flat after percentage. Same as the source's Attack formula (Damage calculation, Attribute page).
- **D9** (main and secondary terms): 0.005 and 0.002 (Attribute, Damage calculation). The 76–79 extra terms are in W2.
- **D19** (Arts Intensity scope): AI adds 1% per point to Arts Reaction, Arts Burst and Physical Status damage, including Shatter (Arts Intensity page). Combustion is listed with the Arts Reactions section of Damage calculation (12% + 12% per level), so it is covered; the engine's AI on Combustion ticks is therefore consistent with the source. Direct skill hits are not in the list (agrees).
- **D20, D21** (hidden level multipliers): 1 + (Lv − 1)/196 for Arts Burst, Arts Reaction and Shatter; 1 + (Lv − 1)/392 for Physical Status (Damage calculation). Same constants.
- **D22, R9** (no enemy level multiplier): the source says enemies do not have the hidden multiplier, tested on Earthshaking Hazefyre (Damage calculation). Operator level enters through these multipliers only.
- **R1** (DEF factor): 100 / (DEF + 100) for DEF ≥ 0. Enemies have 100 DEF at every level; operators have 0 (Damage calculation, Attribute, Defense). Same as 1 / (1 + 0.01·DEF).
- **R2** (negative DEF): 2 − 0.99^(−DEF), the same formula. The source notes that negative DEF "is currently not achievable".
- **R4, R5, R8** (resistance): (100 − enemy resistance + ignore resistance + Corrosion shred) / 100, with no floor and values above 1 allowed. Corrosion lowers resistance against all elements (Damage calculation, Corrosion page: "all Elements"; examples with −24 points at 1.24 and a Heavy Ram at −4). The engine's R8 says physical and Æther included, which fits the source's "all Elements".
- **N2, N3** (enemy DEF 100 and resistance as points): the source gives enemy resistance as letters (D = 0 points, C ≈ 20) and says the accurate values are on the enemy pages (Corrosion page). The enemy-page numbers were not read in this pass.
- **N11** (finisher multiplier per enemy): the source gives 1, 1.25 (Advanced), 1.5 (Elite, Alpha) and 1.75 (Boss), "the same for enemies of the same tier" (Damage calculation). The engine reads attribute 27 per enemy from data. The two agree if the data follow the tiers; the values in data were not checked here.
- **C1, C2, C3** (crit): base crit rate 5%, crit DMG 50%, crit multiplier 1 + crit DMG when the hit is critical (Damage calculation, Critical Rate). The source has no expected-value mode; that is the engine's own mode, so it is not a difference.
- **C4** (what can crit): DoT such as Combustion cannot crit (Damage calculation, Critical Rate). The source notes that some skills described as DoT can crit (Tangtang's ultimate). The engine has only Combustion ticks as DoT; the rule holds. Fixed damage (Si) is "not affected by any other multipliers" (Damage calculation), so no crit (D14) agrees.
- **C6** (per-landing roll): "Each damage instance individually rolls for a crit", including multi-hit skills (Critical Rate). Same as one draw per landing.

## Not covered by the source
- **S (Stagger):** the Arts Intensity page gives Lift and Knock Down Stagger as 10 × (1 + AI/200). For the S-group reviewer.
- **P and A (statuses):** base multipliers (Lift and Knock Down 120%; Crush 150% + 150% per Vulnerable; Breach 100–250% ATK by level; Shatter, Combustion and reactions per level) are on the Damage calculation and Breach pages. The Breach table (100%, 150%, 200%, 250%) matches Damage calculation's 50% + 50% per stack when level equals stacks consumed. Not compared with A and P values.
- **T (time):** durations (Electrification 12–30 s, Breach 12–30 s, Corrosion 15 s) are on the status pages; A27, A28 cover them.
- **B (buffs):** Link values (battle 30/45/60/75%, ultimate 20/30/40/50%, diminishing returns) and Electrification buff bonuses (Perlica) are on the Damage calculation and Electrification pages. Data-driven; not compared.
- **E (equipment):** gear DEF (four level-70 gold pieces give 140 DEF) and the potential DEF (Catcher +20) are on the Defense page. The engine's gear and DEF% rules (E5, E8) were not checked against these.
- **K:** no casting or timing mechanics were read.
- **N (enemy stats):** enemy resistance tables and the enemy page values were not read; the Resistance and Critical DMG titles do not exist on the wiki.

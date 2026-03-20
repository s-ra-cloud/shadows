# Non-Animal Physical Characteristics Hierarchy Proposal

Based on pending suggestions (IDs 65, 69, 71–76, 93–97, 105–109, 112, 114–116, 118, 121), here is a proposed hierarchy for non-animal physical characteristics traits.

---

## 1. BEARD hierarchy (suggestions #65, #93, #96)

Merge "beard" → "bearded", then group with sub-variants.

| Metacategory | Sub-trait (leaf) | Current count |
|---|---|---|
| **bearded** | bearded | 13+1 = 14 |
| | black beard | 1 |
| | red beard | 1 |

**Merge rule:** `beard` → `bearded`
**Total figures affected:** 16

---

## 2. FANGS hierarchy (suggestions #69, #105)

Merge into a single canonical value.

| Metacategory | Sub-trait (leaf) | Current count |
|---|---|---|
| **fanged** | fanged | 1+1 = 2 |

**Merge rule:** `fangs` → `fanged`
**Total figures affected:** 2

---

## 3. MULTI-ARMED hierarchy (suggestions #71, #76, #106, #112, #118)

Group all arm-count variants under one metacategory.

| Metacategory | Sub-trait (leaf) | Current count |
|---|---|---|
| **multiple arms** | four-armed | 2+1 = 3 |
| | six-armed | 4+2 = 6 |
| | many-armed | 1+1 = 2 |

**Merge rules:**
- `four arms` → `four-armed`
- `six arms` → `six-armed`
- `many arms` → `many-armed`

**Total figures affected:** 11

---

## 4. HALF-GENDERED hierarchy (suggestions #72, #73, #107, #108)

Merge hyphenated/spaced variants.

| Trait | Merge | Current count |
|---|---|---|
| **half female** | `half-female` → `half female` | 1+1 = 2 |
| **half male** | `half-male` → `half male` | 1+1 = 2 |

No metacategory needed — just 2 standalone merge rules.

**Total figures affected:** 4

---

## 5. HORNED hierarchy (suggestions #74, #109)

Merge "horns" → "horned". Note: bull horns and ram-horned already live under their animal metacategories (bull, ram) so they stay there.

| Trait | Merge | Current count |
|---|---|---|
| **horned** | `horns` → `horned` | 7+2 = 9 |

Standalone merge, no hierarchy needed.

**Total figures affected:** 9

---

## 6. BEAST hierarchy (suggestion #94)

Merge into one value.

| Trait | Merge | Current count |
|---|---|---|
| **beastly** | `beast` → `beastly` | 1+1 = 2 |

**Note:** Suggestion #95 says Despoina is incorrectly tagged as "beastly" — the Wikipedia source says Poseidon appeared as a beastly horse, not Despoina herself. This is a separate data correction.

**Total figures affected:** 2

---

## 7. MULTIPLE HEADS hierarchy (suggestions #114, #115, #121)

Group all head-count variants under one metacategory.

| Metacategory | Sub-trait (leaf) | Current count |
|---|---|---|
| **multiple heads** | multiple heads | 1 |
| | multi-headed | 1 |
| | three-headed | 3 |
| | three heads | 2 |
| | two heads | 1 |
| | seven heads | 1 |
| | nine heads | 1 |
| | eight-headed snake* | 1 |

**Merge rules:**
- `multi-headed` → `multiple heads`
- `three heads` → `three-headed`

*Note: "eight-headed snake" is already under the snake hierarchy. It could appear in both, or stay only under snake. Recommend keeping it under snake only since the animal aspect is primary.

**Total figures affected:** ~10

---

## 8. OLD / AGE hierarchy (suggestion #116)

| Metacategory | Sub-trait (leaf) | Current count |
|---|---|---|
| **old** | old | 1 |
| | old man | 1 |

Very small category. Could just merge `old man` → `old`, or keep as a simple hierarchy.

**Total figures affected:** 2

---

## 9. COLORED FACE hierarchy (suggestion #97)

Group face-color variants under a metacategory.

| Metacategory | Sub-trait (leaf) | Current count |
|---|---|---|
| **colored face** | blue face | 1 |
| | black face | 1 |
| | red face | 1 |

**Total figures affected:** 3

---

## RECLASSIFICATIONS (not hierarchies)

These are traits that should move to a different field entirely:

| Suggestion | Trait | Move to | Status |
|---|---|---|---|
| #91 | armor | → `object` field | Pending |
| #110 | fierce | → `characterTrait` field | Pending |
| #119 | smoking knife | → `object` field (as "obsidian knife") | Pending |

---

## OTHER (no hierarchy needed)

| Suggestion | Trait | Recommendation |
|---|---|---|
| #63 | bird | Investigate — Ami says "bird" is not a god's name, may be a data entry error |
| #70 | finger pressed | Unclear — may relate to "mouth bandaged", needs research decision |
| #120 | snakes → "snake hair" | Already merged `snakes` → `snake` in animal hierarchy. Gorgon's entry may need manual review to specify "snake-haired" instead of "snake" |

---

## Summary of merge rules (17 total)

1. `beard` → `bearded`
2. `fangs` → `fanged`
3. `four arms` → `four-armed`
4. `six arms` → `six-armed`
5. `many arms` → `many-armed`
6. `half-female` → `half female`
7. `half-male` → `half male`
8. `horns` → `horned`
9. `beast` → `beastly`
10. `multi-headed` → `multiple heads`
11. `three heads` → `three-headed`

## Summary of new hierarchies (4 total)

1. **bearded** — 3 leaves (bearded, black beard, red beard)
2. **multiple arms** — 3 leaves (four-armed, six-armed, many-armed)
3. **multiple heads** — 5 leaves (multiple heads, three-headed, two heads, seven heads, nine heads)
4. **colored face** — 3 leaves (blue face, black face, red face)

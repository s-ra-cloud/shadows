# Non-Animal Physical Characteristics — Hierarchy & Merge Proposal

Based on pending suggestions (IDs 65, 69, 71–76, 93–97, 105–109, 112, 114–116, 118, 121).

---

## PART A: HIERARCHIES (4 proposed)

These traits have enough sub-variants to justify a proper hierarchy in `trait_hierarchy`.

### 1. BEARDED (suggestions #65, #93, #96)

| Metacategory | Leaf trait | Count |
|---|---|---|
| **bearded** | bearded | 14 (after merge) |
| | black beard | 1 |
| | red beard | 1 |

Merge: `beard` → `bearded`

---

### 2. MULTIPLE ARMS (suggestions #71, #76, #106, #112, #118)

| Metacategory | Leaf trait | Count |
|---|---|---|
| **multiple arms** | four-armed | 3 (after merge) |
| | six-armed | 6 (after merge) |
| | many-armed | 2 (after merge) |

Merges: `four arms` → `four-armed`, `six arms` → `six-armed`, `many arms` → `many-armed`

---

### 3. MULTIPLE HEADS (suggestions #114, #115, #121)

| Metacategory | Leaf trait | Count |
|---|---|---|
| **multiple heads** | three-headed | 5 (after merge) |
| | two heads | 1 |
| | seven heads | 1 |
| | nine heads | 1 |

Merges: `multi-headed` → `multiple heads`, `three heads` → `three-headed`

Note: `eight-headed snake` stays under the snake animal hierarchy for now. It will naturally appear in both "multiple heads" and "snake" once cross-cutting hierarchies are implemented.

---

### 4. COLORED FACE (suggestion #97)

| Metacategory | Leaf trait | Count |
|---|---|---|
| **colored face** | blue face | 1 |
| | black face | 1 |
| | red face | 1 |

No merges needed.

---

## PART B: SIMPLE MERGES (no hierarchy needed)

These are duplicate/variant values that should be merged into one canonical form. No hierarchy needed because there's only one resulting value.

| Merge rule | Affected suggestions | Resulting count |
|---|---|---|
| `fangs` → `fanged` | #69, #105 | 2 |
| `half-female` → `half female` | #72, #107 | 2 |
| `half-male` → `half male` | #73, #108 | 2 |
| `horns` → `horned` | #74, #109 | 9 |
| `beast` → `beastly` | #94 | 2 |
| `old man` → `old` | #116 | 2 |

Note on #95 (beastly / Despoina): The Wikipedia source says Poseidon appeared as a beastly horse, not Despoina. This is a separate data correction to review.

---

## PART C: RECLASSIFICATIONS (move to different field)

| Suggestion | Trait | Move to |
|---|---|---|
| #91 | armor | → `object` |
| #110 | fierce | → `characterTrait` |
| #119 | smoking knife | → `object` (as "obsidian knife") |

---

## PART D: OTHER (needs your input)

| Suggestion | Trait | Question |
|---|---|---|
| #63 | bird | "This is not a god's name" — likely a data entry error, needs investigation |
| #70 | finger pressed | Unclear relation to "mouth bandaged" — needs research decision |
| #120 | snakes | Already merged to `snake` in animal hierarchy. Gorgon may need "snake-haired" as a distinct trait |

---

## FUTURE: Cross-cutting hierarchies & phylogenetic tree

These are noted for future implementation, not part of this batch:

**Cross-cutting hierarchies** — trait groupings that cut across categories, enabling filtered views on both the database page and the graph. Examples:
- "horned" view: groups bull horns + ram-horned + horned + any future horn traits regardless of animal
- "multi-headed" view: groups all head-count traits including eight-headed snake
- "winged" view: groups winged + four wings + bird traits with wings

**Phylogenetic-style animal super-hierarchy** — a higher-level classification above the current 27 animal metacategories:

```
Physical form
├── Human / Anthropomorphic
├── Animal
│   ├── Mammals
│   │   ├── Felines (lion, cat, leopard, jaguar, panther, lynx)
│   │   ├── Bovines (bull, cow, bison)
│   │   ├── Canines (dog, wolf, jackal, fox)
│   │   ├── Equines (horse, donkey)
│   │   ├── Ursines (bear)
│   │   ├── Cervids (deer, elk, stag)
│   │   ├── Other mammals (boar, pig, monkey, elephant, bat, rabbit, etc.)
│   │   └── ...
│   ├── Reptiles (snake, crocodile, lizard, turtle)
│   ├── Birds (eagle, falcon, vulture, owl, crow, etc.)
│   ├── Fish / Aquatic (fish, dolphin, whale, shark)
│   ├── Amphibians (frog, toad, salamander)
│   └── Insects / Arachnids (spider, scorpion, beetle, bee)
└── Monstrous / Chimeric (dragon, sphinx, chimera, griffin)
```

This structure will be stored in the database to allow proper classification and filtering, without changing the current graph behavior.

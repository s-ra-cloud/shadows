# Suggestions Report — SHADOWS Database
**Generated: 2026-03-21**

## Summary

| Status | Count |
|--------|-------|
| Approved (implemented) | 52 |
| Pending (not yet implemented) | 73 |
| Rejected | 1 |
| **Total** | **126** |

During this audit, **4 pending suggestions** (#96, #97, #115, #116) were found to be already implemented and have been moved to "approved."

---

## PART A — Approved & Implemented Suggestions

All 52 approved suggestions have been verified as implemented in the database.

### A1. Invalid Domain Names — Cleaned Up ✅
These domain entries were identified as not being actual domains and have been removed/replaced:

| # | Old Domain | Node | By |
|---|-----------|------|-----|
| 8, 31 | "as an armored hoplite" | Athena/Ares | Ami, Laura |
| 30 | "in greek works of art" | — | Laura |
| 32 | "early chinese pantheon" | — | Ami, Laura |
| 34 | "taoism" | — | Laura |
| 35 | "chan's taoism" | — | Laura |
| 36 | "by the jade emperor" | — | Laura |
| 37 | "memphis" | — | Laura |
| 41 | "by the hebrew šimah" | — | Laura |
| 42 | "or anglicized as" | — | Laura |
| 43 | "city of byblos" | — | Laura |
| 45 | "mount fuji" | — | Laura |
| 46, 56, 59 | "it was called a" | — | Laura, Ami, CB |
| 48 | "suwa shrine" | — | Laura |
| 49 | "land of one's birth" | — | Laura |
| 58 | "leader of the titans" | Kronos | Ami, Laura |

### A2. Domain Additions ✅
| # | Domain | Action | By |
|---|--------|--------|-----|
| 50 | "first pair of humans" | Added to Adam & Eve | Laura |
| 54 | "trickery" | Hermes confirmed present | Laura |

### A3. Trait Moved to Correct Category ✅
| # | Trait | From | To | By |
|---|-------|------|----|-----|
| 103 | cornucopia | physical_characteristics | object | Laura |
| 111 | horsemen | physical_characteristics | character_trait | Laura |
| 113 | matron | physical_characteristics | character_trait | Laura |
| 117 | phrygian helmeted | physical_characteristics | object | Laura |
| 122 | trumpet | physical_characteristics | object | Laura |
| 124 | warrior maiden | physical_characteristics | character_trait | Laura |
| 125 | winged helmet | physical_characteristics | object | Laura |
| 126 | winged sandals | physical_characteristics | object | Laura |
| 127 | wrathful | physical_characteristics | character_trait | Laura |

### A4. Hierarchy Structure — Created ✅
| # | Action | By |
|---|--------|-----|
| 92 | Created "animal-headed" cross-cutting metacategory (25 entries) | Laura |
| 98 | "bull horns" / "bull head" as subcategories of "bull" under bovine | Laura |
| 99 | "bull" kept as leaf alongside its sub-traits | Laura |
| 100 | "cat-headed" as subcategory of "cat" under feline | Laura |
| 101 | "circular snake" as subcategory of "snake" under reptile | Laura |
| 102 | "cobra" (with "cobra-headed", "uraeus") as subcategory of "snake" | Laura |
| 104 | "cow ears", "cow horns", "cow-headed" under "cow" metacategory | Laura |
| 96 | "black beard" as subcategory of "bearded" | Laura |
| 97 | Colored face metacategory (blue face, black face, red face) | Laura |
| 115 | "nine heads" in "multiple-heads" cross-cut group | Laura |
| 116 | "old man" as subcategory under "age" (alongside "old") | Laura |

### A5. Duplicate Trait Names — Resolved in Hierarchy ✅
| # | Duplicate Pair | Resolution | By |
|---|---------------|------------|-----|
| 66 | "cow-horned" / "cow horn" | Both under "cow" in hierarchy | CB |
| 67 | "dog-headed" / "dog head" | Under "dog" in hierarchy | CB |
| 68 | "falcon head" / "falcon-headed" | Under "falcon" in hierarchy | CB |
| 75 | lion-headed variants | All under "lion" in hierarchy | CB |

### A6. Other Approved ✅
| # | Action | By |
|---|--------|-----|
| 2 | Edit on node 4163 | Ami |
| 17 | Caduceus → Hermes confirmed | CB |
| 20 | Musical instruments → Pan confirmed | CB |
| 21 | Moon → Tsukuyomi added | Laura |
| 24 | Animal category grouping applied | CB |
| 26 | Bull category grouping applied | CB |
| 60 | Caduceus → Hermes symbol confirmed | CB |

### Rejected
| # | Suggestion | Reason | By |
|---|-----------|--------|-----|
| 62 | Merge all "city X" domains into "city" | Would lose specificity | CB |

---

## PART B — Pending Suggestions (Not Yet Implemented)

### Group 1: Physical Characteristics — Trait Merges (22 suggestions)
These are duplicate or near-duplicate traits that should be merged (one kept, nodes re-assigned).

#### 1a. Hyphenated / Non-Hyphenated Duplicates
| # | Merge From | Merge Into | Nodes Affected | By |
|---|-----------|-----------|----------------|-----|
| 69, 105 | "fangs" (1 node) | "fanged" (1 node) | 2 | CB, Laura |
| 71, 106 | "four arms" (1 node) | "four-armed" (2 nodes) | 3 | CB, Laura |
| 72, 107 | "half-female" (1 node) | "half female" (1 node) | 2 | CB, Laura |
| 73, 108 | "half-male" (1 node) | "half male" (1 node) | 2 | CB, Laura |
| 74, 109 | "horns" (2 nodes) | "horned" (existing) | 2+ | CB, Laura |
| 76, 112 | "many arms" (1 node) | "many-armed" (1 node) | 2 | CB, Laura |
| 118 | "six-armed" (4 nodes) | merge with multi-arm group | 4 | Laura |

#### 1b. Semantic Merges
| # | Merge From | Merge Into | By |
|---|-----------|-----------|-----|
| 65, 93 | "beard" (1 node) | "bearded" (metacategory) | CB, Laura |
| 94 | "beast" (1 node) | "beastly" (existing) | Laura |
| 114 | "multi-headed" (1 node) | "multiple heads" cross-cut group | Laura |
| 121 | "three-headed" (3 nodes) | "three heads" (needs merge direction decided) | Laura |

### Group 2: Physical Characteristics — Category Misplacements (4 suggestions)
Traits that belong in a different category field.

| # | Trait | Current Category | Should Be | Nodes | By |
|---|-------|-----------------|-----------|-------|-----|
| 91 | "armor" | physical_characteristics | object | Bellona | Laura |
| 110 | "fierce" | physical_characteristics | character_trait | Raijin, Wudao Jiangjun | Laura |
| 63 | "bird" (node D21:Aa1...) | physical_characteristics | Name is a hieroglyphic code, not a god name | 1 node | Ami |
| 119 | "smoking knife" | physical_characteristics | Needs discussion: could be object + PC "obsidian in forehead" | Tezcatlipoca | Laura |

### Group 3: Physical Characteristics — Sub-Categorization (4 suggestions)
| # | Trait | Suggested Action | By |
|---|-------|-----------------|-----|
| 15 | "black bull" | Place under "bull" metacategory (hierarchy already exists, node data not re-mapped) | CB |
| 22 | "pan flute" | Create "instrument" metacategory for objects, with sub-items | CB |
| 38 | "beautiful" | Harmonize synonyms (beautiful, radiant, etc.) — many single-god entries | CB |
| 120 | "snakes" → "snake hair" | Medusa already has "snake-haired"; original "snakes" entry no longer exists | Laura |

### Group 4: Physical Characteristics — Data Corrections (3 suggestions)
| # | Node | Issue | By |
|---|------|-------|-----|
| 70 | Angerona | "finger pressed" — questionable trait (also has "bandaged mouth") | CB |
| 95 | Despoina | Has "beastly" — but it's Poseidon who is beastly (horse form), not Despoina | Laura |
| 44 | "huntress" | Only 1 god? Others may also qualify | CB |

### Group 5: Death Types — Underscore Removal (10 suggestions)
All death types currently use underscores (`killed_by_god`). Suggestions #77–86 ask to remove underscores to make them human-readable.

| # | Current Value | Proposed | By |
|---|--------------|----------|-----|
| 77 | betrayed_and_killed | betrayed and killed | Ami |
| 78 | immortality_denied | immortality denied | Ami |
| 79 | killed_by_god | killed by god | Ami |
| 80 | killed_by_hero | killed by hero | Ami |
| 81 | killed_by_kin | killed by kin | Ami |
| 82 | killed_in_battle | killed in battle | Ami |
| 83 | natural_death | natural death | Ami |
| 84 | prophesied_death | prophesied death | Ami |
| 85 | sacrificed_ritually | sacrificed ritually | Ami |
| 86 | transformation_at_death | transformation at death | Ami |

**Note:** This would affect 60 nodes with death types. The change needs to be applied consistently across nodes, the UI, and the graph visualization trait coloring.

### Group 6: Death Types — Data Corrections (4 suggestions)
| # | Node | Current Death Type | Suggested Correction | By |
|---|------|--------------------|---------------------|-----|
| 87 | Pang Juan | betrayed_and_killed | killed_in_battle or suicide | Ami |
| 87 | Troilus | betrayed_and_killed | killed_by_hero (killed by Achilles) | Ami |
| 88 | Nut | dismemberment | Evidence needed for this classification | Ami |
| 89 | Caeneus | killed_by_hero | transformation_at_death (turned into bird) | Ami |
| 90 | Tongtian Jiaozhu | killed_by_hero | killed_in_battle | Ami |

### Group 7: Domain Questions & Fixes (16 suggestions)
Suggestions about domain values that need decisions or corrections.

#### 7a. Domains to Rename/Fix
| # | Node | Current Domain | Suggested | By |
|---|------|---------------|-----------|-----|
| 3, 33 | Lares Familiares | "a particular place" | "hearth" | Ami, Laura |
| 23 | Amun | "thebes by replacing montu" | Too specific — needs proper domain | Laura |
| 39 | Febris | "fevers" | "fever" or "illness" | Laura |
| 55 | Inari Ōkami | "war, crafts" | Add "grain supply" / grain | Ami |
| 53 | Inari Ōkami | "war, crafts" | Add "fertility, agriculture" | Ami |

#### 7b. Domain Questions (Need Decisions)
| # | Node | Domain | Question | By |
|---|------|--------|----------|-----|
| 10 | Lares Familiares | "a particular place" | Keep "lares familiares"? | CB |
| 11 | (cleared) | was "as an armored hoplite" | Replacement: "wine"? | Ami |
| 13 | (cleared) | was "by the hebrew šimah" | Replacement: "wine"? | Ami |
| 16 | (cleared) | was "by the jade emperor" | Replacement: "creation"? | Ami |
| 19 | (cleared) | was "early chinese pantheon" | Replacement: "agriculture, fertility"? | Ami |
| 25 | Kronos | "leader of the titans" | Already approved as #58 — should be removed | Laura |
| 27 | Elete | "hour of prayer" | Too specific? Replace with what? | Laura |
| 28 | Penia | "poverty and need" | Split into 2 separate domains? | Laura |
| 29 | Potnia | "nature, mystery cults" | "mystery cults" too specific to Greek? | Laura |
| 51 | Ahuiateteo | "tzitzimimeh" | Unknown meaning — is it a valid domain? | Laura |
| 52 | (Vesta exists, not Hestia) | "hearth" | Hestia should appear in hearth domain | Laura |
| 57 | Apollo | "sun, prophecy, music, order" | Missing "art" as domain? | Laura |

### Group 8: Gender / Non-Binary Entries (5 suggestions)
Questions about "Non-binary" gender entries that appear to be group names rather than actual genders.

| # | Issue | Examples | By |
|---|-------|---------|-----|
| 4 | "Chinese gods and immortals" not a name → in Non-binary | — | Camille |
| 5 | "Aztec creator gods" → in Non-binary | — | Camille |
| 6 | "Les Dii Consentes" → group name in Non-binary | — | CB |
| 7 | "Custom of ancient Egypt" → in Non-binary | — | CB |
| 9 | "Novensiles" → in Non-binary | — | CB |

### Group 9: Structural / Feature Requests (4 suggestions)
| # | Request | By |
|---|---------|-----|
| 12 | Kore = Persephone? (Both exist as separate nodes: Kore #3397, Persephone #3425, same domains) | CB |
| 14 | Uranus has no animals listed — should it? | CB |
| 18 | Freyja should have "cat" — node not found in database | CB |
| 64 | Add "married to" as a family role (currently only mother/father/sister/brother) | CB |

### Group 10: Character Trait Questions (3 suggestions)
| # | Trait | Issue | By |
|---|-------|-------|-----|
| 40 | "dangerous" | Only 1 god — should others be added? | CB |
| 47 | "selfless" | Should be a group/category | CB |
| 61 | Domain with only 1 character | Single-character categories not optimal | CB |

---

## Key Statistics

- **Implemented:** 52 approved + 4 newly approved = 56 total
- **Pending:** 73 remaining (now 69 after 4 moved to approved)
- **Biggest pending groups:**
  - Trait merges (22 suggestions) — mechanical work, can be batched
  - Death type underscore removal (10 suggestions) — single batch operation
  - Domain questions (16 suggestions) — need team decisions
  - Gender/Non-binary cleanup (5 suggestions) — need team decisions

## Recommended Priority Order

1. **Death type underscores** (#77-86) — 10 suggestions, single batch operation affecting 60 nodes
2. **Trait merges** (#65-76, #93-94, #105-109, #112, #114, #118, #121) — 22 suggestions, mechanical merges
3. **Category misplacements** (#91, #110) — 2 suggestions, quick moves
4. **Data corrections** (#87-90, #95) — 5 suggestions, individual fixes with clear direction
5. **Domain fixes** (#3, #23, #39, #53, #55) — 5 suggestions with clear replacements
6. **Domain questions** (#10-16, #27-29, #51-52, #57) — 12 suggestions needing team input
7. **Gender cleanup** (#4-7, #9) — 5 suggestions needing team decisions
8. **Feature requests** (#12, #14, #18, #64) — 4 suggestions needing design decisions

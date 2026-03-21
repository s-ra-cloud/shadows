# Cross-Cutting Hierarchy Report

These are "transversal" groupings that cut across the animal-specific hierarchies, allowing filtered views like "show me all deities with horns, regardless of the animal the horns come from."

---

## 1. HORNED — 16 deities

Groups all horn-related traits regardless of source animal.

| Source hierarchy | Trait | Currently under |
|---|---|---|
| Bull | bull horns | bull (bovine > mammal) |
| Cow | cow horns | cow (bovine > mammal) |
| Ram | ram-horned | ram (caprine > mammal) |
| Standalone | horned (7 nodes) | not in hierarchy yet |
| Standalone | horns (2 nodes) | not in hierarchy yet |
| Standalone | curved horns (1 node) | not in hierarchy yet |
| Standalone | two-horned (1 node) | not in hierarchy yet |
| Deer | deer body + horns (1 node) | deer (cervid > mammal) |

**Cross-cut view would include:** bull horns + cow horns + ram-horned + horned + horns + curved horns + two-horned = all deities with any horn trait.

**Recommendation:** Create. High value — 16 affected deities, 7 distinct horn sub-types spanning 3 animal families.

---

## 2. ANIMAL-HEADED — 60 deities

Groups all "-headed" traits regardless of the specific animal.

| Source hierarchy | Traits |
|---|---|
| Snake | snake-headed |
| Cobra | cobra-headed |
| Bull | bull-headed |
| Lion | lion-headed (most common — ~15 deities) |
| Feline | feline-headed |
| Cow | cow-headed |
| Bird | bird-headed |
| Falcon | falcon-headed (very common — ~12 deities) |
| Vulture | vulture-headed |
| Ibis | ibis-headed |
| Horse | horse-headed |
| Dog | dog-headed |
| Crocodile | crocodile-headed |
| Ram | ram-headed |
| Frog | frog-headed |
| Cat | cat-headed |
| Turtle | turtle-headed |
| Tiger | tiger-headed |
| Hare | hare-headed |
| Donkey | donkey-headed |
| Jackal | jackal-headed |
| Gazelle | gazelle-headed |
| Baboon | baboon-headed |

**Recommendation:** Create. Very high value — 60 affected deities, 23 distinct animal-head types. This is the largest cross-cutting group. It directly enables filtering "all therianthropic deities" (human body + animal head).

---

## 3. WINGED — 36 deities

Groups all wing-related traits.

| Source | Trait | Count |
|---|---|---|
| Standalone | winged | 26 |
| Standalone | wings | 3 |
| Standalone | folded wings | 1 |
| Standalone | black-winged | 1 |
| Standalone | four wings | part of compound traits |
| Deer | winged deer | 1 |
| Insect | butterfly wings | 1 |
| Bat | bat wings | 1 |

**Recommendation:** Create. High value — 36 deities. Allows answering "which deities have wings?" regardless of whether the wings come from a bird, bat, insect, or are standalone divine attributes.

---

## 4. TAILED — small but useful

Groups tail-related traits.

| Source | Trait |
|---|---|
| Serpent | serpent's tail |
| Horse | horse tail |
| Fish | fish tail |
| Fox | nine-tailed |

**Recommendation:** Optional. Only ~3-5 nodes directly, but it would grow as more data is added. Could wait.

---

## 5. ANIMAL-BODIED — moderate value

Groups "has body of animal X" traits.

| Source | Trait |
|---|---|
| Lion | lion body |
| Cow | cow form, cow-bodied |
| Goat | goat body |
| Deer | deer body |
| Fish | half fish, part fish |
| Goat | half goat |

**Recommendation:** Create. Moderate value — enables filtering "chimeric" deities that have an animal body combined with human or other features. Complements the "animal-headed" cross-cut.

---

## 6. MULTIPLE HEADS — ~10 deities (from pending hierarchies)

| Trait | Count |
|---|---|
| multi-headed / multiple heads | 2 (to be merged) |
| three-headed / three heads | 5 (to be merged) |
| two heads | 1 |
| seven heads | 1 |
| nine heads | 1 |
| eight-headed snake | 1 (also in snake hierarchy) |
| six-headed | 1 |

**Recommendation:** Create (already proposed in the non-animal hierarchy report). This is a natural cross-cut because "eight-headed snake" lives under the snake hierarchy but should also appear under "multiple heads."

---

## 7. MULTIPLE ARMS — ~11 deities (from pending hierarchies)

| Trait | Count |
|---|---|
| four-armed / four arms | 3 (to be merged) |
| six-armed / six arms | 6 (to be merged) |
| many-armed / many arms | 2 (to be merged) |
| eight arms | 1 |

**Recommendation:** Already proposed. Standalone hierarchy, not really cross-cutting since arms aren't animal-specific.

---

## Summary: Recommended Cross-Cutting Hierarchies

| Priority | Cross-cut | Deities affected | Value |
|---|---|---|---|
| **HIGH** | Animal-headed | 60 | Largest group, enables therianthrope filtering |
| **HIGH** | Winged | 36 | Second largest, enables flight/aerial filtering |
| **HIGH** | Horned | 16 | Spans 3+ animal families, mythologically significant |
| **MEDIUM** | Multiple heads | ~10 | Already proposed, natural cross-cut with snake hierarchy |
| **MEDIUM** | Animal-bodied | ~8 | Enables chimera/hybrid filtering |
| **LOW** | Tailed | ~5 | Small group, can wait |

These cross-cutting views would be stored separately from the phylogenetic hierarchy (e.g., in a `trait_cross_cut` table), and would enable filter buttons on both the Database page and the Graph page.

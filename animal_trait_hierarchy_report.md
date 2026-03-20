# Physical Characteristics — Animal Trait Hierarchy Proposal

## Overview

The current `physical_characteristics` field contains 299 distinct individual trait values across the database. Many animal-related traits are redundant or could benefit from a hierarchical grouping (metacategory → subcategories). This report proposes grouping all animal-related traits under metacategories.

**How it works:** Each node's `physical_characteristics` field is a comma-separated text. The plan is to introduce a separate hierarchical mapping that groups specific traits under broader metacategories. The raw data stays the same, but the UI and graph can display/filter by metacategory.

---

## Proposed Animal Metacategories

### 🐍 SNAKE / SERPENT
**Metacategory:** `snake`
| Subcategory | Nodes |
|---|---|
| snake | 7 |
| snakes | 1 |
| serpent | 3 |
| serpentine | 15 |
| serpent woman | 1 |
| serpent-headed | 2 |
| serpent's tail | 1 |
| snake head | 1 |
| snake-headed | 2 |
| snake-haired | 2 |
| snake leg | 1 |
| snake skirt | 1 |
| cobra | 5 |
| cobra-headed | 2 |
| circular snake | 1 |
| eight-headed snake | 1 |
| plumed serpent | 1 |
| uraeus | 2 |
**Total: ~49 node-trait occurrences**

---

### 🐂 BULL
**Metacategory:** `bull`
| Subcategory | Nodes |
|---|---|
| bull | 4 |
| bull horns | 1 |
| bull-headed | 1 |
| black bull | 1 |
**Total: ~7 node-trait occurrences**

---

### 🦁 LION
**Metacategory:** `lion`
| Subcategory | Nodes |
|---|---|
| lion | 4 |
| lion body | 1 |
| lion heads | 1 |
| lion-headed | 9 |
| lion's head | 4 |
| lioness | 5 |
| lioness head | 1 |
| feline | 2 |
| feline-headed | 1 |
**Total: ~28 node-trait occurrences**

---

### 🐄 COW
**Metacategory:** `cow`
| Subcategory | Nodes |
|---|---|
| cow form | 3 |
| cow ears | 1 |
| cow horns | 2 |
| cow-bodied | 1 |
| cow-eyed | 1 |
| cow-headed | 2 |
| cow-horned | 1 |
| white cow | 1 |
**Total: ~12 node-trait occurrences**

---

### 🦅 FALCON / BIRD
**Metacategory:** `bird`
| Subcategory | Nodes |
|---|---|
| bird | 1 |
| bird head | 2 |
| bird's beak | 1 |
| falcon | 4 |
| falcon head | 1 |
| falcon-headed | 3 |
| ibis-headed | 1 |
| owl | 2 |
| sparrowhawk head | 1 |
| vulture cap | 1 |
| vulture form | 1 |
| vulture-headed | 1 |
| griffon vulture | 1 |
| kite | 1 |
| turkey | 1 |
| rooster form | 1 |
| swan-like | 1 |
| white peacock | 1 |
| part bird | 1 |
| feathered | 6 |
| ostrich feathers | 1 |
**Total: ~33 node-trait occurrences**

---

### 🐎 HORSE
**Metacategory:** `horse`
| Subcategory | Nodes |
|---|---|
| horse | 1 |
| horse ears | 1 |
| horse legs | 1 |
| horse tail | 1 |
| horse-headed | 1 |
| mare | 1 |
| foal | 1 |
| horsemen | 1 |
**Total: ~8 node-trait occurrences**

---

### 🐕 DOG
**Metacategory:** `dog`
| Subcategory | Nodes |
|---|---|
| dog head | 1 |
| dog-headed | 1 |
**Total: ~2 node-trait occurrences**

---

### 🐊 CROCODILE
**Metacategory:** `crocodile`
| Subcategory | Nodes |
|---|---|
| crocodile | 3 |
| crocodile-headed | 2 |
**Total: ~5 node-trait occurrences**

---

### 🐏 RAM
**Metacategory:** `ram`
| Subcategory | Nodes |
|---|---|
| ram | 2 |
| ram-headed | 3 |
| ram-horned | 1 |
| ram's head | 1 |
| four rams' heads | 1 |
**Total: ~8 node-trait occurrences**

---

### 🐸 FROG
**Metacategory:** `frog`
| Subcategory | Nodes |
|---|---|
| frog | 1 |
| frog-headed | 3 |
**Total: ~4 node-trait occurrences**

---

### 🦇 BAT
**Metacategory:** `bat`
| Subcategory | Nodes |
|---|---|
| bat wings | 1 |
**Total: ~1 node-trait occurrence**

---

### 🐱 CAT
**Metacategory:** `cat`
| Subcategory | Nodes |
|---|---|
| cat | 1 |
| cat-headed | 1 |
**Total: ~2 node-trait occurrences**

---

### 🐢 TURTLE
**Metacategory:** `turtle`
| Subcategory | Nodes |
|---|---|
| turtle | 1 |
| turtle head | 1 |
**Total: ~2 node-trait occurrences**

---

### 🐋 SEA CREATURE / FISH
**Metacategory:** `fish`
| Subcategory | Nodes |
|---|---|
| fish's tail | 1 |
| half fish | 1 |
| part fish | 1 |
| sea monster | 2 |
| sea goat | 1 |
| seal head | 1 |
**Total: ~7 node-trait occurrences**

---

### 🐉 DRAGON
**Metacategory:** `dragon`
| Subcategory | Nodes |
|---|---|
| dragon | 3 |
**Total: ~3 node-trait occurrences**

---

### 🐐 GOAT
**Metacategory:** `goat`
| Subcategory | Nodes |
|---|---|
| goat's body | 1 |
| half goat | 1 |
| sea goat | 1 |
**Total: ~3 node-trait occurrences**

---

### 🦌 DEER
**Metacategory:** `deer`
| Subcategory | Nodes |
|---|---|
| deer body | 1 |
| winged deer | 1 |
**Total: ~2 node-trait occurrences**

---

### 🦊 FOX
**Metacategory:** `fox`
| Subcategory | Nodes |
|---|---|
| white fox | 1 |
| nine-tailed | 1 |
**Total: ~2 node-trait occurrences**

---

### 🐆 JAGUAR / TIGER
**Metacategory:** `big cat (wild)`
| Subcategory | Nodes |
|---|---|
| jaguar | 1 |
| tiger-headed | 1 |
**Total: ~2 node-trait occurrences**

---

### 🐛 INSECT
**Metacategory:** `insect`
| Subcategory | Nodes |
|---|---|
| scarab | 2 |
| scarab beetle | 1 |
| butterfly wings | 2 |
| scorpion | 1 |
| scorpion sting | 1 |
**Total: ~7 node-trait occurrences**

---

### 🦛 HIPPOPOTAMUS
**Metacategory:** `hippopotamus`
| Subcategory | Nodes |
|---|---|
| hippopotamus | 2 |
**Total: ~2 node-trait occurrences**

---

### 🐇 HARE
**Metacategory:** `hare`
| Subcategory | Nodes |
|---|---|
| hare's head | 1 |
**Total: ~1 node-trait occurrence**

---

### 🐴 DONKEY
**Metacategory:** `donkey`
| Subcategory | Nodes |
|---|---|
| donkey-headed | 1 |
**Total: ~1 node-trait occurrence**

---

### 🐺 JACKAL
**Metacategory:** `jackal`
| Subcategory | Nodes |
|---|---|
| jackal-headed | 2 |
**Total: ~2 node-trait occurrences**

---

### 🦅 GAZELLE
**Metacategory:** `gazelle`
| Subcategory | Nodes |
|---|---|
| gazelle-headed | 1 |
**Total: ~1 node-trait occurrence**

---

## Traits NOT categorized as animal (left unchanged)

The following trait types are **not** animal-related and will remain as-is:
- **Body descriptors:** beautiful, giant, dwarf, golden, monstrous, bearded, crowned, radiant, muscular, etc.
- **Body parts:** horned, horns, two-horned, many-armed, six-armed, four-armed, multiple heads, three-headed, etc.
- **Objects worn/held:** armor, cornucopia, knife, smoking knife, trumpet, winged sandals, winged helmet, phrygian helmeted, sun disk, etc.
- **Character descriptors:** fierce, wrathful, warrior maiden, matron, beast/beastly, etc.
- **Skin/color:** golden, green-skinned, blue-skinned, black, red, yellow, etc.
- **Wings:** winged, black-winged, wings, folded wings, bat wings (bat wings goes under bat)
- **Other:** half-human, half-male/female, skeletal, mummy, veiled, naked, etc.

---

## Open questions for your review

1. **"horned" / "horns" / "two-horned"** — These are generic horn references that appear on many animals (bull, ram, cow). Should they stay standalone, or be grouped under the specific animal when context is clear (e.g., "cow horns" → cow, "bull horns" → bull, but standalone "horned" stays generic)?

2. **"sea goat"** — Listed under both goat and fish. Should it be in one or both?

3. **"bat wings"** — Only 1 occurrence. Worth a separate "bat" metacategory, or fold under a broader "wings" group?

4. **Single-occurrence animals** (hare, donkey, gazelle) — Keep as separate metacategories, or group under a generic "other animals" metacategory?

5. **"nine-tailed"** — Grouped under fox (kitsune reference). Correct?

6. **"feline" / "feline-headed"** — Grouped under lion. Or should there be a separate "feline" metacategory that includes lion AND cat AND jaguar/tiger?

7. **Laura's suggestion about "winged sandals", "winged helmet", "trumpet", "cornucopia", "armor"** — These aren't physical characteristics but objects. Should they be moved to the "object" field? (This is a separate cleanup from the animal hierarchy.)

8. **Laura's suggestion about "wrathful", "warrior maiden", "fierce", "matron"** — These are character traits, not physical. Should they be moved to the "character_trait" field?

---

## Implementation approach

The hierarchy will be stored as a new database table `trait_hierarchy` mapping each subcategory to its metacategory. The `physical_characteristics` data on nodes stays unchanged — the hierarchy is an overlay for UI grouping, filtering, and graph analysis.

```
trait_hierarchy:
  id | category_field | metacategory | subcategory
  1  | physical_characteristics | snake | cobra
  2  | physical_characteristics | snake | cobra-headed
  3  | physical_characteristics | snake | serpentine
  ...
```

This lets the Database tab and Graph views group by metacategory while preserving the original specific values.

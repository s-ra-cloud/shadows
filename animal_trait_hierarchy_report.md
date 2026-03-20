# Physical Characteristics — Animal Trait Hierarchy v3

## Structural Principles

1. **Nodes only at leaf level**: intermediate levels (metacategory, subcategory) are grouping containers — no node should be tagged with a non-leaf value
2. **Multi-level hierarchy**: up to 3+ levels deep where needed
3. **Merge duplicates**: synonymous traits are merged into a single canonical leaf name
4. **Full-form vs partial-form distinction**: at the subcategory level, the animal name itself (e.g. "bull") represents deities that are fully that animal, while "bull-headed", "bull horns" etc. represent deities with partial animal features. Both sit at the same level as siblings.

### Reading the trees below

```
metacategory/                      <-- level 0: grouping only, never on a node
  |-- subcategory                  <-- level 1: grouping only (or leaf if no children)
  |     |-- leaf (N nodes)         <-- level 2: actual value stored on nodes
```

Where a subcategory has no children, it IS the leaf and nodes can have that value.

---

## Proposed Hierarchies

---

### SNAKE (metacategory)

```
snake/                                    [grouping]
  |
  |-- snake/                              [grouping]
  |     |-- snake              (8 nodes)  [leaf] MERGE: + "snakes" (1)
  |     |-- snake-headed       (5 nodes)  [leaf] MERGE: "snake head" (1) + "snake-headed" (2) + "serpent-headed" (2)
  |     |-- snake-haired       (2 nodes)  [leaf]
  |     |-- snake leg          (1 node)   [leaf]
  |     |-- snake skirt        (1 node)   [leaf]
  |     |-- eight-headed snake (1 node)   [leaf]
  |     |-- circular snake     (1 node)   [leaf]
  |
  |-- serpentine/                         [grouping]
  |     |-- serpentine        (18 nodes)  [leaf] MERGE: + "serpent" (3)
  |     |-- serpent woman      (1 node)   [leaf]
  |     |-- serpent's tail     (1 node)   [leaf]
  |     |-- plumed serpent     (1 node)   [leaf]
  |
  |-- cobra/                              [grouping]
        |-- cobra              (5 nodes)  [leaf]
        |-- cobra-headed       (2 nodes)  [leaf]
        |-- uraeus             (2 nodes)  [leaf]
```

**Merges:**
- "snakes" -> "snake" (1 node)
- "snake head" -> "snake-headed" (1 node)
- "serpent-headed" -> "snake-headed" (2 nodes)
- "serpent" -> "serpentine" (3 nodes)

---

### BULL (metacategory)

```
bull/                                     [grouping]
  |-- bull                     (4 nodes)  [leaf] = fully bull deities
  |-- bull-headed              (1 node)   [leaf]
  |-- bull horns               (1 node)   [leaf]
  |-- black bull               (1 node)   [leaf]
```

**Merges:** none

---

### LION (metacategory)

```
lion/                                     [grouping]
  |-- lion                     (4 nodes)  [leaf] = fully lion deities
  |-- lion-headed             (14 nodes)  [leaf] MERGE: + "lion heads" (1) + "lion's head" (4) + "lioness head" (1)
  |-- lion body                (1 node)   [leaf]
  |-- lioness                  (5 nodes)  [leaf]
  |-- feline                   (2 nodes)  [leaf]
  |-- feline-headed            (1 node)   [leaf]
```

**Merges:**
- "lion heads" -> "lion-headed" (1 node)
- "lion's head" -> "lion-headed" (4 nodes)
- "lioness head" -> "lion-headed" (1 node)

---

### COW (metacategory)

```
cow/                                      [grouping]
  |-- cow form                 (3 nodes)  [leaf] = fully cow deities
  |-- cow-headed               (2 nodes)  [leaf]
  |-- cow-bodied               (1 node)   [leaf]
  |-- cow-eyed                 (1 node)   [leaf]
  |-- cow ears                 (1 node)   [leaf]
  |-- cow horns                (3 nodes)  [leaf] MERGE: + "cow-horned" (1)
  |-- white cow                (1 node)   [leaf]
```

**Merges:**
- "cow-horned" -> "cow horns" (1 node)

**Note:** "cow-horned" merged into "cow horns" (not "cow-headed"), since having cow horns is distinct from having a full cow head.

---

### BIRD (metacategory)

```
bird/                                     [grouping]
  |
  |-- bird/                               [grouping: generic bird]
  |     |-- bird               (1 node)   [leaf] = fully bird deities
  |     |-- bird-headed        (3 nodes)  [leaf] MERGE: "bird head" (2) + "bird's beak" (1)
  |     |-- feathered          (6 nodes)  [leaf]
  |     |-- part bird          (1 node)   [leaf]
  |
  |-- falcon/                             [grouping]
  |     |-- falcon             (4 nodes)  [leaf]
  |     |-- falcon-headed      (4 nodes)  [leaf] MERGE: + "falcon head" (1)
  |
  |-- vulture/                            [grouping]
  |     |-- vulture            (1 node)   [leaf] MERGE: "vulture form" (1)
  |     |-- vulture-headed     (1 node)   [leaf]
  |     |-- vulture cap        (1 node)   [leaf]
  |     |-- griffon vulture    (1 node)   [leaf]
  |
  |-- owl                      (2 nodes)  [leaf]
  |-- ibis-headed              (1 node)   [leaf]
  |-- sparrowhawk              (1 node)   [leaf] MERGE: "sparrowhawk head" (1)
  |-- rooster                  (1 node)   [leaf] MERGE: "rooster form" (1)
  |-- swan                     (1 node)   [leaf] MERGE: "swan-like" (1)
  |-- white peacock            (1 node)   [leaf]
  |-- kite                     (1 node)   [leaf]
  |-- turkey                   (1 node)   [leaf]
  |-- ostrich                  (1 node)   [leaf] MERGE: "ostrich feathers" (1)
```

**Merges:**
- "bird head" -> "bird-headed" (2 nodes)
- "bird's beak" -> "bird-headed" (1 node)
- "falcon head" -> "falcon-headed" (1 node)
- "vulture form" -> "vulture" (1 node)
- "sparrowhawk head" -> "sparrowhawk" (1 node)
- "rooster form" -> "rooster" (1 node)
- "swan-like" -> "swan" (1 node)
- "ostrich feathers" -> "ostrich" (1 node)

---

### HORSE (metacategory)

```
horse/                                    [grouping]
  |-- horse                    (1 node)   [leaf] = fully horse deities
  |-- horse-headed             (1 node)   [leaf]
  |-- horse ears               (1 node)   [leaf]
  |-- horse legs               (1 node)   [leaf]
  |-- horse tail               (1 node)   [leaf]
  |-- mare                     (1 node)   [leaf]
  |-- foal                     (1 node)   [leaf]
```

**Merges:** none

---

### DOG (metacategory)

```
dog/                                      [grouping]
  |-- dog-headed               (2 nodes)  [leaf] MERGE: + "dog head" (1)
```

**Merges:**
- "dog head" -> "dog-headed" (1 node)

---

### CROCODILE (metacategory)

```
crocodile/                                [grouping]
  |-- crocodile                (3 nodes)  [leaf]
  |-- crocodile-headed         (2 nodes)  [leaf]
```

**Merges:** none

---

### RAM (metacategory)

```
ram/                                      [grouping]
  |-- ram                      (2 nodes)  [leaf]
  |-- ram-headed               (5 nodes)  [leaf] MERGE: + "ram's head" (1) + "four rams' heads" (1)
  |-- ram-horned               (1 node)   [leaf]
```

**Merges:**
- "ram's head" -> "ram-headed" (1 node)
- "four rams' heads" -> "ram-headed" (1 node)

---

### FROG (metacategory)

```
frog/                                     [grouping]
  |-- frog                     (1 node)   [leaf]
  |-- frog-headed              (3 nodes)  [leaf]
```

**Merges:** none

---

### CAT (metacategory)

```
cat/                                      [grouping]
  |-- cat                      (1 node)   [leaf]
  |-- cat-headed               (1 node)   [leaf]
```

**Merges:** none

---

### TURTLE (metacategory)

```
turtle/                                   [grouping]
  |-- turtle                   (1 node)   [leaf]
  |-- turtle-headed            (1 node)   [leaf] MERGE: "turtle head" (1)
```

**Merges:**
- "turtle head" -> "turtle-headed" (1 node)

---

### FISH / SEA CREATURE (metacategory)

```
fish/                                     [grouping]
  |-- fish tail                (1 node)   [leaf] MERGE: "fish's tail" (1)
  |-- half fish                (1 node)   [leaf]
  |-- part fish                (1 node)   [leaf]
  |-- sea monster              (2 nodes)  [leaf]
  |-- seal                     (1 node)   [leaf] MERGE: "seal head" (1)
```

**Merges:**
- "fish's tail" -> "fish tail" (1 node)
- "seal head" -> "seal" (1 node)

---

### DRAGON (metacategory)

```
dragon/                                   [grouping]
  |-- dragon                   (3 nodes)  [leaf]
```

**Merges:** none

---

### GOAT (metacategory)

```
goat/                                     [grouping]
  |-- goat body                (1 node)   [leaf] MERGE: "goat's body" (1)
  |-- half goat                (1 node)   [leaf]
  |-- sea goat                 (1 node)   [leaf]
```

**Merges:**
- "goat's body" -> "goat body" (1 node)

---

### DEER (metacategory)

```
deer/                                     [grouping]
  |-- deer body                (1 node)   [leaf]
  |-- winged deer              (1 node)   [leaf]
```

**Merges:** none

---

### FOX (metacategory)

```
fox/                                      [grouping]
  |-- white fox                (1 node)   [leaf]
  |-- nine-tailed              (1 node)   [leaf]
```

**Merges:** none (keeping "white fox" to preserve color info)

---

### JAGUAR (metacategory)

```
jaguar/                                   [grouping]
  |-- jaguar                   (1 node)   [leaf]
```

**Merges:** none

---

### TIGER (metacategory)

```
tiger/                                    [grouping]
  |-- tiger-headed             (1 node)   [leaf]
```

**Merges:** none

---

### INSECT (metacategory)

```
insect/                                   [grouping]
  |-- scarab                   (3 nodes)  [leaf] MERGE: + "scarab beetle" (1)
  |-- butterfly wings          (2 nodes)  [leaf]
  |-- scorpion                 (1 node)   [leaf]
  |-- scorpion sting           (1 node)   [leaf]
```

**Merges:**
- "scarab beetle" -> "scarab" (1 node)

**Note:** keeping "butterfly wings" as-is to preserve the "wings" detail.

---

### HIPPOPOTAMUS (metacategory)

```
hippopotamus/                             [grouping]
  |-- hippopotamus             (2 nodes)  [leaf]
```

**Merges:** none

---

### HARE (metacategory)

```
hare/                                     [grouping]
  |-- hare-headed              (1 node)   [leaf] MERGE: "hare's head" (1)
```

**Merges:**
- "hare's head" -> "hare-headed" (1 node)

---

### DONKEY (metacategory)

```
donkey/                                   [grouping]
  |-- donkey-headed            (1 node)   [leaf]
```

**Merges:** none

---

### JACKAL (metacategory)

```
jackal/                                   [grouping]
  |-- jackal-headed            (2 nodes)  [leaf]
```

**Merges:** none

---

### GAZELLE (metacategory)

```
gazelle/                                  [grouping]
  |-- gazelle-headed           (1 node)   [leaf]
```

**Merges:** none

---

### BABOON (metacategory)

```
baboon/                                   [grouping]
  |-- baboon-headed            (1 node)   [leaf]
```

**Merges:** none

---

### BAT (metacategory)

```
bat/                                      [grouping]
  |-- bat wings                (1 node)   [leaf]
```

**Merges:** none

---

## Summary of all merges (data changes on nodes)

| Old value | New (canonical) value | Nodes affected |
|---|---|---|
| snakes | snake | 1 |
| snake head | snake-headed | 1 |
| serpent-headed | snake-headed | 2 |
| serpent | serpentine | 3 |
| lion heads | lion-headed | 1 |
| lion's head | lion-headed | 4 |
| lioness head | lion-headed | 1 |
| cow-horned | cow horns | 1 |
| bird head | bird-headed | 2 |
| bird's beak | bird-headed | 1 |
| falcon head | falcon-headed | 1 |
| vulture form | vulture | 1 |
| sparrowhawk head | sparrowhawk | 1 |
| rooster form | rooster | 1 |
| swan-like | swan | 1 |
| ostrich feathers | ostrich | 1 |
| dog head | dog-headed | 1 |
| ram's head | ram-headed | 1 |
| four rams' heads | ram-headed | 1 |
| turtle head | turtle-headed | 1 |
| fish's tail | fish tail | 1 |
| seal head | seal | 1 |
| goat's body | goat body | 1 |
| scarab beetle | scarab | 1 |
| hare's head | hare-headed | 1 |

**Total: 25 merge rules affecting ~31 node-trait values**

---

## Open Questions

1. **"horsemen"** — is this a physical characteristic or a character trait? Should it be moved to the `character_trait` field?

2. **"sea goat"** — hybrid creature (goat + fish). Currently placed under goat only. Should it also appear under fish?

3. **"feline"/"feline-headed"** — currently leaves under lion. Should lion, cat, jaguar, and tiger instead all be grouped under a broader "feline" metacategory?

4. **Laura's suggestions about misplaced traits** — "winged sandals", "winged helmet", "trumpet", "cornucopia", "armor" are objects (not physical traits), and "wrathful", "warrior maiden", "fierce", "matron" are character traits. Should those be moved to their correct fields? (Separate from this animal hierarchy work.)

---

## Implementation approach

A new `trait_hierarchy` table with a `parent_id` self-referencing column:

```
trait_hierarchy:
  id  | category_field           | trait_name       | parent_id | is_leaf
  1   | physical_characteristics | snake            | NULL      | false   (metacategory)
  2   | physical_characteristics | snake            | 1         | false   (subcategory grouping)
  3   | physical_characteristics | snake            | 2         | true    (leaf — nodes tagged here)
  4   | physical_characteristics | snake-headed     | 2         | true    (leaf)
  5   | physical_characteristics | cobra            | 1         | false   (subcategory grouping)
  6   | physical_characteristics | cobra            | 5         | true    (leaf)
  7   | physical_characteristics | cobra-headed     | 5         | true    (leaf)
```

The merge renames are applied directly to nodes' `physical_characteristics` values so the raw data uses canonical leaf names that match the hierarchy.

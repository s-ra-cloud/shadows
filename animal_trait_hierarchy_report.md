# Physical Characteristics — Animal Trait Hierarchy v2

## Principles

1. **Multi-level hierarchy**: metacategory > subcategory > sub-subcategory (up to 3 levels deep)
2. **Merge duplicates**: synonymous traits (e.g. "snake head" / "snake-headed" / "serpent-headed") are merged into a single canonical name
3. **No data loss**: the original raw values on each node are preserved; the hierarchy is an overlay for grouping/filtering
4. **Merges change the stored value**: when two traits are synonyms, all nodes using the non-canonical form will be updated to use the canonical form (e.g. "snakes" -> "snake", "dog head" -> "dog-headed")

---

## Proposed Hierarchies

Legend:
- **MERGE**: these raw values will be renamed to the canonical form shown
- Indentation shows parent-child relationship
- `(N nodes)` = how many nodes currently have this trait

---

### SNAKE (metacategory)

```
snake/
  |-- snake                (7 nodes)
  |     MERGE: "snakes" (1) -> "snake"
  |     |-- snake-headed   (5 nodes total after merge)
  |     |     MERGE: "snake head" (1) + "snake-headed" (2) + "serpent-headed" (2) -> "snake-headed"
  |     |-- snake-haired   (2 nodes)
  |     |-- snake leg       (1 node)
  |     |-- snake skirt     (1 node)
  |     |-- eight-headed snake (1 node)
  |
  |-- serpentine            (15 nodes)
  |     |-- serpent woman   (1 node)
  |     |-- serpent's tail  (1 node)
  |     |-- plumed serpent  (1 node)
  |     MERGE: "serpent" (3) -> "serpentine"
  |
  |-- cobra                 (5 nodes)
  |     |-- cobra-headed    (2 nodes)
  |     |-- uraeus          (2 nodes)
  |     |-- circular snake  (1 node)
```

**Merges (data changes):**
- "snakes" -> "snake" (1 node affected)
- "snake head" -> "snake-headed" (1 node affected)
- "serpent-headed" -> "snake-headed" (2 nodes affected)
- "serpent" -> "serpentine" (3 nodes affected)

---

### BULL (metacategory)

```
bull/
  |-- bull                  (4 nodes)
  |     |-- bull-headed     (1 node)
  |     |     MERGE: "bull head" -> "bull-headed" (if any exist)
  |     |-- bull horns      (1 node)
  |     |-- black bull      (1 node)
```

**Merges:** none needed

---

### LION (metacategory)

```
lion/
  |-- lion                  (4 nodes)
  |     |-- lion-headed     (14 nodes total after merge)
  |     |     MERGE: "lion heads" (1) + "lion's head" (4) + "lioness head" (1) -> "lion-headed"
  |     |-- lion body       (1 node)
  |
  |-- lioness               (5 nodes)
  |
  |-- feline                (2 nodes)
  |     |-- feline-headed   (1 node)
```

**Merges (data changes):**
- "lion heads" -> "lion-headed" (1 node affected)
- "lion's head" -> "lion-headed" (4 nodes affected)
- "lioness head" -> "lion-headed" (1 node affected)

**Note:** "feline" is kept as a separate subcategory under lion for gods described generically as feline without specifying lion/lioness.

---

### COW (metacategory)

```
cow/
  |-- cow                   (kept as parent, no standalone occurrences)
  |     |-- cow-headed      (3 nodes total after merge)
  |     |     MERGE: "cow-horned" (1) -> "cow-headed" (since cow-horned describes a cow-headed deity)
  |     |-- cow-bodied      (1 node)
  |     |-- cow-eyed        (1 node)
  |     |-- cow ears        (1 node)
  |     |-- cow horns       (2 nodes)
  |     |-- cow form        (3 nodes)
  |     |-- white cow       (1 node)
```

**Merges (data changes):**
- "cow-horned" -> "cow-headed" (1 node affected)

**Open question:** Is merging "cow-horned" into "cow-headed" acceptable? A god described as "cow-horned" has cow horns but not necessarily a full cow head. Alternatively, merge "cow-horned" into "cow horns" instead?

---

### BIRD (metacategory)

```
bird/
  |-- bird                  (1 node)
  |     |-- bird-headed     (3 nodes total after merge)
  |     |     MERGE: "bird head" (2) + "bird's beak" (1) -> "bird-headed"
  |     |-- feathered       (6 nodes)
  |
  |-- falcon                (4 nodes)
  |     |-- falcon-headed   (4 nodes total after merge)
  |     |     MERGE: "falcon head" (1) -> "falcon-headed"
  |
  |-- vulture               (1 node, was "vulture form")
  |     MERGE: "vulture form" (1) -> "vulture"
  |     |-- vulture-headed  (1 node)
  |     |-- vulture cap     (1 node)
  |     |-- griffon vulture (1 node)
  |
  |-- owl                   (2 nodes)
  |
  |-- ibis                  (1 node, was "ibis-headed")
  |     MERGE: "ibis-headed" -> keep as-is (only form)
  |
  |-- sparrowhawk           (1 node, was "sparrowhawk head")
  |     MERGE: "sparrowhawk head" (1) -> "sparrowhawk"
  |
  |-- rooster               (1 node, was "rooster form")
  |     MERGE: "rooster form" (1) -> "rooster"
  |
  |-- swan                  (1 node, was "swan-like")
  |     MERGE: "swan-like" (1) -> "swan"
  |
  |-- peacock               (1 node, was "white peacock")
  |
  |-- kite                  (1 node)
  |
  |-- turkey                (1 node)
  |
  |-- ostrich               (1 node, was "ostrich feathers")
  |     MERGE: "ostrich feathers" (1) -> "ostrich"
  |
  |-- part bird             (1 node)
```

**Merges (data changes):**
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
horse/
  |-- horse                 (1 node)
  |     |-- horse-headed    (1 node)
  |     |-- horse ears      (1 node)
  |     |-- horse legs      (1 node)
  |     |-- horse tail      (1 node)
  |
  |-- mare                  (1 node)
  |     |-- foal            (1 node)
```

**Merges:** none needed

**Note:** "horsemen" (1 node) is arguably a character trait rather than a physical characteristic. Left out of hierarchy for now (see Open Questions).

---

### DOG (metacategory)

```
dog/
  |-- dog                   (no standalone occurrences)
  |     |-- dog-headed      (2 nodes total after merge)
  |           MERGE: "dog head" (1) -> "dog-headed"
```

**Merges (data changes):**
- "dog head" -> "dog-headed" (1 node)

---

### CROCODILE (metacategory)

```
crocodile/
  |-- crocodile             (3 nodes)
  |     |-- crocodile-headed (2 nodes)
```

**Merges:** none needed

---

### RAM (metacategory)

```
ram/
  |-- ram                   (2 nodes)
  |     |-- ram-headed      (5 nodes total after merge)
  |     |     MERGE: "ram's head" (1) + "four rams' heads" (1) -> "ram-headed"
  |     |-- ram-horned      (1 node)
```

**Merges (data changes):**
- "ram's head" -> "ram-headed" (1 node)
- "four rams' heads" -> "ram-headed" (1 node)

---

### FROG (metacategory)

```
frog/
  |-- frog                  (1 node)
  |     |-- frog-headed     (3 nodes)
```

**Merges:** none needed

---

### CAT (metacategory)

```
cat/
  |-- cat                   (1 node)
  |     |-- cat-headed      (1 node)
```

**Merges:** none needed

---

### TURTLE (metacategory)

```
turtle/
  |-- turtle                (1 node)
  |     |-- turtle-headed   (1 node)
  |           MERGE: "turtle head" (1) -> "turtle-headed"
```

**Merges (data changes):**
- "turtle head" -> "turtle-headed" (1 node)

---

### FISH / SEA CREATURE (metacategory)

```
fish/
  |-- fish                  (no standalone)
  |     |-- fish tail       (1 node)
  |     |     MERGE: "fish's tail" (1) -> "fish tail"
  |     |-- half fish       (1 node)
  |     |-- part fish       (1 node)
  |
  |-- sea monster           (2 nodes)
  |
  |-- seal                  (1 node, was "seal head")
  |     MERGE: "seal head" (1) -> "seal"
```

**Merges (data changes):**
- "fish's tail" -> "fish tail" (1 node)
- "seal head" -> "seal" (1 node)

**Note:** "sea goat" is a hybrid (goat + fish). See Open Questions.

---

### DRAGON (metacategory)

```
dragon/
  |-- dragon                (3 nodes)
```

**Merges:** none needed

---

### GOAT (metacategory)

```
goat/
  |-- goat                  (no standalone)
  |     |-- goat body       (1 node)
  |     |     MERGE: "goat's body" (1) -> "goat body"
  |     |-- half goat       (1 node)
  |     |-- sea goat        (1 node)
```

**Merges (data changes):**
- "goat's body" -> "goat body" (1 node)

---

### DEER (metacategory)

```
deer/
  |-- deer                  (no standalone)
  |     |-- deer body       (1 node)
  |     |-- winged deer     (1 node)
```

**Merges:** none needed

---

### FOX (metacategory)

```
fox/
  |-- fox                   (1 node, was "white fox")
  |     MERGE: "white fox" (1) -> "fox"
  |     |-- nine-tailed     (1 node)
```

**Merges (data changes):**
- "white fox" -> "fox" (1 node)

**Open question:** "white fox" -> "fox" loses the color info. Keep as "white fox" instead?

---

### JAGUAR (metacategory)

```
jaguar/
  |-- jaguar                (1 node)
```

**Merges:** none needed

---

### TIGER (metacategory)

```
tiger/
  |-- tiger                 (no standalone)
  |     |-- tiger-headed    (1 node)
```

**Merges:** none needed

---

### INSECT (metacategory)

```
insect/
  |-- scarab                (3 nodes total after merge)
  |     MERGE: "scarab beetle" (1) -> "scarab"
  |
  |-- butterfly             (2 nodes, was "butterfly wings")
  |     MERGE: "butterfly wings" (2) -> "butterfly"
  |
  |-- scorpion              (1 node)
  |     |-- scorpion sting  (1 node)
```

**Merges (data changes):**
- "scarab beetle" -> "scarab" (1 node)
- "butterfly wings" -> "butterfly" (2 nodes)

**Open question:** "butterfly wings" -> "butterfly" loses the "wings" info. Keep as "butterfly wings"?

---

### HIPPOPOTAMUS (metacategory)

```
hippopotamus/
  |-- hippopotamus          (2 nodes)
```

**Merges:** none needed

---

### HARE (metacategory)

```
hare/
  |-- hare                  (1 node, was "hare's head")
  |     MERGE: "hare's head" (1) -> "hare-headed"
```

**Merges (data changes):**
- "hare's head" -> "hare-headed" (1 node)

---

### DONKEY (metacategory)

```
donkey/
  |-- donkey                (no standalone)
  |     |-- donkey-headed   (1 node)
```

**Merges:** none needed

---

### JACKAL (metacategory)

```
jackal/
  |-- jackal                (no standalone)
  |     |-- jackal-headed   (2 nodes)
```

**Merges:** none needed

---

### GAZELLE (metacategory)

```
gazelle/
  |-- gazelle               (no standalone)
  |     |-- gazelle-headed  (1 node)
```

**Merges:** none needed

---

### BABOON (metacategory)

```
baboon/
  |-- baboon                (no standalone)
  |     |-- baboon-headed   (1 node)
```

**Merges:** none needed

---

## Summary of all merges (data changes on nodes)

These are the actual value renames that will be applied to nodes' `physical_characteristics` field:

| Old value | New (canonical) value | Nodes affected |
|---|---|---|
| snakes | snake | 1 |
| snake head | snake-headed | 1 |
| serpent-headed | snake-headed | 2 |
| serpent | serpentine | 3 |
| lion heads | lion-headed | 1 |
| lion's head | lion-headed | 4 |
| lioness head | lion-headed | 1 |
| cow-horned | cow-headed | 1 |
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
| white fox | fox | 1 |
| scarab beetle | scarab | 1 |
| butterfly wings | butterfly | 2 |
| hare's head | hare-headed | 1 |

**Total: 27 merge rules affecting ~34 node-trait values**

---

## Open Questions

1. **"cow-horned" -> "cow-headed"?** Or should "cow-horned" merge into "cow horns" instead? (A cow-horned god has horns but not necessarily a cow head.)

2. **"white fox" -> "fox"?** This loses the color information. Should it stay as "white fox" under the fox metacategory instead?

3. **"butterfly wings" -> "butterfly"?** This loses the "wings" detail. Should it stay as "butterfly wings"?

4. **"horsemen"** — is this a physical characteristic or a character trait? Should it be moved to the `character_trait` field?

5. **"sea goat"** — hybrid creature (goat + fish). Should it appear under goat only, fish only, or both hierarchies?

6. **"bat wings"** — only 1 occurrence. Should "bat" be a separate metacategory, or should "bat wings" go under a broader "wings" group outside the animal hierarchy?

7. **"feline"/"feline-headed"** — currently under lion. Should lion, cat, jaguar, and tiger all be grouped under a broader "feline" metacategory instead?

---

## Implementation approach

A new `trait_hierarchy` table with a `parent_id` self-referencing column to support multiple levels:

```
trait_hierarchy:
  id          | category_field            | trait_name   | parent_id
  1           | physical_characteristics  | snake        | NULL        (root metacategory)
  2           | physical_characteristics  | snake        | 1           (subcategory "snake" under "snake")
  3           | physical_characteristics  | snake-headed | 2           (sub-sub under "snake")
  4           | physical_characteristics  | cobra        | 1           (subcategory "cobra" under "snake")
  5           | physical_characteristics  | cobra-headed | 4           (sub-sub under "cobra")
```

The merge renames are applied directly to nodes' `physical_characteristics` values so the raw data uses canonical names that match the hierarchy.

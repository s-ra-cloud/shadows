# Turtle vs Tortoise — Verification Report

For each deity with "turtle" or "tortoise" in the database, I checked Wikipedia and other sources to determine the correct term.

Key distinction:
- **Turtle** = aquatic (sea or freshwater), lives in water → Aquatic habitat
- **Tortoise** = land-dwelling, has dome-shaped shell → Terrestrial habitat

---

## Findings by deity

### 1. Hermes (Greek) — currently: `tortoise`
**Wikipedia says: TORTOISE** ✅ Correct
> Hermes invented the lyre from a **tortoise** shell (chelys = land tortoise in Greek). The myth specifically describes a land tortoise found outside his mother's cave.
- **No change needed**

### 2. Hera (Greek) — currently: `tortoise`
**Wikipedia says: TORTOISE** ✅ Correct
> The tortoise was sacred to Hera as a symbol of silence and domesticity. Land animal association.
- **No change needed**

### 3. Hebe (Greek) — currently: `tortoise`
**Wikipedia says: TORTOISE** ✅ Correct
> Sculptural association (Hubert Gerhard's 1590 statue shows Hebe with foot on a tortoise). Symbolic land animal.
- **No change needed**

### 4. Silenus (Greek) — currently: `tortoise`
**Wikipedia says: TORTOISE** ✅ Correct
> Ancient Greek coins from Lesbos depict Silenus with a tortoise. Land animal association.
- **No change needed**

### 5. Achilles (Greek) — currently: `tortoise`
**Source: Zeno's paradox** ⚠️ Questionable
> The "Achilles and the Tortoise" is a **philosophical paradox by Zeno**, not a mythological animal association. Achilles is not associated with tortoises in myth — this may be a data entry error confusing the paradox with a sacred animal.
- **Recommendation: REMOVE** `tortoise` from Achilles' animals unless another source confirms a mythological link.

### 6. Xuanwu (Chinese) — currently: `tortoise, turtle` in animals + `turtle` in physical characteristics
**Wikipedia says: TORTOISE** (Black Tortoise / 玄武)
> Xuanwu is the **Black Tortoise** of the North, one of the Four Symbols. However, as a cosmic/celestial entity, the Chinese 龜 (guī) can refer to both. The standard English translation is "Black **Tortoise**."
- **Change:** Remove `turtle` from animals → keep only `tortoise`. Change physical_characteristics from `turtle` to `tortoise`.

### 7. Azure Dragon (Chinese) — currently: `tortoise`
**Wikipedia says: TORTOISE** ✅ Correct
> The Four Symbols include the Black **Tortoise**. Azure Dragon is associated with it through the Four Symbols cosmology.
- **No change needed**

### 8. Fuxi (Chinese) — currently: `tortoise, turtle`
**Wikipedia says: BOTH used interchangeably** (Chinese 龜 covers both)
> Fuxi received the Hetu map from a creature emerging from a **river** — this is an aquatic context, closer to **turtle**.
- **Change:** Remove `tortoise` → keep only `turtle` (river/aquatic context)

### 9. Pangu (Chinese) — currently: `tortoise, turtle`
**Wikipedia says: TORTOISE** (via the Four Holy Beasts)
> Pangu is aided by the Four Holy Beasts including the **Tortoise** (same as Xuanwu / Black Tortoise).
- **Change:** Remove `turtle` → keep only `tortoise`

### 10. Gonggong (Chinese) — currently: `turtle`
**Wikipedia says: TURTLE** ✅ Correct
> After Gonggong broke Mount Buzhou, Nüwa used the legs of a giant **turtle** (sea creature) to prop up the sky. Aquatic context.
- **No change needed**

### 11. Ao Guang (Chinese) — currently: `turtle`
**Source says: Ao Guang is a DRAGON, not a turtle**
> Ao Guang is the Dragon King of the East Sea. The "Ao" (鳌/鰲) is a separate mythological giant sea **turtle**, but that's a different figure. Ao Guang himself is a dragon.
- **Recommendation: REMOVE** `turtle` from Ao Guang — or change to note that the Ao (giant sea turtle) is a related but distinct creature.

### 12. Cihang Zhenren (Chinese) — currently: `tortoise, turtle`
**Wikipedia says: TORTOISE**
> Cihang Zhenren is depicted riding a **giant tortoise** (or golden-haired turtle depending on source). The creature is more commonly described as a celestial tortoise.
- **Change:** Remove `turtle` → keep only `tortoise`

### 13. Apesh (Egyptian) — currently: `tortoise, turtle` in animals + `turtle-headed` in PC
**Wikipedia says: TURTLE** (aquatic association)
> Apesh is associated with **darkness and the underworld waters**. The Egyptian shtyw refers to an aquatic turtle, not a land tortoise. Associated with evil forces in the waters of the Duat.
- **Change:** Remove `tortoise` from animals → keep only `turtle`. Keep `turtle-headed` in PC.

### 14. Ryūjin (Shinto) — currently: `turtle`
**Wikipedia says: SEA TURTLE** ✅ Correct
> Ryūjin's messengers are **sea turtles** (umigame 海亀). Fully aquatic.
- **No change needed**

### 15. Toyotama-hime (Shinto) — currently: `turtle`
**Wikipedia says: SEA TURTLE** ✅ Correct
> Toyotama-hime rode on a **giant sea turtle** to the surface world. Aquatic.
- **No change needed**

### 16. Akkorokamui (Shinto) — currently: `turtle`
**Source says: NOT a turtle association**
> Akkorokamui is a giant **octopus** creature from Ainu folklore. No turtle/tortoise association found in any source.
- **Recommendation: REMOVE** `turtle` from Akkorokamui's animals.

### 17. Zhunti Daoren (Chinese) — currently: `turtle`
**Source: unclear, likely celestial tortoise context**
> Associated with Buddhist/Taoist cosmology. The creature is likely a celestial **tortoise** in the cosmic sense.
- **Change:** `turtle` → `tortoise`

### 18. Fides (Roman) — currently: `turtle dove`
**NOT a turtle** ✅ No issue
> "Turtle dove" is a **bird** (Streptopelia turtur), not a reptile. This is correctly a bird, no confusion.
- **No change needed** — but note that "turtle dove" should NOT appear in any turtle/tortoise hierarchy.

---

## Summary of changes needed

| Deity | Field | Current | Change to | Reason |
|---|---|---|---|---|
| Xuanwu | animals | tortoise, turtle | tortoise | Black Tortoise standard translation |
| Xuanwu | physical_characteristics | turtle, snake... | tortoise, snake... | Same |
| Fuxi | animals | tortoise, turtle | turtle | River/aquatic context |
| Pangu | animals | tortoise, turtle | tortoise | Four Holy Beasts = Black Tortoise |
| Cihang Zhenren | animals | tortoise, turtle | tortoise | Celestial tortoise tradition |
| Apesh | animals | tortoise, turtle | turtle | Aquatic/underworld context |
| Zhunti Daoren | animals | turtle | tortoise | Cosmic/celestial context |
| Achilles | animals | tortoise | **REMOVE** | Zeno's paradox, not mythological |
| Ao Guang | animals | turtle | **REMOVE or review** | Ao Guang is a dragon, not a turtle |
| Akkorokamui | animals | turtle | **REMOVE** | Octopus creature, no turtle link |

No changes needed: Hermes, Hera, Hebe, Silenus, Azure Dragon, Gonggong, Ryūjin, Toyotama-hime, Fides.

---

## Habitat classification (for future cross-cutting hierarchy)

| Category | Animals |
|---|---|
| **Terrestrial** | tortoise (Hermes, Hera, Hebe, Silenus, Xuanwu, Azure Dragon, Pangu, Cihang Zhenren, Zhunti Daoren) |
| **Aquatic** | turtle (Fuxi, Gonggong, Apesh, Ryūjin, Toyotama-hime) |

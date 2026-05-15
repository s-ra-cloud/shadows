# 11A — family_roles cleanup proposal

Stats: 527 figures, 215 extended-kin kept, 266 "X of Y" stripped, 140 edges to create (target IS a DB node), 181 edge candidates with no DB node target, 687 manual decisions needed

# 11A — family_roles cleanup proposal

## Quetzalcoatl [Aztec]
- **BEFORE**: `[father, son, brother, twin]`
- **AFTER**: `[father, son, brother, twin]`

## Dionysus [Greek]
- **BEFORE**: `[father, son of Zeus and Semele, twice-born (from Semele's incineration, then from Zeus's thigh), sometimes counted as the 12th Olympian (replacing Hestia), husband of Ariadne (after Theseus abandoned her on Naxos)]`
- **AFTER**: `[father, son, husband]`
- **REMOVED**:
    - `son of Zeus and Semele` — → "son" + edge candidates [Zeus, Semele]
    - `husband of Ariadne (after Theseus abandoned her on Naxos)` — → "husband" + edge candidates [Ariadne]
- **NEW EDGES proposed**:
    - `child of` → **Zeus** (id 6175) ✅
    - `child of` → **Semele** (id 6454) ✅
- **NEEDS MANUAL DECISION**:
    - `twice-born (from Semele's incineration, then from Zeus's thigh)` — suggested target: domain (narrative — likely DELETE if covered)
    - `sometimes counted as the 12th Olympian (replacing Hestia)` — suggested target: domain (narrative — likely DELETE if covered)

## Azazel [Abrahamic]
- **BEFORE**: `[chief of the Watchers (in 1 Enoch), wilderness-demon (in Leviticus tradition)]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `chief of the Watchers (in 1 Enoch)` — suggested target: domain (narrative — likely DELETE if covered)
    - `wilderness-demon (in Leviticus tradition)` — suggested target: domain (narrative — likely DELETE if covered)

## Apep [Egyptian]
- **BEFORE**: `[cosmic adversary of Ra, embodiment of isfet]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `cosmic adversary of Ra` — suggested target: domain (narrative — likely DELETE if covered)
    - `embodiment of isfet` — suggested target: domain (narrative — likely DELETE if covered)

## Asmodeus [Abrahamic]
- **BEFORE**: `[demon-king]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `demon-king` — suggested target: domain

## Cupid [Roman]
- **BEFORE**: `[identified with Eros, son of Venus and Mars, husband of Psyche]`
- **AFTER**: `[son, husband]`
- **REMOVED**:
    - `son of Venus and Mars` — → "son" + edge candidates [Venus, Mars]
    - `husband of Psyche` — → "husband" + edge candidates [Psyche]
- **NEW EDGES proposed**:
    - `child of` → **Venus** (id 6157) ✅
    - `child of` → **Mars** (id 7445) ✅
- **NEEDS MANUAL DECISION**:
    - `identified with Eros` — suggested target: domain (narrative — likely DELETE if covered)

## Glenr [Norse]
- **BEFORE**: `[husband of Sól]`
- **AFTER**: `[husband]`
- **REMOVED**:
    - `husband of Sól` — → "husband" + edge candidates [Sól]

## Ebisu [Shinto]
- **BEFORE**: `[one of the Seven Lucky Gods, identified with Hiruko or Kotoshironushi, often paired with Daikokuten]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `one of the Seven Lucky Gods` — suggested target: domain (narrative — likely DELETE if covered)
    - `identified with Hiruko or Kotoshironushi` — suggested target: domain (narrative — likely DELETE if covered)
    - `often paired with Daikokuten` — suggested target: domain (narrative — likely DELETE if covered)

## Gilgamesh [Mesopotamian]
- **BEFORE**: `[son, king, companion]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `king` — already in domain
- **NEEDS MANUAL DECISION**:
    - `companion` — suggested target: domain or identification

## God-the-Father [Abrahamic]
- **BEFORE**: `[Father of the Son (eternally begotten), Father of believers (adoption)]`
- **AFTER**: `[father]`
- **REMOVED**:
    - `Father of the Son (eternally begotten)` — → "father" + edge candidates [the Son]
    - `Father of believers (adoption)` — → "father" + edge candidates [believers]
- **NEW EDGES proposed**:
    - `parent of` → the Son ❌ no DB node
    - `parent of` → believers ❌ no DB node

## Zhurong [Chinese]
- **BEFORE**: `[god of fire and the south, adversary and victor over Gonggong]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `god of fire and the south` — already in symbolism (phrase "the south")
- **NEEDS MANUAL DECISION**:
    - `adversary and victor over Gonggong` — suggested target: domain or identification

## Hiranyakashipu [Hindu]
- **BEFORE**: `[demon-king, brother of Hiraṇyākṣa, father of Prahlāda, son of Diti and Kaśyapa]`
- **AFTER**: `[brother, father, son]`
- **REMOVED**:
    - `brother of Hiraṇyākṣa` — → "brother" + edge candidates [Hiraṇyākṣa]
    - `father of Prahlāda` — → "father" + edge candidates [Prahlāda]
    - `son of Diti and Kaśyapa` — → "son" + edge candidates [Diti, Kaśyapa]
- **NEW EDGES proposed**:
    - `sibling of` → Hiraṇyākṣa ❌ no DB node
    - `parent of` → Prahlāda ❌ no DB node
    - `child of` → Diti ❌ no DB node
    - `child of` → Kaśyapa ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `demon-king` — suggested target: domain

## Igigi [Mesopotamian]
- **BEFORE**: `[younger gods, laborers]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `younger gods` — already in symbolism
- **NEEDS MANUAL DECISION**:
    - `laborers` — suggested target: domain or identification

## Tiamat [Mesopotamian]
- **BEFORE**: `[mother, spouse]`
- **AFTER**: `[mother, spouse]`

## Laozi [Chinese]
- **BEFORE**: `[semi-legendary founder of philosophical Daoism, deified as Taishang Laojun, identified with Daode Tianzun (third of the Three Pure Ones)]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `semi-legendary founder of philosophical Daoism` — suggested target: domain (narrative — likely DELETE if covered)
    - `deified as Taishang Laojun` — suggested target: domain or identification
    - `identified with Daode Tianzun (third of the Three Pure Ones)` — suggested target: domain (narrative — likely DELETE if covered)

## Erebus [Greek]
- **BEFORE**: `[son of Chaos, mate of Nyx, father of Aether and Hemera]`
- **AFTER**: `[son, father]`
- **REMOVED**:
    - `son of Chaos` — → "son" + edge candidates [Chaos]
    - `father of Aether and Hemera` — → "father" + edge candidates [Aether, Hemera]
- **NEW EDGES proposed**:
    - `child of` → **Chaos** (id 7425) ✅
- **NEEDS MANUAL DECISION**:
    - `mate of Nyx` — suggested target: domain (narrative — likely DELETE if covered)

## Maitreya [Buddhist]
- **BEFORE**: `[the future Buddha, the bodhisattva awaiting his final birth in the Tuṣita heaven]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the future Buddha` — suggested target: identification
    - `the bodhisattva awaiting his final birth in the Tuṣita heaven` — suggested target: domain (narrative — likely DELETE if covered)

## Mary [Abrahamic]
- **BEFORE**: `[mother, wife, virgin]`
- **AFTER**: `[mother, wife]`
- **REMOVED**:
    - `virgin` — already in domain

## Nereus [Greek]
- **BEFORE**: `[son of Pontus and Gaia, husband of Doris, father of the fifty Nereids (including Amphitrite, Thetis, Galatea)]`
- **AFTER**: `[son, husband, father]`
- **REMOVED**:
    - `son of Pontus and Gaia` — → "son" + edge candidates [Pontus, Gaia]
    - `husband of Doris` — → "husband" + edge candidates [Doris]
    - `father of the fifty Nereids (including Amphitrite, Thetis, Galatea)` — → "father" + edge candidates [the fifty Nereids]
- **NEW EDGES proposed**:
    - `child of` → **Pontus** (id 7429) ✅
    - `child of` → **Gaia** (id 6219) ✅
    - `parent of` → the fifty Nereids ❌ no DB node

## Agdistis [Phrygian]
- **BEFORE**: `[primordial androgynous daemon, the being from whose castration Attis ultimately springs, sometimes identified with a wild aspect of Cybele]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `primordial androgynous daemon` — suggested target: domain or identification
    - `the being from whose castration Attis ultimately springs` — suggested target: domain (narrative — likely DELETE if covered)
    - `sometimes identified with a wild aspect of Cybele` — suggested target: identification

## Nanahuatzin [Aztec]
- **BEFORE**: `[transformed into Tonatiuh]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `transformed into Tonatiuh` — suggested target: domain (narrative — likely DELETE if covered)

## Nandi [Hindu]
- **BEFORE**: `[mount and chief devotee of Śiva, chief of the gaṇas, gatekeeper of Kailāśa]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `mount and chief devotee of Śiva` — suggested target: domain (narrative — likely DELETE if covered)
    - `chief of the gaṇas` — suggested target: domain (narrative — likely DELETE if covered)
    - `gatekeeper of Kailāśa` — suggested target: domain (narrative — likely DELETE if covered)

## The Alcis [Germanic]
- **BEFORE**: `[sibling]`
- **AFTER**: `[sibling]`

## Nehalennia [Germanic]
- **BEFORE**: `[Germanic North Sea coast goddess, protectress of seafarers and merchants]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `Germanic North Sea coast goddess` — suggested target: domain or identification
    - `protectress of seafarers and merchants` — suggested target: domain (narrative — likely DELETE if covered)

## Baldr [Norse]
- **BEFORE**: `[son, husband, father]`
- **AFTER**: `[son, husband, father]`

## Vairocana [Buddhist]
- **BEFORE**: `[the cosmic/primordial Buddha, centre of the Five Wisdom Buddhas, embodiment of the Dharmakāya]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the cosmic/primordial Buddha` — suggested target: identification
    - `centre of the Five Wisdom Buddhas` — suggested target: identification
    - `embodiment of the Dharmakāya` — suggested target: domain (narrative — likely DELETE if covered)

## Tammuz [Mesopotamian]
- **BEFORE**: `[son, husband]`
- **AFTER**: `[son, husband]`

## Hunahpu [Maya]
- **BEFORE**: `[one of the Hero Twins, son of Hun Hunahpu, twin of Xbalanque, raised to become the sun]`
- **AFTER**: `[son, twin]`
- **REMOVED**:
    - `son of Hun Hunahpu` — → "son" + edge candidates [Hun Hunahpu]
    - `twin of Xbalanque` — → "twin" + edge candidates [Xbalanque]
- **NEW EDGES proposed**:
    - `child of` → **Hun Hunahpu** (id 7521) ✅
    - `sibling of` → **Xbalanque** (id 7520) ✅
- **NEEDS MANUAL DECISION**:
    - `one of the Hero Twins` — suggested target: character_trait
    - `raised to become the sun` — suggested target: domain or identification

## Nerthus [Germanic]
- **BEFORE**: `[continental Germanic earth-mother goddess, the etymological counterpart of the Norse Njörðr]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `continental Germanic earth-mother goddess` — suggested target: domain (narrative — likely DELETE if covered)
    - `the etymological counterpart of the Norse Njörðr` — suggested target: domain (narrative — likely DELETE if covered)

## Kvasir [Norse]
- **BEFORE**: `[wisdom-being, victim]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `wisdom-being` — suggested target: domain (narrative — likely DELETE if covered)
    - `victim` — suggested target: domain or identification

## Móði and Magni [Norse]
- **BEFORE**: `[sons of Thor, brothers, inheritors]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `sons of Thor` — suggested target: domain (narrative — likely DELETE if covered)
    - `brothers` — suggested target: domain or identification
    - `inheritors` — suggested target: domain (narrative — likely DELETE if covered)

## Oceanus [Greek]
- **BEFORE**: `[eldest Titan, son of Ouranos and Gaia, husband of Tethys, father of all rivers and Oceanids]`
- **AFTER**: `[son, husband, father]`
- **REMOVED**:
    - `son of Ouranos and Gaia` — → "son" + edge candidates [Ouranos, Gaia]
    - `husband of Tethys` — → "husband" + edge candidates [Tethys]
    - `father of all rivers and Oceanids` — → "father" + edge candidates [all rivers, Oceanids]
- **NEW EDGES proposed**:
    - `child of` → **Ouranos** (id 7426) ✅
    - `child of` → **Gaia** (id 6219) ✅
    - `parent of` → all rivers ❌ no DB node
    - `parent of` → Oceanids ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `eldest Titan` — suggested target: domain or identification

## Shiva [Hindu]
- **BEFORE**: `[father, husband]`
- **AFTER**: `[father, husband]`

## Sophia [Gnostic]
- **BEFORE**: `[the youngest aeon of the Pleroma, an emanation within the line proceeding from Barbelo, the unwitting mother of the demiurge Yaldabaoth]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the youngest aeon of the Pleroma` — suggested target: domain (narrative — likely DELETE if covered)
    - `an emanation within the line proceeding from Barbelo` — suggested target: identification
    - `the unwitting mother of the demiurge Yaldabaoth` — suggested target: domain (narrative — likely DELETE if covered)

## Tartarus [Greek]
- **BEFORE**: `[primordial deity and abyssal place, mate of Gaia, father of Typhon]`
- **AFTER**: `[father]`
- **REMOVED**:
    - `father of Typhon` — → "father" + edge candidates [Typhon]
- **NEEDS MANUAL DECISION**:
    - `primordial deity and abyssal place` — suggested target: domain
    - `mate of Gaia` — suggested target: domain (narrative — likely DELETE if covered)

## Audhumla [Norse]
- **BEFORE**: `[primordial cow, progenitrix-by-licking of Búri]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `primordial cow` — already in domain
- **NEEDS MANUAL DECISION**:
    - `progenitrix-by-licking of Búri` — suggested target: domain

## Taiyi Zhenren [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Hundun [Chinese]
- **BEFORE**: `[primordial chaos personified, the emperor of the center (in Zhuangzi)]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `primordial chaos personified` — suggested target: domain or identification
    - `the emperor of the center (in Zhuangzi)` — suggested target: domain

## Kuimulang [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Tychon [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Nāga [Hindu]
- **BEFORE**: `[serpent-beings descended from Kadrū, rulers of Pātāla, enemies of Garuḍa]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `serpent-beings descended from Kadrū` — suggested target: domain (narrative — likely DELETE if covered)
    - `rulers of Pātāla` — suggested target: domain (narrative — likely DELETE if covered)
    - `enemies of Garuḍa` — suggested target: domain (narrative — likely DELETE if covered)

## Tecuciztecatl [Aztec]
- **BEFORE**: `[transformed into Metztli]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `transformed into Metztli` — suggested target: domain (narrative — likely DELETE if covered)

## Tonatiuh [Aztec]
- **BEFORE**: `[the fifth sun, identified with Nanahuatzin (the diseased god who became him), presides over the warrior-paradise Tonatiuh Ichan]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the fifth sun` — suggested target: domain or identification
    - `identified with Nanahuatzin (the diseased god who became him)` — suggested target: domain (narrative — likely DELETE if covered)
    - `presides over the warrior-paradise Tonatiuh Ichan` — suggested target: character_trait

## Valkyrie [Norse]
- **BEFORE**: `[warrior-maidens, divine servants of Odin]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `warrior-maidens` — suggested target: character_trait
    - `divine servants of Odin` — suggested target: domain (narrative — likely DELETE if covered)

## Njörðr [Norse]
- **BEFORE**: `[father, husband, Vanir hostage, god of the sea, wind, and wealth]`
- **AFTER**: `[father, husband]`
- **NEEDS MANUAL DECISION**:
    - `Vanir hostage` — suggested target: domain or identification
    - `god of the sea, wind, and wealth` — suggested target: domain (narrative — likely DELETE if covered)

## Ix Chel [Maya]
- **BEFORE**: `[Maya goddess of the moon, childbirth, weaving, and medicine, consort of Itzamna]`
- **AFTER**: `[consort]`
- **REMOVED**:
    - `consort of Itzamna` — → "consort" + edge candidates [Itzamna]
- **NEW EDGES proposed**:
    - `married to` → **Itzamna** (id 7512) ✅
- **NEEDS MANUAL DECISION**:
    - `Maya goddess of the moon, childbirth, weaving, and medicine` — suggested target: domain (narrative — likely DELETE if covered)

## Sif [Norse]
- **BEFORE**: `[wife of Thor, mother of Þrúðr, mother of Ullr (from earlier union)]`
- **AFTER**: `[wife, mother]`
- **REMOVED**:
    - `wife of Thor` — → "wife" + edge candidates [Thor]
    - `mother of Þrúðr` — → "mother" + edge candidates [Þrúðr]
    - `mother of Ullr (from earlier union)` — → "mother" + edge candidates [Ullr]
- **NEW EDGES proposed**:
    - `parent of` → Þrúðr ❌ no DB node

## Vajrapani [Buddhist]
- **BEFORE**: `[bodhisattva of power, protector of the Buddha and the Dharma, one of the three family-protectors with Avalokiteśvara and Mañjuśrī]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `bodhisattva of power` — suggested target: domain (narrative — likely DELETE if covered)
    - `protector of the Buddha and the Dharma` — suggested target: identification
    - `one of the three family-protectors with Avalokiteśvara and Mañjuśrī` — suggested target: domain (narrative — likely DELETE if covered)

## Mahakala [Buddhist]
- **BEFORE**: `[great wrathful protector (dharmapāla), wrathful emanation (often of Avalokiteśvara), Buddhist transformation of the Hindu Shiva-Mahākāla, East Asian form: Daikokuten]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `great wrathful protector (dharmapāla)` — suggested target: domain or identification
    - `wrathful emanation (often of Avalokiteśvara)` — suggested target: identification
    - `Buddhist transformation of the Hindu Shiva-Mahākāla` — suggested target: domain (narrative — likely DELETE if covered)
    - `East Asian form: Daikokuten` — suggested target: domain or identification

## Vulcan [Roman]
- **BEFORE**: `[identified with Hephaestus, son of Jupiter and Juno (or of Juno alone parthenogenetically, importing the Greek narrative), husband of Venus (importing the Greek)]`
- **AFTER**: `[son, husband]`
- **REMOVED**:
    - `son of Jupiter and Juno (or of Juno alone parthenogenetically, importing the Greek narrative)` — → "son" + edge candidates [Jupiter, Juno]
    - `husband of Venus (importing the Greek)` — → "husband" + edge candidates [Venus]
- **NEW EDGES proposed**:
    - `child of` → **Jupiter** (id 7444) ✅
    - `child of` → **Juno** (id 6555) ✅
- **NEEDS MANUAL DECISION**:
    - `identified with Hephaestus` — suggested target: domain (narrative — likely DELETE if covered)

## Yandi [Chinese]
- **BEFORE**: `[the Yan Emperor, often identified with Shennong, co-ancestor (with Huangdi) of the Chinese people, ancestor of Chiyou in some traditions]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the Yan Emperor` — suggested target: domain
    - `often identified with Shennong` — suggested target: domain (narrative — likely DELETE if covered)
    - `co-ancestor (with Huangdi) of the Chinese people` — suggested target: domain (narrative — likely DELETE if covered)
    - `ancestor of Chiyou in some traditions` — suggested target: domain (narrative — likely DELETE if covered)

## Vucub-Came [Maya]
- **BEFORE**: `[one of the two paramount lords of Xibalba, co-ruler with Hun-Came, adversary of the Hero Twins]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `one of the two paramount lords of Xibalba` — suggested target: domain
    - `co-ruler with Hun-Came` — suggested target: domain (narrative — likely DELETE if covered)
    - `adversary of the Hero Twins` — suggested target: character_trait

## Chaos [Greek]
- **BEFORE**: `[the first of all things, parent of Erebus and Nyx]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the first of all things` — suggested target: domain (narrative — likely DELETE if covered)
    - `parent of Erebus and Nyx` — suggested target: domain (narrative — likely DELETE if covered)

## Gabriel [Abrahamic]
- **BEFORE**: `[archangel, divine messenger, angel of revelation]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `divine messenger` — already in symbolism
- **NEEDS MANUAL DECISION**:
    - `archangel` — suggested target: domain or identification
    - `angel of revelation` — suggested target: domain (narrative — likely DELETE if covered)

## Leviathan [Abrahamic]
- **BEFORE**: `[cosmic adversary, primordial monster]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `cosmic adversary` — suggested target: domain or identification
    - `primordial monster` — suggested target: domain or identification

## Lilith [Abrahamic]
- **BEFORE**: `[mother, first wife (former)]`
- **AFTER**: `[mother]`
- **NEEDS MANUAL DECISION**:
    - `first wife (former)` — suggested target: character_trait

## YHWH [Abrahamic]
- **BEFORE**: `[father (creator-father of all, covenant-father of Israel), king]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `father (creator-father of all, covenant-father of Israel)` — suggested target: domain (narrative — likely DELETE if covered)
    - `king` — suggested target: domain

## Eve [Abrahamic]
- **BEFORE**: `[first woman, wife, mother, mother of all living]`
- **AFTER**: `[wife, mother]`
- **REMOVED**:
    - `mother of all living` — → "mother" + edge candidates [all living]
- **NEW EDGES proposed**:
    - `parent of` → all living ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `first woman` — suggested target: domain or identification

## Agreus and Nomios [Greek]
- **BEFORE**: `[father, spouse]`
- **AFTER**: `[father, spouse]`

## Yaldabaoth [Gnostic]
- **BEFORE**: `[the demiurge of the Gnostic systems, the malformed offspring of Sophia, the false god and jailer of the material cosmos]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `the false god and jailer of the material cosmos` — already in domain (phrase "material cosmos")
- **NEEDS MANUAL DECISION**:
    - `the demiurge of the Gnostic systems` — suggested target: domain (narrative — likely DELETE if covered)
    - `the malformed offspring of Sophia` — suggested target: domain (narrative — likely DELETE if covered)

## Muzha [Chinese]
- **BEFORE**: `[brother, spouse]`
- **AFTER**: `[brother, spouse]`

## Ixtab [Maya]
- **BEFORE**: `[Yucatec Maya goddess associated with the rope and with those who died by hanging]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `Yucatec Maya goddess associated with the rope and with those who died by hanging` — suggested target: domain (narrative — likely DELETE if covered)

## Kingu [Mesopotamian]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Loki [Norse]
- **BEFORE**: `[blood-brother of Odin, father of Fenrir, Jǫrmungandr, Hel (with Angrboða), mother of Sleipnir (in mare-form), husband of Sigyn (with sons Narfi and Váli), adversary of the Æsir]`
- **AFTER**: `[father, mother, husband]`
- **REMOVED**:
    - `father of Fenrir, Jǫrmungandr, Hel (with Angrboða)` — → "father" + edge candidates [Fenrir, Jǫrmungandr, Hel]
    - `mother of Sleipnir (in mare-form)` — → "mother" + edge candidates [Sleipnir]
    - `husband of Sigyn (with sons Narfi and Váli)` — → "husband" + edge candidates [Sigyn]
- **NEW EDGES proposed**:
    - `parent of` → Jǫrmungandr ❌ no DB node
    - `parent of` → Sleipnir ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `blood-brother of Odin` — suggested target: domain (narrative — likely DELETE if covered)
    - `adversary of the Æsir` — suggested target: domain (narrative — likely DELETE if covered)

## Lingbao Tianzun [Chinese]
- **BEFORE**: `[second of the Three Pure Ones, dwells in the Supreme Pure heaven (Shangqing)]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `second of the Three Pure Ones` — suggested target: domain (narrative — likely DELETE if covered)
    - `dwells in the Supreme Pure heaven (Shangqing)` — suggested target: domain (narrative — likely DELETE if covered)

## Barong [Balinese]
- **BEFORE**: `[the protective beast-spirit of Bali, the "king of the spirits", the eternal adversary of Rangda]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the protective beast-spirit of Bali` — suggested target: domain (narrative — likely DELETE if covered)
    - `the "king of the spirits"` — suggested target: domain
    - `the eternal adversary of Rangda` — suggested target: domain (narrative — likely DELETE if covered)

## Samantabhadra [Buddhist]
- **BEFORE**: `[bodhisattva of practice and vows, paired with Mañjuśrī as an attendant of the Buddha, in Nyingma, the primordial Buddha]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `bodhisattva of practice and vows` — suggested target: domain (narrative — likely DELETE if covered)
    - `paired with Mañjuśrī as an attendant of the Buddha` — suggested target: identification
    - `in Nyingma, the primordial Buddha` — suggested target: identification

## Vaisravana [Buddhist]
- **BEFORE**: `[chief of the Four Heavenly Kings, guardian of the north, god of wealth (linked with Kubera), East Asian form: Bishamonten]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `chief of the Four Heavenly Kings` — suggested target: domain
    - `guardian of the north` — suggested target: domain (narrative — likely DELETE if covered)
    - `god of wealth (linked with Kubera)` — suggested target: domain (narrative — likely DELETE if covered)
    - `East Asian form: Bishamonten` — suggested target: domain or identification

## Manjushri [Buddhist]
- **BEFORE**: `[bodhisattva of wisdom]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `bodhisattva of wisdom` — already in domain

## Samael [Abrahamic]
- **BEFORE**: `[angel of death, accuser, consort of Lilith (Kabbalah), head of the demonic order]`
- **AFTER**: `[consort]`
- **REMOVED**:
    - `consort of Lilith (Kabbalah)` — → "consort" + edge candidates [Lilith]
- **NEEDS MANUAL DECISION**:
    - `angel of death` — suggested target: domain (narrative — likely DELETE if covered)
    - `accuser` — suggested target: domain or identification
    - `head of the demonic order` — suggested target: domain (narrative — likely DELETE if covered)

## Ishtar [Mesopotamian]
- **BEFORE**: `[daughter, sister, wife]`
- **AFTER**: `[daughter, sister, wife]`

## Arsay [Canaanite]
- **BEFORE**: `[daughter, sister]`
- **AFTER**: `[daughter, sister]`

## Baal-Hammon [Canaanite]
- **BEFORE**: `[father, king, consort]`
- **AFTER**: `[father, consort]`
- **REMOVED**:
    - `king` — already in domain

## Odin [Norse]
- **BEFORE**: `[father, brother, son, husband]`
- **AFTER**: `[father, brother, son, husband]`

## Danel [Canaanite]
- **BEFORE**: `[father, king, patriarch]`
- **AFTER**: `[father]`
- **REMOVED**:
    - `king` — already in domain
    - `patriarch` — already in domain

## Kirta [Canaanite]
- **BEFORE**: `[king, father, husband]`
- **AFTER**: `[father, husband]`
- **REMOVED**:
    - `king` — already in domain

## Milcom [Canaanite]
- **BEFORE**: `[national god]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `national god` — already in domain

## Hermes [Greek]
- **BEFORE**: `[son of Zeus and Maia (the eldest Pleiad), messenger of the gods, psychopomp (escorts souls to Hades), god of trade, thieves, travelers, heralds, father of Pan (by various accounts), father of Hermaphroditus (by Aphrodite)]`
- **AFTER**: `[son, father]`
- **REMOVED**:
    - `son of Zeus and Maia (the eldest Pleiad)` — → "son" + edge candidates [Zeus, Maia]
    - `father of Pan (by various accounts)` — → "father" + edge candidates [Pan]
    - `father of Hermaphroditus (by Aphrodite)` — → "father" + edge candidates [Hermaphroditus]
- **NEW EDGES proposed**:
    - `child of` → **Zeus** (id 6175) ✅
    - `child of` → **Maia** (id 7006) ✅
    - `parent of` → **Pan** (id 7263) ✅
    - `parent of` → Hermaphroditus ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `messenger of the gods` — suggested target: domain (narrative — likely DELETE if covered)
    - `psychopomp (escorts souls to Hades)` — suggested target: domain or identification
    - `god of trade, thieves, travelers, heralds` — suggested target: domain (narrative — likely DELETE if covered)

## Daikokuten [Shinto]
- **BEFORE**: `[one of the Seven Lucky Gods, syncretic combination of Mahākāla, Daikoku, Ōkuninushi, often paired with Ebisu]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `one of the Seven Lucky Gods` — suggested target: domain (narrative — likely DELETE if covered)
    - `syncretic combination of Mahākāla, Daikoku, Ōkuninushi` — suggested target: domain (narrative — likely DELETE if covered)
    - `often paired with Ebisu` — suggested target: domain (narrative — likely DELETE if covered)

## Aengus [Celtic]
- **BEFORE**: `[son]`
- **AFTER**: `[son]`

## Brigid [Celtic]
- **BEFORE**: `[daughter, spouse]`
- **AFTER**: `[daughter, spouse]`

## Cao Guojiu [Chinese]
- **BEFORE**: `[one of the Eight Immortals (the most recently added), brother of a Song empress, patron of actors]`
- **AFTER**: `[brother]`
- **REMOVED**:
    - `brother of a Song empress` — → "brother" + edge candidates [a Song empress]
- **NEW EDGES proposed**:
    - `sibling of` → a Song empress ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `one of the Eight Immortals (the most recently added)` — suggested target: domain (narrative — likely DELETE if covered)
    - `patron of actors` — suggested target: domain (narrative — likely DELETE if covered)

## Chang'e [Chinese]
- **BEFORE**: `[goddess of the moon, wife of the archer Hou Yi, dweller in the moon-palace]`
- **AFTER**: `[wife]`
- **REMOVED**:
    - `wife of the archer Hou Yi` — → "wife" + edge candidates [the archer Hou Yi]
- **NEW EDGES proposed**:
    - `married to` → the archer Hou Yi ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `goddess of the moon` — suggested target: domain (narrative — likely DELETE if covered)
    - `dweller in the moon-palace` — suggested target: domain (narrative — likely DELETE if covered)

## Fangfeng [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Fuxi [Chinese]
- **BEFORE**: `[first of the Three Sovereigns (San Huang), brother-husband of Nüwa, culture-hero and inventor]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `first of the Three Sovereigns (San Huang)` — suggested target: domain
    - `brother-husband of Nüwa` — suggested target: character_trait
    - `culture-hero and inventor` — suggested target: character_trait

## Gonggong [Chinese]
- **BEFORE**: `[water-god, adversary of Zhurong (and/or Zhuanxu), his destruction of Mount Buzhou necessitated Nüwa's cosmic repair]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `water-god` — suggested target: domain
    - `adversary of Zhurong (and/or Zhuanxu)` — suggested target: domain (narrative — likely DELETE if covered)
    - `his destruction of Mount Buzhou necessitated Nüwa's cosmic repair` — suggested target: domain (narrative — likely DELETE if covered)

## Guanyin [Chinese]
- **BEFORE**: `[bodhisattva-goddess of compassion, Chinese form of Avalokiteśvara, in the Miaoshan legend, the third daughter of King Miaozhuang]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `bodhisattva-goddess of compassion` — suggested target: domain (narrative — likely DELETE if covered)
    - `Chinese form of Avalokiteśvara` — suggested target: domain (narrative — likely DELETE if covered)
    - `in the Miaoshan legend, the third daughter of King Miaozhuang` — suggested target: domain

## Heng and Ha [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Mercury [Roman]
- **BEFORE**: `[identified with Hermes, son of Jupiter and Maia, psychopomp, messenger of the gods, patron of merchants and thieves]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `son of Jupiter and Maia` — → "son" + edge candidates [Jupiter, Maia]
    - `psychopomp` — already in character_trait
- **NEW EDGES proposed**:
    - `child of` → **Jupiter** (id 7444) ✅
    - `child of` → **Maia** (id 7006) ✅
- **NEEDS MANUAL DECISION**:
    - `identified with Hermes` — suggested target: domain (narrative — likely DELETE if covered)
    - `messenger of the gods` — suggested target: domain (narrative — likely DELETE if covered)
    - `patron of merchants and thieves` — suggested target: domain (narrative — likely DELETE if covered)

## Vertumnus [Roman]
- **BEFORE**: `[Etruscan Voltumna imported, husband of Pomona]`
- **AFTER**: `[husband]`
- **REMOVED**:
    - `husband of Pomona` — → "husband" + edge candidates [Pomona]
- **NEEDS MANUAL DECISION**:
    - `Etruscan Voltumna imported` — suggested target: domain or identification

## Lan Caihe [Chinese]
- **BEFORE**: `[one of the Eight Immortals, the ambiguously-gendered eccentric of the group, patron of florists]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `one of the Eight Immortals` — suggested target: domain (narrative — likely DELETE if covered)
    - `the ambiguously-gendered eccentric of the group` — suggested target: domain (narrative — likely DELETE if covered)
    - `patron of florists` — suggested target: domain (narrative — likely DELETE if covered)

## Ma Yuan [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Niulang [Chinese]
- **BEFORE**: `[father, spouse]`
- **AFTER**: `[father, spouse]`

## Pangu [Chinese]
- **BEFORE**: `[primordial cosmic giant, the first being, his body became the physical world]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `the first being` — already in symbolism
- **NEEDS MANUAL DECISION**:
    - `primordial cosmic giant` — suggested target: domain or identification
    - `his body became the physical world` — suggested target: domain or identification

## Qu Yuan [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Randeng Daoren [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Yao [Chinese]
- **BEFORE**: `[one of the Five Emperors / sage-kings, father of the unworthy Danzhu, abdicated to Shun (gave him his two daughters in marriage)]`
- **AFTER**: `[father]`
- **REMOVED**:
    - `father of the unworthy Danzhu` — → "father" + edge candidates [the unworthy Danzhu]
- **NEW EDGES proposed**:
    - `parent of` → the unworthy Danzhu ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `one of the Five Emperors / sage-kings` — suggested target: domain
    - `abdicated to Shun (gave him his two daughters in marriage)` — suggested target: domain (narrative — likely DELETE if covered)

## The Divine Twins [Cross-cultural]
- **BEFORE**: `[sibling]`
- **AFTER**: `[sibling]`

## Zhenyuan Daxian [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Semachos [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Chalchiuhtlicue [Aztec]
- **BEFORE**: `[sister-wife of Tlaloc, goddess of fresh water, fourth sun in the Five Suns]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `sister-wife of Tlaloc` — suggested target: character_trait
    - `goddess of fresh water` — suggested target: domain (narrative — likely DELETE if covered)
    - `fourth sun in the Five Suns` — suggested target: domain (narrative — likely DELETE if covered)

## Ammit [Egyptian]
- **BEFORE**: `[judgment-hall-attendant, annihilator of the unjustified]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `judgment-hall-attendant` — suggested target: domain or identification
    - `annihilator of the unjustified` — suggested target: domain (narrative — likely DELETE if covered)

## Coyolxauhqui [Aztec]
- **BEFORE**: `[daughter of Coatlicue, sister of Huitzilopochtli, sister of the 400 Centzon Huitznahua, moon-goddess]`
- **AFTER**: `[daughter, sister]`
- **REMOVED**:
    - `daughter of Coatlicue` — → "daughter" + edge candidates [Coatlicue]
    - `sister of Huitzilopochtli` — → "sister" + edge candidates [Huitzilopochtli]
    - `sister of the 400 Centzon Huitznahua` — → "sister" + edge candidates [the 400 Centzon Huitznahua]
- **NEW EDGES proposed**:
    - `child of` → **Coatlicue** (id 6779) ✅
    - `sibling of` → the 400 Centzon Huitznahua ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `moon-goddess` — suggested target: domain

## Kauket [Egyptian]
- **BEFORE**: `[Ogdoad pair-member with Kuk, primordial darkness]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `primordial darkness` — already in domain
- **NEEDS MANUAL DECISION**:
    - `Ogdoad pair-member with Kuk` — suggested target: domain (narrative — likely DELETE if covered)

## Nezha [Chinese]
- **BEFORE**: `[son of General Li Jing and Lady Yin, disciple of Taiyi Zhenren, marshal of the celestial army, resurrected with a lotus-body]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `son of General Li Jing and Lady Yin` — → "son" + edge candidates [General Li Jing, Lady Yin]
- **NEW EDGES proposed**:
    - `child of` → General Li Jing ❌ no DB node
    - `child of` → Lady Yin ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `disciple of Taiyi Zhenren` — suggested target: domain (narrative — likely DELETE if covered)
    - `marshal of the celestial army` — suggested target: domain (narrative — likely DELETE if covered)
    - `resurrected with a lotus-body` — suggested target: domain (narrative — likely DELETE if covered)

## Nephthys [Egyptian]
- **BEFORE**: `[daughter of Geb and Nut, sister-wife of Set, sister of Isis and Osiris, mother of Anubis (by Osiris in Plutarch; by Set in other versions), canopic-jar protectress]`
- **AFTER**: `[daughter, sister, mother]`
- **REMOVED**:
    - `daughter of Geb and Nut` — → "daughter" + edge candidates [Geb, Nut]
    - `sister of Isis and Osiris` — → "sister" + edge candidates [Isis, Osiris]
    - `mother of Anubis (by Osiris in Plutarch; by Set in other versions)` — → "mother" + edge candidates [Anubis]
- **NEW EDGES proposed**:
    - `child of` → **Geb** (id 6925) ✅
    - `child of` → **Nut** (id 6126) ✅
- **NEEDS MANUAL DECISION**:
    - `sister-wife of Set` — suggested target: character_trait
    - `canopic-jar protectress` — suggested target: domain or identification

## Mummu [Mesopotamian]
- **BEFORE**: `[vizier, advisor]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `vizier` — already in domain
- **NEEDS MANUAL DECISION**:
    - `advisor` — suggested target: domain or identification

## Brahma [Hindu]
- **BEFORE**: `[creator-god, husband of Sarasvatī, father of the Saptaṛṣis, Trimūrti member]`
- **AFTER**: `[husband, father]`
- **REMOVED**:
    - `husband of Sarasvatī` — → "husband" + edge candidates [Sarasvatī]
    - `father of the Saptaṛṣis` — → "father" + edge candidates [the Saptaṛṣis]
- **NEW EDGES proposed**:
    - `married to` → Sarasvatī ❌ no DB node
    - `parent of` → the Saptaṛṣis ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `creator-god` — suggested target: domain
    - `Trimūrti member` — suggested target: domain or identification

## Ptah [Egyptian]
- **BEFORE**: `[supreme creator (Memphite theology), husband of Sekhmet, father of Nefertem, member of the Memphite triad]`
- **AFTER**: `[husband, father]`
- **REMOVED**:
    - `husband of Sekhmet` — → "husband" + edge candidates [Sekhmet]
    - `father of Nefertem` — → "father" + edge candidates [Nefertem]
- **NEW EDGES proposed**:
    - `parent of` → **Nefertem** (id 6362) ✅
- **NEEDS MANUAL DECISION**:
    - `supreme creator (Memphite theology)` — suggested target: domain or identification
    - `member of the Memphite triad` — suggested target: domain (narrative — likely DELETE if covered)

## Ares [Greek]
- **BEFORE**: `[son of Zeus and Hera, lover of Aphrodite, father of Eros, Phobos, Deimos, Harmonia (by Aphrodite), god of war]`
- **AFTER**: `[son, father]`
- **REMOVED**:
    - `son of Zeus and Hera` — → "son" + edge candidates [Zeus, Hera]
    - `father of Eros, Phobos, Deimos, Harmonia (by Aphrodite)` — → "father" + edge candidates [Eros, Phobos, Deimos, Harmonia]
- **NEW EDGES proposed**:
    - `child of` → **Zeus** (id 6175) ✅
    - `child of` → **Hera** (id 6246) ✅
    - `parent of` → **Phobos** (id 6883) ✅
    - `parent of` → **Deimos** (id 6792) ✅
    - `parent of` → **Harmonia** (id 6177) ✅
- **NEEDS MANUAL DECISION**:
    - `lover of Aphrodite` — suggested target: domain (narrative — likely DELETE if covered)
    - `god of war` — suggested target: domain (narrative — likely DELETE if covered)

## Amphitrite [Greek]
- **BEFORE**: `[daughter of Nereus and Doris, one of the fifty Nereids, wife of Poseidon, mother of Triton]`
- **AFTER**: `[daughter, wife, mother]`
- **REMOVED**:
    - `daughter of Nereus and Doris` — → "daughter" + edge candidates [Nereus, Doris]
    - `one of the fifty Nereids` — already in domain
    - `wife of Poseidon` — → "wife" + edge candidates [Poseidon]
    - `mother of Triton` — → "mother" + edge candidates [Triton]
- **NEW EDGES proposed**:
    - `child of` → **Nereus** (id 7434) ✅
    - `child of` → **Doris** (id 6672) ✅

## Demeter [Greek]
- **BEFORE**: `[daughter of Cronus and Rhea, sister of Zeus, Hera, Poseidon, Hades, Hestia, mother of Persephone (by Zeus), mother of Plutus (by Iasion), mother of Despoina and the horse Areion (by Poseidon)]`
- **AFTER**: `[daughter, sister, mother]`
- **REMOVED**:
    - `daughter of Cronus and Rhea` — → "daughter" + edge candidates [Cronus, Rhea]
    - `sister of Zeus, Hera, Poseidon, Hades, Hestia` — → "sister" + edge candidates [Zeus, Hera, Poseidon, Hades, Hestia]
    - `mother of Persephone (by Zeus)` — → "mother" + edge candidates [Persephone]
    - `mother of Plutus (by Iasion)` — → "mother" + edge candidates [Plutus]
    - `mother of Despoina and the horse Areion (by Poseidon)` — → "mother" + edge candidates [Despoina, the horse Areion]
- **NEW EDGES proposed**:
    - `child of` → **Cronus** (id 6099) ✅
    - `child of` → **Rhea** (id 6780) ✅
    - `parent of` → Persephone ❌ no DB node
    - `parent of` → **Despoina** (id 7265) ✅
    - `parent of` → the horse Areion ❌ no DB node

## Cronus [Greek]
- **BEFORE**: `[youngest son of Ouranos and Gaia, husband of Rhea (his sister), father of the first six Olympians, Titan king before Zeus]`
- **AFTER**: `[husband, father]`
- **REMOVED**:
    - `husband of Rhea (his sister)` — → "husband" + edge candidates [Rhea]
    - `father of the first six Olympians` — → "father" + edge candidates [the first six Olympians]
- **NEW EDGES proposed**:
    - `parent of` → the first six Olympians ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `youngest son of Ouranos and Gaia` — suggested target: domain (narrative — likely DELETE if covered)
    - `Titan king before Zeus` — suggested target: domain

## Erlang Shen [Chinese]
- **BEFORE**: `[nephew of the Jade Emperor, master of the Howling Celestial Dog, three-eyed warrior-god]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `nephew of the Jade Emperor` — suggested target: domain
    - `master of the Howling Celestial Dog` — suggested target: domain (narrative — likely DELETE if covered)
    - `three-eyed warrior-god` — suggested target: domain

## Xiwangmu [Chinese]
- **BEFORE**: `[Queen Mother of the West, goddess of Mount Kunlun and the western paradise, keeper of the peaches of immortality, ruler of the female immortals, consort of the Jade Emperor (popular tradition)]`
- **AFTER**: `[consort]`
- **REMOVED**:
    - `consort of the Jade Emperor (popular tradition)` — → "consort" + edge candidates [the Jade Emperor]
- **NEW EDGES proposed**:
    - `married to` → the Jade Emperor ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `Queen Mother of the West` — suggested target: domain
    - `goddess of Mount Kunlun and the western paradise` — suggested target: domain (narrative — likely DELETE if covered)
    - `keeper of the peaches of immortality` — suggested target: domain (narrative — likely DELETE if covered)
    - `ruler of the female immortals` — suggested target: domain (narrative — likely DELETE if covered)

## Centeotl [Aztec]
- **BEFORE**: `[son of Tlazolteotl in some accounts; son of Piltzintecuhtli and Xochiquetzal in others, maize-god]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `son of Tlazolteotl in some accounts; son of Piltzintecuhtli and Xochiquetzal in others` — → "son" + edge candidates [Tlazolteotl in some accounts, son of Piltzintecuhtli, Xochiquetzal in others]
- **NEW EDGES proposed**:
    - `child of` → Tlazolteotl in some accounts ❌ no DB node
    - `child of` → son of Piltzintecuhtli ❌ no DB node
    - `child of` → Xochiquetzal in others ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `maize-god` — suggested target: domain

## Ouranos [Greek]
- **BEFORE**: `[primordial sky-god, parthenogenetic son of Gaia, mate of Gaia, father of the Titans, Cyclopes, Hekatonkheires; from his castration the Erinyes, Giants, and Aphrodite emerged]`
- **AFTER**: `[father]`
- **REMOVED**:
    - `father of the Titans, Cyclopes, Hekatonkheires; from his castration the Erinyes, Giants, and Aphrodite emerged` — → "father" + edge candidates [the Titans, Cyclopes, Hekatonkheires, from his castration the Erinyes, Giants, Aphrodite emerged]
- **NEW EDGES proposed**:
    - `parent of` → the Titans ❌ no DB node
    - `parent of` → Cyclopes ❌ no DB node
    - `parent of` → Hekatonkheires ❌ no DB node
    - `parent of` → from his castration the Erinyes ❌ no DB node
    - `parent of` → Giants ❌ no DB node
    - `parent of` → Aphrodite emerged ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `primordial sky-god` — suggested target: domain
    - `parthenogenetic son of Gaia` — suggested target: domain (narrative — likely DELETE if covered)
    - `mate of Gaia` — suggested target: domain (narrative — likely DELETE if covered)

## Tyche [Greek]
- **BEFORE**: `[daughter of Oceanus (Hesiod) or of Zeus (Pindar), Hellenistic-age cosmic-fortune-deity]`
- **AFTER**: `[daughter]`
- **REMOVED**:
    - `daughter of Oceanus (Hesiod) or of Zeus (Pindar)` — → "daughter" + edge candidates [Oceanus  or of Zeus]
- **NEW EDGES proposed**:
    - `child of` → Oceanus  or of Zeus ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `Hellenistic-age cosmic-fortune-deity` — suggested target: domain

## Q'uq'umatz [Maya]
- **BEFORE**: `[the Feathered Serpent of the K'iche' Maya, a creator-deity of the Popol Vuh, cognate of Kukulkan and Quetzalcoatl]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the Feathered Serpent of the K'iche' Maya` — suggested target: domain (narrative — likely DELETE if covered)
    - `a creator-deity of the Popol Vuh` — suggested target: domain
    - `cognate of Kukulkan and Quetzalcoatl` — suggested target: domain (narrative — likely DELETE if covered)

## Agni [Hindu]
- **BEFORE**: `[fire-god, one of the eight Vasus, grandson of the waters, priest of the gods]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `fire-god` — suggested target: domain
    - `one of the eight Vasus` — suggested target: domain (narrative — likely DELETE if covered)
    - `grandson of the waters` — suggested target: domain (narrative — likely DELETE if covered)
    - `priest of the gods` — suggested target: character_trait

## Set [Egyptian]
- **BEFORE**: `[brother, father, son, husband]`
- **AFTER**: `[brother, father, son, husband]`

## Goumang [Chinese]
- **BEFORE**: `[father, spouse]`
- **AFTER**: `[father, spouse]`

## Durga [Hindu]
- **BEFORE**: `[supreme goddess, consort of Śiva, mother of Gaṇeśa and Skanda]`
- **AFTER**: `[consort, mother]`
- **REMOVED**:
    - `consort of Śiva` — → "consort" + edge candidates [Śiva]
    - `mother of Gaṇeśa and Skanda` — → "mother" + edge candidates [Gaṇeśa, Skanda]
- **NEW EDGES proposed**:
    - `married to` → Śiva ❌ no DB node
    - `parent of` → Gaṇeśa ❌ no DB node
    - `parent of` → Skanda ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `supreme goddess` — suggested target: domain or identification

## Ganesha [Hindu]
- **BEFORE**: `[son of Śiva and Pārvatī, brother of Skanda/Kārtikeya, lord of the gaṇas, first-worshipped at every Hindu rite]`
- **AFTER**: `[son, brother]`
- **REMOVED**:
    - `son of Śiva and Pārvatī` — → "son" + edge candidates [Śiva, Pārvatī]
    - `brother of Skanda/Kārtikeya` — → "brother" + edge candidates [Skanda/Kārtikeya]
- **NEW EDGES proposed**:
    - `child of` → Śiva ❌ no DB node
    - `child of` → Pārvatī ❌ no DB node
    - `sibling of` → Skanda/Kārtikeya ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `lord of the gaṇas` — suggested target: domain
    - `first-worshipped at every Hindu rite` — suggested target: domain (narrative — likely DELETE if covered)

## Hanuman [Hindu]
- **BEFORE**: `[son of Añjanā and Vāyu, vānara general, supreme devotee of Rāma, Cirañjīvī]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `son of Añjanā and Vāyu` — → "son" + edge candidates [Añjanā, Vāyu]
- **NEW EDGES proposed**:
    - `child of` → Añjanā ❌ no DB node
    - `child of` → Vāyu ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `vānara general` — suggested target: domain or identification
    - `supreme devotee of Rāma` — suggested target: domain (narrative — likely DELETE if covered)
    - `Cirañjīvī` — suggested target: domain or identification

## Vishnu [Hindu]
- **BEFORE**: `[supreme being, husband of Lakṣmī, father of countless avatars, Trimūrti member]`
- **AFTER**: `[husband, father]`
- **REMOVED**:
    - `supreme being` — already in domain
    - `husband of Lakṣmī` — → "husband" + edge candidates [Lakṣmī]
    - `father of countless avatars` — → "father" + edge candidates [countless avatars]
- **NEW EDGES proposed**:
    - `married to` → Lakṣmī ❌ no DB node
    - `parent of` → countless avatars ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `Trimūrti member` — suggested target: domain or identification

## Azure Dragon [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Daode Tianzun [Chinese]
- **BEFORE**: `[third of the Three Pure Ones, identified with the deified Laozi (Taishang Laojun), dwells in the Grand Pure heaven (Taiqing)]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `third of the Three Pure Ones` — suggested target: domain (narrative — likely DELETE if covered)
    - `identified with the deified Laozi (Taishang Laojun)` — suggested target: domain (narrative — likely DELETE if covered)
    - `dwells in the Grand Pure heaven (Taiqing)` — suggested target: domain (narrative — likely DELETE if covered)

## Ishtadevata [Hindu]
- **BEFORE**: `[chosen personal deity]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `chosen personal deity` — already in domain (phrase "personal deity")

## Krishna [Hindu]
- **BEFORE**: `[eighth avatar of Viṣṇu, son of Devakī and Vasudeva, foster-son of Yaśodā and Nanda, brother of Balarāma, beloved of Rādhā, husband of Rukmiṇī]`
- **AFTER**: `[son, brother, husband]`
- **REMOVED**:
    - `son of Devakī and Vasudeva` — → "son" + edge candidates [Devakī, Vasudeva]
    - `brother of Balarāma` — → "brother" + edge candidates [Balarāma]
    - `husband of Rukmiṇī` — → "husband" + edge candidates [Rukmiṇī]
- **NEW EDGES proposed**:
    - `child of` → Devakī ❌ no DB node
    - `child of` → Vasudeva ❌ no DB node
    - `sibling of` → Balarāma ❌ no DB node
    - `married to` → Rukmiṇī ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `eighth avatar of Viṣṇu` — suggested target: identification
    - `foster-son of Yaśodā and Nanda` — suggested target: domain (narrative — likely DELETE if covered)
    - `beloved of Rādhā` — suggested target: domain (narrative — likely DELETE if covered)

## Kurma [Hindu]
- **BEFORE**: `[second avatar of Viṣṇu, cosmic-foundation-supporter]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `second avatar of Viṣṇu` — suggested target: identification
    - `cosmic-foundation-supporter` — suggested target: domain or identification

## Sita [Hindu]
- **BEFORE**: `[wife of Rāma, daughter of Earth-mother/King Janaka, mother of Lava and Kuśa, avatar of Lakṣmī]`
- **AFTER**: `[wife, daughter, mother]`
- **REMOVED**:
    - `wife of Rāma` — → "wife" + edge candidates [Rāma]
    - `daughter of Earth-mother/King Janaka` — → "daughter" + edge candidates [Earth-mother/King Janaka]
    - `mother of Lava and Kuśa` — → "mother" + edge candidates [Lava, Kuśa]
- **NEW EDGES proposed**:
    - `married to` → Rāma ❌ no DB node
    - `child of` → Earth-mother/King Janaka ❌ no DB node
    - `parent of` → Lava ❌ no DB node
    - `parent of` → Kuśa ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `avatar of Lakṣmī` — suggested target: identification

## Surya Majapahit [Hindu]
- **BEFORE**: `[solar emblem of Majapahit royalty]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `solar emblem of Majapahit royalty` — suggested target: domain (narrative — likely DELETE if covered)

## Huangdi [Chinese]
- **BEFORE**: `[the Yellow Emperor, first of the Five Emperors, legendary ancestor of the Han Chinese, husband of Leizu (inventor of silk)]`
- **AFTER**: `[husband]`
- **REMOVED**:
    - `husband of Leizu (inventor of silk)` — → "husband" + edge candidates [Leizu]
- **NEW EDGES proposed**:
    - `married to` → Leizu ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `the Yellow Emperor` — suggested target: domain
    - `first of the Five Emperors` — suggested target: domain
    - `legendary ancestor of the Han Chinese` — suggested target: domain (narrative — likely DELETE if covered)

## Ushas [Hindu]
- **BEFORE**: `[dawn-goddess, daughter of Dyaus, sister/companion of Aśvin-twins]`
- **AFTER**: `[daughter]`
- **REMOVED**:
    - `daughter of Dyaus` — → "daughter" + edge candidates [Dyaus]
- **NEW EDGES proposed**:
    - `child of` → Dyaus ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `dawn-goddess` — suggested target: domain
    - `sister/companion of Aśvin-twins` — suggested target: domain (narrative — likely DELETE if covered)

## Ninurta [Mesopotamian]
- **BEFORE**: `[son, warrior]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `warrior` — already in domain

## Echidna [Greek]
- **BEFORE**: `[daughter of Phorcys and Ceto (Hesiod) or Tartarus and Gaia (alternative), mate of Typhon, mother of most Greek monsters]`
- **AFTER**: `[daughter, mother]`
- **REMOVED**:
    - `daughter of Phorcys and Ceto (Hesiod) or Tartarus and Gaia (alternative)` — → "daughter" + edge candidates [Phorcys, Ceto  or Tartarus, Gaia]
    - `mate of Typhon` — already in domain
    - `mother of most Greek monsters` — → "mother" + edge candidates [most Greek monsters]
- **NEW EDGES proposed**:
    - `child of` → Phorcys ❌ no DB node
    - `child of` → Ceto  or Tartarus ❌ no DB node
    - `child of` → **Gaia** (id 6219) ✅
    - `parent of` → most Greek monsters ❌ no DB node

## Myiagros [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Lýtir [Norse]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Lycurgus [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Chimera [Greek]
- **BEFORE**: `[daughter of Typhon and Echidna, sibling of Hydra, Cerberus, Orthus, Nemean lion, slain by Bellerophon]`
- **AFTER**: `[daughter, sibling]`
- **REMOVED**:
    - `daughter of Typhon and Echidna` — → "daughter" + edge candidates [Typhon, Echidna]
    - `sibling of Hydra, Cerberus, Orthus, Nemean lion` — → "sibling" + edge candidates [Hydra, Cerberus, Orthus, Nemean lion]
- **NEW EDGES proposed**:
    - `child of` → **Typhon** (id 7438) ✅
    - `child of` → **Echidna** (id 7439) ✅
    - `sibling of` → Orthus ❌ no DB node
    - `sibling of` → Nemean lion ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `slain by Bellerophon` — suggested target: domain (narrative — likely DELETE if covered)

## Kukulkan [Maya]
- **BEFORE**: `[the Feathered Serpent of the Yucatec Maya, cognate of the Aztec Quetzalcoatl and the K'iche' Q'uq'umatz]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the Feathered Serpent of the Yucatec Maya` — suggested target: domain (narrative — likely DELETE if covered)
    - `cognate of the Aztec Quetzalcoatl and the K'iche' Q'uq'umatz` — suggested target: domain (narrative — likely DELETE if covered)

## Asalluhi [Mesopotamian]
- **BEFORE**: `[son]`
- **AFTER**: `[son]`

## Damkina [Mesopotamian]
- **BEFORE**: `[wife, mother]`
- **AFTER**: `[wife, mother]`

## Minotaur [Greek]
- **BEFORE**: `[son of Pasiphae (queen of Crete) and the Cretan Bull, step-son of King Minos, slain by Theseus]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `son of Pasiphae (queen of Crete) and the Cretan Bull` — → "son" + edge candidates [Pasiphae, the Cretan Bull]
- **NEW EDGES proposed**:
    - `child of` → Pasiphae ❌ no DB node
    - `child of` → the Cretan Bull ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `step-son of King Minos` — suggested target: domain
    - `slain by Theseus` — suggested target: domain (narrative — likely DELETE if covered)

## Shahar [Canaanite]
- **BEFORE**: `[son, twin]`
- **AFTER**: `[son, twin]`

## Enki [Mesopotamian]
- **BEFORE**: `[son, husband, father]`
- **AFTER**: `[son, husband, father]`

## Mei Bo [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Enkidu [Mesopotamian]
- **BEFORE**: `[companion]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `companion` — suggested target: domain or identification

## Aruru [Mesopotamian]
- **BEFORE**: `[mother, creator]`
- **AFTER**: `[mother]`
- **NEEDS MANUAL DECISION**:
    - `creator` — suggested target: domain or identification

## Ninhursag [Mesopotamian]
- **BEFORE**: `[mother, spouse]`
- **AFTER**: `[mother, spouse]`

## Annar [Norse]
- **BEFORE**: `[husband of Nótt, father of Jǫrð]`
- **AFTER**: `[husband, father]`
- **REMOVED**:
    - `husband of Nótt` — → "husband" + edge candidates [Nótt]
    - `father of Jǫrð` — → "father" + edge candidates [Jǫrð]
- **NEW EDGES proposed**:
    - `married to` → Nótt ❌ no DB node
    - `parent of` → Jǫrð ❌ no DB node

## Manannán mac Lir [Celtic]
- **BEFORE**: `[son, father]`
- **AFTER**: `[son, father]`

## Bound monster [Norse]
- **BEFORE**: `[supernatural being (category), folkloric type]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `supernatural being (category)` — suggested target: domain (narrative — likely DELETE if covered)
    - `folkloric type` — suggested target: domain or identification

## Freyja [Norse]
- **BEFORE**: `[daughter, sister, wife, mother]`
- **AFTER**: `[daughter, sister, wife, mother]`

## Forseti [Norse]
- **BEFORE**: `[son, god of justice]`
- **AFTER**: `[son]`
- **NEEDS MANUAL DECISION**:
    - `god of justice` — suggested target: domain (narrative — likely DELETE if covered)

## Freyr [Norse]
- **BEFORE**: `[son, brother, husband, god of fertility and prosperity]`
- **AFTER**: `[son, brother, husband]`
- **NEEDS MANUAL DECISION**:
    - `god of fertility and prosperity` — suggested target: domain (narrative — likely DELETE if covered)

## Batara Kala [Balinese]
- **BEFORE**: `[son]`
- **AFTER**: `[son]`

## Jade Emperor [Chinese]
- **BEFORE**: `[supreme ruler of Heaven, head of the celestial bureaucracy, formally subordinate to the Three Pure Ones, husband of the Queen Mother of the West in popular tradition]`
- **AFTER**: `[husband]`
- **REMOVED**:
    - `husband of the Queen Mother of the West in popular tradition` — → "husband" + edge candidates [the Queen Mother of the West in popular tradition]
- **NEW EDGES proposed**:
    - `married to` → the Queen Mother of the West in popular tradition ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `supreme ruler of Heaven` — suggested target: domain (narrative — likely DELETE if covered)
    - `head of the celestial bureaucracy` — suggested target: domain (narrative — likely DELETE if covered)
    - `formally subordinate to the Three Pure Ones` — suggested target: domain (narrative — likely DELETE if covered)

## Men [Phrygian]
- **BEFORE**: `[Anatolian/Phrygian moon-god, governor of the months]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `Anatolian/Phrygian moon-god` — suggested target: domain
    - `governor of the months` — suggested target: domain (narrative — likely DELETE if covered)

## Wufang Guidi [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Matsya [Hindu]
- **BEFORE**: `[first avatar of Viṣṇu, protector of Manu, preserver of the Vedas]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `first avatar of Viṣṇu` — suggested target: identification
    - `protector of Manu` — suggested target: domain (narrative — likely DELETE if covered)
    - `preserver of the Vedas` — suggested target: domain (narrative — likely DELETE if covered)

## Vesta [Roman]
- **BEFORE**: `[identified with Hestia, first-born of Saturn and Ops; first-swallowed, virgin goddess (her vow guarded by the Vestal Virgins on earth), indigenous Roman as Latin Vesta predating the Hestia-interpretatio]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `identified with Hestia` — suggested target: domain (narrative — likely DELETE if covered)
    - `first-born of Saturn and Ops; first-swallowed` — suggested target: domain (narrative — likely DELETE if covered)
    - `virgin goddess (her vow guarded by the Vestal Virgins on earth)` — suggested target: domain (narrative — likely DELETE if covered)
    - `indigenous Roman as Latin Vesta predating the Hestia-interpretatio` — suggested target: domain (narrative — likely DELETE if covered)

## Surt [Norse]
- **BEFORE**: `[fire-giant, eschatological adversary]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `fire-giant` — suggested target: domain or identification
    - `eschatological adversary` — suggested target: domain or identification

## Norns [Norse]
- **BEFORE**: `[fate-spinners, collective]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `fate-spinners` — suggested target: domain (narrative — likely DELETE if covered)
    - `collective` — suggested target: domain or identification

## Ymir [Norse]
- **BEFORE**: `[primordial ancestor of giants, sacrificial cosmos-body]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `primordial ancestor of giants` — suggested target: domain (narrative — likely DELETE if covered)
    - `sacrificial cosmos-body` — suggested target: domain or identification

## Mazu [Chinese]
- **BEFORE**: `[goddess of the sea, deified from the historical/legendary Lin Moniang, commander of Qianliyan and Shunfeng'er, titled Tianhou, Empress of Heaven]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `goddess of the sea` — suggested target: domain (narrative — likely DELETE if covered)
    - `deified from the historical/legendary Lin Moniang` — suggested target: domain (narrative — likely DELETE if covered)
    - `commander of Qianliyan and Shunfeng'er` — suggested target: domain (narrative — likely DELETE if covered)
    - `titled Tianhou, Empress of Heaven` — suggested target: domain (narrative — likely DELETE if covered)

## Khonsu [Egyptian]
- **BEFORE**: `[son of Amun and Mut, Theban triad member, moon-god]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `son of Amun and Mut` — → "son" + edge candidates [Amun, Mut]
- **NEW EDGES proposed**:
    - `child of` → **Amun** (id 7268) ✅
    - `child of` → **Mut** (id 6240) ✅
- **NEEDS MANUAL DECISION**:
    - `Theban triad member` — suggested target: domain or identification
    - `moon-god` — suggested target: domain

## Bacchus [Roman]
- **BEFORE**: `[identified with Dionysus and Liber, son of Jupiter and Semele, twice-born, husband of Ariadne]`
- **AFTER**: `[son, husband]`
- **REMOVED**:
    - `son of Jupiter and Semele` — → "son" + edge candidates [Jupiter, Semele]
    - `husband of Ariadne` — → "husband" + edge candidates [Ariadne]
- **NEW EDGES proposed**:
    - `child of` → **Jupiter** (id 7444) ✅
    - `child of` → **Semele** (id 6454) ✅
- **NEEDS MANUAL DECISION**:
    - `identified with Dionysus and Liber` — suggested target: domain (narrative — likely DELETE if covered)
    - `twice-born` — suggested target: domain or identification

## Guan Yu [Chinese]
- **BEFORE**: `[father, spouse]`
- **AFTER**: `[father, spouse]`

## Asherah [Canaanite]
- **BEFORE**: `[mother, wife, creatress, queen]`
- **AFTER**: `[mother, wife]`
- **REMOVED**:
    - `queen` — already in character_trait
- **NEEDS MANUAL DECISION**:
    - `creatress` — suggested target: domain or identification

## Hathor [Egyptian]
- **BEFORE**: `[daughter of Ra (in some genealogies), consort of Horus (especially at Edfu), mother of Ihy (the sistrum-rattler), Eye of Ra]`
- **AFTER**: `[daughter, consort, mother]`
- **REMOVED**:
    - `daughter of Ra (in some genealogies)` — → "daughter" + edge candidates [Ra]
    - `consort of Horus (especially at Edfu)` — → "consort" + edge candidates [Horus]
    - `mother of Ihy (the sistrum-rattler)` — → "mother" + edge candidates [Ihy]
- **NEW EDGES proposed**:
    - `child of` → **Ra** (id 6119) ✅
    - `married to` → **Horus** (id 6757) ✅
    - `parent of` → **Ihy** (id 6894) ✅
- **NEEDS MANUAL DECISION**:
    - `Eye of Ra` — suggested target: domain (narrative — likely DELETE if covered)

## Tuisto [Germanic]
- **BEFORE**: `[the earth-born primordial god of the Germanic peoples, father of Mannus]`
- **AFTER**: `[father]`
- **REMOVED**:
    - `father of Mannus` — → "father" + edge candidates [Mannus]
- **NEEDS MANUAL DECISION**:
    - `the earth-born primordial god of the Germanic peoples` — suggested target: domain (narrative — likely DELETE if covered)

## Avalokiteshvara [Buddhist]
- **BEFORE**: `[bodhisattva of compassion, spiritual son of the Buddha Amitābha, East Asian form: Guanyin/Kannon]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `bodhisattva of compassion` — suggested target: domain (narrative — likely DELETE if covered)
    - `spiritual son of the Buddha Amitābha` — suggested target: identification
    - `East Asian form: Guanyin/Kannon` — suggested target: domain (narrative — likely DELETE if covered)

## Faunus [Roman]
- **BEFORE**: `[indigenous Italic god, identified with Pan, grandfather of Latinus (Virgil), sometimes called son of Picus (the woodpecker-deity)]`
- **AFTER**: `[grandfather]`
- **REMOVED**:
    - `grandfather of Latinus (Virgil)` — → "grandfather" + edge candidates [Latinus]
- **NEW EDGES proposed**:
    - `ancestor of` → Latinus ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `indigenous Italic god` — suggested target: domain (narrative — likely DELETE if covered)
    - `identified with Pan` — suggested target: domain (narrative — likely DELETE if covered)
    - `sometimes called son of Picus (the woodpecker-deity)` — suggested target: domain

## Ra [Egyptian]
- **BEFORE**: `[father, spouse]`
- **AFTER**: `[father, spouse]`

## Phra Kalachai Si [Hindu]
- **BEFORE**: `[time-deity in Thai Hindu syncretism]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `time-deity in Thai Hindu syncretism` — suggested target: domain

## Kuladevata [Hindu]
- **BEFORE**: `[family/lineage deity]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `family/lineage deity` — suggested target: domain

## Saturn [Roman]
- **BEFORE**: `[identified with Cronus, husband-brother of Ops, father of Jupiter, Juno, Neptune, Pluto, Ceres, Vesta, Italic ruler of Latium during the Golden Age (uniquely Roman tradition)]`
- **AFTER**: `[father]`
- **REMOVED**:
    - `father of Jupiter, Juno, Neptune, Pluto, Ceres, Vesta` — → "father" + edge candidates [Jupiter, Juno, Neptune, Pluto, Ceres, Vesta]
- **NEEDS MANUAL DECISION**:
    - `identified with Cronus` — suggested target: domain (narrative — likely DELETE if covered)
    - `husband-brother of Ops` — suggested target: character_trait
    - `Italic ruler of Latium during the Golden Age (uniquely Roman tradition)` — suggested target: domain (narrative — likely DELETE if covered)

## Victoria [Roman]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Cerberus [Greek]
- **BEFORE**: `[son of Typhon and Echidna, sibling of Hydra, Chimera, Orthus, Nemean lion, guardian of Hades]`
- **AFTER**: `[son, sibling]`
- **REMOVED**:
    - `son of Typhon and Echidna` — → "son" + edge candidates [Typhon, Echidna]
    - `sibling of Hydra, Chimera, Orthus, Nemean lion` — → "sibling" + edge candidates [Hydra, Chimera, Orthus, Nemean lion]
- **NEW EDGES proposed**:
    - `child of` → **Typhon** (id 7438) ✅
    - `child of` → **Echidna** (id 7439) ✅
    - `sibling of` → Orthus ❌ no DB node
    - `sibling of` → Nemean lion ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `guardian of Hades` — suggested target: domain (narrative — likely DELETE if covered)

## Silvanus [Roman]
- **BEFORE**: `[indigenous Italic god, not in the state-cult, popular among common people]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `indigenous Italic god` — suggested target: domain (narrative — likely DELETE if covered)
    - `not in the state-cult` — suggested target: domain (narrative — likely DELETE if covered)
    - `popular among common people` — suggested target: domain or identification

## Radha [Hindu]
- **BEFORE**: `[eternal beloved of Kṛṣṇa, chief gopī, wife of the cowherd Āyana]`
- **AFTER**: `[wife]`
- **REMOVED**:
    - `wife of the cowherd Āyana` — → "wife" + edge candidates [the cowherd Āyana]
- **NEW EDGES proposed**:
    - `married to` → the cowherd Āyana ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `eternal beloved of Kṛṣṇa` — suggested target: domain (narrative — likely DELETE if covered)
    - `chief gopī` — suggested target: domain or identification

## Neptune [Roman]
- **BEFORE**: `[identified with Poseidon, son of Saturn and Ops, brother of Jupiter, Pluto, Juno, Ceres, Vesta]`
- **AFTER**: `[son, brother]`
- **REMOVED**:
    - `son of Saturn and Ops` — → "son" + edge candidates [Saturn, Ops]
    - `brother of Jupiter, Pluto, Juno, Ceres, Vesta` — → "brother" + edge candidates [Jupiter, Pluto, Juno, Ceres, Vesta]
- **NEW EDGES proposed**:
    - `child of` → **Saturn** (id 7450) ✅
    - `child of` → **Ops** (id 6653) ✅
- **NEEDS MANUAL DECISION**:
    - `identified with Poseidon` — suggested target: domain (narrative — likely DELETE if covered)

## Jimmu [Shinto]
- **BEFORE**: `[son of Ugayafukiaezu and Tamayori-hime, great-grandson of Ninigi, legendary first emperor, founder of the Yamato imperial dynasty]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `son of Ugayafukiaezu and Tamayori-hime` — → "son" + edge candidates [Ugayafukiaezu, Tamayori-hime]
- **NEW EDGES proposed**:
    - `child of` → **Ugayafukiaezu** (id 7072) ✅
    - `child of` → **Tamayori-hime** (id 7080) ✅
- **NEEDS MANUAL DECISION**:
    - `great-grandson of Ninigi` — suggested target: domain (narrative — likely DELETE if covered)
    - `legendary first emperor` — suggested target: domain
    - `founder of the Yamato imperial dynasty` — suggested target: domain (narrative — likely DELETE if covered)

## Hera [Greek]
- **BEFORE**: `[queen of the gods, youngest daughter of Cronus and Rhea, wife of Zeus (and his sister), mother of Ares, Hebe, Eileithyia, Hephaestus]`
- **AFTER**: `[wife, mother]`
- **REMOVED**:
    - `wife of Zeus (and his sister)` — → "wife" + edge candidates [Zeus]
    - `mother of Ares, Hebe, Eileithyia, Hephaestus` — → "mother" + edge candidates [Ares, Hebe, Eileithyia, Hephaestus]
- **NEW EDGES proposed**:
    - `parent of` → **Hebe** (id 6436) ✅
    - `parent of` → **Eileithyia** (id 6684) ✅
    - `parent of` → **Hephaestus** (id 6218) ✅
- **NEEDS MANUAL DECISION**:
    - `queen of the gods` — suggested target: domain
    - `youngest daughter of Cronus and Rhea` — suggested target: domain (narrative — likely DELETE if covered)

## Amun [Egyptian]
- **BEFORE**: `[Hermopolitan Ogdoad pair-member (with Amunet), Theban triad father (with Mut and Khonsu), supreme imperial god of New Kingdom Egypt]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `Hermopolitan Ogdoad pair-member (with Amunet)` — suggested target: domain (narrative — likely DELETE if covered)
    - `Theban triad father (with Mut and Khonsu)` — suggested target: domain (narrative — likely DELETE if covered)
    - `supreme imperial god of New Kingdom Egypt` — suggested target: domain

## Visvedevas [Hindu]
- **BEFORE**: `[all-gods collective]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `all-gods collective` — suggested target: domain or identification

## Ksitigarbha [Buddhist]
- **BEFORE**: `[bodhisattva of the hell-beings and of vows, East Asian forms: Dizang (Chinese), Jizō (Japanese)]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `bodhisattva of the hell-beings and of vows` — suggested target: domain (narrative — likely DELETE if covered)
    - `East Asian forms: Dizang (Chinese), Jizō (Japanese)` — suggested target: domain (narrative — likely DELETE if covered)

## Barbelo [Gnostic]
- **BEFORE**: `[the first emanation of the Monad, the supreme feminine principle of Sethian Gnosticism, the source of the further aeons (including, ultimately, Sophia)]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the first emanation of the Monad` — suggested target: identification
    - `the supreme feminine principle of Sethian Gnosticism` — suggested target: domain (narrative — likely DELETE if covered)
    - `the source of the further aeons (including, ultimately, Sophia)` — suggested target: domain (narrative — likely DELETE if covered)

## Bhaisajyaguru [Buddhist]
- **BEFORE**: `[the Medicine Buddha, presiding Buddha of the eastern pure land]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the Medicine Buddha` — suggested target: identification
    - `presiding Buddha of the eastern pure land` — suggested target: identification

## Mot [Canaanite]
- **BEFORE**: `[son, adversary, king of the dead]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `king of the dead` — already in character_trait (phrase "the dead")
- **NEEDS MANUAL DECISION**:
    - `adversary` — suggested target: domain or identification

## Heracles [Greek]
- **BEFORE**: `[son of Zeus and Alcmene, step-son of Amphitryon, married three times (Megara, Deianeira, Hebe), greatest of Greek heroes, deified at death — ascended to Olympus]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `son of Zeus and Alcmene` — → "son" + edge candidates [Zeus, Alcmene]
- **NEW EDGES proposed**:
    - `child of` → **Zeus** (id 6175) ✅
    - `child of` → Alcmene ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `step-son of Amphitryon` — suggested target: domain (narrative — likely DELETE if covered)
    - `married three times (Megara, Deianeira, Hebe)` — suggested target: domain or identification
    - `greatest of Greek heroes` — suggested target: character_trait
    - `deified at death — ascended to Olympus` — suggested target: domain or identification

## Mastema [Abrahamic]
- **BEFORE**: `[prince of evil spirits]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `prince of evil spirits` — already in domain (phrase "evil spirits")

## Camazotz [Maya]
- **BEFORE**: `[the Death Bat of Xibalba, the danger of the House of Bats]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the Death Bat of Xibalba` — suggested target: domain (narrative — likely DELETE if covered)
    - `the danger of the House of Bats` — suggested target: domain (narrative — likely DELETE if covered)

## Venus [Roman]
- **BEFORE**: `[identified with Aphrodite, mother of Cupid, mother of Aeneas (by Anchises), divine ancestress of the Julian gens (Caesar, Augustus)]`
- **AFTER**: `[mother]`
- **REMOVED**:
    - `mother of Cupid` — → "mother" + edge candidates [Cupid]
    - `mother of Aeneas (by Anchises)` — → "mother" + edge candidates [Aeneas]
- **NEW EDGES proposed**:
    - `parent of` → **Aeneas** (id 6400) ✅
- **NEEDS MANUAL DECISION**:
    - `identified with Aphrodite` — suggested target: domain (narrative — likely DELETE if covered)
    - `divine ancestress of the Julian gens (Caesar, Augustus)` — suggested target: domain (narrative — likely DELETE if covered)

## Satan [Abrahamic]
- **BEFORE**: `[adversary, accuser, prince of demons (in NT terminology), fallen angel (in Christian theology)]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `adversary` — already in symbolism
- **NEEDS MANUAL DECISION**:
    - `accuser` — suggested target: domain or identification
    - `prince of demons (in NT terminology)` — suggested target: domain
    - `fallen angel (in Christian theology)` — suggested target: identification

## Old Man of the South Pole [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Acintya [Balinese]
- **BEFORE**: `[the supreme formless god of Balinese Hinduism, the source from whom all other gods emanate]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the supreme formless god of Balinese Hinduism` — suggested target: domain (narrative — likely DELETE if covered)
    - `the source from whom all other gods emanate` — suggested target: domain (narrative — likely DELETE if covered)

## Baal [Canaanite]
- **BEFORE**: `[son, spouse, father, brother]`
- **AFTER**: `[son, spouse, father, brother]`

## Village deities of South India [Hindu]
- **BEFORE**: `[village-goddess collective]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `village-goddess collective` — suggested target: domain or identification

## Maori Xingguan [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Mara [Buddhist]
- **BEFORE**: `[the adversary of awakening, father of Taṇhā, Arati, and Rāga]`
- **AFTER**: `[father]`
- **REMOVED**:
    - `father of Taṇhā, Arati, and Rāga` — → "father" + edge candidates [Taṇhā, Arati, Rāga]
- **NEW EDGES proposed**:
    - `parent of` → Taṇhā ❌ no DB node
    - `parent of` → Arati ❌ no DB node
    - `parent of` → Rāga ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `the adversary of awakening` — suggested target: domain (narrative — likely DELETE if covered)

## Narasimha [Hindu]
- **BEFORE**: `[fourth avatar of Viṣṇu]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `fourth avatar of Viṣṇu` — suggested target: identification

## Typhon [Greek]
- **BEFORE**: `[son of Gaia and Tartarus, mate of Echidna, father (with Echidna) of Cerberus, Hydra, Chimera, Sphinx, Nemean lion]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `son of Gaia and Tartarus` — → "son" + edge candidates [Gaia, Tartarus]
- **NEW EDGES proposed**:
    - `child of` → **Gaia** (id 6219) ✅
    - `child of` → **Tartarus** (id 7427) ✅
- **NEEDS MANUAL DECISION**:
    - `mate of Echidna` — suggested target: domain (narrative — likely DELETE if covered)
    - `father (with Echidna) of Cerberus, Hydra, Chimera, Sphinx, Nemean lion` — suggested target: domain (narrative — likely DELETE if covered)

## El [Canaanite]
- **BEFORE**: `[father, king, patriarch, spouse]`
- **AFTER**: `[father, spouse]`
- **REMOVED**:
    - `king` — already in domain
    - `patriarch` — already in symbolism

## Lu Dongbin [Chinese]
- **BEFORE**: `[de facto leader of the Eight Immortals, disciple of Zhongli Quan, patriarch of the Quanzhen Daoist school]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `de facto leader of the Eight Immortals` — suggested target: domain (narrative — likely DELETE if covered)
    - `disciple of Zhongli Quan` — suggested target: domain (narrative — likely DELETE if covered)
    - `patriarch of the Quanzhen Daoist school` — suggested target: domain (narrative — likely DELETE if covered)

## Mut [Egyptian]
- **BEFORE**: `[consort of Amun, mother of Khonsu, Theban triad member]`
- **AFTER**: `[consort, mother]`
- **REMOVED**:
    - `consort of Amun` — → "consort" + edge candidates [Amun]
    - `mother of Khonsu` — → "mother" + edge candidates [Khonsu]
- **NEW EDGES proposed**:
    - `married to` → **Amun** (id 7268) ✅
    - `parent of` → **Khonsu** (id 6241) ✅
- **NEEDS MANUAL DECISION**:
    - `Theban triad member` — suggested target: domain or identification

## Macha [Celtic]
- **BEFORE**: `[daughter, sister]`
- **AFTER**: `[daughter, sister]`

## Uriel [Abrahamic]
- **BEFORE**: `[archangel]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `archangel` — suggested target: domain or identification

## Šanta [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Sekhmet [Egyptian]
- **BEFORE**: `[Eye of Ra, consort of Ptah, mother of Nefertem, Memphite triad member, plague-and-healing patron]`
- **AFTER**: `[consort, mother]`
- **REMOVED**:
    - `consort of Ptah` — → "consort" + edge candidates [Ptah]
    - `mother of Nefertem` — → "mother" + edge candidates [Nefertem]
- **NEW EDGES proposed**:
    - `parent of` → **Nefertem** (id 6362) ✅
- **NEEDS MANUAL DECISION**:
    - `Eye of Ra` — suggested target: domain (narrative — likely DELETE if covered)
    - `Memphite triad member` — suggested target: domain or identification
    - `plague-and-healing patron` — suggested target: domain (narrative — likely DELETE if covered)

## Persephone (Kore) [Greek]
- **BEFORE**: `[daughter of Demeter and Zeus, wife of Hades, Queen of the Underworld for half the year, Kore (Maiden) for the other half]`
- **AFTER**: `[daughter, wife]`
- **REMOVED**:
    - `daughter of Demeter and Zeus` — → "daughter" + edge candidates [Demeter, Zeus]
    - `wife of Hades` — → "wife" + edge candidates [Hades]
- **NEW EDGES proposed**:
    - `child of` → **Demeter** (id 6127) ✅
    - `child of` → **Zeus** (id 6175) ✅
- **NEEDS MANUAL DECISION**:
    - `Queen of the Underworld for half the year` — suggested target: domain
    - `Kore (Maiden) for the other half` — suggested target: domain or identification

## Atum [Egyptian]
- **BEFORE**: `[father, spouse]`
- **AFTER**: `[father, spouse]`

## Aesculapius [Roman]
- **BEFORE**: `[identified with Asclepius, son of Apollo, father of Hygieia, Panacea, Iaso]`
- **AFTER**: `[son, father]`
- **REMOVED**:
    - `son of Apollo` — → "son" + edge candidates [Apollo]
    - `father of Hygieia, Panacea, Iaso` — → "father" + edge candidates [Hygieia, Panacea, Iaso]
- **NEW EDGES proposed**:
    - `child of` → **Apollo** (id 7274) ✅
    - `parent of` → **Hygieia** (id 6292) ✅
    - `parent of` → **Panacea** (id 6548) ✅
    - `parent of` → **Iaso** (id 6391) ✅
- **NEEDS MANUAL DECISION**:
    - `identified with Asclepius` — suggested target: domain (narrative — likely DELETE if covered)

## Norea [Gnostic]
- **BEFORE**: `[daughter of Adam and Eve, sister or wife of Seth, a redeemed and revelation-bearing figure of the Sethian texts]`
- **AFTER**: `[daughter]`
- **REMOVED**:
    - `daughter of Adam and Eve` — → "daughter" + edge candidates [Adam, Eve]
- **NEW EDGES proposed**:
    - `child of` → **Adam** (id 6108) ✅
    - `child of` → **Eve** (id 6104) ✅
- **NEEDS MANUAL DECISION**:
    - `sister or wife of Seth` — suggested target: character_trait
    - `a redeemed and revelation-bearing figure of the Sethian texts` — suggested target: domain (narrative — likely DELETE if covered)

## Yum Kaax [Maya]
- **BEFORE**: `[Yucatec Maya god of the forest and of maize, the youthful Maize God, related to Hun Hunahpu the resurrected Maize God]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `Yucatec Maya god of the forest and of maize` — suggested target: domain (narrative — likely DELETE if covered)
    - `the youthful Maize God` — suggested target: domain or identification
    - `related to Hun Hunahpu the resurrected Maize God` — suggested target: domain or identification

## Adad [Mesopotamian]
- **BEFORE**: `[son, warrior, storm-god]`
- **AFTER**: `[son]`
- **NEEDS MANUAL DECISION**:
    - `warrior` — suggested target: character_trait
    - `storm-god` — suggested target: domain

## Itzpapalotl [Aztec]
- **BEFORE**: `[ruler of the Tzitzimimeh, patroness of women who died in childbirth]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `ruler of the Tzitzimimeh` — suggested target: domain (narrative — likely DELETE if covered)
    - `patroness of women who died in childbirth` — suggested target: domain (narrative — likely DELETE if covered)

## Adityas [Hindu]
- **BEFORE**: `[sons of Aditi, solar collective]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `sons of Aditi` — suggested target: domain (narrative — likely DELETE if covered)
    - `solar collective` — suggested target: domain or identification

## The Dagda [Celtic]
- **BEFORE**: `[father, spouse]`
- **AFTER**: `[father, spouse]`

## Cybele [Phrygian]
- **BEFORE**: `[the Phrygian Great Mother, the Mother of the Gods, bound in myth to Attis, identified by the Greeks with Rhea, and at Rome as Magna Mater]`
- **AFTER**: `[mother]`
- **REMOVED**:
    - `the Mother of the Gods` — → "mother" + edge candidates [the Gods]
- **NEW EDGES proposed**:
    - `parent of` → the Gods ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `the Phrygian Great Mother` — suggested target: domain or identification
    - `bound in myth to Attis` — suggested target: domain (narrative — likely DELETE if covered)
    - `identified by the Greeks with Rhea, and at Rome as Magna Mater` — suggested target: domain (narrative — likely DELETE if covered)

## Pothos [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Hok Tek Cheng Sin [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Baimei Shen [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Tara [Buddhist]
- **BEFORE**: `[bodhisattva-goddess of compassion and swift help, born from the tears of Avalokiteśvara]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `bodhisattva-goddess of compassion and swift help` — suggested target: domain (narrative — likely DELETE if covered)
    - `born from the tears of Avalokiteśvara` — suggested target: domain (narrative — likely DELETE if covered)

## Utu [Mesopotamian]
- **BEFORE**: `[son, brother]`
- **AFTER**: `[son, brother]`

## Bishamonten [Shinto]
- **BEFORE**: `[one of the Seven Lucky Gods, one of the Four Heavenly Kings of Buddhism, Japanese form of Vaiśravaṇa/Kubera]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `one of the Seven Lucky Gods` — suggested target: domain (narrative — likely DELETE if covered)
    - `one of the Four Heavenly Kings of Buddhism` — suggested target: domain
    - `Japanese form of Vaiśravaṇa/Kubera` — suggested target: domain (narrative — likely DELETE if covered)

## Peirous [Greek]
- **BEFORE**: `[father, spouse]`
- **AFTER**: `[father, spouse]`

## Ceto [Greek]
- **BEFORE**: `[mother, spouse]`
- **AFTER**: `[mother, spouse]`

## Zeus [Greek]
- **BEFORE**: `[father of gods and men, youngest son of Cronus and Rhea, husband of Hera, one of the three brothers (Zeus-Poseidon-Hades) who divided the cosmos, father of countless Olympians and heroes]`
- **AFTER**: `[father, husband]`
- **REMOVED**:
    - `father of gods and men` — → "father" + edge candidates [gods, men]
    - `husband of Hera` — → "husband" + edge candidates [Hera]
    - `father of countless Olympians and heroes` — → "father" + edge candidates [countless Olympians, heroes]
- **NEW EDGES proposed**:
    - `parent of` → gods ❌ no DB node
    - `parent of` → **Men** (id 7231) ✅
    - `parent of` → countless Olympians ❌ no DB node
    - `parent of` → heroes ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `youngest son of Cronus and Rhea` — suggested target: domain (narrative — likely DELETE if covered)
    - `one of the three brothers (Zeus-Poseidon-Hades) who divided the cosmos` — suggested target: domain (narrative — likely DELETE if covered)

## Ravana [Hindu]
- **BEFORE**: `[son of Viśravas and Kaikasī, grandson of Pulastya, king of Laṅkā, half-brother of Kubera, brother of Vibhīṣaṇa, Kumbhakarṇa, Śūrpaṇakhā, husband of Mandodarī, father of Indrajit]`
- **AFTER**: `[son, brother, husband, father]`
- **REMOVED**:
    - `son of Viśravas and Kaikasī` — → "son" + edge candidates [Viśravas, Kaikasī]
    - `brother of Vibhīṣaṇa, Kumbhakarṇa, Śūrpaṇakhā` — → "brother" + edge candidates [Vibhīṣaṇa, Kumbhakarṇa, Śūrpaṇakhā]
    - `husband of Mandodarī` — → "husband" + edge candidates [Mandodarī]
    - `father of Indrajit` — → "father" + edge candidates [Indrajit]
- **NEW EDGES proposed**:
    - `child of` → Viśravas ❌ no DB node
    - `child of` → Kaikasī ❌ no DB node
    - `sibling of` → Vibhīṣaṇa ❌ no DB node
    - `sibling of` → Kumbhakarṇa ❌ no DB node
    - `sibling of` → Śūrpaṇakhā ❌ no DB node
    - `married to` → Mandodarī ❌ no DB node
    - `parent of` → Indrajit ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `grandson of Pulastya` — suggested target: domain (narrative — likely DELETE if covered)
    - `king of Laṅkā` — suggested target: domain
    - `half-brother of Kubera` — suggested target: domain (narrative — likely DELETE if covered)

## Miaozhuang Wang [Chinese]
- **BEFORE**: `[father, spouse]`
- **AFTER**: `[father, spouse]`

## Alala [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Thrasos [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Bendis [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Ekecheiria [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Eleutheria [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Pandion [Greek]
- **BEFORE**: `[father, spouse]`
- **AFTER**: `[father, spouse]`

## Podalirius [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Smicrus [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Aceso [Greek]
- **BEFORE**: `[sister, spouse]`
- **AFTER**: `[sister, spouse]`

## Kimpurushas [Hindu]
- **BEFORE**: `[horse-headed celestials]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `horse-headed celestials` — suggested target: domain or identification

## Vaikuntha Kamalaja [Hindu]
- **BEFORE**: `[joint icon of Viṣṇu and Lakṣmī]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `joint icon of Viṣṇu and Lakṣmī` — suggested target: domain (narrative — likely DELETE if covered)

## Lahmu [Mesopotamian]
- **BEFORE**: `[son, spouse, father]`
- **AFTER**: `[son, spouse, father]`

## Ningal [Mesopotamian]
- **BEFORE**: `[daughter, wife, mother]`
- **AFTER**: `[daughter, wife, mother]`

## Hun Hunahpu [Maya]
- **BEFORE**: `[father of the Hero Twins Hunahpu and Xbalanque, identified with the Maya Maize God]`
- **AFTER**: `[father]`
- **REMOVED**:
    - `father of the Hero Twins Hunahpu and Xbalanque` — → "father" + edge candidates [the Hero Twins Hunahpu, Xbalanque]
    - `identified with the Maya Maize God` — already in character_trait (phrase "maize god")
- **NEW EDGES proposed**:
    - `parent of` → the Hero Twins Hunahpu ❌ no DB node
    - `parent of` → **Xbalanque** (id 7520) ✅

## Asherah (Israelite) [Abrahamic]
- **BEFORE**: `[mother, consort (per epigraphic evidence, contested), popular Iron-Age goddess]`
- **AFTER**: `[mother]`
- **NEEDS MANUAL DECISION**:
    - `consort (per epigraphic evidence, contested)` — suggested target: character_trait
    - `popular Iron-Age goddess` — suggested target: domain or identification

## Michael [Abrahamic]
- **BEFORE**: `[archangel, prince of the heavenly armies]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `archangel` — suggested target: domain or identification
    - `prince of the heavenly armies` — suggested target: domain

## Adam [Abrahamic]
- **BEFORE**: `[first man, husband, father, progenitor of humanity]`
- **AFTER**: `[husband, father]`
- **REMOVED**:
    - `first man` — already in domain
- **NEEDS MANUAL DECISION**:
    - `progenitor of humanity` — suggested target: domain (narrative — likely DELETE if covered)

## Moses [Abrahamic]
- **BEFORE**: `[prophet, lawgiver, brother, husband, father, leader]`
- **AFTER**: `[brother, husband, father]`
- **REMOVED**:
    - `lawgiver` — already in symbolism
    - `leader` — already in domain
- **NEEDS MANUAL DECISION**:
    - `prophet` — suggested target: domain or identification

## Anu [Mesopotamian]
- **BEFORE**: `[son, father, king]`
- **AFTER**: `[son, father]`
- **REMOVED**:
    - `king` — already in domain

## Dewi Sri [Balinese]
- **BEFORE**: `[the Balinese-Javanese goddess of rice and fertility]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the Balinese-Javanese goddess of rice and fertility` — suggested target: domain (narrative — likely DELETE if covered)

## Xbalanque [Maya]
- **BEFORE**: `[one of the Hero Twins, son of Hun Hunahpu, twin of Hunahpu, raised to become the moon]`
- **AFTER**: `[son, twin]`
- **REMOVED**:
    - `son of Hun Hunahpu` — → "son" + edge candidates [Hun Hunahpu]
    - `twin of Hunahpu` — → "twin" + edge candidates [Hunahpu]
- **NEW EDGES proposed**:
    - `child of` → **Hun Hunahpu** (id 7521) ✅
- **NEEDS MANUAL DECISION**:
    - `one of the Hero Twins` — suggested target: character_trait
    - `raised to become the moon` — suggested target: domain or identification

## Fortuna [Roman]
- **BEFORE**: `[identified with Greek Tyche, indigenous Italic origin, in Praeneste tradition, mother of Jupiter and Juno (uniquely Italic), many cult-aspects (Primigenia, Virilis, Muliebris, Redux, Augusta)]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `identified with Greek Tyche` — suggested target: domain (narrative — likely DELETE if covered)
    - `indigenous Italic origin` — suggested target: domain (narrative — likely DELETE if covered)
    - `in Praeneste tradition, mother of Jupiter and Juno (uniquely Italic)` — suggested target: domain (narrative — likely DELETE if covered)
    - `many cult-aspects (Primigenia, Virilis, Muliebris, Redux, Augusta)` — suggested target: identification

## Inanna [Mesopotamian]
- **BEFORE**: `[daughter, sister, wife]`
- **AFTER**: `[daughter, sister, wife]`

## Yama [Buddhist]
- **BEFORE**: `[lord of death and judge of the dead, the Buddhist development of the Vedic/Hindu Yama]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `lord of death and judge of the dead` — already in symbolism (phrase "the dead")
- **NEEDS MANUAL DECISION**:
    - `the Buddhist development of the Vedic/Hindu Yama` — suggested target: domain (narrative — likely DELETE if covered)

## Anubis [Egyptian]
- **BEFORE**: `[son of Nephthys (by Osiris in Plutarch 14, by Set in other versions), adopted by Isis (who raised him as her own), grave-god, psychopomp]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `son of Nephthys (by Osiris in Plutarch 14, by Set in other versions)` — → "son" + edge candidates [Nephthys]
- **NEW EDGES proposed**:
    - `child of` → **Nephthys** (id 7400) ✅
- **NEEDS MANUAL DECISION**:
    - `adopted by Isis (who raised him as her own)` — suggested target: domain (narrative — likely DELETE if covered)
    - `grave-god, psychopomp` — suggested target: domain or identification

## Siddhartha Gautama [Buddhist]
- **BEFORE**: `[the historical Buddha, prince of the Śākya clan, son of Śuddhodana and Māyā, founder of Buddhism]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `son of Śuddhodana and Māyā` — → "son" + edge candidates [Śuddhodana, Māyā]
- **NEW EDGES proposed**:
    - `child of` → Śuddhodana ❌ no DB node
    - `child of` → Māyā ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `the historical Buddha` — suggested target: identification
    - `prince of the Śākya clan` — suggested target: domain
    - `founder of Buddhism` — suggested target: domain (narrative — likely DELETE if covered)

## Itzamna [Maya]
- **BEFORE**: `[supreme creator-god of the Yucatec Maya, consort of Ix Chel, patron of writing and learning]`
- **AFTER**: `[consort]`
- **REMOVED**:
    - `consort of Ix Chel` — → "consort" + edge candidates [Ix Chel]
- **NEEDS MANUAL DECISION**:
    - `supreme creator-god of the Yucatec Maya` — suggested target: domain (narrative — likely DELETE if covered)
    - `patron of writing and learning` — suggested target: domain (narrative — likely DELETE if covered)

## Mannus [Germanic]
- **BEFORE**: `[founder-figure of the Germanic peoples, son of Tuisto, father of the eponymous ancestors of the Germanic groupings]`
- **AFTER**: `[son, father]`
- **REMOVED**:
    - `founder-figure of the Germanic peoples` — already in symbolism (phrase "germanic peoples")
    - `son of Tuisto` — → "son" + edge candidates [Tuisto]
    - `father of the eponymous ancestors of the Germanic groupings` — → "father" + edge candidates [the eponymous ancestors of the Germanic groupings]
- **NEW EDGES proposed**:
    - `parent of` → the eponymous ancestors of the Germanic groupings ❌ no DB node

## Saga [Norse]
- **BEFORE**: `[Aesir-goddess, companion of Odin]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `Aesir-goddess` — suggested target: domain
    - `companion of Odin` — suggested target: domain (narrative — likely DELETE if covered)

## Váli [Norse]
- **BEFORE**: `[son, avenger, survivor]`
- **AFTER**: `[son]`
- **NEEDS MANUAL DECISION**:
    - `avenger` — suggested target: domain or identification
    - `survivor` — suggested target: domain or identification

## Aristaeus [Greek]
- **BEFORE**: `[father, spouse]`
- **AFTER**: `[father, spouse]`

## Attar [Canaanite]
- **BEFORE**: `[son]`
- **AFTER**: `[son]`

## Chaac [Maya]
- **BEFORE**: `[the Maya rain-god, quadrupled into the four directional Chaacs, cognate of the Aztec Tlaloc]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the Maya rain-god` — suggested target: domain
    - `quadrupled into the four directional Chaacs` — suggested target: domain (narrative — likely DELETE if covered)
    - `cognate of the Aztec Tlaloc` — suggested target: domain (narrative — likely DELETE if covered)

## Apsu [Mesopotamian]
- **BEFORE**: `[father, spouse]`
- **AFTER**: `[father, spouse]`

## Sabazios [Phrygian]
- **BEFORE**: `[Phrygian-Thracian sky- and father-god, a mystery-cult deity, identified by the Greeks with Zeus and with Dionysus]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `Phrygian-Thracian sky- and father-god` — suggested target: domain
    - `a mystery-cult deity` — suggested target: domain
    - `identified by the Greeks with Zeus and with Dionysus` — suggested target: domain (narrative — likely DELETE if covered)

## Hermóðr [Norse]
- **BEFORE**: `[son, divine messenger]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `divine messenger` — already in domain

## Shenshu and Yulü [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Kinich Ahau [Maya]
- **BEFORE**: `[the Maya sun-god, patron of kingship, sometimes the solar aspect of Itzamna, cognate of the Aztec Tonatiuh]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the Maya sun-god` — suggested target: domain
    - `patron of kingship` — suggested target: domain
    - `sometimes the solar aspect of Itzamna` — suggested target: identification
    - `cognate of the Aztec Tonatiuh` — suggested target: domain (narrative — likely DELETE if covered)

## Garuda [Hindu]
- **BEFORE**: `[son of Kaśyapa and Vinatā, enemy of his serpent-cousins, mount of Viṣṇu, king of birds]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `son of Kaśyapa and Vinatā` — → "son" + edge candidates [Kaśyapa, Vinatā]
    - `king of birds` — already in domain
- **NEW EDGES proposed**:
    - `child of` → Kaśyapa ❌ no DB node
    - `child of` → Vinatā ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `enemy of his serpent-cousins` — suggested target: domain (narrative — likely DELETE if covered)
    - `mount of Viṣṇu` — suggested target: domain (narrative — likely DELETE if covered)

## Vucub Caquix [Maya]
- **BEFORE**: `[the bird-monster Seven Macaw, the false sun of the age before the true sun, adversary of the Hero Twins]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the bird-monster Seven Macaw` — suggested target: domain or identification
    - `the false sun of the age before the true sun` — suggested target: domain (narrative — likely DELETE if covered)
    - `adversary of the Hero Twins` — suggested target: character_trait

## Yuanshi Tianzun [Chinese]
- **BEFORE**: `[first and highest of the Three Pure Ones, dwells in the Jade Pure heaven (Yuqing)]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `first and highest of the Three Pure Ones` — suggested target: domain (narrative — likely DELETE if covered)
    - `dwells in the Jade Pure heaven (Yuqing)` — suggested target: domain (narrative — likely DELETE if covered)

## Mama [Mesopotamian]
- **BEFORE**: `[mother, creator]`
- **AFTER**: `[mother]`
- **NEEDS MANUAL DECISION**:
    - `creator` — suggested target: domain or identification

## Anshar [Mesopotamian]
- **BEFORE**: `[son, spouse, father]`
- **AFTER**: `[son, spouse, father]`

## Nergal [Mesopotamian]
- **BEFORE**: `[son, brother, husband, king]`
- **AFTER**: `[son, brother, husband]`
- **REMOVED**:
    - `king` — already in domain

## Abraxas [Gnostic]
- **BEFORE**: `[a cosmic ruler-power of the Gnostic systems (especially Basilidian), the ruler of the 365 heavens]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `a cosmic ruler-power of the Gnostic systems (especially Basilidian)` — suggested target: domain (narrative — likely DELETE if covered)
    - `the ruler of the 365 heavens` — suggested target: domain (narrative — likely DELETE if covered)

## Nikkal [Canaanite]
- **BEFORE**: `[wife, daughter]`
- **AFTER**: `[wife, daughter]`

## Thor [Norse]
- **BEFORE**: `[son, husband, father, protector of Asgard]`
- **AFTER**: `[son, husband, father]`
- **NEEDS MANUAL DECISION**:
    - `protector of Asgard` — suggested target: domain (narrative — likely DELETE if covered)

## Marduk [Mesopotamian]
- **BEFORE**: `[son, husband, father, king]`
- **AFTER**: `[son, husband, father]`
- **REMOVED**:
    - `king` — already in domain

## Mictlancihuatl [Aztec]
- **BEFORE**: `[queen of Mictlan, wife of Mictlantecuhtli]`
- **AFTER**: `[wife]`
- **REMOVED**:
    - `wife of Mictlantecuhtli` — → "wife" + edge candidates [Mictlantecuhtli]
- **NEEDS MANUAL DECISION**:
    - `queen of Mictlan` — suggested target: domain

## Shalim [Canaanite]
- **BEFORE**: `[son, twin]`
- **AFTER**: `[son, twin]`

## Shekhinah [Abrahamic]
- **BEFORE**: `[feminine aspect of divinity, bride of Tiferet (Kabbalah), mother of the people of Israel]`
- **AFTER**: `[mother]`
- **REMOVED**:
    - `mother of the people of Israel` — → "mother" + edge candidates [the people of Israel]
- **NEW EDGES proposed**:
    - `parent of` → the people of Israel ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `feminine aspect of divinity` — suggested target: identification
    - `bride of Tiferet (Kabbalah)` — suggested target: domain (narrative — likely DELETE if covered)

## Utnapishtim [Mesopotamian]
- **BEFORE**: `[flood-survivor, wise man]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `flood-survivor` — suggested target: domain or identification
    - `wise man` — suggested target: domain or identification

## Isis [Egyptian]
- **BEFORE**: `[mother, sister, spouse, daughter]`
- **AFTER**: `[mother, sister, spouse, daughter]`

## Penates [Roman]
- **BEFORE**: `[tutelary household spirits, state-cult Penates publici, brought from Troy by Aeneas]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `tutelary household spirits` — suggested target: domain or identification
    - `state-cult Penates publici` — suggested target: domain or identification
    - `brought from Troy by Aeneas` — suggested target: domain (narrative — likely DELETE if covered)

## Groa [Norse]
- **BEFORE**: `[wife of Aurvandill, mother of Svipdagr, seeress]`
- **AFTER**: `[wife, mother]`
- **REMOVED**:
    - `wife of Aurvandill` — → "wife" + edge candidates [Aurvandill]
    - `mother of Svipdagr` — → "mother" + edge candidates [Svipdagr]
    - `seeress` — already in domain
- **NEW EDGES proposed**:
    - `married to` → Aurvandill ❌ no DB node
    - `parent of` → Svipdagr ❌ no DB node

## Jörmungandr [Norse]
- **BEFORE**: `[brother, spouse]`
- **AFTER**: `[brother, spouse]`

## Shennong [Chinese]
- **BEFORE**: `[one of the Three Sovereigns, often identified with the Yan Emperor (Yandi), culture-hero of agriculture and medicine]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `one of the Three Sovereigns` — suggested target: domain
    - `often identified with the Yan Emperor (Yandi)` — suggested target: domain
    - `culture-hero of agriculture and medicine` — suggested target: character_trait

## Mímir [Norse]
- **BEFORE**: `[counselor, wise being]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `counselor` — suggested target: domain or identification
    - `wise being` — suggested target: domain (narrative — likely DELETE if covered)

## Ran [Norse]
- **BEFORE**: `[wife of Ægir, mother of the nine wave-maidens, sea-giantess]`
- **AFTER**: `[wife, mother]`
- **REMOVED**:
    - `wife of Ægir` — → "wife" + edge candidates [Ægir]
    - `mother of the nine wave-maidens` — → "mother" + edge candidates [the nine wave-maidens]
- **NEW EDGES proposed**:
    - `parent of` → the nine wave-maidens ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `sea-giantess` — suggested target: domain or identification

## Troll [Norse]
- **BEFORE**: `[supernatural being (category), folkloric type]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `supernatural being (category)` — suggested target: domain (narrative — likely DELETE if covered)
    - `folkloric type` — suggested target: domain or identification

## Romulus [Roman]
- **BEFORE**: `[son of Mars and Rhea Silvia (Vestal), twin of Remus, grand-nephew of Amulius, grandson of Numitor, first king of Rome, deified as Quirinus]`
- **AFTER**: `[son, twin]`
- **REMOVED**:
    - `son of Mars and Rhea Silvia (Vestal)` — → "son" + edge candidates [Mars, Rhea Silvia]
    - `twin of Remus` — → "twin" + edge candidates [Remus]
- **NEW EDGES proposed**:
    - `child of` → **Mars** (id 7445) ✅
    - `child of` → Rhea Silvia ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `grand-nephew of Amulius` — suggested target: domain (narrative — likely DELETE if covered)
    - `grandson of Numitor` — suggested target: domain (narrative — likely DELETE if covered)
    - `first king of Rome` — suggested target: domain
    - `deified as Quirinus` — suggested target: domain (narrative — likely DELETE if covered)

## Raphael [Abrahamic]
- **BEFORE**: `[archangel, divine messenger, one of the seven who stand before God]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `archangel` — suggested target: domain or identification
    - `divine messenger` — suggested target: domain (narrative — likely DELETE if covered)
    - `one of the seven who stand before God` — suggested target: domain (narrative — likely DELETE if covered)

## Frigg [Norse]
- **BEFORE**: `[queen, wife of Odin, mother of Baldr and Hǫðr, foster-mother of various Aesir]`
- **AFTER**: `[wife, mother]`
- **REMOVED**:
    - `queen` — already in character_trait
    - `wife of Odin` — → "wife" + edge candidates [Odin]
    - `mother of Baldr and Hǫðr` — → "mother" + edge candidates [Baldr, Hǫðr]
- **NEW EDGES proposed**:
    - `parent of` → Hǫðr ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `foster-mother of various Aesir` — suggested target: domain (narrative — likely DELETE if covered)

## Shuqamuna and Shumaliya [Mesopotamian]
- **BEFORE**: `[paired deities, divine couple of the Kassite dynasty]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `paired deities` — suggested target: domain or identification
    - `divine couple of the Kassite dynasty` — suggested target: domain (narrative — likely DELETE if covered)

## Shapash [Canaanite]
- **BEFORE**: `[daughter, divine messenger, solar deity]`
- **AFTER**: `[daughter]`
- **NEEDS MANUAL DECISION**:
    - `divine messenger` — suggested target: domain (narrative — likely DELETE if covered)
    - `solar deity` — suggested target: domain

## Cian [Celtic]
- **BEFORE**: `[son, father, spouse]`
- **AFTER**: `[son, father, spouse]`

## Astarte [Canaanite]
- **BEFORE**: `[daughter, consort, queen]`
- **AFTER**: `[daughter, consort]`
- **NEEDS MANUAL DECISION**:
    - `queen` — suggested target: domain

## Amaterasu [Shinto]
- **BEFORE**: `[mother, sister, daughter]`
- **AFTER**: `[mother, sister, daughter]`

## Orestes [Greek]
- **BEFORE**: `[brother, spouse]`
- **AFTER**: `[brother, spouse]`

## Ardhanarishvara [Hindu]
- **BEFORE**: `[Śiva-Pārvatī united icon, cosmic androgyne]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `Śiva-Pārvatī united icon` — suggested target: domain or identification
    - `cosmic androgyne` — suggested target: domain or identification

## Ethniu [Celtic]
- **BEFORE**: `[daughter, mother, spouse]`
- **AFTER**: `[daughter, mother, spouse]`

## Dactyls [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Shi Gandang [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Ninlil [Mesopotamian]
- **BEFORE**: `[wife, mother]`
- **AFTER**: `[wife, mother]`

## Ereshkigal [Mesopotamian]
- **BEFORE**: `[sister, queen, wife]`
- **AFTER**: `[sister, wife]`
- **NEEDS MANUAL DECISION**:
    - `queen` — suggested target: domain

## Hariti [Buddhist]
- **BEFORE**: `[protector-goddess of children and childbirth, a converted child-devouring yakṣiṇī, East Asian form: Kishimojin]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `protector-goddess of children and childbirth` — suggested target: domain (narrative — likely DELETE if covered)
    - `a converted child-devouring yakṣiṇī` — suggested target: domain (narrative — likely DELETE if covered)
    - `East Asian form: Kishimojin` — suggested target: domain (narrative — likely DELETE if covered)

## Holy Spirit [Abrahamic]
- **BEFORE**: `[third person of the Trinity]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `third person of the Trinity` — suggested target: domain (narrative — likely DELETE if covered)

## Hun-Came [Maya]
- **BEFORE**: `[one of the two paramount lords of Xibalba, co-ruler with Vucub-Came, adversary of the Hero Twins]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `one of the two paramount lords of Xibalba` — suggested target: domain
    - `co-ruler with Vucub-Came` — suggested target: domain (narrative — likely DELETE if covered)
    - `adversary of the Hero Twins` — suggested target: character_trait

## Attis [Phrygian]
- **BEFORE**: `[the youthful consort of Cybele, born of (or bound to) Agdistis, the dying-and-mourned vegetation-figure of the Mother-cult]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the youthful consort of Cybele` — suggested target: character_trait
    - `born of (or bound to) Agdistis` — suggested target: domain (narrative — likely DELETE if covered)
    - `the dying-and-mourned vegetation-figure of the Mother-cult` — suggested target: domain (narrative — likely DELETE if covered)

## Huracan [Maya]
- **BEFORE**: `[the Heart of Sky, storm- and creator-god of the K'iche' Maya, a trinity-in-one (the three Thunderbolts)]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the Heart of Sky` — suggested target: domain (narrative — likely DELETE if covered)
    - `storm- and creator-god of the K'iche' Maya` — suggested target: domain (narrative — likely DELETE if covered)
    - `a trinity-in-one (the three Thunderbolts)` — suggested target: domain (narrative — likely DELETE if covered)

## Takemikazuchi [Shinto]
- **BEFORE**: `[emerged from Izanagi's sword Ame-no-Ohabari, partner-warrior of Futsunushi, kami of Kashima Jingū]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `emerged from Izanagi's sword Ame-no-Ohabari` — suggested target: domain (narrative — likely DELETE if covered)
    - `partner-warrior of Futsunushi` — suggested target: character_trait
    - `kami of Kashima Jingū` — suggested target: domain (narrative — likely DELETE if covered)

## Bragi [Norse]
- **BEFORE**: `[husband (of Iðunn), god of poetry]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `husband (of Iðunn)` — suggested target: character_trait
    - `god of poetry` — suggested target: domain (narrative — likely DELETE if covered)

## Rangda [Balinese]
- **BEFORE**: `[the demon-queen of Balinese myth, leader of the leyak, the eternal adversary of Barong]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the demon-queen of Balinese myth` — suggested target: domain
    - `leader of the leyak` — suggested target: domain (narrative — likely DELETE if covered)
    - `the eternal adversary of Barong` — suggested target: domain (narrative — likely DELETE if covered)

## The Monad [Gnostic]
- **BEFORE**: `[the supreme transcendent Godhead of the Gnostic systems, the ultimate source of the Pleroma of aeons]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the supreme transcendent Godhead of the Gnostic systems` — suggested target: domain (narrative — likely DELETE if covered)
    - `the ultimate source of the Pleroma of aeons` — suggested target: domain (narrative — likely DELETE if covered)

## Lakshmi [Hindu]
- **BEFORE**: `[wife of Viṣṇu, mother of Kāma, one of the Tridevī]`
- **AFTER**: `[wife, mother]`
- **REMOVED**:
    - `wife of Viṣṇu` — → "wife" + edge candidates [Viṣṇu]
    - `mother of Kāma` — → "mother" + edge candidates [Kāma]
- **NEW EDGES proposed**:
    - `married to` → Viṣṇu ❌ no DB node
    - `parent of` → Kāma ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `one of the Tridevī` — suggested target: domain (narrative — likely DELETE if covered)

## Sandalphon [Abrahamic]
- **BEFORE**: `[archangel, twin/companion of Metatron, possibly the ascended prophet Elijah]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `archangel` — suggested target: domain or identification
    - `twin/companion of Metatron` — suggested target: domain (narrative — likely DELETE if covered)
    - `possibly the ascended prophet Elijah` — suggested target: domain or identification

## Shunfeng'er [Chinese]
- **BEFORE**: `[sister, spouse]`
- **AFTER**: `[sister, spouse]`

## Hestia [Greek]
- **BEFORE**: `[eldest daughter of Cronus and Rhea, sister of Zeus, Hera, Poseidon, Hades, Demeter, one of the three virgin goddesses (with Athena and Artemis), sometimes the twelfth Olympian (sometimes replaced by Dionysus)]`
- **AFTER**: `[sister]`
- **REMOVED**:
    - `sister of Zeus, Hera, Poseidon, Hades, Demeter` — → "sister" + edge candidates [Zeus, Hera, Poseidon, Hades, Demeter]
- **NEEDS MANUAL DECISION**:
    - `eldest daughter of Cronus and Rhea` — suggested target: domain (narrative — likely DELETE if covered)
    - `one of the three virgin goddesses (with Athena and Artemis)` — suggested target: domain (narrative — likely DELETE if covered)
    - `sometimes the twelfth Olympian (sometimes replaced by Dionysus)` — suggested target: domain (narrative — likely DELETE if covered)

## Sol [Roman]
- **BEFORE**: `[identified with Helios, indigenous Italic Sol Indiges (pre-Greek), Sol Invictus from 274 CE]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `identified with Helios` — suggested target: domain (narrative — likely DELETE if covered)
    - `indigenous Italic Sol Indiges (pre-Greek)` — suggested target: domain (narrative — likely DELETE if covered)
    - `Sol Invictus from 274 CE` — suggested target: domain (narrative — likely DELETE if covered)

## He Xiangu [Chinese]
- **BEFORE**: `[the (usually only) female of the Eight Immortals, patroness of unmarried women]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the (usually only) female of the Eight Immortals` — suggested target: domain (narrative — likely DELETE if covered)
    - `patroness of unmarried women` — suggested target: domain (narrative — likely DELETE if covered)

## Meng Po [Chinese]
- **BEFORE**: `[the Lady of Forgetfulness, underworld deity at the threshold of reincarnation]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the Lady of Forgetfulness` — suggested target: domain (narrative — likely DELETE if covered)
    - `underworld deity at the threshold of reincarnation` — suggested target: domain

## Nebethetepet [Egyptian]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Nefertem [Egyptian]
- **BEFORE**: `[son of Ptah and Sekhmet, Memphite triad member, god of the blue lotus]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `son of Ptah and Sekhmet` — → "son" + edge candidates [Ptah, Sekhmet]
- **NEW EDGES proposed**:
    - `child of` → **Ptah** (id 6906) ✅
    - `child of` → **Sekhmet** (id 6302) ✅
- **NEEDS MANUAL DECISION**:
    - `Memphite triad member` — suggested target: domain or identification
    - `god of the blue lotus` — suggested target: domain (narrative — likely DELETE if covered)

## Xiyue Dadi [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Bu Luotuo [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Vallonia [Roman]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## King Father of the East [Chinese]
- **BEFORE**: `[father, spouse]`
- **AFTER**: `[father, spouse]`

## Marshal Tianpeng [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Sun Wukong [Chinese]
- **BEFORE**: `[the Monkey King, born from a stone egg, foremost disciple of Xuanzang, attained Buddhahood as the Victorious Fighting Buddha]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the Monkey King` — suggested target: domain
    - `born from a stone egg` — suggested target: domain (narrative — likely DELETE if covered)
    - `foremost disciple of Xuanzang` — suggested target: domain (narrative — likely DELETE if covered)
    - `attained Buddhahood as the Victorious Fighting Buddha` — suggested target: identification

## Gelos [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Caishen [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Poh Seng Tai Tay [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Kratos [Greek]
- **BEFORE**: `[father, spouse]`
- **AFTER**: `[father, spouse]`

## Cangdi [Chinese]
- **BEFORE**: `[mother, spouse]`
- **AFTER**: `[mother, spouse]`

## Ma Chao [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Hyperion [Greek]
- **BEFORE**: `[father, spouse]`
- **AFTER**: `[father, spouse]`

## Jesus [Abrahamic]
- **BEFORE**: `[son, brother, rabbi, messiah, only-begotten of the Father (in Christian theology), prophet (in Islamic theology)]`
- **AFTER**: `[son, brother]`
- **NEEDS MANUAL DECISION**:
    - `rabbi` — suggested target: domain or identification
    - `messiah` — suggested target: identification
    - `only-begotten of the Father (in Christian theology)` — suggested target: identification
    - `prophet (in Islamic theology)` — suggested target: domain (narrative — likely DELETE if covered)

## Sanxing [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Azrael [Abrahamic]
- **BEFORE**: `[angel of death]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `angel of death` — suggested target: domain (narrative — likely DELETE if covered)

## Hou Yi [Chinese]
- **BEFORE**: `[the divine archer, husband of Chang'e, shooter of the nine suns]`
- **AFTER**: `[husband]`
- **REMOVED**:
    - `husband of Chang'e` — → "husband" + edge candidates [Chang'e]
- **NEEDS MANUAL DECISION**:
    - `the divine archer` — suggested target: domain (narrative — likely DELETE if covered)
    - `shooter of the nine suns` — suggested target: domain (narrative — likely DELETE if covered)

## Ptocheia [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Wenchang Wang [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Metatron [Abrahamic]
- **BEFORE**: `[heavenly scribe, prince of the divine presence, exalted patriarch (transformed Enoch)]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `heavenly scribe` — already in domain
    - `prince of the divine presence` — already in domain (phrase "divine presence")
- **NEEDS MANUAL DECISION**:
    - `exalted patriarch (transformed Enoch)` — suggested target: domain or identification

## Half-elf [Norse]
- **BEFORE**: `[supernatural being (category), folkloric type]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `supernatural being (category)` — suggested target: domain (narrative — likely DELETE if covered)
    - `folkloric type` — suggested target: domain or identification

## Abraham [Abrahamic]
- **BEFORE**: `[patriarch, father, husband, grandfather]`
- **AFTER**: `[father, husband, grandfather]`
- **NEEDS MANUAL DECISION**:
    - `patriarch` — suggested target: domain or identification

## Hephaestus [Greek]
- **BEFORE**: `[son of Hera (and Zeus in some accounts, parthenogenetic in others), husband of Aphrodite (in Homer) or Aglaia (in Hesiod), only physically-imperfect Olympian (lame)]`
- **AFTER**: `[son, husband]`
- **REMOVED**:
    - `son of Hera (and Zeus in some accounts, parthenogenetic in others)` — → "son" + edge candidates [Hera]
    - `husband of Aphrodite (in Homer) or Aglaia (in Hesiod)` — → "husband" + edge candidates [Aphrodite  or Aglaia]
- **NEW EDGES proposed**:
    - `child of` → **Hera** (id 6246) ✅
    - `married to` → Aphrodite  or Aglaia ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `only physically-imperfect Olympian (lame)` — suggested target: domain or identification

## Gaia [Greek]
- **BEFORE**: `[primordial earth-goddess, mother (with Ouranos) of the Titans, Cyclopes, Hekatonkheires, mother of Typhon (with Tartarus), grandmother of the Olympians]`
- **AFTER**: `[mother, grandmother]`
- **REMOVED**:
    - `mother of Typhon (with Tartarus)` — → "mother" + edge candidates [Typhon]
    - `grandmother of the Olympians` — → "grandmother" + edge candidates [the Olympians]
- **NEW EDGES proposed**:
    - `ancestor of` → the Olympians ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `primordial earth-goddess` — suggested target: domain
    - `mother (with Ouranos) of the Titans, Cyclopes, Hekatonkheires` — suggested target: domain (narrative — likely DELETE if covered)

## Horme [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Morrigan [Celtic]
- **BEFORE**: `[daughter, sister, spouse]`
- **AFTER**: `[daughter, sister, spouse]`

## Pun Tao Kong [Chinese]
- **BEFORE**: `[mother, spouse]`
- **AFTER**: `[mother, spouse]`

## San Yisheng [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Puti Zushi [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Silenus [Greek]
- **BEFORE**: `[father, spouse]`
- **AFTER**: `[father, spouse]`

## Shen Gongbao [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Kourotrophos [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Chitou Furen [Chinese]
- **BEFORE**: `[mother, spouse]`
- **AFTER**: `[mother, spouse]`

## Morpheus [Greek]
- **BEFORE**: `[father, spouse]`
- **AFTER**: `[father, spouse]`

## Diana [Roman]
- **BEFORE**: `[identified with Artemis, daughter of Jupiter and Latona, twin of Apollo, virgin goddess]`
- **AFTER**: `[daughter, twin]`
- **REMOVED**:
    - `daughter of Jupiter and Latona` — → "daughter" + edge candidates [Jupiter, Latona]
    - `twin of Apollo` — → "twin" + edge candidates [Apollo]
    - `virgin goddess` — already in symbolism
- **NEW EDGES proposed**:
    - `child of` → **Jupiter** (id 7444) ✅
    - `child of` → Latona ❌ no DB node
    - `sibling of` → **Apollo** (id 7274) ✅
- **NEEDS MANUAL DECISION**:
    - `identified with Artemis` — suggested target: domain (narrative — likely DELETE if covered)

## Juno [Roman]
- **BEFORE**: `[daughter of Saturn and Ops, sister-wife of Jupiter, sister of Neptune, Pluto, Ceres, Vesta, mother of Mars, Vulcan, Juventas, one of the Capitoline Triad (Jupiter-Juno-Minerva)]`
- **AFTER**: `[daughter, sister, mother]`
- **REMOVED**:
    - `daughter of Saturn and Ops` — → "daughter" + edge candidates [Saturn, Ops]
    - `sister of Neptune, Pluto, Ceres, Vesta` — → "sister" + edge candidates [Neptune, Pluto, Ceres, Vesta]
    - `mother of Mars, Vulcan, Juventas` — → "mother" + edge candidates [Mars, Vulcan, Juventas]
- **NEW EDGES proposed**:
    - `child of` → **Saturn** (id 7450) ✅
    - `child of` → **Ops** (id 6653) ✅
    - `sibling of` → **Ceres** (id 6773) ✅
    - `sibling of` → **Vesta** (id 7269) ✅
    - `parent of` → **Juventas** (id 6986) ✅
- **NEEDS MANUAL DECISION**:
    - `sister-wife of Jupiter` — suggested target: character_trait
    - `one of the Capitoline Triad (Jupiter-Juno-Minerva)` — suggested target: domain (narrative — likely DELETE if covered)

## Minerva [Roman]
- **BEFORE**: `[daughter of Jupiter (in Roman tradition, often without the Metis swallowing narrative), one of the Capitoline Triad, virgin goddess]`
- **AFTER**: `[daughter]`
- **REMOVED**:
    - `daughter of Jupiter (in Roman tradition, often without the Metis swallowing narrative)` — → "daughter" + edge candidates [Jupiter]
- **NEW EDGES proposed**:
    - `child of` → **Jupiter** (id 7444) ✅
- **NEEDS MANUAL DECISION**:
    - `one of the Capitoline Triad` — suggested target: domain (narrative — likely DELETE if covered)
    - `virgin goddess` — suggested target: domain (narrative — likely DELETE if covered)

## Týr [Norse]
- **BEFORE**: `[warrior-god, god of justice and oaths]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `warrior-god` — suggested target: domain
    - `god of justice and oaths` — suggested target: domain (narrative — likely DELETE if covered)

## Charis [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Pang Juan [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Ops [Roman]
- **BEFORE**: `[identified with Rhea, wife-sister of Saturn, mother of Jupiter, Juno, Neptune, Pluto, Ceres, Vesta, indigenous Italic before the Rhea-interpretatio]`
- **AFTER**: `[mother]`
- **REMOVED**:
    - `mother of Jupiter, Juno, Neptune, Pluto, Ceres, Vesta` — → "mother" + edge candidates [Jupiter, Juno, Neptune, Pluto, Ceres, Vesta]
- **NEW EDGES proposed**:
    - `parent of` → **Juno** (id 6555) ✅
    - `parent of` → **Ceres** (id 6773) ✅
    - `parent of` → **Vesta** (id 7269) ✅
- **NEEDS MANUAL DECISION**:
    - `identified with Rhea` — suggested target: domain (narrative — likely DELETE if covered)
    - `wife-sister of Saturn` — suggested target: character_trait
    - `indigenous Italic before the Rhea-interpretatio` — suggested target: domain (narrative — likely DELETE if covered)

## Atlas [Greek]
- **BEFORE**: `[father, spouse]`
- **AFTER**: `[father, spouse]`

## Beasts of battle [Norse]
- **BEFORE**: `[supernatural being (category), folkloric type]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `supernatural being (category)` — suggested target: domain (narrative — likely DELETE if covered)
    - `folkloric type` — suggested target: domain or identification

## Guang Chengzi [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Yaksha [Hindu]
- **BEFORE**: `[nature-spirits, attendants of Kubera]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `nature-spirits` — suggested target: domain or identification
    - `attendants of Kubera` — suggested target: domain (narrative — likely DELETE if covered)

## Aphrodite [Greek]
- **BEFORE**: `[born from sea-foam; pre-Olympian generation in Hesiodic genealogy (an alternative tradition makes her daughter of Zeus and Dione), wife of Hephaestus, lover of Ares, mother of Eros, Anteros, Phobos, Deimos, Harmonia (by Ares); Aeneas (by Anchises); Hermaphroditus (by Hermes)]`
- **AFTER**: `[wife, mother]`
- **REMOVED**:
    - `wife of Hephaestus` — → "wife" + edge candidates [Hephaestus]
    - `mother of Eros, Anteros, Phobos, Deimos, Harmonia (by Ares); Aeneas (by Anchises); Hermaphroditus (by Hermes)` — → "mother" + edge candidates [Eros, Anteros, Phobos, Deimos, Harmonia, Aeneas, Hermaphroditus]
- **NEW EDGES proposed**:
    - `parent of` → Anteros ❌ no DB node
    - `parent of` → **Phobos** (id 6883) ✅
    - `parent of` → **Deimos** (id 6792) ✅
    - `parent of` → **Harmonia** (id 6177) ✅
    - `parent of` → **Aeneas** (id 6400) ✅
    - `parent of` → Hermaphroditus ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `born from sea-foam; pre-Olympian generation in Hesiodic genealogy (an alternative tradition makes her daughter of Zeus and Dione)` — suggested target: domain (narrative — likely DELETE if covered)
    - `lover of Ares` — suggested target: domain (narrative — likely DELETE if covered)

## Diana of Ephesus [Greek]
- **BEFORE**: `[mother, spouse]`
- **AFTER**: `[mother, spouse]`

## Maya [Hindu]
- **BEFORE**: `[cosmic principle, goddess]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `cosmic principle` — suggested target: domain (narrative — likely DELETE if covered)
    - `goddess` — suggested target: domain or identification

## Hecate [Greek]
- **BEFORE**: `[daughter of Perses and Asteria (Titanic generation), goddess of crossroads, magic, ghosts, threefold-aspect deity in late tradition]`
- **AFTER**: `[daughter]`
- **REMOVED**:
    - `daughter of Perses and Asteria (Titanic generation)` — → "daughter" + edge candidates [Perses, Asteria]
- **NEW EDGES proposed**:
    - `child of` → **Perses** (id 6724) ✅
    - `child of` → **Asteria** (id 6621) ✅
- **NEEDS MANUAL DECISION**:
    - `goddess of crossroads, magic, ghosts` — suggested target: domain (narrative — likely DELETE if covered)
    - `threefold-aspect deity in late tradition` — suggested target: domain

## Hel [Norse]
- **BEFORE**: `[queen of the underworld, daughter, sister]`
- **AFTER**: `[daughter, sister]`
- **NEEDS MANUAL DECISION**:
    - `queen of the underworld` — suggested target: domain

## Maat [Egyptian]
- **BEFORE**: `[daughter of Ra, cosmic principle, consort of Thoth (in some traditions)]`
- **AFTER**: `[daughter, consort]`
- **REMOVED**:
    - `daughter of Ra` — → "daughter" + edge candidates [Ra]
    - `consort of Thoth (in some traditions)` — → "consort" + edge candidates [Thoth]
- **NEW EDGES proposed**:
    - `child of` → **Ra** (id 6119) ✅
    - `married to` → **Thoth** (id 6204) ✅
- **NEEDS MANUAL DECISION**:
    - `cosmic principle` — suggested target: domain (narrative — likely DELETE if covered)

## Ceres [Roman]
- **BEFORE**: `[identified with Demeter, daughter of Saturn and Ops, mother of Proserpina, plebeian patron-goddess of the Aventine Triad (with Liber and Libera)]`
- **AFTER**: `[daughter, mother]`
- **REMOVED**:
    - `daughter of Saturn and Ops` — → "daughter" + edge candidates [Saturn, Ops]
    - `mother of Proserpina` — → "mother" + edge candidates [Proserpina]
- **NEW EDGES proposed**:
    - `child of` → **Saturn** (id 7450) ✅
    - `child of` → **Ops** (id 6653) ✅
    - `parent of` → **Proserpina** (id 7257) ✅
- **NEEDS MANUAL DECISION**:
    - `identified with Demeter` — suggested target: domain (narrative — likely DELETE if covered)
    - `plebeian patron-goddess of the Aventine Triad (with Liber and Libera)` — suggested target: domain (narrative — likely DELETE if covered)

## Shakti [Hindu]
- **BEFORE**: `[cosmic-feminine principle, consort of every male god]`
- **AFTER**: `[consort]`
- **REMOVED**:
    - `consort of every male god` — → "consort" + edge candidates [every male god]
- **NEW EDGES proposed**:
    - `married to` → every male god ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `cosmic-feminine principle` — suggested target: domain (narrative — likely DELETE if covered)

## Rhea [Greek]
- **BEFORE**: `[daughter of Ouranos and Gaia, sister-wife of Cronus, mother of Hestia, Demeter, Hera, Hades, Poseidon, Zeus]`
- **AFTER**: `[daughter, mother]`
- **REMOVED**:
    - `daughter of Ouranos and Gaia` — → "daughter" + edge candidates [Ouranos, Gaia]
    - `mother of Hestia, Demeter, Hera, Hades, Poseidon, Zeus` — → "mother" + edge candidates [Hestia, Demeter, Hera, Hades, Poseidon, Zeus]
- **NEW EDGES proposed**:
    - `child of` → **Ouranos** (id 7426) ✅
    - `child of` → **Gaia** (id 6219) ✅
    - `parent of` → **Hera** (id 6246) ✅
- **NEEDS MANUAL DECISION**:
    - `sister-wife of Cronus` — suggested target: character_trait

## Nepr [Norse]
- **BEFORE**: `[father of Nanna]`
- **AFTER**: `[father]`
- **REMOVED**:
    - `father of Nanna` — → "father" + edge candidates [Nanna]
- **NEW EDGES proposed**:
    - `parent of` → **Nanna** (id 7302) ✅

## Aulis [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Phalanthus [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Hu Ye [Chinese]
- **BEFORE**: `[mother, spouse]`
- **AFTER**: `[mother, spouse]`

## Jinjia Yinsuo [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Meili [Norse]
- **BEFORE**: `[brother, spouse]`
- **AFTER**: `[brother, spouse]`

## Tianlong [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Yuding Zhenren [Chinese]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## The Dying God [Cross-cultural]
- **BEFORE**: `[son]`
- **AFTER**: `[son]`

## Phosphorus [Greek]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Theban Triad [Egyptian]
- **BEFORE**: `[spouse]`
- **AFTER**: `[spouse]`

## Holy Mother the Original Lord [Chinese]
- **BEFORE**: `[mother, spouse]`
- **AFTER**: `[mother, spouse]`

## Hachiman [Shinto]
- **BEFORE**: `[war-kami, identified with Emperor Ōjin, protector of the Minamoto clan]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `war-kami` — suggested target: domain or identification
    - `identified with Emperor Ōjin` — suggested target: domain
    - `protector of the Minamoto clan` — suggested target: domain (narrative — likely DELETE if covered)

## Heimdall [Norse]
- **BEFORE**: `[watchman of the gods, father (as Ríg) of the three social classes, son of nine mothers]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `son of nine mothers` — → "son" + edge candidates [nine mothers]
- **NEW EDGES proposed**:
    - `child of` → nine mothers ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `watchman of the gods` — suggested target: domain (narrative — likely DELETE if covered)
    - `father (as Ríg) of the three social classes` — suggested target: domain (narrative — likely DELETE if covered)

## Ullr [Norse]
- **BEFORE**: `[stepson of Thor, archer-god]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `stepson of Thor` — suggested target: domain (narrative — likely DELETE if covered)
    - `archer-god` — suggested target: domain

## Höðr [Norse]
- **BEFORE**: `[son, brother, victim]`
- **AFTER**: `[son, brother]`
- **REMOVED**:
    - `victim` — already in character_trait

## Víðarr [Norse]
- **BEFORE**: `[son, avenger, survivor]`
- **AFTER**: `[son]`
- **NEEDS MANUAL DECISION**:
    - `avenger` — suggested target: domain or identification
    - `survivor` — suggested target: domain or identification

## Hafgufa [Norse]
- **BEFORE**: `[supernatural being (category), folkloric type]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `supernatural being (category)` — suggested target: domain (narrative — likely DELETE if covered)
    - `folkloric type` — suggested target: domain or identification

## Vili and Vé [Norse]
- **BEFORE**: `[brothers of Odin, sons of Borr and Bestla, co-creators]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `brothers of Odin` — suggested target: domain (narrative — likely DELETE if covered)
    - `sons of Borr and Bestla` — suggested target: domain (narrative — likely DELETE if covered)
    - `co-creators` — suggested target: domain or identification

## Hœnir [Norse]
- **BEFORE**: `[creator, Vanir-hostage, companion of Odin]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `creator` — suggested target: domain or identification
    - `Vanir-hostage` — suggested target: domain or identification
    - `companion of Odin` — suggested target: domain (narrative — likely DELETE if covered)

## Ægir [Norse]
- **BEFORE**: `[sea-giant, host, husband, father of wave-maidens]`
- **AFTER**: `[husband, father]`
- **REMOVED**:
    - `host` — already in symbolism
    - `father of wave-maidens` — → "father" + edge candidates [wave-maidens]
- **NEW EDGES proposed**:
    - `parent of` → wave-maidens ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `sea-giant` — suggested target: domain or identification

## Draugr [Norse]
- **BEFORE**: `[supernatural being (category), folkloric type]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `supernatural being (category)` — suggested target: domain (narrative — likely DELETE if covered)
    - `folkloric type` — suggested target: domain or identification

## Nidhogg [Norse]
- **BEFORE**: `[cosmic-tree gnawer, corpse-feeder]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `cosmic-tree gnawer` — suggested target: domain or identification
    - `corpse-feeder` — suggested target: domain or identification

## Lóðurr [Norse]
- **BEFORE**: `[creator]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `creator` — suggested target: domain or identification

## Fylgja [Norse]
- **BEFORE**: `[supernatural being (category), folkloric type]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `supernatural being (category)` — suggested target: domain (narrative — likely DELETE if covered)
    - `folkloric type` — suggested target: domain or identification

## Hamingja [Norse]
- **BEFORE**: `[supernatural being (category), folkloric type]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `supernatural being (category)` — suggested target: domain (narrative — likely DELETE if covered)
    - `folkloric type` — suggested target: domain or identification

## Landvættir [Norse]
- **BEFORE**: `[supernatural being (category), folkloric type]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `supernatural being (category)` — suggested target: domain (narrative — likely DELETE if covered)
    - `folkloric type` — suggested target: domain or identification

## Vörðr [Norse]
- **BEFORE**: `[supernatural being (category), folkloric type]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `supernatural being (category)` — suggested target: domain (narrative — likely DELETE if covered)
    - `folkloric type` — suggested target: domain or identification

## Nixie [Norse]
- **BEFORE**: `[supernatural being (category), folkloric type]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `supernatural being (category)` — suggested target: domain (narrative — likely DELETE if covered)
    - `folkloric type` — suggested target: domain or identification

## Lindworm [Norse]
- **BEFORE**: `[supernatural being (category), folkloric type]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `supernatural being (category)` — suggested target: domain (narrative — likely DELETE if covered)
    - `folkloric type` — suggested target: domain or identification

## Selkolla [Norse]
- **BEFORE**: `[supernatural being (category), folkloric type]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `supernatural being (category)` — suggested target: domain (narrative — likely DELETE if covered)
    - `folkloric type` — suggested target: domain or identification

## Óðr [Norse]
- **BEFORE**: `[husband of Freyja, father of Hnoss and Gersemi]`
- **AFTER**: `[husband, father]`
- **REMOVED**:
    - `husband of Freyja` — → "husband" + edge candidates [Freyja]
    - `father of Hnoss and Gersemi` — → "father" + edge candidates [Hnoss, Gersemi]
- **NEW EDGES proposed**:
    - `parent of` → Hnoss ❌ no DB node
    - `parent of` → Gersemi ❌ no DB node

## Germanic dragon [Norse]
- **BEFORE**: `[supernatural being (category), folkloric type]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `supernatural being (category)` — suggested target: domain (narrative — likely DELETE if covered)
    - `folkloric type` — suggested target: domain or identification

## Lyngbakr [Norse]
- **BEFORE**: `[supernatural being (category), folkloric type]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `supernatural being (category)` — suggested target: domain (narrative — likely DELETE if covered)
    - `folkloric type` — suggested target: domain or identification

## Ayudhapurusha [Hindu]
- **BEFORE**: `[personified divine weapons]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `personified divine weapons` — already in domain (phrase "divine weapons")

## Vahana [Hindu]
- **BEFORE**: `[category — collective entry for divine mounts]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `category — collective entry for divine mounts` — suggested target: domain (narrative — likely DELETE if covered)

## Radha Krishna [Hindu]
- **BEFORE**: `[joint-icon of Kṛṣṇa and Rādhā, divine beloved-pair]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `joint-icon of Kṛṣṇa and Rādhā` — suggested target: domain (narrative — likely DELETE if covered)
    - `divine beloved-pair` — suggested target: domain (narrative — likely DELETE if covered)

## Shmashana Adhipati [Hindu]
- **BEFORE**: `[lord of the cremation-ground]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `lord of the cremation-ground` — suggested target: domain

## Vajreshwari (Vajreśvarī) [Hindu]
- **BEFORE**: `[Śakti-form, tantric goddess]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `tantric goddess` — already in symbolism
- **NEEDS MANUAL DECISION**:
    - `Śakti-form` — suggested target: domain or identification

## Vasu [Hindu]
- **BEFORE**: `[the eight Vasus]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `the eight Vasus` — already in domain (phrase "eight vasus")

## Lugh [Celtic]
- **BEFORE**: `[son, father]`
- **AFTER**: `[son, father]`

## Badb [Celtic]
- **BEFORE**: `[daughter, sister]`
- **AFTER**: `[daughter, sister]`

## Nemain [Celtic]
- **BEFORE**: `[daughter, sister]`
- **AFTER**: `[daughter, sister]`

## Bres [Celtic]
- **BEFORE**: `[spouse, father]`
- **AFTER**: `[spouse, father]`

## Dagon [Canaanite]
- **BEFORE**: `[father, grain-god]`
- **AFTER**: `[father]`
- **NEEDS MANUAL DECISION**:
    - `grain-god` — suggested target: domain

## Cú Chulainn [Celtic]
- **BEFORE**: `[son]`
- **AFTER**: `[son]`

## Horon [Canaanite]
- **BEFORE**: `[cursing god, healing god]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `cursing god` — suggested target: domain (narrative — likely DELETE if covered)
    - `healing god` — suggested target: domain (narrative — likely DELETE if covered)

## Ancestors of Enlil [Mesopotamian]
- **BEFORE**: `[ancestors, divine lineage]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `ancestors` — already in symbolism
    - `divine lineage` — already in domain

## Apkallu [Mesopotamian]
- **BEFORE**: `[sage, culture-bearer]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `sage` — already in character_trait
- **NEEDS MANUAL DECISION**:
    - `culture-bearer` — suggested target: domain or identification

## Amitabha [Buddhist]
- **BEFORE**: `[the Buddha of Infinite Light, presiding Buddha of the Western Pure Land, spiritual father of Avalokiteśvara]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `the Buddha of Infinite Light` — already in symbolism (phrase "infinite light")
    - `presiding Buddha of the Western Pure Land` — already in domain (phrase "pure land")
- **NEEDS MANUAL DECISION**:
    - `spiritual father of Avalokiteśvara` — suggested target: domain (narrative — likely DELETE if covered)

## Mrtyu [Hindu]
- **BEFORE**: `[cosmic principle, related to Yama and Kāla]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `cosmic principle` — suggested target: domain (narrative — likely DELETE if covered)
    - `related to Yama and Kāla` — suggested target: domain or identification

## Marmennill [Norse]
- **BEFORE**: `[supernatural being (category), folkloric type]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `supernatural being (category)` — suggested target: domain (narrative — likely DELETE if covered)
    - `folkloric type` — suggested target: domain or identification

## Proserpina [Roman]
- **BEFORE**: `[identified with Persephone, daughter of Ceres and Jupiter, wife of Pluto]`
- **AFTER**: `[daughter, wife]`
- **REMOVED**:
    - `daughter of Ceres and Jupiter` — → "daughter" + edge candidates [Ceres, Jupiter]
    - `wife of Pluto` — → "wife" + edge candidates [Pluto]
- **NEW EDGES proposed**:
    - `child of` → **Ceres** (id 6773) ✅
    - `child of` → **Jupiter** (id 7444) ✅
- **NEEDS MANUAL DECISION**:
    - `identified with Persephone` — suggested target: domain (narrative — likely DELETE if covered)

## Despoina [Greek]
- **BEFORE**: `[mother, sister, spouse]`
- **AFTER**: `[mother, sister, spouse]`

## Inari Ōkami [Shinto]
- **BEFORE**: `[rice and harvest kami, patron of merchants and craftsmen, master of foxes]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `rice and harvest kami` — suggested target: domain or identification
    - `patron of merchants and craftsmen` — suggested target: domain (narrative — likely DELETE if covered)
    - `master of foxes` — suggested target: domain (narrative — likely DELETE if covered)

## Apollo [Greek]
- **BEFORE**: `[son of Zeus and Leto, twin of Artemis, leader of the Muses (Apollo Mousagetes), god of Delphi, Delos, Didyma, Klaros oracles]`
- **AFTER**: `[son, twin]`
- **REMOVED**:
    - `son of Zeus and Leto` — → "son" + edge candidates [Zeus, Leto]
    - `twin of Artemis` — → "twin" + edge candidates [Artemis]
- **NEW EDGES proposed**:
    - `child of` → **Zeus** (id 6175) ✅
    - `child of` → **Leto** (id 6347) ✅
    - `sibling of` → **Artemis** (id 7277) ✅
- **NEEDS MANUAL DECISION**:
    - `leader of the Muses (Apollo Mousagetes)` — suggested target: character_trait
    - `god of Delphi, Delos, Didyma, Klaros oracles` — suggested target: domain (narrative — likely DELETE if covered)

## Artemis [Greek]
- **BEFORE**: `[daughter of Zeus and Leto, twin of Apollo, virgin-goddess, patroness of childbirth, hunting, wild animals, the moon]`
- **AFTER**: `[daughter, twin]`
- **REMOVED**:
    - `daughter of Zeus and Leto` — → "daughter" + edge candidates [Zeus, Leto]
    - `twin of Apollo` — → "twin" + edge candidates [Apollo]
- **NEW EDGES proposed**:
    - `child of` → **Zeus** (id 6175) ✅
    - `child of` → **Leto** (id 6347) ✅
- **NEEDS MANUAL DECISION**:
    - `virgin-goddess` — suggested target: domain
    - `patroness of childbirth, hunting, wild animals, the moon` — suggested target: domain (narrative — likely DELETE if covered)

## Sphinx [Greek]
- **BEFORE**: `[mother, spouse]`
- **AFTER**: `[mother, spouse]`

## Athena [Greek]
- **BEFORE**: `[virgin-goddess (one of the three Παρθένοι — Athena, Artemis, Hestia), daughter of Zeus and Metis, patroness of Athens]`
- **AFTER**: `[daughter]`
- **REMOVED**:
    - `daughter of Zeus and Metis` — → "daughter" + edge candidates [Zeus, Metis]
- **NEW EDGES proposed**:
    - `child of` → **Zeus** (id 6175) ✅
    - `child of` → **Metis** (id 6176) ✅
- **NEEDS MANUAL DECISION**:
    - `virgin-goddess (one of the three Παρθένοι — Athena, Artemis, Hestia)` — suggested target: domain (narrative — likely DELETE if covered)
    - `patroness of Athens` — suggested target: domain (narrative — likely DELETE if covered)

## Janus [Roman]
- **BEFORE**: `[indigenous Italic god (predates the Greek interpretatio), no Greek equivalent — uniquely Roman, first invoked in every prayer-sequence]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `indigenous Italic god (predates the Greek interpretatio)` — suggested target: domain (narrative — likely DELETE if covered)
    - `no Greek equivalent — uniquely Roman` — suggested target: domain or identification
    - `first invoked in every prayer-sequence` — suggested target: domain (narrative — likely DELETE if covered)

## Lahamu [Mesopotamian]
- **BEFORE**: `[daughter, spouse, mother]`
- **AFTER**: `[daughter, spouse, mother]`

## Kishar [Mesopotamian]
- **BEFORE**: `[daughter, spouse, mother]`
- **AFTER**: `[daughter, spouse, mother]`

## Nanna [Mesopotamian]
- **BEFORE**: `[son, husband, father]`
- **AFTER**: `[son, husband, father]`

## Enlil [Mesopotamian]
- **BEFORE**: `[son, husband, father]`
- **AFTER**: `[son, husband, father]`

## Dumuzi [Mesopotamian]
- **BEFORE**: `[son, husband, brother]`
- **AFTER**: `[son, husband, brother]`

## Nabu [Mesopotamian]
- **BEFORE**: `[son, husband]`
- **AFTER**: `[son, husband]`

## Sarpanitu [Mesopotamian]
- **BEFORE**: `[wife, mother]`
- **AFTER**: `[wife, mother]`

## Lamashtu [Mesopotamian]
- **BEFORE**: `[daughter]`
- **AFTER**: `[daughter]`

## Gula [Mesopotamian]
- **BEFORE**: `[consort of Ninurta in some traditions, divine physician]`
- **AFTER**: `[consort]`
- **REMOVED**:
    - `consort of Ninurta in some traditions` — → "consort" + edge candidates [Ninurta in some traditions]
- **NEW EDGES proposed**:
    - `married to` → Ninurta in some traditions ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `divine physician` — suggested target: domain (narrative — likely DELETE if covered)

## Pazuzu [Mesopotamian]
- **BEFORE**: `[demon, counter-demonic protector]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `demon` — already in domain
- **NEEDS MANUAL DECISION**:
    - `counter-demonic protector` — suggested target: domain or identification

## Yarikh [Canaanite]
- **BEFORE**: `[husband, suitor]`
- **AFTER**: `[husband]`
- **REMOVED**:
    - `suitor` — already in character_trait

## Lotan [Canaanite]
- **BEFORE**: `[cosmic adversary]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `cosmic adversary` — suggested target: domain or identification

## Pidray [Canaanite]
- **BEFORE**: `[daughter, sister]`
- **AFTER**: `[daughter, sister]`

## Tallay [Canaanite]
- **BEFORE**: `[daughter, sister]`
- **AFTER**: `[daughter, sister]`

## Eshmun [Canaanite]
- **BEFORE**: `[son, healer]`
- **AFTER**: `[son]`
- **NEEDS MANUAL DECISION**:
    - `healer` — suggested target: domain or identification

## Tanit [Canaanite]
- **BEFORE**: `[mother, consort, queen]`
- **AFTER**: `[mother, consort]`
- **NEEDS MANUAL DECISION**:
    - `queen` — suggested target: domain

## Melqart [Canaanite]
- **BEFORE**: `[king, patron]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `king` — already in domain
- **NEEDS MANUAL DECISION**:
    - `patron` — suggested target: domain or identification

## Chemosh [Canaanite]
- **BEFORE**: `[national god]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `national god` — already in domain

## Aqhat [Canaanite]
- **BEFORE**: `[son, brother, hunter]`
- **AFTER**: `[son, brother]`
- **REMOVED**:
    - `hunter` — already in domain

## Pughat [Canaanite]
- **BEFORE**: `[sister, daughter]`
- **AFTER**: `[sister, daughter]`

## Beelzebub [Abrahamic]
- **BEFORE**: `[prince of demons]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `prince of demons` — suggested target: domain

## Iblis [Abrahamic]
- **BEFORE**: `[ancestor of the shayāṭīn (devils), adversary]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `ancestor of the shayāṭīn (devils)` — suggested target: domain (narrative — likely DELETE if covered)
    - `adversary` — suggested target: domain or identification

## Eir [Norse]
- **BEFORE**: `[healing goddess, possibly valkyrie]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `healing goddess` — suggested target: domain (narrative — likely DELETE if covered)
    - `possibly valkyrie` — suggested target: domain or identification

## Fenrir [Norse]
- **BEFORE**: `[son of Loki and Angrboða, sibling of Jörmungandr and Hel, father of the wolves Sköll and Hati (in some genealogies)]`
- **AFTER**: `[son, sibling, father]`
- **REMOVED**:
    - `son of Loki and Angrboða` — → "son" + edge candidates [Loki, Angrboða]
    - `sibling of Jörmungandr and Hel` — → "sibling" + edge candidates [Jörmungandr, Hel]
    - `father of the wolves Sköll and Hati (in some genealogies)` — → "father" + edge candidates [the wolves Sköll, Hati]
- **NEW EDGES proposed**:
    - `child of` → **Loki** (id 7246) ✅
    - `child of` → Angrboða ❌ no DB node
    - `parent of` → the wolves Sköll ❌ no DB node
    - `parent of` → Hati ❌ no DB node

## Behemoth [Abrahamic]
- **BEFORE**: `[cosmic primordial beast, paired with Leviathan]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `cosmic primordial beast` — suggested target: domain or identification
    - `paired with Leviathan` — suggested target: domain (narrative — likely DELETE if covered)

## Skadi [Norse]
- **BEFORE**: `[wife of Njǫrðr (then separated), daughter of Þjazi, Jǫtunn-goddess]`
- **AFTER**: `[wife, daughter]`
- **REMOVED**:
    - `wife of Njǫrðr (then separated)` — → "wife" + edge candidates [Njǫrðr]
    - `daughter of Þjazi` — → "daughter" + edge candidates [Þjazi]
- **NEW EDGES proposed**:
    - `married to` → Njǫrðr ❌ no DB node
    - `child of` → Þjazi ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `Jǫtunn-goddess` — suggested target: domain

## Idun [Norse]
- **BEFORE**: `[wife of Bragi, keeper of the apples]`
- **AFTER**: `[wife]`
- **REMOVED**:
    - `wife of Bragi` — → "wife" + edge candidates [Bragi]
- **NEEDS MANUAL DECISION**:
    - `keeper of the apples` — suggested target: domain (narrative — likely DELETE if covered)

## Sigyn [Norse]
- **BEFORE**: `[wife of Loki, mother of Narfi and the wolf-Váli]`
- **AFTER**: `[wife, mother]`
- **REMOVED**:
    - `wife of Loki` — → "wife" + edge candidates [Loki]
    - `mother of Narfi and the wolf-Váli` — → "mother" + edge candidates [Narfi, the wolf-Váli]
- **NEW EDGES proposed**:
    - `parent of` → Narfi ❌ no DB node
    - `parent of` → the wolf-Váli ❌ no DB node

## Búri [Norse]
- **BEFORE**: `[father of Borr, grandfather of Odin, first of the Aesir]`
- **AFTER**: `[father, grandfather]`
- **REMOVED**:
    - `father of Borr` — → "father" + edge candidates [Borr]
    - `grandfather of Odin` — → "grandfather" + edge candidates [Odin]
- **NEW EDGES proposed**:
    - `ancestor of` → **Odin** (id 6756) ✅
- **NEEDS MANUAL DECISION**:
    - `first of the Aesir` — suggested target: domain (narrative — likely DELETE if covered)

## Nanna (Norse) [Norse]
- **BEFORE**: `[wife of Baldr, mother of Forseti, daughter of Nepr]`
- **AFTER**: `[wife, mother, daughter]`
- **REMOVED**:
    - `wife of Baldr` — → "wife" + edge candidates [Baldr]
    - `mother of Forseti` — → "mother" + edge candidates [Forseti]
    - `daughter of Nepr` — → "daughter" + edge candidates [Nepr]
- **NEW EDGES proposed**:
    - `child of` → **Nepr** (id 6822) ✅

## Sól [Norse]
- **BEFORE**: `[sun-goddess, daughter of Mundilfari, wife of Glenr, sister of Máni, mother of the new sun]`
- **AFTER**: `[daughter, wife, sister, mother]`
- **REMOVED**:
    - `daughter of Mundilfari` — → "daughter" + edge candidates [Mundilfari]
    - `wife of Glenr` — → "wife" + edge candidates [Glenr]
    - `sister of Máni` — → "sister" + edge candidates [Máni]
    - `mother of the new sun` — → "mother" + edge candidates [the new sun]
- **NEW EDGES proposed**:
    - `child of` → Mundilfari ❌ no DB node
    - `parent of` → the new sun ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `sun-goddess` — suggested target: domain

## Andvari [Norse]
- **BEFORE**: `[dwarf, cursed-treasure-keeper]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `dwarf` — already in domain
- **NEEDS MANUAL DECISION**:
    - `cursed-treasure-keeper` — suggested target: domain or identification

## Gefjun [Norse]
- **BEFORE**: `[plower of Zealand, virgin-goddess, mother of giant-oxen children]`
- **AFTER**: `[mother]`
- **REMOVED**:
    - `mother of giant-oxen children` — → "mother" + edge candidates [giant-oxen children]
- **NEW EDGES proposed**:
    - `parent of` → giant-oxen children ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `plower of Zealand` — suggested target: domain (narrative — likely DELETE if covered)
    - `virgin-goddess` — suggested target: domain

## Parvati [Hindu]
- **BEFORE**: `[wife of Śiva, daughter of Himavān and Menā, mother of Gaṇeśa and Skanda, sister of Gaṅgā, one of the Tridevī]`
- **AFTER**: `[wife, daughter, mother, sister]`
- **REMOVED**:
    - `wife of Śiva` — → "wife" + edge candidates [Śiva]
    - `daughter of Himavān and Menā` — → "daughter" + edge candidates [Himavān, Menā]
    - `mother of Gaṇeśa and Skanda` — → "mother" + edge candidates [Gaṇeśa, Skanda]
    - `sister of Gaṅgā` — → "sister" + edge candidates [Gaṅgā]
- **NEW EDGES proposed**:
    - `married to` → Śiva ❌ no DB node
    - `child of` → Himavān ❌ no DB node
    - `child of` → Menā ❌ no DB node
    - `parent of` → Gaṇeśa ❌ no DB node
    - `parent of` → Skanda ❌ no DB node
    - `sibling of` → Gaṅgā ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `one of the Tridevī` — suggested target: domain (narrative — likely DELETE if covered)

## Saraswati [Hindu]
- **BEFORE**: `[wife of Brahmā, daughter of Brahmā, one of the Tridevī, goddess of all learning]`
- **AFTER**: `[wife, daughter]`
- **REMOVED**:
    - `wife of Brahmā` — → "wife" + edge candidates [Brahmā]
    - `daughter of Brahmā` — → "daughter" + edge candidates [Brahmā]
- **NEW EDGES proposed**:
    - `married to` → Brahmā ❌ no DB node
    - `child of` → Brahmā ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `one of the Tridevī` — suggested target: domain (narrative — likely DELETE if covered)
    - `goddess of all learning` — suggested target: domain (narrative — likely DELETE if covered)

## Kartikeya [Hindu]
- **BEFORE**: `[son of Śiva and Pārvatī, brother of Gaṇeśa, foster-son of the six Kṛttikās, divine general, husband of Vaḷḷi and Devasenā]`
- **AFTER**: `[son, brother, husband]`
- **REMOVED**:
    - `son of Śiva and Pārvatī` — → "son" + edge candidates [Śiva, Pārvatī]
    - `brother of Gaṇeśa` — → "brother" + edge candidates [Gaṇeśa]
    - `husband of Vaḷḷi and Devasenā` — → "husband" + edge candidates [Vaḷḷi, Devasenā]
- **NEW EDGES proposed**:
    - `child of` → Śiva ❌ no DB node
    - `child of` → Pārvatī ❌ no DB node
    - `sibling of` → Gaṇeśa ❌ no DB node
    - `married to` → Vaḷḷi ❌ no DB node
    - `married to` → Devasenā ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `foster-son of the six Kṛttikās` — suggested target: domain (narrative — likely DELETE if covered)
    - `divine general` — suggested target: domain (narrative — likely DELETE if covered)

## Rama [Hindu]
- **BEFORE**: `[seventh avatar of Viṣṇu, eldest son of Daśaratha and Kausalyā, husband of Sītā, brother of Lakṣmaṇa, Bharata, Śatrughna, father of Lava and Kuśa, king of Ayodhyā]`
- **AFTER**: `[husband, brother, father]`
- **REMOVED**:
    - `husband of Sītā` — → "husband" + edge candidates [Sītā]
    - `brother of Lakṣmaṇa, Bharata, Śatrughna` — → "brother" + edge candidates [Lakṣmaṇa, Bharata, Śatrughna]
    - `father of Lava and Kuśa` — → "father" + edge candidates [Lava, Kuśa]
- **NEW EDGES proposed**:
    - `married to` → Sītā ❌ no DB node
    - `sibling of` → Lakṣmaṇa ❌ no DB node
    - `sibling of` → Bharata ❌ no DB node
    - `sibling of` → Śatrughna ❌ no DB node
    - `parent of` → Lava ❌ no DB node
    - `parent of` → Kuśa ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `seventh avatar of Viṣṇu` — suggested target: identification
    - `eldest son of Daśaratha and Kausalyā` — suggested target: domain (narrative — likely DELETE if covered)
    - `king of Ayodhyā` — suggested target: domain

## Lakshmana [Hindu]
- **BEFORE**: `[son of Daśaratha and Sumitrā, younger half-brother of Rāma, twin of Śatrughna, avatar of Śeṣa]`
- **AFTER**: `[son, twin]`
- **REMOVED**:
    - `son of Daśaratha and Sumitrā` — → "son" + edge candidates [Daśaratha, Sumitrā]
    - `twin of Śatrughna` — → "twin" + edge candidates [Śatrughna]
- **NEW EDGES proposed**:
    - `child of` → Daśaratha ❌ no DB node
    - `child of` → Sumitrā ❌ no DB node
    - `sibling of` → Śatrughna ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `younger half-brother of Rāma` — suggested target: domain (narrative — likely DELETE if covered)
    - `avatar of Śeṣa` — suggested target: identification

## Surya [Hindu]
- **BEFORE**: `[sun-god, one of the Ādityas, husband of Saṃjñā and Chāyā, father of Yama, Yamunā, Karṇa, the Aśvin-twins, Manu]`
- **AFTER**: `[husband, father]`
- **REMOVED**:
    - `husband of Saṃjñā and Chāyā` — → "husband" + edge candidates [Saṃjñā, Chāyā]
    - `father of Yama, Yamunā, Karṇa, the Aśvin-twins, Manu` — → "father" + edge candidates [Yama, Yamunā, Karṇa, the Aśvin-twins, Manu]
- **NEW EDGES proposed**:
    - `married to` → Saṃjñā ❌ no DB node
    - `married to` → Chāyā ❌ no DB node
    - `parent of` → **Yama** (id 7223) ✅
    - `parent of` → Yamunā ❌ no DB node
    - `parent of` → Karṇa ❌ no DB node
    - `parent of` → the Aśvin-twins ❌ no DB node
    - `parent of` → Manu ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `sun-god` — suggested target: domain
    - `one of the Ādityas` — suggested target: domain (narrative — likely DELETE if covered)

## Varuna [Hindu]
- **BEFORE**: `[Āditya, lokapāla of the west, water-deity]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `Āditya` — suggested target: domain or identification
    - `lokapāla of the west` — suggested target: domain (narrative — likely DELETE if covered)
    - `water-deity` — suggested target: domain

## Indra [Hindu]
- **BEFORE**: `[king of devas, husband of Indrāṇī, father of Jayanta and Arjuna, one of the Ādityas]`
- **AFTER**: `[husband, father]`
- **REMOVED**:
    - `husband of Indrāṇī` — → "husband" + edge candidates [Indrāṇī]
    - `father of Jayanta and Arjuna` — → "father" + edge candidates [Jayanta, Arjuna]
- **NEW EDGES proposed**:
    - `married to` → Indrāṇī ❌ no DB node
    - `parent of` → Jayanta ❌ no DB node
    - `parent of` → Arjuna ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `king of devas` — suggested target: domain
    - `one of the Ādityas` — suggested target: domain (narrative — likely DELETE if covered)

## Vayu [Hindu]
- **BEFORE**: `[wind-god, lokapāla of the northwest, father of Hanumān and Bhīma]`
- **AFTER**: `[father]`
- **REMOVED**:
    - `father of Hanumān and Bhīma` — → "father" + edge candidates [Hanumān, Bhīma]
- **NEW EDGES proposed**:
    - `parent of` → Hanumān ❌ no DB node
    - `parent of` → Bhīma ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `wind-god` — suggested target: domain
    - `lokapāla of the northwest` — suggested target: domain (narrative — likely DELETE if covered)

## Soma [Hindu]
- **BEFORE**: `[moon-god, husband of 27 nakṣatras, favorite of Rohiṇī, ancestor of Soma-vaṃśa]`
- **AFTER**: `[husband]`
- **REMOVED**:
    - `husband of 27 nakṣatras` — → "husband" + edge candidates [27 nakṣatras]
- **NEW EDGES proposed**:
    - `married to` → 27 nakṣatras ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `moon-god` — suggested target: domain
    - `favorite of Rohiṇī` — suggested target: domain (narrative — likely DELETE if covered)
    - `ancestor of Soma-vaṃśa` — suggested target: domain (narrative — likely DELETE if covered)

## Varaha [Hindu]
- **BEFORE**: `[third avatar of Viṣṇu, rescuer of Bhū-devi]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `third avatar of Viṣṇu` — suggested target: identification
    - `rescuer of Bhū-devi` — suggested target: domain (narrative — likely DELETE if covered)

## Yama (Hindu) [Hindu]
- **BEFORE**: `[lord of the dead, son of Sūrya and Saṃjñā, twin of Yamī, lokapāla of the south]`
- **AFTER**: `[son, twin]`
- **REMOVED**:
    - `lord of the dead` — already in domain
    - `son of Sūrya and Saṃjñā` — → "son" + edge candidates [Sūrya, Saṃjñā]
    - `twin of Yamī` — → "twin" + edge candidates [Yamī]
- **NEW EDGES proposed**:
    - `child of` → Sūrya ❌ no DB node
    - `child of` → Saṃjñā ❌ no DB node
    - `sibling of` → Yamī ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `lokapāla of the south` — suggested target: domain (narrative — likely DELETE if covered)

## Mahishasura [Hindu]
- **BEFORE**: `[buffalo-demon king, asura/daitya]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `buffalo-demon king` — suggested target: domain
    - `asura/daitya` — suggested target: domain or identification

## Hauhet [Egyptian]
- **BEFORE**: `[Ogdoad pair-member with Heh, primordial infinity]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `primordial infinity` — already in domain
- **NEEDS MANUAL DECISION**:
    - `Ogdoad pair-member with Heh` — suggested target: domain (narrative — likely DELETE if covered)

## Kuk [Egyptian]
- **BEFORE**: `[Ogdoad pair-member with Kauket, primordial darkness]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `primordial darkness` — already in domain
- **NEEDS MANUAL DECISION**:
    - `Ogdoad pair-member with Kauket` — suggested target: domain (narrative — likely DELETE if covered)

## Naunet [Egyptian]
- **BEFORE**: `[Ogdoad pair-member with Nun, primordial waters]`
- **AFTER**: `[(empty)]`
- **REMOVED**:
    - `primordial waters` — already in domain
- **NEEDS MANUAL DECISION**:
    - `Ogdoad pair-member with Nun` — suggested target: domain (narrative — likely DELETE if covered)

## Kotoshironushi [Shinto]
- **BEFORE**: `[son of Ōkuninushi, brother of Takeminakata, earthly-kami, later identified with Ebisu]`
- **AFTER**: `[son, brother]`
- **REMOVED**:
    - `son of Ōkuninushi` — → "son" + edge candidates [Ōkuninushi]
    - `brother of Takeminakata` — → "brother" + edge candidates [Takeminakata]
- **NEW EDGES proposed**:
    - `child of` → **Ōkuninushi** (id 6976) ✅
- **NEEDS MANUAL DECISION**:
    - `earthly-kami` — suggested target: domain or identification
    - `later identified with Ebisu` — suggested target: domain (narrative — likely DELETE if covered)

## Hotei [Shinto]
- **BEFORE**: `[one of the Seven Lucky Gods, incarnation of Maitreya (future Buddha), historically the Chinese Chan monk Budai]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `one of the Seven Lucky Gods` — suggested target: domain (narrative — likely DELETE if covered)
    - `incarnation of Maitreya (future Buddha)` — suggested target: identification
    - `historically the Chinese Chan monk Budai` — suggested target: domain (narrative — likely DELETE if covered)

## Jurojin [Shinto]
- **BEFORE**: `[one of the Seven Lucky Gods, Japanese form of Shou-lao, often paired/merged with Fukurokuju]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `one of the Seven Lucky Gods` — suggested target: domain (narrative — likely DELETE if covered)
    - `Japanese form of Shou-lao` — suggested target: domain (narrative — likely DELETE if covered)
    - `often paired/merged with Fukurokuju` — suggested target: domain (narrative — likely DELETE if covered)

## Poseidon [Greek]
- **BEFORE**: `[son of Cronus and Rhea, brother of Zeus, Hades, Hera, Demeter, Hestia, husband of Amphitrite (the Nereid sea-queen), father of Triton (by Amphitrite), Polyphemus, Theseus, Pegasus, and many others]`
- **AFTER**: `[son, brother, husband, father]`
- **REMOVED**:
    - `son of Cronus and Rhea` — → "son" + edge candidates [Cronus, Rhea]
    - `brother of Zeus, Hades, Hera, Demeter, Hestia` — → "brother" + edge candidates [Zeus, Hades, Hera, Demeter, Hestia]
    - `husband of Amphitrite (the Nereid sea-queen)` — → "husband" + edge candidates [Amphitrite]
    - `father of Triton (by Amphitrite), Polyphemus, Theseus, Pegasus, and many others` — → "father" + edge candidates [Triton, Polyphemus, Theseus, Pegasus, many others]
- **NEW EDGES proposed**:
    - `child of` → **Cronus** (id 6099) ✅
    - `child of` → **Rhea** (id 6780) ✅
    - `parent of` → Polyphemus ❌ no DB node
    - `parent of` → **Theseus** (id 6291) ✅
    - `parent of` → Pegasus ❌ no DB node
    - `parent of` → many others ❌ no DB node

## Fukurokuju [Shinto]
- **BEFORE**: `[one of the Seven Lucky Gods, Daoist Three Stars of Fortune combined, often paired/merged with Jurojin]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `one of the Seven Lucky Gods` — suggested target: domain (narrative — likely DELETE if covered)
    - `Daoist Three Stars of Fortune combined` — suggested target: domain (narrative — likely DELETE if covered)
    - `often paired/merged with Jurojin` — suggested target: domain (narrative — likely DELETE if covered)

## Hades [Greek]
- **BEFORE**: `[son of Cronus and Rhea, brother of Zeus, Poseidon, Hera, Demeter, Hestia, husband of Persephone]`
- **AFTER**: `[son, brother, husband]`
- **REMOVED**:
    - `son of Cronus and Rhea` — → "son" + edge candidates [Cronus, Rhea]
    - `brother of Zeus, Poseidon, Hera, Demeter, Hestia` — → "brother" + edge candidates [Zeus, Poseidon, Hera, Demeter, Hestia]
    - `husband of Persephone` — → "husband" + edge candidates [Persephone]
- **NEW EDGES proposed**:
    - `child of` → **Cronus** (id 6099) ✅
    - `child of` → **Rhea** (id 6780) ✅
    - `married to` → Persephone ❌ no DB node

## Pontus [Greek]
- **BEFORE**: `[primordial sea-god, parthenogenetic son of Gaia, father (with Gaia) of Nereus, Thaumas, Phorcys, Ceto, Eurybia]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `primordial sea-god` — suggested target: domain
    - `parthenogenetic son of Gaia` — suggested target: domain (narrative — likely DELETE if covered)
    - `father (with Gaia) of Nereus, Thaumas, Phorcys, Ceto, Eurybia` — suggested target: domain (narrative — likely DELETE if covered)

## Thanatos [Greek]
- **BEFORE**: `[son of Nyx (Night), parthenogenetically, twin of Hypnos, sibling of Moirai, Keres, Nemesis, Eris, and many other dark-children of Night]`
- **AFTER**: `[son, twin, sibling]`
- **REMOVED**:
    - `son of Nyx (Night), parthenogenetically` — → "son" + edge candidates [Nyx, parthenogenetically]
    - `twin of Hypnos` — → "twin" + edge candidates [Hypnos]
    - `sibling of Moirai, Keres, Nemesis, Eris, and many other dark-children of Night` — → "sibling" + edge candidates [Moirai, Keres, Nemesis, Eris, many other dark-children of Night]
- **NEW EDGES proposed**:
    - `child of` → **Nyx** (id 6181) ✅
    - `child of` → parthenogenetically ❌ no DB node
    - `sibling of` → **Moirai** (id 7437) ✅
    - `sibling of` → Keres ❌ no DB node
    - `sibling of` → **Nemesis** (id 6319) ✅
    - `sibling of` → **Eris** (id 6366) ✅
    - `sibling of` → many other dark-children of Night ❌ no DB node

## Tethys [Greek]
- **BEFORE**: `[Titaness, daughter of Ouranos and Gaia, sister-wife of Oceanus, mother of all rivers and Oceanids, foster-mother of Hera (Homer)]`
- **AFTER**: `[daughter, mother]`
- **REMOVED**:
    - `Titaness` — already in domain
    - `daughter of Ouranos and Gaia` — → "daughter" + edge candidates [Ouranos, Gaia]
    - `sister-wife of Oceanus` — already in domain
    - `mother of all rivers and Oceanids` — → "mother" + edge candidates [all rivers, Oceanids]
- **NEW EDGES proposed**:
    - `child of` → **Ouranos** (id 7426) ✅
    - `child of` → **Gaia** (id 6219) ✅
    - `parent of` → all rivers ❌ no DB node
    - `parent of` → Oceanids ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `foster-mother of Hera (Homer)` — suggested target: domain (narrative — likely DELETE if covered)

## Eros [Greek]
- **BEFORE**: `[(primordial) one of the first cosmic beings emerging from Chaos, (Olympian) son of Aphrodite, often by Ares]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `(primordial) one of the first cosmic beings emerging from Chaos` — suggested target: domain (narrative — likely DELETE if covered)
    - `(Olympian) son of Aphrodite, often by Ares` — suggested target: domain (narrative — likely DELETE if covered)

## Triton [Greek]
- **BEFORE**: `[son of Poseidon and Amphitrite, herald-merman of the sea]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `son of Poseidon and Amphitrite` — → "son" + edge candidates [Poseidon, Amphitrite]
    - `herald-merman of the sea` — already in domain (phrase "the sea")
- **NEW EDGES proposed**:
    - `child of` → **Poseidon** (id 7420) ✅
    - `child of` → **Amphitrite** (id 7432) ✅

## Hydra [Greek]
- **BEFORE**: `[daughter of Typhon and Echidna, raised by Hera, slain by Heracles]`
- **AFTER**: `[daughter]`
- **REMOVED**:
    - `daughter of Typhon and Echidna` — → "daughter" + edge candidates [Typhon, Echidna]
- **NEW EDGES proposed**:
    - `child of` → **Typhon** (id 7438) ✅
    - `child of` → **Echidna** (id 7439) ✅
- **NEEDS MANUAL DECISION**:
    - `raised by Hera` — suggested target: domain (narrative — likely DELETE if covered)
    - `slain by Heracles` — suggested target: domain (narrative — likely DELETE if covered)

## Moirai [Greek]
- **BEFORE**: `[the three Fates: Clotho, Lachesis, Atropos, either daughters of Nyx (parthenogenetically) or of Zeus and Themis]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the three Fates: Clotho, Lachesis, Atropos` — suggested target: domain or identification
    - `either daughters of Nyx (parthenogenetically) or of Zeus and Themis` — suggested target: domain (narrative — likely DELETE if covered)

## Jupiter [Roman]
- **BEFORE**: `[identified with Zeus, son of Saturn and Ops, sister-brother to Juno (and husband), head of the Capitoline Triad, father of Mars, Vulcan, Mercury, Minerva, Apollo, Diana, Bacchus, Hercules, Castor, Pollux, and many more (importing the Zeus-genealogy)]`
- **AFTER**: `[son, father]`
- **REMOVED**:
    - `son of Saturn and Ops` — → "son" + edge candidates [Saturn, Ops]
    - `father of Mars, Vulcan, Mercury, Minerva, Apollo, Diana, Bacchus, Hercules, Castor, Pollux, and many more (importing the Zeus-genealogy)` — → "father" + edge candidates [Mars, Vulcan, Mercury, Minerva, Apollo, Diana, Bacchus, Hercules, Castor, Pollux, many more]
- **NEW EDGES proposed**:
    - `child of` → **Saturn** (id 7450) ✅
    - `child of` → **Ops** (id 6653) ✅
    - `parent of` → **Mars** (id 7445) ✅
    - `parent of` → **Vulcan** (id 7447) ✅
    - `parent of` → **Apollo** (id 7274) ✅
    - `parent of` → Castor ❌ no DB node
    - `parent of` → Pollux ❌ no DB node
    - `parent of` → many more ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `identified with Zeus` — suggested target: domain (narrative — likely DELETE if covered)
    - `sister-brother to Juno (and husband)` — suggested target: character_trait
    - `head of the Capitoline Triad` — suggested target: domain (narrative — likely DELETE if covered)

## Mars [Roman]
- **BEFORE**: `[identified with Ares, son of Juno (parthenogenetically in some Roman traditions, e.g. Ovid Fasti 5.229-258 — Juno conceives him touching a flower without Jupiter), father of Romulus and Remus by Rhea Silvia]`
- **AFTER**: `[son, father]`
- **REMOVED**:
    - `son of Juno (parthenogenetically in some Roman traditions, e.g. Ovid Fasti 5.229-258 — Juno conceives him touching a flower without Jupiter)` — → "son" + edge candidates [Juno]
    - `father of Romulus and Remus by Rhea Silvia` — → "father" + edge candidates [Romulus, Remus by Rhea Silvia]
- **NEW EDGES proposed**:
    - `child of` → **Juno** (id 6555) ✅
    - `parent of` → Remus by Rhea Silvia ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `identified with Ares` — suggested target: domain (narrative — likely DELETE if covered)

## Liber [Roman]
- **BEFORE**: `[indigenous Italic deity, identified with Bacchus, one of the Aventine Triad with Ceres and Libera]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `indigenous Italic deity` — suggested target: domain
    - `identified with Bacchus` — suggested target: domain (narrative — likely DELETE if covered)
    - `one of the Aventine Triad with Ceres and Libera` — suggested target: domain (narrative — likely DELETE if covered)

## Pluto [Roman]
- **BEFORE**: `[identified with Hades, syncretized with Dis Pater (the Italic underworld-wealth deity), son of Saturn and Ops, brother of Jupiter, Neptune, Juno, Ceres, Vesta, husband of Proserpina]`
- **AFTER**: `[son, brother, husband]`
- **REMOVED**:
    - `son of Saturn and Ops` — → "son" + edge candidates [Saturn, Ops]
    - `brother of Jupiter, Neptune, Juno, Ceres, Vesta` — → "brother" + edge candidates [Jupiter, Neptune, Juno, Ceres, Vesta]
    - `husband of Proserpina` — → "husband" + edge candidates [Proserpina]
- **NEW EDGES proposed**:
    - `child of` → **Saturn** (id 7450) ✅
    - `child of` → **Ops** (id 6653) ✅
- **NEEDS MANUAL DECISION**:
    - `identified with Hades` — suggested target: domain (narrative — likely DELETE if covered)
    - `syncretized with Dis Pater (the Italic underworld-wealth deity)` — suggested target: domain

## Quirinus [Roman]
- **BEFORE**: `[Sabine war-deity, identified with deified Romulus, one of the Archaic Triad (Jupiter-Mars-Quirinus)]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `Sabine war-deity` — suggested target: domain
    - `identified with deified Romulus` — suggested target: domain (narrative — likely DELETE if covered)
    - `one of the Archaic Triad (Jupiter-Mars-Quirinus)` — suggested target: domain (narrative — likely DELETE if covered)

## Hercules [Roman]
- **BEFORE**: `[identified with Heracles, son of Jupiter and Alcmena, indigenous Italic Ara Maxima cult predates the interpretatio]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `son of Jupiter and Alcmena` — → "son" + edge candidates [Jupiter, Alcmena]
- **NEW EDGES proposed**:
    - `child of` → **Jupiter** (id 7444) ✅
    - `child of` → Alcmena ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `identified with Heracles` — suggested target: domain (narrative — likely DELETE if covered)
    - `indigenous Italic Ara Maxima cult predates the interpretatio` — suggested target: domain (narrative — likely DELETE if covered)

## Lares [Roman]
- **BEFORE**: `[tutelary household spirits, sometimes treated as deified ancestors, linked to Mania (the Lares-mother in some traditions)]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `tutelary household spirits` — suggested target: domain or identification
    - `sometimes treated as deified ancestors` — suggested target: domain or identification
    - `linked to Mania (the Lares-mother in some traditions)` — suggested target: domain (narrative — likely DELETE if covered)

## Remus [Roman]
- **BEFORE**: `[son of Mars and Rhea Silvia (Vestal), twin of Romulus, killed by Romulus or his men]`
- **AFTER**: `[son, twin]`
- **REMOVED**:
    - `son of Mars and Rhea Silvia (Vestal)` — → "son" + edge candidates [Mars, Rhea Silvia]
    - `twin of Romulus` — → "twin" + edge candidates [Romulus]
- **NEW EDGES proposed**:
    - `child of` → **Mars** (id 7445) ✅
    - `child of` → Rhea Silvia ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `killed by Romulus or his men` — suggested target: domain (narrative — likely DELETE if covered)

## Ometeotl [Aztec]
- **BEFORE**: `[supreme creator-deity in unified-duality aspect, parent of the four directional Tezcatlipocas, dwells in Omeyocan]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `supreme creator-deity in unified-duality aspect` — suggested target: domain
    - `parent of the four directional Tezcatlipocas` — suggested target: domain (narrative — likely DELETE if covered)
    - `dwells in Omeyocan` — suggested target: domain (narrative — likely DELETE if covered)

## Tonacacihuatl [Aztec]
- **BEFORE**: `[feminine half of supreme creator-duality, wife of Tonacatecuhtli, mother of the four Tezcatlipocas, sometimes identified with Omecihuatl]`
- **AFTER**: `[wife, mother]`
- **REMOVED**:
    - `wife of Tonacatecuhtli` — → "wife" + edge candidates [Tonacatecuhtli]
    - `mother of the four Tezcatlipocas` — → "mother" + edge candidates [the four Tezcatlipocas]
- **NEW EDGES proposed**:
    - `parent of` → the four Tezcatlipocas ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `feminine half of supreme creator-duality` — suggested target: domain (narrative — likely DELETE if covered)
    - `sometimes identified with Omecihuatl` — suggested target: domain (narrative — likely DELETE if covered)

## Tlaloc [Aztec]
- **BEFORE**: `[co-supreme with Huitzilopochtli at Tenochtitlan, husband of Chalchiuhtlicue, master of the Tlaloque (rain-helpers)]`
- **AFTER**: `[husband]`
- **REMOVED**:
    - `husband of Chalchiuhtlicue` — → "husband" + edge candidates [Chalchiuhtlicue]
- **NEEDS MANUAL DECISION**:
    - `co-supreme with Huitzilopochtli at Tenochtitlan` — suggested target: domain (narrative — likely DELETE if covered)
    - `master of the Tlaloque (rain-helpers)` — suggested target: domain (narrative — likely DELETE if covered)

## Omecihuatl [Aztec]
- **BEFORE**: `[feminine half of Ometeotl, wife of Ometecuhtli, mother of the four Tezcatlipocas]`
- **AFTER**: `[wife, mother]`
- **REMOVED**:
    - `wife of Ometecuhtli` — → "wife" + edge candidates [Ometecuhtli]
    - `mother of the four Tezcatlipocas` — → "mother" + edge candidates [the four Tezcatlipocas]
- **NEW EDGES proposed**:
    - `parent of` → the four Tezcatlipocas ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `feminine half of Ometeotl` — suggested target: domain (narrative — likely DELETE if covered)

## Ometecuhtli [Aztec]
- **BEFORE**: `[masculine half of Ometeotl, husband of Omecihuatl, father of the four Tezcatlipocas]`
- **AFTER**: `[husband, father]`
- **REMOVED**:
    - `husband of Omecihuatl` — → "husband" + edge candidates [Omecihuatl]
    - `father of the four Tezcatlipocas` — → "father" + edge candidates [the four Tezcatlipocas]
- **NEW EDGES proposed**:
    - `parent of` → the four Tezcatlipocas ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `masculine half of Ometeotl` — suggested target: domain (narrative — likely DELETE if covered)

## Metztli [Aztec]
- **BEFORE**: `[the moon, identified with Tecuciztecatl]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the moon` — suggested target: domain or identification
    - `identified with Tecuciztecatl` — suggested target: domain (narrative — likely DELETE if covered)

## Mictlantecuhtli [Aztec]
- **BEFORE**: `[lord of Mictlan, co-ruler with Mictlancihuatl (his consort)]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `lord of Mictlan` — suggested target: domain
    - `co-ruler with Mictlancihuatl (his consort)` — suggested target: character_trait

## Tonantzin [Aztec]
- **BEFORE**: `[title-aspect of the mother-goddess complex, pre-Conquest goddess of Tepeyac, source of Guadalupe syncretism]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `title-aspect of the mother-goddess complex` — suggested target: identification
    - `pre-Conquest goddess of Tepeyac` — suggested target: domain (narrative — likely DELETE if covered)
    - `source of Guadalupe syncretism` — suggested target: domain (narrative — likely DELETE if covered)

## Mayahuel [Aztec]
- **BEFORE**: `[mother of the 400 Centzon Totochtin (pulque-rabbit gods), rescued by Quetzalcoatl from her grandmother Tzitzimitl]`
- **AFTER**: `[mother]`
- **REMOVED**:
    - `mother of the 400 Centzon Totochtin (pulque-rabbit gods)` — → "mother" + edge candidates [the 400 Centzon Totochtin]
- **NEW EDGES proposed**:
    - `parent of` → the 400 Centzon Totochtin ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `rescued by Quetzalcoatl from her grandmother Tzitzimitl` — suggested target: domain (narrative — likely DELETE if covered)

## Nuwa [Chinese]
- **BEFORE**: `[creator-goddess and mother of humanity, one of the Three Sovereigns, sister-wife of Fuxi, repairer of the cosmos]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `creator-goddess and mother of humanity` — suggested target: domain (narrative — likely DELETE if covered)
    - `one of the Three Sovereigns` — suggested target: domain
    - `sister-wife of Fuxi` — suggested target: character_trait
    - `repairer of the cosmos` — suggested target: domain (narrative — likely DELETE if covered)

## Shun [Chinese]
- **BEFORE**: `[one of the Five Emperors / sage-kings, son of the Blind Man (Gusou), son-in-law of Yao (married Yao's two daughters), abdicated to Yu]`
- **AFTER**: `[son]`
- **REMOVED**:
    - `son of the Blind Man (Gusou)` — → "son" + edge candidates [the Blind Man]
- **NEW EDGES proposed**:
    - `child of` → the Blind Man ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `one of the Five Emperors / sage-kings` — suggested target: domain
    - `son-in-law of Yao (married Yao's two daughters)` — suggested target: domain (narrative — likely DELETE if covered)
    - `abdicated to Yu` — suggested target: domain or identification

## Yu the Great [Chinese]
- **BEFORE**: `[last of the sage-kings, son of Gun, founder of the Xia dynasty, father of Qi (to whom he passed the throne, ending the abdication tradition)]`
- **AFTER**: `[son, father]`
- **REMOVED**:
    - `son of Gun` — → "son" + edge candidates [Gun]
    - `father of Qi (to whom he passed the throne, ending the abdication tradition)` — → "father" + edge candidates [Qi]
- **NEW EDGES proposed**:
    - `child of` → Gun ❌ no DB node
    - `parent of` → Qi ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `last of the sage-kings` — suggested target: domain
    - `founder of the Xia dynasty` — suggested target: domain (narrative — likely DELETE if covered)

## Zao Jun [Chinese]
- **BEFORE**: `[the Kitchen God / Stove God, household-resident deity, annual reporter to the Jade Emperor]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `the Kitchen God / Stove God` — suggested target: domain or identification
    - `household-resident deity` — suggested target: domain
    - `annual reporter to the Jade Emperor` — suggested target: domain

## Zhongli Quan [Chinese]
- **BEFORE**: `[one of the Eight Immortals (often the eldest), the master who initiated Lu Dongbin]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `one of the Eight Immortals (often the eldest)` — suggested target: domain (narrative — likely DELETE if covered)
    - `the master who initiated Lu Dongbin` — suggested target: domain (narrative — likely DELETE if covered)

## Dizang [Chinese]
- **BEFORE**: `[bodhisattva of the underworld, Chinese form of Kṣitigarbha, savior of beings in the hell-realms]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `bodhisattva of the underworld` — suggested target: domain (narrative — likely DELETE if covered)
    - `Chinese form of Kṣitigarbha` — suggested target: domain (narrative — likely DELETE if covered)
    - `savior of beings in the hell-realms` — suggested target: domain (narrative — likely DELETE if covered)

## Han Xiangzi [Chinese]
- **BEFORE**: `[one of the Eight Immortals, relative of the historical Han Yu, disciple of Lü Dongbin, patron of musicians]`
- **AFTER**: `[(empty)]`
- **NEEDS MANUAL DECISION**:
    - `one of the Eight Immortals` — suggested target: domain (narrative — likely DELETE if covered)
    - `relative of the historical Han Yu` — suggested target: domain (narrative — likely DELETE if covered)
    - `disciple of Lü Dongbin` — suggested target: domain (narrative — likely DELETE if covered)
    - `patron of musicians` — suggested target: domain (narrative — likely DELETE if covered)

## Doumu [Chinese]
- **BEFORE**: `[Mother of the Great Dipper, mother of the nine Dipper-star gods, high Daoist astral deity]`
- **AFTER**: `[mother]`
- **REMOVED**:
    - `Mother of the Great Dipper` — → "mother" + edge candidates [the Great Dipper]
    - `mother of the nine Dipper-star gods` — → "mother" + edge candidates [the nine Dipper-star gods]
- **NEW EDGES proposed**:
    - `parent of` → the Great Dipper ❌ no DB node
    - `parent of` → the nine Dipper-star gods ❌ no DB node
- **NEEDS MANUAL DECISION**:
    - `high Daoist astral deity` — suggested target: domain

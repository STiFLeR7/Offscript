#!/usr/bin/env python3
"""
verify-library.py — predicates over the Section Library's capability profiles.

Checks COMPOSITION.md's profile block against the closed vocabularies that own each field.
Thirteen predicates (gates) and four reports.

    python3 verify-library.py [path/to/COMPOSITION.md]
    python3 verify-library.py --self-test     # negative controls: every gate must fire on an injected fault

A missing field records as ABSENT and fails. It never defaults to a value — a default inside a
predicate reports a choice nobody made, and the check reads as passing forever.

The structural-retrieval gates (2026-07-31) read their vocabularies OUT OF THE DOCUMENT rather than
hardcoding them, so the check and the governance cannot drift apart: if a value is added to the
Arrangement table, the gate binds the new list on the next run.
"""
import re, sys, json, collections, pathlib

HERE = pathlib.Path(__file__).resolve().parent
DEFAULT = HERE / "COMPOSITION.md"
# module-level so the filename gate's negative control can point it at a fixture —
# a gate that reads the real tree and cannot be pointed elsewhere cannot be proven.
SPECIMENS = HERE.parents[2] / "section-library" / "sections"

# ── the closed vocabularies, each owned elsewhere in governance ────────────────────────────────────
INTENT    = {"educate","persuade","explain","prove","compare","build-trust","inspire","convert","orient","close"}
EMPHASIS  = {"typography","creative","structure"}
RELATION  = {"cause-and-effect","validation","dependency","supporting","contrasting","hierarchical","transformational"}
KIND      = {"problem","impact","solution","capability","process","outcome","proof","evidence","risk",
             "decision-support","context","validation"}
DENSITY   = {"low","medium","high"}
CAPACITY  = {"singular","paired","triad","small-set","large-set","continuous"}
PACE      = {"fast","moderate","slow"}
LOAD      = {"light","medium","heavy"}
REGISTER  = {"editorial","quiet","immersive","technical","human","confident","narrative","instructional",
             "reflective","closing"}
HIERARCHY = {"hero","primary","secondary","supporting","technical","proof","closing"}
ARCHETYPE = {"editorial-split","editorial-stack","text-first","immersive-landscape","media-first",
             "product-showcase","storytelling-composition","narrative-flow","proof-layout","feature-comparison"}
ADDRESS   = {"executive","enterprise","technical","operational","marketing","specialist"}

# requirements the demand vocabulary can emit, as intents
REQUIREMENTS = INTENT

INTERACTION = {"static","reveal-only","accordion","tabs","carousel","slider","count-up","toggle",
               "sticky-scroll","marquee","form","modal"}
REUSE = {"reusable","purpose-bound"}

FIELDS = ["Structure","Arrangement","Interaction","Reuse","Tags",
          "Leads with","Also carries","Emphasis","Relates","Carries","Density","Capacity","Pace","Load",
          "Registers","Role","Follows","Precedes","Media","Envelope","Addresses","Distinct from"]

# the 12-field signature the distinctness gate compares. The five description fields are
# deliberately NOT in it: changing what an existing gate means is its own decision, and the
# library's rule is that uniqueness is regenerated, never allowed to drop.
SIGNATURE = ["Leads with","Also carries","Emphasis","Relates","Carries","Density",
             "Capacity","Pace","Load","Registers","Role","Addresses"]

ABSENT = object()


# ── vocabularies read out of the document, so gate and governance cannot diverge ───────────────────
def read_vocabularies(md: str):
    """Parse the display-name map, the per-Structure Arrangement lists and the Tag list."""
    def section(title, stop=r"\n#{2,4} "):
        m = re.search(rf"### {re.escape(title)}\n(.*?)(?={stop}|\Z)", md, re.S)
        return m.group(1) if m else ""

    display = {}
    for row in re.findall(r"^\|(.+)\|\s*$", section("Structure — display names"), re.M):
        # the table is two name/primitive pairs per row, separated by an empty cell —
        # drop empties BEFORE pairing or every second pair is read one cell out of step
        cells = [c.strip() for c in row.split("|") if c.strip()]
        for i in range(0, len(cells) - 1, 2):
            name, prim = cells[i], cells[i + 1]
            p = re.fullmatch(r"`(.+)`", prim)
            if p and name and not set(name) <= set("- ") and name != "Shown as":
                display[name] = p.group(1)

    arrangement = {}
    for row in re.findall(r"^\|(.+)\|\s*$", section("Arrangement — per Structure"), re.M):
        cells = [c.strip() for c in row.split("|")]
        if len(cells) < 2 or cells[0] in ("Structure", "") or set(cells[0]) <= set("- "):
            continue
        arrangement[cells[0]] = set(re.findall(r"`([^`]+)`", cells[1]))

    tags = set()
    for row in re.findall(r"^\|(.+)\|\s*$", section("Tags"), re.M):
        cells = [c.strip() for c in row.split("|")]
        if len(cells) >= 2 and cells[0] not in ("Group", "") and not set(cells[0]) <= set("- "):
            tags |= set(re.findall(r"`([^`]+)`", cells[1]))
    return display, arrangement, tags


def read_named_population(md: str) -> set:
    """The specimens the naming grammar is entitled to judge (COMPOSITION.md → Who the grammar binds).

    Declared, never inferred. Inferring the population from "does this name conform" would let a
    misnamed specimen escape by being misnamed, so the negative control would pass for the wrong
    reason — which is the one thing a gate may not do. DR-56.
    """
    m = re.search(r"### Who the grammar binds\n(.*?)(?=\n#{2,4} |\Z)", md, re.S)
    return set(re.findall(r"`([a-z0-9-]+)`", m.group(1))) if m else set()


def read_indexes(md: str):
    """Parse the Layout Index and the Interaction Index back into {key: {slug}}."""
    layout, inter = {}, {}
    m = re.search(r"## Layout Index[^\n]*\n(.*?)\n## ", md, re.S)
    if m:
        current = None
        for row in re.findall(r"^\|(.+)\|\s*$", m.group(1), re.M):
            c = [x.strip() for x in row.split("|")]
            # NB: a continuation row has an EMPTY first cell and must not be skipped —
            # only a `|---|---|` separator is. Testing c[0] alone silently drops every
            # arrangement after the first under each Structure.
            if len(c) < 3 or c[0] == "Structure" or all(set(x) <= set("-: ") for x in c):
                continue
            name = re.sub(r"\*\*", "", c[0]).strip()
            if name:
                current = name
            arr = (re.findall(r"`([^`]+)`", c[1]) or ["—"])[0]
            layout[(current, arr)] = set(re.findall(r"`([^`]+)`", c[2]))
    m = re.search(r"## Interaction Index[^\n]*\n(.*?)(?=\n## |\n---)", md, re.S)
    if m:
        for row in re.findall(r"^\|(.+)\|\s*$", m.group(1), re.M):
            c = [x.strip() for x in row.split("|")]
            if len(c) < 2 or c[0] == "Interaction" or set(c[0]) <= set("- "):
                continue
            k = re.findall(r"`([^`]+)`", c[0])
            if k:
                inter[k[0]] = set(re.findall(r"`([^`]+)`", c[1]))
    return layout, inter


def read_catalog(md: str):
    """slug -> the catalog's declared Layout primitives (for the profile-vs-catalog report)."""
    # The File cell names the canonical library (`section-library/<slug>.html`). The legacy
    # `exemplars/sections/component-<slug>.html` form is still recognised so this gate keeps
    # working while the catalog is being repointed — the slug is the basename either way.
    out = {}
    row = re.compile(r"(?:section-library|exemplars/sections)/(?:component-)?([a-z0-9-]+)\.html")
    for line in md.splitlines():
        if not line.startswith("| "):
            continue
        m = row.search(line)
        if m:
            c = [x.strip() for x in line.split("|")]
            out[m.group(1)] = [x.strip() for x in c[4].split(",") if x.strip()]
    return out


def parse(md: str):
    """Split the profile block into per-slug field maps. Absent fields are ABSENT, never defaulted."""
    profiles = {}
    blocks = re.split(r"^#### ", md, flags=re.M)[1:]
    for b in blocks:
        m = re.match(r"`([a-z0-9-]+)`", b)
        if not m:
            continue
        slug = m.group(1)
        body = b.split("\n#", 1)[0]
        fields = {}
        for f in FIELDS:
            mm = re.search(rf"\*\*{re.escape(f)}\*\*\s*(.*?)(?=\s*·?\s*\*\*[A-Z]|\n|$)", body)
            fields[f] = mm.group(1).strip() if mm else ABSENT
        fields["_why"] = "*Why it works*" in body
        fields["_reach"] = "*Reach for it" in body
        fields["_atom"] = "*(atom)*" in b.split("\n")[0]
        profiles[slug] = fields
    return profiles


def vals(raw):
    """Split a field's value into tokens, dropping prose, emphasis and the explicit-none marker."""
    if raw is ABSENT:
        return ABSENT
    raw = re.sub(r"\*\*|\*|`", "", raw)
    raw = raw.split("—")[0]
    out = []
    for tok in re.split(r"·|,", raw):
        tok = tok.strip().lower()
        tok = re.sub(r"\(.*?\)", "", tok).strip()
        if not tok or tok in {"-", "–", "none", "inherits", "*inherits*"}:
            continue
        out.append(tok)
    return out


def vlist(raw):
    """vals(), with ABSENT collapsed to empty. Predicates that must not crash on a fault use this —
    a check that raises before reaching its assertion cannot be proven by a negative control."""
    v = vals(raw)
    return [] if v is ABSENT else v


def check(md: str):
    P = parse(md)
    fails, reports = [], []

    def fail(kind, slug, msg):
        fails.append((kind, slug, msg))

    # 1 · completeness — a missing field is ABSENT and fails; it never defaults
    for slug, f in P.items():
        for k in FIELDS:
            if f[k] is ABSENT:
                fail("completeness", slug, f"field '{k}' ABSENT")
        if not f["_why"]:
            fail("completeness", slug, "rationale 'Why it works' ABSENT")
        if not f["_reach"]:
            fail("completeness", slug, "rationale 'Reach for it' ABSENT")

    # 2 · vocabulary conformance
    BOUND = [("Leads with",INTENT),("Also carries",INTENT),("Emphasis",EMPHASIS),("Relates",RELATION),
             ("Carries",KIND),("Density",DENSITY),("Capacity",CAPACITY),("Pace",PACE),("Load",LOAD),
             ("Registers",REGISTER),("Follows",KIND),("Precedes",KIND),("Addresses",ADDRESS)]
    for slug, f in P.items():
        for k, vocab in BOUND:
            v = vals(f[k])
            if v is ABSENT:
                continue
            for tok in v:
                if tok not in vocab:
                    fail("vocabulary", slug, f"'{k}' → '{tok}' not in the closed set")
        # Role: atoms legitimately declare no role; sections must
        rv = vals(f["Role"])
        if rv is not ABSENT:
            for tok in rv:
                if tok not in HIERARCHY:
                    fail("vocabulary", slug, f"'Role' → '{tok}' not in the closed set")
            if not f["_atom"] and not rv:
                fail("vocabulary", slug, "'Role' empty on a non-atom")
        # Envelope archetypes
        env = f["Envelope"]
        if env is not ABSENT and "archetypes" in env:
            # only the archetypes segment — the rest of the envelope backticks other vocabularies
            seg = env.split("archetypes", 1)[1].split("—")[0]
            for tok in re.findall(r"`([a-z-]+)`", seg):
                if tok not in ARCHETYPE:
                    fail("vocabulary", slug, f"'Envelope' archetype '{tok}' not in the closed set")

    # ── structural retrieval (2026-07-31) ──────────────────────────────────────────────────────────
    DISPLAY, ARRANGEMENT, TAGS = read_vocabularies(md)
    NAMED = read_named_population(md)
    LAYOUT_IDX, INTER_IDX = read_indexes(md)

    # 7 · display names map one-to-one onto the layout primitives
    if not DISPLAY:
        fail("naming", "-", "the Structure display-name table could not be read")
    prims = list(DISPLAY.values())
    for p in {x for x in prims if prims.count(x) > 1}:
        fail("naming", p, "primitive claimed by more than one display name")
    if len(DISPLAY) != len(set(DISPLAY)):
        fail("naming", "-", "a display name is declared twice")

    # 8 · every section declares the five description properties, from the closed vocabularies
    for slug, f in P.items():
        st = (f["Structure"] or "").strip() if f["Structure"] is not ABSENT else ABSENT
        if st is not ABSENT and st and st not in DISPLAY:
            fail("description", slug, f"Structure '{st}' is not a declared display name")
        arr = vals(f["Arrangement"])
        if arr is not ABSENT and st is not ABSENT and st in ARRANGEMENT:
            # 9 · Arrangement is ONE canonical value, from ITS Structure's list — never a list,
            #     never free text, never borrowed from another Structure
            if len(arr) > 1:
                fail("arrangement", slug, f"{len(arr)} values ({arr}) — Arrangement carries exactly one")
            for tok in arr:
                if tok not in ARRANGEMENT[st]:
                    fail("arrangement", slug,
                         f"'{tok}' is not an Arrangement of {st} ({sorted(ARRANGEMENT[st])})")
        for tok in vlist(f["Interaction"]):
            if tok not in INTERACTION:
                fail("description", slug, f"Interaction '{tok}' not in the closed set")
        for tok in vlist(f["Reuse"]):
            if tok not in REUSE:
                fail("description", slug, f"Reuse '{tok}' not in the closed set")

        # 10 · a Tag must say something Structure, Arrangement and Interaction do not
        said = set(vlist(f["Arrangement"])) | set(vlist(f["Interaction"]))
        if st is not ABSENT and st:
            said.add(st.lower().replace(" ", "-"))
        for tok in vlist(f["Tags"]):
            if tok not in TAGS:
                fail("tags", slug, f"'{tok}' is not a declared Tag")
            elif tok in said:
                fail("tags", slug, f"'{tok}' repeats the Structure, Arrangement or Interaction")

    # 11 · no unused Arrangement or Tag value — a value that separates nothing is reached for by feel
    used_arr = collections.defaultdict(set)
    used_tags = set()
    for slug, f in P.items():
        st = (f["Structure"] or "").strip() if f["Structure"] is not ABSENT else None
        if st:
            used_arr[st] |= set(vals(f["Arrangement"]) or [])
        used_tags |= set(vals(f["Tags"]) or [])
    for st, allowed in ARRANGEMENT.items():
        for a in sorted(allowed - used_arr.get(st, set())):
            if a != "—":
                fail("unused", st, f"Arrangement '{a}' is declared but no section takes it")
    for t in sorted(TAGS - used_tags):
        fail("unused", t, "Tag is declared but no section carries it")

    # 12 · index round-trip — the indexes are a projection of the profiles and cannot drift
    want_layout = collections.defaultdict(set)
    want_inter = collections.defaultdict(set)
    for slug, f in P.items():
        st = (f["Structure"] or "").strip() if f["Structure"] is not ABSENT else None
        if st:
            a = (vals(f["Arrangement"]) or ["—"])
            want_layout[(st, a[0] if a else "—")].add(slug)
        for i in (vals(f["Interaction"]) or []):
            want_inter[i].add(slug)
    if LAYOUT_IDX:
        for key in set(want_layout) | set(LAYOUT_IDX):
            got, exp = LAYOUT_IDX.get(key, set()), want_layout.get(key, set())
            for s in sorted(exp - got):
                fail("index", s, f"missing from the Layout Index under {key}")
            for s in sorted(got - exp):
                fail("index", s, f"listed in the Layout Index under {key} but its profile disagrees")
    else:
        fail("index", "-", "the Layout Index could not be read")
    if INTER_IDX:
        for key in set(want_inter) | set(INTER_IDX):
            got, exp = INTER_IDX.get(key, set()), want_inter.get(key, set())
            for s in sorted(exp - got):
                fail("index", s, f"missing from the Interaction Index under '{key}'")
            for s in sorted(got - exp):
                fail("index", s, f"listed in the Interaction Index under '{key}' but its profile disagrees")
    else:
        fail("index", "-", "the Interaction Index could not be read")

    # 13 · modernized specimen filenames are derivable from the vocabularies, and stylish
    #
    # SCOPED to the specimens the modernization program authors (DR-56). Applied to all 79 it
    # reported 69 findings — every frozen identity that COMPOSITION.md's own "Frozen sections keep
    # their identities" paragraph exempts under DR-40, and DR-48 confirmed the boundary when it
    # re-derived names library-wide. The grammar is unchanged and its enforcement is unchanged for
    # every specimen it was ever meant to bind; what changed is that it stopped being asked to judge
    # names it has no authority over.
    spec = SPECIMENS
    if not NAMED:
        fail("naming", "-", "the naming population (COMPOSITION.md → Who the grammar binds) "
                            "could not be read — the filename gate cannot run unscoped")
    if spec.is_dir() and NAMED:
        slugs = {d.lower().replace(" ", "-"): d for d in DISPLAY}
        for p in sorted(spec.glob("*.html")):
            if p.name.startswith("_"):
                continue
            n = p.stem
            if n not in NAMED:
                continue          # a frozen identity — outside the population, not failing it
            if n != n.lower() or "_" in n or re.search(r"-\d+$", n):
                fail("filename", n, "not lowercase kebab-case, or numerically suffixed")
            hit = max((s for s in slugs if n == s or n.startswith(s + "-")), key=len, default=None)
            if not hit:
                fail("filename", n, "does not begin with a declared Structure")
                continue
            rest = n[len(hit):].lstrip("-")
            st = slugs[hit]
            if rest and not any(rest == a or rest.startswith(a + "-") or
                                # a name never repeats a word, so the arrangement may be shortened
                                rest.startswith(a.split("-", 1)[-1]) for a in ARRANGEMENT.get(st, ())):
                fail("filename", n, f"'{rest}' is not an Arrangement of {st} (or a term after one)")

        # Every declared member must be ON DISK under that name. Without this the scoping above
        # would be self-defeating: rename a program-authored specimen to something the grammar
        # refuses and it would simply drop out of the population and pass. The negative control has
        # to bite from the other side — the name is missing, and that is the failure. (DR-56.)
        on_disk = {p.stem for p in spec.glob("*.html") if not p.name.startswith("_")}
        for n in sorted(NAMED - on_disk):
            fail("filename", n, "declared under the naming grammar but no specimen carries that "
                                "name — it was renamed out of its own population, or never landed")

    # 3 · distinctness — no two profiles carry an identical declared signature
    sig = {}
    for slug, f in P.items():
        s = tuple(tuple(sorted(vals(f[k]) or [])) if vals(f[k]) is not ABSENT else ("ABSENT",)
                  for k in SIGNATURE)
        sig.setdefault(s, []).append(slug)
    for s, slugs in sig.items():
        if len(slugs) > 1:
            fail("distinctness", ", ".join(slugs), "identical declared signature")

    # 4 · supplier coverage — every requirement needs >= 2 structurally distinct suppliers
    sections = {s: f for s, f in P.items() if not f["_atom"]}
    supply = collections.defaultdict(list)
    for slug, f in sections.items():
        got = set()
        for k in ("Leads with", "Also carries"):
            v = vals(f[k])
            if v is not ABSENT:
                got |= set(v)
        for i in got:
            supply[i].append(slug)
    coverage = {}
    for req in sorted(REQUIREMENTS):
        sup = supply.get(req, [])
        # structurally distinct = different Emphasis/Capacity/Density combinations
        shapes = {(str(vals(sections[s]["Emphasis"])), str(vals(sections[s]["Capacity"])),
                   str(vals(sections[s]["Density"]))) for s in sup}
        coverage[req] = (len(sup), len(shapes))
        if len(sup) == 0:
            fail("coverage", req, "GAP — no supplier")
        elif len(shapes) < 2:
            fail("coverage", req, f"MONOPOLY — {len(sup)} supplier(s), {len(shapes)} distinct shape(s)")

    # 5 · axis independence — load and pace must not be functions of density
    for axis in ("Load", "Pace"):
        mapping = {}
        collision = False
        for slug, f in P.items():
            d, a = vals(f["Density"]), vals(f[axis])
            if d is ABSENT or a is ABSENT or not d or not a:
                continue
            if d[0] in mapping and mapping[d[0]] != a[0]:
                collision = True
            mapping.setdefault(d[0], a[0])
        if not collision:
            fail("independence", axis,
                 f"perfectly predicted by Density ({mapping}) — it is Density renamed and does not ship")

    # 6 · antecedent symmetry — a kind named as a successor is named as an antecedent somewhere
    follows, precedes = set(), set()
    for f in P.values():
        for k, acc in (("Follows", follows), ("Precedes", precedes)):
            v = vals(f[k])
            if v is not ABSENT:
                acc |= set(v)
    for k in sorted(precedes - follows):
        fail("symmetry", k, "named as a successor but never as an antecedent — a chain with no way out")

    # reports (not gates). vlist() collapses ABSENT to empty — reports must never crash on a fault,
    # or a negative control cannot reach the gate it was written to prove.
    reachable = [s for s, f in sections.items()
                 if vlist(f["Leads with"]) or vlist(f["Also carries"])]
    unreachable = sorted(set(sections) - set(reachable))
    reports.append(("reachability", f"{len(reachable)}/{len(sections)} sections answer >=1 requirement"
                    + (f"; UNREACHABLE: {unreachable}" if unreachable else "")))
    widths = sorted(((len(set(vlist(f['Leads with']) + vlist(f['Also carries']))), s)
                     for s, f in sections.items()), reverse=True)
    reports.append(("declaration balance",
                    "widest: " + ", ".join(f"{s}={n}" for n, s in widths[:5])
                    + " | narrowest: " + ", ".join(f"{s}={n}" for n, s in widths[-3:])))
    pace = collections.Counter((vlist(f["Pace"]) or [""])[0] for f in P.values())
    load = collections.Counter((vlist(f["Load"]) or [""])[0] for f in P.values())
    reports.append(("pacing spread", f"pace={dict(pace)} load={dict(load)}"))
    reports.append(("coverage table", json.dumps({k: f"{v[0]} sup / {v[1]} shapes"
                                                  for k, v in coverage.items()})))

    # REPORT, not a gate (DR-41): where the measured Structure disagrees with the catalog's Layout
    # cell. As a gate it would fail on day one for every misclassified section, and COMPOSITION.md
    # already records that several files are misnamed. It becomes a gate when the catalog catches up.
    CAT = read_catalog(md)
    disagree = []
    for slug, f in P.items():
        st = (f["Structure"] or "").strip() if f["Structure"] is not ABSENT else None
        if not st or slug not in CAT or st not in DISPLAY:
            continue
        if DISPLAY[st] not in CAT[slug]:
            disagree.append(f"{slug}: profile {st} ({DISPLAY[st]}) vs catalog {'/'.join(CAT[slug])}")
    reports.append(("profile vs catalog layout",
                    f"{len(disagree)}/{len(CAT)} disagree"
                    + ("; " + " | ".join(disagree) if disagree else "")))
    return P, fails, reports


def run(path):
    md = pathlib.Path(path).read_text()
    P, fails, reports = check(md)
    print(f"profiles parsed: {len(P)}")
    for k, v in reports:
        print(f"  [report] {k}: {v}")
    if fails:
        print(f"\nFAIL — {len(fails)} finding(s):")
        for kind, slug, msg in fails[:60]:
            print(f"  [{kind}] {slug}: {msg}")
        if len(fails) > 60:
            print(f"  … and {len(fails)-60} more")
    else:
        print("\nPASS — all thirteen predicates hold.")
    return 1 if fails else 0


def self_test(path):
    """Negative controls. Every gate must FAIL on a deliberate fault before it is trusted."""
    md = pathlib.Path(path).read_text()
    base_kinds = {k for k, _, _ in check(md)[1]}
    print(f"baseline gates firing: {sorted(base_kinds) or 'none'}\n")
    def block(s, slug):
        i = s.index(f"#### `{slug}`")
        j = s.find("\n#### ", i)
        return i, (j if j > 0 else len(s)), s[i:j if j > 0 else len(s)]

    def clone_declarations(s, src, dst):
        """Copy every declared line of src onto dst — the only fault that can truly collide two profiles."""
        _, _, sb = block(s, src)
        i, j, db = block(s, dst)
        keep = [l for l in db.splitlines() if not l.startswith("**")]
        take = [l for l in sb.splitlines() if l.startswith("**")]
        return s[:i] + "\n".join(keep[:1] + take + keep[1:]) + s[j:]

    def strip_intent(s, intent, leave=0):
        """Remove an intent from every profile except the first `leave` — GAP at 0, MONOPOLY at 1."""
        seen = [0]
        def sub(m):
            seen[0] += 1
            return m.group(0) if seen[0] <= leave else "educate"
        return re.sub(rf"\b{intent}\b", sub, s)

    faults = {
        # drop a whole declared line from one profile
        "completeness": lambda s: s.replace(
            "**Density** low · **Capacity** triad · **Pace** fast · **Load** light · **Registers** editorial · confident\n", "", 1),
        # a value outside the closed set
        "vocabulary":   lambda s: s.replace("**Leads with** educate · **Also carries** persuade · compare · explain",
                                            "**Leads with** dazzle · **Also carries** persuade", 1),
        # make two profiles declare identically
        "distinctness": lambda s: clone_declarations(s, "faq-centered", "faq-single"),
        # leave a requirement with exactly one supplier
        "coverage":     lambda s: strip_intent(s, "inspire", leave=1),
        # collapse an axis onto density
        "independence": lambda s: re.sub(r"\*\*Load\*\* (light|medium|heavy)", "**Load** light", s),
        # name a successor kind nothing declares it follows
        "symmetry":     lambda s: s.replace("**Precedes** problem · capability", "**Precedes** risk", 1),

        # ── structural retrieval gates ──────────────────────────────────────────────────────────
        # two display names claiming one primitive
        "naming":       lambda s: s.replace("| Bento | `asymmetric-bento` |",
                                            "| Bento | `n-up-card-grid` |", 1),
        # a Structure that is not a declared display name
        "description":  lambda s: s.replace("**Structure** Grid · **Arrangement** `three-column-equal`",
                                            "**Structure** Trellis · **Arrangement** `three-column-equal`", 1),
        # an Arrangement borrowed from another Structure's list
        "arrangement":  lambda s: s.replace("**Structure** Grid · **Arrangement** `four-column-equal`",
                                            "**Structure** Grid · **Arrangement** `single-row`", 1),
        # a Tag that restates the Arrangement it sits beside — `cards` on a Carousel/cards
        "tags":         lambda s: s.replace(
            "**Structure** Carousel · **Arrangement** `cards` · **Interaction** `carousel`\n"
            "**Reuse** `reusable` · **Tags** `full-bleed`",
            "**Structure** Carousel · **Arrangement** `cards` · **Interaction** `carousel`\n"
            "**Reuse** `reusable` · **Tags** `cards` · `full-bleed`", 1),
        # a vocabulary value no section takes
        "unused":       lambda s: s.replace("| Marquee | `single-row` |",
                                            "| Marquee | `single-row` · `double-row` |", 1),
        # drop a section from the Layout Index while its profile still declares the structure
        "index":        lambda s: s.replace("`feature-trio` · ", "", 1),
    }
    ok = True
    for gate, mutate in faults.items():
        mutated = mutate(md)
        if mutated == md:
            print(f"  {gate:14} CONTROL DID NOT APPLY — the fault never reached the file")
            ok = False
            continue
        kinds = {k for k, _, _ in check(mutated)[1]}
        fired = gate in kinds and gate not in base_kinds
        # a gate already failing at baseline can't be controlled this way; say so rather than pass it
        if gate in base_kinds:
            print(f"  {gate:14} SKIPPED — already failing at baseline, control is meaningless")
            ok = False
        else:
            print(f"  {gate:14} {'FIRED' if fired else 'DID NOT FIRE'}")
            ok = ok and fired
    # the filename gate reads a directory, not the document, so its control is a fixture
    global SPECIMENS
    real = SPECIMENS
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        d = pathlib.Path(td)
        (d / "grid-3col-01.html").write_text("")      # abbreviated, numerically suffixed
        SPECIMENS = d
        kinds = {k for k, _, _ in check(md)[1]}
        SPECIMENS = real
        fired = "filename" in kinds and "filename" not in base_kinds
        print(f"  {'filename':14} {'FIRED' if fired else 'DID NOT FIRE'}")
        ok = ok and fired

    print("\nnegative controls: " + ("all gates proven" if ok else "INCOMPLETE — an unproven gate is an untrusted gate"))
    return 0 if ok else 1


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    target = args[0] if args else DEFAULT
    sys.exit(self_test(target) if "--self-test" in sys.argv else run(target))

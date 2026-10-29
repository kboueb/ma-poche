"""Génère le kit logo maPoche (piste F « Jeton m ») : symbole, petite taille, wordmark vectorisé, lockups, icônes."""
import os
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONT, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

# Palette
EMERALD, EMERALD_DARK = "#10b981", "#059669"
AMBER, AMBER_DARK = "#f59e0b", "#b45309"
INK, PAPER = "#0f0f13", "#f4f4f5"

# Symbole : pièce r96 centrée (128,128) ; deux fentes de 24 (rayon 12) ouvertes par le bas → m.
# Les points bas sont sur le cercle : x=88/168 → y=128+sqrt(96²-40²)=215.27 ; x=112/144 → y=128+sqrt(96²-16²)=222.66
COIN = ("M88 215.27 A96 96 0 1 1 168 215.27 V124 A12 12 0 0 0 144 124 V222.66 "
        "A96 96 0 0 1 112 222.66 V124 A12 12 0 0 0 88 124 Z")
# Petite taille (≤ 32 px) : fentes de 32 (rayon 16), plus courtes, pour qu'elles ne se bouchent pas.
# x=84/172 → y=128+sqrt(96²-44²)=213.32 ; x=116/140 → y=128+sqrt(96²-12²)=223.25
COIN_SMALL = ("M84 213.32 A96 96 0 1 1 172 213.32 V132 A16 16 0 0 0 140 132 V223.25 "
              "A96 96 0 0 1 116 223.25 V132 A16 16 0 0 0 84 132 Z")


def svg(view_box, body, title="maPoche"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}" role="img">'
            f"<title>{title}</title>{body}</svg>\n")


def write(name, content):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
        fh.write(content)


# --- Wordmark : DM Sans Bold (opsz 32) vectorisé, approche resserrée --------------------------------
font = TTFont(FONT)
font = instancer.instantiateVariableFont(font, {"wght": 700, "opsz": 32})
glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
upm = font["head"].unitsPerEm
cap = font["OS/2"].sCapHeight

TRACKING = -0.02 * upm          # -2 % : plus compact qu'en texte courant
KERN = {("P", "o"): -0.035 * upm, ("a", "P"): 0.01 * upm}


def wordmark(text_parts, cap_px, x0, baseline):
    """Retourne [(clé_couleur, d)] pour chaque partie, et la largeur totale en px."""
    scale = cap_px / cap
    x = 0.0
    prev = None
    out = []
    for key, text in text_parts:
        d = []
        for ch in text:
            if prev:
                x += KERN.get((prev, ch), 0)
            gname = cmap[ord(ch)]
            pen = SVGPathPen(glyphs)
            glyphs[gname].draw(TransformPen(pen, (scale, 0, 0, -scale, x0 + x * scale, baseline)))
            d.append(pen.getCommands())
            x += glyphs[gname].width + TRACKING
            prev = ch
        out.append((key, " ".join(d)))
    return out, (x - TRACKING) * scale


PARTS = [("ma", "ma"), ("poche", "Poche")]
SCHEMES = {
    "dark": {"coin": EMERALD, "ma": AMBER, "poche": PAPER},
    "light": {"coin": EMERALD_DARK, "ma": AMBER_DARK, "poche": INK},
    "black": {"coin": "#000000", "ma": "#000000", "poche": "#000000"},
    "white": {"coin": "#ffffff", "ma": "#ffffff", "poche": "#ffffff"},
}

# Symbole seul
for scheme, c in SCHEMES.items():
    write(f"mapoche-symbol-{scheme}.svg", svg("0 0 256 256", f'<path fill="{c["coin"]}" d="{COIN}"/>'))
    write(f"mapoche-symbol-small-{scheme}.svg", svg("0 0 256 256", f'<path fill="{c["coin"]}" d="{COIN_SMALL}"/>'))
# Masters pour export_variants (couleur de référence)
write("mapoche-symbol.svg", svg("0 0 256 256", f'<path fill="{EMERALD}" d="{COIN}"/>'))
write("mapoche-symbol-small.svg", svg("0 0 256 256", f'<path fill="{EMERALD}" d="{COIN_SMALL}"/>'))

# Lockup horizontal : pièce Ø192 dans une hauteur 256 ; capitale = 50 % du diamètre, centrée sur la pièce.
CAP_H = 96
_, wm_w = wordmark(PARTS, CAP_H, 0, 0)
GAP = 44  # ≈ largeur d'une fente × 1,8 : l'espace entre symbole et nom
h_w = round(32 + 192 + GAP + wm_w + 32)
for scheme, c in SCHEMES.items():
    parts, _ = wordmark(PARTS, CAP_H, 32 + 192 + GAP, 128 + CAP_H / 2)
    body = f'<path fill="{c["coin"]}" d="{COIN}"/>'
    body += "".join(f'<path fill="{c[k]}" d="{d}"/>' for k, d in parts)
    write(f"mapoche-horizontal-{scheme}.svg", svg(f"0 0 {h_w} 256", body))

# Lockup empilé : pièce en haut, nom centré dessous.
_, st_w = wordmark(PARTS, 72, 0, 0)
s_w = round(max(256, st_w + 64))
coin_x = (s_w - 256) / 2
for scheme, c in SCHEMES.items():
    parts, _ = wordmark(PARTS, 72, (s_w - st_w) / 2, 256 + 40 + 72)
    body = f'<path fill="{c["coin"]}" transform="translate({coin_x:.2f} 0)" d="{COIN}"/>'
    body += "".join(f'<path fill="{c[k]}" d="{d}"/>' for k, d in parts)
    write(f"mapoche-stacked-{scheme}.svg", svg(f"0 0 {s_w} {256 + 40 + 72 + 40}", body))

# Wordmark seul
ws_w = round(wm_w + 16)
for scheme, c in SCHEMES.items():
    parts, _ = wordmark(PARTS, CAP_H, 8, 8 + CAP_H)
    body = "".join(f'<path fill="{c[k]}" d="{d}"/>' for k, d in parts)
    write(f"mapoche-wordmark-{scheme}.svg", svg(f"0 0 {ws_w} {CAP_H + 40}", body))

# Icône macOS (gabarit Big Sur) : tuile 824 sur 1024 avec marge transparente, pièce = 60 % de la tuile.
scale = 824 * 0.60 / 192
tx = 512 - 128 * scale
ty = 512 - 128 * scale - 824 * 0.01  # légère remontée optique
write("mapoche-app-icon-macos.svg", svg(
    "0 0 1024 1024",
    f'<rect x="100" y="100" width="824" height="824" rx="185" fill="{INK}"/>'
    f'<rect x="101" y="101" width="822" height="822" rx="184" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>'
    f'<path fill="{EMERALD}" transform="translate({tx:.2f} {ty:.2f}) scale({scale:.4f})" d="{COIN}"/>'))
# Icône pleine (PWA maskable, Windows, Android) : fond plein, pièce dans la zone sûre (Ø 50 %).
scale = 1024 * 0.50 / 192
tx = 512 - 128 * scale
write("mapoche-app-icon-full.svg", svg(
    "0 0 1024 1024",
    f'<rect width="1024" height="1024" fill="{INK}"/>'
    f'<path fill="{EMERALD}" transform="translate({tx:.2f} {tx:.2f}) scale({scale:.4f})" d="{COIN}"/>'))

print("ok", OUT, f"horizontal {h_w}x256, stacked {s_w}, wordmark {ws_w}")

# maPoche — Logo (« Jeton m »)

## 1. Le logo
- **Idée** : une pièce dont deux fentes, ouvertes par le bas, dessinent un **m** — *ma* pièce, *mon* argent.
- **Versions** : horizontale (principale) · empilée · symbole seul · nom seul.
- **Fichiers** (`svg/`) : `mapoche-<version>-<fond>.svg`, où `<fond>` vaut `dark` (sur fond sombre), `light` (sur fond clair), `black` / `white` (une couleur).
  - `mapoche-symbol-small-*.svg` : dessin simplifié (fentes élargies) pour **32 px et moins** — favicon, barre de menus.
  - `mapoche-app-icon-macos.svg` / `app-icon-1024.png` : icône macOS (gabarit Big Sur, marge transparente). Source de `npx tauri icon`.
  - `mapoche-app-icon-full.svg` : icône pleine (PWA « maskable », Android, Windows).
- Dans l'app : composant `src/components/ui/Logo.tsx` (`<Logo />`, `<LogoMark />`).

## 2. Zone de protection
Garder autour du logo un espace libre d'au moins **la largeur du jambage central du m** (1/6 du diamètre de la pièce). Cette zone grandit avec le logo.

## 3. Tailles minimales
| Version | Écran |
|---|---|
| Horizontale | 96 px de large |
| Symbole | 16 px (utiliser `symbol-small` sous 32 px) |

## 4. Couleurs
| Nom | HEX | Usage |
|---|---|---|
| Émeraude | `#10b981` | Pièce sur fond sombre (= `brand-500` de l'app) |
| Émeraude foncé | `#059669` | Pièce sur fond clair (contraste ≥ 3:1) |
| Ambre | `#f59e0b` | « ma » sur fond sombre |
| Ambre foncé | `#b45309` | « ma » sur fond clair (contraste ≥ 4.5:1) |
| Encre | `#0f0f13` | « Poche » sur fond clair, tuile d'icône |
| Papier | `#f4f4f5` | « Poche » sur fond sombre |

**Associations autorisées** : `dark` sur encre · `light` sur blanc/papier · `white` sur émeraude ou photo sombre · `black` sur fond clair uni.

## 5. Typographie
- Nom : **DM Sans Bold** (opsz 32), approche −2 %, couple « Po » resserré — vectorisé dans les SVG, ne pas le retaper.
- Licence : SIL Open Font License 1.1 (`DMSans-OFL.txt`), usage en logo autorisé.

## 6. À ne pas faire
Ne pas déformer, pivoter, recolorer hors palette, ajouter ombre/contour/dégradé, réordonner « ma » et « Poche », ni poser le logo couleur sur un fond chargé.

## 7. Régénérer le kit
```bash
# DM Sans variable : https://github.com/google/fonts/tree/main/ofl/dmsans
python3 design/brand/build_kit.py <chemin>/DMSans[opsz,wght].ttf design/brand/svg
npx tauri icon design/brand/app-icon-1024.png -o src-tauri/icons
```
Les icônes web de `public/` (favicon, PWA) ont été exportées avec le skill `logo-design` (`export_variants.py --web-icons`).

> Recherche d'antériorité à faire avant usage commercial (INPI / EUIPO) : un « m » dans un cercle est une forme répandue.

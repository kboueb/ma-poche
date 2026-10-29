# maPoche — Plan d'action

## Objectif
Passer en production stable : snapshots patrimoine, justificatifs, factures, mises à jour automatiques fonctionnelles, et tests de régression.

Version actuelle : `1.7.0` (`package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`).

---

## Phase 0 : Bloquant — à faire avant tout le reste

- [ ] **Sauvegarder la clé de signature Tauri** hors de la machine : `~/.tauri/mapoche.key` + son mot de passe dans un gestionnaire de mots de passe, plus une copie chiffrée ailleurs.
  Sans cette clé, plus aucune mise à jour ne peut être installée par les utilisateurs existants (irréversible).
  Le mot de passe est aujourd'hui stocké en clair à côté de la clé (`mapoche.key.password`) : un seul vol ou une seule panne de disque fait tout perdre d'un coup.
- [ ] **Versionner `src-tauri/`** : tout le dossier (code Rust, `tauri.conf.json`, icônes, `Cargo.lock`) est aujourd'hui hors git. `src-tauri/target` est déjà ignoré, donc `git add src-tauri .gitignore` suffit.
- [ ] Commiter le nettoyage git déjà en cours (`node_modules/` et `dist/` retirés de l'index).
- [ ] Retirer aussi `tsconfig.tsbuildinfo` du suivi : `git rm --cached tsconfig.tsbuildinfo` + l'ajouter à `.gitignore`.

**Terminé quand :** la clé est restaurable depuis une autre machine, et `git status` est propre après un `npm install && npm run build`.

---

## Phase 1 : Migrations Supabase

### État des lieux
11 fichiers dans `supabase/migrations/`, sans numérotation ni suivi de ce qui est appliqué en prod.
Ordre imposé par les dépendances (clés étrangères) :

| # | Fichier | Dépend de | Appliqué en prod ? |
|---|---------|-----------|--------------------|
| 1 | `init.sql` | — | ? |
| 2 | `fix_schema.sql` | init | ? |
| 3 | `add_patrimoine_snapshots.sql` | init (budgets, transactions) | ? |
| 4 | `add_attachments.sql` | init (transactions) | ? |
| 5 | `add_updates_bucket.sql` | — | ? |
| 6 | `add_projects.sql` | — | ? |
| 7 | `fix_missing_buckets.sql` | — (doublon partiel de 5, idempotent) | ? |
| 8 | `harden_rls.sql` | tables ci-dessus | ? |
| 9 | `add_invoices.sql` | projects, transactions | ? |
| 10 | `add_time_tracking.sql` | projects | ? |
| 11 | `add_invoice_payments.sql` | invoices, transactions | ? |

- [ ] Remplir la colonne « Appliqué » (vérifier dans Supabase → Table Editor que les tables existent).
- [ ] Appliquer les manquantes dans l'ordre ci-dessus.
- [ ] **Ensuite :** passer au CLI Supabase pour ne plus copier-coller à la main :
  `supabase link` → renommer les fichiers au format horodaté (`20260425000000_init.sql`…) → `supabase migration repair --status applied <versions>` pour celles déjà en prod → désormais `supabase migration new <nom>` + `supabase db push`.

**Terminé quand :** `supabase migration list` montre local = distant.

---

## Phase 2 : Fonctionnalités factures (avant la 1.8.0)

| Tâche | Fichiers | Terminé quand… |
|-------|----------|----------------|
| Conditions de paiement (échéances, % à payer) | `src/features/invoices/InvoicesPage.tsx`, nouvelle migration | On peut définir N échéances dont la somme des % = 100, et elles s'affichent sur la facture |
| Statut « payé » lié aux transactions | `src/stores/useInvoicesStore.ts`, `invoice_payments` | Une facture passe à « payée » quand la somme de ses paiements atteint son total, « partiellement payée » entre les deux |
| Notifications d'échéances | `src/features/schedule/SchedulePage.tsx`, `@tauri-apps/plugin-notification` | Une notification part à J-3 et à J pour chaque échéance non payée |

---

## Phase 3 : Tests de régression (avant la 1.8.0)

Aujourd'hui : 6 fichiers de tests, tous sur `src/lib/utils/`. Aucun test sur les stores ni les pages.

- [ ] `useInvoicesStore` : calcul du statut payé / partiel / en retard, paiements partiels.
- [ ] `useTransactionsStore` : création, suppression, transactions récurrentes.
- [ ] Échéancier : génération des échéances à partir des conditions de paiement.

**Terminé quand :** `npm test` couvre ces cas et passe ; le script de release le lance automatiquement.

---

## Phase 4 : Publication 1.8.0

Tout est automatisé par `scripts/release.sh` :

```bash
SUPABASE_SERVICE_ROLE_KEY=xxx scripts/release.sh 1.8.0 "Factures : échéances, paiements partiels, notifications"
```

Le script :
1. Vérifie que le working tree est propre et que la version est supérieure à l'actuelle.
2. Met à jour la version dans `package.json`, `package-lock.json`, `tauri.conf.json`, `Cargo.toml`.
3. Lance `npm test`, puis `npm run tauri:build` signé avec `~/.tauri/mapoche.key`.
4. Génère `latest.json` (Tauri ne le fait pas tout seul) à partir du `.sig`.
5. Demande confirmation, puis uploade l'archive (nom versionné) **puis** `latest.json` dans le bucket `updates`.
6. Commit `release: v1.8.0` + tag `v1.8.0`.

- [ ] Tester : lancer une install 1.7.0 → la bannière 1.8.0 apparaît → la mise à jour s'installe et l'app redémarre en 1.8.0.
- [ ] `git push && git push --tags`

---

## Phase 5 : Maintenance

- Mettre à jour les dépendances Tauri en gardant les versions npm (`@tauri-apps/*`) et les crates Rust (`tauri-plugin-*`) alignées.
- Documentation utilisateur : installation, mise à jour, sauvegarde des données.
- Ménage : supprimer les vieux artefacts dans `src-tauri/target/release/bundle/` (ex. `rw.*_1.3.2_aarch64.dmg`).

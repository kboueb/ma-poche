# maPoche — Plan d'action

## Objectif
Passer en production stable : snapshots patrimoine, justificatifs, factures, mises à jour automatiques fonctionnelles, et tests de régression.

Version actuelle : `1.8.0` (publiée le 2026-10-29) (`package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`).

---

## Phase 0 : Bloquant — à faire avant tout le reste

- [x] **Sauvegarder la clé de signature Tauri** (clé chiffrée dans iCloud Drive `maPoche-sauvegarde-cle/`, mot de passe dans le gestionnaire) hors de la machine : `~/.tauri/mapoche.key` + son mot de passe dans un gestionnaire de mots de passe, plus une copie chiffrée ailleurs.
  Sans cette clé, plus aucune mise à jour ne peut être installée par les utilisateurs existants (irréversible).
  Le mot de passe est aujourd'hui stocké en clair à côté de la clé (`mapoche.key.password`) : un seul vol ou une seule panne de disque fait tout perdre d'un coup.
- [x] **Versionner `src-tauri/`** et tout le code qui était hors git (missions, temps, factures, stores, tests, migrations) — fait le 2026-10-29.
- [x] Commiter le nettoyage git (`node_modules/` et `dist/` retirés de l'index).
- [x] Retirer `tsconfig.tsbuildinfo` du suivi et l'ignorer.

**Terminé quand :** la clé est restaurable depuis une autre machine, et `git status` est propre après un `npm install && npm run build`.

---

## Phase 1 : Migrations Supabase

### État des lieux
11 fichiers dans `supabase/migrations/`, sans numérotation ni suivi de ce qui est appliqué en prod.
Ordre imposé par les dépendances (clés étrangères) :

| # | Fichier | Dépend de | Appliqué en prod ? |
|---|---------|-----------|--------------------|
| 1 | `init.sql` | — | ✅ |
| 2 | `fix_schema.sql` | init | ✅ |
| 3 | `add_patrimoine_snapshots.sql` | init (budgets, transactions) | ✅ |
| 4 | `add_attachments.sql` | init (transactions) | ✅ |
| 5 | `add_updates_bucket.sql` | — | ✅ |
| 6 | `add_projects.sql` | — | ✅ |
| 7 | `fix_missing_buckets.sql` | — (doublon partiel de 5, idempotent) | ✅ |
| 8 | `harden_rls.sql` | tables ci-dessus | ✅ |
| 9 | `add_invoices.sql` | projects, transactions | ✅ |
| 10 | `add_time_tracking.sql` | projects | ✅ |
| 11 | `add_invoice_payments.sql` | invoices, transactions | ✅ |
| 12 | `add_clients_quotes.sql` | projects, time_entries, invoices | ✅ |

- [x] Remplir la colonne « Appliqué » (vérifier dans Supabase → Table Editor que les tables existent).
- [x] Appliquer les manquantes dans l'ordre ci-dessus.
- [ ] **Ensuite :** passer au CLI Supabase pour ne plus copier-coller à la main :
  `supabase link` → renommer les fichiers au format horodaté (`20260425000000_init.sql`…) → `supabase migration repair --status applied <versions>` pour celles déjà en prod → désormais `supabase migration new <nom>` + `supabase db push`.

**Terminé quand :** `supabase migration list` montre local = distant.

---

## Phase 2 : Fonctionnalités factures (avant la 1.8.0)

| Tâche | Fichiers | Terminé quand… |
|-------|----------|----------------|
| ✅ Conditions de paiement (échéances, % à payer) | `InvoicesPage.tsx`, `lib/utils/invoicePayments.ts` | Fait : échéances en % du TTC (au centime), ajout/suppression depuis le détail |
| ✅ Statut « payé » lié aux transactions | `useInvoicesStore.ts` | Fait : chaque échéance payée crée une recette liée à la mission ; la dernière solde la facture. Affichage « x/y payées » dans la liste |
| ✅ Échéances de factures dans l'échéancier | `upcomingPayments.ts`, `SchedulePage.tsx` | Fait : échéances non réglées des factures envoyées, rappel à J-3 |
| ✅ Rappels hors de l'échéancier | `hooks/useDueReminders.ts`, `lib/utils/reminders.ts` | Fait : au démarrage puis toutes les heures, réglage persistant ; factures en retard notifiées à part, bouton « Relancer le client » (mailto) |
| ✅ Prévision de trésorerie | `lib/utils/cashForecast.ts`, `schedule/ForecastCard.tsx` | Fait : solde projeté 30/60/90 j, point bas, alerte découvert, scénario sans paiements clients |
| ✅ Provision impôts & charges | `lib/utils/taxProvision.ts`, `hooks/useTaxProvision.ts` | Fait : % du CA missions de l'année − impôts payés ; « disponible réel » au tableau de bord, seuil sur la prévision |

---

## Phase 2 bis : Missions (inspiré de Harvest, Freebe, Bonsai, Productive, Float)

Calculs purs dans `lib/utils/missionMetrics.ts` (testés). Nécessite la migration 12.

| Tâche | Fichiers | État |
|-------|----------|------|
| ✅ Fiche client (coordonnées, CA, encours, délai moyen de paiement) | `features/clients/ClientsPage.tsx`, `stores/useClientsStore.ts` | Fait |
| ✅ Forfait / TJM / horaire, budget en jours (alerte 80 %), TJM réel | `ProjectsPage.tsx` | Fait |
| ✅ Devis → mission + jalon d'acompte | `features/quotes/QuotesPage.tsx`, `stores/useQuotesStore.ts` | Fait |
| ✅ Bilan prévu vs réel à la clôture | `ProjectsPage.tsx` | Fait |
| ✅ Modèles de mission (tâches + jalons) | `stores/useTemplatesStore.ts` | Fait |
| ✅ Régie mensuelle : brouillons de factures du mois | `InvoicesPage.tsx` (`?regie=AAAA-MM`) | Fait |
| ✅ Charge 3 mois vs capacité (réglages : heures/jour, jours dispo/mois) | `MissionsDashboard.tsx`, `SettingsPage.tsx` | Fait |
| ✅ Appliquer `add_clients_quotes.sql` en prod | — | Fait le 2026-10-29 |
| [ ] Publier la version | `scripts/release.sh` | À faire |

---

## Phase 3 : Tests de régression (avant la 1.8.0)

73 tests (11 fichiers) au 2026-10-29.

- [x] `useInvoicesStore` : paiement d'échéance, recette liée, facture soldée à la dernière échéance (Supabase mocké).
- [ ] `useTransactionsStore` : création, suppression, transactions récurrentes.
- [x] Échéancier : échéances des factures (envoyées / brouillons / payées).

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
- [x] `git push && git push --tags` (v1.8.0)

---

## Phase 5 : Maintenance

- Mettre à jour les dépendances Tauri en gardant les versions npm (`@tauri-apps/*`) et les crates Rust (`tauri-plugin-*`) alignées.
- Documentation utilisateur : installation, mise à jour, sauvegarde des données.
- Ménage : supprimer les vieux artefacts dans `src-tauri/target/release/bundle/` (ex. `rw.*_1.3.2_aarch64.dmg`).

<!-- nur-mit-lizenz -->
# Usage limits and licensing

journali counts maintenance, not users and not products. The unit is the **journali token**: an entry in the journal that is maintenance or publication.

## What counts

| Counts | Does not count |
|---|---|
| naming, setting every value, status, identifier, order | model: attributes, groups, lists, views, languages, channels |
| creating and retiring nodes, rows, assets, relations | structure: publication trees, rubrics |
| releasing and revoking, versions | setup: users, roles, teams, plugins, workflows |
| translation orders, workflow steps | operations: job runs, backup, logs |
| import and copying, one entry per changed value | reading and exporting |

Usage cannot be reset, it is the journal. A licence can set a **counting start**: what lies before it stays and no longer counts, for example after a migration.

## Limits per week and month

The limits hang on the team, at the end of the billing chain. The header shows two bars: what has been used this week and this month; ⚙ Settings → ◍ Team shows what is available, with history. When a limit is reached, the server rejects every entry that counts; everything else continues. The week starts on Monday, the month on the first.

## Tiers

| Tier | Week / month | Publication trees | Plugins |
|---|---|---|---|
| Free | 10 000 / 50 000 | 1 | Table, Excel add-in, OnlyOffice, previews, export |
| Pro | 50 000 / 250 000 | 5 | plus data sheet, translation, template export, ETIM, data analysis, backup as job |
| Pro+ | 50 000 / 250 000 | 5 | all |
| Enterprise | 200 000 / 1 000 000 | unlimited | all |
| Unlimited | unlimited | unlimited | all |

Limits apply per team; plugins and publication trees apply to the whole instance according to its highest tier. Prices are in the shop.

## Trial and Free

Every new instance has three months of Enterprise from the first journal entry. After that, and after every licence expires, Free applies. A restored instance does not start the trial anew; the first day comes from the journal.

## Renewing in time

The operator is responsible for a suitable plan and for renewing it in time. When a limit is reached or a plan ends, journali accepts no further counted changes; reading, exporting and backing up continue. 14 days before a trial, a licence, a key or a subscription that does not renew itself (for example cancelled) ends, ⏳ appears in the header — for everyone who leads the team, and for administration. A running subscription renews itself.

## Licence and keys

A licence is issued for the **instance**, whose identifier is under ◍ Team, and belongs to a team. It arrives as text and is pasted into the field under ⚿ journali licence. Two ways:

- **Subscription**: the key from the shop is pasted; the instance confirms it daily with the licence server. Without a connection the last confirmed state applies for seven days, then trial operation. A tier change takes effect immediately, a cancellation at the end of the paid period.
- **Without internet**: the instance generates a signed request that is submitted by copy; back comes a key with a fixed term for the same field.

A **reset key** resets a team's quota in the current period, separately for Pro and Enterprise. It is redeemed at the team that carries its own quota.

## Several teams

The Init Team carries the limits of the licence. Every further team has what the licence assigns to it by name, otherwise nothing; then it is billed via another team. Whoever wants central billing puts the subscription on the Init Team.

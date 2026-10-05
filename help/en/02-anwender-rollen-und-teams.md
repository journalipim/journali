# Users, roles and teams

<!-- lizenz -->
Three terms that work together: the **user** is a person with a login, the **role** says what they may do, the **team** says whose quota and whose AI keys they use.
<!-- /lizenz -->
<!-- startphase -->
Three terms that work together: the **user** is a person with a login, the **role** says what they may do, the **team** says whose AI keys they use.
<!-- /startphase -->

## Users

A user has a login name, a display name, a role and a team. The login name appears as author in every journal entry the person writes. Passwords are kept as an encrypted hash in the database, never in the journal; every server on the same database knows them. A user can be locked and unlocked; the last user with the right to manage users can be neither locked nor removed.

Under ◐ Me every person changes their password and creates **API tokens**: for the Excel add-in, OnlyOffice and scripts. A token acts with the rights of the person; what it writes is attributed to their team. The token is visible only when created.

## Roles and rights

A role is a set of rights. Preset are:

| Role | Rights |
|---|---|
| Administrator | all |
| PIM manager | read, write, retire, release, model, jobs |
| PIM editor | read, write, retire, release |
| Team admin | read, write, team |
| Reader | read |

The rights in detail:

| Right | Allows |
|---|---|
| read | view tree, values, media, journal, model |
| write | write nodes, values, relations, media, batches, profiles, documents |
| retire | retire and restore nodes |
| release | releases and versions |
| model | change attributes, groups, lists, views, units, languages, channels, relation types |
| plugins | install, enable, disable and remove plugins |
| jobs | create and start jobs, read logs |
| storage | configure and copy the asset store |
| team | lead the own team: members and AI keys |
| users | manage users and roles |

Own roles are created under ◈ IAM. A role with users cannot be retired, and the right to manage users cannot disappear from the last role an active user has.

## Teams

<!-- lizenz -->
A team is a group of people working on the whole system. The quota of journali tokens, the AI keys and the AI exchange volume hang on it. Every installation brings the **Init Team**: not deletable, renamable, carrier of the limits from the licence. Whoever has no own team works there.
<!-- /lizenz -->
<!-- startphase -->
A team is a group of people working on the whole system. The AI keys and the AI exchange volume hang on it. Every installation brings the **Init Team**: not deletable, renamable. Whoever has no own team works there.
<!-- /startphase -->

<!-- lizenz -->
Managing and belonging are two different things: a person can be **manager** of several teams but **member of only one**. A team can be billed via another team; the chain must not form a circle. The bars in the header always show the team of membership at the end of this chain.
<!-- /lizenz -->
<!-- startphase -->
Managing and belonging are two different things: a person can be **manager** of several teams but **member of only one**. A team can use the AI keys of another; the chain must not form a circle.
<!-- /startphase -->

<!-- lizenz -->
## What happens without quota

A team without quota cannot maintain data: every entry that costs journali tokens is rejected. Modelling, structuring, setup and operations cost nothing and continue. What counts and what does not is in the chapter Usage limits and licensing.
<!-- /lizenz -->

## Jobs and the system

Jobs receive a service token per run with the role PIM editor, which expires with the run. Entries of the system itself, for example at startup or during a backup, carry the author system.

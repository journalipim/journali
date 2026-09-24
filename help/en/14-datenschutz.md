# Privacy

What journali stores about people, where it lives and what happens with it.

## People in the journal

Per user the journal holds: login name, display name, e-mail, role, team and whether the account is active. Every journal entry carries the login name of its author; that is the basis of the history and cannot be removed because an entry is never changed.

## What is not in the journal

| What | Where |
|---|---|
| passwords | as a hash in a file on the server |
| API tokens and sessions | as a hash in the same file |
| AI keys, credentials of jobs | secrets on the server, on the team or on the profile |
| mail password, storage credentials | settings files on the server |

These files go along with the backup, not with an export.

## Locking and removing

A user can be locked; the login expires, the entries stay. Removing takes away login, tokens and sessions; even then the entries with the login name as author stay.

## Artificial intelligence

journali has no AI provider of its own and no key of its own. A team stores the key of its provider; the provider is the team's contractual partner. Requests go through the server; the browser never sees the key. journali measures only what was sent and received, in bytes, and shows it as exchange volume; about the provider's tokens and costs journali says nothing and stores nothing.

What goes to the provider are the product data of the respective node and the task. Personal data of users does not go along.

## Licence server

With a subscription, the instance confirms its key daily with the licence server. Transmitted are the identifier of the instance, the team and the key; the answer is the tier with its term. Addresses of users do not go to the licence server.

## Planned

For personal data in product data, a procedure is intended in which such values lie encrypted in the journal with a key per person; deleting then means destroying the key while the journal stays unchanged.

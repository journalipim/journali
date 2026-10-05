# Privacy

What journali stores about people, where it lives and what happens with it.

## People in the journal

Per user the journal holds: login name, display name, e-mail, role, team and whether the account is active. Every journal entry carries the login name of its author; that is the basis of the history and cannot be removed because an entry is never changed.

## What is not in the journal

| What | Where |
|---|---|
| passwords | as a hash in the vault of the database, encrypted |
| API tokens and sessions | as a hash in the same vault |
| AI keys, credentials of jobs, mail password | in the same vault, on the team or on the profile |
| storage credentials, connection to the database | settings files on the server |

These files go along with the backup, not with an export.

## Locking and removing

A user can be locked; the login expires, the entries stay. Removing takes away login, tokens and sessions; even then the entries with the login name as author stay.

## Artificial intelligence

journali has no AI provider of its own and no key of its own. A team stores the key of its provider; the provider is the team's contractual partner. Requests go through the server; the browser never sees the key. journali measures only what was sent and received, in bytes, and shows it as exchange volume; about the provider's tokens and costs journali says nothing and stores nothing.

What goes to the provider are the product data of the respective node and the task. Personal data of users does not go along.

<!-- lizenz -->
## Licence server

With a subscription, the instance confirms its key daily with the licence server. Transmitted are the identifier of the instance, the team and the key; the answer is the tier with its term. Addresses of users do not go to the licence server.
<!-- /lizenz -->
<!-- startphase -->
## Licence server

This version asks no licence server: neither the identifier of the instance nor details of teams or users go to journali.
<!-- /startphase -->

## Usage reports

Under ≡ Journal → ▦ per month you see how many entries of which kind went into the journal per month; ⇩ CSV saves the table. An administrator can turn on usage reports there. Then exactly this table goes to the journali licence server once a month, together with the version and a random identifier created when the reports are first turned on. Names, content, licence data and the identifier of the instance are not included. The licence server sees the IP address of the server. The default is off; turning reports on and off is recorded in the journal with its author and wording.

## Files on the first run

Two plugins fetch a file from the net on their first run: Embeddings the model (huggingface.co), text recognition the language data (cdn.jsdelivr.net). No product file and no value goes out; the addresses only see the request. A machine without net access gets the files copied. When one of these plugins is enabled, journali asks first, naming purpose, file, address and size; without consent the plugin stays off.

## Planned

For personal data in product data, a procedure is intended in which such values lie encrypted in the journal with a key per person; deleting then means destroying the key while the journal stays unchanged.

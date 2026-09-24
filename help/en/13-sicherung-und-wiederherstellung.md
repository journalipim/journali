# Backup and restore

A backup is a full backup into a directory on the server: the journal with all entries, the assets, the files next to the journal and the plugin directories.

## By hand

⚙ Settings → ⇅ B&R backs up on button press into a chosen directory and shows beforehand what this system has and what is in the directory: entries, assets, files, plugins. Assets from the database go along; if they live in a directory or in S3, the server's operations back that up.

## Backing up the database itself

Whoever backs up the database with their own tools finds its connection under ⚙ Settings → ⇅ B&R → **⛁ Database**:
host, port, database and login name. The password is hidden; showing it asks in a separate window for your own login password, and after a minute
it is hidden again. The section is visible to whoever manages users and roles.

## As a job

The plugin Backup runs as a job with a schedule: one folder with timestamp per run, older ones are removed according to retention. It belongs to the tier Pro.

## What goes along

| Part | Content |
|---|---|
| Journal | all entries, in the order of their numbers |
| Assets | the files by checksum |
| Credentials | logins and password hashes, tokens, storage and mail settings, secrets of the jobs |
| Plugins | the directories without packages |

What does not go along is the identifier of the instance: a restored installation gets a new one, and a licence applies only to the instance for which it was issued.

## Restoring

Restoring goes only into an **empty** system, otherwise the entry numbers would collide. The server then rebuilds its projections from the journal. The first day of the trial comes along from the journal; a restored system does not start the trial anew.

A **subtree** from a JSON export can also be restored into a full system: create new, align, bring back, with model part.

## Mirror and snapshot

Two copies that make startup fast, both only a cache: the **mirror** holds the journal entries as a file next to the server, the **snapshot** the state of all projections. At startup everything up to the mirror state comes from disk, only the rest from the database; the last entry is checked against the database. Both can be switched on and off under ▨ Storage → Startup and discarded at any time; the next startup reads again.

## Test and production

Whoever runs a test instance next to production restores a backup of production into the empty test instance. The test instance gets its own identifier and its own licence.

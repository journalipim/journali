# What journali is

journali manages product data: product groups, products and variants with their values, images, documents and relations, in several languages and for several channels. Shops, catalogues, data sheets and interfaces are fed from it.

## The journal

Every change is an entry in a journal: a node is created, a value is set, an image is assigned, a release is granted. An entry is never overwritten and never deleted. The current state of the data is derived from all entries, as is every version, every export and every history.

Three consequences are visible in everyday work:

- **Nothing is lost.** A retired node, an overwritten value, a removed image stay in the journal and can be brought back. Undo is not a special case, it is another entry.
- **Every state is traceable.** For every value it is known who set it when and what applied before. A version freezes a journal state and attaches the documents that went out with it.
- **Projections are replaceable.** Tree, model, search and statistics are built from the journal. If they are damaged, they are rebuilt, not repaired.

## The axes

A value can differ per **language** and per **channel**. The star is the value without language and without channel; the master language and the master channel are the reference points from which other languages and channels take their value as long as they have nothing of their own. Values are **inherited** down the tree when the attribute is inheritable.

## The building blocks

| Block | What it is |
|---|---|
| Model | attributes, attribute groups, value lists, views, units, languages, channels, statuses |
| Maintenance tree | product groups, products, variants with their values |
| Media | images and documents, stored once, assigned to nodes |
| Publication | one tree per channel that determines what goes out |
| Plugins | import, export, data sheets, translation, checks, jobs |
| Journal | the history of all changes, with filter and search |

## Where things live

Everything factual is in the journal in the database. Images and documents live in the asset store, in the database, in a directory or in an S3-compatible store. Passwords, tokens, mail and storage settings are kept in files next to the server, never in the journal.

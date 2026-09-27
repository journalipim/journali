# Media

Images and documents are called assets in journali. An asset is stored once and assigned any number of times.

## Library

▨ Media shows all assets with folders, search across name, identifier and values, sorting and grouping. Uploading works via button or by dragging; a file that already exists is recognised by its content and not stored twice. Folders are a filing system for the library; they change nothing about the assignments.

An asset carries its own values: alt text per language, copyright, plus size, type and checksum. Retiring takes it out of the library; the file stays in the store, and the journal still knows it.

## Assignment at the node

At the node the assets are under ▩ Assets. Files can be dropped there or chosen from the library, with folders, search and multi-select. An assignment is a relation of type image or document with values: order, usage, and whether it is **inherited by subitems**.

Inherited means: the asset applies at all nodes below, without a copy. An inherited asset cannot be removed at a node, only **blocked**; then it no longer applies there and at everything below, and the block can be lifted again. Tidy up sets the assets of a node to inherit and detaches identical fixed assignments at the subitems.

## Previews

For every image and every first PDF page a job renders previews according to the **presets** under ⚙ Settings → ▩ Assets: tile, web, print, with size, format and quality. The job runs by itself after every upload and after every preset change; the button is only the catch-up. The inventory shows how many assets are derivable, how many were rendered, which are unused and which have the same content.

## Storage

Where the bytes live is set under ⚙ Settings → ▨ Storage: in the database, in a directory on the server or in an S3-compatible store. The journal knows only the checksum; the driver can be swapped. After a switch, the asset migration fetches what is missing in the new store.

## Searching documents

The job Read documents extracts the text from PDF, text, HTML, Markdown and XML at the nodes and puts it into an index. ⌕ Documents searches it for words, numbers and standards and jumps to the node and the page.

PDFs without a text layer are pictures of text. The job Text recognition (plugin ocr) recognises them and puts the text into the same index; an image joins this list when it carries the keyword “Recognise text”. Recognition runs on the server, without a key and without an external service.

## Search by meaning

Next to the word search there is the search by meaning. It finds sections that mean the same as the question even when no word matches: “waterproof glue for garden furniture” finds the section on wood adhesive for outdoor use. In ⌕ Documents the choice is three chips: Words, Meaning, Both. Words is exact for numbers, standards and identifiers; Meaning is good for paraphrases; Both merges the two rankings. A hit of the meaning search shows its similarity in percent. There is no “found or not”, only nearer or farther, so the meaning search always has hits, weak ones included.

How it works: the plugin Embeddings computes for every section of a document a list of 384 numbers, a vector. It is the position of the text in a space of meanings; two texts that mean the same lie close together. The question takes the same path and becomes a vector; the search returns what lies nearest to it. The vectors live in the database next to the text. They are derived: when a document changes, the job recomputes them.

The same applies to nodes: name, path and values become one vector per language. The band ≈ Similar nodes in the node view shows the nodes nearest to the open one.

The model for this is small, multilingual and runs on the server, inside the plugin Embeddings. On the first run of the job it fetches itself from the net (about 120 MB) and then stays in the plugin's directory; after that nothing needs the net, no key, no external service, no volume. A machine without net access gets the directory copied.

## Asking the documents

Below the search there is a field for a question. The server picks the best matching sections (words and meaning) and hands them, numbered, to the team's AI with the instruction to answer only from them. Every statement in the answer carries the number of its source; below it the sources are listed with document, page and the nodes it is attached to. Unlike the search, the question needs an AI key at the team, because it is an AI call and is counted like any other. If the answer is not in the documents, the AI says so.

## Tables from a document

A data sheet dropped onto a node with the Control key held is attached and evaluated: the reader finds the tables with key and value, and a dialog shows for each row the matching attribute, or proposes a new one with type and unit taken from the value. Nothing is written before ✓. New attributes go into the group “From document” and can be arranged in the model later.

## Visible to roles

A folder of the library can name roles that see it (🔒 at the folder). This applies to its subfolders and the media inside. Whoever lacks the role sees the folder nowhere: not in the library, not at the node, not as a file. Administrators always see everything; empty means for everyone. The same exists in the tree for a subtree.

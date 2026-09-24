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

The job Read documents extracts the text from PDF, text, HTML, Markdown and XML at the nodes and puts it into an index. ⌕ Documents searches it for words, numbers and standards and jumps to the node and the page. PDFs without a text layer need text recognition first.

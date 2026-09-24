# Import and export

Import and export are plugins. The base plugin Table brings the basic function; formats such as CSV, Excel, JSON, IXP and Solr attach to it.

## Table import

⇩ Import → Table takes a file by dragging or choosing, a sheet from Excel or rows from the clipboard; the first row holds the column names. Four steps:

1. **Source**: file, sheet, recently used files.
2. **Target**: where new rows go. Existing nodes are found via the journali identifier, the SKU or an external identifier; a column Parent places rows in the tree.
3. **Mapping**: the data mapper recognises columns by key, label, synonyms and language in the name, proposes types for new attributes and maps external statuses to the model. Per column a transformation chain can be set: number, yes/no, date, replace, split, join, condition.
4. **Plan**: analysing shows what would be new, changed and unchanged, which values do not fit the type and what the model still needs. Writing happens only on button press, as one batch.

A mapping with target and rules can be saved as a **profile** and repeated as a job.

## Table export

⇪ Export → Table delivers a subtree as Excel or CSV: roles, languages, attributes, own or also inherited values. The file is built so that the table import reads it again, with identifiers and root. The template for a node is also available via right-click in the tree.

## JSON

The JSON export writes a subtree as raw data, optionally with the model part, so that it can be restored into another system; or evaluated as tree or list. The JSON import recognises both.

## Template export

⇪ Export → Template builds a file from a text template with fields, loops and sections: BMEcat with ETIM, Google Merchant, JSON or your own definition. The source is a publication tree or a subtree; header values, mapping and language are kept in the profile. For ETIM, blocks can be set: class is required, values must fit, minimum share of filled features.

## External sources

The plugins IXP and Solr read a foreign tree, show it for selection, map properties to attributes and write a subtree with media and relations. Credentials are kept on the profile on the server, never in the journal.

## As a job

Every import and export can be set up under ⏱ Jobs with profile, directory and schedule. A repeated import without changes writes no entry; an import writes exactly one entry per changed value.

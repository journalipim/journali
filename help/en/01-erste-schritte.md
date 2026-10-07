# First steps

The order after installation. Each step builds on the previous one; everything can be changed later because every change is a journal entry.

## 1. Database, administrator and team

In the package the database comes along and the server finds it by itself. If it finds none, or the database refuses
the login, the browser shows the **Database** dialog: host, port, database, login name, password. It also asks for the
**setup code** that the server writes to its console. If the database is only briefly unreachable, the server keeps
trying by itself.

<!-- lizenz -->
Then the first administrator is created, also with the setup code. After that every access requires a login. The administrator belongs to the **Init Team** that every installation brings along: it carries the limits of the licence and can be renamed but not deleted.
<!-- /lizenz -->
<!-- startphase -->
Then the first administrator is created, also with the setup code. After that every access requires a login. The administrator belongs to the **Init Team** that every installation brings along: it can be renamed but not deleted.
<!-- /startphase -->

Further users with role and team are added under ⚙ Settings → ◈ IAM. Roles bundle rights; the preset ones are Administrator, PIM manager, PIM editor, Team admin and Reader.

Whoever administers the installation then confirms the **notes on operation** once: journali is a test version for testing and evaluation, free of charge and with limited liability; backup and testing the restore are the operator's responsibility. The confirmation is recorded in the journal with version and wording; if the wording changes, it is asked again.

## 2. Languages and channels

Under ⊞ Model → Languages and Channels are the axes of the data. Preset are German and English and the channels Web and Print. The master language is the language in which required fields are entered; when a value changes there, the other languages count as to be revised.

## 3. Attribute groups and attributes

An attribute has a key, a type, a group and axes: language-dependent, channel-dependent or both. The group hangs on a node of the tree and applies from there downwards; **active from** says from which node type values are entered. The key of an attribute is forever.

Value lists provide the allowed values for attributes of type list. An entry has a key, a label per language and its own columns, for example a RAL number for colours.

## 4. The tree

The maintenance tree begins with a root to which the seed's attribute groups are attached. Below it, product groups, products and variants are created, by hand via ＋ in the tree or by import.

## 5. Import

⇩ Import → Table takes CSV, Excel, JSON and the clipboard. The data mapper recognises columns by key, label and synonyms, proposes types for new attributes and shows a plan before anything is written. A mapping can be saved as a profile and repeated as a job.

## 6. Media

Images and documents go into the library under ▨ Media or directly to the node. A medium is stored once and assigned to any number of nodes; an assignment can be inherited by all subitems. Previews are rendered by a background job.

## 7. Release and publication

A variant can be released when its required fields for channel and language are filled. A publication tree per channel defines which rubrics exist and which products are in them. What goes out is what is released and serves the tree's market.

## 8. Export

⇪ Export delivers tables, JSON and template-based output such as BMEcat with ETIM or Google Merchant. Every export can be set up as a job with a schedule.

## What helps at any time

- ≡ Journal shows every change with author, time and content.
- ↶ at the node undoes the last batch.
- The ? button at the top right opens the chapter for the current view.

# Plugins

Everything beyond the core is a plugin: import and export, data sheet, translation, classification, data analysis, tools. A plugin is a directory with a manifest that can be swapped without a new deployment.

## Kinds

- **Browser plugins** run in the interface and bring views, node actions, importers, check rules and bands in the node view.
- **Process plugins** run as a child process of the server and are the basis of the jobs.

Both talk to journali only via the interface; none runs inside the server process.

## Base and extension

A **base plugin** brings the basic function of a group of the rail and is the container for extensions: Table for import and export, Data quality for the checks, Jobs for the processes. An extension names what it needs; if the base goes off, the extension has no effect.

| Group | Base | Extensions |
|---|---|---|
| Import, Export | Table | CSV, Excel, JSON, IXP, Solr, template export |
| Data analysis | Data quality | Digital product passport, packaging, EmpCo, enrichment, GEO texts, ETIM |
| Jobs | Jobs | backup, export as job, previews, read documents, translation |

## Management

⌁ Plugins shows all plugins with version and state: installed, on, off, base missing, not installed. Installing takes a plugin into the journal, enabling makes it effective, updating adopts a new version from disk. When enabled, a plugin creates what it needs, such as an attribute group. Every plugin can be shown or hidden in your own rail.

## What the tier allows

Which plugins can be installed and enabled depends on the tier of the instance: Free includes Table, Excel add-in, OnlyOffice, previews and export; Pro adds data sheet, translation, template export, ETIM, data analysis and backup as a job; from Pro+ all. The highest tier any team of the instance has counts.

## journali Core plugins

A **journali Core plugin** comes from journali and is unchanged. Next to its manifest it carries a signature over
key, version and all files. ⌁ Plugins shows it as ❖ with the date; if a file is changed, ⚠ appears with the reason. A
plugin without a signature runs just the same and carries no mark — the mark says where it comes from, not whether it
is good.

The **catalogue** below the list shows which such plugins the publisher has. ⇩ fetch downloads the zip to the
server, which checks the seal and places the directory under plugins/; ↑ appears when a newer version is there.
After that the plugin is installed and enabled like any other. Without a connection the catalogue is empty.

## Profiles

An import or export plugin saves its settings as a profile in the journal, visible to everyone. Credentials on the profile are kept on the server. A profile is the basis for repeating the same run as a job.

## Own plugins

A plugin is a directory under plugins with a plugin.json: key, version, label, kind, whether it runs in the browser or as a process, entry or command, parameters. Contribution points for browser plugins are views, node actions, importers, check rules and bands; plugin data lives in the journal.

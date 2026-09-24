# Maintaining values

Values live in cells: at the node in the matrix of attributes and columns, in the table of subitems as rows.

## The node view

The attributes are ordered by groups, stacked or as tabs. The columns are language × channel; which of them are visible is set under ◐ Me → View and can be switched at any time at the node. The star is the value without language and channel.

A cell shows three states: an own value, an inherited one in italics, or nothing. A value that comes only from the master is marked dimmed; a value whose master was changed later carries ⟳ as to be revised.

| Key | Effect |
|---|---|
| Tab | next cell |
| Enter | edit, then save |
| Esc | discard |
| Del | delete the own value, the inherited one applies again |

Long texts and HTML open a large editor with formatting, link and source; Ctrl+Enter saves. List values open a selection in which a letter jumps; multi-value attributes show a list with add, remove and reorder.

The search in what is visible filters attribute names and the values of the shown columns; the view chooses groups, the scope shows all attributes, only those changeable here, or only those changeable exclusively here.

## Batches and undo

What is saved at once is one batch in the journal. ↶ takes back the last batch, ↷ repeats it. Both are new entries; the journal stays complete.

## Evidence on the value

A value can carry a source: an address or a text such as data sheet or catalogue page. Values from research, rule or import bring their evidence with them. If the value changes later, the evidence counts as outdated.

## The table

The subitems of a node, or all variants below, can be edited in a table that reacts like a spreadsheet:

| Control | Effect |
|---|---|
| click, drag a range | select a cell, mark a range |
| typing | overwrites the cell; Enter takes the completion from the column |
| F2 or double-click | edit, long text in the large editor |
| Del | clear the cell, the inherited value applies again |
| Ctrl+D | fill the top cell into the range below |
| Ctrl+Shift+D | continue the series: 1, 2 → 3, 4 |
| drag the handle | fill as in Excel |
| Ctrl+C, Ctrl+V | exchange with Excel, lists via value or label |
| Ctrl+H | find and replace |
| Ctrl+S | save all changes as one batch |
| Ctrl+− | mark the selected rows for deletion |

The row column on the left selects whole rows; right-click offers copy, paste, duplicate, move and delete. New rows are created above or below a selected one; saving creates the nodes. Nothing is written before saving.

## Relations

At the node are the relations to other nodes: type, target, values on the relation. A new relation is created via type and target, or in the tree by dragging with Shift, or for a selection at once. Both directions are visible.

## Workflow at the node

A node can have a state in a workflow, with the next step, the responsible person and the history. A state is inherited downwards until a node gets its own. See Workflows.

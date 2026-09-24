# Workflows

A workflow is the editing state above the data: states, transitions between them, who may take a step, whether a note is required and what the step causes.

## Seed

Two workflows are preset:

- **Editorial**: Draft → Review → Approved, with a correction loop back to Rework. Approving triggers the release for the channel Web, withdrawing revokes it.
- **Translation**: not requested → to translate → translated → checked, with a separate state **per language**.

Both can be changed under ⚙ Settings → ⚑ Workflows or replaced by your own.

## Building blocks

| Block | Meaning |
|---|---|
| State | name per language, colour, end flag |
| Transition | from one state to another, with a label |
| Roles | who may take the step; empty means every role with write access |
| Note | the step requires a reason, for example in the correction loop |
| Escalation | after n days other roles may too |
| Effect | what the step triggers: grant or revoke a release, set a status |
| applies to | node types the workflow can be used on |

The designer shows states as tiles and transitions as arrows; dragging moves, dragging from the edge connects, double-click renames.

## At the node

A state is set at the node and inherited downwards until a node gets its own; Inherit restores the inheritance. The next step is shown at the node with the responsible person, who can be chosen or assigned. The history shows every step with author, time and note.

If a step cannot proceed because its effect is not possible, for example a release without a releasable variant, the node says beforehand why.

## Tasks

⚑ Tasks lists all nodes waiting for a step of your own role: workflow, state, since when, who is responsible. From there you go to the node.

## Per language

A workflow per language keeps a separate state for each language; a step affects only that language. The plugin Translation advances nodes from to translate to translated after writing the targets.

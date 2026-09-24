# The model

The model describes which data exists: attributes with type and axes, groups, value lists, views, units, languages, channels and statuses. It is in the journal like everything else and is maintained under ⊞ Model.

## Attributes

An attribute has:

- a **key**, lower case, forever;
- a **label** per language, shown by the interface in its language;
- a **type**: text, HTML, integer, number with unit, yes/no, date, list value, table of rows;
- a **group** through which it applies at nodes of the tree;
- **axes**: language-dependent, channel-dependent or both;
- **required** per channel and language: without a value no release in this channel;
- flags: **inheritable** (the value continues downwards), **multi-value** (several values per cell), **unique** (no second node with the same value, such as SKU or EAN);
- a **pattern** as a regular expression that every value must match;
- **levels**: at which node types it may be set.

An attribute can be retired as long as no node carries it as its name attribute. Values in the journal are preserved.

## Attribute groups

A group bundles attributes and hangs on a node of the tree; from there it applies downwards. **Active from** defines from which node type values are entered: above that the group is visible but locked. Example from the seed: Logistics with SKU and EAN is active from variant.

A group can hang on several nodes. If it hangs on an ancestor, attaching it again below is redundant; the node view shows that.

## Value lists

An attribute of type list points to an entry of the value list, not to a word. The entry has a key, a label per language and its own columns. A **closed** list takes only values from the source, for example from an ETIM release; there is then no “new value” in the cell.

## Views

A view applies to one node type and defines which groups appear in which order and within them which attributes. Preset per node type is a view with all active groups, plus the view Sellable for variants.

## Units

Per quantity there is one base with factor 1; other units convert via their factor. An attribute of type number names its unit.

## Languages and channels

Languages are the axis for language-dependent values, channels the one for channel-dependent values. Both have a **master**: the master language is the basis for all other languages, the master channel takes the values of the star and passes them on to the other channels. A **fallback** between two languages or channels acts before the master, for example fr-ch → fr-fr → master.

## Status

The status is the life cycle of a product or variant: draft, active, discontinued, freely extensible with label per language, symbol and colour. Draft is the initial status of new nodes. Import maps external statuses onto it, a workflow can set it as an effect.

## Relation types

A relation type connects nodes: accessory, component, related, bill of materials, plus image and document as connection to media. It has a label in both directions, allowed node types and optionally an attribute group whose attributes are kept on the relation, such as a quantity.

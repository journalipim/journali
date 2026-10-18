# The model

The model describes which data exists: attributes with type and axes, groups, value lists, views, units, languages, channels and statuses. It is in the journal like everything else and is maintained under ⊞ Model.

## Attributes

An attribute has:

- a **key**, lower case, forever;
- a **label** per language, shown by the interface in its language;
- a **type**: text, HTML, integer, decimal, yes/no, date, list, table, formula, template (see Attribute types);
- a **group** through which it applies at nodes of the tree;
- **axes**: language-dependent, channel-dependent or both;
- **required** per channel and language: without a value no release in this channel;
- flags: **inheritable** (the value continues downwards), **multi-value** (several values per cell), **unique** (no second node with the same value, such as SKU or EAN);
- a **pattern** as a regular expression that every value must match;
- **levels**: at which node types it may be set.

An attribute can be retired as long as no node carries it as its name attribute. Values in the journal are preserved.

### Creating an attribute

1. Under ⊞ Model, choose **Attributes** on the left.
2. Type the name into the field *new attribute (name)* at the top and press Enter or click **+**. The key is formed from the name ("Ingredient" becomes `ingredient`), the name becomes the label in the master language; the type starts as text.
3. Set type, group, axes and requirement on the attribute. The attribute appears at a node for editing as soon as one of its groups applies there (see attribute groups).

## Attribute types

The type determines what a value is, how the cell captures it and how journali checks it. It is chosen in the model view under **Type**. If you change the type of an attribute that has values, journali checks the existing values against the new definition and reports how many do not fit.

| Type | A value is | Suited for |
|---|---|---|
| Text (Aa) | a text without format | names, identifiers, short texts |
| HTML (‹›) | a text with formatting | descriptions, longer texts |
| integer (12) | a whole number | quantities, counts |
| decimal (1.5) | a number with decimals, optionally with a unit | dimensions, weights, prices |
| yes/no (☑) | true or false | properties a product has or does not have |
| date (📅) | a calendar day | deadlines, dates |
| list (☰) | an entry of a value list | a fixed choice such as colour or material |
| table (⊞) | n rows made of columns | related details that repeat |
| formula (ƒ) | the result of a script | calculated values |
| template ({}) | the result of a text template | texts assembled from attributes |

### Text

A text without format. Only this type has a **pattern**, a regular expression every value must match, together with a **hint** that appears in the error message. A text can be **unique** (identifiers such as SKU or EAN), **multi-value** (several values per cell) and **language-dependent**.

### HTML

A text with formatting. The cell shows the beginning of the text; Enter or double-click opens the editor with a simple writing mode (bold, italic, lists, heading, link) and a switch to the source. Ctrl+Enter saves, Esc discards. HTML is not multi-value, not unique and has no pattern.

### Integer and decimal

Both check that the value is a number: the message is "not a whole number" or "not a number". For the decimal, inputs such as 1.234,56 (German), 1,234.56 or 1234.56 are recognised and stored as a number with a point; for the integer, spaces, points and apostrophes are dropped as thousands separators. Both types can name a **unit**, chosen from the units of the model, and can be **unique** if they are single-value.

### Yes/no

True or false is stored; the cell shows ✓ or ✗. On import and in suggestions, ja, j, yes, y, true, wahr, x, 1, on and an are read as true, and nein, n, no, false, falsch, 0, off, aus, a dash and an empty field as false. Any other value is reported as not yes/no.

### Date

YYYY-MM-DD is stored. An input as DD.MM.YYYY is converted. Anything else is reported by the check as "not a date".

### List

The value is an entry of a value list, not a free word. The value list is chosen on the attribute under **Value list**; without it no value can be set. Every entry has a key and a label per language. A value that is not in the list is reported as "not in list". A list can be **multi-value**: then a cell has several entries.

### Table

A table has n rows, each made of the **columns** of the attribute. Every column is an attribute itself and brings its type and its check; columns are entered separated by commas. Without columns a row has no content. A column must not be a table. Rows can be added, removed and reordered. A table is not multi-value, not language-dependent and not channel-dependent.

### Formula

The value at the node is a small script that runs when the value is read; its result is the value. The script is kept like any value at the node, is inherited if the attribute is inheritable, and applies per language if the attribute is language-dependent. The result appears in the node view, in the table, in the template export and in the AI knowledge base; the table export leaves it out because it is read back in, and the search does not read it. An empty result means: no value.

```
h = $height
if (h >= 100) {
  return `${format(h / 100, 2)} m`
}
return `${h} cm`
```

- `$key` is the value of an attribute at the node; an inherited value counts.
- Values are numbers, texts, templates with `${…}`, true, false and null. If a value is missing the result is null, and `??`, `isblank` and `coalesce` catch that.
- Operators work as in JavaScript, plus `if`, `else` and `return`.
- Functions: round, trunc, floor, ceil, abs, min, max, sqrt, len, upper, lower, trim, left, right, contains, replace, split, pad, number, str, format, isblank, coalesce.
- The formula does not convert units; to get litres from cm³, divide by 1000.

The cell of the attribute, marked with ƒ, opens the editor. It checks the syntax while you type, through the server, and "Apply" works only if the check passes. If you are interrupted, the draft stays in the browser. Ctrl+Enter applies, Esc closes.

### Template

The value at the node is a text block with placeholders; the server builds the text from it when the value is read. Templates are for texts, not for calculating.

```
{name} with {cpu}[, {ram} GB RAM][ · {weight|1|unit}]
```

- `{key}` is the value of an attribute; an inherited value counts, and a list shows its label in the language of the column.
- Modifiers with `|`, chained as you like: `|unit` appends the unit, `|0` to `|6` set the decimals, `|upper`, `|lower` and `|capitalize` change the case, `|plain` removes HTML tags.
- `[ … ]` is an optional section: if a placeholder inside is empty, the whole section is dropped, so no stray ", GB RAM" remains. Sections may be nested.
- `\{`, `\[`, `\]` and `\\` stand for the characters themselves. Line breaks are kept, double spaces become one. An empty result means: no value.

In the editor `{` shows the attributes, `|` the modifiers, and the preview at the node appears while you type.

### Formula or template

Assembling a text from several attributes is a job for the template. Calculating, or delivering different things depending on a value, is a job for the formula. Neither has a value of its own in the sense of an input: what is at the node is the template or the script, and a fixed text is a template without placeholders.

### Settings per type

| Setting | applies to |
|---|---|
| pattern, hint | text |
| unit | integer, decimal |
| value list | list |
| columns | table |
| unique | text, integer, decimal, in each case single-value |
| multi-value | text, integer, decimal, date, list (not HTML, yes/no, table, formula, template) |
| channel-dependent | all except table, formula, template |
| language-dependent | all except table |
| inheritable, required, levels | all |

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

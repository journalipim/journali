# The tree

The maintenance tree under ▣ Tree holds the product data in three roles: **product group**, **product**, **variant**. Every node has a fixed identifier that does not change when it is moved.

## Roles

| Role | Parent | Children | Carries |
|---|---|---|---|
| Product group | root or product group | product groups, products | structure, shared values |
| Product | product group | variants | maintained values, the variant axes |
| Variant | product | none | SKU, EAN, one value per axis, deviations |

The variant is what is sold. A product “varies by” one or more axes, for example colour and size; every combination is a variant, and the combination is unique. A product without axes can have any number of variants.

## Creating

The buttons above the tree create a group, a product or a variant under the chosen node. The dialog asks for required fields and axis values. Import creates whole subtrees at once.

## The name

The tree shows a name per node. It comes from the attribute that carries the ★ on the path; in the seed that is the name at the root. Whoever needs another naming sets the ★ lower in the tree on another attribute or gives a node a fixed name via right-click. A variant without an own name is named by identifier and axis values.

## Inheritance

Values are looked up along the path: own value, otherwise the product's, otherwise the group's and so on, provided the attribute is inheritable. Inherited values appear in italics. An own value overrides the inherited one; deleting it lets the inherited one apply again.

Media are inherited too when the assignment is marked accordingly. An inherited assignment can be blocked at a node; then it no longer applies there and below.

## Moving and retiring

Dragging in the tree moves a node; with Shift a relation is created instead. Del retires a node with everything below. Retired nodes stay in the journal and can be restored; ↶ at the node undoes the last batch.

## Search

The search field above the tree searches names and values and knows conditions: an attribute with or without value, an empty value in a language, an incomplete channel, a role, a status, a group, a subtree, an author, a date. Suggestions appear while typing; a minus in front negates. Ctrl+click collects a selection, Shift+click takes a range.

## Duplicating

A node can be duplicated with or without its subtree. The copy takes over no unique identifiers and no releases.

## As a table

The subitems of a node can be edited in a table with cells, ranges, filling and exchange with Excel. See Maintaining values.

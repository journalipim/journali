# Configurator

A configurator checks a selection of products against groups and rules and tells whether it is valid and complete and which parts can still be added. A user maintains the groups and rules under ⚙ Tools → Configurator; a shop sends its selection to the interface and gets back what works. The check exists only on the server, the shop does not know the rules. The plugin belongs to the plan from Pro.

## Starting point

A configurator is a starting point. Its root decides what may be chosen from; without a root the whole tree applies. Variants and products without variants are chosen. To keep two configurations apart, create two configurators.

## Groups and rows

A **configurator group** applies to all configurators. A part belongs to it with **rows**; a row names the group and is either a member or a limit:

| Kind | Details | The part counts in the group |
|---|---|---|
| Member | provides, consumes, value | yes |
| Limit | minimum, maximum (number of members), allowed values | no |

- **Sum.** What the members provide and consume is added up per group. If the sum is below 0 the selection is invalid; a part that covers the need stays selectable.
- **Value.** The value of a part in the group is a separate entry, independent of the product's attributes. With “all values equal” on the group, two different values are invalid.
- **Limit.** A part can set quantities and values for a group: a mainboard sets exactly two modules of 8 or 32 GB for the memory. Several limits apply together. A configurator can set the same limit without a part (tab Groups, limits of this configurator).
- **Condition.** A row can apply only if certain parts are chosen: a CPU provides two slots with a particular mainboard. The condition asks about parts, not about the sum of a group.
- **All rows apply** whose condition holds. Numbers of the same group add up.
- **Inheritance.** If a variant has no rows of its own, those of its product apply, otherwise those of the group above; own rows replace inherited ones entirely.

The rows of a part are in the band ⚙ Configurator groups in the node view and in the tab Groups. To calculate two parts of the same configuration separately, such as two mainboards with their own memory, give them separate groups.

## Rules

What no group covers is a rule: “if A, then B”. The simple forms are sentences in which only the parts are to be chosen: does not fit together, needs, at most, at least. The technical form knows conditions on quantity, sum of an attribute and the balance of a group, combined with and, or, not.

## Valid and complete

- **Invalid** is a selection with a prohibition, an exceeded limit, a sum below zero, two different values in a group with equal values, or a value that is not allowed.
- **Incomplete** is a selection in which something is required and missing, including the minimum quantity of a group.
- A selection can be ordered when it is valid and complete.
- For every part that could still be added, the result says whether it works and why not. A part is blocked if it causes a new violation; what is only missing or pushes the sum below zero blocks nothing. A part that raises the sum of a group below zero is marked with ↑.

## Checking and test cases

The tab Check chooses parts (id or SKU, quantity) and shows the result as for a shop: valid, complete, violations, missing, balance, groups with limits and the selectable parts. A test case keeps a selection with the expected result; Check all compares after every change what has shifted.

## Interface

`POST /api/configurator/{key}/check` with the selection, for example `{ "selection": [{ "id": "SKU-1", "amount": 2 }], "selectable": true }`. An id is a node or the unique value of an attribute. The response contains `valid`, `complete`, `violations`, `missing`, `balance`, `groups` and, with `selectable`, `ok`, `reasons` and `lifts` for every selectable part. Checking needs only the right to read; a part the caller's role does not see does not exist for them.

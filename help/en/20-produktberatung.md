# Product advisor

An advisor answers questions from website visitors about products: the visitor writes what they are looking for and gets the matching products, the attributes in which they differ and, if wanted, a comparison. External AI agents ask the same questions via MCP. Advisors are created under ⇪ Export → Product advisor; the plugin belongs to the plan from Pro+.

## What an advisor shows

Three settings determine what an advisor shows, and each one narrows it down:

| Setting | determines |
|---|---|
| Publication tree | which products: what the tree publishes for its channel, with the released variants |
| Role | what of it is visible: restricted nodes and folders are left out |
| View | which attributes appear on the product, in the facets and in the comparison |

An attribute that is not in the view appears nowhere, not even as a filter. Images appear if they are valid today and released.

## How the advisor answers

Without AI: it searches the words of the question in the products and their variants. With the embed plugin it also searches by meaning, so "withstands heat" finds a product with "heat-resistant up to 120 °C". Below the hits are facets: attributes of the view in which the hits differ, such as "Colour: Red (3)" or "Power up to 550 W". A click narrows down. Two to four products can be compared side by side.

With AI: if "Text about the hits" is switched on, the AI of the chosen team writes two to four sentences about the first hits. It gets only these hits with the values of the view. The window labels the text as written by an AI. The usage counts for the chosen team.

## Creating and setting up

1. ⇪ Export → Product advisor, enter a key (such as `shop`), ＋.
2. Choose the publication tree, role and view, enter the languages and a greeting per language.
3. Under Websites enter the addresses of the pages that embed the window, one per line (`https://www.example.com`).
4. Save. The preview asks the same question as a visitor.
5. ＋ Token: the token is visible only now and belongs in the environment of the service (`JOURNALI_BERATER_TOKEN`).

If a setting is missing, ✗ appears in the list with the reason below it; the advisor then does not answer.

## The service and the website

Visitors do not reach journali but the service of the advisor, a separate container that talks to journali only via the interface. The setup is described in `docs/betrieb.md` under "Produktberater". On the website one tag is enough:

```html
<script src="https://berater.example.com/widget.js" async></script>
```

AI agents reach the same service at `https://berater.example.com/mcp`, with the tools `search_products`, `get_product` and `compare_products`. All three only read.

## Limits

| Limit | Default | counted by |
|---|---|---|
| Visitor/min | 20 | the service, per address |
| Visitor/day | 300 | the service, per address |
| total/day | none | journali, all questions of the advisor |
| AI/day | none | journali, AI texts |

## What is public

What an advisor shows can be read by every visitor of the website and every AI agent. ⬡ Plugins asks for confirmation of this before switching on. The choice of tree, role and view and the statements on the website, for example on privacy, are the operator's responsibility. The service stores nothing on disk; it keeps the number of questions per visitor address in memory until the day is over.

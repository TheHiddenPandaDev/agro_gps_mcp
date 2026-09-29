# Agro GPS MCP

<!-- mcp-name: eu.agrogps/agro-gps -->

MCP server for [Agro GPS](https://agrogps.eu), the digital field notebook.

- **Free, no key:** search and check plant protection products (pesticides, fungicides, herbicides) in the official
  registers of 30 European countries, mirrored by Agro GPS: is it still authorised, which substances, which uses,
  is it allowed on this crop.
- **With your key:** your farms, field notebook, group dashboard, advisor queue and farm finances and, with a write
  key, recording new notebook entries.

## Setup

```json
{
  "mcpServers": {
    "agro-gps": {
      "command": "npx",
      "args": ["-y", "agro-gps-mcp"]
    }
  }
}
```

That is enough for the public tools. For your own farm data, create a key in the app at
[agrogps.eu/app](https://agrogps.eu/app/) (**Settings → API and webhooks**) and add it:

```json
"env": { "AGROGPS_API_KEY": "agk_your_key_here" }
```

| Variable | Required | Default |
|----------|----------|---------|
| `AGROGPS_API_KEY` | only for farm tools | — |
| `AGROGPS_TIMEOUT_MS` | no | `20000` |
| `AGROGPS_API_URL` | no | `https://api.agrogps.eu/api/v1` |

## Public tools (no key)

| Tool | What it does |
|------|--------------|
| `search_plant_protection_products` | Search a country's official register by trade name; authorisation state and a link to each product page |
| `check_plant_protection_product` | One product by registration number: state, expiry, substances, authorised uses and, with `crop_eppo`, whether it is allowed on that crop |

Examples: *"Is Roundup Ultra Plus still authorised in Spain?"*, *"Can I use product 7400057 on grapevine in
France?"*. Public endpoints are rate limited per IP address.

## Farm tools (API key)

The key acts as you: it only sees the farms and groups you belong to, with your role in each. A `read` key only
queries; a `write` key can also use `record_entry`. Revoke it from the same screen at any time. Without a key these
tools are still listed and answer with instructions to create one.

| Tool | What it does | Access |
|------|--------------|--------|
| `list_farms` | Farms the key can see, role, plan and whether holder data is complete | read |
| `list_entries` | Notebook entries of a farm with compliance fields, paginated | read |
| `entry_history` | Audit trail of one entry, field by field | read |
| `list_groups` | Groups (company or cooperative) the key owner belongs to | read |
| `group_overview` | Consolidated panel of a group per farm and crop | read |
| `advisor_portfolio` | Farms an advisor reviews, with a traffic light | read |
| `advisor_pending` | Entries of a farm pending review or missing fields | read |
| `finance_dashboard` | Costs, income and margins of a farm or group per campaign | read |
| `budget_variance` | Budget vs actual per line | read |
| `campaign_forecast` | Estimated campaign close per crop (low / mid / high) | read |
| `treasury_dues` | Receivables and payables | read |
| `cash_flow` | Cash-flow forecast by week or month | read |
| `bank_movements` | Imported bank movements and match candidates | read |
| `record_entry` | Adds a new entry to the notebook | write |

`record_entry` only adds entries: nothing in this server edits or deletes existing data. Every entry is attributed
to the key owner and marked as written through the API in the audit trail. Official submission to the
administration never happens here: it needs a person's session in the app.

## Español

Servidor MCP del cuaderno de campo [Agro GPS](https://agrogps.eu). **Sin clave**, consulta los registros oficiales
de fitosanitarios de 30 países: si un producto sigue autorizado, sus sustancias, sus usos y si vale para un
cultivo. **Con clave** (créala en [agrogps.eu/app](https://agrogps.eu/app/), **Ajustes → API y webhooks**), el
asistente consulta tus explotaciones, cuaderno, grupos, cola del asesor y cuentas; con `write` además registra
labores nuevas. La clave ve solo tus explotaciones y nunca borra ni edita nada. El envío oficial a la
administración no pasa por aquí.

## Development

```bash
npm ci
npm run lint && npm test && npm run build
node build/index.js
```

`npm run pages` regenerates `src/data/product-pages.ts` (which products have a page on agrogps.eu) from the
landing repo checked out at `../landing`.

## License

MIT

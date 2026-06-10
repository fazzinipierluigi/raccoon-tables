<p align="center">
  <img src="raccoon_tables_logo.png" alt="Raccoon Tables" width="100">
</p>

# Raccoon Tables — Server-Side API Specification

Questo documento descrive il protocollo di comunicazione tra il plugin **Raccoon Tables** e il server quando viene usata la modalità server-side (`serverAdapter`). È pensato per chi deve implementare il lato server (controller, repository, DTO) in qualsiasi linguaggio.

---

## Indice

1. [Panoramica del protocollo](#1-panoramica-del-protocollo)
2. [Formato della richiesta — POST](#2-formato-della-richiesta--post)
3. [Formato della richiesta — GET](#3-formato-della-richiesta--get)
4. [Campi della richiesta](#4-campi-della-richiesta)
5. [Operatori di filtro](#5-operatori-di-filtro)
6. [Formato della risposta](#6-formato-della-risposta)
7. [Alias accettati nella risposta](#7-alias-accettati-nella-risposta)
8. [Esempi completi](#8-esempi-completi)
9. [Casi limite e comportamenti attesi](#9-casi-limite-e-comportamenti-attesi)
10. [Personalizzazione del contratto](#10-personalizzazione-del-contratto)

---

## 1. Panoramica del protocollo

- Il plugin invia **una richiesta per ogni interazione** dell'utente: cambio pagina, ordinamento, filtro, ricerca globale, cambio raggruppamento.
- Le richieste sono **debounced** (default 300 ms) per evitare traffico eccessivo durante la digitazione.
- Le richieste in volo vengono **cancellate** (`AbortController`) quando parte una nuova richiesta prima del completamento della precedente.
- Il server deve sempre restituire **solo la pagina corrente** (`start` / `limit`), mai tutti i dati.
- Il server è responsabile di applicare **tutti** i filtri, l'ordinamento e la ricerca globale ricevuti nella richiesta.

---

## 2. Formato della richiesta — POST

**Metodo HTTP:** `POST`  
**Content-Type:** `application/json`  
**Body:** oggetto JSON (`ServerRequestParams`)

```http
POST /api/employees HTTP/1.1
Content-Type: application/json

{
  "start": 0,
  "limit": 50,
  "page": 1,
  "pageSize": 50,
  "sort": [
    { "index": "salary", "dir": "DESC" }
  ],
  "filters": [
    { "index": "department", "value": "Engineering", "sign": "==" }
  ],
  "rowGroups": [],
  "globalSearch": ""
}
```

---

## 3. Formato della richiesta — GET

Se `method: 'GET'` è configurato, i parametri vengono serializzati come query string. Gli array vengono passati come JSON stringificato.

```
GET /api/employees?start=0&limit=50&page=1&pageSize=50
  &sort=[{"index":"salary","dir":"DESC"}]
  &filters=[{"index":"department","value":"Engineering","sign":"=="}]
  &search=john
```

> **Nota:** `globalSearch` viene rinominato `search` nella query string GET.

---

## 4. Campi della richiesta

Tutti i campi sono presenti in ogni richiesta. I campi opzionali sono omessi (non inviati) quando non hanno valore.

### Campi obbligatori

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `start` | `number` | Offset della prima riga da restituire (0-based). Esempio: pagina 3 con 50 righe/pagina → `start = 100`. |
| `limit` | `number` | Numero di righe da restituire (dimensione della pagina). |

### Campi opzionali

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `page` | `number` | Numero di pagina corrente (1-based). Ridondante con `start`/`limit`, utile per comodità. |
| `pageSize` | `number` | Righe per pagina. Uguale a `limit`. |
| `sort` | `SortItem[]` | Array di colonne ordinate. Vuoto o assente = nessun ordinamento. |
| `filters` | `FilterItem[]` | Array di filtri attivi. Vuoto o assente = nessun filtro. |
| `rowGroups` | `string[]` | Array di `index` di colonne usate per il raggruppamento. Vuoto o assente = nessun raggruppamento. |
| `globalSearch` | `string` | Stringa di ricerca globale (cerca su tutti i campi). Assente o stringa vuota = nessuna ricerca. |

### Struttura `SortItem`

```typescript
{
  index: string;   // nome del campo dati (es. "salary", "name")
  dir: "ASC" | "DESC";
}
```

Il plugin supporta **multi-sort**: `sort` può contenere più elementi, in ordine di priorità (primo elemento = ordinamento primario).

```json
"sort": [
  { "index": "department", "dir": "ASC" },
  { "index": "salary", "dir": "DESC" }
]
```

### Struttura `FilterItem`

```typescript
{
  index: string;   // nome del campo dati
  value: unknown;  // valore di confronto (stringa, numero, array, null)
  sign: FilterSign; // operatore (vedi sezione 5)
}
```

---

## 5. Operatori di filtro

Il campo `sign` può assumere uno dei seguenti valori:

| `sign` | Nome | Descrizione | Tipi applicabili | Note |
|--------|------|-------------|-----------------|------|
| `=` | Contains | Il valore del campo **contiene** `value` (case-insensitive) | string, number | Operatore default |
| `!=` | Not contains | Il valore del campo **non contiene** `value` | string | |
| `==` | Equals | Uguaglianza esatta (case-insensitive per stringhe) | string, number | |
| `!==` | Not equals | Diverso (case-insensitive per stringhe) | string, number | |
| `>` | Greater than | Maggiore di `value` | number, currency | Confronto numerico |
| `<` | Less than | Minore di `value` | number, currency | Confronto numerico |
| `a_` | Starts with | Inizia con `value` (case-insensitive) | string | |
| `_a` | Ends with | Termina con `value` (case-insensitive) | string | |
| `regex` | Regex | Corrisponde all'espressione regolare `value` (flag: `i`) | string | `value` è la stringa pattern |
| `empty` | Empty | Il campo è `null`, `undefined` o stringa vuota `""` | tutti | `value` ignorato |
| `!empty` | Not empty | Il campo non è vuoto | tutti | `value` ignorato |
| `+` | Positive | Il valore numerico è `>= 0` | number, currency | `value` ignorato |
| `-` | Negative | Il valore numerico è `< 0` | number, currency | `value` ignorato |
| `in` | In list | Il valore è presente nell'array `value` | tutti | `value` deve essere un array |
| `T` | True | Il campo booleano è `true` | boolean | `value` ignorato |
| `F` | False | Il campo booleano è `false` | boolean | `value` ignorato |
| `empty` | Null/Empty | Il valore è `null`, `undefined` o stringa vuota | tutti | `value` ignorato |

> **Filtro booleano**: quando una colonna ha `type: 'boolean'`, la filter bar mostra una `<select>` con opzioni
> All / True / False / Null; i valori `T`, `F`, `empty` vengono inviati corrispondentemente come `sign`.

> **Filtro lookup (dropdown)**: quando una colonna ha `filterLookup` configurato, la filter bar mostra una
> `<select>` caricata da un array statico o via AJAX. Il filtro usa sempre `sign: "=="` (uguaglianza esatta).
> È il pattern ideale per colonne foreign-key: l'utente sceglie un'etichetta, il valore inviato al server
> è la chiave esatta (es. un ID numerico o una stringa normalizzata).
>
> Esempio: colonna `role_id` con lookup — il server riceve `{ "index": "role_id", "value": "2", "sign": "==" }`.

### Esempi di `FilterItem`

```json
{ "index": "name",       "value": "mario",        "sign": "="     }
{ "index": "salary",     "value": 50000,           "sign": ">"     }
{ "index": "department", "value": "Engineering",   "sign": "=="    }
{ "index": "status",     "value": ["active","pending"], "sign": "in" }
{ "index": "active",     "value": null,            "sign": "T"     }
{ "index": "note",       "value": null,            "sign": "empty" }
{ "index": "email",      "value": "^admin@",       "sign": "regex" }
```

---

## 6. Formato della risposta

Il server deve restituire un oggetto JSON con i seguenti campi:

```typescript
{
  data: RowData[];    // obbligatorio — array di oggetti riga per la pagina corrente
  total: number;      // obbligatorio — totale righe che soddisfano i filtri (senza paginazione)
  groups?: Record<string, { amount: number; agValues?: Record<string, unknown> }>; // opzionale
}
```

**`Content-Type` risposta:** `application/json`  
**HTTP status:** `200 OK` per successo, qualsiasi `4xx`/`5xx` viene trattato come errore.

### Campo `data`

Array di oggetti riga. Ogni oggetto può contenere qualsiasi campo. Il plugin usa i valori tramite il campo `index` definito nelle colonne.

```json
"data": [
  { "id": 1, "name": "Mario Rossi", "department": "Engineering", "salary": 65000 },
  { "id": 2, "name": "Anna Bianchi", "department": "Marketing",  "salary": 48000 }
]
```

### Campo `total`

Numero intero. Rappresenta il **conteggio totale** delle righe che soddisfano i filtri attivi e la ricerca globale, **prima** della paginazione. Viene usato per:
- Calcolare il numero totale di pagine
- Mostrare "X di N righe" nel footer di paginazione

```json
"total": 3847
```

> Se non ci sono filtri attivi, `total` deve essere il conteggio totale del dataset.

### Campo `groups` (opzionale)

Usato solo quando `rowGroups` è attivo. Permette al server di fornire sommari pre-calcolati per ogni gruppo. Se omesso, il plugin calcola i totali lato client sui dati della pagina corrente.

```json
"groups": {
  "Engineering": {
    "amount": 142,
    "agValues": {
      "salary": 9230000,
      "bonus": 1420000
    }
  },
  "Marketing": {
    "amount": 87,
    "agValues": {
      "salary": 4350000,
      "bonus": 522000
    }
  }
}
```

La chiave del record corrisponde al valore del campo di raggruppamento. Per raggruppamenti multi-livello la chiave è separata da `/` (es. `"Engineering/Rome"`).

`agValues` contiene i valori aggregati per le colonne configurate con `aggregations` nel grid. Le chiavi sono i `index` delle colonne, i valori sono i totali grezzi (la formattazione è gestita dal plugin).

---

## 7. Alias accettati nella risposta

Il plugin accetta nomi di campo alternativi per facilitare l'integrazione con API esistenti senza dover configurare `parseResponse`:

| Campo canonico | Alias accettati |
|----------------|----------------|
| `data` | `rows`, `items` |
| `total` | `count`, `totalCount` |

Esempio con alias:

```json
{
  "items": [...],
  "totalCount": 3847
}
```

> Se si usa `parseResponse` nella configurazione, il mapping è completamente personalizzabile e questi alias vengono ignorati.

---

## 8. Esempi completi

### Esempio 1 — Prima pagina, nessun filtro

**Richiesta:**
```json
{
  "start": 0,
  "limit": 50,
  "page": 1,
  "pageSize": 50
}
```

**Risposta:**
```json
{
  "data": [
    { "id": 1, "name": "Alice", "department": "Engineering", "salary": 72000 },
    { "id": 2, "name": "Bob",   "department": "Sales",       "salary": 51000 }
  ],
  "total": 10000
}
```

---

### Esempio 2 — Pagina 3, ordinamento e filtro

**Richiesta:**
```json
{
  "start": 100,
  "limit": 50,
  "page": 3,
  "pageSize": 50,
  "sort": [
    { "index": "salary", "dir": "DESC" }
  ],
  "filters": [
    { "index": "department", "value": "Engineering", "sign": "==" },
    { "index": "salary",     "value": 40000,         "sign": ">"  }
  ]
}
```

**Risposta:**
```json
{
  "data": [ /* 50 righe filtrate e ordinate */ ],
  "total": 284
}
```

---

### Esempio 3 — Ricerca globale + raggruppamento

**Richiesta:**
```json
{
  "start": 0,
  "limit": 25,
  "page": 1,
  "pageSize": 25,
  "globalSearch": "senior",
  "rowGroups": ["department"]
}
```

**Risposta:**
```json
{
  "data": [ /* prime 25 righe che contengono "senior" */ ],
  "total": 63,
  "groups": {
    "Engineering": { "amount": 31, "agValues": { "salary": 2232000 } },
    "Marketing":   { "amount": 18, "agValues": { "salary": 900000  } },
    "Sales":       { "amount": 14, "agValues": { "salary": 686000  } }
  }
}
```

---

### Esempio 4 — Multi-sort

**Richiesta:**
```json
{
  "start": 0,
  "limit": 50,
  "sort": [
    { "index": "department", "dir": "ASC"  },
    { "index": "salary",     "dir": "DESC" }
  ]
}
```

Il server deve ordinare prima per `department` ASC, poi a parità di dipartimento per `salary` DESC.

---

### Esempio 5 — Filtro `in` con array di valori

**Richiesta:**
```json
{
  "start": 0,
  "limit": 50,
  "filters": [
    { "index": "status", "value": ["active", "pending"], "sign": "in" }
  ]
}
```

Il server deve restituire solo le righe dove `status` è `"active"` oppure `"pending"`.

---

## 9. Casi limite e comportamenti attesi

| Scenario | Comportamento atteso del server |
|----------|--------------------------------|
| `sort` è array vuoto `[]` o assente | Nessun ordinamento applicato (ordine naturale del dataset) |
| `filters` è array vuoto `[]` o assente | Nessun filtro applicato, restituire tutte le righe |
| `globalSearch` è stringa vuota `""` o assente | Nessuna ricerca globale applicata |
| `rowGroups` è array vuoto `[]` o assente | Nessun raggruppamento, `groups` nella risposta può essere omesso |
| `start` >= `total` | Restituire `data: []` con il `total` corretto |
| `limit` = 0 | Restituire `data: []` (edge case, non dovrebbe avvenire) |
| Filtro `sign: "empty"` | Restituire righe dove il campo è `null`, `undefined`, stringa `""` o assente |
| Filtro `sign: "regex"` con pattern non valido | Comportamento discrezionale del server (ignorare il filtro o restituire errore) |
| `total` deve essere il conteggio **post-filtro** | Errori qui causano paginazione sbagliata nel client |

---

## 10. Personalizzazione del contratto

Se l'API server esistente non rispetta questo contratto, il plugin offre due hook di trasformazione configurabili **lato client** (nessuna modifica al server necessaria):

### `prepareRequest(params) → Record<string, unknown>`

Trasforma i parametri in uscita prima dell'invio. Utile per rinominare campi o aggiungere parametri fissi (es. token, tenant ID).

```javascript
serverAdapter: {
  url: '/api/employees',
  prepareRequest: (params) => ({
    offset: params.start,        // rinomina start → offset
    size: params.limit,          // rinomina limit → size
    orderBy: params.sort,
    where: params.filters,
    q: params.globalSearch,
    _token: 'xyz123',            // parametro fisso aggiuntivo
  }),
}
```

### `parseResponse(raw) → ServerResponse`

Trasforma la risposta grezza prima che il plugin la elabori. Utile per API con strutture annidate o nomi di campo diversi.

```javascript
serverAdapter: {
  url: '/api/employees',
  parseResponse: (raw) => ({
    data: raw.result.employees,
    total: raw.result.pagination.totalRecords,
  }),
}
```

---

## Riepilogo TypeScript

```typescript
// Richiesta inviata al server
interface ServerRequestParams {
  start: number;
  limit: number;
  page?: number;
  pageSize?: number;
  sort?: Array<{ index: string; dir: 'ASC' | 'DESC' }>;
  filters?: Array<{ index: string; value: unknown; sign: FilterSign }>;
  rowGroups?: string[];
  globalSearch?: string;
}

type FilterSign =
  | '='      // contains (case-insensitive)
  | '!='     // not contains
  | '=='     // equals strict
  | '!=='    // not equals strict
  | '>'      // greater than
  | '<'      // less than
  | 'a_'     // starts with
  | '_a'     // ends with
  | 'regex'  // regular expression (flag i)
  | 'empty'  // null / undefined / ''
  | '!empty' // not null/undefined/''
  | '+'      // >= 0
  | '-'      // < 0
  | 'in'     // value in array
  | 'T'      // boolean true
  | 'F';     // boolean false

// Risposta attesa dal server
interface ServerResponse {
  data: Record<string, unknown>[];
  total: number;
  groups?: Record<string, {
    amount: number;
    agValues?: Record<string, unknown>;
  }>;
}
```

# Dev Users — Seed Accounts

All accounts use password: `password123`

---

## Admin

| # | Name | Phone | Role |
|---|---|---|---|
| 1 | Admin 7alan | `+22200000000` | ADMIN |
| 2 | Fatima Mint Salma | `+22200000001` | ADMIN |
| 3 | Omar Ould Sidi | `+22200000002` | ADMIN |

Login example:
```json
POST /api/auth/login
{ "phone": "+22200000000", "password": "password123" }
```

---

## Customer

| # | Name | Phone | Role |
|---|---|---|---|
| 1 | Ahmed Ould Mohamed | `+22220000001` | CUSTOMER |
| 2 | Mariem Mint Vall | `+22220000099` | CUSTOMER |
| 3 | Khalil Ould Abdi | `+22220000098` | CUSTOMER |

---

## Driver

| # | Name | Phone | Vehicle | Plate | Online | Deliveries | Rating |
|---|---|---|---|---|---|---|---|
| 1 | Moussa Ould Haiba | `+22220000014` | MOTO | NKT 4521 MR | Yes | 142 | 4.9 |
| 2 | Ibrahim Ould Daf | `+22220000015` | CAR | NKT 7834 MR | No | 87 | 4.6 |
| 3 | Aisha Mint Brahim | `+22220000016` | MOTO | NKT 2291 MR | Yes | 215 | 4.8 |

---

## Restaurant Owner

Each owner has a fully seeded restaurant with menu categories and items.

| # | Name | Phone | Restaurant |
|---|---|---|---|
| 1 | Sidi Ould Brahim | `+22220000002` | Tfeila Restaurant (Mauritanian) |
| 2 | Ali Ould Camara | `+22220000003` | Pizza Nouakchott |
| 3 | Mohamed El Moukhtar | `+22220000004` | Shawarma Al Madina |
| 4 | Cheikh Ould Taly | `+22220000005` | Burger House MR |
| 5 | Oumar Ould Vall | `+22220000006` | Poissonnerie Atlantique (Seafood) |
| 6 | Abderrahmane Ould Sid | `+22220000007` | Kabsa Palace |
| 7 | Isselmou Ould Ahmed | `+22220000008` | Chinguetti Supermarket (Grocery) |
| 8 | Mariem Mint Vall | `+22220000009` | Fresh Market Tevragh (Grocery) |
| 9 | Khadijatou Mint Ely | `+22220000010` | Pharmacie Al Amal |
| 10 | Brahim Ould Diallo | `+22220000011` | Pharmacie Ibn Sina |
| 11 | Fatimetou Mint Ahmed | `+22220000012` | Beauté Mauritanie (Beauty) |

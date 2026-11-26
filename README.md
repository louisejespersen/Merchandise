# Trøjeordrer – første version (forhåbentlig)

En mobilvenlig webapp til registrering og administration af trøjeordrer.

## Funktioner i denne version

- Offentlig ordreformular på forsiden (`/`). Alle med formularlinket kan oprette en ordre.
- Felter: kundenavn, telefonnummer, varenummer, størrelse, tryk (1–9 tegn) og betalt på forhånd.
- Størrelser: XS, S, M, L, XL og XXL.
- Startvarenumre: 101, 102, 103, 104 og 105.
- Separat administration på `/admin` med e-mail og adgangskode.
- Kun godkendte administratorer kan læse og ændre ordrer.
- Administrator kan rette ordreoplysninger, ændre betalingsstatus og markere en ordre som udleveret.
- Tidspunkt for oprettelse, seneste ændring og udlevering gemmes automatisk.
- Administrationssiden kan søge/filtrere, eksportere den viste ordreoversigt til CSV og vedligeholde varenumre.
- Ordrer kan ikke slettes fra brugerfladen.

## Teknologistak

- React + TypeScript + Vite
- Supabase Database (PostgreSQL) og Supabase Auth
- Vercel til hosting

## 1. Opret database i Supabase

1. Opret et projekt på [supabase.com](https://supabase.com/).
2. Åbn projektets **SQL Editor**.
3. Åbn filen `supabase/migrations/001_initial_schema.sql` fra dette projekt, kopiér hele indholdet, indsæt det i SQL Editor, og tryk **Run**.
4. Kontrollér under **Table Editor**, at tabellerne `products`, `orders` og `admin_users` er oprettet. Tabellen `products` skal indeholde 101–105.
5. Under **Authentication → Settings** skal offentlig brugerregistrering (sign-ups) være slået fra. Administratorbrugere oprettes af systemejeren i dashboardet.

SQL-migreringen aktiverer Row Level Security og begrænser databaseadgangen. Den offentlige rolle kan kun læse aktive varenumre og indsætte en ny ordre. Den kan ikke læse eller ændre eksisterende ordrer. Administratorrettigheder tildeles særskilt i databasen.

## 2. Opret den første administrator

1. Gå til **Authentication → Users** i Supabase.
2. Vælg **Add user**, og opret administratorens e-mail og adgangskode. Brug en stærk, unik adgangskode.
3. Find den nye brugers UUID/ID i brugerlisten.
4. Gå til **SQL Editor**, og kør følgende SQL. Erstat UUID'en med brugerens faktiske ID:

```sql
insert into public.admin_users (user_id)
values ('INDSÆT-ADMIN-BRUGERENS-UUID-HER');
```

Kun brugere, der står i `admin_users`, kan få adgang til administrationsdata. Der er ingen selvbetjent oprettelse af administratorer i webappen. Tilføj flere administratorer ved at oprette brugeren i Supabase Auth og indsætte deres UUID i samme tabel.

## 3. Forbind webappen til Supabase

1. Find projektets **Project URL** og **Publishable key** i Supabase Dashboard (API/Connect-indstillingerne).
2. Kopiér `.env.example` til en ny fil med navnet `.env.local` i projektets rodmappe.
3. Indsæt dine værdier:

```env
VITE_SUPABASE_URL=https://DIT-PROJEKT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_DIN_NØGLE
```

Brug kun Supabase' **publishable key** i browserappen. Indsæt aldrig `service_role` eller en `sb_secret_...`-nøgle i `.env.local`, GitHub eller frontend-kode. Browserappen skal kunne indeholde publishable key; databasepolitikkerne beskytter dataadgangen.

## 4. Kør lokalt

Installér Node.js (LTS), åbn en terminal i projektmappen, og kør:

```bash
npm install
npm run dev
```

Vite viser en lokal adresse, typisk `http://localhost:5173`. Åbn den på computeren. Du kan også åbne den lokale netværksadresse på en telefon, hvis telefonen og computeren er på samme netværk.

Kontrollér produktionsbygget med:

```bash
npm run build
```

## 5. Udgiv på Vercel

1. Opret et GitHub-repository, og upload projektmappen (undlad `.env.local`).
2. Opret/log ind på [Vercel](https://vercel.com/), og vælg **Add New → Project**.
3. Importér GitHub-repository'et. Vercel genkender Vite-projektet automatisk.
4. Tilføj de samme to miljøvariabler under **Project → Settings → Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Deploy projektet. Hvis miljøvariablerne tilføjes eller ændres efter første deploy, skal projektet deployes igen.
6. Vercel giver en HTTPS-adresse. Den er ordreformularens link. Administrationssiden ligger på samme domæne plus `/admin`.

`vercel.json` sørger for, at både `/` og `/admin` åbner React-appen.

## Vigtigt om link og sikkerhed

- Ordreformularen er offentlig: alle, der har linket, kan indsende en ordre. Et link er ikke i sig selv en adgangskode, og linket kan videresendes.
- Ordreoversigten er beskyttet med Supabase-login **og** en administratorliste i databasen. At kende `/admin`-adressen giver ikke adgang til ordrerne.
- RLS-reglerne og databasebegrænsningerne håndhæves i databasen, ikke kun i brugerfladen. Det beskytter blandt andet mod at læse andre kunders telefonnumre eller indsende et tryk på over 9 tegn.
- Den første version har ikke CAPTCHA eller særskilt rate limiting på den offentlige formular. Hvis formularlinket deles bredt eller offentliggøres, bør vi tilføje spam-beskyttelse, før systemet bruges i stor skala.
- Supabase og Vercel er eksterne tjenester. Gennemgå deres aktuelle priser, databehandleraftaler og dataplacering, inden I lægger rigtige kundeoplysninger i systemet.
- Der er ikke lavet automatiske backups/eksportplan i denne første version. Overvej en backup- og sletteprocedure, især fordi der gemmes telefonnumre.

## Antagelser i første version

- Trykfeltet er påkrævet og skal indeholde 1–9 tegn.
- Ordre-id er et automatisk stigende nummer, som vises med `#` foran.
- Betalingsstatus kan rettes af administratoren.
- En ordre markeres som udleveret ved en handling i administrationen. Udleveringstidspunktet sættes på serversiden.
- Produkter fjernes ikke fysisk. De kan deaktiveres, så gamle ordrer fortsat kan referere til deres varenummer.

## Mappestruktur

```text
ordre-styring/
├── src/
│   ├── App.tsx
│   ├── lib.ts
│   ├── main.tsx
│   └── styles.css
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── .env.example
├── index.html
├── package.json
├── vercel.json
└── README.md
```

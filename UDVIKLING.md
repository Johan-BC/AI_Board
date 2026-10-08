# Udvikling af AI Board

Koden udvikles her på din private pc mod **opdigtede testdata**. Den rigtige side kører hos nuuday.
Firmaets data og GitHub-adgang kommer aldrig på denne pc.

```
DIN PC (udvikling)                          NUUDAY (produktion)
──────────────────                          ───────────────────
Johan-BC/AI_Board          (privat)  ──►    nuuday/ai-board         koden + Pages
  koden — kilden til alt                    kopieres manuelt ved udgivelse
Johan-BC/AI_Board-testdata (privat)         nuuday/ai-board-data    de rigtige data
  opdigtede initiativer                     rør aldrig fra denne pc
```

| Fil | Udvikling (`Johan-BC`) | Produktion (`nuuday`) |
|---|---|---|
| `index.html`, `overblik.html`, `project/app/*.jsx` | samme | samme — kopieres ved udgivelse |
| `config.js` | peger på `Johan-BC/AI_Board-testdata` | peger på `nuuday/ai-board-data` — **kopieres aldrig** |
| `data.json` | testdata (skabelon til testdata-repoet) | ligger kun i `nuuday/ai-board-data` — **kopieres aldrig** |

---

## Første gang (ca. 10 minutter)

### 1. Hent koden
```
git clone https://github.com/Johan-BC/AI_Board.git
cd AI_Board
```

### 2. Opret testdata-repoet
1. github.com → **New repository** → owner **Johan-BC** → navn **`AI_Board-testdata`** → **Private** →
   sæt flueben i *Add a README file* → **Create repository**.
2. **Add file → Upload files** → træk `data.json` fra din `AI_Board`-mappe ind → **Commit changes**.

### 3. Opret et test-token
github.com → profilbillede → **Settings → Developer settings → Personal access tokens →
Fine-grained tokens → Generate new token**:

- **Token name:** `AI Board – test`
- **Resource owner:** Johan-BC
- **Expiration:** 90 dage (eller hvad du foretrækker)
- **Repository access:** *Only select repositories* → `AI_Board-testdata`
- **Permissions → Repository permissions → Contents:** *Read and write*

Det er din egen konto, så tokenet virker med det samme — ingen godkendelse. Kopiér værdien
(`github_pat_…`) og gem den i din password-manager; GitHub viser den kun én gang.

### 4. Start boardet lokalt
```
python -m http.server 8080
```
(Windows: hvis `python` ikke findes, så brug `py -m http.server 8080`.)

Åbn **`http://localhost:8080/#edit=DIT_TEST_TOKEN`** i browseren, og skriv dit navn.
Tokenet forsvinder fra adresselinjen, og browseren husker det — fremover er det bare
`http://localhost:8080/`.

Overbliksiden virker også lokalt: `http://localhost:8080/overblik.html`. Indsæt test-tokenet i
begge felter under *Adgang*, hvis du vil se links og seneste ændringer.

> Boardet skal køres via `http.server` — åbner du `index.html` direkte fra mappen (`file://`),
> virker det ikke.

---

## Daglig udvikling

1. Åbn en terminal i `AI_Board`-mappen og start serveren: `python -m http.server 8080`.
2. Start Claude Code i samme mappe (en anden terminal eller desktop-appen) og beskriv ændringen.
3. Genindlæs `http://localhost:8080/`. Ser siden ikke opdateret ud, så lav en hård genindlæsning
   (**Ctrl+Shift+R** eller **Ctrl+F5**) — browseren kan have gemt en gammel kopi.
4. Når det virker: bed Claude committe og pushe, eller gør det selv:
   ```
   git add -A
   git commit -m "Beskrivelse af ændringen"
   git push
   ```

Alt du retter på boardet lokalt, gemmes i `AI_Board-testdata` — leg løs, det er opdigtede data.
Vil du starte forfra med testdata: upload `data.json` fra `AI_Board` til testdata-repoet igen.

### Test før udgivelse
- **Uden link:** åbn `http://localhost:8080/` i et privat vindue → "Du skal bruge dit link".
- **Redigering:** ret et initiativ → "Gemt ✓", og ændringen står i `AI_Board-testdata` med dit navn.
- **To redaktører:** åbn boardet i to browsere (fx Chrome + Edge, begge med `#edit=`-linket),
  ret forskellige initiativer samtidig → begge ændringer overlever.
- **Visning:** lav evt. et ekstra read-only test-token og åbn `#view=`-linket → kan ikke rette.

---

## Udgivelse til nuuday

Sker fra din **arbejds-pc**, så nuuday-adgangen bliver dér.

1. Gå til `https://github.com/Johan-BC/AI_Board` (log ind med din private GitHub i browseren) →
   **Code → Download ZIP** → pak ud.
2. Gå til `https://github.com/nuuday/ai-board` (din arbejds-GitHub) → **Add file → Upload files**.
3. Træk de ændrede filer ind — typisk:
   - `index.html`
   - `overblik.html`
   - mappen `project` (hele mappen, så `project/app/…` bevares)
4. **Aldrig** `config.js` eller `data.json`.
5. Skriv hvad der er ændret i commit-beskeden → **Commit changes**.
6. Vent 1–2 minutter, og tjek `https://nuuday.github.io/ai-board/`.

**Hvis en ændring har tilføjet en ny indstilling i `config.js`:** kopiér ikke filen — ret
`config.js` i `nuuday/ai-board` direkte på GitHub (blyanten) og tilføj kun den nye linje.

**Ændringer i datastrukturen** (nye felter på initiativer o.l.) håndteres i `parseJSON()` i
`project/app/data.jsx`, så eksisterende data i `nuuday/ai-board-data` opgraderes automatisk ved
indlæsning. Ret aldrig de rigtige data i hånden for at følge med koden.

---

## Godt at vide
- **"Du skal bruge dit link" selvom du har brugt `#edit=`-linket** → lav en hård genindlæsning
  (**Ctrl+Shift+R** / **Ctrl+F5**) og åbn linket igen. Typisk efter `git pull`, hvor browseren
  stadig viser den gamle side.
- **Token udløbet lokalt** → boardet siger "Dit link virker ikke længere". Lav et nyt test-token
  og åbn `http://localhost:8080/#edit=NYT_TOKEN`.
- **`localhost` og `nuuday.github.io` husker hver deres token** — de er forskellige adresser i browseren.
- **Git-historikken i `Johan-BC/AI_Board`** indeholder stadig de rigtige data fra før
  testdata blev lagt ind. Repoet er privat; vil du helt af med dem, så start et nyt repo uden historik.
- Arkitektur, datamodel og sync er beskrevet i [`progress.md`](progress.md).

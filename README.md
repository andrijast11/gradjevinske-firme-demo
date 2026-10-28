# Demo sajt za građevinske firme — Salty.rs

Demo sajt fiktivne firme „Armatura Gradnja“ za email kampanje prema građevinskim firmama.
Čist HTML/CSS/JS, bez build koraka i bez biblioteka. Ilustracije se crtaju kodom (canvas + SVG), pa nema slika za učitavanje.

## Pokretanje

Otvorite `index.html` u browseru ili pokrenite lokalni server:

```bash
python3 -m http.server 8000
```

Za hosting je dovoljan bilo koji statički host (Netlify, Vercel, GitHub Pages, Cloudflare Pages).

## Personalizacija za email kampanje

Ime firme i grad se menjaju kroz URL parametre, pa svaki primalac vidi sajt sa imenom svoje firme:

```
https://demo.salty.rs/?firma=Gradex&grad=Kragujevac
```

- `firma`: zamenjuje ime u logotipu, preloaderu, footeru i naslovu taba (do 24 karaktera)
- `grad`: zamenjuje gradove u hero oznaci

## Šta je unutra

- Preloader sa brojačem i animacijom krana
- 3D žičani model zgrade u heroju koji se gradi sprat po sprat, prati miš i „rasklapa se“ na skrol
- Custom kursor, magnetna dugmad, grain tekstura
- Manifest čije se reči pale dok skrolujete
- Brojači, marquee trake koje ubrzavaju sa brzinom skrola
- Usluge sa ilustracijom koja prati kursor
- Horizontalni skrol projekata sa paralaksom
- Klizač „nacrt / završeno“ (blueprint naspram gotovog objekta)
- Timeline procesa koji se iscrtava na skrol
- Kalkulator cene gradnje sa animiranim brojem
- Slider utisaka, kontakt forma sa animacijom potvrde
- Poštuje `prefers-reduced-motion`

---

# Demo 2: 3D prikaz zgrade za investitore (`/investitori/`)

Sajt za prodaju stanova iz projekta „Sava Residence“. Kupac okreće 3D model zgrade, klikne na sprat, vidi osnovu sa stanovima obojenim po statusu (slobodan / rezervisan / prodat), pa otvori stan sa 2D osnovom, cenom i ratom kredita.

- 3D model na Three.js (r169, uključen lokalno u `investitori/vendor/`, bez CDN-a)
- Filteri po strukturi, strani sveta, budžetu i statusu: osvetljavaju spratove i stanove u 3D-u i filtriraju tabelu
- Kartica stana sa osnovom koja se crta iz podataka, terasom i orijentacijom
- Dan / noć režim, automatska rotacija, mobilni prikaz sa bottom sheet-om
- Sačuvani stanovi idu direktno u formu za zakazivanje razgledanja
- Kalkulator kredita, lokacija, plan plaćanja

Podaci o stanovima su u `investitori/data.js` (raspored po spratu, sobe, cene, statusi). Za pravog klijenta se menja samo taj fajl.

Personalizacija: `investitori/?firma=Gradex&projekat=Kej%20Rezidencija`

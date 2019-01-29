================
Ny repo-struktur
================

Motivasjon
==========

Vi ønsker å dele opp gondul-repoet i mindre blokker, hensikten bak splitten
er delt:

- Klarere skille mellom ellers uavhengige komponenter
- Enklere utvikling for alle
- Deployment forenkles ved å ha det i et eget repo, og at hvert repo kan
  levere en faktisk pakke som installeres om ønskelig.
- Lettere å fryse enkelt-komponenter i forkant av arrangement.



Nye repo
========

- Templating
- Front - inkluderer web/{js,img,fonts,css} og web/index.html
- lib - inkluderer include/  - Målet er nok å endre denne, da det ikke
  egentlig er voldsomt overlapp mellom API og collectors, men inntill
  videre er det eget repo.
- api - inkluderer web/api
- collectors - inkluderer collectors/
- gondul/ - inkluderer ansible, dokumentasjon, default config.

På sikt er målet at API er det eneste som snakker med postgres, men inntill
videre vil fortsatt collectors snakke direkte. Collectors kan i prinsippet
deles yttligere opp om det ønskes, men det blir mye små-repoer.

Navn:

- gondul-templating
- gondul-frontend
- gondul-api
- gondul-collectors
- gondul

Repoet som da heter "gondul" blir "master-repo" og et slags
integrasjonsrepo. Det kan potensielt bli delt mer på sikt for å skille
ansible-saker fra dokumentasjon mm. Dette venter vi med for å unngå
usedvanlig mye fragmentering.

Installasjon
============

Alt installeres default i /opt/$gondul-repo - Det vil være opp til
master-repoet å binde ting sammen. Det vil typisk bety at apache/nginx
settes opp for å levere statisk innhold for front og i dag levere CGI for
API, templating settes opp på egen port - Varnish vil da sørge for faktisk
ruting. 

Alt av "deployment" legges i "gondul"-repoet, men hver enkelt repo kan også
ønske å levere rutiner for isolert installasjon av typen som hører hjemme i
for eksempel en python-pakke eller debian-pakke.




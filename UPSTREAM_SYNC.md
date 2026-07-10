# Upstreami uuendamine

Meie püsiv haru on `to/main`. Upstreami `master` merge'itakse sellesse harusse nii, et meie erisused jäävad alles ja upstreami parandused lisatakse nende kõrvale.

## Uuendamine

1. Veendu, et tööpuu on puhas ja oled õiges harus:

   ```bash
   git status --short --branch
   git switch to/main
   ```

2. Värskenda mõlemad remote'id ja vaata saabuvad muudatused üle:

   ```bash
   git fetch upstream --tags
   git fetch origin --tags
   git log --oneline HEAD..upstream/master
   git log --oneline upstream/master..HEAD
   ```

3. Merge'i upstream eraldi merge-commit'iga:

   ```bash
   git merge --no-ff upstream/master
   ```

   Konflikte ei lahendata pimesi `--ours` ega `--theirs` valikuga. Iga konflikt vaadatakse eraldi üle: meie funktsionaalsus peab säilima, kuid upstreami uus loogika tuleb samuti sisse võtta, kui see meie erisust ei asenda.

4. Kontrolli tulemust:

   ```bash
   git diff ORIG_HEAD..HEAD
   npm --prefix tests test
   npm run build
   ```

   Kasuta alati projekti hetkel kehtivaid täismahus kontrollkäske; ära pushi katkist buildi.

5. Push'i meie haru:

   ```bash
   git push origin to/main
   ```

## Meie versioon ja `upgrade.sh`

`to/main` push käivitab `.github/workflows/prebuilt-release.yml` töövoo. See ehitab standalone-arhiivi ning loob GitHubi release'i ja meie versioonitagi kujul:

```text
prebuilt-<package.json version>-<commit short SHA>
```

Näiteks `prebuilt-0.5.20-a1b2c3d`. Eraldi käsitsi tagi ei looda, sest sama töövoo paralleelne tag-trigger tekitaks kaks konkureerivat release-buildi.

Kontrolli, et tag ja release'i arhiiv on olemas:

```bash
version="$(node -p "require('./package.json').version")"
sha="$(git rev-parse --short HEAD)"
tag="prebuilt-${version}-${sha}"
git ls-remote --tags origin "$tag"
gh release view "$tag"
```

Serveri `upgrade.sh` resetib töökoopia `origin/to/main` peale ning valib GitHub Releases API vastusest uusima release'i, millel on `9router-prebuilt-*.tar.gz` asset. Seetõttu on uuendus valmis alles siis, kui haru, versioonitag ja release'i arhiiv on kõik remote'is kontrollitud.

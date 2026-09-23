"""Sincroniza el contenido de los servicios desde la carpeta de Drive "Agencia E - web".

Qué hace:
  1. Lista cada subcarpeta de Drive (una por servicio, más "quienes somos").
  2. Baja lo nuevo, achica fotos (JPG de hasta 1400 px) y videos (MP4 720p, sin audio, hasta 20 s, con portada).
  3. Escribe assets/servicios/servicios.json, que es lo que lee la página para armar las grillas,
     las tiras de las tarjetas, el carrusel y la foto de "Quiénes somos".
  4. Borra de assets/servicios lo que ya no está en Drive.

Lo que ya se procesó no se vuelve a procesar (se reconoce por tamaño y tipo de archivo).

Uso:
  python tools/sync_servicios.py                 # desde Drive (necesita GDRIVE_SA_KEY con la clave de la cuenta de servicio)
  python tools/sync_servicios.py --local CARPETA # desde una copia local con las mismas subcarpetas

Orden dentro de cada servicio: primero los archivos cuyo nombre empieza con número y guion ("01-", "02_"...),
después los fijados en FIJAR, y después el resto, del más nuevo al más viejo. Se muestran hasta MAX_POR_SERVICIO.
"""
import argparse, datetime as dt, hashlib, io, json, os, re, shutil, subprocess, sys, tempfile, unicodedata
from pathlib import Path

from PIL import Image, ImageOps

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "assets" / "servicios"
MANIFIESTO = SALIDA / "servicios.json"
CARPETA_DRIVE = "1PMt-KXN75yiCM0lm6piRpz9OD-m1iEQT"  # "Agencia E - web"

MAX_POR_SERVICIO = 12
IMG_MAX = 1400
VIDEO_LADO = 720
VIDEO_SEG = 20

# Para poner algo primero sin renombrarlo en Drive: parte del nombre (en minúscula, sin tildes).
FIJAR = {
    "branding": ["presentacion-logo", "db26bc19"],  # Stampit primero
    "equipo": ["316cc8d9"],                          # la foto a color del equipo
    "merch": ["merch-stampit", "tote3"],
}

IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff"}
VID_EXT = {".mov", ".mp4", ".m4v", ".webm", ".avi"}


def sin_tildes(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().strip()


def servicio_de(nombre_carpeta):
    n = sin_tildes(nombre_carpeta)
    if "quien" in n or "equipo" in n: return "equipo"
    if n in ("ia", "ai") or "inteligencia" in n or n.endswith(" ia"): return "ia"
    if "merch" in n: return "merch"
    if "ugc" in n: return "ugc"
    if n == "cm" or "community" in n: return "community"
    if "evento" in n: return "eventos"
    if "direcc" in n or "produc" in n: return "produccion"
    if "fotograf" in n: return "fotografia"
    if "brand" in n: return "branding"
    if "contenido" in n: return "contenido"
    return None


def slug(nombre):
    base = Path(nombre).stem
    base = re.sub(r"^(copia de |copy of )", "", base, flags=re.I)
    s = re.sub(r"[^a-z0-9]+", "-", sin_tildes(base)).strip("-")
    return (s or "archivo")[:40].strip("-")


def orden(arch, fijar):
    m = re.match(r"^(\d{1,3})[-_]", arch["nombre"])
    if m: return (0, int(m.group(1)), "")
    s = slug(arch["nombre"])
    for i, f in enumerate(fijar):
        if f in s: return (1, i, "")
    return (2, 0, "".join(chr(0x10FFFF - ord(c)) for c in arch["modificado"]))  # más nuevo primero


# ---------------- fuentes ----------------
def fuente_local(carpeta):
    carpeta = Path(carpeta)
    for sub in sorted(p for p in carpeta.iterdir() if p.is_dir()):
        srv = servicio_de(sub.name)
        if not srv: print(f"  (salteo carpeta {sub.name!r})"); continue
        for f in sorted(sub.rglob("*")):
            if f.is_file():
                st = f.stat()
                yield srv, {"nombre": f.name, "tam": st.st_size, "modificado": dt.datetime.fromtimestamp(st.st_mtime).isoformat(),
                            "bajar": (lambda dest, f=f: shutil.copyfile(f, dest))}


def fuente_drive():
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload
    info = json.loads(os.environ["GDRIVE_SA_KEY"])
    cred = service_account.Credentials.from_service_account_info(info, scopes=["https://www.googleapis.com/auth/drive.readonly"])
    api = build("drive", "v3", credentials=cred, cache_discovery=False)

    def hijos(pid):
        tok = None
        while True:
            r = api.files().list(q=f"'{pid}' in parents and trashed=false", pageSize=1000, pageToken=tok,
                                 fields="nextPageToken, files(id,name,mimeType,size,modifiedTime,shortcutDetails)",
                                 supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
            yield from r.get("files", [])
            tok = r.get("nextPageToken")
            if not tok: break

    def resolver(f):  # los accesos directos apuntan a otra carpeta o archivo
        if f["mimeType"] != "application/vnd.google-apps.shortcut": return f
        sd = f.get("shortcutDetails", {})
        try:
            return api.files().get(fileId=sd["targetId"], fields="id,name,mimeType,size,modifiedTime", supportsAllDrives=True).execute()
        except Exception as e:
            print(f"  (no pude abrir el acceso directo {f['name']!r}: {e})"); return None

    def recorrer(pid, vistas=None):
        vistas = vistas if vistas is not None else set()
        if pid in vistas: return
        vistas.add(pid)
        for f in hijos(pid):
            f = resolver(f)
            if not f: continue
            if f["mimeType"] == "application/vnd.google-apps.folder": yield from recorrer(f["id"], vistas)
            elif not f["mimeType"].startswith("application/vnd.google-apps"): yield f

    def bajador(fid):
        def bajar(dest):
            with open(dest, "wb") as out:
                d = MediaIoBaseDownload(out, api.files().get_media(fileId=fid, supportsAllDrives=True), chunksize=16 * 1024 * 1024)
                listo = False
                while not listo: _, listo = d.next_chunk()
        return bajar

    for sub in hijos(CARPETA_DRIVE):
        sub = resolver(sub)
        if not sub: continue
        if sub["mimeType"] != "application/vnd.google-apps.folder": continue
        srv = servicio_de(sub["name"])
        if not srv: print(f"  (salteo carpeta {sub['name']!r})"); continue
        for f in recorrer(sub["id"]):
            yield srv, {"nombre": f["name"], "tam": int(f.get("size", 0)), "modificado": f["modifiedTime"], "mime": f["mimeType"], "bajar": bajador(f["id"])}


# ---------------- procesamiento ----------------
def ffprobe_wh(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                          "-of", "csv=p=0:s=x", str(path)], capture_output=True, text=True, check=True).stdout.strip()
    w, h = out.split("\n")[0].split("x")
    return int(w), int(h)


def hacer_imagen(src, dest):
    im = ImageOps.exif_transpose(Image.open(src))
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA"); fondo = Image.new("RGB", im.size, (255, 255, 255)); fondo.paste(im, mask=im.split()[-1]); im = fondo
    im = im.convert("RGB"); im.thumbnail((IMG_MAX, IMG_MAX), Image.LANCZOS)
    im.save(dest, "JPEG", quality=82, optimize=True, progressive=True)
    return im.size


def hacer_video(src, dest, portada):
    esc = f"scale='if(gt(iw,ih),-2,min({VIDEO_LADO},iw))':'if(gt(iw,ih),min({VIDEO_LADO},ih),-2)'"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-t", str(VIDEO_SEG), "-an", "-vf", f"{esc},fps=30",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "27", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(dest)], check=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", "0.5", "-i", str(dest), "-frames:v", "1", "-q:v", "4", str(portada)], check=True)
    return ffprobe_wh(dest)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--local", help="carpeta local con las mismas subcarpetas que Drive")
    a = ap.parse_args()

    viejo = json.loads(MANIFIESTO.read_text(encoding="utf8")) if MANIFIESTO.exists() else {}
    cache = viejo.get("_cache", {})
    print("Listando", "carpeta local" if a.local else "Drive", "…")
    por_srv = {}
    for srv, arch in (fuente_local(a.local) if a.local else fuente_drive()):
        ext, mime = Path(arch["nombre"]).suffix.lower(), arch.get("mime", "")
        if ext in IMG_EXT or (not ext and mime.startswith("image/")): arch["tipo"] = "img"
        elif ext in VID_EXT or (not ext and mime.startswith("video/")): arch["tipo"] = "video"
        elif mime.startswith("image/") and mime != "image/svg+xml": arch["tipo"] = "img"
        elif mime.startswith("video/"): arch["tipo"] = "video"
        else: continue
        arch["clave"] = f"{arch['tam']}|{arch['tipo']}"
        por_srv.setdefault(srv, []).append(arch)

    servicios, nueva_cache, usados = {}, {}, set()
    for srv, archs in sorted(por_srv.items()):
        archs.sort(key=lambda x: orden(x, FIJAR.get(srv, [])))
        vistos, elegidos = set(), []
        for x in archs:  # mismo archivo subido dos veces: va una sola vez
            if x["clave"] in vistos: continue
            vistos.add(x["clave"]); elegidos.append(x)
        elegidos = elegidos[:MAX_POR_SERVICIO] if srv != "equipo" else elegidos
        carpeta = SALIDA / srv; carpeta.mkdir(parents=True, exist_ok=True)
        def en_cache(x):
            c = cache.get(x["clave"])
            ok = c and c["src"].startswith(f"assets/servicios/{srv}/") and all((RAIZ / p).exists() for p in [c["src"]] + ([c["poster"]] if c.get("poster") else []))
            return c if ok else None
        items, nombres = [], {Path(en_cache(x)["src"]).stem for x in elegidos if en_cache(x)}
        for x in elegidos:
            c = en_cache(x)
            if c:
                item = c
            else:
                base = slug(x["nombre"]); n = base; k = 2
                while n in nombres: n = f"{base}-{k}"; k += 1
                print(f"  {srv}: {x['nombre']}")
                with tempfile.TemporaryDirectory() as td:
                    tmp = Path(td) / ("in" + (Path(x["nombre"]).suffix.lower() or (".mp4" if x["tipo"] == "video" else ".img"))); x["bajar"](tmp)
                    if x["tipo"] == "img":
                        w, h = hacer_imagen(tmp, carpeta / f"{n}.jpg")
                        item = {"tipo": "img", "src": f"assets/servicios/{srv}/{n}.jpg", "w": w, "h": h}
                    else:
                        w, h = hacer_video(tmp, carpeta / f"{n}.mp4", carpeta / f"{n}.jpg")
                        item = {"tipo": "video", "src": f"assets/servicios/{srv}/{n}.mp4", "poster": f"assets/servicios/{srv}/{n}.jpg", "w": w, "h": h}
            nombres.add(Path(item["src"]).stem)
            usados.update([item["src"]] + ([item["poster"]] if item.get("poster") else []))
            nueva_cache[x["clave"]] = item
            items.append({k: v for k, v in item.items()})
        servicios[srv] = items

    # si una carpeta no vino (por ejemplo en modo local), se mantiene lo que había
    for srv, items in viejo.get("servicios", {}).items():
        if srv not in servicios:
            servicios[srv] = items
            for it in items:
                usados.update([it["src"]] + ([it["poster"]] if it.get("poster") else []))
            for k, v in cache.items():
                if v.get("src", "").startswith(f"assets/servicios/{srv}/"): nueva_cache[k] = v

    borrados = 0
    for f in SALIDA.rglob("*"):
        if f.is_file() and f != MANIFIESTO and f.relative_to(RAIZ).as_posix() not in usados:
            f.unlink(); borrados += 1
    for d in sorted((p for p in SALIDA.rglob("*") if p.is_dir()), reverse=True):
        if not any(d.iterdir()): d.rmdir()

    nuevo = {"servicios": servicios, "_cache": nueva_cache}
    if {k: v for k, v in viejo.items() if k != "generado"} != nuevo:
        nuevo = {"generado": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), **nuevo}
        MANIFIESTO.write_text(json.dumps(nuevo, ensure_ascii=False, indent=1), encoding="utf8")
        print("servicios.json actualizado.")
    else:
        print("Sin cambios.")
    print("Listo:", {s: len(i) for s, i in servicios.items()}, f"· {borrados} archivos viejos borrados")


if __name__ == "__main__":
    main()

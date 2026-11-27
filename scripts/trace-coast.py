# Traces Leonida's coast, islands and lakes from the GTADB map tiles into our own vector shapes.
# Tiles: "GTA VI Map Tiles (CC BY 4.0) — https://map.gtadb.org" (github.com/rolux/gtadb.org, maps/tiles/6/day).
# Run: python3 scripts/trace-coast.py   (needs numpy, pillow, scikit-image)
# Writes scripts/geo/leonida-geo.json: the shapes in our 1000 x 1200 plane, plus the transform from game
# coordinates (GTADB's x east, y north) to that plane, so pins placed in game coordinates land on the same map.
import json, os, sys, urllib.request
import numpy as np
from PIL import Image
from skimage import measure, morphology
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "gtadb-tiles")
OUT = os.path.join(ROOT, "scripts", "geo", "leonida-geo.json")
Z, TX, TY = 2, range(2, 11), range(2, 13)          # zoom 2 covers the state in 9 x 11 tiles of 256 px
URL = "https://raw.githubusercontent.com/rolux/gtadb.org/HEAD/maps/tiles/6/day/{z}/{z},{y},{x}.jpg"
W, H, MARGIN = 1000, 1200, 24

def stitch():
    os.makedirs(CACHE, exist_ok=True)
    img = Image.new("RGB", (len(TX) * 256, len(TY) * 256))
    for y in TY:
        for x in TX:
            f = os.path.join(CACHE, f"{Z},{y},{x}.jpg")
            if not os.path.exists(f):
                urllib.request.urlretrieve(URL.format(z=Z, y=y, x=x), f)
            img.paste(Image.open(f), ((x - TX[0]) * 256, (y - TY[0]) * 256))
    return np.asarray(img).astype(int)

a = stitch()
water = (a[..., 2] - a[..., 0]) > 70                 # the sea and lakes are strongly blue; land, sand and towns are not
land = morphology.opening(~water, morphology.disk(2))      # drop bridges and specks
land = morphology.remove_small_objects(land, max_size=40)
filled = ndimage.binary_fill_holes(land)
lakes_mask = morphology.remove_small_objects(filled & ~land, max_size=900)  # only the big inland water
land = filled & ~lakes_mask

lab = measure.label(land)
props = sorted(measure.regionprops(lab), key=lambda p: -p.area)
keep = [p for p in props if p.area >= 60]
r0, c0, r1, c1 = (min(p.bbox[0] for p in keep), min(p.bbox[1] for p in keep), max(p.bbox[2] for p in keep), max(p.bbox[3] for p in keep))
k = min((W - 2 * MARGIN) / (c1 - c0), (H - 2 * MARGIN) / (r1 - r0))
ox = MARGIN + ((W - 2 * MARGIN) - (c1 - c0) * k) / 2 - c0 * k
oy = MARGIN + ((H - 2 * MARGIN) - (r1 - r0) * k) / 2 - r0 * k

def outline(mask, tol):
    cs = measure.find_contours(np.pad(mask, 1).astype(float), 0.5)
    c = max(cs, key=len) - 1
    c = measure.approximate_polygon(c, tolerance=tol)[:-1]
    return [[round(col * k + ox), round(row * k + oy)] for row, col in c]

shapes = []
for p in keep:
    m = lab[p.slice] == p.label
    full = np.zeros_like(land); full[p.slice] = m
    pts = outline(full, 1.1 if p.area > 4000 else 0.8)
    if len(pts) >= 3: shapes.append({"area": int(p.area), "pts": pts})

lakes = []
for p in measure.regionprops(measure.label(lakes_mask)):
    full = np.zeros_like(land); full[p.slice] = (measure.label(lakes_mask)[p.slice] == p.label)
    lakes.append({"area": int(p.area), "pts": outline(full, 1.0)})

# game (x east, y north; 8 units per z2 pixel, origin at 16384) -> our plane: u = gx * ax + bx, v = gy * ay + by
ax, ay = k / 8, -k / 8
bx = ox + ((16384) / 8 - TX[0] * 256) * k
by = oy + ((16384) / 8 - TY[0] * 256) * k
# Regions: GTADB names each landmark's area; we group the areas into Rockstar's six regions, label every cell of a
# coarse grid by a vote of its nearest landmarks, and trace each region's outline. Renderers clip regions to the land.
LANDMARKS = "https://raw.githubusercontent.com/rolux/gtadb.org/HEAD/map/data/6/landmarks.json"
AREAS = {
    "vice-city": ["Vice City", "Vice Beach", "Rialto Islands", "Vice-Dale County", "Gloriana Key", "Vice City International Airport",
                  "Dalton Island", "Catalan Key", "Port Vice City", "La Perle", "Peacock Bay", "Starfish Island", "Catalan Bay"],
    "port-gellhorn": ["Port Gellhorn", "Kelly County", "Gellhorn International Raceway", "Capri"],
    "ambrosia": ["Ambrosia", "Leonida", "Belville", "Waning Sands", "Leonard County", "Sundown", "Emerald Springs"],
    "mount-kalaga": ["Lummox County", "Moreau", "Grayson", "Buck Creek", "Frampton Islands", "Millport"],
    "grassrivers": ["Hamlet", "Watson Bay", "Mariana County", "Bluegrass", "Peregrine Bay", "Buckskin"],
    "leonida-keys": ["Key Lento", "Southwind", "Abismo Key", "Maroon Key", "Goose Key"],
}
region_of = {a: r for r, areas in AREAS.items() for a in areas}
lf = os.path.join(CACHE, "landmarks.json")
if not os.path.exists(lf): urllib.request.urlretrieve(LANDMARKS, lf)
seeds = []
for v in json.load(open(lf)).values():
    if len(v) > 1 and len(v[1]) == 2 and v[0].split(", ")[-1] in region_of:
        seeds.append((v[1][0] * ax + bx, v[1][1] * ay + by, region_of[v[0].split(", ")[-1]]))
ids = list(AREAS)
S = np.array([[x, y] for x, y, _ in seeds]); R = np.array([ids.index(r) for _, _, r in seeds])
G = 6                                                    # grid cell, in map units
gy, gx = np.mgrid[0:H:G, 0:W:G]
cells = np.stack([gx.ravel() + G / 2, gy.ravel() + G / 2], 1)
votes = np.zeros((len(cells), len(ids)))
for i in range(0, len(cells), 2000):
    d = ((cells[i:i + 2000, None, :] - S[None, :, :]) ** 2).sum(-1)
    nn = np.argsort(d, 1)[:, :25]
    for j in range(len(ids)): votes[i:i + 2000, j] = (R[nn] == j).sum(1)
grid = votes.argmax(1).reshape(gx.shape)
grid = ndimage.generic_filter(grid, lambda w: np.bincount(w.astype(int), minlength=len(ids)).argmax(), size=5)
regions = {}
for j, rid in enumerate(ids):
    m = ndimage.binary_fill_holes(grid == j)
    lab2 = measure.label(m); big = max(measure.regionprops(lab2), key=lambda p: p.area)
    c = measure.find_contours(np.pad(lab2 == big.label, 1).astype(float), 0.5)
    c = measure.approximate_polygon(max(c, key=len) - 1, tolerance=0.8)[:-1]
    regions[rid] = [[round(col * G + G / 2), round(row * G + G / 2)] for row, col in c]

# Streets: thin bright lines on the land (a top-hat filter), thinned to one pixel, split at junctions into chains,
# then simplified. Short stubs are dropped. Renderers draw them faintly once you zoom in.
L = a.mean(-1)
road = (morphology.white_tophat(L, morphology.disk(3)) > 28) & ~water
road = morphology.remove_small_objects(road, max_size=60)
sk = morphology.skeletonize(road)
lab_sk = measure.label(sk, connectivity=2)
for p in measure.regionprops(lab_sk):
    if p.area < 220: sk[lab_sk == p.label] = False      # drop specks that are not part of the network
nb = ndimage.convolve(sk.astype(int), np.ones((3, 3), int), mode="constant") - 1
chains = sk & (nb <= 2)                                    # remove junction pixels; what is left are simple chains
paths = []
lab_c = measure.label(chains, connectivity=2)
for p in measure.regionprops(lab_c):
    if p.area < 12: continue
    cells = {tuple(c) for c in p.coords}
    def nbrs(c): return [(c[0] + dy, c[1] + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx) and (c[0] + dy, c[1] + dx) in cells]
    start = next((c for c in cells if len(nbrs(c)) <= 1), next(iter(cells)))
    path, seen, cur = [start], {start}, start
    while True:
        nxt = [n for n in nbrs(cur) if n not in seen]
        if not nxt: break
        cur = nxt[0]; seen.add(cur); path.append(cur)
    paths.append(path)
# close the gaps the filter leaves: each loose end reaches to the nearest street pixel of another line within 7 px
from scipy.spatial import cKDTree
allpts = np.array([c for path in paths for c in path] + [tuple(c) for c in np.argwhere(sk & (nb > 2))], float)
owner = np.array([i for i, path in enumerate(paths) for _ in path] + [-1] * int((sk & (nb > 2)).sum()))
tree = cKDTree(allpts)
for i, path in enumerate(paths):
    for end in (0, -1):
        e = path[end]
        for d, j in zip(*tree.query(e, k=12, distance_upper_bound=7)):
            if np.isinf(d) or owner[j] == i: continue
            q = tuple(int(v) for v in allpts[j])
            if end == 0: path.insert(0, q)
            else: path.append(q)
            break
streets = []
for path in paths:
    line = measure.approximate_polygon(np.array(path, float), tolerance=1.2)
    streets.append([[round(c * k + ox, 1), round(r * k + oy, 1)] for r, c in line])

# region label at the middle of its landmarks; towns are the built-up blobs, from where each town's landmarks spread
labels = {rid: [round(float(S[R == j][:, 0].mean())), round(float(S[R == j][:, 1].mean()))] for j, rid in enumerate(ids)}
by_area = {}
for v in json.load(open(lf)).values():
    if len(v) > 1 and len(v[1]) == 2: by_area.setdefault(v[0].split(", ")[-1], []).append((v[1][0] * ax + bx, v[1][1] * ay + by))
towns = []
for name, step in [("Vice City", 9), ("Vice Beach", 7), ("Port Gellhorn", 8), ("Capri", 6), ("Hamlet", 6), ("Key Lento", 6), ("Ambrosia", 6)]:
    P = np.array(by_area[name])
    towns.append([round(float(P[:, 0].mean())), round(float(P[:, 1].mean())), round(float(P[:, 0].std() * 1.5)), round(float(P[:, 1].std() * 1.5)), step])

geo = {
    "source": "GTA VI Map Tiles (CC BY 4.0) — https://map.gtadb.org. Traced and simplified; changes made.",
    "size": [W, H], "transform": {"ax": ax, "bx": bx, "ay": ay, "by": by},
    "land": shapes[0]["pts"], "islands": [s["pts"] for s in shapes[1:]], "lakes": [l["pts"] for l in sorted(lakes, key=lambda l: -l["area"])], "regions": regions, "labels": labels, "towns": towns, "streets": streets,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(geo, open(OUT, "w"), separators=(",", ":"))
print(f"streets {len(streets)} ({sum(len(x) for x in streets)} pts), land {len(geo['land'])} pts, islands {len(geo['islands'])} ({sum(len(i) for i in geo['islands'])} pts), lakes {len(geo['lakes'])}, scale {k:.3f}")

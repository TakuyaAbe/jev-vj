"""Hina pizza: a toy-like pizza topped with hishimochi, for the HINAMATSURI key visual.

Builds the whole scene from an empty file, saves hina_pizza.blend, renders the stills and
exports a light glTF for three.js. Re-runnable:

    blender -b -P blender/hina_pizza.py              # build + save + render + export
    blender -b -P blender/hina_pizza.py -- --no-render
    blender -b -P blender/hina_pizza.py -- --res 1080  # quick preview renders
    blender -b -P blender/hina_pizza.py -- --anim      # 10 s turntable loop: frames, .blend, animated glb
    blender -b -P blender/hina_pizza.py -- --anim --frames 0,75,150,225 --res 540  # spot-check frames

Toppings (--toppings hishimochi|arare|chirashi|all, default hishimochi) sit on the same base:

    blender -b -P blender/hina_pizza.py -- --toppings arare               # one variant: outputs get an _arare suffix
    blender -b -P blender/hina_pizza.py -- --toppings chirashi --rice     # cheese tinted like sushi rice
    blender -b -P blender/hina_pizza.py -- --toppings all --res 1080      # renders/variants/: hero per variant + 3-up
    blender -b -P blender/hina_pizza.py -- --toppings all --anim          # hina_pizza_variants.glb + .blend (no frames)

With `all`, every set is built at once under its own group so three.js can switch them:
`toppings_<variant>` under `pizza_root` and `toppings_<variant>_pulled` under the pulled slice.
--no-export skips the glb.

Units: the pizza has radius 1.0 and lies on z = 0. A slice is modelled with its centre
line along +X and then rotated into place; toppings are parented to their slice.
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector, noise

# --- tunables ---------------------------------------------------------------
SLICES = 8
PULLED_SLICE = 1          # index; slice k is centred at k * 360/SLICES degrees from +X (1 = 1:30 in the top view)
PULL_OUT = 0.24           # how far the pulled slice slides outward
PULL_LIFT = 0.07          # ... and how far it is lifted
PULL_TILT_DEG = 8.0       # crust end tips up by this much
CHEESE_STRANDS = 4        # stretchy strands between the pulled slice and the pizza

STRAND_THICKNESS = 0.017  # radius at the thinnest point
STRAND_SAG = 0.06
CRUST_GROOVE = 0.1        # how deep the cuts crease the crust (0 = one unbroken ring)

SMALL_MOCHI = 7           # small hishimochi on the other slices (one large one sits on the pulled slice)
SALAMI = 4
BASIL = 4
PETALS = 5
SEED = 3

VARIANTS = ('hishimochi', 'arare', 'chirashi')
ARARE_R = 0.042           # radius of one hina-arare puff

COLORS = {
    'crust': '#e6c45a',
    'crust_dark': '#c9a13f',
    'dough': '#f3dc9c',
    'sauce': '#c8102e',
    'cheese': '#ffe596',
    'cheese_cut': '#e3b35f',
    'cheese_melt': '#ffd272',
    'mochi_pink': '#ff9fbf',
    'mochi_white': '#fff3d6',
    'mochi_green': '#a3d39c',
    'salami': '#ff7aa2',
    'basil': '#5e9e57',
    'petal': '#ffc2d4',
    'kv_bg': '#1a1014',
    'rice': '#fff6e2',
    'arare_pink': '#ffb0c8',
    'arare_white': '#fff8ec',
    'arare_green': '#bfe3b0',
    'arare_yellow': '#fff0a0',
    'egg': '#ffd447',
    'ikura': '#ff6a2c',
    'shrimp_body': '#ffe2d6',
    'shrimp_stripe': '#ff8c84',
    'shrimp_tail': '#ff6f6f',
    'pea': '#86cc74',
    'renkon': '#fff6e4',
    'denbu': '#ffb0c8',
    'nori': '#24352c',
    'carrot': '#ffa552',
}

# animation (--anim): the pizza turns once per loop while the pulled slice bobs
ANIM_FRAMES = 300         # 10 s at 30 fps; frame ANIM_FRAMES equals frame 0
ANIM_FPS = 30
ANIM_BOBS = 2             # up-and-down cycles of the pulled slice per loop
ANIM_REST = (0.18, 0.012, 2.0)   # pulled slice at the bottom of the bob: (out, lift, tilt in degrees)
ANIM_HIGH = (0.26, 0.16, 10.0)   # ... and at the top
ANIM_SAMPLES = 32
ANIM_CAM_DIST = 5.75      # hero camera pulled back so the lifted slice stays in frame all the way round

SHADOW_STRENGTH = 0.6     # opacity of the contact shadow under the pizza (0 = none)
SHADOW_Z = -0.004

ANIM = '--anim' in sys.argv
ANIM_TEST_FRAMES = ([int(f) for f in sys.argv[sys.argv.index('--frames') + 1].split(',')]
                    if '--frames' in sys.argv else None)
# --res 1080 for quick looks; the animation defaults to 1080
RES = int(sys.argv[sys.argv.index('--res') + 1]) if '--res' in sys.argv else (1080 if ANIM else 2160)
SAMPLES = 64
HERO_ELEVATION_DEG = 40.0  # camera looks this far down from the horizon
HERO_AZIMUTH_DEG = 8.0     # camera position around the pizza, from +X
RENDER = '--no-render' not in sys.argv
EXPORT = '--no-export' not in sys.argv
TOPPINGS = sys.argv[sys.argv.index('--toppings') + 1] if '--toppings' in sys.argv else 'hishimochi'
if TOPPINGS not in VARIANTS + ('all',):
    sys.exit(f'[hina_pizza] --toppings must be one of {", ".join(VARIANTS)} or all, not {TOPPINGS!r}')
ALL = TOPPINGS == 'all'
BUILD = VARIANTS if ALL else (TOPPINGS,)
RICE = '--rice' in sys.argv and TOPPINGS == 'chirashi'  # the cheese is shared, so not with `all`
# hishimochi keeps the original file names; other variants get a suffix
TAG = '' if TOPPINGS == 'hishimochi' else ('_variants' if ALL else f'_{TOPPINGS}')

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, '..', 'public', 'models')
OUT_BLEND = os.path.join(HERE, f'hina_pizza{TAG}.blend')
OUT_RENDERS = os.path.join(HERE, 'renders')
OUT_GLB = os.path.join(MODELS, f'hina_pizza{TAG}.glb')
OUT_ANIM = os.path.join(HERE, 'anim')
OUT_ANIM_BLEND = os.path.join(HERE, 'hina_pizza_variants.blend' if ALL else f'hina_pizza{TAG}_anim.blend')
OUT_ANIM_GLB = os.path.join(MODELS, 'hina_pizza_variants.glb' if ALL else f'hina_pizza{TAG}_anim.glb')
STILL_POSE = (PULL_OUT, PULL_LIFT, PULL_TILT_DEG)

CHEESE_R = 0.78   # cheese ends here, then the sauce rim
CRUST_R = 0.83    # crust starts here
CHEESE_Z = 0.055
random.seed(SEED)


# --- helpers ----------------------------------------------------------------
def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgba(key):
    h = COLORS[key].lstrip('#')
    return tuple(srgb_to_linear(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)


def set_input(bsdf, name, value):
    if name in bsdf.inputs:
        bsdf.inputs[name].default_value = value


def make_material(name, key, roughness=0.42, subsurface=0.0, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    col = rgba(key)
    set_input(bsdf, 'Base Color', col)
    set_input(bsdf, 'Roughness', roughness)
    set_input(bsdf, 'Subsurface Weight', subsurface)
    set_input(bsdf, 'Subsurface Radius', (0.08, 0.05, 0.04))
    set_input(bsdf, 'Subsurface Scale', 0.5)
    set_input(bsdf, 'Coat Weight', coat)
    set_input(bsdf, 'Coat Roughness', 0.25)
    mat.diffuse_color = col
    return mat


LINK_TO = [None]  # collection new objects go to (None = the scene's); one per topping set with `all`
VARIANT_COLLECTIONS = {}


def finish_mesh(mesh, materials, smooth_angle=40.0):
    for m in materials:
        mesh.materials.append(m)
    for p in mesh.polygons:
        p.use_smooth = True
    if hasattr(mesh, 'set_sharp_from_angle'):
        mesh.set_sharp_from_angle(angle=math.radians(smooth_angle))
    return mesh


def new_mesh(name, bm, materials, smooth_angle=40.0):
    mesh = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    return finish_mesh(mesh, materials, smooth_angle)


def link_object(name, data, parent=None):
    """An object for `data`; several objects can share one mesh (linked duplicates)."""
    obj = bpy.data.objects.new(name, data)
    (LINK_TO[0] or bpy.context.scene.collection).objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def new_object(name, bm, materials, parent=None, smooth_angle=40.0):
    return link_object(name, new_mesh(name, bm, materials, smooth_angle), parent)


# --- pizza slice ------------------------------------------------------------
def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def top_height(r, world_angle, edge):
    """Height of the pizza's top surface: melty cheese, a sauce dip, a puffy crust.

    `edge` is the arc distance to the nearest cut; the surface rolls down into a shallow
    groove there, so the cuts read as soft creases instead of gaps.
    """
    p = Vector((r * math.cos(world_angle), r * math.sin(world_angle), 0.0))
    bumps = 0.028 * noise.noise(p * 2.6 + Vector((0, 0, 1.7))) + 0.005 * noise.noise(p * 6.5 + Vector((0, 0, 4.2)))
    cheese = CHEESE_Z + bumps + 0.012 * smoothstep(0.5, 0.72, r)  # the cheese swells toward the rim
    roll = 1.0 - smoothstep(0.0, 0.018, edge)
    if r <= CHEESE_R:
        return cheese - 0.016 * roll
    if r <= CRUST_R:
        return cheese - 0.016 * math.sin(math.pi * (r - CHEESE_R) / (CRUST_R - CHEESE_R)) - 0.012 * roll
    t = (r - CRUST_R) / (1.0 - CRUST_R)
    puff = 1.0 + 0.14 * noise.noise(Vector((math.cos(world_angle) * 2.2, math.sin(world_angle) * 2.2, 5.0)))
    return 0.045 + 0.115 * puff * math.sin(math.pi * min(t, 1.0)) ** 0.55 * (1.0 - CRUST_GROOVE * roll)


def build_slice(k, mats):
    seg = 2 * math.pi / SLICES
    half = seg / 2  # no gap: neighbours meet flush, the cut is only a groove
    offs = [math.radians(d) for d in (0.0, 0.35, 0.8, 1.5)]  # extra columns to shape the groove
    inner = [-half + offs[-1] + (2 * half - 2 * offs[-1]) * i / 12 for i in range(1, 12)]
    angles = [-half + o for o in offs] + inner + [half - o for o in reversed(offs)]
    na = len(angles) - 1
    radii = [0.001 + (CHEESE_R - 0.001) * i / 18 for i in range(19)]
    radii += [CHEESE_R + (CRUST_R - CHEESE_R) * i / 3 for i in range(1, 4)]
    radii += [CRUST_R + (1.0 - CRUST_R) * i / 12 for i in range(1, 13)]
    nr = len(radii)
    bm = bmesh.new()
    top, bot = [], []
    for a in angles:
        wa = a + k * seg
        top.append([bm.verts.new((r * math.cos(a), r * math.sin(a), top_height(r, wa, r * (half - abs(a)))))
                    for r in radii])
        # the bottom tucks in under the crust so the rim reads as rounded
        bot.append([bm.verts.new((min(r, 0.965) * math.cos(a), min(r, 0.965) * math.sin(a), 0.0)) for r in radii])
    for i in range(na):
        at_cut = i == 0 or i == na - 1
        for j in range(nr - 1):
            f = bm.faces.new((top[i][j], top[i][j + 1], top[i + 1][j + 1], top[i + 1][j]))
            rm = (radii[j] + radii[j + 1]) / 2
            # a hairline of darker cheese marks each cut
            f.material_index = (5 if at_cut else 0) if rm < CHEESE_R else (1 if rm < CRUST_R else 2)
            g = bm.faces.new((bot[i][j], bot[i + 1][j], bot[i + 1][j + 1], bot[i][j + 1]))
            g.material_index = 4
    for i in range(na):  # tip and outer wall
        bm.faces.new((top[i][0], top[i + 1][0], bot[i + 1][0], bot[i][0])).material_index = 3
        bm.faces.new((top[i + 1][-1], top[i][-1], bot[i][-1], bot[i + 1][-1])).material_index = 4
    for j in range(nr - 1):  # the two cut faces
        bm.faces.new((top[0][j + 1], top[0][j], bot[0][j], bot[0][j + 1])).material_index = 3
        bm.faces.new((top[na][j], top[na][j + 1], bot[na][j + 1], bot[na][j])).material_index = 3
    obj = new_object(f'slice_{k}', bm, mats, smooth_angle=50.0)
    pulled = k == PULLED_SLICE
    ang = k * seg
    out = PULL_OUT if pulled else 0.0
    obj.location = (out * math.cos(ang), out * math.sin(ang), PULL_LIFT if pulled else 0.0)
    obj.rotation_euler = Euler((0.0, -math.radians(PULL_TILT_DEG) if pulled else 0.0, ang), 'XYZ')
    return obj


def slice_matrix(k, pose=None):
    """Transform of slice k; `pose` = (out, lift, tilt in degrees) for the pulled slice, None at home."""
    out, lift, tilt = pose if pose else (0.0, 0.0, 0.0)
    ang = k * 2 * math.pi / SLICES
    loc = Vector((out * math.cos(ang), out * math.sin(ang), lift))
    rot = Euler((0.0, -math.radians(tilt), ang), 'XYZ')
    return Matrix.Translation(loc) @ rot.to_matrix().to_4x4()


# --- toppings ---------------------------------------------------------------
def build_mochi(name, size, mats, parent):
    """Hishimochi: three stacked, softly bevelled diamond slabs (green, white, pink from the bottom)."""
    a, b, h = size, size * 0.62, size * 0.36
    bm = bmesh.new()
    done = set()
    for i in range(3):
        z0, z1 = i * h, (i + 1) * h
        s = 1.0 - 0.13 * i  # stepped, so all three colours show from straight above
        ring = [(a * s, 0), (0, b * s), (-a * s, 0), (0, -b * s)]
        lo = [bm.verts.new((x, y, z0)) for x, y in ring]
        hi = [bm.verts.new((x, y, z1)) for x, y in ring]
        bm.faces.new(reversed(lo))
        bm.faces.new(hi)
        for j in range(4):
            bm.faces.new((lo[j], lo[(j + 1) % 4], hi[(j + 1) % 4], hi[j]))
        edges = [e for e in bm.edges if not all(f in done for f in e.link_faces)]
        bmesh.ops.bevel(bm, geom=edges, offset=h * 0.42, segments=4, profile=0.5, affect='EDGES')
        for f in bm.faces:
            if f not in done:
                f.material_index = i
                done.add(f)
    return new_object(name, bm, mats, parent, smooth_angle=35.0)


def build_salami(name, radius, mats, parent):
    h = radius * 0.3
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=28, radius1=radius, radius2=radius, depth=h,
                          matrix=Matrix.Translation((0, 0, h / 2)))
    edges = [e for e in bm.edges if all(v.co.z > h * 0.5 for v in e.verts)]
    bmesh.ops.bevel(bm, geom=edges, offset=h * 0.45, segments=3, profile=0.5, affect='EDGES')
    return new_object(name, bm, mats, parent, smooth_angle=35.0)


def build_leaf(name, length, width, mats, parent, sharp=0.75, fold=0.35, bend=0.25):
    """A leaf / petal: a pointed grid, creased along the midrib and arched along its length."""
    nu, nv = 12, 4
    bm = bmesh.new()
    rows = []
    for i in range(nu + 1):
        u = i / nu
        w = width * math.sin(math.pi * u) ** sharp * (1.15 - 0.3 * u)
        row = []
        for j in range(nv + 1):
            v = j / nv * 2 - 1
            z = fold * abs(v) * w + bend * length * (0.25 - (u - 0.5) ** 2)
            row.append(bm.verts.new(((u - 0.5) * length, v * w, z)))
        rows.append(row)
    for i in range(nu):
        for j in range(nv):
            bm.faces.new((rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    obj = new_object(name, bm, mats, parent, smooth_angle=60.0)
    mod = obj.modifiers.new('thickness', 'SOLIDIFY')
    mod.thickness = 0.006
    mod.offset = 1.0
    return obj


def strand_rings(params, pose, stretch):
    """Ring vertices of every strand for one pose of the pulled slice. `stretch` 0..1 makes the
    strands thinner and saggier (None = the still pose, as authored)."""
    seg = 2 * math.pi / SLICES
    home = slice_matrix(PULLED_SLICE)
    away = slice_matrix(PULLED_SLICE, pose)
    out = []
    for side, r, r1, sag, thick in params:
        if stretch is not None:
            sag *= 0.45 + 0.8 * stretch
            thick *= 1.3 - 0.5 * stretch
        # from inside the neighbour's cut face diagonally out to inside the pulled slice's cut face,
        # so both ends are buried and the strand seems to pull out of the cheese layer
        a0 = side * (seg / 2 + math.radians(1.5))
        a1 = side * (seg / 2 - math.radians(1.5))
        p0 = home @ Vector((r * math.cos(a0), r * math.sin(a0), 0.034))
        p1 = away @ Vector((r1 * math.cos(a1), r1 * math.sin(a1), 0.034))
        rings = []
        n, sides = 20, 10
        for i in range(n + 1):
            t = i / n
            c = p0.lerp(p1, t)
            c.z = max(0.022, c.z - sag * 4 * t * (1 - t))  # hangs like a chain, but not through the board
            t2 = min(1.0, t + 1 / n)
            t0 = max(0.0, t - 1 / n)
            tan = p0.lerp(p1, t2) - p0.lerp(p1, t0)
            tan.z -= sag * 4 * ((t2 * (1 - t2)) - (t0 * (1 - t0)))
            tan.normalize()
            x = tan.cross(Vector((0, 0, 1))).normalized()
            y = tan.cross(x)
            rad = thick * (1.0 + 0.55 * (2 * t - 1) ** 2)  # a little thinner in the middle
            rings.append([c + rad * (math.cos(q) * x + math.sin(q) * y)
                          for q in (2 * math.pi * m / sides for m in range(sides))])
        out.append(rings)
    return out


def build_strands(mats, pose=STILL_POSE, pose_high=None):
    """Gooey cheese between the pulled slice and the pizza: thick drooping tubes, slightly
    thinner in the middle. With `pose_high` the mesh gets a 'lifted' shape key for that pose,
    so the strands can stretch with the slice (both ends stay put on their slices)."""
    params = []
    for s in range(CHEESE_STRANDS):
        side = 1 if s % 2 == 0 else -1
        r = 0.3 + 0.36 * s / max(1, CHEESE_STRANDS - 1) + random.uniform(-0.02, 0.02)
        r1 = r - 0.45 * PULL_OUT + random.uniform(-0.02, 0.02)
        params.append((side, r, r1, STRAND_SAG * random.uniform(0.8, 1.2), STRAND_THICKNESS * random.uniform(0.9, 1.15)))
    bm = bmesh.new()
    for rings in strand_rings(params, pose, 0.0 if pose_high else None):
        vr = [[bm.verts.new(co) for co in ring] for ring in rings]
        n, sides = len(vr) - 1, len(vr[0])
        for i in range(n):
            for m in range(sides):
                bm.faces.new((vr[i][m], vr[i][(m + 1) % sides], vr[i + 1][(m + 1) % sides], vr[i + 1][m]))
        bm.faces.new(reversed(vr[0]))
        bm.faces.new(vr[-1])
    obj = new_object('cheese_strands', bm, mats, smooth_angle=80.0)
    if pose_high:
        obj.shape_key_add(name='Basis')
        key = obj.shape_key_add(name='lifted')
        flat = [co for rings in strand_rings(params, pose_high, 1.0) for ring in rings for co in ring]
        for v, co in zip(key.data, flat):
            v.co = co
    return obj


def place(obj, x, y, z, yaw, tilt=0.0):
    obj.location = (x, y, z)
    obj.rotation_euler = Euler((tilt, 0.0, yaw), 'XYZ')


def surface_z(k, x, y):
    """Height of slice k's cheese at slice-local (x, y), so toppings sit on the bumps."""
    return top_height(math.hypot(x, y), k * 2 * math.pi / SLICES + math.atan2(y, x), 1.0)


def build_toppings_hishimochi(slices, M):  # `slices`: the parent for each slice's toppings
    mochi_mats = [M['mochi_green'], M['mochi_white'], M['mochi_pink']]
    others = [k for k in range(SLICES) if k != PULLED_SLICE]
    # three slots per slice (x = distance from the centre, y = across the slice)
    slot_a = [(k, 0.47, 0.0) for k in others]
    slot_b = [(k, 0.68, 0.14 if i % 2 == 0 else -0.14) for i, k in enumerate(others)]
    slot_c = [(k, 0.66, -0.15 if i % 2 == 0 else 0.15) for i, k in enumerate(others)]
    free = slot_a + slot_b[::2] + slot_b[1::2] + slot_c[::2] + slot_c[1::2]

    # the star: one large hishimochi on the pulled slice
    big = build_mochi('hishimochi_large', 0.23, mochi_mats, slices[PULLED_SLICE])
    place(big, 0.5, 0.0, surface_z(PULLED_SLICE, 0.5, 0.0) - 0.012, math.radians(90 + 12))
    leaf = build_leaf('basil_pulled', 0.2, 0.05, [M['basil']], slices[PULLED_SLICE])
    place(leaf, 0.73, 0.13, surface_z(PULLED_SLICE, 0.73, 0.13) + 0.004, math.radians(-50))

    for i in range(min(SMALL_MOCHI, len(free))):
        k, x, y = free.pop(0)
        m = build_mochi(f'hishimochi_{i}', 0.13, mochi_mats, slices[k])
        place(m, x, y, surface_z(k, x, y) - 0.008, math.radians(90) + random.uniform(-0.5, 0.5))
    for i in range(min(SALAMI, len(free))):
        k, x, y = free.pop(0)
        s = build_salami(f'salami_{i}', 0.085, [M['salami']], slices[k])
        place(s, x, y, surface_z(k, x, y) - 0.002, 0.0, random.uniform(-0.05, 0.05))
    for i in range(min(BASIL, len(free))):
        k, x, y = free.pop(0)
        b = build_leaf(f'basil_{i}', 0.2, 0.05, [M['basil']], slices[k])
        place(b, x, y, surface_z(k, x, y) + 0.004, random.uniform(0, math.tau))
    # peach petals resting on the cheese near the centre and on the crust
    for i in range(PETALS):
        k = others[(i * 3 + 1) % len(others)]
        on_crust = i % 2 == 1
        x = 0.92 if on_crust else random.uniform(0.2, 0.3)
        y = random.uniform(-0.05, 0.05)
        p = build_leaf(f'petal_{i}', 0.1, 0.034, [M['petal']], slices[k], sharp=0.5, fold=0.25, bend=0.35)
        place(p, x, y, (0.15 if on_crust else surface_z(k, x, y) + 0.006), random.uniform(0, math.tau),
              random.uniform(-0.15, 0.15))


# --- topping variants: shared helpers ----------------------------------------
def in_wedge(x, y, margin=0.0):
    """Is slice-local (x, y) on the cheese of one slice, `margin` away from its edges?"""
    return (x > 0.16 and math.hypot(x, y) < CHEESE_R - 0.03 - margin
            and abs(y) < x * math.tan(math.pi / SLICES) - 0.012 - margin)


def scatter_disc(rng, cx, cy, radius, min_dist, n, taken=(), margin=0.0, tries=500):
    """Up to n points in a disc, at least min_dist apart (and from `taken`), all on the slice."""
    out = []
    for _ in range(tries):
        if len(out) >= n:
            break
        a, d = rng.uniform(0, math.tau), radius * math.sqrt(rng.random())
        x, y = cx + d * math.cos(a), cy + d * math.sin(a)
        if in_wedge(x, y, margin) and all(math.hypot(x - px, y - py) >= min_dist for px, py in (*taken, *out)):
            out.append((x, y))
    return out


def ball_mesh(name, mat, rng, lump=0.3, squash=(1.0, 1.0, 1.0), subdivisions=2):
    """A unit ball, optionally lumpy and squashed. Low-poly on purpose: it is instanced many times."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1.0)
    off = Vector((rng.uniform(0, 50), rng.uniform(0, 50), rng.uniform(0, 50)))
    for v in bm.verts:
        n = v.co.normalized()
        v.co = Vector((n.x * squash[0], n.y * squash[1], n.z * squash[2])) * (1.0 + lump * noise.noise(n * 1.5 + off))
    return new_mesh(name, bm, [mat], smooth_angle=80.0)


def ribbon_mesh(name, mat, rng, length, width, thick, wave, bend, n=8):
    """A thin flat strip along X: gently wavy, bent sideways by `bend`."""
    bm = bmesh.new()
    ph, freq = rng.uniform(0, math.tau), rng.uniform(0.8, 1.6)
    rings = []
    for i in range(n + 1):
        t = i / n
        x = (t - 0.5) * length
        y = bend * length * (0.25 - (t - 0.5) ** 2)
        z = wave * (1.0 + math.sin(math.tau * freq * t + ph))
        rings.append([bm.verts.new((x, y + sy * width / 2, z + sz))
                      for sy, sz in ((-1, 0.0), (1, 0.0), (1, thick), (-1, thick))])
    for a, b in zip(rings, rings[1:]):
        for m in range(4):
            bm.faces.new((a[m], a[(m + 1) % 4], b[(m + 1) % 4], b[m]))
    bm.faces.new(reversed(rings[0]))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return new_mesh(name, bm, [mat], smooth_angle=40.0)


def extruded_mesh(name, loops, thick, mat):
    """A flat slab from 2D outlines; loops inside the first one become holes (a filled 2D curve)."""
    cu = bpy.data.curves.new(name + '_outline', 'CURVE')
    cu.dimensions = '2D'
    cu.fill_mode = 'BOTH'
    cu.extrude = thick / 2
    for pts in loops:
        sp = cu.splines.new('POLY')
        sp.points.add(len(pts) - 1)
        for p, (x, y) in zip(sp.points, pts):
            p.co = (x, y, 0.0, 1.0)
        sp.use_cyclic_u = True
    tmp = bpy.data.objects.new(name + '_outline', cu)
    bpy.context.scene.collection.objects.link(tmp)
    mesh = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    mesh.name = name
    for v in mesh.vertices:
        v.co.z += thick / 2
    return finish_mesh(mesh, [mat], smooth_angle=30.0)


def circle(cx, cy, r, n, start=0.0):
    return [(cx + r * math.cos(start + math.tau * i / n), cy + r * math.sin(start + math.tau * i / n)) for i in range(n)]


# --- hina-arare ---------------------------------------------------------------
def build_toppings_arare(parents, M):
    """Hina-arare: pastel sugar-coated rice puffs in little heaps, a big heap on the pulled slice."""
    rng = random.Random(SEED + 11)
    colours = ('arare_pink', 'arare_white', 'arare_green', 'arare_yellow')
    weights = (0.36, 0.24, 0.27, 0.13)
    # three lumpy shapes per colour, shared by every puff
    meshes = {c: [ball_mesh(f'{c}_{i}', M[c], rng, lump=0.32,
                            squash=(1.0, rng.uniform(0.82, 0.96), rng.uniform(0.76, 0.9))) for i in range(3)]
              for c in colours}
    count = [0]

    def puff(k, x, y, layer=0):
        r = ARARE_R * rng.uniform(0.86, 1.12)
        obj = link_object(f'arare_{count[0]}', rng.choice(meshes[rng.choices(colours, weights)[0]]), parents[k])
        count[0] += 1
        obj.location = (x, y, surface_z(k, x, y) + r * 0.78 + layer * ARARE_R * 1.42)
        obj.rotation_euler = Euler([rng.uniform(0, math.tau) for _ in range(3)], 'XYZ')
        obj.scale = (r, r, r)

    def heap(k, cx, cy, radius, layers, taken):
        gap = ARARE_R * 1.66
        for layer in range(layers):
            ring = radius * (1.0 - 0.38 * layer)
            pts = scatter_disc(rng, cx, cy, ring, gap, 99, taken if layer == 0 else (), ARARE_R * 0.8, tries=3000)
            for x, y in pts:
                puff(k, x, y, layer)
            if layer == 0:
                taken.extend(pts)

    i = 0
    for k in range(SLICES):
        taken = []
        if k == PULLED_SLICE:
            heap(k, 0.5, 0.0, 0.185, 3, taken)
            singles = 4
        else:
            side = 1 if i % 2 == 0 else -1
            heap(k, 0.6 if i % 2 == 0 else 0.5, 0.06 * side, 0.125, 2, taken)
            singles = 6
            i += 1
        # a few loose ones, kept clear of the heap
        for x, y in scatter_disc(rng, 0.47, 0.0, 0.32, ARARE_R * 2.8, singles, taken, ARARE_R):
            puff(k, x, y)


# --- chirashi-zushi -----------------------------------------------------------
def shrimp_mesh(name, mats):
    """A curled boiled shrimp lying flat: a tapering striped tube round a unit circle, plus a tail fan.
    Materials: body, stripe, tail."""
    bm = bmesh.new()
    n, sides, arc = 21, 10, math.radians(255)
    up = Vector((0, 0, 1))
    rings = []
    for i in range(n + 1):
        t = i / n
        out = Vector((math.cos(t * arc), math.sin(t * arc), 0.0))
        rad = (0.42 - 0.26 * t) * (1.0 + 0.06 * math.cos(math.tau * i / 3))  # segments bulge a little
        if t < 0.15:  # rounded head end
            rad *= max(0.05, math.sqrt(1.0 - (1.0 - t / 0.15) ** 2))
        c = out + up * rad * 0.92
        rings.append([bm.verts.new(c + rad * (math.cos(q) * out + math.sin(q) * up))
                      for q in (math.tau * m / sides for m in range(sides))])
    for i in range(n):
        for m in range(sides):
            f = bm.faces.new((rings[i][m], rings[i][(m + 1) % sides], rings[i + 1][(m + 1) % sides], rings[i + 1][m]))
            f.material_index = 1 if i % 3 == 0 else 0
    bm.faces.new(rings[0]).material_index = 1
    bm.faces.new(rings[-1]).material_index = 0
    end = Vector((math.cos(arc), math.sin(arc), 0.0))
    heading = arc + math.pi / 2
    for s in (-1, 1):
        ang = heading + s * math.radians(27)
        pos = end + 0.36 * Vector((math.cos(ang), math.sin(ang), 0.0)) + up * 0.075
        mat = Matrix.Translation(pos) @ Matrix.Rotation(ang, 4, 'Z') @ Matrix.Diagonal((0.42, 0.17, 0.065, 1.0))
        fin = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0, matrix=mat)
        for f in {f for v in fin['verts'] for f in v.link_faces}:
            f.material_index = 2
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return new_mesh(name, bm, mats, smooth_angle=60.0)


def pea_mesh(name, mat, length=1.0, width=0.32, thick=0.1):
    """A snow pea cut on the diagonal: a flat pod with three pea bumps, unit length along X."""
    nu, nv = 10, 4
    bm = bmesh.new()
    top, bot = [], []
    for i in range(nu + 1):
        u = i / nu
        w = width / 2 * (0.8 + 0.2 * math.sin(math.pi * u))
        rt, rb = [], []
        for j in range(nv + 1):
            v = j / nv * 2 - 1
            x, y = (u - 0.5) * length + 0.9 * v * w, v * w  # sheared: both ends are diagonal cuts
            peas = 0.5 + 0.5 * math.cos(math.tau * 3 * (u - 0.5))
            z = thick * (0.35 + 0.65 * math.sqrt(1.0 - v * v) * (0.55 + 0.45 * peas))
            rt.append(bm.verts.new((x, y, z)))
            rb.append(bm.verts.new((x, y, 0.0)))
        top.append(rt)
        bot.append(rb)
    for i in range(nu):
        for j in range(nv):
            bm.faces.new((top[i][j], top[i + 1][j], top[i + 1][j + 1], top[i][j + 1]))
            bm.faces.new((bot[i][j], bot[i][j + 1], bot[i + 1][j + 1], bot[i + 1][j]))
        for j in (0, nv):
            bm.faces.new((top[i][j], top[i + 1][j], bot[i + 1][j], bot[i][j]))
    for j in range(nv):
        for i in (0, nu):
            bm.faces.new((top[i][j], top[i][j + 1], bot[i][j + 1], bot[i][j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return new_mesh(name, bm, [mat], smooth_angle=50.0)


def renkon_mesh(name, mat):
    """A lotus-root slice of unit radius: scalloped rim, a ring of seven holes and a small centre one."""
    lobes = 7
    outer = [((0.93 + 0.07 * math.cos(lobes * a)) * math.cos(a), (0.93 + 0.07 * math.cos(lobes * a)) * math.sin(a))
             for a in (math.tau * i / 42 for i in range(42))]
    holes = [circle(0.56 * math.cos(math.tau * j / lobes), 0.56 * math.sin(math.tau * j / lobes), 0.175, 10)
             for j in range(lobes)]
    return extruded_mesh(name, [outer, circle(0.0, 0.0, 0.12, 8)] + holes, 0.2, mat)


def carrot_mesh(name, mat):
    """A flower-cut carrot slice of unit radius: five round petals."""
    outline = []
    for i in range(40):
        a = math.tau * i / 40
        r = 0.66 + 0.34 * abs(math.cos(2.5 * a)) ** 0.7
        outline.append((r * math.cos(a), r * math.sin(a)))
    return extruded_mesh(name, [outline], 0.3, mat)


def denbu_mesh(name, mat, rng):
    """A fluffy patch of sakura-denbu about one unit across: a clump of tiny crumbs in one mesh."""
    bm = bmesh.new()
    for i in range(15):
        on_top = i >= 11
        a, d = rng.uniform(0, math.tau), math.sqrt(rng.random()) * (0.35 if on_top else 0.85)
        r = rng.uniform(0.24, 0.38)
        rot = Euler([rng.uniform(0, math.tau) for _ in range(3)], 'XYZ').to_matrix().to_4x4()
        mat4 = (Matrix.Translation((d * math.cos(a), d * math.sin(a), r * 0.55 + (0.3 if on_top else 0.0))) @ rot
                @ Matrix.Diagonal((r, r * rng.uniform(0.6, 0.9), r * rng.uniform(0.5, 0.8), 1.0)))
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0, matrix=mat4)
    return new_mesh(name, bm, [mat], smooth_angle=80.0)


def build_toppings_chirashi(parents, M):
    """Chirashi-zushi: a bed of kinshi-tamago with shrimp, ikura, snow peas, renkon, sakura-denbu,
    nori and flower carrots. The pulled slice gets the big shrimp and most of the ikura."""
    rng = random.Random(SEED + 23)
    egg = [ribbon_mesh(f'kinshi_tamago_mesh_{i}', M['egg'], rng, 0.2, 0.019, 0.006, 0.004, rng.uniform(-0.7, 0.7))
           for i in range(4)]
    nori = [ribbon_mesh(f'nori_mesh_{i}', M['nori'], rng, 0.08, 0.012, 0.004, 0.002, rng.uniform(-0.3, 0.3), n=5)
            for i in range(2)]
    ikura = ball_mesh('ikura_mesh', M['ikura'], rng, lump=0.0)
    shrimp = shrimp_mesh('shrimp_mesh', [M['shrimp_body'], M['shrimp_stripe'], M['shrimp_tail']])
    pea = pea_mesh('snow_pea_mesh', M['pea'])
    renkon = renkon_mesh('renkon_mesh', M['renkon'])
    carrot = carrot_mesh('carrot_mesh', M['carrot'])
    denbu = [denbu_mesh(f'denbu_mesh_{i}', M['denbu'], rng) for i in range(3)]
    count = {}

    def put(kind, mesh, k, x, y, lift, yaw=0.0, scale=1.0, tilt=0.0):
        count[kind] = count.get(kind, 0) + 1
        obj = link_object(f'{kind}_{count[kind] - 1}', mesh, parents[k])
        obj.location = (x, y, surface_z(k, x, y) + lift)
        obj.rotation_euler = Euler((tilt, 0.0, yaw), 'XYZ')
        obj.scale = (scale, scale, scale)

    def strips(kind, meshes, k, n, length, lifts, centre=(0.47, 0.0), spread=0.3):
        placed = 0
        for _ in range(400):
            if placed >= n:
                break
            x, y = centre[0] + rng.uniform(-spread, spread), centre[1] + rng.uniform(-spread, spread)
            yaw = rng.uniform(0, math.pi)
            dx, dy = math.cos(yaw) * length / 2, math.sin(yaw) * length / 2
            if all(in_wedge(px, py) for px, py in ((x, y), (x + dx, y + dy), (x - dx, y - dy))):
                put(kind, rng.choice(meshes), k, x, y, rng.uniform(*lifts), yaw, 1.0, rng.uniform(-0.08, 0.08))
                placed += 1

    def roe(k, cx, cy, radius, n, lift=0.012):
        r = 0.025
        pts = scatter_disc(rng, cx, cy, radius, r * 1.9, n, (), r)
        tops = scatter_disc(rng, cx, cy, radius * 0.4, r * 1.9, len(pts) // 4, (), r)
        for layer, group in enumerate((pts, tops)):
            for x, y in group:
                s = r * rng.uniform(0.9, 1.1)
                put('ikura', ikura, k, x, y, lift + s * 0.85 + layer * r * 1.45, rng.uniform(0, math.tau), s)

    def peas(k, x, y, yaw):
        put('snow_pea', pea, k, x, y, 0.012, yaw, 0.15)
        put('snow_pea', pea, k, x + 0.012, y + 0.01, 0.024, yaw + 1.15, 0.15, 0.05)

    i = 0
    for k in range(SLICES):
        strips('kinshi_tamago', egg, k, 15, 0.2, (0.002, 0.018))
        put('denbu', rng.choice(denbu), k, 0.29, 0.0, 0.008, rng.uniform(0, math.tau), 0.07)
        if k == PULLED_SLICE:
            put('shrimp', shrimp, k, 0.48, 0.0, 0.012, math.radians(205), 0.105)
            roe(k, 0.48, 0.0, 0.035, 3)            # tucked into the curl
            roe(k, 0.69, 0.125, 0.06, 9)
            roe(k, 0.69, -0.125, 0.06, 9)
            strips('nori', nori, k, 3, 0.08, (0.024, 0.03), (0.62, 0.0), 0.13)
            continue
        side = 1 if i % 2 == 0 else -1
        if i % 2 == 0:
            put('shrimp', shrimp, k, 0.47, 0.0, 0.012, rng.uniform(0, math.tau), 0.072)
            peas(k, 0.665, -0.15 * side, math.pi / 2 + rng.uniform(-0.35, 0.35))
        else:
            put('renkon', renkon, k, 0.47, 0.0, 0.014, rng.uniform(0, math.tau), 0.088, rng.uniform(-0.06, 0.06))
            put('carrot', carrot, k, 0.665, -0.15 * side, 0.014, rng.uniform(0, math.tau), 0.052)
        roe(k, 0.67, 0.15 * side, 0.055, 7)
        strips('nori', nori, k, 3, 0.08, (0.024, 0.03), (0.6, 0.0), 0.13)
        i += 1


# --- variants -----------------------------------------------------------------
BUILDERS = {'hishimochi': build_toppings_hishimochi, 'arare': build_toppings_arare, 'chirashi': build_toppings_chirashi}


def build_variant(variant, slices, M, grouped):
    """Build one topping set. Returns (its objects, its top-level groups).

    Plain: toppings are children of their slice. Grouped (`--toppings all`): they hang off empties
    so a viewer can switch sets: `toppings_<variant>` (to be parented to the turning root; one
    child empty per slice) and `toppings_<variant>_pulled` under the pulled slice, so that part bobs."""
    before = {o.name for o in bpy.data.objects}
    parents, groups = list(slices), []
    if grouped:
        coll = bpy.data.collections.new(f'toppings_{variant}')
        bpy.context.scene.collection.children.link(coll)
        VARIANT_COLLECTIONS[variant] = coll
        LINK_TO[0] = coll
        group = link_object(f'toppings_{variant}', None)
        groups.append(group)
        for k in range(SLICES):
            if k == PULLED_SLICE:
                parents[k] = link_object(f'toppings_{variant}_pulled', None, slices[k])
            else:
                parents[k] = link_object(f'toppings_{variant}_s{k}', None, group)
                parents[k].rotation_euler = slices[k].rotation_euler
    BUILDERS[variant](parents, M)
    LINK_TO[0] = None
    return [o for o in bpy.data.objects if o.name not in before], groups


def build_toppings(slices, M):
    """Every requested topping set: ({variant: objects}, top-level groups)."""
    if 'hishimochi' not in BUILD:
        # the cheese strands draw from the same random stream after the hishimochi set: build that
        # set and drop it, so the base comes out identical whichever toppings are on it
        for obj in build_variant('hishimochi', slices, M, False)[0]:
            mesh = obj.data
            bpy.data.objects.remove(obj)
            if mesh.users == 0:
                bpy.data.meshes.remove(mesh)
    sets, groups = {}, []
    for variant in BUILD:
        sets[variant], g = build_variant(variant, slices, M, ALL)
        groups += g
    return sets, groups


def show_variant(variant):
    """With `all`: show one topping set and hide the others (render and viewport)."""
    for name, coll in VARIANT_COLLECTIONS.items():
        coll.hide_render = coll.hide_viewport = name != variant


def report_triangles(sets):
    dg = bpy.context.evaluated_depsgraph_get()
    for label, objs in sets.items():
        tris = 0
        for obj in objs:
            if obj.type != 'MESH':
                continue
            ev = obj.evaluated_get(dg)
            mesh = ev.to_mesh()
            mesh.calc_loop_triangles()
            tris += len(mesh.loop_triangles)
            ev.to_mesh_clear()
        print(f'[hina_pizza] triangles {label}: {tris} ({sum(o.type == "MESH" for o in objs)} objects)')


def side_by_side(paths, out):
    """Join renders of equal height into one strip."""
    import numpy as np
    tiles = []
    for path in paths:
        img = bpy.data.images.load(path)
        w, h = img.size
        px = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        tiles.append(px.reshape(h, w, 4))
        bpy.data.images.remove(img)
    strip = np.concatenate(tiles, axis=1)
    h, w, _ = strip.shape
    img = bpy.data.images.new('side_by_side', w, h, alpha=True)
    img.pixels.foreach_set(strip.ravel())
    img.filepath_raw = out
    img.file_format = 'PNG'
    img.save()
    print(f'[hina_pizza] saved {out}')


# --- scene, light, cameras ---------------------------------------------------
def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def add_area(name, loc, energy, size, color, rig):
    light = bpy.data.lights.new(name, 'AREA')
    light.energy = energy
    light.size = size
    light.color = color
    obj = bpy.data.objects.new(name, light)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    look_at(obj, (0, 0, 0))
    obj.parent = rig
    return obj


def build_contact_shadow():
    """Soft shadow under the pizza that survives a transparent film: a ground plane whose
    material is black with a feathered alpha (EEVEE has no shadow catcher). One blob for the
    pizza, one for the pulled slice."""
    seg = 2 * math.pi / SLICES
    ang = PULLED_SLICE * seg
    d = 0.62 + PULL_OUT
    blobs = [((0.0, 0.0), 0.93, 1.2), ((d * math.cos(ang), d * math.sin(ang)), 0.3, 0.62)]
    mat = bpy.data.materials.new('contact_shadow')
    mat.use_nodes = True
    if hasattr(mat, 'surface_render_method'):
        mat.surface_render_method = 'BLENDED'
    else:
        mat.blend_method = 'BLEND'
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    set_input(bsdf, 'Base Color', (0.0, 0.0, 0.0, 1.0))
    set_input(bsdf, 'Roughness', 1.0)
    set_input(bsdf, 'Specular IOR Level', 0.0)
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    acc = None
    for (cx, cy), r_in, r_out in blobs:
        dist = nt.nodes.new('ShaderNodeVectorMath')
        dist.operation = 'DISTANCE'
        dist.inputs[1].default_value = (cx, cy, SHADOW_Z)
        nt.links.new(geo.outputs['Position'], dist.inputs[0])
        ramp = nt.nodes.new('ShaderNodeMapRange')
        ramp.interpolation_type = 'SMOOTHSTEP'
        ramp.inputs['From Min'].default_value = r_in
        ramp.inputs['From Max'].default_value = r_out
        ramp.inputs['To Min'].default_value = 1.0
        ramp.inputs['To Max'].default_value = 0.0
        nt.links.new(dist.outputs['Value'], ramp.inputs['Value'])
        if acc is None:
            acc = ramp.outputs['Result']
        else:
            mx = nt.nodes.new('ShaderNodeMath')
            mx.operation = 'MAXIMUM'
            nt.links.new(acc, mx.inputs[0])
            nt.links.new(ramp.outputs['Result'], mx.inputs[1])
            acc = mx.outputs['Value']
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = SHADOW_STRENGTH
    nt.links.new(acc, mul.inputs[0])
    nt.links.new(mul.outputs['Value'], bsdf.inputs['Alpha'])
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=2.2, matrix=Matrix.Translation((0, 0, SHADOW_Z)))
    return new_object('contact_shadow', bm, [mat])


def build_anim_shadows(root):
    """Contact shadows for the animation: a fixed blob under the pizza and one that travels with
    the pulled slice. Each plane's object colour drives its material: red = where the feathering
    starts (fraction of the plane's radius), alpha = strength, so both can be keyframed."""
    mat = bpy.data.materials.new('contact_shadow_anim')
    mat.use_nodes = True
    if hasattr(mat, 'surface_render_method'):
        mat.surface_render_method = 'BLENDED'
    else:
        mat.blend_method = 'BLEND'
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    set_input(bsdf, 'Base Color', (0.0, 0.0, 0.0, 1.0))
    set_input(bsdf, 'Roughness', 1.0)
    set_input(bsdf, 'Specular IOR Level', 0.0)
    coord = nt.nodes.new('ShaderNodeTexCoord')
    dist = nt.nodes.new('ShaderNodeVectorMath')
    dist.operation = 'LENGTH'
    nt.links.new(coord.outputs['Object'], dist.inputs[0])
    info = nt.nodes.new('ShaderNodeObjectInfo')
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(info.outputs['Color'], sep.inputs['Color'])
    ramp = nt.nodes.new('ShaderNodeMapRange')
    ramp.interpolation_type = 'SMOOTHSTEP'
    nt.links.new(dist.outputs['Value'], ramp.inputs['Value'])
    nt.links.new(sep.outputs['Red'], ramp.inputs['From Min'])
    ramp.inputs['From Max'].default_value = 1.0
    ramp.inputs['To Min'].default_value = 1.0
    ramp.inputs['To Max'].default_value = 0.0
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    nt.links.new(ramp.outputs['Result'], mul.inputs[0])
    nt.links.new(info.outputs['Alpha'], mul.inputs[1])
    nt.links.new(mul.outputs['Value'], bsdf.inputs['Alpha'])

    def plane(name, z):
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.0)  # spans -1..1, feather ends at 1
        obj = new_object(name, bm, [mat])
        obj.location.z = z
        return obj

    main_shadow = plane('contact_shadow', SHADOW_Z)
    main_shadow.scale = (1.2, 1.2, 1.0)
    main_shadow.color = (0.93 / 1.2, 1.0, 1.0, SHADOW_STRENGTH)
    slice_shadow = plane('contact_shadow_slice', SHADOW_Z * 0.5)
    slice_shadow.parent = root
    ang = PULLED_SLICE * 2 * math.pi / SLICES
    d = 0.62 + (ANIM_REST[0] + ANIM_HIGH[0]) / 2
    slice_shadow.location = (d * math.cos(ang), d * math.sin(ang), SHADOW_Z * 0.5)
    return slice_shadow


def bob_keys():
    """(frame, u) at the bottom (u = 0) and top (u = 1) of every bob; Bezier keys with flat
    auto-clamped handles in between give the sine-like ease."""
    step = ANIM_FRAMES // (ANIM_BOBS * 2)
    return [(i * step, float(i % 2)) for i in range(ANIM_BOBS * 2 + 1)]


def animate(scene, slices, strands, slice_shadow, root):
    edit = bpy.context.preferences.edit
    scene.render.fps = ANIM_FPS
    scene.frame_start = 0
    scene.frame_end = ANIM_FRAMES
    # turntable: one linear turn per loop
    edit.keyframe_new_interpolation_type = 'LINEAR'
    for frame, turn in ((0, 0.0), (ANIM_FRAMES, 2 * math.pi)):
        root.rotation_euler = (0.0, 0.0, turn)
        root.keyframe_insert('rotation_euler', frame=frame)
    edit.keyframe_new_interpolation_type = 'BEZIER'
    edit.keyframe_new_handle_type = 'AUTO_CLAMPED'
    # the slice, its strands and its shadow all follow the same eased 0..1 curve
    pulled = slices[PULLED_SLICE]
    key = strands.data.shape_keys.key_blocks['lifted'] if strands else None
    ang = PULLED_SLICE * 2 * math.pi / SLICES
    for frame, u in bob_keys():
        out, lift, tilt = (a + (b - a) * u for a, b in zip(ANIM_REST, ANIM_HIGH))
        pulled.location = (out * math.cos(ang), out * math.sin(ang), lift)
        pulled.rotation_euler = Euler((0.0, -math.radians(tilt), ang), 'XYZ')
        pulled.keyframe_insert('location', frame=frame)
        pulled.keyframe_insert('rotation_euler', frame=frame)
        if key:
            key.value = u
            key.keyframe_insert('value', frame=frame)
        if slice_shadow:
            # higher slice: smaller, softer, fainter shadow
            sc = 0.6 - 0.12 * u
            slice_shadow.scale = (sc, sc, 1.0)
            slice_shadow.color = (0.5 - 0.35 * u, 1.0, 1.0, SHADOW_STRENGTH * (1.0 - 0.55 * u))
            slice_shadow.keyframe_insert('scale', frame=frame)
            slice_shadow.keyframe_insert('color', frame=frame)
    scene.frame_set(0)


def run_anim(scene, slices, strands, root):
    """Animated glb, .blend and the frame sequence (or just a few test frames).
    With `--toppings all` the glb and .blend hold every set; there is no frame sequence."""
    animate(scene, slices, strands, None, root)
    if not ANIM_TEST_FRAMES and EXPORT:
        kwargs = dict(filepath=os.path.abspath(OUT_ANIM_GLB), export_format='GLB', export_apply=True,
                      export_cameras=False, export_lights=False, export_yup=True, export_animations=True,
                      export_morph=True, export_frame_range=True)
        try:  # one clip for the whole scene, so three.js gets a single AnimationClip
            bpy.ops.export_scene.gltf(export_animation_mode='SCENE', **kwargs)
        except TypeError:
            bpy.ops.export_scene.gltf(**kwargs)
        print(f'[hina_pizza] exported {os.path.abspath(OUT_ANIM_GLB)} ({os.path.getsize(OUT_ANIM_GLB) / 1024:.0f} kB)')
    slice_shadow = build_anim_shadows(root)
    animate(scene, slices, None, slice_shadow, root)  # re-key so the new shadow is on the same curve
    scene.frame_end = ANIM_FRAMES - 1  # the last frame would repeat frame 0
    scene.eevee.taa_render_samples = ANIM_SAMPLES
    scene.render.film_transparent = True
    if ANIM_TEST_FRAMES:
        os.makedirs(os.path.join(OUT_ANIM, 'test'), exist_ok=True)
        for variant in BUILD:
            show_variant(variant)
            for f in ANIM_TEST_FRAMES:
                scene.frame_set(f)
                scene.render.filepath = os.path.join(OUT_ANIM, 'test', f'f{f:04d}{f"_{variant}" if ALL else TAG}.png')
                bpy.ops.render.render(write_still=True)
                print(f'[hina_pizza] rendered {scene.render.filepath}')
        return
    show_variant(VARIANTS[0])
    scene.render.filepath = f'//anim/frames{TAG}/hina_pizza{TAG}_'
    bpy.ops.wm.save_as_mainfile(filepath=OUT_ANIM_BLEND)
    print(f'[hina_pizza] saved {OUT_ANIM_BLEND}')
    if ALL:
        return
    os.makedirs(os.path.join(OUT_ANIM, f'frames{TAG}'), exist_ok=True)
    bpy.ops.render.render(animation=True)
    print(f'[hina_pizza] rendered {ANIM_FRAMES} frames to {os.path.join(OUT_ANIM, f"frames{TAG}")}')


def setup_world(scene):
    """Soft ambient light; the camera sees `kv_bg` when the film is not transparent."""
    world = bpy.data.worlds.new('world')
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    mix = nt.nodes.new('ShaderNodeMixShader')
    path = nt.nodes.new('ShaderNodeLightPath')
    ambient = nt.nodes.new('ShaderNodeBackground')
    ambient.inputs['Color'].default_value = (1.0, 0.93, 0.95, 1.0)
    ambient.inputs['Strength'].default_value = 0.5
    backdrop = nt.nodes.new('ShaderNodeBackground')
    backdrop.inputs['Color'].default_value = rgba('kv_bg')
    nt.links.new(path.outputs['Is Camera Ray'], mix.inputs['Fac'])
    nt.links.new(ambient.outputs['Background'], mix.inputs[1])
    nt.links.new(backdrop.outputs['Background'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])


def setup_render(scene):
    for engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    for attr, value in (('taa_render_samples', SAMPLES), ('use_raytracing', True), ('use_shadows', True)):
        if hasattr(scene.eevee, attr):
            setattr(scene.eevee, attr, value)
    scene.render.resolution_x = RES
    scene.render.resolution_y = RES
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Standard'  # keep the palette's colours as authored
    scene.view_settings.look = 'None'


def render(scene, camera, rig, rig_yaw_deg, name, transparent=True):
    scene.camera = camera
    rig.rotation_euler = (0.0, 0.0, math.radians(rig_yaw_deg))
    scene.render.film_transparent = transparent
    scene.render.filepath = os.path.join(OUT_RENDERS, name)
    bpy.ops.render.render(write_still=True)
    print(f'[hina_pizza] rendered {scene.render.filepath}')


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    if RICE:
        COLORS['cheese'] = COLORS['rice']
    M = {
        'cheese': make_material('cheese', 'cheese', 0.3, subsurface=0.2, coat=0.35),
        'cheese_cut': make_material('cheese_cut', 'cheese_cut', 0.45, subsurface=0.1),
        'cheese_melt': make_material('cheese_melt', 'cheese_melt', 0.25, subsurface=0.25, coat=0.4),
        'sauce': make_material('sauce', 'sauce', 0.3, coat=0.3),
        'crust': make_material('crust', 'crust', 0.55, subsurface=0.08),
        'crust_dark': make_material('crust_dark', 'crust_dark', 0.6),
        'dough': make_material('dough', 'dough', 0.6, subsurface=0.1),
        'mochi_green': make_material('mochi_green', 'mochi_green', 0.4, subsurface=0.3, coat=0.2),
        'mochi_white': make_material('mochi_white', 'mochi_white', 0.4, subsurface=0.3, coat=0.2),
        'mochi_pink': make_material('mochi_pink', 'mochi_pink', 0.4, subsurface=0.3, coat=0.2),
        'salami': make_material('salami', 'salami', 0.4, subsurface=0.1, coat=0.2),
        'basil': make_material('basil', 'basil', 0.45),
        'petal': make_material('petal', 'petal', 0.5, subsurface=0.2),
    }
    for key in ('arare_pink', 'arare_white', 'arare_green', 'arare_yellow'):
        M[key] = make_material(key, key, 0.36, subsurface=0.25, coat=0.35)  # the coat is the sugar glaze
    M.update({
        'egg': make_material('egg', 'egg', 0.5, subsurface=0.15),
        'ikura': make_material('ikura', 'ikura', 0.12, subsurface=0.5, coat=0.9),
        'shrimp_body': make_material('shrimp_body', 'shrimp_body', 0.35, subsurface=0.3, coat=0.3),
        'shrimp_stripe': make_material('shrimp_stripe', 'shrimp_stripe', 0.35, subsurface=0.3, coat=0.3),
        'shrimp_tail': make_material('shrimp_tail', 'shrimp_tail', 0.35, subsurface=0.2, coat=0.3),
        'pea': make_material('pea', 'pea', 0.4, subsurface=0.1, coat=0.2),
        'renkon': make_material('renkon', 'renkon', 0.5, subsurface=0.2),
        'denbu': make_material('denbu', 'denbu', 0.85, subsurface=0.3),
        'nori': make_material('nori', 'nori', 0.55),
        'carrot': make_material('carrot', 'carrot', 0.45, subsurface=0.15),
    })
    slice_mats = [M['cheese'], M['sauce'], M['crust'], M['dough'], M['crust_dark'], M['cheese_cut']]
    slices = [build_slice(k, slice_mats) for k in range(SLICES)]
    topping_sets, topping_groups = build_toppings(slices, M)
    strands = None
    if CHEESE_STRANDS > 0:
        strands = build_strands([M['cheese_melt']], *((ANIM_REST, ANIM_HIGH) if ANIM else (STILL_POSE,)))
    report_triangles({'base': slices + ([strands] if strands else []),
                      **{f'toppings_{v}': objs for v, objs in topping_sets.items()}})

    # studio rig, laid out for the hero camera: key from its upper left, fill from the right, rim behind
    rig = bpy.data.objects.new('light_rig', None)
    scene.collection.objects.link(rig)
    add_area('key', (2.0, -3.4, 4.2), 235.0, 4.5, (1.0, 0.96, 0.92), rig)
    add_area('fill', (3.2, 3.2, 2.4), 55.0, 5.0, (1.0, 0.9, 0.95), rig)
    add_area('rim', (-4.0, 1.0, 2.6), 90.0, 3.0, (1.0, 0.85, 0.9), rig)

    centre = Vector((0.06, 0.06, 0.05))
    hero_data = bpy.data.cameras.new('cam_hero')
    hero_data.lens = 70
    hero = bpy.data.objects.new('cam_hero', hero_data)
    scene.collection.objects.link(hero)
    el, az, dist = math.radians(HERO_ELEVATION_DEG), math.radians(HERO_AZIMUTH_DEG), (ANIM_CAM_DIST if ANIM else 5.0)
    hero.location = centre + dist * Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
    look_at(hero, centre)

    top_data = bpy.data.cameras.new('cam_top')
    top_data.type = 'ORTHO'
    top_data.ortho_scale = 2.62
    top = bpy.data.objects.new('cam_top', top_data)
    scene.collection.objects.link(top)
    top.location = (centre.x, centre.y, 6.0)  # +Y is up in the frame

    setup_world(scene)
    setup_render(scene)
    scene.camera = hero

    if ANIM:
        # everything that turns hangs off one empty; camera and lights stay put
        root = bpy.data.objects.new('pizza_root', None)
        scene.collection.objects.link(root)
        for obj in slices + ([strands] if strands else []) + topping_groups:
            obj.parent = root
        run_anim(scene, slices, strands, root)
        return

    os.makedirs(os.path.join(OUT_RENDERS, 'variants'), exist_ok=True)
    if ALL:
        # stills only: the hero view of every variant on the KV background, and a 3-up
        # (the switchable glb and .blend come from --toppings all --anim)
        build_contact_shadow()
        if RENDER:
            paths = []
            for variant in BUILD:
                show_variant(variant)
                render(scene, hero, rig, 0.0, f'variants/hina_pizza_{variant}.png', transparent=False)
                paths.append(scene.render.filepath)
            side_by_side(paths, os.path.join(OUT_RENDERS, 'variants', 'hina_pizza_variants_3up.png'))
        return

    if EXPORT:
        os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
        # glTF: meshes and materials only (the app brings its own camera, lights and shadow)
        bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT_GLB), export_format='GLB', export_apply=True,
                                  export_cameras=False, export_lights=False, export_yup=True)
        print(f'[hina_pizza] exported {os.path.abspath(OUT_GLB)} ({os.path.getsize(OUT_GLB) / 1024:.0f} kB)')

    build_contact_shadow()
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    print(f'[hina_pizza] saved {OUT_BLEND}')

    if RENDER:
        render(scene, hero, rig, 0.0, f'hina_pizza{TAG}_hero.png')
        render(scene, hero, rig, 0.0, f'hina_pizza{TAG}_hero_bg.png', transparent=False)
        # top view: turn the rig so the key still comes from the frame's upper left
        render(scene, top, rig, 195.0, f'hina_pizza{TAG}_top.png')
        rig.rotation_euler = (0.0, 0.0, 0.0)
        scene.camera = hero
        scene.render.film_transparent = True
        scene.render.filepath = '//renders/'
        bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)


main()

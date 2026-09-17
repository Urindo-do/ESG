"""환경이 텍스처 생성기 (PIL).

얼굴 데칼(표정별), 배지 문양, 도토리 깍정이 무늬를 만든다.
얼굴 좌표계: 텍스처 중심이 머리 정면 중심. 1R(머리 반지름)이 텍스처 폭의 RSCALE 비율.
"""
import math
import os
import sys
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1] if len(sys.argv) > 1 else "tex"
os.makedirs(OUT, exist_ok=True)

SIZE = 1024
SS = 4  # 슈퍼샘플링 배율
N = SIZE * SS

# make_character.py 의 FACE_HALF(=0.21)와 HEAD_R(=0.235) 비율과 맞춘다
HEAD_R = 0.235
FACE_HALF = 0.21
RSCALE = HEAD_R / (2 * FACE_HALF)  # 1R 이 텍스처 폭에서 차지하는 비율

EYE = (59, 34, 23)
EYE_RIM = (92, 54, 33)
BROW = (110, 70, 45)
NOSE = (122, 74, 46)
MOUTH = (150, 42, 40)
MOUTH_DARK = (112, 28, 30)
TONGUE = (243, 128, 128)
BLUSH = (246, 160, 150)
TEAR = (170, 215, 245)
WHITE = (255, 255, 255)


def P(fx, fz):
    """얼굴 좌표(fx 오른쪽+, fz 위+, 단위 R) → 픽셀 좌표(슈퍼샘플)."""
    return (N / 2 + fx * RSCALE * N, N / 2 - fz * RSCALE * N)


def S(f):
    return f * RSCALE * N


def ellipse(d, cx, cz, rx, rz, fill):
    x, y = P(cx, cz)
    d.ellipse([x - S(rx), y - S(rz), x + S(rx), y + S(rz)], fill=fill)


def arc_stroke(d, pts, width, fill):
    px = [P(*p) for p in pts]
    d.line(px, fill=fill, width=int(S(width)), joint="curve")
    r = S(width) / 2
    for x, y in (px[0], px[-1]):
        d.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def curve(fn, n=40):
    return [fn(i / (n - 1)) for i in range(n)]


def blush_layer(strength=1.0, cz=-0.24, cx=0.60):
    alpha = Image.new("L", (N, N), 0)
    d = ImageDraw.Draw(alpha)
    for side in (-1, 1):
        ellipse(d, side * cx, cz, 0.17, 0.115, min(255, int(200 * strength)))
    alpha = alpha.filter(ImageFilter.GaussianBlur(S(0.05)))
    layer = Image.new("RGBA", (N, N), BLUSH + (0,))
    layer.putalpha(alpha)
    return layer


EYE_X = 0.40
EYE_Z = 0.05


def open_eye(d, side, rx=0.125, rz=0.155, wet=False):
    cx = side * EYE_X
    ellipse(d, cx, EYE_Z, rx, rz, EYE_RIM)
    ellipse(d, cx, EYE_Z - 0.005, rx * 0.86, rz * 0.88, EYE)
    # 아래쪽 은은한 반사
    ellipse(d, cx + 0.01, EYE_Z - rz * 0.55, rx * 0.45, rz * 0.18, (120, 72, 46))
    # 하이라이트: 큰 것 오른쪽 위, 작은 것 왼쪽 아래
    ellipse(d, cx + rx * 0.32, EYE_Z + rz * 0.38, rx * 0.34, rz * 0.3, WHITE)
    ellipse(d, cx - rx * 0.35, EYE_Z - rz * 0.3, rx * 0.14, rz * 0.12, WHITE)
    if wet:
        # 눈가에 맺힌 눈물
        ellipse(d, cx, EYE_Z - rz * 0.78, rx * 0.95, rz * 0.2, TEAR + (230,))
        ellipse(d, cx - rx * 0.2, EYE_Z - rz * 0.78, rx * 0.35, rz * 0.08, WHITE)


def closed_eye(d, side, up=False, droop=False):
    """up=True: ^^ 웃는 눈, False: ◡ 감은 눈."""
    cx = side * EYE_X
    if up:
        pts = curve(lambda t: (cx + (t - 0.5) * 0.26, EYE_Z - 0.02 + 0.11 * math.sin(math.pi * t)))
    else:
        tilt = (0.03 * side) if droop else 0.0
        pts = curve(lambda t: (cx + (t - 0.5) * 0.24, EYE_Z - 0.02 - 0.06 * math.sin(math.pi * t) + tilt * (t - 0.5) * -2))
    arc_stroke(d, pts, 0.045, EYE)


def brows(d, sad=True):
    for side in (-1, 1):
        cx = side * EYE_X
        if sad:
            # 가운데 쪽이 올라간 걱정 눈썹
            pts = curve(lambda t: (cx + side * (t - 0.5) * 0.2, EYE_Z + 0.25 + (0.5 - t) * 0.07 + 0.015 * math.sin(math.pi * t)))
        else:
            pts = curve(lambda t: (cx + (t - 0.5) * 0.18, EYE_Z + 0.27 + 0.02 * math.sin(math.pi * t)))
        arc_stroke(d, pts, 0.026, BROW)


def nose(d):
    ellipse(d, 0, 0.0, 0.045, 0.03, NOSE)
    ellipse(d, -0.012, 0.01, 0.014, 0.008, (170, 120, 90))


def open_smile(d, w=0.19, h=0.17, cz=-0.13):
    """D 모양 웃는 입: 위쪽은 살짝 휜 직선, 아래는 둥근 곡선."""
    top = curve(lambda t: (-w + 2 * w * t, cz + 0.02 * math.sin(math.pi * t)), 20)
    bottom = curve(lambda t: (w - 2 * w * t, cz - h * math.sin(math.pi * t) ** 0.8), 30)
    poly = [P(*p) for p in top + bottom]
    d.polygon(poly, fill=MOUTH)
    # 혀
    mask = Image.new("L", (N, N), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    tongue = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    td = ImageDraw.Draw(tongue)
    ellipse(td, 0.0, cz - h * 0.95, w * 0.62, h * 0.55, TONGUE + (255,))
    ellipse(td, 0.0, cz - 0.01, w * 0.9, h * 0.25, MOUTH_DARK + (255,))
    return tongue, mask


def small_smile(d, w=0.08, cz=-0.12):
    pts = curve(lambda t: ((t - 0.5) * 2 * w, cz - 0.035 * math.sin(math.pi * t)))
    arc_stroke(d, pts, 0.03, MOUTH)


def frown(d, w=0.075, cz=-0.16):
    pts = curve(lambda t: ((t - 0.5) * 2 * w, cz + 0.035 * math.sin(math.pi * t)))
    arc_stroke(d, pts, 0.03, MOUTH)


def o_mouth(d, cz=-0.14):
    ellipse(d, 0, cz, 0.04, 0.035, MOUTH)
    ellipse(d, 0, cz - 0.012, 0.022, 0.014, TONGUE)


def tears(d):
    for side in (-1, 1):
        cx = side * (EYE_X + 0.06)
        pts = curve(lambda t: (cx + side * 0.02 * t, EYE_Z - 0.17 - 0.2 * t))
        arc_stroke(d, pts, 0.03, TEAR + (200,))
        ellipse(d, cx + side * 0.02, EYE_Z - 0.4, 0.028, 0.036, TEAR + (230,))


def sparkle(d, cx, cz, s):
    pts = []
    for i in range(8):
        a = i * math.pi / 4
        r = s if i % 2 == 0 else s * 0.28
        pts.append(P(cx + r * math.cos(a), cz + r * math.sin(a)))
    d.polygon(pts, fill=(255, 236, 140))


def compose(draw_fn, blush=1.0, blush_z=-0.24):
    base = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    base = Image.alpha_composite(base, blush_layer(blush, blush_z))
    feat = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(feat)
    extra = draw_fn(d)
    if extra:
        tongue, mask = extra
        clear = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        feat = Image.alpha_composite(feat, Image.composite(tongue, clear, mask))
    img = Image.alpha_composite(base, feat)
    return img.resize((SIZE, SIZE), Image.LANCZOS)


def face_default(d):
    for s in (-1, 1):
        open_eye(d, s)
    nose(d)
    return open_smile(d)


def face_blink(d):
    for s in (-1, 1):
        closed_eye(d, s)
    nose(d)
    small_smile(d)


def face_happy(d):
    for s in (-1, 1):
        closed_eye(d, s, up=True)
    nose(d)
    sparkle(d, 0.66, 0.30, 0.07)
    sparkle(d, -0.70, 0.22, 0.05)
    return open_smile(d, w=0.22, h=0.21, cz=-0.12)


def face_sad(d):
    brows(d, sad=True)
    for s in (-1, 1):
        open_eye(d, s, rx=0.12, rz=0.14, wet=True)
    tears(d)
    nose(d)
    frown(d)


def face_sad_blink(d):
    brows(d, sad=True)
    for s in (-1, 1):
        closed_eye(d, s, droop=True)
    tears(d)
    nose(d)
    frown(d)


def face_sleep(d):
    for s in (-1, 1):
        closed_eye(d, s)
    nose(d)
    o_mouth(d)


FACES = {
    "face_default": (face_default, 1.0),
    "face_blink": (face_blink, 1.0),
    "face_happy": (face_happy, 1.25),
    "face_sad": (face_sad, 0.55),
    "face_sad_blink": (face_sad_blink, 0.55),
    "face_sleep": (face_sleep, 0.9),
}

for name, (fn, bl) in FACES.items():
    compose(fn, bl).save(os.path.join(OUT, f"{name}.png"), optimize=True)


# ── 배지: 나무 원판 + 새싹 문양 ─────────────────────────────
def badge():
    n = 512 * SS
    img = Image.new("RGB", (n, n), (231, 192, 138))
    d = ImageDraw.Draw(img)
    # 나이테
    for i, r in enumerate(range(int(n * 0.47), 0, -int(n * 0.05))):
        c = (222, 181, 126) if i % 2 else (231, 192, 138)
        d.ellipse([n / 2 - r, n / 2 - r, n / 2 + r, n / 2 + r], fill=c)
    d.ellipse([n * 0.12, n * 0.12, n * 0.88, n * 0.88], fill=(233, 196, 142))
    # 음각 테두리
    d.ellipse([n * 0.16, n * 0.16, n * 0.84, n * 0.84], outline=(196, 150, 96), width=int(n * 0.018))
    col = (168, 120, 72)
    w = int(n * 0.035)
    # 줄기
    d.line([(n * 0.5, n * 0.72), (n * 0.5, n * 0.42)], fill=col, width=w)
    # 잎 두 장 (외곽선)
    def leaf(cx, cy, ang, L, W):
        pts = []
        for i in range(41):
            t = i / 40
            u = t * 2 if t <= 0.5 else (1 - t) * 2
            side = 1 if t <= 0.5 else -1
            s = (t * 2) if t <= 0.5 else (2 - t * 2)
            along = s * L
            half = side * W * math.sin(math.pi * s) ** 0.8
            x = cx + along * math.cos(ang) - half * math.sin(ang)
            y = cy - (along * math.sin(ang) + half * math.cos(ang))
            pts.append((x, y))
        d.polygon(pts, fill=col)
        d.line([(cx, cy), (cx + L * 0.8 * math.cos(ang), cy - L * 0.8 * math.sin(ang))], fill=(214, 170, 116), width=int(w * 0.45))
    leaf(n * 0.5, n * 0.5, math.radians(145), n * 0.22, n * 0.075)
    leaf(n * 0.5, n * 0.46, math.radians(40), n * 0.25, n * 0.085)
    img.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, "badge.png"), optimize=True)


# ── 도토리 깍정이: 마름모 비늘 (색 + 높이) ─────────────────────
def acorn_cap():
    n = 512
    col = Image.new("RGB", (n, n), (120, 76, 44))
    hgt = Image.new("L", (n, n), 0)
    dc, dh = ImageDraw.Draw(col), ImageDraw.Draw(hgt)
    rows, cols = 10, 16
    for r in range(rows + 1):
        for c in range(cols + 1):
            x = (c + (0.5 if r % 2 else 0)) * n / cols
            y = r * n / rows
            hw, hh = n / cols * 0.5, n / rows * 0.62
            poly = [(x, y - hh), (x + hw, y), (x, y + hh), (x - hw, y)]
            dc.polygon(poly, fill=(146, 96, 58), outline=(84, 50, 28))
            dh.polygon(poly, fill=200, outline=40)
            dc.polygon([(x, y - hh * 0.7), (x + hw * 0.5, y - hh * 0.1), (x, y), (x - hw * 0.5, y - hh * 0.1)], fill=(168, 116, 72))
    col.filter(ImageFilter.GaussianBlur(0.6)).save(os.path.join(OUT, "acorn_cap.png"))
    hgt.filter(ImageFilter.GaussianBlur(2)).save(os.path.join(OUT, "acorn_cap_height.png"))


badge()
acorn_cap()
print("textures ->", OUT)

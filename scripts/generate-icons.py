from PIL import Image
from pathlib import Path

root = Path(r"C:\Users\snick\projects\nmshelper")
src = Image.open(root / "icons" / "logo-source.png").convert("RGBA")


def fit_square(img, size, pad_ratio=0.0, bg=(11, 20, 25, 255)):
    canvas = Image.new("RGBA", (size, size), bg)
    inner = int(size * (1 - pad_ratio))
    logo = img.copy()
    logo.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    x = (size - logo.width) // 2
    y = (size - logo.height) // 2
    canvas.paste(logo, (x, y), logo)
    return canvas


sizes = {
    "favicon-16.png": (16, 0.0),
    "favicon-32.png": (32, 0.0),
    "favicon-48.png": (48, 0.0),
    "apple-touch-icon.png": (180, 0.08),
    "icon-192.png": (192, 0.06),
    "icon-512.png": (512, 0.06),
    "icon-512-maskable.png": (512, 0.2),
}

out_dir = root / "icons"
for name, (size, pad) in sizes.items():
    im = fit_square(src, size, pad)
    im.save(out_dir / name, optimize=True)
    print("wrote", name, size)

# multi-resolution favicon
imgs = [fit_square(src, s, 0.0) for s in (16, 32, 48)]
imgs[0].save(
    out_dir / "favicon.ico",
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48)],
    append_images=imgs[1:],
)
print("wrote favicon.ico")

for shot in (root / "screenshots" / "wide.png", root / "screenshots" / "narrow.png"):
    im = Image.open(shot).convert("RGB")
    im.save(shot, optimize=True, quality=88)
    print("optimized", shot.name, im.size)

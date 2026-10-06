import struct, zlib

def create_png(width, height, pixels):
    """Create a minimal PNG file from pixel data."""
    def chunk(chunk_type, data):
        c = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(c) & 0xffffffff)
        return struct.pack('>I', len(data)) + c + crc

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))

    raw = b''
    for y in range(height):
        raw += b'\x00'  # filter none
        for x in range(width):
            idx = (y * width + x) * 4
            raw += bytes(pixels[idx:idx+4])

    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    return header + ihdr + idat + iend

# 22x22 tray icon - small cat face
W, H = 22, 22
pixels = [0, 0, 0, 0] * (W * H)

def set_px(x, y, r, g, b, a=255):
    if 0 <= x < W and 0 <= y < H:
        idx = (y * W + x) * 4
        pixels[idx] = r
        pixels[idx+1] = g
        pixels[idx+2] = b
        pixels[idx+3] = a

# Cat face - dark charcoal
c = (60, 63, 72)  # body color
e = (80, 220, 190)  # eye color
n = (220, 140, 160)  # nose color

# Ears (triangles)
for dy in range(4):
    for dx in range(-dy, dy+1):
        set_px(6 + dx, 3 + dy, *c)
        set_px(15 + dx, 3 + dy, *c)

# Head
for y in range(7, 17):
    for x in range(4, 18):
        dist_x = abs(x - 11)
        dist_y = abs(y - 12)
        if dist_x <= 7 and dist_y <= 5:
            set_px(x, y, *c)

# Fill gaps
for y in range(5, 8):
    for x in range(5, 17):
        if 5 <= x <= 7 or 14 <= x <= 16:
            set_px(x, y, *c)
for x in range(7, 15):
    set_px(x, 6, *c)

# Eyes
for dx in range(2):
    for dy in range(2):
        set_px(7 + dx, 10 + dy, *e)
        set_px(13 + dx, 10 + dy, *e)

# Nose
set_px(10, 13, *n)
set_px(11, 13, *n)

# Mouth
set_px(9, 14, *c)
set_px(10, 15, *c)
set_px(11, 15, *c)
set_px(12, 14, *c)

png_data = create_png(W, H, pixels)
with open('/Users/vinit/Vinit/Desktop Cat/pixelpaw/src-tauri/icons/tray-icon.png', 'wb') as f:
    f.write(png_data)
print("Tray icon created!")

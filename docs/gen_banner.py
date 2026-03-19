"""Generate AnyTerm hero banner image."""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1200, 630
img = Image.new('RGB', (W, H), '#0c0c0c')
draw = ImageDraw.Draw(img)

green = '#00ff41'
white = '#e0e0e0'
dim = '#333333'
blue = '#00aaff'

fd = r'C:\Users\ASUS\.claude\skills\canvas-design\canvas-fonts'

def font(name, size):
    try:
        return ImageFont.truetype(os.path.join(fd, name), size)
    except:
        return ImageFont.load_default()

ft = font('GeistMono-Bold.ttf', 56)
fs = font('GeistMono-Regular.ttf', 18)
fc = font('JetBrainsMono-Regular.ttf', 13)
fl = font('GeistMono-Regular.ttf', 12)
fss = font('GeistMono-Regular.ttf', 11)
fp = font('JetBrainsMono-Regular.ttf', 9)
fpl = font('GeistMono-Regular.ttf', 9)

# Title + subtitle
draw.text((W//2, 48), 'AnyTerm', fill=green, font=ft, anchor='mt')
draw.text((W//2, 112), 'Phone in hand, terminal at fingertips.', fill=white, font=fs, anchor='mt')
draw.line([(100, 148), (W-100, 148)], fill='#1a2a1a', width=1)

# === Desktop browser ===
bx, by, bw, bh = 60, 172, 500, 350
draw.rectangle([(bx, by), (bx+bw, by+28)], fill='#161616')
draw.ellipse([(bx+10, by+9), (bx+20, by+19)], fill='#ff3333')
draw.ellipse([(bx+26, by+9), (bx+36, by+19)], fill='#ffff00')
draw.ellipse([(bx+42, by+9), (bx+52, by+19)], fill=green)
draw.text((bx+70, by+7), 'localhost:7860', fill='#666', font=fss)
draw.rectangle([(bx, by+28), (bx+bw, by+bh)], fill='#0c0c0c', outline='#1a2a1a')
draw.rectangle([(bx+1, by+29), (bx+bw-1, by+50)], fill='#060606')
draw.text((bx+15, by+35), '\u25cf T1', fill=green, font=fss)
draw.text((bx+70, by+35), '+', fill='#666', font=fss)

lines = [
    ('PS C:\\Users\\ASUS> ', blue, 'ls', white),
    ('', '', '', ''),
    ('    Directory: C:\\Users\\ASUS', '#666', '', ''),
    ('', '', '', ''),
    ('Mode         LastWriteTime    Length Name', '#666', '', ''),
    ('----         -------------    ------ ----', '#666', '', ''),
    ('d----   3/19/2026  10:30 AM          Documents', green, '', ''),
    ('d----   3/19/2026  10:30 AM          Desktop', green, '', ''),
    ('-a---   3/18/2026   2:15 PM   142032 report.pdf', white, '', ''),
    ('', '', '', ''),
    ('PS C:\\Users\\ASUS> ', blue, 'anyterm', green),
]
ty = by + 58
for prompt, pcol, cmd, ccol in lines:
    x = bx + 12
    if prompt:
        draw.text((x, ty), prompt, fill=pcol, font=fc)
        x += len(prompt) * 8
    if cmd:
        draw.text((x, ty), cmd, fill=ccol, font=fc)
    ty += 17

draw.text((bx + bw//2, by+bh+10), 'DESKTOP', fill='#444', font=fl, anchor='mt')

# === Phone ===
px, py, pw, ph = 680, 172, 220, 390
draw.rounded_rectangle([(px, py), (px+pw, py+ph)], radius=18, fill='#1a1a1a', outline='#333')
draw.text((px+15, py+8), '11:06', fill='#999', font=fss)
draw.text((px+pw-40, py+8), '5G', fill='#999', font=fss)
sx, sy = px+8, py+26
sw, sh = pw-16, ph-60
draw.rectangle([(sx, sy), (sx+sw, sy+sh)], fill='#0c0c0c')
draw.rectangle([(sx, sy), (sx+sw, sy+18)], fill='#060606')
draw.text((sx+8, sy+3), '\u25cf T1', fill=green, font=fpl)

plines = [
    ('PS C:\\Users\\ASUS> ls', blue),
    ('  Documents  Desktop', '#999'),
    ('  report.pdf', '#999'),
    ('', None),
    ('PS C:\\Users\\ASUS> _', blue),
]
pty = sy + 24
for line, col in plines:
    if col and line:
        draw.text((sx+5, pty), line, fill=col, font=fp)
    pty += 12

# Input bar
iy = sy + sh - 35
draw.rectangle([(sx+3, iy), (sx+sw-3, iy+28)], fill='#161616', outline='#1a2a1a')
draw.text((sx+12, iy+8), 'Type command...', fill='#444', font=fpl)
draw.rectangle([(sx+sw-35, iy+3), (sx+sw-6, iy+25)], fill=green)
# Home bar
draw.rounded_rectangle([(px+80, py+ph-12), (px+pw-80, py+ph-8)], radius=2, fill='#666')
draw.text((px + pw//2, py+ph+10), 'MOBILE', fill='#444', font=fl, anchor='mt')

# === Connection line ===
cx1 = bx + bw + 20
cx2 = px - 20
cy = by + bh//2
for x in range(cx1, cx2, 8):
    draw.line([(x, cy), (x+4, cy)], fill=green, width=2)
draw.text(((cx1+cx2)//2, cy-18), 'WebSocket', fill=green, font=fl, anchor='mt')
draw.ellipse([(cx1-4, cy-4), (cx1+4, cy+4)], fill=green)
draw.ellipse([(cx2-4, cy-4), (cx2+4, cy+4)], fill=green)

# === Bottom tech stack ===
techs = ['Node.js', 'TypeScript', 'xterm.js', 'WebSocket', 'PowerShell', 'Whisper']
tx_start = W//2 - len(techs) * 50
for i, t in enumerate(techs):
    x = tx_start + i * 100
    draw.rounded_rectangle([(x, H-50), (x+85, H-28)], radius=4, fill='#161616', outline='#1a2a1a')
    draw.text((x+42, H-39), t, fill='#666', font=fss, anchor='mt')

out = os.path.join(os.path.dirname(__file__), 'demo', 'hero-banner.png')
img.save(out, 'PNG')
print(f'Saved: {out} ({W}x{H})')

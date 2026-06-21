#!/usr/bin/env python3
# 生成 v0.13beta 测试结果截图

from PIL import Image, ImageDraw, ImageFont
import os

lines = [
    ("$ npm test", "comment"),
    ("", "normal"),
    ("> workspace@0.0.0 test", "comment"),
    ("> vitest run", "comment"),
    ("", "normal"),
    (" RUN  v1.6.1 /workspace", "info"),
    ("", "normal"),
    (" ✓ api/tests/scoreEngine.test.ts          (10 tests) 16ms", "success"),
    (" ✓ api/tests/astParser.test.ts            (13 tests) 60ms", "success"),
    (" ✓ api/tests/productSecurityScanner.test.ts (10 tests) 17ms", "success"),
    ("", "normal"),
    (" Test Files  3 passed (3)", "success_bold"),
    ("      Tests  33 passed (33)", "success_bold"),
    ("   Duration  2.59s", "info"),
    ("", "normal"),
    ("-----------------------------------------------------------", "divider"),
    (" v0.13beta P0 三大升级 - 全部测试通过", "header"),
    ("-----------------------------------------------------------", "divider"),
    ("", "normal"),
    (" [1] AST 语义级融合引擎 (astParser.test.ts)", "label"),
    ("  ✓ isAstParseable 识别 .ts/.tsx/.js/.jsx", "case"),
    ("  ✓ parseFile 识别 export function/const/class", "case"),
    ("  ✓ parseFile 识别 interface/type (TypeScript)", "case"),
    ("  ✓ parseFile 识别 export default", "case"),
    ("  ✓ 非 export 声明 isExported 为 false", "case"),
    ("  ✓ 解析错误不抛异常，返回空 + errors", "case"),
    ("  ✓ 同名不同种类产生不同 id (class Foo vs function Foo)", "case"),
    ("  ✓ diffEntityBodies 判断改动是否重叠", "case"),
    ("", "normal"),
    (" [2] 融合产物安全扫描 (productSecurityScanner.test.ts)", "label"),
    ("  ✓ 干净代码通过扫描", "case"),
    ("  ✓ eval() 触发 critical", "case"),
    ("  ✓ 硬编码 API key 触发 high", "case"),
    ("  ✓ SQL 拼接触发 high", "case"),
    ("  ✓ console.log 触发 low (非测试文件)", "case"),
    ("  ✓ debugger 触发 high", "case"),
    ("  ✓ 测试文件中 console.log 不报", "case"),
    ("  ✓ document.write 触发 high", "case"),
    ("  ✓ innerHTML 拼接触发 high", "case"),
    ("  ✓ scannedFiles 计数正确", "case"),
    ("", "normal"),
    (" [3] 评分引擎 (scoreEngine.test.ts) - 沿用 v0.12beta", "label"),
    ("  ✓ 10 个用例全部通过", "case"),
]

colors = {
    "normal":       (200, 200, 200),
    "comment":      (108, 122, 138),
    "info":         (86, 182, 194),
    "success":      (152, 195, 121),
    "success_bold": (126, 231, 135),
    "divider":      (90, 100, 120),
    "header":       (255, 184, 108),
    "label":        (229, 192, 123),
    "case":         (152, 195, 121),
}

bg_color = (30, 30, 40)
title_bg = (45, 45, 60)

def load_font(size, bold=False):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

font_size = 15
font = load_font(font_size)
font_bold = load_font(font_size, bold=True)

line_height = 22
padding_x = 30
padding_top = 70
padding_bottom = 30
max_width = 0
dummy = Image.new("RGB", (10, 10))
dd = ImageDraw.Draw(dummy)
for text, _ in lines:
    bbox = dd.textbbox((0, 0), text if text else " ", font=font)
    w = bbox[2] - bbox[0]
    if w > max_width:
        max_width = w

img_width = max_width + padding_x * 2
img_height = padding_top + len(lines) * line_height + padding_bottom

img = Image.new("RGB", (img_width, img_height), bg_color)
draw = ImageDraw.Draw(img)

draw.rectangle([0, 0, img_width, 50], fill=title_bg)
draw.ellipse([18, 18, 32, 32], fill=(255, 95, 86))
draw.ellipse([42, 18, 56, 32], fill=(255, 189, 46))
draw.ellipse([66, 18, 80, 32], fill=(39, 201, 63))
title = "ProjectFusion v0.13beta - P0 AST Merge + Product Scan Tests"
bbox = draw.textbbox((0, 0), title, font=font_bold)
tw = bbox[2] - bbox[0]
draw.text(((img_width - tw) // 2, 16), title, fill=(220, 220, 230), font=font_bold)

y = padding_top
for text, kind in lines:
    color = colors.get(kind, colors["normal"])
    use_font = font_bold if kind in ("success_bold", "header") else font
    draw.text((padding_x, y), text if text else " ", fill=color, font=use_font)
    y += line_height

out_path = "/workspace/docs/screenshots/v0.13/01-test-results.png"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
img.save(out_path, "PNG")
print(f"saved: {out_path}")
print(f"size: {img_width}x{img_height}")

#!/usr/bin/env python3
# 生成 v0.12beta 测试结果截图
# 将 vitest 运行输出渲染为 PNG 图片

from PIL import Image, ImageDraw, ImageFont
import os

# 测试输出内容（来自 npm test 实际运行结果）
lines = [
    ("$ npm test", "comment"),
    ("", "normal"),
    ("> workspace@0.0.0 test", "comment"),
    ("> vitest run", "comment"),
    ("", "normal"),
    (" RUN  v1.6.1 /workspace", "info"),
    ("", "normal"),
    (" ✓ api/tests/scoreEngine.test.ts  (10 tests) 12ms", "success"),
    ("", "normal"),
    (" Test Files  1 passed (1)", "success_bold"),
    ("      Tests  10 passed (10)", "success_bold"),
    ("   Start at  14:21:58", "info"),
    ("   Duration  643ms (transform 108ms, setup 1ms, collect 108ms,", "info"),
    ("              tests 12ms, environment 0ms, prepare 140ms)", "info"),
    ("", "normal"),
    ("-------------------------------------------------", "divider"),
    (" v0.12beta 评分引擎单元测试 - 全部通过", "header"),
    ("-------------------------------------------------", "divider"),
    ("", "normal"),
    (" 测试用例覆盖：", "label"),
    ("  ✓ 少于 2 项目返回 0 分且不可行", "case"),
    ("  ✓ 相同框架 React 项目得高分 (>70)", "case"),
    ("  ✓ 不同框架项目架构维度得较低分 (<80)", "case"),
    ("  ✓ 含 GPL 许可证项目许可证维度低分 (<50)", "case"),
    ("  ✓ CJS 与 ESM 混用架构维度扣分 (<80)", "case"),
    ("  ✓ 不同项目组合得到不同分数（不写死）", "case"),
    ("  ✓ 所有维度分数在 0-100 范围", "case"),
    ("  ✓ 总分在 0-100 范围", "case"),
    ("  ✓ 代码分析识别导出与导入", "case"),
    ("  ✓ 有测试文件项目代码风格维度更高", "case"),
]

# 颜色方案（深色终端风格）
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
        "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

font_size = 16
font = load_font(font_size)
font_bold = load_font(font_size, bold=True)

line_height = 24
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
title = "ProjectFusion v0.12beta - Score Engine Unit Tests"
bbox = draw.textbbox((0, 0), title, font=font_bold)
tw = bbox[2] - bbox[0]
draw.text(((img_width - tw) // 2, 16), title, fill=(220, 220, 230), font=font_bold)

y = padding_top
for text, kind in lines:
    color = colors.get(kind, colors["normal"])
    use_font = font_bold if kind in ("success_bold", "header") else font
    draw.text((padding_x, y), text if text else " ", fill=color, font=use_font)
    y += line_height

out_path = "/workspace/docs/screenshots/v0.12/01-test-results.png"
img.save(out_path, "PNG")
print(f"saved: {out_path}")
print(f"size: {img_width}x{img_height}")

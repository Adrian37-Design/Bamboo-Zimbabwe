import os
import io
import sys
import argparse
from PIL import Image

# Parse command line arguments for custom card details
parser = argparse.ArgumentParser(description="Generate print-ready vector PDF for Bamboo Zimbabwe business card.")
parser.add_argument("--name", default="Tinashe Chidau", help="Name on the card")
parser.add_argument("--title", default="Executive Director", help="Job title on the card")
parser.add_argument("--phone", default="+263 77 294 9693", help="Phone number")
parser.add_argument("--email", default="tchidau58@gmail.com", help="Email address")
parser.add_argument("--website", default="bamboozimbabwe.co.zw", help="Website URL")
parser.add_argument("--split", action="store_true", help="Generate separate files for front and back faces")
args = parser.parse_args()

# Import ReportLab modules
from reportlab.pdfgen import canvas
from reportlab.lib.colors import CMYKColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Paths
workspace_dir = r"C:\Users\Takudzwa\Projects\Bamboo Zimbabwe"
scratch_dir = r"C:\Users\Takudzwa\.gemini\antigravity\brain\fb944118-d572-4cb5-80df-90688b33fd70\scratch"
temp_dir = os.path.join(scratch_dir, "recolored_slices")
os.makedirs(temp_dir, exist_ok=True)

# Register Fonts
print("Registering fonts...")
pdfmetrics.registerFont(TTFont('Outfit-Regular', os.path.join(workspace_dir, 'Outfit-Regular.ttf')))
pdfmetrics.registerFont(TTFont('Outfit-Bold', os.path.join(workspace_dir, 'Outfit-Bold.ttf')))
pdfmetrics.registerFont(TTFont('Outfit-Medium', os.path.join(workspace_dir, 'Outfit-Medium.ttf')))
pdfmetrics.registerFont(TTFont('Inter-Regular', os.path.join(workspace_dir, 'Inter-Regular.ttf')))
pdfmetrics.registerFont(TTFont('Inter-Medium', os.path.join(workspace_dir, 'Inter-Medium.ttf')))
pdfmetrics.registerFont(TTFont('Inter-SemiBold', os.path.join(workspace_dir, 'Inter-SemiBold.ttf')))
pdfmetrics.registerFont(TTFont('Inter-Bold', os.path.join(workspace_dir, 'Inter-Bold.ttf')))

# CMYK Color Definitions
forest_green = CMYKColor(0.88, 0.34, 0.83, 0.42)  # CMYK(88%, 34%, 83%, 42%)
lime_green = CMYKColor(0.65, 0.0, 0.60, 0.0)      # CMYK(65%, 0%, 60%, 0%)
amber_gold = CMYKColor(0.20, 0.30, 0.95, 0.0)      # CMYK(20%, 30%, 95%, 0%)
cream = CMYKColor(0.02, 0.0, 0.03, 0.03)          # CMYK(2%, 0%, 3%, 3%)
white = CMYKColor(0.0, 0.0, 0.0, 0.0)             # CMYK(0%, 0%, 0%, 0%)
black = CMYKColor(0.0, 0.0, 0.0, 1.0)             # CMYK(0%, 0%, 0%, 100%)

# RGB equivalents for Pillow image recoloring
rgb_white = (255, 255, 255)
# RGB equivalent of forest_green CMYK(88%, 34%, 83%, 42%):
# r = 255 * (1 - 0.88) * (1 - 0.42) = 17.7 -> 18
# g = 255 * (1 - 0.34) * (1 - 0.42) = 97.6 -> 98
# b = 255 * (1 - 0.83) * (1 - 0.42) = 25.1 -> 25
rgb_forest_green = (18, 98, 25)

# Logo Slices Mapping (from viewBox space 18 170 690 295)
slices = [
    {"class": "stalk", "file": "logo_stalk.png", "x": 18, "y": 173, "w": 294, "h": 282, "recolored": False},
    {"class": "char-1", "file": "logo_char_1.png", "x": 207, "y": 322, "w": 57, "h": 88, "recolored": True},
    {"class": "char-2", "file": "logo_char_2.png", "x": 273, "y": 353, "w": 51, "h": 57, "recolored": True},
    {"class": "char-3", "file": "logo_char_3.png", "x": 339, "y": 355, "w": 80, "h": 55, "recolored": True},
    {"class": "char-4", "file": "logo_char_4.png", "x": 428, "y": 323, "w": 58, "h": 87, "recolored": True},
    {"class": "char-5", "file": "logo_char_5.png", "x": 491, "y": 340, "w": 97, "h": 70, "recolored": True},
    {"class": "char-6", "file": "logo_char_6.png", "x": 596, "y": 340, "w": 98, "h": 70, "recolored": True},
    {"class": "zimbabwe", "file": "logo_zimbabwe.png", "x": 94, "y": 410, "w": 603, "h": 55, "recolored": True}
]

def recolor_png(src_path, dest_path, target_rgb):
    img = Image.open(src_path).convert("RGBA")
    data = img.getdata()
    new_data = []
    for item in data:
        # item is (r, g, b, a)
        if item[3] > 0:  # non-transparent pixel
            new_data.append((target_rgb[0], target_rgb[1], target_rgb[2], item[3]))
        else:
            new_data.append(item)
    img.putdata(new_data)
    img.save(dest_path, "PNG")

# Generate recolored logo slices
print("Recoloring logo slices...")
for sl in slices:
    if sl["recolored"]:
        src = os.path.join(workspace_dir, sl["file"])
        # Front face: recolored to white
        recolor_png(src, os.path.join(temp_dir, f"front_{sl['file']}"), rgb_white)
        # Back face: recolored to forest green
        recolor_png(src, os.path.join(temp_dir, f"back_{sl['file']}"), rgb_forest_green)

# Crop Marks Helper
def draw_crop_marks(c, color):
    c.saveState()
    c.setStrokeColor(color)
    c.setLineWidth(0.25)
    
    # Finished size is 3.5" x 2.0" (252 x 144 pt), bleed is 0.125" (9 pt)
    # Trim lines at: x = 9, x = 261, y = 9, y = 153
    # Corner (9, 9)
    c.line(9, 0, 9, 6)
    c.line(0, 9, 6, 9)
    # Corner (261, 9)
    c.line(261, 0, 261, 6)
    c.line(264, 9, 270, 9)
    # Corner (9, 153)
    c.line(9, 156, 9, 162)
    c.line(0, 153, 6, 153)
    # Corner (261, 153)
    c.line(261, 156, 261, 162)
    c.line(264, 153, 270, 153)
    
    c.restoreState()

# Watermark Stalk Helper (represented by vector shapes matching business-card.html)
def draw_watermark_stalk(c, x, y, size):
    c.saveState()
    s = size / 100.0
    
    # 1. Main vertical stalk
    rx = x + 47 * s
    ry = y + 10 * s
    c.roundRect(rx, ry, 6 * s, 140 * s, 3 * s, stroke=0, fill=1)
    
    # 2. Horizontal nodes
    c.roundRect(x + 40 * s, y + 112 * s, 20 * s, 3 * s, 1.5 * s, stroke=0, fill=1)
    c.roundRect(x + 40 * s, y + 77 * s, 20 * s, 3 * s, 1.5 * s, stroke=0, fill=1)
    c.roundRect(x + 40 * s, y + 42 * s, 20 * s, 3 * s, 1.5 * s, stroke=0, fill=1)
    
    # 3. Left leaf (rotated ellipse)
    rcx = x + 38 * s
    rcy = y + 105 * s
    c.saveState()
    c.translate(rcx, rcy)
    c.rotate(-30)
    c.ellipse(-14 * s, -7 * s, 14 * s, 7 * s, stroke=0, fill=1)
    c.restoreState()
    
    # 4. Right leaf (rotated ellipse)
    rcx = x + 62 * s
    rcy = y + 92 * s
    c.saveState()
    c.translate(rcx, rcy)
    c.rotate(30)
    c.ellipse(-14 * s, -7 * s, 14 * s, 7 * s, stroke=0, fill=1)
    c.restoreState()
    
    c.restoreState()

def draw_watermark_background(c):
    c.saveState()
    c.setFillAlpha(0.04)  # very subtle opacity
    c.setFillColor(lime_green)
    
    # Rotate around center of trim box (135, 81)
    c.translate(135, 81)
    c.rotate(-15)
    c.scale(1.4, 1.4)
    
    size = 40
    # Draw repeating grid
    for gx in range(-240, 240, 80):
        for gy in range(-200, 200, 100):
            draw_watermark_stalk(c, gx, gy, size)
            
    c.restoreState()

# Composed Logo Drawing Helper
def draw_logo(c, tx, ty, th, is_front=True):
    # tx, ty: bottom-left of logo bounding box
    # th: target height
    s = th / 295.0
    vx = 18
    vy = 170
    
    for sl in slices:
        if sl["recolored"]:
            prefix = "front_" if is_front else "back_"
            img_path = os.path.join(temp_dir, f"{prefix}{sl['file']}")
        else:
            img_path = os.path.join(workspace_dir, sl["file"])
            
        rx = tx + (sl["x"] - vx) * s
        ry_top = (ty + th) - (sl["y"] - vy) * s
        rw = sl["w"] * s
        rh = sl["h"] * s
        ry = ry_top - rh
        
        c.drawImage(img_path, rx, ry, width=rw, height=rh, mask='auto')

# Vector Icon Drawers
def draw_phone_icon(c, ix, iy):
    c.saveState()
    c.translate(ix, iy)
    c.rotate(-45)  # Rotate 45 degrees to match Lucide receiver tilt
    c.setLineWidth(1.0)
    c.setStrokeColor(black)
    c.setFillColor(black)
    
    # Curved receiver handle
    p = c.beginPath()
    p.moveTo(-3.5, 1.5)
    p.curveTo(-2.0, -1.5, 2.0, -1.5, 3.5, 1.5)
    c.drawPath(p, stroke=1, fill=0)
    
    # Earpieces
    c.rect(-4.0, 0.5, 1.0, 1.5, stroke=0, fill=1)
    c.rect(3.0, 0.5, 1.0, 1.5, stroke=0, fill=1)
    c.restoreState()

def draw_envelope_icon(c, ix, iy):
    c.saveState()
    c.setLineWidth(1.0)
    c.setStrokeColor(black)
    # Envelope rectangle
    c.rect(ix - 4.5, iy - 3.0, 9, 6, stroke=1, fill=0)
    # Fold lines
    c.line(ix - 4.5, iy + 3.0, ix, iy - 0.5)
    c.line(ix, iy - 0.5, ix + 4.5, iy + 3.0)
    c.restoreState()

def draw_globe_icon(c, ix, iy):
    c.saveState()
    c.setLineWidth(1.0)
    c.setStrokeColor(black)
    # Outer circle
    c.circle(ix, iy, 4.5, stroke=1, fill=0)
    # Grid lines
    c.line(ix - 4.5, iy, ix + 4.5, iy)  # Equator
    c.line(ix, iy - 4.5, ix, iy + 4.5)  # Prime Meridian
    c.ellipse(ix - 1.8, iy - 4.5, ix + 1.8, iy + 4.5, stroke=1, fill=0)  # Longitude
    c.restoreState()

# Gradient Drawers
def draw_top_gradient_line(c):
    # 0% (x=0) to 30% (x=81): forest_green to amber_gold
    # 30% (x=81) to 70% (x=189): amber_gold to lime_green
    # 70% (x=189) to 100% (x=270): lime_green to forest_green
    c.saveState()
    c.setLineWidth(1.0)
    
    c1 = (0.88, 0.34, 0.83, 0.42)  # forest_green
    c2 = (0.20, 0.30, 0.95, 0.0)   # amber_gold
    c3 = (0.65, 0.0, 0.60, 0.0)    # lime_green
    
    for x in range(270):
        if x < 81:
            factor = x / 81.0
            comp = [c1[i] + (c2[i] - c1[i]) * factor for i in range(4)]
        elif x < 189:
            factor = (x - 81) / 108.0
            comp = [c2[i] + (c3[i] - c2[i]) * factor for i in range(4)]
        else:
            factor = (x - 189) / 81.0
            comp = [c3[i] + (c1[i] - c3[i]) * factor for i in range(4)]
            
        col = CMYKColor(comp[0], comp[1], comp[2], comp[3])
        c.setStrokeColor(col)
        c.setFillColor(col)
        c.rect(x, 151, 1, 11, stroke=0, fill=1)
    c.restoreState()

def draw_front_divider_gradient(c):
    # Separator line at y = 56 from x = 29 to 149 (width 120 pt)
    # Fades from black (0.3 alpha) to transparent
    c.saveState()
    c.setFillColor(black)
    for dx in range(120):
        x = 29 + dx
        alpha = 0.3 * (1.0 - (dx / 120.0))
        c.setFillAlpha(alpha)
        c.rect(x, 56, 1, 0.5, stroke=0, fill=1)
    c.restoreState()

def draw_back_divider_gradient(c):
    # Centered line at y = 74 from x = 123 to 147 (width 24 pt)
    # Fades transparent -> black (1.0 alpha) -> transparent
    c.saveState()
    c.setFillColor(black)
    for dx in range(24):
        x = 123 + dx
        if dx < 12:
            alpha = dx / 12.0
        else:
            alpha = 1.0 - ((dx - 12) / 12.0)
        c.setFillAlpha(alpha)
        c.rect(x, 74, 1, 1.2, stroke=0, fill=1)
    c.restoreState()


# --- DEFINE DRAWING FUNCTIONS ---
def draw_front_page(c):
    # 1. Fill background with Dark Forest Green
    c.setFillColor(forest_green)
    c.rect(0, 0, 270, 162, stroke=0, fill=1)
    
    # 2. Draw subtle repeating bamboo watermark background
    draw_watermark_background(c)
    
    # 3. Draw top Amber Gold to Lime Green gradient accent line
    draw_top_gradient_line(c)
    
    # 4. Draw Composed Logo (White)
    # Left margin = 29, Top padding from trim = 20, Logo height = 34
    draw_logo(c, 29, 99, 34, is_front=True)
    
    # 5. Draw Contact Information
    # Fading separator line at y = 57
    draw_front_divider_gradient(c)
    
    # Title: Job Title (Inter-Medium, 8.0 pt, Black)
    c.setFont("Inter-Medium", 8.0)
    c.setFillColor(black)
    c.drawString(29, 63.5, args.title)
    
    # Name: Name (Outfit-Bold, 13.5 pt, White)
    c.setFont("Outfit-Bold", 13.5)
    c.setFillColor(white)
    c.drawString(29, 75.0, args.name)
    
    # Contact rows (website, email, phone)
    # Row 1: Phone (y = 45)
    draw_phone_icon(c, 33, 45)
    c.setFont("Inter-Regular", 7.2)
    c.setFillColor(amber_gold)
    c.drawString(45, 42.5, args.phone)
    
    # Row 2: Email (y = 33)
    draw_envelope_icon(c, 33, 33)
    c.drawString(45, 30.5, args.email)
    
    # Row 3: Website (y = 21)
    draw_globe_icon(c, 33, 21)
    c.drawString(45, 18.5, args.website)
    
    # 6. Draw subtle rounded card border preview (12 pt radius trim preview)
    c.saveState()
    c.setStrokeColor(lime_green)
    c.setStrokeAlpha(0.15)
    c.setLineWidth(1.0)
    c.roundRect(9, 9, 252, 144, 12, stroke=1, fill=0)
    c.restoreState()
    
    # 7. Draw white crop marks for the front page
    draw_crop_marks(c, white)

def draw_back_page(c):
    # 1. Fill background with Cream
    c.setFillColor(cream)
    c.rect(0, 0, 270, 162, stroke=0, fill=1)
    
    # 2. Draw bottom Dark Forest Green footer band (stretching across the entire bleed width)
    c.setFillColor(forest_green)
    c.rect(0, 0, 270, 33, stroke=0, fill=1)
    
    # Draw website text centered in the footer band
    # Width = 270. Center of card is x = 135. y of band is 0 to 33, center y = 16.5.
    c.setFont("Outfit-Bold", 6.5)
    c.setFillColor(cream)
    c.drawCentredString(135, 13.5, args.website)
    
    # 3. Draw Composed Logo (Green, centered horizontally)
    # Logo height = 42. Width = 42 * 690 / 295 = 98.24 pt.
    # Center of card is x = 135. Bottom-left x of logo: 135 - 49.12 = 85.88 pt.
    # y = 85 pt
    draw_logo(c, 85.88, 85, 42, is_front=False)
    
    # 4. Draw fading Divider line (y = 74 pt)
    draw_back_divider_gradient(c)
    
    # 5. Draw Tagline: Growing Zimbabwe's Green Future
    # Inter-SemiBold, 6.5 pt, Black. Centered horizontally at y = 63.
    c.setFont("Inter-SemiBold", 6.5)
    c.setFillColor(black)
    c.drawCentredString(135, 59.5, "Growing Zimbabwe's Green Future")
    
    # 6. Draw subtle rounded card border preview (12 pt radius trim preview)
    c.saveState()
    c.setStrokeColor(forest_green)
    c.setStrokeAlpha(0.12)
    c.setLineWidth(1.0)
    c.roundRect(9, 9, 252, 144, 12, stroke=1, fill=0)
    c.restoreState()
    
    # 7. Draw Dark Forest Green crop marks for the back page
    draw_crop_marks(c, forest_green)

# --- GENERATION LOGIC ---
if args.split:
    # 1. Front face file
    pdf_path_front = os.path.join(workspace_dir, "business-card-front.pdf")
    print(f"Creating Front Face PDF at: {pdf_path_front}")
    c = canvas.Canvas(pdf_path_front, pagesize=(270, 162))
    draw_front_page(c)
    c.showPage()
    c.save()
    
    # 2. Back face file
    pdf_path_back = os.path.join(workspace_dir, "business-card-back.pdf")
    print(f"Creating Back Face PDF at: {pdf_path_back}")
    c = canvas.Canvas(pdf_path_back, pagesize=(270, 162))
    draw_back_page(c)
    c.showPage()
    c.save()
    
    print("PDF generation complete successfully (Separate Front/Back files)!")
else:
    # Unified two-page file
    pdf_path = os.path.join(workspace_dir, "business-card.pdf")
    print(f"Creating Unified PDF at: {pdf_path}")
    c = canvas.Canvas(pdf_path, pagesize=(270, 162))
    
    print("Drawing Page 1 (Front)...")
    draw_front_page(c)
    c.showPage()
    
    print("Drawing Page 2 (Back)...")
    draw_back_page(c)
    c.showPage()
    
    c.save()
    print("PDF generation complete successfully (Unified file)!")


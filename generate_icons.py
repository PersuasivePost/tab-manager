from PIL import Image, ImageDraw
import os

def create_icon(size):
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Create gradient-like effect (simplified to solid colors for PNG)
    # Using purple-blue gradient colors
    for y in range(size):
        ratio = y / size
        r = int(139 + (59 - 139) * ratio)  # 139 -> 59 (8B -> 3B)
        g = int(92 + (130 - 92) * ratio)   # 92 -> 130 (5C -> 82)
        b = int(246 + (246 - 246) * ratio) # 246 -> 246 (F6 -> F6)
        draw.rectangle([(0, y), (size, y+1)], fill=(r, g, b, 255))
    
    # Draw rounded rectangle (approximation with regular rectangle for simplicity)
    padding = int(size * 0.15)
    rect_coords = [padding, padding, size - padding, size - padding]
    
    # Draw white rectangle outline
    line_width = max(2, size // 32)
    draw.rectangle(rect_coords, outline=(255, 255, 255, 255), width=line_width)
    
    # Draw horizontal lines inside
    line_start_x = padding + int((size - 2 * padding) * 0.2)
    line_end_x = padding + int((size - 2 * padding) * 0.8)
    
    line1_y = padding + int((size - 2 * padding) * 0.3)
    line2_y = padding + int((size - 2 * padding) * 0.5)
    line3_y = padding + int((size - 2 * padding) * 0.7)
    
    draw.line([(line_start_x, line1_y), (line_end_x, line1_y)], fill=(255, 255, 255, 255), width=line_width)
    draw.line([(line_start_x, line2_y), (line_end_x, line2_y)], fill=(255, 255, 255, 255), width=line_width)
    draw.line([(line_start_x, line3_y), (line_end_x - int((size - 2 * padding) * 0.2), line3_y)], fill=(255, 255, 255, 255), width=line_width)
    
    return img

# Create icons directory if it doesn't exist
icons_dir = 'icons'
if not os.path.exists(icons_dir):
    os.makedirs(icons_dir)

# Generate icons in different sizes
sizes = [16, 48, 128]
for size in sizes:
    icon = create_icon(size)
    icon.save(f'{icons_dir}/icon{size}.png')
    print(f'Created icon{size}.png')

print('All icons created successfully!')

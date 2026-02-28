#!/usr/bin/env python3
"""Generate placeholder PNG images for Expo React Native app."""

from PIL import Image, ImageDraw, ImageFont
import os

# Define colors
DARK_BROWN = "#3E2723"
WHITE = "#FFFFFF"
TRANSPARENT = (0, 0, 0, 0)

def create_directory(path):
    """Create directory if it doesn't exist."""
    os.makedirs(path, exist_ok=True)

def create_icon(width, height, text, filename):
    """Create icon with text centered."""
    # Create image with dark brown background
    img = Image.new('RGB', (width, height), DARK_BROWN)
    draw = ImageDraw.Draw(img)
    
    # Try to use a bold font, fall back to default if not available
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(height * 0.5))
    except:
        font = ImageFont.load_default()
    
    # Get text bounding box for centering
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (width - text_width) // 2
    y = (height - text_height) // 2
    
    # Draw white text
    draw.text((x, y), text, fill=WHITE, font=font)
    
    img.save(filename)
    print(f"Created: {filename}")

def create_splash(width, height, text, filename):
    """Create splash screen with text centered."""
    # Create image with dark brown background
    img = Image.new('RGB', (width, height), DARK_BROWN)
    draw = ImageDraw.Draw(img)
    
    # Use larger font for splash screen
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(height * 0.15))
    except:
        font = ImageFont.load_default()
    
    # Get text bounding box for centering
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (width - text_width) // 2
    y = (height - text_height) // 2
    
    # Draw white text
    draw.text((x, y), text, fill=WHITE, font=font)
    
    img.save(filename)
    print(f"Created: {filename}")

def create_logo(width, height, text, filename):
    """Create logo with transparent background."""
    # Create image with transparent background (RGBA)
    img = Image.new('RGBA', (width, height), TRANSPARENT)
    draw = ImageDraw.Draw(img)
    
    # Use bold font
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(height * 0.6))
    except:
        font = ImageFont.load_default()
    
    # Get text bounding box for centering
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (width - text_width) // 2
    y = (height - text_height) // 2
    
    # Draw dark brown text
    draw.text((x, y), text, fill=DARK_BROWN, font=font)
    
    img.save(filename)
    print(f"Created: {filename}")

def main():
    """Generate all placeholder images."""
    
    # Create directories
    create_directory('/sessions/upbeat-focused-cerf/mnt/ss_haboba/haboba/assets')
    create_directory('/sessions/upbeat-focused-cerf/mnt/ss_haboba/haboba/src/assets')
    
    # Generate icon.png (1024x1024)
    create_icon(1024, 1024, "H", 
                '/sessions/upbeat-focused-cerf/mnt/ss_haboba/haboba/assets/icon.png')
    
    # Generate splash.png (1284x2778)
    create_splash(1284, 2778, "HABOBA",
                  '/sessions/upbeat-focused-cerf/mnt/ss_haboba/haboba/assets/splash.png')
    
    # Generate adaptive-icon.png (1024x1024)
    create_icon(1024, 1024, "H",
                '/sessions/upbeat-focused-cerf/mnt/ss_haboba/haboba/assets/adaptive-icon.png')
    
    # Generate favicon.png (48x48)
    create_icon(48, 48, "H",
                '/sessions/upbeat-focused-cerf/mnt/ss_haboba/haboba/assets/favicon.png')
    
    # Generate logo.png (400x120, transparent background)
    create_logo(400, 120, "HABOBA",
                '/sessions/upbeat-focused-cerf/mnt/ss_haboba/haboba/src/assets/logo.png')
    
    print("\nAll images generated successfully!")

if __name__ == '__main__':
    main()

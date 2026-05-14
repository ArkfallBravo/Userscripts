import requests
from bs4 import BeautifulSoup
import os
from PIL import Image
from io import BytesIO
import time
import random

def download_chapter(url):
    # Create a session to maintain cookies
    session = requests.Session()
    
    # Set a user agent to mimic a browser
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        # Get the main page
        response = session.get(url, headers=headers)
        response.raise_for_status()
        
        # Parse the HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find all image elements
        images = soup.find_all('img', class_='chapter-image')
        
        if not images:
            print("No images found on the page")
            return None
        
        # Create a directory for the images
        chapter_dir = "chapter_images"
        os.makedirs(chapter_dir, exist_ok=True)
        
        # Download each image
        image_paths = []
        for i, img in enumerate(images, 1):
            img_url = img.get('src')
            if not img_url:
                continue
                
            # Add a small delay to avoid overwhelming the server
            time.sleep(random.uniform(0.5, 1.5))
            
            try:
                img_response = session.get(img_url, headers=headers)
                img_response.raise_for_status()
                
                # Save the image
                img_path = os.path.join(chapter_dir, f"page_{i:03d}.jpg")
                with open(img_path, 'wb') as f:
                    f.write(img_response.content)
                image_paths.append(img_path)
                print(f"Downloaded page {i}")
                
            except Exception as e:
                print(f"Error downloading image {i}: {str(e)}")
                continue
        
        return image_paths
        
    except Exception as e:
        print(f"Error accessing the website: {str(e)}")
        return None

def create_pdf(image_paths, output_filename="chapter.pdf"):
    if not image_paths:
        print("No images to create PDF from")
        return
    
    try:
        # Open the first image
        first_image = Image.open(image_paths[0])
        
        # Convert all images to RGB mode if they're not already
        images = []
        for img_path in image_paths:
            img = Image.open(img_path)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            images.append(img)
        
        # Save as PDF
        first_image.save(
            output_filename,
            save_all=True,
            append_images=images[1:],
            quality=95
        )
        print(f"PDF created successfully: {output_filename}")
        
    except Exception as e:
        print(f"Error creating PDF: {str(e)}")
    
    finally:
        # Clean up the downloaded images
        for img_path in image_paths:
            try:
                os.remove(img_path)
            except:
                pass
        try:
            os.rmdir("chapter_images")
        except:
            pass

def main():
    url = "https://weebcentral.com/chapters/01JF83VBSM6D4PCF61ZVACJKGF"
    print("Starting download...")
    image_paths = download_chapter(url)
    
    if image_paths:
        print("Creating PDF...")
        create_pdf(image_paths)
    else:
        print("Failed to download images")

if __name__ == "__main__":
    main() 
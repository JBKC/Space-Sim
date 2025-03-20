import mercantile
import requests
import os

# Step 1: Setup (not explicitly requested, but included for completeness)
# Define your area of interest: [west, south, east, north] in degrees
bbox = [8.0, 46.0, 9.0, 47.0]  # Example: 1° x 1° area (adjust to your game’s needs)
max_zoom = 10  # Zoom level (higher = more detail, more tiles)
key = "7lEaUMnLqxOJqBmrGAKw"  # Your MapTiler API key
base_url = "https://api.maptiler.com/tiles/terrain-quantized-mesh-v2/{z}/{x}/{y}.terrain?key={key}"

# Step 2: Calculate Tile Coordinates
tiles = []
for z in range(max_zoom + 1):  # From zoom 0 to max_zoom
    for tile in mercantile.tiles(bbox[0], bbox[1], bbox[2], bbox[3], zooms=z):
        tiles.append((tile.z, tile.x, tile.y))

print(f"Total tiles to download: {len(tiles)}")

# Step 3: Download the Terrain Tiles
os.makedirs("tiles", exist_ok=True)  # Create root tiles directory

for z, x, y in tiles:
    url = base_url.format(z=z, x=x, y=y, key=key)
    filepath = f"tiles/{z}/{x}/{y}.terrain"
    os.makedirs(os.path.dirname(filepath), exist_ok=True)  # Create z/x subdirectories

    response = requests.get(url)
    if response.status_code == 200:
        with open(filepath, "wb") as f:
            f.write(response.content)
        print(f"Downloaded {z}/{x}/{y}")
    else:
        print(f"Failed to download {z}/{x}/{y}: {response.status_code}")

print("Download complete!")
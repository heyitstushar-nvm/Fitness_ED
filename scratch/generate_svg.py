import re

with open('C:\\Users\\tusha\\OneDrive\\Desktop\\LOCALLL\\Fitness_ED\\muscles.svg', 'r') as f:
    svg_content = f.read()

# Map path index to muscle group
mapping = {
    1: 'shoulders', 2: 'shoulders',
    3: 'abs',
    4: 'biceps', 5: 'biceps',
    6: 'legs', 7: 'legs',
    8: 'legs', 9: 'legs',
    10: 'forearms', 11: 'forearms',
    12: 'forearms', 13: 'forearms', 14: 'forearms',
    15: 'forearms', 16: 'forearms', 17: 'forearms',
    18: '', 19: '', 20: '',  # Head
    21: '', 22: '', 23: '',  # Head
    24: 'chest', 25: 'chest', 26: 'chest',
    27: 'chest', 28: 'chest', 29: 'chest',
    30: 'shoulders', 31: 'shoulders', 32: 'shoulders',
    33: 'shoulders', 34: 'shoulders', 35: 'shoulders',
    36: 'legs', 37: 'legs', 38: 'legs',
    39: 'legs', 40: 'legs', 41: 'legs'
}

path_count = 0
def process_path(match):
    global path_count
    path_count += 1
    muscle = mapping.get(path_count, '')
    if muscle:
        return f'<path class="muscle-node" data-muscle="{muscle}" '
    else:
        return match.group(0) # Keep as is if no muscle

new_svg = re.sub(r'<path ', process_path, svg_content)
# We want to replace the hardcoded SVG in workouts.html with this new SVG.
# Let's save it to a file so we can view it and use it.
with open('C:\\Users\\tusha\\OneDrive\\Desktop\\LOCALLL\\Fitness_ED\\scratch\\final_svg.txt', 'w') as f:
    f.write(new_svg)
print("Done processing 41 paths.")

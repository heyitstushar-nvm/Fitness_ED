import re

with open('../templates/workouts.html', 'r') as f:
    html = f.read()

with open('processed_back.svg', 'r') as f:
    svg_content = f.read()

# Add a class to the svg tag of back SVG
svg_content = svg_content.replace('<svg width="466"', '<svg class="muscle-svg" aria-label="Muscle map back" width="466"')

new_html = re.sub(
    r'<div id="svgBack" style="display: none;">.*?</div>\n          </div>',
    f'<div id="svgBack" style="display: none;">\n{svg_content}\n          </div>',
    html,
    flags=re.DOTALL
)

with open('../templates/workouts.html', 'w') as f:
    f.write(new_html)
print("Injected back.svg into workouts.html")

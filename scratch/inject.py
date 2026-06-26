import re

with open('C:\\Users\\tusha\\OneDrive\\Desktop\\LOCALLL\\Fitness_ED\\scratch\\final_svg.txt', 'r') as f:
    svg_content = f.read()

# Make sure it has class="muscle-svg" and aria-label="Muscle map"
svg_content = svg_content.replace('<svg ', '<svg class="muscle-svg" aria-label="Muscle map" ')

with open('C:\\Users\\tusha\\OneDrive\\Desktop\\LOCALLL\\Fitness_ED\\templates\\workouts.html', 'r') as f:
    html_content = f.read()

pattern = r'<svg viewBox="0 0 380 420" class="muscle-svg" aria-label="Muscle map">.*?</svg>'
new_html = re.sub(pattern, svg_content, html_content, flags=re.DOTALL)

with open('C:\\Users\\tusha\\OneDrive\\Desktop\\LOCALLL\\Fitness_ED\\templates\\workouts.html', 'w') as f:
    f.write(new_html)

print("Injected SVG into workouts.html")

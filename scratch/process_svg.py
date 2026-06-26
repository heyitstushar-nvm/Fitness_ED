import re

with open('../back.svg', 'r') as f:
    content = f.read()

# Lines 2-5: Calves
# Lines 6-7: Hamstrings
# Lines 8-9: Traps (neck)
# Lines 10-11: Lats
# Lines 12-13: Shoulders
# Lines 14: Lower Back
# Lines 15: Glutes
# Lines 16-17: Triceps
# Lines 18-19: Hamstrings

mappings = [
    (r'<path d="M70 1111\.54.*?>', 'calves'),
    (r'<path d="M385 1110\.54.*?>', 'calves'),
    (r'<path d="M87\.5 907\.541.*?>', 'hamstrings'),
    (r'<path d="M367 907\.541.*?>', 'hamstrings'),
    (r'<path d="M83 201\.041.*?>', 'traps'),
    (r'<path d="M383\.637 200\.209.*?>', 'traps'),
    (r'<path d="M83 243\.041.*?>', 'lats'),
    (r'<path d="M382 243\.041.*?>', 'lats'),
    (r'<path d="M20 223\.541.*?>', 'shoulders'),
    (r'<path d="M446\.486 225\.351.*?>', 'shoulders'),
    (r'<path d="M111 112\.541.*?>', 'lower_back'),
    (r'<path d="M150\.5 426\.541.*?>', 'glutes'),
    (r'<path d="M27 243\.041.*?>', 'triceps'),
    (r'<path d="M439 246\.041.*?>', 'triceps'),
    (r'<path d="M112 565\.541.*?>', 'hamstrings'),
    (r'<path d="M349 565\.041.*?>', 'hamstrings')
]

for regex, muscle in mappings:
    def repl(m):
        path_str = m.group(0)
        # insert class and data-muscle
        return path_str.replace('<path ', f'<path class="muscle-node" data-muscle="{muscle}" ')
    content = re.sub(regex, repl, content)

with open('processed_back.svg', 'w') as f:
    f.write(content)
print("Done")

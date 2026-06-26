import json
import urllib.parse
import os

with open('../excercises.txt', 'r') as f:
    lines = f.read().splitlines()

db = {}
current_muscle = None

muscle_map = {
    'CHEST': 'chest',
    'SERRATUS ANTERIOR': 'serratus',
    'ABS': 'core',
    'OBLIQUES': 'obliques',
    'DELTOIDS': 'shoulders',
    'BICEPS': 'biceps',
    'TRICEPS': 'triceps',
    'FOREARMS': 'forearms',
    'TRAPEZIUS': 'traps',
    'LATISSIMUS DORSI': 'lats',
    'RHOMBOIDS': 'rhomboids',
    'TERES MAJOR': 'teres_major',
    'ERECTOR SPINAE': 'lower_back',
    'GLUTES': 'glutes',
    'QUADRICEPS': 'quads',
    'HAMSTRINGS': 'hamstrings',
    'ADDUCTORS': 'inner_thighs',
    'ABDUCTORS': 'outer_thighs',
    'CALVES': 'calves',
    'TIBIALIS ANTERIOR': 'tibialis'
}

preview_images = {
    'chest': 'https://images.pexels.com/photos/416717/pexels-photo-416717.jpeg?auto=compress&cs=tinysrgb&w=900',
    'lats': 'https://images.pexels.com/photos/414029/pexels-photo-414029.jpeg?auto=compress&cs=tinysrgb&w=900',
    'lower_back': 'https://images.pexels.com/photos/414029/pexels-photo-414029.jpeg?auto=compress&cs=tinysrgb&w=900',
    'shoulders': 'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=900',
    'biceps': 'https://images.pexels.com/photos/2261485/pexels-photo-2261485.jpeg?auto=compress&cs=tinysrgb&w=900',
    'triceps': 'https://images.pexels.com/photos/3837784/pexels-photo-3837784.jpeg?auto=compress&cs=tinysrgb&w=900',
    'core': 'https://images.pexels.com/photos/4720236/pexels-photo-4720236.jpeg?auto=compress&cs=tinysrgb&w=900',
    'quads': 'https://images.pexels.com/photos/414029/pexels-photo-414029.jpeg?auto=compress&cs=tinysrgb&w=900',
    'hamstrings': 'https://images.pexels.com/photos/414029/pexels-photo-414029.jpeg?auto=compress&cs=tinysrgb&w=900',
    'inner_thighs': 'https://images.pexels.com/photos/414029/pexels-photo-414029.jpeg?auto=compress&cs=tinysrgb&w=900',
    'calves': 'https://images.pexels.com/photos/414029/pexels-photo-414029.jpeg?auto=compress&cs=tinysrgb&w=900',
    'glutes': 'https://images.pexels.com/photos/8032828/pexels-photo-8032828.jpeg?auto=compress&cs=tinysrgb&w=900',
    'forearms': 'https://images.pexels.com/photos/4761671/pexels-photo-4761671.jpeg?auto=compress&cs=tinysrgb&w=900',
    'traps': 'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=900',
}

for line in lines:
    line = line.strip()
    if not line:
        continue
    
    # Check if header
    is_header = False
    for k in muscle_map:
        if line.startswith(k):
            current_muscle = muscle_map[k]
            if current_muscle not in db:
                db[current_muscle] = []
            is_header = True
            break
            
    if is_header or not current_muscle:
        continue
        
    # It's an exercise line
    # Format: "upper chest: incline bench press, incline dumbbell press, incline push-ups"
    # or "exercises: russian twists, side plank, woodchoppers, heel touches"
    if ':' in line:
        category, ex_str = line.split(':', 1)
        ex_list = [x.strip().title() for x in ex_str.split(',')]
        
        for ex in ex_list:
            search_query = f"Jeff Nippard {ex} form tutorial"
            url = f"https://www.youtube.com/results?search_query={urllib.parse.quote_plus(search_query)}"
            
            db[current_muscle].append({
                'name': ex,
                'target': current_muscle.replace('_', ' ').title() + f" ({category.strip().title()})",
                'difficulty': 'Intermediate',
                'suggested_for': 'All',
                'preview_image': preview_images.get(current_muscle, 'https://images.pexels.com/photos/414029/pexels-photo-414029.jpeg?auto=compress&cs=tinysrgb&w=900'),
                'description': f'{ex} is highly effective for targeting the {category.strip()} of the {current_muscle.replace("_", " ")}.',
                'how_to': f'Maintain a braced core, control the eccentric portion, and forcefully contract your {current_muscle.replace("_", " ")} during the concentric.',
                'preview_video': '',
                'learn_more_url': url
            })

with open('../exercises_db.json', 'w') as f:
    json.dump(db, f, indent=2)

print("Generated exercises_db.json")

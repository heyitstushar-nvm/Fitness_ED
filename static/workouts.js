(function () {
  const resultTitle = document.getElementById('resultTitle');
  const resultMeta = document.getElementById('resultMeta');
  const exerciseList = document.getElementById('exerciseList');

  // Dynamically initialize front SVG elements matching the IDs from Frontsvgmuscname.csv
  const frontSvgContainer = document.getElementById('svgFront');
  if (frontSvgContainer) {
    const muscleIds = ['0001S', '0002C', '0003B', '0004D', '0005N', '0006O', '0007Q', '0008V', '0009A', '0010C', '0008F'];
    muscleIds.forEach((id) => {
      const el = frontSvgContainer.querySelector(`[id="${id}"]`);
      if (el) {
        el.classList.add('muscle-node');
        el.setAttribute('data-muscle', id);
      }
    });
  }

  const nodes = Array.from(document.querySelectorAll('.muscle-node'));

  // Front/Back View Toggle
  const viewFront = document.getElementById('viewFront');
  const viewBack = document.getElementById('viewBack');
  const svgFront = document.getElementById('svgFront');
  const svgBack = document.getElementById('svgBack');

  let selectedMuscle = '';
  const formatMuscleLabel = (value) =>
    String(value || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase());

  const escapeHtml = (value) =>
    String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const toggleView = () => {
    if (viewFront.checked) {
      svgFront.style.display = 'block';
      svgBack.style.display = 'none';
    } else {
      svgFront.style.display = 'none';
      svgBack.style.display = 'block';
    }
  };

  if (viewFront) viewFront.addEventListener('change', toggleView);
  if (viewBack) viewBack.addEventListener('change', toggleView);

  const renderExercises = (muscle, exercises) => {
    if (!exercises.length) {
      exerciseList.innerHTML = '<div class="history-empty">No exercises found for this muscle.</div>';
      return;
    }

    exerciseList.innerHTML = exercises
      .map((item) => `
        <article class="exercise-item">
          <h4>${escapeHtml(item.name)}</h4>
          <div class="exercise-meta">${escapeHtml(item.target || muscle)} • ${escapeHtml(item.difficulty || 'Intermediate')} • ${escapeHtml(item.suggested_for || 'All')}</div>
          ${item.preview_image ? `<img class="exercise-preview" src="${escapeHtml(item.preview_image)}" alt="${escapeHtml(item.name)} preview">` : ''}
          <p>${escapeHtml(item.description || 'No description provided.')}</p>
          <p class="exercise-howto"><strong>How to do:</strong> ${escapeHtml(item.how_to || 'Control the movement and maintain stable posture.')}</p>
          <div class="exercise-links">
            ${item.preview_video ? `<a href="${escapeHtml(item.preview_video)}" target="_blank" rel="noreferrer">Video Preview</a>` : ''}
            ${item.learn_more_url ? `<a href="${escapeHtml(item.learn_more_url)}" target="_blank" rel="noreferrer">Form Guide</a>` : ''}
          </div>
        </article>
      `)
      .join('');
  };

  const loadExercises = async (muscle) => {
    selectedMuscle = muscle;
    resultTitle.textContent = `Loading exercises...`;
    exerciseList.innerHTML = '<div class="history-empty">Fetching exercises...</div>';

    try {
      const res = await fetch(`/api/workouts/exercises?muscle=${encodeURIComponent(muscle)}`);
      if (!res.ok) throw new Error('Failed to load exercises');
      const data = await res.json();

      resultTitle.textContent = `${data.display_name || formatMuscleLabel(muscle)} Exercises`;
      renderExercises(muscle, data.exercises || []);
    } catch (error) {
      console.error(error);
      resultTitle.textContent = `Could not load exercises`;
      exerciseList.innerHTML = '<div class="history-empty">Try again in a moment.</div>';
    }
  };

  nodes.forEach((node) => {
    node.addEventListener('click', () => {
      nodes.forEach((n) => n.classList.remove('active'));
      const muscle = node.dataset.muscle || '';
      nodes.filter((n) => n.dataset.muscle === muscle).forEach((n) => n.classList.add('active'));
      loadExercises(muscle);
    });
  });

  resultMeta.textContent = 'Select a muscle to begin';
})();

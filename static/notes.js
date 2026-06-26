(function () {
  const noteTitle = document.getElementById('noteTitle');
  const noteContent = document.getElementById('noteContent');
  const noteColor = document.getElementById('noteColor');
  const saveBtn = document.getElementById('saveNoteBtn');
  const clearBtn = document.getElementById('clearNoteBtn');
  const notesGrid = document.getElementById('notesGrid');
  const searchInput = document.getElementById('noteSearch');
  const filterButtons = Array.from(document.querySelectorAll('.chip'));

  if (!noteTitle || !noteContent || !noteColor || !saveBtn || !clearBtn || !notesGrid || !searchInput) return;

  let notes = [];
  let activeFilter = 'active';
  let editingId = null;
  const colorPattern = /^#[0-9a-fA-F]{6}$/;

  const escapeHtml = (value) =>
    String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const pickReadableText = (bgHex) => {
    if (!colorPattern.test(bgHex || '')) return '#2a1d13';
    const raw = bgHex.replace('#', '');
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 130 ? '#2a1d13' : '#f8f3ec';
  };

  const fmtDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const resetCompose = () => {
    editingId = null;
    noteTitle.value = '';
    noteContent.value = '';
    noteColor.value = '#fff8e7';
    saveBtn.textContent = 'Save Note';
  };

  const readCompose = () => ({
    title: (noteTitle.value || '').trim(),
    content: (noteContent.value || '').trim(),
    color: colorPattern.test(noteColor.value || '') ? noteColor.value : '#fff8e7'
  });

  const drawNotes = () => {
    const q = (searchInput.value || '').trim().toLowerCase();
    let filtered = notes.slice();

    if (activeFilter === 'active') filtered = filtered.filter((n) => !n.is_archived);
    if (activeFilter === 'archived') filtered = filtered.filter((n) => n.is_archived);

    if (q) {
      filtered = filtered.filter((n) => `${n.title} ${n.content}`.toLowerCase().includes(q));
    }

    if (!filtered.length) {
      notesGrid.innerHTML = '<div class="history-empty">No notes found.</div>';
      return;
    }

    notesGrid.innerHTML = filtered
      .map((n) => {
        const bg = colorPattern.test(n.color || '') ? n.color : '#fff8e7';
        const fg = pickReadableText(bg);
        const metaColor = fg === '#f8f3ec' ? 'rgba(248,243,236,0.78)' : 'rgba(42,29,19,0.72)';
        return `
          <article class="note-card" style="background:${escapeHtml(bg)}; color:${fg};">
            <h3>${escapeHtml(n.title || 'Untitled note')}</h3>
            <div class="note-meta" style="color:${metaColor};">Updated ${escapeHtml(fmtDate(n.updated_at))}${n.is_pinned ? ' • Pinned' : ''}${n.is_archived ? ' • Archived' : ''}</div>
            <p class="note-body">${escapeHtml(n.content || '')}</p>
            <div class="note-actions">
              <button type="button" data-act="edit" data-id="${n.id}">Edit</button>
              <button type="button" data-act="pin" data-id="${n.id}">${n.is_pinned ? 'Unpin' : 'Pin'}</button>
              <button type="button" data-act="archive" data-id="${n.id}">${n.is_archived ? 'Unarchive' : 'Archive'}</button>
              <button type="button" data-act="delete" data-id="${n.id}" style="grid-column: span 3;">Delete</button>
            </div>
          </article>
        `;
      })
      .join('');
  };

  const fetchNotes = async () => {
    const params = new URLSearchParams();
    if (activeFilter === 'archived' || activeFilter === 'all') params.set('archived', '1');
    if ((searchInput.value || '').trim()) params.set('q', searchInput.value.trim());

    const res = await fetch(`/api/notes?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to load notes');
    const data = await res.json();
    notes = data.notes || [];
    drawNotes();
  };

  const saveNote = async () => {
    const body = readCompose();
    if (!body.title && !body.content) {
      showToast('Notes', 'Write a title or content first.');
      return;
    }

    if (editingId) {
      const res = await fetch(`/api/notes/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Failed to update note');
      showToast('Notes', 'Note updated.');
    } else {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Failed to save note');
      showToast('Notes', 'Note saved.');
    }

    resetCompose();
    await fetchNotes();
  };

  const togglePin = async (id) => {
    const res = await fetch(`/api/notes/${id}/pin`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to pin note');
    await fetchNotes();
  };

  const toggleArchive = async (id) => {
    const res = await fetch(`/api/notes/${id}/archive`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to archive note');
    await fetchNotes();
  };

  const deleteNote = async (id) => {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete note');
    if (editingId === id) resetCompose();
    await fetchNotes();
    showToast('Notes', 'Note deleted.');
  };

  notesGrid.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-id]');
    if (!button) return;

    const id = Number(button.dataset.id);
    if (!Number.isFinite(id)) return;

    const action = button.dataset.act;
    const note = notes.find((n) => n.id === id);

    try {
      if (action === 'edit' && note) {
        editingId = note.id;
        noteTitle.value = note.title || '';
        noteContent.value = note.content || '';
        noteColor.value = colorPattern.test(note.color || '') ? note.color : '#fff8e7';
        saveBtn.textContent = 'Update Note';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (action === 'pin') await togglePin(id);
      if (action === 'archive') await toggleArchive(id);
      if (action === 'delete') await deleteNote(id);
    } catch (err) {
      console.error(err);
      showToast('Notes', 'Action failed. Try again.');
    }
  });

  saveBtn.addEventListener('click', async () => {
    try {
      await saveNote();
    } catch (error) {
      console.error(error);
      showToast('Notes', 'Could not save note.');
    }
  });

  clearBtn.addEventListener('click', () => resetCompose());

  searchInput.addEventListener('input', () => {
    fetchNotes().catch((err) => {
      console.error(err);
      drawNotes();
    });
  });

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter || 'active';
      filterButtons.forEach((x) => x.classList.toggle('active', x === btn));
      fetchNotes().catch((err) => {
        console.error(err);
        showToast('Notes', 'Could not refresh notes.');
      });
    });
  });

  fetchNotes().catch((err) => {
    console.error(err);
    notesGrid.innerHTML = '<div class="history-empty">Unable to load notes right now.</div>';
  });
})();
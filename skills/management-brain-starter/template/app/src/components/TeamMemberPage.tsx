import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from '@tanstack/react-router';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  formatStartDate,
  initials,
  saveTeamMember,
  slackLinks,
  tenure,
  type TeamMember,
  type TeamNote,
} from '../lib/team';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type NoteFilter = 'all' | 'slack';

function submitOnModEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
}

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, href, children, ...props }) => {
            // A pasted Slack permalink reads better as a dated chip than as a long URL.
            const slack = href && children === href ? slackLinks(href)[0] : undefined;
            if (slack) {
              return (
                <a href={slack.url} target="_blank" rel="noreferrer" className="team-slack-chip">
                  💬 Slack thread
                  {slack.postedAt &&
                    ` · ${slack.postedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                </a>
              );
            }
            return (
              <a href={href} {...props} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}

export function TeamMemberPage({ initial }: { initial: TeamMember }) {
  const [member, setMember] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  async function update(next: TeamMember) {
    setMember(next);
    setSaveState('saving');
    try {
      await saveTeamMember(next);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }

  return (
    <div className="supercycle-page team-member">
      <Link to="/team" className="team-back">
        ← Team
      </Link>
      <DetailsHeader member={member} onSave={update} saveState={saveState} />
      <div className="team-columns">
        <CareerGoals member={member} onSave={update} />
        <Notes member={member} onSave={update} />
      </div>
    </div>
  );
}

function DetailsHeader({
  member,
  onSave,
  saveState,
}: {
  member: TeamMember;
  onSave: (next: TeamMember) => void;
  saveState: SaveState;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(member.title);
  const [startDate, setStartDate] = useState(member.startDate ?? '');

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ ...member, title: title.trim(), startDate: startDate || null });
    setEditing(false);
  }

  return (
    <header className="team-header">
      <span className="team-avatar team-avatar-lg" aria-hidden="true">
        {initials(member.name)}
      </span>
      <div className="team-header-body">
        <h1>{member.name}</h1>
        {editing ? (
          <form className="team-details-form" onSubmit={submit}>
            <label>
              Title
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label>
              Started at %%COMPANY%%
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <div className="team-form-actions">
              <button type="submit">Save</button>
              <button type="button" className="link" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="team-title">{member.title}</p>
            <p className="muted">
              {member.startDate
                ? `Started ${formatStartDate(member.startDate)} · ${tenure(member.startDate)} at %%COMPANY%%`
                : 'Start date not set'}{' '}
              <button type="button" className="link" onClick={() => setEditing(true)}>
                Edit details
              </button>
            </p>
          </>
        )}
      </div>
      <span className={`team-save-state ${saveState}`} role="status">
        {saveState === 'saving' && 'Saving…'}
        {saveState === 'saved' && 'Saved'}
        {saveState === 'error' && "Couldn't save. Try again."}
      </span>
    </header>
  );
}

function CareerGoals({ member, onSave }: { member: TeamMember; onSave: (next: TeamMember) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(member.careerGoals);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ ...member, careerGoals: draft.trim() });
    setEditing(false);
  }

  return (
    <section className="pr-project team-panel">
      <header className="pr-project-header">
        <h2>Career goals</h2>
        {!editing && (
          <button type="button" className="link" onClick={() => setEditing(true)}>
            {member.careerGoals ? 'Edit' : 'Add'}
          </button>
        )}
      </header>
      <div className="team-panel-body">
        {editing ? (
          <form onSubmit={submit} className="team-note-form">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={submitOnModEnter}
              rows={8}
              autoFocus
              aria-label="Career goals"
              placeholder={'- Lead a project end to end\n- Grow toward Staff'}
            />
            <div className="team-form-actions">
              <button type="submit">Save</button>
              <button
                type="button"
                className="link"
                onClick={() => {
                  setDraft(member.careerGoals);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
              <span className="muted">Markdown · ⌘↵ to save</span>
            </div>
          </form>
        ) : member.careerGoals ? (
          <MarkdownText text={member.careerGoals} />
        ) : (
          <p className="muted">No career goals yet.</p>
        )}
      </div>
    </section>
  );
}

function Notes({ member, onSave }: { member: TeamMember; onSave: (next: TeamMember) => void }) {
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState<NoteFilter>('all');

  function add(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const note: TeamNote = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), text };
    onSave({ ...member, notes: [note, ...member.notes] });
    setDraft('');
  }

  function replace(id: string, next: TeamNote | null) {
    const notes = member.notes.flatMap((note) => (note.id !== id ? [note] : next ? [next] : []));
    onSave({ ...member, notes });
  }

  const slackCount = member.notes.filter((note) => slackLinks(note.text).length > 0).length;
  const visible = [...member.notes]
    .filter((note) => filter === 'all' || slackLinks(note.text).length > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section className="pr-project team-panel">
      <header className="pr-project-header">
        <h2>Notes</h2>
        <div className="filters" role="group" aria-label="Filter notes">
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            All ({member.notes.length})
          </button>
          <button type="button" aria-pressed={filter === 'slack'} onClick={() => setFilter('slack')}>
            With Slack links ({slackCount})
          </button>
        </div>
      </header>
      <div className="team-panel-body">
        <form onSubmit={add} className="team-note-form">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={submitOnModEnter}
            rows={3}
            aria-label="New note"
            placeholder="What happened? Paste Slack links anywhere in the note."
          />
          {slackLinks(draft).length > 0 && (
            <p className="muted">
              {slackLinks(draft).length} Slack link{slackLinks(draft).length === 1 ? '' : 's'} detected
            </p>
          )}
          <div className="team-form-actions">
            <button type="submit" disabled={!draft.trim()}>
              Add note
            </button>
            <span className="muted">Markdown · ⌘↵ to add</span>
          </div>
        </form>

        {visible.length === 0 && (
          <p className="muted">{filter === 'slack' ? 'No notes with Slack links yet.' : 'No notes yet.'}</p>
        )}
        <ul className="team-notes">
          {visible.map((note) => (
            <NoteItem key={note.id} note={note} onChange={(next) => replace(note.id, next)} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function NoteItem({ note, onChange }: { note: TeamNote; onChange: (next: TeamNote | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [draft, setDraft] = useState(note.text);

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onChange({ ...note, text, updatedAt: new Date().toISOString() });
    setEditing(false);
  }

  return (
    <li className="team-note">
      <div className="team-note-meta">
        <span>
          {new Date(note.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          {note.updatedAt && ' · edited'}
        </span>
        {!editing && (
          <span className="team-note-actions">
            {confirmingDelete ? (
              <>
                <button type="button" className="link danger" onClick={() => onChange(null)}>
                  Delete note
                </button>
                <button type="button" className="link" onClick={() => setConfirmingDelete(false)}>
                  Keep
                </button>
              </>
            ) : (
              <>
                <button type="button" className="link" onClick={() => setEditing(true)}>
                  Edit
                </button>
                <button type="button" className="link" onClick={() => setConfirmingDelete(true)}>
                  Delete
                </button>
              </>
            )}
          </span>
        )}
      </div>
      {editing ? (
        <form onSubmit={submit} className="team-note-form">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={submitOnModEnter}
            rows={4}
            autoFocus
            aria-label="Edit note"
          />
          <div className="team-form-actions">
            <button type="submit" disabled={!draft.trim()}>
              Save
            </button>
            <button
              type="button"
              className="link"
              onClick={() => {
                setDraft(note.text);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <MarkdownText text={note.text} />
      )}
    </li>
  );
}

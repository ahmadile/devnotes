import React from 'react';
import { Search, Plus, FileText, Clock, Settings as SettingsIcon, Folder, FolderOpen, FolderPlus, ChevronRight, ChevronDown, Trash2, Edit3, CornerDownRight } from 'lucide-react';
import { Logo } from './Logo';
import { UserButton } from '@clerk/clerk-react';
import { Note, Module } from '../types';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface SidebarProps {
  notes: Note[];
  modules: Module[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onNewNote: (moduleId?: string | null) => void;
  onNewModule: (name: string, parentId?: string | null) => void;
  onRenameModule: (id: string, name: string, parentId?: string | null) => void;
  onDeleteModule: (id: string) => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  notes, 
  modules,
  activeNoteId, 
  onSelectNote, 
  onNewNote,
  onNewModule,
  onRenameModule,
  onDeleteModule,
  onOpenSettings
}) => {
  const [search, setSearch] = React.useState('');
  const [expandedModules, setExpandedModules] = React.useState<Record<string, boolean>>({});
  const [creatingModuleInId, setCreatingModuleInId] = React.useState<string | null>(null);
  const [renamingModuleId, setRenamingModuleId] = React.useState<string | null>(null);
  const [newModuleName, setNewModuleName] = React.useState('');
  const [renameModuleName, setRenameModuleName] = React.useState('');
  const [renameParentId, setRenameParentId] = React.useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  /** Check if `candidateId` is a descendant of `ancestorId` (prevents cycle when moving folders). */
  const isDescendant = (ancestorId: string, candidateId: string): boolean => {
    let current = candidateId;
    const visited = new Set<string>();
    while (current) {
      if (current === ancestorId) return true;
      if (visited.has(current)) return false;
      visited.add(current);
      const parent = modules.find(m => m.id === current);
      current = parent?.parentId || '';
    }
    return false;
  };

  const filteredNotes = notes.filter(n => {
    const query = search.toLowerCase();
    if (query.startsWith('#')) {
      const tagQuery = query.slice(1);
      return n.tags.some(t => t.toLowerCase().includes(tagQuery));
    }
    return (
      n.title.toLowerCase().includes(query) ||
      n.tags.some(t => t.toLowerCase().includes(query)) ||
      n.content.toLowerCase().includes(query)
    );
  });

  const renderNoteRow = (note: Note) => {
    return (
      <button
        key={note.id}
        onClick={() => onSelectNote(note.id)}
        className={cn(
          "w-full text-left py-1.5 pl-6 pr-3 rounded-lg border transition-all group relative flex items-center justify-between cursor-pointer",
          activeNoteId === note.id 
            ? "bg-[#18181c] border-white/[0.08] text-white shadow-sm" 
            : "hover:bg-white/[0.03] border-transparent text-zinc-400 hover:text-zinc-200"
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText className={cn(
            "w-3.5 h-3.5 shrink-0",
            activeNoteId === note.id ? "text-zinc-200" : "text-zinc-500"
          )} strokeWidth={1.5} />
          <span className={cn(
            "text-xs truncate transition-colors",
            activeNoteId === note.id ? "font-semibold text-white" : "font-medium text-zinc-400 group-hover:text-zinc-200"
          )}>
            {note.title || 'Untitled Note'}
          </span>
        </div>
      </button>
    );
  };

  const renderInlineCreateForm = (parentId: string | null) => {
    return (
      <div className="flex items-center gap-2 py-1.5 pl-6 pr-2">
        <Folder className="w-4 h-4 text-primary/40 shrink-0" />
        <input
          type="text"
          placeholder="Folder name..."
          value={newModuleName}
          autoFocus
          className="bg-background border border-border rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none w-full"
          onChange={(e) => setNewModuleName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (newModuleName.trim()) {
                onNewModule(newModuleName.trim(), parentId);
                setCreatingModuleInId(null);
              }
            } else if (e.key === 'Escape') {
              setCreatingModuleInId(null);
            }
          }}
          onBlur={() => {
            if (newModuleName.trim()) {
              onNewModule(newModuleName.trim(), parentId);
            }
            setCreatingModuleInId(null);
          }}
        />
      </div>
    );
  };

  /** Build a flat list of valid parent folder options for a module being renamed/moved. */
  const getValidParentOptions = (moduleId: string): Module[] => {
    return modules.filter(m => {
      if (m.id === moduleId) return false;          // can't be its own parent
      if (isDescendant(moduleId, m.id)) return false; // can't move into a descendant
      return true;
    });
  };

  /** Build a readable path label for a module. */
  const getModuleLabel = (m: Module): string => {
    const parts: string[] = [m.name];
    let pid = m.parentId;
    const visited = new Set<string>();
    while (pid) {
      if (visited.has(pid)) break;
      visited.add(pid);
      const parent = modules.find(mod => mod.id === pid);
      if (parent) {
        parts.unshift(parent.name);
        pid = parent.parentId;
      } else break;
    }
    return parts.join(' / ');
  };

  const renderModule = (module: Module) => {
    const isExpanded = !!expandedModules[module.id];
    const childModules = modules.filter(m => m.parentId === module.id);
    const childNotes = notes.filter(n => n.moduleId === module.id);
    const isRenaming = renamingModuleId === module.id;

    return (
      <div key={module.id} className="select-none">
        {/* Module Folder Row */}
        <div 
          className={cn(
            "flex items-center justify-between py-1.5 pl-2 pr-2 rounded-lg hover:bg-secondary/40 group/module cursor-pointer text-sm font-medium",
            "transition-all duration-200"
          )}
          onClick={() => toggleExpand(module.id)}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button 
              className="p-0.5 hover:bg-secondary rounded text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(module.id);
              }}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />}
            </button>
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-400/80 shrink-0" strokeWidth={1.5} />
            ) : (
              <Folder className="w-4 h-4 text-zinc-400 shrink-0" strokeWidth={1.5} />
            )}
            
            {isRenaming ? (
              <div className="flex flex-col gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={renameModuleName}
                  autoFocus
                  className="bg-background border border-border rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none w-full"
                  onChange={(e) => setRenameModuleName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      if (renameModuleName.trim()) {
                        onRenameModule(module.id, renameModuleName.trim(), renameParentId);
                        setRenamingModuleId(null);
                      }
                    } else if (e.key === 'Escape') {
                      e.stopPropagation();
                      setRenamingModuleId(null);
                    }
                  }}
                />
                {/* Parent folder selector */}
                <div className="flex items-center gap-1">
                  <CornerDownRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                  <select
                    value={renameParentId || ''}
                    onChange={(e) => setRenameParentId(e.target.value || null)}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-background border border-border rounded px-1 py-0.5 text-[10px] text-foreground focus:outline-none w-full cursor-pointer"
                  >
                    <option value="">— Root (no parent) —</option>
                    {getValidParentOptions(module.id).map(m => (
                      <option key={m.id} value={m.id}>{getModuleLabel(m)}</option>
                    ))}
                  </select>
                </div>
                {/* Explicit Action Buttons */}
                <div className="flex items-center justify-end gap-1.5 mt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingModuleId(null);
                    }}
                    className="px-2 py-0.5 hover:bg-secondary rounded text-[10px] font-medium text-muted-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (renameModuleName.trim()) {
                        onRenameModule(module.id, renameModuleName.trim(), renameParentId);
                        setRenamingModuleId(null);
                      }
                    }}
                    className="px-2 py-0.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded text-[10px] font-bold transition-all shadow"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <span className="truncate text-foreground/80 hover:text-foreground">{module.name}</span>
            )}
          </div>

          {/* Hover Actions */}
          {!isRenaming && (
            <div className="flex items-center gap-1 opacity-0 group-hover/module:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNewNote(module.id);
                }}
                className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"
                title="New Note here"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCreatingModuleInId(module.id);
                  setNewModuleName('');
                  setExpandedModules(prev => ({ ...prev, [module.id]: true }));
                }}
                className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"
                title="New Subfolder"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingModuleId(module.id);
                  setRenameModuleName(module.name);
                  setRenameParentId(module.parentId || null);
                }}
                className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"
                title="Rename / Move Folder"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete folder "${module.name}"? Notes inside will be moved to uncategorized.`)) {
                    onDeleteModule(module.id);
                  }
                }}
                className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-destructive"
                title="Delete Folder"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Expanded Children — with indentation guide line */}
        {isExpanded && (
          <div className="ml-[18px] pl-3 border-l border-border/30 space-y-0.5">
            {/* Subfolders */}
            {childModules.map(child => renderModule(child))}

            {/* Inline creation field if active in this module */}
            {creatingModuleInId === module.id && renderInlineCreateForm(module.id)}

            {/* Notes inside this module */}
            {childNotes.map(note => renderNoteRow(note))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="h-full w-72 border-r border-border bg-background flex flex-col shrink-0 overflow-hidden transition-colors duration-300">
      {/* App Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-border">
        <div className="flex items-center gap-2">
          <Logo size={24} className="w-6 h-6 rounded" />
          <span className="text-base font-semibold text-foreground tracking-tight">DevNotes</span>
        </div>
        <div className="flex items-center gap-2">
          <UserButton 
            appearance={{
              elements: {
                avatarBox: "w-6 h-6 rounded outline-none ring-0",
                userButtonTrigger: "hover:bg-secondary p-1 rounded transition-colors outline-none ring-0",
                userButtonPopoverCard: "bg-popover border border-border shadow-2xl text-foreground",
              }
            }}
          />
          <button 
            onClick={onOpenSettings}
            className="text-zinc-400 hover:text-white p-1.5 hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer"
            title="Paramètres Développeur"
          >
            <SettingsIcon className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Action & Search */}
      <div className="p-4 flex flex-col gap-3">
        <button 
          onClick={() => onNewNote(null)}
          className="w-full flex items-center justify-center gap-2 shiny-btn py-2 rounded-lg text-xs font-medium text-zinc-200 hover:text-white transition-all cursor-pointer group"
        >
          <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform text-zinc-400 group-hover:text-white" strokeWidth={1.5} />
          <span>New Note</span>
        </button>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" strokeWidth={1.5} />
          <input 
            type="text" 
            placeholder="Search notes (use # for tags)..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#121215] border border-white/[0.06] hover:border-white/[0.12] focus:border-zinc-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none transition-all font-sans"
          />
        </div>
      </div>

      {/* Note List / Folder Tree */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
        {search !== '' ? (
          <div>
            <h2 className="text-[10px] font-bold text-muted-foreground/60 mb-3 px-2 tracking-[0.2em] uppercase">Search Results</h2>
            <div className="flex flex-col gap-1">
              {filteredNotes.length === 0 ? (
                <div className="px-2 py-8 text-center bg-secondary/20 rounded-xl border border-dashed border-border/50">
                  <p className="text-xs text-muted-foreground italic">No results found</p>
                </div>
              ) : (
                filteredNotes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => onSelectNote(note.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all group relative mb-1",
                      activeNoteId === note.id 
                        ? "bg-secondary border-primary/20 shadow-sm" 
                        : "hover:bg-secondary/60 border-transparent"
                    )}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <h3 className={cn(
                        "text-sm pr-4 truncate transition-colors",
                        activeNoteId === note.id ? "font-semibold text-foreground" : "font-medium text-foreground/70 group-hover:text-foreground"
                      )}>
                        {note.title || 'Untitled Note'}
                      </h3>
                      <FileText className={cn(
                        "w-4 h-4 shrink-0 transition-opacity",
                        activeNoteId === note.id ? "text-primary opacity-100" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                      )} strokeWidth="1.5" />
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2">
                      <Clock className="w-3 h-3" strokeWidth="1.5" />
                      <span>{formatDistanceToNow(note.updatedAt)} ago</span>
                    </div>

                    {note.tags.length > 0 && (
                      <div className="flex gap-1.5">
                        {note.tags.slice(0, 2).map(tag => (
                          <span 
                            key={tag} 
                            className={cn(
                              "px-2 py-0.5 rounded-md text-[9px] font-medium border bg-background/50",
                              activeNoteId === note.id ? "border-primary/20 text-primary" : "border-border text-muted-foreground"
                            )}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3 px-2">
              <h2 className="text-[10px] font-bold text-muted-foreground/60 tracking-[0.2em] uppercase">Folders</h2>
              <button 
                onClick={() => {
                  setCreatingModuleInId('root');
                  setNewModuleName('');
                }}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 hover:bg-secondary rounded cursor-pointer"
                title="New Folder"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="flex flex-col gap-0.5">
              {/* Root folder inline create form */}
              {creatingModuleInId === 'root' && renderInlineCreateForm(null)}
              
              {/* Render root modules */}
              {modules.filter(m => !m.parentId).map(module => renderModule(module))}

              {/* Render root notes */}
              {notes.filter(n => !n.moduleId).map(note => renderNoteRow(note))}

              {modules.length === 0 && notes.filter(n => !n.moduleId).length === 0 && creatingModuleInId !== 'root' && (
                <div className="px-2 py-8 text-center bg-secondary/15 rounded-xl border border-dashed border-border/40">
                  <p className="text-xs text-muted-foreground italic">No folders or notes. Create one to get started!</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { saveTranslation, updateTranslation, deleteTranslation, getUserTranslations, renameTranslation } from '../lib/db';
import styles from '@/styles/Home.module.css';
import { Section, SavedTranslation } from '../types/translation';

export default function Home() {
  const [lyrics, setLyrics] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savedTranslations, setSavedTranslations] = useState<SavedTranslation[]>([]);
  const [saveTitle, setSaveTitle] = useState('');
  const [selectedTranslation, setSelectedTranslation] = useState<string | null>(null);
  const [error, setError] = useState<{message: string, details?: string} | null>(null);
  const [editingSections, setEditingSections] = useState<{[key: number]: boolean}>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

  const { user, logOut } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // Load saved translations from Firestore on component mount
  useEffect(() => {
    async function loadTranslations() {
      if (!user) return;
      try {
        const translations = await getUserTranslations(user.uid);
        setSavedTranslations(translations);
      } catch (error) {
        console.error('Error loading translations:', error);
        setError({
          message: 'Failed to load translations',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    loadTranslations();
  }, [user]);

  const handleSaveTranslation = async () => {
    if (!saveTitle.trim() || sections.length === 0 || !user) return;

    try {
      const translationData = {
        userId: user.uid,
        title: saveTitle.trim(),
        lyrics,
        sections,
        timestamp: new Date().getTime()
      };

      const newId = await saveTranslation(user.uid, translationData);
      const newTranslation = {
        id: newId,
        ...translationData
      };

      setSavedTranslations(prev => 
        [newTranslation, ...prev].sort((a, b) => b.timestamp - a.timestamp)
      );
      setSaveTitle('');
      setSelectedTranslation(newId);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving translation:', error);
      setError({
        message: 'Failed to save translation',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleOverwriteSave = async () => {
    if (!selectedTranslation || sections.length === 0 || !user) return;

    try {
      await updateTranslation(selectedTranslation, {
        lyrics,
        sections,
        timestamp: new Date().getTime()
      });

      setSavedTranslations(prev =>
        prev.map(t =>
          t.id === selectedTranslation
            ? { ...t, lyrics, sections, timestamp: new Date().getTime() }
            : t
        ).sort((a, b) => b.timestamp - a.timestamp)
      );
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error updating translation:', error);
      setError({
        message: 'Failed to update translation',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleDeleteTranslation = async (id: string) => {
    if (!user) return;

    try {
      await deleteTranslation(id);
      setSavedTranslations(prev => prev.filter(t => t.id !== id));
      if (selectedTranslation === id) {
        setSelectedTranslation(null);
        setLyrics('');
        setSections([]);
      }
    } catch (error) {
      console.error('Error deleting translation:', error);
      setError({
        message: 'Failed to delete translation',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      setError({
        message: 'Failed to log out',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleTranslate = async () => {
    if (!lyrics.trim()) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lyrics }),
      });
      
      const data = await response.json();
      if (data.sections) {
        setSections(data.sections);
        setSelectedTranslation(null);
        setHasUnsavedChanges(true);
      } else if (data.error) {
        console.error('Translation error:', data);
        setError({
          message: data.error,
          details: data.details + (data.rawResponse ? `\n\nAPI Response:\n${data.rawResponse}` : '')
        });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error: any) {
      console.error('Translation error:', error);
      setError({
        message: 'Failed to translate lyrics',
        details: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewTranslation = () => {
    setLyrics('');
    setSections([]);
    setSelectedTranslation(null);
    setSaveTitle('');
  };

  const handleLoadTranslation = (translation: SavedTranslation) => {
    setLyrics(translation.lyrics);
    setSections(translation.sections);
    setSelectedTranslation(translation.id);
    setHasUnsavedChanges(false);
  };

  const handleExportTranslation = (translation: SavedTranslation) => {
    const exportData = JSON.stringify(translation, null, 2);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${translation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_translation.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportTranslation = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedTranslation = JSON.parse(e.target?.result as string);
        // Validate the imported data has required fields
        if (!importedTranslation.title || !importedTranslation.lyrics || !importedTranslation.sections) {
          throw new Error('Invalid translation file format');
        }
        
        const translationData = {
          userId: user.uid,
          title: importedTranslation.title,
          lyrics: importedTranslation.lyrics,
          sections: importedTranslation.sections,
          timestamp: new Date().getTime()
        };

        const newId = await saveTranslation(user.uid, translationData);
        const newTranslation = {
          id: newId,
          ...translationData
        };

        setSavedTranslations(prev => 
          [newTranslation, ...prev].sort((a, b) => b.timestamp - a.timestamp)
        );
        
        // Select the imported translation
        handleLoadTranslation(newTranslation);
      } catch (error) {
        setError({
          message: 'Failed to import translation',
          details: 'The selected file is not a valid translation file.'
        });
      }
    };
    reader.readAsText(file);
    // Reset the input so the same file can be imported again
    event.target.value = '';
  };

  const handleEditTranslation = (index: number, newTranslation: string) => {
    const updatedSections = [...sections];
    updatedSections[index] = {
      ...updatedSections[index],
      translation: newTranslation
    };
    setSections(updatedSections);
    setHasUnsavedChanges(true);
  };

  const handleEditAnalysis = (index: number, newAnalysis: string) => {
    const updatedSections = [...sections];
    updatedSections[index] = {
      ...updatedSections[index],
      analysis: newAnalysis
    };
    setSections(updatedSections);
    setHasUnsavedChanges(true);
  };

  const toggleEditMode = (index: number) => {
    setEditingSections(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleStartRename = (translation: SavedTranslation, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(translation.id);
    setNewTitle(translation.title);
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingId || !newTitle.trim()) return;

    try {
      await renameTranslation(renamingId, newTitle.trim());
      setSavedTranslations(prev =>
        prev.map(t =>
          t.id === renamingId
            ? { ...t, title: newTitle.trim(), timestamp: Date.now() }
            : t
        ).sort((a, b) => b.timestamp - a.timestamp)
      );
      setRenamingId(null);
      setNewTitle('');
    } catch (error) {
      console.error('Error renaming translation:', error);
      setError({
        message: 'Failed to rename translation',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Add logout button to the header
  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <div className={styles.userInfo}>
          {user && <span>{user.email}</span>}
          <button
            className={styles.logoutButton}
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Rest of your existing JSX */}
      {error && (
        <div className={styles.errorOverlay} onClick={() => setError(null)}>
          <div className={styles.errorModal} onClick={e => e.stopPropagation()}>
            <h3>Translation Error</h3>
            <p>{error.message}</p>
            {error.details && (
              <div className={styles.errorDetails}>
                <h4>Details:</h4>
                <pre>{error.details}</pre>
              </div>
            )}
            <button 
              className={styles.errorCloseButton}
              onClick={() => setError(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      <aside className={styles.sidebar}>
        <h2 className={styles.sidebarTitle}>Saved Translations</h2>
        <div className={styles.sidebarButtons}>
          <button
            className={styles.newButton}
            onClick={handleNewTranslation}
          >
            + New Translation
          </button>
          <input
            type="file"
            id="importInput"
            accept=".json"
            onChange={handleImportTranslation}
            style={{ display: 'none' }}
          />
          <button
            className={styles.importButton}
            onClick={() => document.getElementById('importInput')?.click()}
          >
            Import Translation
          </button>
        </div>
        <div className={styles.savedList}>
          {savedTranslations.map((translation) => (
            <div
              key={translation.id}
              className={`${styles.savedItem} ${selectedTranslation === translation.id ? styles.selected : ''}`}
              onClick={() => handleLoadTranslation(translation)}
            >
              <div className={styles.savedItemContent}>
                {renamingId === translation.id ? (
                  <form onSubmit={handleRename} onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      className={styles.renameInput}
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          setRenamingId(null);
                        }
                      }}
                    />
                  </form>
                ) : (
                  <>
                    <h3>{translation.title}</h3>
                    <span>{new Date(translation.timestamp).toLocaleString()}</span>
                  </>
                )}
              </div>
              <div className={styles.savedItemActions}>
                {
                  renamingId === translation.id ? (
                    <>
                      <button
                        className={styles.renameButton}
                        onClick={handleRename}
                        title="Confirm Rename"
                      >
                        ✓
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(null);
                        }}
                        title="Cancel Rename"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className={styles.renameButton}
                        onClick={(e) => handleStartRename(translation, e)}
                        title="Rename Translation"
                      >
                        ✎
                      </button>
                      <button
                        className={styles.exportButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportTranslation(translation);
                        }}
                        title="Export Translation"
                      >
                        ↓
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTranslation(translation.id);
                        }}
                        title="Delete Translation"
                      >
                        ×
                      </button>
                    </>
                  )
                }
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Lyrics Translator & Analyzer</h1>
          
          <div className={styles.editorContainer}>
            <div className={styles.column}>
              <h2>Original Lyrics</h2>
              <textarea
                className={styles.editor}
                value={lyrics}
                onChange={(e) => {
                  const text = e.target.value;
                  if (text.length <= 3000) { // 3000 character limit
                    setLyrics(text);
                  }
                }}
                placeholder="Enter your lyrics here..."
                rows={15}
                maxLength={3000}
              />
              <div className={`${styles.characterCount} ${lyrics.length >= 2700 ? styles.limit : ''}`}>
                {lyrics.length}/3000 characters
              </div>
            </div>
          </div>

          <button
            className={styles.translateButton}
            onClick={handleTranslate}
            disabled={isLoading || !lyrics.trim() || sections.length > 0}
          >
            {isLoading ? 'Translating...' : sections.length > 0 ? 'Already Translated' : 'Translate'}
          </button>

          {!isLoading && (
            <>
              <div className={styles.sectionsContainer}>
                {sections.map((section, index) => (
                  <div key={index} className={styles.sectionCard}>
                    <h3 className={styles.sectionType}>{section.type}</h3>
                    <div className={styles.sectionContent}>
                      <div className={styles.sectionOriginal}>
                        <h4>Original</h4>
                        <pre>{section.original}</pre>
                      </div>
                      <div className={styles.sectionTranslation}>
                        <div className={styles.sectionHeader}>
                          <h4>Translation</h4>
                          <button
                            className={styles.editButton}
                            onClick={() => toggleEditMode(index)}
                            title={editingSections[index] ? "Save Changes" : "Edit Translation"}
                          >
                            {editingSections[index] ? "✓" : "✎"}
                          </button>
                        </div>
                        {editingSections[index] ? (
                          <textarea
                            className={styles.translationEditor}
                            value={section.translation}
                            onChange={(e) => handleEditTranslation(index, e.target.value)}
                            rows={section.translation.split('\n').length}
                          />
                        ) : (
                          <pre>{section.translation}</pre>
                        )}
                      </div>
                    </div>
                    <div className={styles.sectionAnalysis}>
                      <div className={styles.sectionHeader}>
                        <h4>Analysis</h4>
                        <button
                          className={styles.editButton}
                          onClick={() => toggleEditMode(index)}
                          title={editingSections[index] ? "Save Changes" : "Edit Analysis"}
                        >
                          {editingSections[index] ? "✓" : "✎"}
                        </button>
                      </div>
                      {editingSections[index] ? (
                        <textarea
                          className={styles.analysisEditor}
                          value={section.analysis}
                          onChange={(e) => handleEditAnalysis(index, e.target.value)}
                          rows={Math.min(10, section.analysis.split('\n').length + 2)}
                        />
                      ) : (
                        <p>{section.analysis}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {sections.length > 0 && (
                <div className={styles.saveContainer}>
                  {selectedTranslation ? (
                    <div className={styles.saveOptions}>
                      <div className={styles.saveStatus}>
                        Currently saved as "{savedTranslations.find(t => t.id === selectedTranslation)?.title}"
                        {hasUnsavedChanges && <span className={styles.unsavedIndicator}>• Unsaved Changes</span>}
                      </div>
                      {hasUnsavedChanges && (
                        <div className={styles.saveActions}>
                          <button
                            className={styles.overwriteButton}
                            onClick={handleOverwriteSave}
                          >
                            Overwrite Current Save
                          </button>
                          <button
                            className={styles.saveAsNewButton}
                            onClick={() => {
                              setSelectedTranslation(null);
                              setSaveTitle('');
                            }}
                          >
                            Save as New Translation
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        className={styles.saveInput}
                        value={saveTitle}
                        onChange={(e) => setSaveTitle(e.target.value)}
                        placeholder="Enter a title for this translation..."
                      />
                      <button
                        className={styles.saveButton}
                        onClick={handleSaveTranslation}
                        disabled={!saveTitle.trim()}
                      >
                        Save Translation
                      </button>
                    </>
                  )}
      </div>
              )}
    </>
          )}
        </div>
      </main>
    </div>
  );
}

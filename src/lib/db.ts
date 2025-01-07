import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { SavedTranslation } from '../types/translation';

// Custom error class for database operations
class DatabaseError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

// Validate translation data
function validateTranslation(translation: any) {
  if (!translation.title || typeof translation.title !== 'string' || translation.title.length > 200) {
    throw new DatabaseError('Invalid title', 'invalid-title');
  }
  if (!translation.lyrics || typeof translation.lyrics !== 'string' || translation.lyrics.length > 3000) {
    throw new DatabaseError('Invalid lyrics', 'invalid-lyrics');
  }
  if (!Array.isArray(translation.sections) || translation.sections.length > 50) {
    throw new DatabaseError('Invalid sections', 'invalid-sections');
  }
}

// Verify document ownership
async function verifyOwnership(docId: string, userId: string) {
  const docRef = doc(db, 'translations', docId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new DatabaseError('Translation not found', 'not-found');
  }
  
  if (docSnap.data().userId !== userId) {
    throw new DatabaseError('Unauthorized access', 'unauthorized');
  }
  
  return docSnap;
}

export async function saveTranslation(userId: string, translation: Omit<SavedTranslation, 'id'>) {
  try {
    validateTranslation(translation);

    const docRef = await addDoc(collection(db, 'translations'), {
      ...translation,
      userId,
      timestamp: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving translation:', error);
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError('Failed to save translation', 'save-failed');
  }
}

export async function updateTranslation(translationId: string, translation: Partial<SavedTranslation>) {
  try {
    // Verify ownership before update
    await verifyOwnership(translationId, translation.userId!);
    
    validateTranslation(translation);

    const docRef = doc(db, 'translations', translationId);
    await updateDoc(docRef, {
      ...translation,
      timestamp: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating translation:', error);
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError('Failed to update translation', 'update-failed');
  }
}

export async function deleteTranslation(translationId: string) {
  try {
    const docRef = doc(db, 'translations', translationId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new DatabaseError('Translation not found', 'not-found');
    }

    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting translation:', error);
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError('Failed to delete translation', 'delete-failed');
  }
}

export async function getUserTranslations(userId: string) {
  try {
    if (!userId) {
      throw new DatabaseError('User ID is required', 'invalid-user');
    }

    const q = query(
      collection(db, 'translations'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toMillis() || Date.now()
      };
    }) as SavedTranslation[];
  } catch (error) {
    console.error('Error getting translations:', error);
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError('Failed to get translations', 'fetch-failed');
  }
}

export async function renameTranslation(translationId: string, newTitle: string) {
  try {
    if (!newTitle || typeof newTitle !== 'string' || newTitle.length > 200) {
      throw new DatabaseError('Invalid title', 'invalid-title');
    }

    const docRef = doc(db, 'translations', translationId);
    await updateDoc(docRef, {
      title: newTitle,
      timestamp: Timestamp.now()
    });
  } catch (error) {
    console.error('Error renaming translation:', error);
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError('Failed to rename translation', 'rename-failed');
  }
} 